// ──────────────────────────────────────────────────────────
// renderer registry — types
// ──────────────────────────────────────────────────────────
//
// Phase 0 of the chat UI rebuild. The old MessageView was a
// binary if/else (text vs. tool) which made every new message
// type a fork in agent-chat.tsx. The registry inverts that:
// each message kind is a self-contained renderer, dispatch is
// a table lookup. New tool renderers (bash, edit, read, …) land
// as new files plus a single registry entry — no churn in the
// chat shell, no risk of breaking unrelated paths.
//
// Dispatch axes (in order):
//   1. message.kind            — "text" | "tool" | unknown
//   2. (text)  message.role    — user | agent | thought | system
//   3. (tool)  custom matchers — design tools, subagent, …
//   4. (tool)  tool kind    — read | edit | execute | …
//
// Phase 1 will add per-toolKind renderers; Phase 2 wraps them in
// memo and a virtualized list.
//
// ──────────────────────────────────────────────────────────

import type { ComponentType } from "react";
import type { ToolKind } from "../../bridge/agent-events";
import type {
  AgentMessage,
  AgentMessageRole,
  AgentTextMessage,
  AgentToolMessage,
} from "../use-agent-session";

/** Per-render context shared by every renderer. Passed by the host
 *  (agent-chat) so renderers stay pure — no hooks into store / bridge
 *  inside renderer files. Extend by adding fields here, never by
 *  reaching into globals. */
export interface RendererContext {
  /** Captured `apply_change` before/after pairs, keyed by toolCallId.
   *  Owned by agent-chat; passed through so the design-tool card can
   *  surface a persistent diff after the agent finishes. */
  applyReceipts: Record<string, ApplyReceipt>;
  /** True when the session is actively streaming agent output. The
   *  ThinkingBlock + future card kinds use this to decide whether to
   *  render shimmer / live-tick duration / "now" affordances. */
  isStreaming: boolean;
  /** Id of the most recent message in the timeline. Renderers that
   *  need "am I the in-flight message?" compare their own message.id
   *  to this. Stable per render — agent-chat memoizes the context. */
  lastMessageId: string | null;
  /** createdAt of the last user message — i.e. the start of the
   *  currently-active turn. Renderers that want "am I in the active
   *  turn?" compare their own message.createdAt against this.
   *
   *  Used by ThinkingBlock so the shimmer persists for the *entire*
   *  active turn (not just the brief window where the thought is the
   *  literal last message). Old thoughts from prior turns sit below
   *  this threshold and stay calm. */
  activeTurnStartedAt: number;
  /** Stage 4.2 — predecessors keyed by primary toolCallId. EditCard
   *  reads this for its own toolCallId to render "+N more changes"
   *  history without each renderer having to scan the full message
   *  array.
   *
   *  Empty for tool calls that didn't get merged (i.e. the only one
   *  in their mergeKey group). The host computes this once per
   *  session.messages change. */
  mergeSiblings: Map<string, import("../use-agent-session").AgentToolMessage[]>;
  /** Stage 4.3 — submit handler for QuestionCard. Today this dispatches
   *  the answer as a normal next-turn user prompt (the "inferred" path
   *  in §2.4.9), since our adapters close stdin after spawn and can't
   *  write a tool_result back to the running Claude process. Native
   *  blocking AskUserQuestion is a Stage 4.4+ adapter capability —
   *  same hook, different routing under the hood when it ships. */
  respondToQuestion: (text: string) => void;
}

export interface ApplyReceipt {
  before: string | null;
  selector: string;
  property: string;
  after: string;
}

export type Renderer<M extends AgentMessage> = ComponentType<{
  message: M;
  ctx: RendererContext;
}>;

/** A custom matcher runs before tool-kind dispatch. Lets design
 *  tools and subagent calls win over the generic by-kind renderer
 *  when their title/input shape says so. */
export interface ToolMatcher {
  match: (tool: AgentToolMessage) => boolean;
  render: Renderer<AgentToolMessage>;
}

export interface RendererRegistry {
  text: Partial<Record<AgentMessageRole, Renderer<AgentTextMessage>>>;
  /** Default text renderer if a role has none registered. */
  textFallback: Renderer<AgentTextMessage>;
  /** Custom matchers, evaluated top-down. First hit wins. */
  toolMatchers: ToolMatcher[];
  /** canonical tool kinds — `kind` field on ToolCall. */
  toolByKind: Partial<Record<ToolKind, Renderer<AgentToolMessage>>>;
  /** Final fallback for tools that match no rule above. */
  toolFallback: Renderer<AgentToolMessage>;
  /** Stage 4.4 — non-text/non-tool message kinds (mode_switch, plan,
   *  subagent, error_notice, …). Looked up by `message.kind` after the
   *  text + tool branches fail. */
  byKind: Partial<
    Record<
      Exclude<AgentMessage["kind"], "text" | "tool">,
      ComponentType<{ message: AgentMessage; ctx: RendererContext }>
    >
  >;
  /** Renderer for messages whose `kind` is not in our union. Phase 0
   *  added this so future engine events never silently drop. */
  unknown: ComponentType<{ message: AgentMessage; ctx: RendererContext }>;
}
