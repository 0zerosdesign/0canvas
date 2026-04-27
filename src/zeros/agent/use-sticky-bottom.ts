// ──────────────────────────────────────────────────────────
// useStickyBottom — chat-style auto-scroll with unstick
// ──────────────────────────────────────────────────────────
//
// Replaces the Phase 0 "scrollTop = scrollHeight on every
// change" reflex with the well-behaved-chat pattern shipped
// by Cursor 3.0, OpenCode (ScrollBoxRenderable), and most
// modern chat UIs.
//
// Behavior:
//   - When the user is within `threshold` (default 32px) of
//     the bottom, new content auto-scrolls them to the new
//     bottom. Feels like the chat is following along.
//   - The moment they scroll up past that threshold, auto-
//     scroll disengages. They can read freely while content
//     keeps streaming below.
//   - When they scroll back to within threshold, it re-
//     engages. Returning to bottom always means "follow."
//
// The "is the user at bottom" decision is captured BEFORE
// React commits the next render — via useLayoutEffect plus
// a ref updated on every scroll event. Without this we'd
// have a race: new content lands, `scrollHeight` grows,
// distance-from-bottom suddenly exceeds threshold, and the
// hook would conclude "user is not at bottom" even though
// they hadn't moved. Capturing in a ref before the render
// (i.e. the scroll listener writes to the ref synchronously
// on the user's actual scroll, never on content growth)
// fixes this cleanly.
//
// Returns:
//   isAtBottom — for UI (jump-to-latest pill visibility)
//   jumpToBottom(smooth?) — for buttons + keybinds
// ──────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface StickyBottomState {
  /** True when the scroll position is within `threshold` of the
   *  bottom. Drives the visibility of the "Jump to latest" pill. */
  isAtBottom: boolean;
  /** Programmatic scroll-to-bottom. Used by the jump pill,
   *  Cmd+End keybind, and any "fresh chat opened" auto-snap. */
  jumpToBottom: (smooth?: boolean) => void;
}

export interface StickyBottomOptions {
  /** Distance-from-bottom in px below which we consider the user
   *  "at bottom" and auto-scroll on new content. 32px matches
   *  OpenCode's `ScrollBoxRenderable` default. Smaller values
   *  feel pickier; larger values catch more partial-scroll cases. */
  threshold?: number;
}

/**
 * Hook the scroll container element directly and pass an array
 * of dependencies that mark "new content arrived" (typically
 * `[messages, status, pendingPermission]`). The effect runs on
 * each dep change and snaps to bottom only when the user was
 * at-or-near the bottom before the change.
 *
 * Pass the element via state-tracked callback ref (not RefObject)
 * so the hook re-runs once the element mounts. RefObjects don't
 * trigger re-renders when `.current` changes, which would leave
 * the hook permanently stuck on `null`.
 */
export function useStickyBottom(
  scrollEl: HTMLElement | null,
  contentDeps: unknown[],
  options: StickyBottomOptions = {},
): StickyBottomState {
  const threshold = options.threshold ?? 32;
  const [isAtBottom, setIsAtBottom] = useState(true);
  /** Mirror of isAtBottom kept in a ref so the layout-effect can
   *  read the user's pre-render intent without triggering an extra
   *  re-render of the hook's consumer. */
  const stickRef = useRef(true);

  // Track scroll position on the user's actual scroll movement.
  useEffect(() => {
    if (!scrollEl) return;
    const onScroll = () => {
      const distance = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
      const atBottom = distance <= threshold;
      stickRef.current = atBottom;
      // Avoid setState if value unchanged — the hook's consumer
      // re-renders on this value, so spamming it on every wheel
      // tick during a freely-scrolling read is wasteful.
      setIsAtBottom((prev) => (prev === atBottom ? prev : atBottom));
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    // Run once so the initial state matches actual scroll position
    // (e.g. after a chat-switch hydrates messages and we land at
    // the bottom — without this the ref stays true regardless).
    onScroll();
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [scrollEl, threshold]);

  // Snap to bottom on content change, but only when the user was
  // already there before the change. useLayoutEffect runs after
  // DOM mutation but before paint, so the user never sees the
  // intermediate "stuck above the new bottom" frame.
  //
  // First run is skipped — initial scroll position is the consumer's
  // responsibility (snap-to-bottom on chat-open OR restore from
  // per-chat scroll memory). Without this guard, mounting on a chat
  // with saved-scroll above bottom would cause a one-frame flash:
  // hook snaps to bottom → consumer's restore effect then jumps to
  // saved. Let the consumer own the initial position; the hook only
  // handles ongoing content-arrival.
  const firstContentRunRef = useRef(true);
  useLayoutEffect(() => {
    if (firstContentRunRef.current) {
      firstContentRunRef.current = false;
      return;
    }
    if (!stickRef.current) return;
    if (!scrollEl) return;
    scrollEl.scrollTop = scrollEl.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, contentDeps);

  const jumpToBottom = useCallback(
    (smooth = true) => {
      if (!scrollEl) return;
      scrollEl.scrollTo({
        top: scrollEl.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
      // Force-stick after a programmatic jump — the user explicitly
      // asked to follow, even if they were unstuck before.
      stickRef.current = true;
      setIsAtBottom(true);
    },
    [scrollEl],
  );

  return { isAtBottom, jumpToBottom };
}

/**
 * Walk-by-text-message keybind helper (Stage 2.5). Returns the next
 * scroll target for `Cmd+Up` / `Cmd+Down` navigation that skips
 * over tool-call and thinking blocks — only user messages and the
 * agent's final-text bubbles count as "messages" worth jumping to.
 *
 * Usage:
 *   const target = nextTextMessageTarget(scrollEl, { direction: "up" });
 *   if (target !== null) scrollEl.scrollTo({ top: target, behavior: "smooth" });
 */
export function nextTextMessageTarget(
  scrollEl: HTMLElement,
  opts: { direction: "up" | "down"; selector?: string },
): number | null {
  // §2.5.7 — walk only user prompts and final agent text. Thinking
  // and tool blocks are deliberately skipped so a 30-min run with
  // 200 cards is one keystroke per actual back-and-forth, not 200.
  // The class is `oc-agent-msg-agent` after the assistant→agent
  // rename; the older `-msg-assistant` selector silently matched
  // nothing since that class was never emitted, which made the
  // keybind feel like it only navigated user prompts.
  const selector =
    opts.selector ?? ".oc-agent-msg-user, .oc-agent-msg-agent";
  const elements = Array.from(scrollEl.querySelectorAll<HTMLElement>(selector));
  if (elements.length === 0) return null;

  const containerRect = scrollEl.getBoundingClientRect();
  const offsetTops = elements.map(
    (el) => el.getBoundingClientRect().top - containerRect.top + scrollEl.scrollTop,
  );

  const currentTop = scrollEl.scrollTop;

  if (opts.direction === "up") {
    // Largest offsetTop strictly less than currentTop minus a small
    // fudge so "jumping to the message you're already at the top of"
    // moves you to the previous one. 8px ≈ chrome padding.
    const candidates = offsetTops.filter((t) => t < currentTop - 8);
    if (candidates.length === 0) return 0; // already at top — go to start
    return Math.max(...candidates);
  }

  // direction === "down"
  const candidates = offsetTops.filter((t) => t > currentTop + 8);
  if (candidates.length === 0) {
    // No more messages below — return the absolute bottom so callers
    // can `scrollTo({ top: bottom })` and engage the sticky-bottom path.
    return scrollEl.scrollHeight;
  }
  return Math.min(...candidates);
}
