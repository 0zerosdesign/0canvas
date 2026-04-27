// ──────────────────────────────────────────────────────────
// TextMessage — user / agent / system bubbles
// ──────────────────────────────────────────────────────────
//
// Stage 5.5: agent replies render as sanitised markdown
// (marked + DOMPurify, see ../markdown.ts). T3 Chat pattern —
// the per-message useMemo + the MessageView memo together
// guarantee finalized messages parse exactly once and only
// the actively-streaming message re-parses on each chunk.
// Cost stays flat regardless of transcript length.
//
// User and system messages stay plain-text. Users rarely
// type markdown, and rendering their input as HTML would
// surprise them (e.g. their "*emphasis*" would silently
// collapse to italic). System messages are short status
// notes that don't need formatting either.
//
// thought messages are rendered by ThinkingBlock now (Stage
// 4.1) — they don't reach this renderer in the default
// registry.
// ──────────────────────────────────────────────────────────

import { memo, useMemo } from "react";
import type { Renderer } from "./types";
import type { AgentTextMessage } from "../use-agent-session";
import { renderMarkdown } from "../markdown";

export const TextMessage: Renderer<AgentTextMessage> = memo(function TextMessage({
  message,
}) {
  const roleClass = `oc-agent-msg oc-agent-msg-${message.role}`;
  const useMarkdown = message.role === "agent";

  const html = useMemo(
    () => (useMarkdown ? renderMarkdown(message.text) : null),
    [useMarkdown, message.text],
  );

  return (
    <div className={roleClass}>
      {useMarkdown && html != null ? (
        <div
          className="oc-agent-msg-content oc-agent-md"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="oc-agent-msg-content">{message.text}</div>
      )}
    </div>
  );
});
