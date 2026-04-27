// ──────────────────────────────────────────────────────────
// TurnContainer — per-turn structural wrapper for the chat
// ──────────────────────────────────────────────────────────
//
// Phase 1 §2.5.1: every event between two consecutive user
// prompts forms a "turn." The renderer wraps each turn in a
// container so the active turn's user prompt can be sticky-
// positioned at the top of the scroll viewport for the entire
// duration of that turn — solving the user's "I can't scroll
// back to remember what I asked during a 30-min run" worry.
//
// Once the next turn starts (a new user prompt arrives), the
// previous turn's container is no longer active, sticky drops
// off, and the prompt scrolls naturally with the rest of the
// transcript.
//
// `groupMessagesIntoTurns` is the pure boundary-detection
// helper. A turn starts on every text message with role:"user".
// Everything else (assistant text, thinking, tool calls) is
// part of the most recent turn's `events`. Messages that arrive
// before any user prompt land in a "system turn" with
// `userPrompt: null` (rare; happens during agent warm-up).
//
// ──────────────────────────────────────────────────────────

import React, { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { AgentMessage, AgentTextMessage } from "./use-agent-session";
import { TurnRail } from "./turn-rail";

export interface Turn {
  /** The user prompt that started this turn. null only for the
   *  rare leading "system turn" — events arriving before the
   *  first user prompt (e.g. the agent's session-init system
   *  message). */
  userPrompt: AgentTextMessage | null;
  /** All non-user-prompt messages that belong to this turn,
   *  in their arrival order. Includes assistant text, thinking,
   *  tool calls, and any other AgentMessage variants. */
  events: AgentMessage[];
}

/** Stable id for a turn — the user-prompt id, or a synthetic one
 *  derived from the first event when there's no prompt. Used as
 *  the React key on the container. */
export function turnKey(turn: Turn): string {
  if (turn.userPrompt) return `turn-${turn.userPrompt.id}`;
  if (turn.events.length > 0) return `turn-evt-${turn.events[0].id}`;
  return "turn-empty";
}

export function groupMessagesIntoTurns(messages: AgentMessage[]): Turn[] {
  const turns: Turn[] = [];
  let current: Turn | null = null;
  for (const m of messages) {
    if (m.kind === "text" && m.role === "user") {
      if (current) turns.push(current);
      current = { userPrompt: m, events: [] };
    } else {
      if (!current) {
        // Leading event before any user prompt — rare
        current = { userPrompt: null, events: [] };
      }
      current.events.push(m);
    }
  }
  if (current) turns.push(current);
  return turns;
}

interface TurnContainerProps {
  turn: Turn;
  /** True when this is the most recent turn (and therefore the
   *  one whose user prompt sticky-pins to the viewport top).
   *  Only one turn is active at a time; older turns scroll
   *  naturally with the rest of the transcript. */
  isActive: boolean;
  children: React.ReactNode;
}

/**
 * Wraps a turn's children in a container that establishes the
 * positioning context for the sticky user-prompt header. The
 * actual sticky styling lives on the inner `<TurnPromptHeader>`
 * — the container itself just provides the layout boundary.
 *
 * Memoized so a streaming chunk to the active turn doesn't
 * re-render the inactive turns above it.
 */
export const TurnContainer = memo(function TurnContainer({
  turn,
  isActive,
  children,
}: TurnContainerProps) {
  const className = isActive
    ? "oc-agent-turn oc-agent-turn-active"
    : "oc-agent-turn";
  return (
    <div className={className}>
      <TurnRail events={turn.events} />
      {children}
    </div>
  );
});

/**
 * Sticky-positioned wrapper for the active turn's user prompt.
 * Renders a transparent shell that only pins the prompt visually
 * — the actual TextMessage rendering inside is unchanged. Pass
 * `sticky={false}` for finalized (non-active) turns to render
 * the prompt naturally inline.
 *
 * §2.5.1 — long prompts (>3 lines) collapse to a clamped preview
 * with a chevron toggle, so a multi-paragraph prompt doesn't eat
 * viewport while pinned. Short prompts (single line, ≤3 lines)
 * skip the chrome entirely — the chevron only appears when content
 * actually overflows the clamp.
 */
export const TurnPromptHeader = memo(function TurnPromptHeader({
  sticky,
  children,
}: {
  sticky: boolean;
  children: React.ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Reset expanded state when sticky transitions off (turn finalized)
  // so the next time this component sticks the prompt starts collapsed.
  useEffect(() => {
    if (!sticky) setExpanded(false);
  }, [sticky]);

  useLayoutEffect(() => {
    if (!sticky) return;
    const el = innerRef.current;
    if (!el) return;
    const measure = () => {
      // The clamp's max-height pins to ~3 line heights when not
      // .expanded; scrollHeight reports the unconstrained content
      // height. Difference > 1px = overflow worth a toggle for.
      const overflow = el.scrollHeight - el.clientHeight > 1;
      setOverflows(overflow);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sticky, children]);

  if (!sticky) return <>{children}</>;

  const cls = expanded
    ? "oc-agent-turn-prompt-sticky oc-agent-turn-prompt-expanded"
    : "oc-agent-turn-prompt-sticky";

  return (
    <div className={cls}>
      <div className="oc-agent-turn-prompt-clamp" ref={innerRef}>
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          className="oc-agent-turn-prompt-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse prompt" : "Show full prompt"}
        >
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          <span>{expanded ? "Less" : "More"}</span>
        </button>
      )}
    </div>
  );
});
