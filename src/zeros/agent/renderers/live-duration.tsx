// ──────────────────────────────────────────────────────────
// LiveDuration + DurationChip — shared duration UI
// ──────────────────────────────────────────────────────────
//
// Stage 5.1 — every in-progress tool card needs a ticking
// elapsed counter so a long-running shell/read/fetch/etc.
// doesn't look frozen. Pre-Stage-5 only the ThinkingBlock
// had this; it was a private helper. Promoting to a shared
// module so all card kinds tick uniformly.
//
// Two exports:
//   - LiveDuration({ startedAt }) — re-renders once per
//     second; shows tabular-num formatted elapsed time.
//   - DurationChip({ status, startedAt, durationMs }) —
//     renders LiveDuration while in_progress, formatted
//     final duration once the card completes (only if
//     duration > 250ms — short ops don't warrant a chip).
//
// Both are styled by `.oc-agent-live-duration` for in-flight
// and `.oc-agent-final-duration` for completed.
// ──────────────────────────────────────────────────────────

import { memo, useEffect, useState } from "react";

interface LiveDurationProps {
  startedAt: number;
  className?: string;
}

export const LiveDuration = memo(function LiveDuration({
  startedAt,
  className,
}: LiveDurationProps) {
  // 1 Hz tick. Sub-second precision in the display would just thrash
  // React with no informational gain — what users want to know is
  // "is this still running" and "is it taking a long time", both
  // answered fine at 1s granularity.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  // tick is read only to satisfy the linter — the increment alone is
  // what schedules a re-render.
  void tick;
  const elapsedMs = Math.max(0, Date.now() - startedAt);
  // The shared `oc-agent-live-duration` class always applies (so a
  // single rule controls the live tint); the caller's class layers on
  // top for kind-specific spacing.
  const classes = ["oc-agent-live-duration", className].filter(Boolean).join(" ");
  return <span className={classes}>{formatElapsed(elapsedMs)}</span>;
});

interface DurationChipProps {
  status: "pending" | "in_progress" | "completed" | "failed";
  startedAt: number;
  durationMs: number;
  /** className applied in both states. Defaults to a sane shared one. */
  className?: string;
  /** Threshold below which a finished card hides its duration chip
   *  entirely. Tunes how chatty the card chrome is on fast ops. */
  hideBelowMs?: number;
}

export const DurationChip = memo(function DurationChip({
  status,
  startedAt,
  durationMs,
  className,
  hideBelowMs = 250,
}: DurationChipProps) {
  if (status === "in_progress" || status === "pending") {
    return (
      <LiveDuration startedAt={startedAt} className={className ?? "oc-agent-live-duration"} />
    );
  }
  if (durationMs <= hideBelowMs) return null;
  return (
    <span className={className ?? "oc-agent-final-duration"}>
      {formatElapsed(durationMs)}
    </span>
  );
});

/** Compact human-readable elapsed format: 4s · 12s · 1m 4s · 12m 30s · 1h 20m. */
export function formatElapsed(ms: number): string {
  if (ms < 1000) {
    // Sub-second only fires for the very first paint of a long op,
    // before the 1Hz tick has had a chance. Show "0s" rather than
    // jumping the chip width by a couple of pixels going from "0ms"
    // to "1s".
    return "0s";
  }
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}
