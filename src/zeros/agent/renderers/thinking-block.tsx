// ──────────────────────────────────────────────────────────
// ThinkingBlock — agent reasoning content
// ──────────────────────────────────────────────────────────
//
// Replaces the plain text-bubble rendering of role="thought"
// messages. Distinguishes reasoning from final output, gives
// the user a way to scan past it without reading.
//
// Behaviour:
//   - In-flight (last message + session streaming): single
//     line with shimmer + ticking duration `∴ Thinking · 12s`
//   - Otherwise: collapsed pill `[Thinking · 412 chars ▾]`,
//     click to expand into dim italic full text
//
// We don't currently have a clean signal for "thinking is
// done" beyond "another message arrived after it". Token
// counts aren't exposed on AgentTextMessage, so the pill
// quantifies length in characters as a proxy for depth.
// ──────────────────────────────────────────────────────────

import { memo, useEffect, useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";

import type { AgentTextMessage } from "../use-agent-session";
import type { Renderer } from "./types";

export const ThinkingBlock: Renderer<AgentTextMessage> = memo(
  function ThinkingBlock({ message, ctx }) {
    const isInFlight = ctx.isStreaming && ctx.lastMessageId === message.id;
    const [expanded, setExpanded] = useState(false);

    if (isInFlight) {
      return (
        <div className="oc-agent-thinking oc-agent-thinking-flight">
          <Brain className="oc-agent-thinking-icon w-3.5 h-3.5" />
          <span className="oc-agent-thinking-shimmer">Thinking</span>
          <LiveDuration startedAt={message.createdAt} />
        </div>
      );
    }

    const charCount = message.text.length;
    return (
      <div className="oc-agent-thinking">
        <button
          type="button"
          className="oc-agent-thinking-head"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="oc-agent-thinking-chev w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="oc-agent-thinking-chev w-3.5 h-3.5" />
          )}
          <Brain className="oc-agent-thinking-icon w-3.5 h-3.5" />
          <span className="oc-agent-thinking-label">Thinking</span>
          <span className="oc-agent-thinking-count">
            {formatCharCount(charCount)}
          </span>
        </button>
        {expanded && (
          <div className="oc-agent-thinking-body">{message.text}</div>
        )}
      </div>
    );
  },
);

function LiveDuration({ startedAt }: { startedAt: number }) {
  // Tick once per second. Keeps the "in-flight" affordance honest
  // without flooding React with sub-second updates.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  // `tick` is unused beyond triggering re-render; reading it once
  // satisfies React's exhaustive-deps style without leaving an unused
  // variable warning at the linter's mercy.
  void tick;
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return <span className="oc-agent-thinking-elapsed">· {elapsed}s</span>;
}

function formatCharCount(n: number): string {
  if (n < 1000) return `${n} chars`;
  return `${(n / 1000).toFixed(1)}k chars`;
}
