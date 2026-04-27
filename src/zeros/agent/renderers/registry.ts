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

/** The default registry. New renderers register here; this is the single
 *  point of composition for the chat. */
export const defaultRegistry: RendererRegistry = {
  text: {
    user: TextMessage,
    agent: TextMessage,
    thought: TextMessage,
    system: TextMessage,
  },
  textFallback: TextMessage,
  toolMatchers: [
    // Phase 0: design tools and subagent calls share the unified ToolCard
    // (which already branches internally on those matchers). Phase 1 may
    // split them into dedicated renderers; until then a single shared
    // implementation keeps behavior identical to the pre-refactor code.
    { match: (t) => matchDesignTool(t.title) !== null, render: ToolCard },
    { match: (t) => matchSubagent(t) !== null, render: ToolCard },
  ],
  toolByKind: {
    // Stage 3: high-volume cards — Shell, Edit, Read.
    // Stage 4 fills in the rest (search / fetch / think / question / …).
    execute: ShellCard,
    edit: EditCard,
    read: ReadCard,
  },
  toolFallback: ToolCard,
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

  // Future: kinds added to the union land here. The unknown renderer
  // surfaces them visibly (collapsed JSON) instead of silently dropping
  // — drift between engine and UI gets caught at runtime.
  return { Component: registry.unknown };
}
