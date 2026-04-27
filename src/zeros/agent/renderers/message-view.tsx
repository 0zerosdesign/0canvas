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
import { InlinePermissionCluster } from "./inline-permission";
import { AutoDecisionChip } from "./auto-decision-chip";

interface MessageViewProps {
  message: AgentMessage;
  ctx: RendererContext;
  registry?: RendererRegistry;
}

export const MessageView = memo(
  function MessageView({ message, ctx, registry = defaultRegistry }: MessageViewProps) {
    const { Component } = resolveRenderer(message, registry);
    // Stage 6.1 — inline permission cluster: when this message is a
    // tool whose toolCallId matches the session's pendingPermission,
    // render the Allow/Deny cluster directly under the card. Pulls
    // the decision into the user's reading flow instead of forcing
    // them to glance at the chrome between message list and composer.
    //
    // Stage 6.3 — kind="switch_mode" tools (Claude ExitPlanMode) get
    // a dedicated card that owns its own permission UI. Suppress the
    // generic cluster for those so we don't render two prompts.
    const inlinePermission =
      message.kind === "tool" &&
      message.toolKind !== "switch_mode" &&
      ctx.pendingPermission &&
      ctx.pendingPermission.request.toolCall.toolCallId === message.toolCallId
        ? ctx.pendingPermission.request
        : null;
    // Stage 6.2 — if a Zeros sticky policy auto-resolved this tool
    // call's permission, surface a small attribution chip with a
    // revoke button. Without it the auto-allow looks like the agent
    // acting without permission, which is surprising and reduces
    // trust in the policy machinery.
    const autoDecision =
      message.kind === "tool" ? ctx.autoDecisions[message.toolCallId] : null;
    return (
      <>
        <Component message={message} ctx={ctx} />
        {inlinePermission && (
          <InlinePermissionCluster
            request={inlinePermission}
            onRespond={ctx.respondToPermission}
            onRecordPolicy={ctx.recordPolicy}
            chatId={ctx.chatId}
          />
        )}
        {autoDecision && (
          <AutoDecisionChip
            decision={autoDecision.decision}
            onRevoke={() => ctx.revokePolicy(autoDecision.policyId)}
          />
        )}
      </>
    );
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
      if (prev.ctx.applyReceipts[id] !== next.ctx.applyReceipts[id]) {
        return false;
      }
      // Stage 4.2 — when a new sibling lands in the same merge group,
      // the primary's "+N more" history needs to re-render. Compare the
      // two siblings arrays by reference (mergeSiblings is rebuilt only
      // when session.messages changes, so reference equality is safe).
      if (
        prev.ctx.mergeSiblings.get(id) !== next.ctx.mergeSiblings.get(id)
      ) {
        return false;
      }
      // Stage 6.1 — re-render when this card's inline permission cluster
      // appears or disappears. Match the toolCallId against pendingPermission
      // on both sides.
      const prevMatched =
        prev.ctx.pendingPermission?.request.toolCall.toolCallId === id;
      const nextMatched =
        next.ctx.pendingPermission?.request.toolCall.toolCallId === id;
      if (prevMatched !== nextMatched) return false;
      // Permission request object identity changes ≈ a new permission
      // arrived for the same toolCallId (rare). Bail and re-render.
      if (
        nextMatched &&
        prev.ctx.pendingPermission !== next.ctx.pendingPermission
      ) {
        return false;
      }
      // Stage 6.2 — re-render when this card's auto-decision attribution
      // is added or revoked.
      if (prev.ctx.autoDecisions[id] !== next.ctx.autoDecisions[id]) {
        return false;
      }
      return true;
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
