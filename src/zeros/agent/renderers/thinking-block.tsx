// ──────────────────────────────────────────────────────────
// ThinkingBlock — agent reasoning content
// ──────────────────────────────────────────────────────────
//
// Replaces the plain text-bubble rendering of role="thought"
// messages. Distinguishes reasoning from final output, gives
// the user a way to scan past it without reading.
//
// Behaviour:
//   - Always renders the same chevron + Brain + label structure
//     (collapsible, can expand to read italic body).
//   - "In flight" = `session.status === "streaming"` AND this
//     thought belongs to the active turn (its createdAt is
//     after the last user message). In that state the head
//     swaps `· 258 chars` for `· 12s` with a shimmer animation
//     on the word "Thinking" and a ticking duration. Persists
//     for the whole turn — not just the sub-second window
//     where the thought is literally the last message — so
//     the user can't miss it.
//   - Once the session goes ready, the head settles back to
//     `· 258 chars` and the shimmer stops. Old thoughts from
//     prior turns never shimmer.
//   - Expand still works in either state, so you can read
//     reasoning as it grows during a long turn.
// ──────────────────────────────────────────────────────────

import { memo, useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";

import type { AgentTextMessage } from "../use-agent-session";
import type { Renderer } from "./types";
import { LiveDuration } from "./live-duration";

export const ThinkingBlock: Renderer<AgentTextMessage> = memo(
  function ThinkingBlock({ message, ctx }) {
    const isInFlight =
      ctx.isStreaming &&
      ctx.activeTurnStartedAt > 0 &&
      message.createdAt >= ctx.activeTurnStartedAt;
    const [expanded, setExpanded] = useState(false);
    const charCount = message.text.length;
    const hasContent = charCount > 0;

    const wrapperClass = `oc-agent-thinking ${
      isInFlight ? "oc-agent-thinking-flight" : ""
    }`;

    return (
      <div className={wrapperClass}>
        <button
          type="button"
          className="oc-agent-thinking-head"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          disabled={!hasContent}
        >
          {expanded ? (
            <ChevronDown className="oc-agent-thinking-chev w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="oc-agent-thinking-chev w-3.5 h-3.5" />
          )}
          <Brain className="oc-agent-thinking-icon w-3.5 h-3.5" />
          {isInFlight ? (
            <>
              <span className="oc-agent-thinking-shimmer">Thinking</span>
              <LiveDuration
                startedAt={message.createdAt}
                className="oc-agent-thinking-elapsed"
              />
            </>
          ) : (
            <>
              <span className="oc-agent-thinking-label">Thinking</span>
              <span className="oc-agent-thinking-count">
                {formatCharCount(charCount)}
              </span>
            </>
          )}
        </button>
        {expanded && hasContent && (
          <div className="oc-agent-thinking-body">{message.text}</div>
        )}
      </div>
    );
  },
);

function formatCharCount(n: number): string {
  if (n < 1000) return `${n} chars`;
  return `${(n / 1000).toFixed(1)}k chars`;
}
