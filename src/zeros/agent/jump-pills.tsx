// ──────────────────────────────────────────────────────────
// JumpPills — floating "jump to ..." affordances
// ──────────────────────────────────────────────────────────
//
// Phase 1 §2.5.2: when the user has scrolled away from the
// bottom (auto-scroll disengaged via the sticky-bottom hook),
// they need explicit affordances to come back. Two pills:
//
//   "Jump to my prompt" — top-right, shown when the active
//     turn's user prompt is above the viewport. The fast path
//     for the user's "where did I ask?" worry on long runs.
//
//   "Jump to latest" — bottom-right, shown when not-at-bottom.
//     Single-click re-engages auto-follow.
//
// Both fade in/out smoothly. Show-conditions are observed in
// real time via scroll + ResizeObserver — no polling, no
// per-frame work when the user is at rest.
//
// ──────────────────────────────────────────────────────────

import React, { memo, useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

interface JumpPillsProps {
  scrollEl: HTMLElement | null;
  /** Element to jump to for "Jump to my prompt." Typically the
   *  active turn's user-prompt DOM node. null when there is no
   *  active prompt (initial empty state, no turn started). */
  promptEl: HTMLElement | null;
  /** From useStickyBottom — drives "Jump to latest" visibility. */
  isAtBottom: boolean;
  /** Programmatic scroll to bottom. Re-engages sticky-follow. */
  jumpToBottom: (smooth?: boolean) => void;
}

/**
 * Drives the two jump pills. The "Jump to my prompt" pill needs
 * its own visibility logic separate from `isAtBottom` — the
 * prompt could be either above OR below the viewport depending
 * on what the user is looking at, so we observe the prompt's
 * top vs the scroll container's viewport on each scroll event.
 */
export const JumpPills = memo(function JumpPills({
  scrollEl,
  promptEl,
  isAtBottom,
  jumpToBottom,
}: JumpPillsProps) {
  const [promptAbove, setPromptAbove] = useState(false);

  useEffect(() => {
    if (!scrollEl || !promptEl) {
      setPromptAbove(false);
      return;
    }
    const update = () => {
      const containerTop = scrollEl.getBoundingClientRect().top;
      const promptBottom = promptEl.getBoundingClientRect().bottom;
      // Show the "jump to prompt" pill when the prompt has scrolled
      // entirely above the viewport. While any part of it is still
      // visible (or the sticky version is pinned at top), we keep
      // the pill hidden — the user can already see what they asked.
      setPromptAbove(promptBottom < containerTop);
    };
    update();
    scrollEl.addEventListener("scroll", update, { passive: true });
    // The prompt's geometry can change without a scroll: textarea
    // resize, message edits, etc. Observe both sides.
    const ro = new ResizeObserver(update);
    ro.observe(scrollEl);
    ro.observe(promptEl);
    return () => {
      scrollEl.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [scrollEl, promptEl]);

  const jumpToPrompt = () => {
    if (!scrollEl || !promptEl) return;
    const containerTop = scrollEl.getBoundingClientRect().top;
    const promptTop = promptEl.getBoundingClientRect().top;
    // The active prompt may be sticky-positioned at top:0 already.
    // Skipping the jump in that case avoids a no-op smooth-scroll
    // animation.
    const target = scrollEl.scrollTop + (promptTop - containerTop);
    if (Math.abs(target - scrollEl.scrollTop) < 4) return;
    scrollEl.scrollTo({ top: target, behavior: "smooth" });
  };

  return (
    <>
      {promptAbove && (
        <button
          type="button"
          className="oc-agent-jump-pill oc-agent-jump-pill-top"
          onClick={jumpToPrompt}
          title="Jump to your prompt"
          aria-label="Jump to your prompt"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>Jump to your prompt</span>
        </button>
      )}
      {!isAtBottom && (
        <button
          type="button"
          className="oc-agent-jump-pill oc-agent-jump-pill-bottom"
          onClick={() => jumpToBottom(true)}
          title="Jump to latest"
          aria-label="Jump to latest"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Jump to latest</span>
        </button>
      )}
    </>
  );
});
