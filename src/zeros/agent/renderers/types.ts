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
//   4. (tool)  ACP toolKind    — read | edit | execute | …
//
// Phase 1 will add per-toolKind renderers; Phase 2 wraps them in
// memo and a virtualized list.
//
// ──────────────────────────────────────────────────────────

import type { ComponentType } from "react";
import type { ToolKind } from "@agentclientprotocol/sdk";
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

/** A custom matcher runs before ACP-toolKind dispatch. Lets design
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
  /** ACP-canonical tool kinds — `kind` field on ToolCall. */
  toolByKind: Partial<Record<ToolKind, Renderer<AgentToolMessage>>>;
  /** Final fallback for tools that match no rule above. */
  toolFallback: Renderer<AgentToolMessage>;
  /** Renderer for messages whose `kind` is not in our union. Phase 0
   *  added this so future engine events never silently drop. */
  unknown: ComponentType<{ message: AgentMessage; ctx: RendererContext }>;
}
