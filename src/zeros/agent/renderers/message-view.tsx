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
import type { AgentMessage, AgentTextMessage } from "../use-agent-session";
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
  //
  // The new ctx slice (isStreaming + lastMessageId) only matters for
  // renderers that opt into "am I the in-flight message" UX — today that's
  // thought messages (ThinkingBlock). For everything else we still bail
  // early so a streaming chunk into the last message doesn't re-render the
  // 50 above it.
  (prev, next) => {
    if (prev.message !== next.message) return false;
    if (prev.registry !== next.registry) return false;
    if (prev.message.kind === "tool") {
      const id = prev.message.toolCallId;
      return prev.ctx.applyReceipts[id] === next.ctx.applyReceipts[id];
    }
    if (prev.message.kind === "text") {
      const role = (prev.message as AgentTextMessage).role;
      if (role === "thought") {
        // ThinkingBlock cares about isStreaming + activeTurnStartedAt so
        // its shimmer persists for the whole active turn. lastMessageId
        // is no longer used by the renderer but kept in the compare for
        // future in-flight-aware text renderers.
        if (prev.ctx.isStreaming !== next.ctx.isStreaming) return false;
        if (prev.ctx.activeTurnStartedAt !== next.ctx.activeTurnStartedAt) {
          return false;
        }
      }
    }
    return true;
  },
);
