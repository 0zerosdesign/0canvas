// ──────────────────────────────────────────────────────────
// MessageView — the single dispatch component
// ──────────────────────────────────────────────────────────
//
// Replaces the old inline MessageView that lived in agent-chat.
// Looks up the renderer for `message` in the registry and
// passes the shared `ctx` (currently just applyReceipts).
//
// Memoized at the dispatcher level so the parent re-rendering
// — which it does on every streaming chunk until Phase 0 step
// 4 (Zustand slicing) lands — only re-renders the message
// whose content changed, not its siblings.
//
// ──────────────────────────────────────────────────────────

import { memo } from "react";
import type { AgentMessage } from "../use-agent-session";
import type { RendererContext, RendererRegistry } from "./types";
import { defaultRegistry, resolveRenderer } from "./registry";

interface MessageViewProps {
  message: AgentMessage;
  ctx: RendererContext;
  registry?: RendererRegistry;
}

export const MessageView = memo(
  function MessageView({ message, ctx, registry = defaultRegistry }: MessageViewProps) {
    const { Component } = resolveRenderer(message, registry);
    return <Component message={message} ctx={ctx} />;
  },
  // Re-render only when the message itself or its slice of ctx changed.
  // applyReceipts is keyed by toolCallId; for non-tool messages it never
  // affects the render, so we don't compare the whole object.
  (prev, next) => {
    if (prev.message !== next.message) return false;
    if (prev.registry !== next.registry) return false;
    if (prev.message.kind === "tool") {
      const id = prev.message.toolCallId;
      return prev.ctx.applyReceipts[id] === next.ctx.applyReceipts[id];
    }
    return true;
  },
);
