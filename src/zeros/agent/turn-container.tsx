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

import React, { memo } from "react";
import type { AgentMessage, AgentTextMessage } from "./use-agent-session";

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
  turn: _turn,
  isActive,
  children,
}: TurnContainerProps) {
  const className = isActive
    ? "oc-agent-turn oc-agent-turn-active"
    : "oc-agent-turn";
  return <div className={className}>{children}</div>;
});

/**
 * Sticky-positioned wrapper for the active turn's user prompt.
 * Renders a transparent shell that only pins the prompt visually
 * — the actual TextMessage rendering inside is unchanged. Pass
 * `sticky={false}` for finalized (non-active) turns to render
 * the prompt naturally inline.
 */
export const TurnPromptHeader = memo(function TurnPromptHeader({
  sticky,
  children,
}: {
  sticky: boolean;
  children: React.ReactNode;
}) {
  if (!sticky) return <>{children}</>;
  return <div className="oc-agent-turn-prompt-sticky">{children}</div>;
});
