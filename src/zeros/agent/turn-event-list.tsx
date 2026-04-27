// ──────────────────────────────────────────────────────────
// TurnEventList — collapse / window the events of a turn
// ──────────────────────────────────────────────────────────
//
// Stage 5.3. Wraps a turn's `events[]` and decides how to
// present them:
//
//   1. Active turn (still streaming): always expanded.
//      Long-turn windowing kicks in once events.length > K=20:
//      hide all but the last K, surface a "…N earlier ▾"
//      expander above the visible window.
//
//   2. Finalized turn (a later turn exists): default-collapsed
//      to a one-line TurnSummary. Click chevron → expand to
//      the full event stream (also windowed if long).
//
// Memoized so unrelated state changes don't re-render the
// inactive turns above the live one — same pattern as
// TurnContainer / MessageView.
// ──────────────────────────────────────────────────────────

import { memo, useState } from "react";

import { MessageView } from "./renderers";
import type { RendererContext } from "./renderers";
import { summarizeTurn, TurnSummary } from "./turn-summary";
import type { AgentMessage } from "./use-agent-session";

interface TurnEventListProps {
  events: AgentMessage[];
  /** True for the most recent (in-flight or recently-completed) turn.
   *  Active turns stay expanded; finalized turns default to the
   *  summary and only expand on demand. */
  isActive: boolean;
  ctx: RendererContext;
}

/** How many events render uncollapsed at the tail of a long turn.
 *  20 was chosen to match Cursor 3.0's accordion threshold and
 *  OpenCode's `maxRenderedItems`. Below this any windowing would
 *  feel noisy on normal conversations; above this, scroll lag and
 *  card-render cost dominate even on virtuoso. */
const VISIBLE_TAIL_K = 20;

export const TurnEventList = memo(function TurnEventList({
  events,
  isActive,
  ctx,
}: TurnEventListProps) {
  // Active turns stay open; finalized turns start closed.
  const [expanded, setExpanded] = useState(isActive);

  // The active flag flips off when a new user prompt arrives. When
  // that happens we want the just-finalized turn to auto-collapse —
  // but only if the user hadn't manually expanded it. We can't tell
  // those apart from `expanded` alone, so we stick to "expanded
  // follows isActive on transition" via a derived effect... actually
  // simpler: leave it sticky. Once the user opens it, it stays open
  // until they close it, regardless of active flips. Don't surprise
  // the user mid-read by collapsing what they were looking at.

  const stats = summarizeTurn(events);
  const showSummary = !isActive;
  const visibleEvents = expanded ? windowedTail(events, VISIBLE_TAIL_K) : null;
  const hiddenCount = visibleEvents
    ? events.length - visibleEvents.length
    : 0;

  return (
    <>
      {showSummary && (
        <TurnSummary
          stats={stats}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          eventCount={events.length}
        />
      )}
      {expanded && visibleEvents && (
        <>
          {hiddenCount > 0 && (
            <EarlierEventsBanner count={hiddenCount} />
          )}
          {visibleEvents.map((m) => (
            <MessageView key={m.id} message={m} ctx={ctx} />
          ))}
        </>
      )}
    </>
  );
});

/** Long-turn windowing — show only the last K events. Returns the
 *  full array when shorter than K. */
function windowedTail<T>(arr: T[], k: number): T[] {
  if (arr.length <= k) return arr;
  return arr.slice(arr.length - k);
}

const EarlierEventsBanner = memo(function EarlierEventsBanner({
  count,
}: {
  count: number;
}) {
  // For now this is a static "N earlier events hidden" banner. A
  // future polish (Stage 5 follow-up) gives it a click target that
  // expands the hidden range either fully or in larger steps.
  // Today it's purely informational so the user knows there's more
  // history above the visible window.
  return (
    <div className="oc-agent-earlier-banner">
      <span className="oc-agent-earlier-banner-rule" />
      <span className="oc-agent-earlier-banner-text">
        {count} earlier {count === 1 ? "event" : "events"} hidden
      </span>
      <span className="oc-agent-earlier-banner-rule" />
    </div>
  );
});
