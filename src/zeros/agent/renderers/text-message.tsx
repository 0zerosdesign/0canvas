// ──────────────────────────────────────────────────────────
// TextMessage — assistant / user / thought / system bubbles
// ──────────────────────────────────────────────────────────
//
// Phase 0 extraction. Behavior identical to the inline
// MessageView text branch in agent-chat.tsx — same CSS classes,
// same plain-text rendering. Markdown / streaming refinements
// land in Phase 1 by editing this file in isolation.
//
// React.memo is applied so future per-chat state slicing
// (Phase 0 step 4 — Zustand) lets one message update without
// re-rendering its siblings.
//
// ──────────────────────────────────────────────────────────

import { memo } from "react";
import type { Renderer } from "./types";
import type { AgentTextMessage } from "../use-agent-session";

export const TextMessage: Renderer<AgentTextMessage> = memo(function TextMessage({
  message,
}) {
  const roleClass = `oc-agent-msg oc-agent-msg-${message.role}`;
  return (
    <div className={roleClass}>
      <div className="oc-agent-msg-content">{message.text}</div>
    </div>
  );
});
