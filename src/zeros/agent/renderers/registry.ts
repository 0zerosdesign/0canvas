// ──────────────────────────────────────────────────────────
// renderer registry — dispatch
// ──────────────────────────────────────────────────────────
//
// Centralised lookup that turns an AgentMessage into JSX.
// Phase 0 wires the existing renderers (text + the unified
// ToolCard) plus an unknown-kind fallback. Phase 1 adds
// per-toolKind cards (bash, edit, read, …) by appending to
// `toolByKind` here — agent-chat.tsx never needs to know.
//
// ──────────────────────────────────────────────────────────

import type {
  AgentMessage,
  AgentTextMessage,
  AgentToolMessage,
} from "../use-agent-session";
import type { RendererRegistry } from "./types";
import { TextMessage } from "./text-message";
import { ToolCard } from "./tool-card";
import { UnknownMessage } from "./unknown-message";
import { matchDesignTool } from "./design-tools";
import { matchSubagent } from "./subagent";
import { ShellCard } from "./tool-shell";
import { EditCard } from "./tool-edit";
import { ReadCard } from "./tool-read";
import { SearchCard } from "./tool-search";
import { FetchCard } from "./tool-fetch";
import { ThinkingBlock } from "./thinking-block";
import { QuestionCard } from "./question-card";
import { MCPCard } from "./tool-mcp";
import { SubagentCard } from "./tool-subagent";
import { ModeSwitchBanner } from "./mode-switch-banner";

/** The default registry. New renderers register here; this is the single
 *  point of composition for the chat. */
export const defaultRegistry: RendererRegistry = {
  text: {
    user: TextMessage,
    agent: TextMessage,
    // Stage 4.1: thought messages get the dedicated ThinkingBlock —
    // collapsed pill with shimmer while in flight, instead of plain
    // italic text bubbles.
    thought: ThinkingBlock,
    system: TextMessage,
  },
  textFallback: TextMessage,
  toolMatchers: [
    // Design tools still share the unified ToolCard — they're Zeros's
    // own tool surface, not a generic kind. Stage 4 keeps them on the
    // bespoke ToolCard branch.
    { match: (t) => matchDesignTool(t.title) !== null, render: ToolCard },
    // Stage 4.3 — subagent custom matcher catches agents whose
    // translator hasn't been taught to emit kind="subagent" yet
    // (Amp, Droid, etc. before Stage 8 lands). Routes to the dedicated
    // SubagentCard so all subagent calls render uniformly regardless
    // of which path tagged them.
    { match: (t) => matchSubagent(t) !== null, render: SubagentCard },
  ],
  toolByKind: {
    // Stage 3: high-volume cards — Shell, Edit, Read.
    execute: ShellCard,
    edit: EditCard,
    read: ReadCard,
    // Stage 4.1: Search + Fetch + Web search.
    search: SearchCard,
    fetch: FetchCard,
    web_search: FetchCard,
    // Stage 4.3: Question + MCP + Subagent.
    question: QuestionCard,
    mcp: MCPCard,
    subagent: SubagentCard,
  },
  toolFallback: ToolCard,
  byKind: {
    // Stage 4.4: mode-switch banner (user toggle + agent autonomous switch).
    mode_switch: ModeSwitchBanner,
  },
  unknown: UnknownMessage,
};

/** Look up the renderer for a single message. Pure — no side effects, no
 *  hooks. Callers wrap the result in their own layout / list code. */
export function resolveRenderer(
  message: AgentMessage,
  registry: RendererRegistry = defaultRegistry,
): {
  Component: React.ComponentType<{ message: AgentMessage; ctx: import("./types").RendererContext }>;
} {
  if (message.kind === "text") {
    const Component =
      (registry.text[(message as AgentTextMessage).role] ??
        registry.textFallback) as React.ComponentType<{
        message: AgentMessage;
        ctx: import("./types").RendererContext;
      }>;
    return { Component };
  }

  if (message.kind === "tool") {
    const tool = message as AgentToolMessage;
    for (const m of registry.toolMatchers) {
      if (m.match(tool)) {
        return {
          Component: m.render as React.ComponentType<{
            message: AgentMessage;
            ctx: import("./types").RendererContext;
          }>,
        };
      }
    }
    if (tool.toolKind) {
      const byKind = registry.toolByKind[tool.toolKind as keyof typeof registry.toolByKind];
      if (byKind) {
        return {
          Component: byKind as React.ComponentType<{
            message: AgentMessage;
            ctx: import("./types").RendererContext;
          }>,
        };
      }
    }
    return {
      Component: registry.toolFallback as React.ComponentType<{
        message: AgentMessage;
        ctx: import("./types").RendererContext;
      }>,
    };
  }

  // Stage 4.4 — non-text/non-tool message kinds dispatch via byKind
  // (mode_switch banner today; plan / question / subagent / error_notice
  // arrive in later slices).
  const byKind = (
    registry.byKind as Record<
      string,
      | React.ComponentType<{
          message: AgentMessage;
          ctx: import("./types").RendererContext;
        }>
      | undefined
    >
  )[message.kind];
  if (byKind) {
    return { Component: byKind };
  }

  // Drift fallback: unknown renderer surfaces them visibly (collapsed JSON)
  // instead of silently dropping — engine/UI drift gets caught at runtime.
  return { Component: registry.unknown };
}
