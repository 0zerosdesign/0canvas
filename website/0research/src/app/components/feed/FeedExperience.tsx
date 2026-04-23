// ============================================
// COMPONENT: FeedExperience
// PURPOSE: Main container that orchestrates the 3-column feed layout
//          Left sidebar (15%) | Main feed (centered) | Right sidebar (20%)
// SCROLL: CSS scroll-snap-stop: always — browser-native TikTok/Reels snap
// USED IN: HomePage
// ============================================
//
// HOW THE SNAP WORKS (and why previous JS approaches failed):
//
//   Problem: macOS trackpad generates momentum wheel events at the OS level
//   for 1-2 seconds after finger-lift. These are synthetic events that fire
//   REGARDLESS of overflow:hidden or preventDefault(). No JS timer (fixed,
//   settle, scrollend-based, or transform-based) can reliably distinguish
//   "momentum tail" from "new intentional scroll" across all devices.
//
//   Solution: CSS `scroll-snap-stop: always` (on each feed item)
//   This is a native CSS property that tells the browser:
//   "You MUST stop at EVERY snap point, even during momentum/fling scrolling."
//   Combined with `scroll-snap-type: y mandatory` (on the container), the
//   browser guarantees exactly one item per scroll gesture — natively,
//   hardware-accelerated, and identical to TikTok/Reels behavior.
//
//   The JS layer now only handles:
//   - Keyboard navigation (ArrowUp/Down)
//   - Sidebar click → animated scroll to target item (no media glimpses)
//   - IntersectionObserver → track which item is visible → update activeItemId
//   - Sidebar active-item visibility tracking
//
// HOW SIDEBAR-CLICK ANIMATED SCROLL WORKS:
//
//   Problem: scroll-snap-stop: always forces the browser to stop at EVERY
//   snap point during smooth scrolling. So `scrollTo({ behavior: 'smooth' })`
//   would pause at every single intermediate item.
//
//   Solution: Temporarily disable scroll-snap on the container during the
//   animated scroll, run a fast custom requestAnimationFrame animation with
//   cubic ease-in-out easing, then re-enable scroll-snap after landing.
//   Intermediate items have their media hidden (via .zeros-media-transit)
//   so only the --surface-0 background shows — no content glimpses.
//
//   Timeline:
//   1. Sidebar click → determine distance (item count between current & target)
//   2. Hide intermediate items' media (add .zeros-media-transit class)
//   3. Disable scroll-snap: container.style.scrollSnapType = 'none'
//   4. Run rAF loop: cubic ease-in-out, duration scales with √distance
//   5. On complete: restore intermediate media, re-enable scroll-snap,
//      play anticipation, release observer lock
//
// ============================================

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { ChevronDown, LocateFixed } from "lucide-react";
import { ListFeedItem } from "./ListFeedItem";
import { ListFeedHeader } from "./ListFeedHeader";
import { FilterPanel } from "./FilterPanel";
import { MainFeedItem } from "./MainFeedItem";
import { SideFeedItem } from "./SideFeedItem";
import { MobileTopBar } from "./MobileTopBar";
import { MobileBottomSheet } from "./MobileBottomSheet";
import type {
  FeedExperienceProps,
  MetadataItem,
  MediaItem,
} from "../../types";
import "./feed.css";
import "./feed-detail.css";

// --- CONSTANTS (module-level, outside component) ---

// How long (ms) sidebar clicks are locked after a click.
// Prevents rapid-fire sidebar clicks while the jump settles.
const SIDEBAR_CLICK_COOLDOWN_MS = 800;

// How long (ms) to suppress IntersectionObserver after a sidebar click / keyboard nav.
// Prevents intermediate items from briefly becoming "active" during programmatic scroll.
const PROGRAMMATIC_SCROLL_DURATION_MS = 800;

// --- ANIMATED SCROLL CONSTANTS ---
// Duration bounds for the sidebar-click scroll animation.
// Actual duration = clamp(BASE + √(itemCount) × SCALE, BASE, MAX)
// This means:  1 item → 400ms,  5 items → 534ms,  10 items → 590ms,  20+ items → 650ms
const SCROLL_ANIM_BASE_MS = 400;       // Minimum duration (for 1-item jumps)
const SCROLL_ANIM_SCALE_MS = 60;       // ms per √item — controls how duration grows
const SCROLL_ANIM_MAX_MS = 300;        // Maximum duration (for 20+ item jumps)

// --- ANTICIPATION SCROLL-STOP DELAY ---
// How long (ms) after the last scroll event before we consider the snap "settled"
// and play the anticipation bounce. Lower = snappier feel, higher = safer on slow devices.
// 50–80ms is tight but reliable for modern browsers; increase if you see false triggers.
const SCROLL_STOP_DELAY_MS = 0;

export function FeedExperience({
  mediaItems,
  activeItemId,
  metadataItems,
  hasMoreMetadata,
  loadingMoreMetadata,
  onItemClick,
  onItemActive,
  onLoadMoreMetadata,
}: FeedExperienceProps) {
  // --- VARIABLES ---

  // Tracks the pagination offset for metadata loading
  const [metadataOffset, setMetadataOffset] = useState<number>(20);

  // Tracks whether the active item is visible in the left sidebar viewport
  const [isActiveItemVisible, setIsActiveItemVisible] = useState<boolean>(true);

  // --- FILTER STATE ---
  // Controls the filter panel open/closed state and the selected filter.
  // When filter is open: sidebar shows header + filter panel + active item only.
  // When filter is closed: sidebar shows normal scrollable list of all items.
  // selectedFilter persists across open/close — the chip stays below the header.
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  // HANDLER: toggleFilterPanel — opens/closes the filter dropdown.
  // When OPENING: captures the active item's bounding rect before React re-renders.
  // This is the "First" step of the FLIP animation — the active item's current
  // position in the scrollable list is saved so the FLIP effect can animate it
  // from that position to its new position below the filter panel.
  // When CLOSING: captures the filter-active-item's bounding rect before React
  // unmounts it, so the FLIP effect can animate the list item from that position
  // back to its scroll position in the normal list.
  const handleFilterToggle = useCallback(() => {
    setIsFilterOpen((prev) => {
      if (!prev && activeItemId) {
        // About to OPEN — save sidebar scroll position + capture active item rect (FLIP: First)
        savedSidebarScrollRef.current = sidebarRef.current?.scrollTop ?? 0;
        const el = document.getElementById(`sidebar-${activeItemId}`);
        if (el) {
          savedActiveRectRef.current = el.getBoundingClientRect();
          flipDirectionRef.current = 'open';
        }
      } else if (prev && filterActiveItemRef.current) {
        // About to CLOSE — capture filter-active-item's current position (FLIP: First)
        savedActiveRectRef.current = filterActiveItemRef.current.getBoundingClientRect();
        flipDirectionRef.current = 'close';
      }
      return !prev;
    });
  }, [activeItemId]);

  // HANDLER: selectFilter — picks a filter (single-select, replaces previous)
  // Selecting a filter also closes the panel so the user sees the result.
  // Captures the filter-active-item rect before closing for FLIP close animation.
  const handleSelectFilter = useCallback((filter: string | null) => {
    // Capture rect before closing (FLIP: First for close)
    if (filterActiveItemRef.current) {
      savedActiveRectRef.current = filterActiveItemRef.current.getBoundingClientRect();
      flipDirectionRef.current = 'close';
    }
    setSelectedFilter(filter);
    // Close the panel after selection so the filtered view is immediately visible
    setIsFilterOpen(false);
  }, []);

  // HANDLER: clearFilter — removes the active filter (from chip × button)
  const handleClearFilter = useCallback(() => {
    setSelectedFilter(null);
  }, []);

  // --- PAGE-LOAD ENTRANCE ANIMATION ---
  // Becomes true on the first render where metadataItems has content.
  // Used to apply one-time CSS entrance animations to all three columns.
  // Once true, never reverts — animations play once and done.
  // entranceCountRef tracks how many items were present at entrance time —
  // only those items get the staggered animation. Items loaded later (via "More"
  // button) render normally without entrance animation.
  //
  // entranceDone prevents the entrance animation from replaying when list items
  // are unmounted/remounted (e.g., filter open → close). Without this guard,
  // remounted items would get the zeros-entrance-item class again and replay
  // the rise-from-30vh animation — very jarring. entranceDone becomes true
  // after the longest possible entrance animation completes (~2500ms), and
  // once true, the class is never applied again.
  //
  // FLASH PREVENTION (belt-and-suspenders):
  // Two layers ensure items are NEVER visible at their natural positions
  // before the entrance animation starts:
  //
  //   Layer 1 — useLayoutEffect: fires synchronously after DOM commit,
  //   before paint. Sets hasEntered=true which applies the entrance CSS class
  //   (zeros-entrance-item) in a synchronous re-render. In theory, the browser
  //   never paints the classless state.
  //
  //   Layer 2 — inline opacity:0: item wrappers get style={{ opacity: 0 }}
  //   when !entranceDone && the entrance class hasn't been applied yet (i.e.,
  //   !hasEntered). This catches any edge case where React 18's scheduler
  //   allows a paint between the first DOM commit (items without entrance class)
  //   and the useLayoutEffect-triggered re-render. The active item's border and
  //   box-shadow make even a single-frame flash noticeable — it appears briefly
  //   at the top, disappears, then rises from below ("top-to-bottom" artifact).
  //   The inline opacity:0 prevents this unconditionally.
  const hasEnteredRef = useRef<boolean>(false);
  const [hasEntered, setHasEntered] = useState<boolean>(false);
  const [entranceDone, setEntranceDone] = useState<boolean>(false);
  const entranceCountRef = useRef<number>(0);

  useLayoutEffect(() => {
    if (!hasEnteredRef.current && metadataItems.length > 0) {
      hasEnteredRef.current = true;
      entranceCountRef.current = metadataItems.length;
      setHasEntered(true);
    }
  }, [metadataItems.length]);

  // Mark entrance animations as complete after all staggered animations finish.
  // This prevents replay when list items are unmounted/remounted (filter toggle).
  // 2500ms = generous buffer covering the longest possible stagger delay + duration.
  useEffect(() => {
    if (hasEntered && !entranceDone) {
      const timer = setTimeout(() => setEntranceDone(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [hasEntered, entranceDone]);

  // No carousel sync needed — single media per feed item

  // Reference to the main feed scroll container (CSS scroll-snap container)
  const mainFeedRef = useRef<HTMLDivElement>(null);

  // Reference to the left sidebar scroll container
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Reference to the sticky sidebar header — used by ResizeObserver to dynamically
  // update scroll-padding-top when the header height changes (e.g., filter chips added/removed).
  const sidebarHeaderRef = useRef<HTMLDivElement>(null);

  // Flag to suppress IntersectionObserver updates during programmatic scrolls
  // (sidebar clicks, keyboard navigation)
  const isProgrammaticScrollRef = useRef<boolean>(false);

  // Sidebar click lock — prevents rapid-fire sidebar clicks
  const isSidebarLockedRef = useRef<boolean>(false);
  const sidebarLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Timer for releasing the programmatic scroll lock
  const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // --- ANIMATED SCROLL ---
  // rAF handle for the sidebar-click scroll animation (cancel on unmount or re-click)
  const animationFrameRef = useRef<number | null>(null);

  // --- TRANSIT STATE (intermediate items hidden during animated scroll) ---
  // Stores DOM references to .zeros-media-container elements that currently have
  // .zeros-media-transit applied (hides their children so only bg2 background shows).
  // Needed so we can clean them up on:
  //   - animation complete (normal path)
  //   - animation cancel (new sidebar click mid-flight)
  //   - component unmount
  const transitItemsRef = useRef<HTMLElement[]>([]);

  // --- ANTICIPATION ANIMATION ---
  // Tracks the index of the last active item so we can detect scroll direction
  // for IntersectionObserver-triggered changes (wheel/touch scroll).
  // Initialized to -1; first scroll won't play anticipation (no previous reference).
  const lastActiveIndexRef = useRef<number>(-1);

  // --- ANTICIPATION: SCROLL-STOP DETECTION ---
  // We can't apply anticipation inside IntersectionObserver because it fires
  // at 60% visibility — WHILE the scroll-snap animation is still in progress.
  // The 5px translateY is invisible because the entire card is still moving.
  //
  // Instead, we detect when scrolling has STOPPED (snap has settled) using a
  // debounced scroll listener (SCROLL_STOP_DELAY_MS idle = stopped). Then we
  // apply anticipation to the now-stationary active item. This gives a clean
  // "landing bounce."
  //
  // For programmatic scrolls (sidebar click, keyboard), anticipation is handled
  // inside animateScrollToItem's completion callback — NOT here.

  // Ref that always mirrors the latest activeItemId without triggering re-renders.
  // Used by the scroll-stop handler to read current active item without stale closures.
  const activeItemIdRef = useRef<string>(activeItemId);
  activeItemIdRef.current = activeItemId;

  // Tracks the scroll position before each scroll gesture.
  // Compared with position at scroll-stop to determine direction (up vs down).
  const prevScrollTopRef = useRef<number>(0);

  // Timer handle for scroll-stop debounce (cleared on each scroll event)
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- FILTER OPEN/CLOSE FLIP ANIMATION ---
  // Stores the bounding rect of the active item BEFORE the filter opens OR closes.
  // Used by the FLIP effect (useLayoutEffect) to animate the active item
  // from its old position to its new position smoothly.
  // Cleared after the animation starts.
  const savedActiveRectRef = useRef<DOMRect | null>(null);

  // Ref to the filter-open active item wrapper div.
  // The FLIP effect reads this element's new position after React re-renders.
  const filterActiveItemRef = useRef<HTMLDivElement>(null);

  // Tracks the direction of the current FLIP transition.
  // 'open'  = list → filter mode (active item moves to bottom below filter panel)
  // 'close' = filter mode → list (active item returns to its scroll position)
  // null    = no FLIP in progress
  const flipDirectionRef = useRef<'open' | 'close' | null>(null);

  // Saves the sidebar's scrollTop BEFORE the filter opens, so the FLIP close
  // can restore it BEFORE measuring the active item's new position. Without this,
  // the sidebar scrollTop resets to 0 when list items remount (conditional render
  // unmounts/remounts all items), and the active item would animate to the wrong
  // position — appearing at whatever scrollIntoView decides instead of where it
  // was before the filter opened.
  const savedSidebarScrollRef = useRef<number>(0);

  // --- FORMULAS (Computed Values) ---

  // FORMULA: activeItem
  const activeItem: MetadataItem | undefined = useMemo(() => {
    return metadataItems.find((item) => item.id === activeItemId);
  }, [metadataItems, activeItemId]);

  // FORMULA: getMediaForItem
  const getMediaForItem = useCallback(
    (itemId: string): MediaItem | undefined => {
      return mediaItems.find((media) => media.id === itemId);
    },
    [mediaItems]
  );

  // --- CAROUSEL → SIDE FEED SYNC (one-way) ---
  //
  // MAPPING: carousel slide index → section index
  //   - Sections with carousel_media_url become carousel slides
  //   - Slide 0 = first section with media, slide 1 = second, etc.
  //   - carouselSlideToSectionIndex[slideIndex] → index in sections array
  //
  // ONE-WAY SYNC:
  //   User swipes carousel to slide N → derive section index → scroll side feed
  //   Side feed scrolling does NOT affect the carousel.

  // FORMULA: activeMediaData — sections for the currently active feed item
  const activeMediaData: MediaItem | undefined = useMemo(() => {
    return mediaItems.find((media) => media.id === activeItemId);
  }, [mediaItems, activeItemId]);

  // FORMULA: activeSections — sections for the side feed
  const activeSections = useMemo(() => {
    if (!activeMediaData?.sections) return [];
    return [...activeMediaData.sections].sort((a, b) => a.sort - b.sort);
  }, [activeMediaData]);

  // --- WORKFLOWS ---

  // WORKFLOW: clearTransitItems
  // PURPOSE: Removes .zeros-media-transit from all currently-hidden intermediate items.
  //          Called on animation complete, animation cancel, and component unmount.
  const clearTransitItems = useCallback(() => {
    transitItemsRef.current.forEach((el) => {
      el.classList.remove("zeros-media-transit");
    });
    transitItemsRef.current = [];
  }, []);

  // WORKFLOW: applyTransitItems
  // PURPOSE: Hides media content on intermediate items during sidebar-click animated scroll.
  //          Adds .zeros-media-transit to each intermediate item's .zeros-media-container,
  //          which sets `visibility: hidden` on all children — revealing the bg2 background.
  //          The start and target items are NOT affected — only items strictly between them.
  // CALLED BY: animateScrollToItem (after clearing old transit, before starting rAF)
  const applyTransitItems = useCallback(
    (intermediateIds: string[]) => {
      const elements: HTMLElement[] = [];
      for (const id of intermediateIds) {
        const feedCard = document.getElementById(`feed-${id}`);
        if (!feedCard) continue;
        const mediaContainer = feedCard.querySelector(
          ".zeros-media-container"
        ) as HTMLElement;
        if (!mediaContainer) continue;
        mediaContainer.classList.add("zeros-media-transit");
        elements.push(mediaContainer);
      }
      transitItemsRef.current = elements;
    },
    []
  );

  // WORKFLOW: scrollToActiveSidebarItem
  // TRIGGERED BY: When activeItemId changes (via useEffect below)
  const scrollToActiveSidebarItem = useCallback(() => {
    if (!activeItemId || !sidebarRef.current) return;

    const sidebarItem = document.getElementById(`sidebar-${activeItemId}`);
    if (sidebarItem) {
      sidebarItem.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }, [activeItemId]);

  // WORKFLOW: applyAnticipation
  // PURPOSE: Plays the elastic "landing" animation on a feed item's media container.
  //          The media overshoots ~5px in the scroll direction then springs back to center.
  //          Applied via CSS class (zeros-anticipate-down / zeros-anticipate-up).
  //          Works purely via DOM manipulation — no React re-renders.
  // USED BY: scroll-stop listener (wheel/touch), animateScrollToItem (sidebar + keyboard)
  const applyAnticipation = useCallback(
    (itemId: string, direction: "up" | "down") => {
      const feedCard = document.getElementById(`feed-${itemId}`);
      if (!feedCard) return;

      const mediaContainer = feedCard.querySelector(
        ".zeros-media-container"
      ) as HTMLElement;
      if (!mediaContainer) return;

      // Remove any in-progress anticipation animation
      mediaContainer.classList.remove(
        "zeros-anticipate-down",
        "zeros-anticipate-up"
      );

      // Force reflow so re-adding the same class restarts the animation
      void mediaContainer.offsetHeight;

      // Apply direction-specific animation class
      const className =
        direction === "down"
          ? "zeros-anticipate-down"
          : "zeros-anticipate-up";
      mediaContainer.classList.add(className);

      // Clean up class after animation completes (per CSS duration)
      const handleEnd = () => {
        mediaContainer.classList.remove(className);
        mediaContainer.removeEventListener("animationend", handleEnd);
      };
      mediaContainer.addEventListener("animationend", handleEnd);
    },
    []
  );

  // WORKFLOW: scrollMainFeedToItem
  // PURPOSE: Programmatically scroll the main feed to a specific item (INSTANT).
  //          Uses `behavior: 'auto'` (instant jump) so scroll-snap-stop: always
  //          doesn't cause the browser to stop at every intermediate item.
  // USED BY: keyboard navigation, fallback for same-item sidebar click
  const scrollMainFeedToItem = useCallback(
    (itemId: string) => {
      if (!mainFeedRef.current) return;

      const targetElement = document.getElementById(`feed-${itemId}`);
      if (!targetElement) return;

      // Lock the IntersectionObserver during the jump
      isProgrammaticScrollRef.current = true;
      if (programmaticTimerRef.current) {
        clearTimeout(programmaticTimerRef.current);
      }
      programmaticTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        programmaticTimerRef.current = null;
      }, PROGRAMMATIC_SCROLL_DURATION_MS);

      // Instant jump — `behavior: 'auto'` skips all intermediate snap points
      mainFeedRef.current.scrollTo({
        top: targetElement.offsetTop,
        behavior: "auto",
      });

      // Update active item
      onItemActive(itemId);
    },
    [onItemActive]
  );

  // WORKFLOW: animateScrollToItem
  // PURPOSE: Fast animated scroll to a target item on sidebar click.
  //          Temporarily disables scroll-snap so the rAF animation can scroll
  //          freely past intermediate items. Hides intermediate items' media via
  //          .zeros-media-transit so only bg2 background shows during the scroll.
  //
  //   How it works:
  //   1. Cancel any in-progress animation
  //   2. Apply .zeros-media-transit to NEW intermediate items (hide their media)
  //   3. Lock IntersectionObserver + update active item immediately
  //   4. Disable scroll-snap: container.style.scrollSnapType = 'none'
  //   5. Run requestAnimationFrame loop with cubic ease-in-out:
  //      - Start: smooth departure from current item
  //      - Middle: fast transit through bg2 backgrounds
  //      - End: gentle deceleration landing on target
  //   6. On complete: restore intermediate media (clearTransitItems),
  //      re-enable scroll-snap, play anticipation, release observer lock
  //
  // USED BY: handleSidebarClick (multi-item jumps) and keyboard nav (single-item)
  const animateScrollToItem = useCallback(
    (targetItemId: string, itemDistance: number, scrollDirection: "up" | "down", intermediateIds: string[]) => {
      const container = mainFeedRef.current;
      if (!container) return;

      const targetElement = document.getElementById(`feed-${targetItemId}`);
      if (!targetElement) return;

      const targetTop = targetElement.offsetTop;
      const startTop = container.scrollTop;
      const scrollDistance = targetTop - startTop;

      // No distance to scroll — just update state
      if (scrollDistance === 0) {
        onItemActive(targetItemId);
        return;
      }

      // Cancel any in-progress animation
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Clean up any leftover transit from a previous (cancelled) animation,
      // THEN apply transit to the new intermediate items.
      // Order matters: clear old → apply new → start rAF.
      clearTransitItems();
      if (intermediateIds.length > 0) {
        applyTransitItems(intermediateIds);
      }

      // Lock IntersectionObserver during the entire animation
      isProgrammaticScrollRef.current = true;
      if (programmaticTimerRef.current) {
        clearTimeout(programmaticTimerRef.current);
      }

      // Update active item immediately — sidebar + right panel respond instantly
      onItemActive(targetItemId);

      // Calculate duration: scales with √(item count), capped for consistency
      // 1 item → 460ms, 5 items → 534ms, 10 items → 590ms, 20 items → 650ms
      const duration = Math.min(
        SCROLL_ANIM_BASE_MS + Math.sqrt(itemDistance) * SCROLL_ANIM_SCALE_MS,
        SCROLL_ANIM_MAX_MS
      );

      // TEMPORARILY DISABLE scroll-snap so the rAF animation can scroll
      // freely without stopping at every snap point
      container.style.scrollSnapType = "none";

      const startTime = performance.now();

      // --- rAF animation loop ---
      const step = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Cubic ease-in-out — smooth start, fast middle (items whip by), gentle landing
        // t < 0.5: 4t³ (ease in)
        // t >= 0.5: 1 - (-2t+2)³/2 (ease out)
        const eased =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        container.scrollTop = startTop + scrollDistance * eased;

        if (progress < 1) {
          // Continue animation
          animationFrameRef.current = requestAnimationFrame(step);
        } else {
          // --- ANIMATION COMPLETE ---

          // Ensure exact final position (no sub-pixel drift)
          container.scrollTop = targetTop;

          // Restore intermediate items' media (remove .zeros-media-transit)
          clearTransitItems();

          // Re-enable scroll-snap — clear inline override so CSS class takes over
          container.style.scrollSnapType = "";

          animationFrameRef.current = null;

          // Play anticipation "landing" animation on the target item
          applyAnticipation(targetItemId, scrollDirection);

          // Update prevScrollTop so the scroll-stop listener has the correct
          // baseline for the next native scroll direction detection
          prevScrollTopRef.current = targetTop;

          // Release IntersectionObserver lock after settle buffer
          programmaticTimerRef.current = setTimeout(() => {
            isProgrammaticScrollRef.current = false;
            programmaticTimerRef.current = null;
          }, PROGRAMMATIC_SCROLL_DURATION_MS);
        }
      };

      animationFrameRef.current = requestAnimationFrame(step);
    },
    [onItemActive, applyAnticipation, clearTransitItems, applyTransitItems]
  );

  // WORKFLOW: handleSidebarClick
  // TRIGGERED BY: User clicks an item in the left sidebar
  // Computes intermediate item IDs, then passes them to animateScrollToItem
  const handleSidebarClick = useCallback(
    (itemId: string) => {
      if (isSidebarLockedRef.current) return;

      // Lock sidebar clicks for the duration of animation + buffer
      isSidebarLockedRef.current = true;
      if (sidebarLockTimerRef.current) {
        clearTimeout(sidebarLockTimerRef.current);
      }
      sidebarLockTimerRef.current = setTimeout(() => {
        isSidebarLockedRef.current = false;
        sidebarLockTimerRef.current = null;
      }, SIDEBAR_CLICK_COOLDOWN_MS);

      // Determine item distance from current → target
      const currentIndex = metadataItems.findIndex(
        (item) => item.id === activeItemId
      );
      const targetIndex = metadataItems.findIndex(
        (item) => item.id === itemId
      );

      if (
        currentIndex >= 0 &&
        targetIndex >= 0 &&
        currentIndex !== targetIndex
      ) {
        // Compute intermediate IDs (strictly between start & target)
        const start = Math.min(currentIndex, targetIndex);
        const end = Math.max(currentIndex, targetIndex);
        const intermediateIds: string[] = [];
        for (let i = start + 1; i < end; i++) {
          intermediateIds.push(metadataItems[i].id);
        }

        // Animated scroll with transit — intermediate items show bg2, no media
        const itemDistance = Math.abs(targetIndex - currentIndex);
        const scrollDirection = targetIndex > currentIndex ? "down" : "up";
        animateScrollToItem(itemId, itemDistance, scrollDirection, intermediateIds);
        lastActiveIndexRef.current = targetIndex;
      } else {
        // Same item or couldn't resolve indices → instant jump
        scrollMainFeedToItem(itemId);
      }

      // Notify parent
      onItemClick(itemId);
    },
    [
      onItemClick,
      scrollMainFeedToItem,
      animateScrollToItem,
      metadataItems,
      activeItemId,
    ]
  );

  // WORKFLOW: handleLoadMoreMetadata
  const handleLoadMoreMetadata = useCallback(() => {
    onLoadMoreMetadata(metadataOffset, 20);
    setMetadataOffset((prev) => prev + 20);
  }, [metadataOffset, onLoadMoreMetadata]);

  // --- KEYBOARD NAVIGATION ---
  // ArrowUp/Down and PageUp/Down navigate one item at a time (vertical feed)
  // Keyboard navigation: ArrowUp/Down for feed item navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // --- VERTICAL: ArrowUp/Down, PageUp/Down → feed item navigation ---
      let direction = 0;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        direction = 1;
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        direction = -1;
      } else {
        return;
      }

      e.preventDefault();

      // Find current index from activeItemId
      const currentIndex = metadataItems.findIndex(
        (item) => item.id === activeItemId
      );
      if (currentIndex < 0) return;

      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= metadataItems.length) return;

      const nextItemId = metadataItems[nextIndex].id;
      const keyDir: "up" | "down" = direction > 0 ? "down" : "up";

      // Animated scroll to adjacent item (distance = 1, no intermediates)
      // animateScrollToItem plays anticipation on landing automatically
      animateScrollToItem(nextItemId, 1, keyDir, []);
      lastActiveIndexRef.current = nextIndex;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeItemId, metadataItems, animateScrollToItem]);

  // --- INTERSECTION OBSERVER: Track which item is visible in the main feed ---
  // This is the ONLY mechanism that updates activeItemId during native scroll.
  // During programmatic scrolls (sidebar click, keyboard), isProgrammaticScrollRef
  // suppresses updates to prevent intermediate items from briefly becoming active.
  //
  // NOTE: Anticipation animation is NOT triggered here. The observer fires at 60%
  // visibility (while scroll-snap is still animating), so the 5px translateY would
  // be invisible amid the larger scroll motion. Instead, anticipation for native
  // scroll is handled by the scroll-stop listener below.
  useEffect(() => {
    if (!mainFeedRef.current || metadataItems.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Skip during programmatic scroll (sidebar click, keyboard nav)
            if (isProgrammaticScrollRef.current) return;

            const itemId = entry.target.id.replace("feed-", "");
            // Use ref (not closure) for activeItemId to avoid recreating observer
            // on every active item change
            if (itemId && itemId !== activeItemIdRef.current) {
              // Update last active index for direction tracking
              const newIndex = metadataItems.findIndex(
                (item) => item.id === itemId
              );
              lastActiveIndexRef.current = newIndex;

              onItemActive(itemId);
            }
          }
        });
      },
      {
        root: mainFeedRef.current,
        rootMargin: "0px",
        threshold: 0.6,
      }
    );

    const feedItems = mainFeedRef.current.querySelectorAll("[id^='feed-']");
    feedItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [metadataItems, onItemActive]);

  // --- ANTICIPATION: SCROLL-STOP LISTENER (for wheel/touch/trackpad) ---
  // Detects when native scrolling has STOPPED (scroll-snap has settled) using a
  // debounced scroll listener. When SCROLL_STOP_DELAY_MS passes with no scroll
  // events, the snap animation is done and the card is stationary — perfect time
  // for the landing bounce.
  //
  // For programmatic scrolls (sidebar click, keyboard), this listener is skipped
  // because isProgrammaticScrollRef is true. Those paths handle anticipation via
  // animateScrollToItem's completion callback instead.
  useEffect(() => {
    const container = mainFeedRef.current;
    if (!container) return;

    // Initialize prevScrollTop to current position (handles page load)
    prevScrollTopRef.current = container.scrollTop;

    const handleScroll = () => {
      // Clear any pending scroll-stop timer
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }

      // Set a new timer — fires SCROLL_STOP_DELAY_MS after the LAST scroll event
      // (i.e., when scroll-snap has fully settled)
      scrollEndTimerRef.current = setTimeout(() => {
        scrollEndTimerRef.current = null;

        // Skip if this was a programmatic scroll (sidebar/keyboard handle their own)
        if (isProgrammaticScrollRef.current) return;

        const currentTop = container.scrollTop;
        const prevTop = prevScrollTopRef.current;

        // Skip if position didn't change (e.g., bounce at edge)
        if (currentTop === prevTop) return;

        // Determine direction from scroll position delta
        const dir: "up" | "down" = currentTop > prevTop ? "down" : "up";
        prevScrollTopRef.current = currentTop;

        // Apply anticipation to the currently active item
        const activeId = activeItemIdRef.current;
        if (activeId) {
          applyAnticipation(activeId, dir);
        }
      }, SCROLL_STOP_DELAY_MS);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
    };
  }, [applyAnticipation]);

  // Auto-scroll sidebar when active item changes.
  //
  // ENTRANCE GUARD: Skip this effect while entrance animations are playing
  // (!entranceDone). Without this guard, on page load the effect fires immediately
  // when activeItemId is first set — calling scrollIntoView({ behavior: 'smooth',
  // block: 'center' }) which forces a synchronous layout reflow DURING the CSS
  // entrance animation. For the first item (at the top of the sidebar), this reflow
  // causes the browser to briefly resolve the item at its layout position (top)
  // before the animation's translateY(50vh) transform kicks back in, creating a
  // visible "top-to-bottom" flash that breaks the smooth upward-rise entrance.
  //
  // Once entranceDone becomes true (~2500ms after page load), this effect fires
  // one last time (dependency changed) and scrolls to the current active item.
  // Any activeItemId changes that occurred during the entrance phase are captured
  // because the effect reads the latest activeItemId at that point.
  useEffect(() => {
    if (!entranceDone) return; // Skip during entrance animation phase
    scrollToActiveSidebarItem();
  }, [activeItemId, scrollToActiveSidebarItem, entranceDone]);

  // --- DYNAMIC SCROLL-PADDING-TOP (ResizeObserver on sticky header) ---
  // The sticky header's height changes when filter chips are added/removed.
  // A static CSS scroll-padding-top cannot account for this — the first list item
  // would be clipped behind the taller header. This ResizeObserver watches the
  // header's actual rendered height and updates scroll-padding-top in real time.
  //
  // FUTURE-PROOF: Works with any number of filter chips. If multiple filters are
  // enabled in the future and the chip row wraps to multiple lines, the observer
  // will detect the new height and adjust scroll-padding-top automatically.
  //
  // GAP: 8px is added to the measured header height to match the sidebar's flex gap.
  // This ensures scroll-padding-top exactly aligns with the first list item's top edge:
  //   scroll-padding-top = headerHeight + 8px = headerHeight + sidebar gap
  //   first item offsetTop = headerHeight + 8px (sidebar gap)
  //   → snap point for first item = offsetTop - scroll-padding-top = 0px (perfect alignment)
  //
  // CRITICAL: This MUST match the sidebar's CSS `gap` value (8px). A mismatch creates
  // a scroll-snap misalignment where the first item's snap point is offset from scrollTop=0.
  // Even a 2px difference causes the browser's proximity snap engine to adjust scrollTop
  // mid-animation (during FLIP close, entrance, etc.), producing visible "shivering"
  // on the first item. The previous value of 6px caused exactly this problem — the first
  // item's snap point was at scrollTop=2 instead of scrollTop=0.
  const HEADER_SCROLL_GAP_PX = 8;

  useEffect(() => {
    const header = sidebarHeaderRef.current;
    const sidebar = sidebarRef.current;
    if (!header || !sidebar) return;

    const updateScrollPadding = () => {
      const headerHeight = header.getBoundingClientRect().height;
      sidebar.style.scrollPaddingTop = `${headerHeight + HEADER_SCROLL_GAP_PX}px`;
    };

    // Set initial value immediately
    updateScrollPadding();

    // Observe header size changes (filter chips added/removed, responsive reflows)
    const observer = new ResizeObserver(() => {
      updateScrollPadding();
    });
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  // WORKFLOW: trackActiveItemVisibility
  useEffect(() => {
    if (!activeItemId || !sidebarRef.current) {
      setIsActiveItemVisible(true);
      return;
    }

    const sidebarItem = document.getElementById(`sidebar-${activeItemId}`);
    if (!sidebarItem) {
      setIsActiveItemVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsActiveItemVisible(entry.isIntersecting);
        });
      },
      {
        root: sidebarRef.current,
        rootMargin: "0px",
        threshold: 0.5,
      }
    );

    observer.observe(sidebarItem);

    return () => observer.disconnect();
  }, [activeItemId, metadataItems]);

  // --- FLIP ANIMATION: Filter open/close active item transition ---
  // When the filter opens or closes, the active item is unmounted from one location
  // and remounted in another (conditional render). Without animation, this causes
  // an instant position jump.
  //
  // FLIP technique (First, Last, Invert, Play):
  //   First:  Handler captures the active item's bounding rect BEFORE render
  //   Last:   This effect reads the new element's position AFTER React commits
  //   Invert: Apply translateY(deltaY) so the element appears at its OLD position
  //   Play:   Transition translateY → 0 so it smoothly slides to its new position
  //
  // OPEN:  Active item animates from its scroll position → filter-active-item slot
  // CLOSE: Active item animates from filter-active-item slot → its scroll position
  //        (top, center, or bottom of the list — wherever it naturally sits)
  //
  // CRITICAL: useLayoutEffect (not useEffect) ensures the INVERT transform is applied
  // BEFORE the browser's first paint. Without this, the browser paints ONE FRAME with
  // the element at its natural (final) position, THEN the invert kicks in — causing a
  // visible flash where the item appears at its destination, jumps to the old position,
  // and then animates back. This is most visible on the first list item because:
  //   - It's at the top of the sidebar (largest visual delta from filter slot at bottom)
  //   - It's in the user's focal area (near the header)
  //   - The jump from top → bottom → back to top is very jarring
  //
  // CLOSE SCROLL RESTORE: When the filter closes, all list items remount (conditional
  // render unmounts/remounts them). This resets the sidebar scrollTop to 0. Without
  // restoring the pre-filter scroll position, the active item ends up at whatever
  // position scrollTop=0 produces — which is wrong for items that were in the middle
  // or bottom of the list. savedSidebarScrollRef stores the exact scrollTop before
  // the filter opened, and we restore it here before measuring.
  useLayoutEffect(() => {
    const direction = flipDirectionRef.current;
    if (!direction || !savedActiveRectRef.current) return;

    // Consume the refs — one-shot per transition
    const oldRect = savedActiveRectRef.current;
    savedActiveRectRef.current = null;
    flipDirectionRef.current = null;

    if (direction === 'open') {
      // --- FLIP OPEN: list position → filter-active-item position ---
      const el = filterActiveItemRef.current;
      if (!el) return;

      // Measure new position synchronously (useLayoutEffect = DOM committed, layout valid)
      const newRect = el.getBoundingClientRect();
      const deltaY = oldRect.top - newRect.top;
      if (Math.abs(deltaY) < 2) return;

      // INVERT: position at old list location (applied BEFORE browser paint)
      el.style.transform = `translateY(${deltaY}px)`;
      el.style.transition = 'none';

      // PLAY: start animation on next frame (after browser paints the inverted state)
      requestAnimationFrame(() => {
        el.style.transition = 'transform var(--dur-slow) var(--ease-emphasized)';
        el.style.transform = 'translateY(0)';

        const cleanup = () => {
          el.style.transform = '';
          el.style.transition = '';
          el.removeEventListener('transitionend', cleanup);
        };
        el.addEventListener('transitionend', cleanup);
      });
    } else {
      // --- FLIP CLOSE: filter-active-item position → list scroll position ---
      // The active item was in the filter-active-item slot (oldRect). Now it's
      // remounted as a list item in the scrollable sidebar. We need to:
      //   1. Disable scroll-snap to prevent the browser from fighting the animation
      //   2. Restore the sidebar's pre-filter scroll position (so the item is
      //      at the EXACT same viewport position it was before the filter opened)
      //   3. Measure its new position
      //   4. FLIP animate from old position (filter slot) to new position
      //   5. Re-enable scroll-snap after animation completes
      //
      // WHY DISABLE SCROLL-SNAP:
      //   The sidebar has `scroll-snap-type: y proximity` with `scroll-snap-align: start`
      //   on each item wrapper. When the filter closes, the sidebar transitions from
      //   `overflow: hidden` (filter-open) to `overflow-y: auto`. At that moment,
      //   the browser's scroll-snap engine activates and tries to snap to the nearest
      //   snap point. For the first item, there's a small misalignment between its
      //   actual position (header 52px + gap 8px = 60px) and scroll-padding-top (58px),
      //   making its snap point ~2px from scrollTop=0. The browser's proximity snap
      //   adjustment during the FLIP CSS transition causes visible "shivering" — the
      //   scroll position shifts mid-animation, fighting the translateY transition.
      //   Disabling snap during the animation (same pattern as animateScrollToItem
      //   on the main feed) eliminates this interference entirely.
      const currentActiveId = activeItemIdRef.current;
      if (!currentActiveId) return;

      const el = document.getElementById(`sidebar-${currentActiveId}`);
      const sidebar = sidebarRef.current;
      if (!el || !sidebar) return;

      // DISABLE scroll-snap to prevent snap adjustments during FLIP animation.
      // Without this, the browser's proximity snap engine detects the restored
      // scrollTop is ~2px off a snap point (especially for the first item) and
      // adjusts it mid-animation, causing visible shivering.
      sidebar.style.scrollSnapType = 'none';

      // Restore the sidebar scroll position to where it was BEFORE the filter opened.
      // This is synchronous and happens before paint — the browser will never show
      // the sidebar at scrollTop=0 with items in wrong positions.
      sidebar.scrollTop = savedSidebarScrollRef.current;

      // Measure the active item's position at the restored scroll position
      const newRect = el.getBoundingClientRect();
      const deltaY = oldRect.top - newRect.top;

      if (Math.abs(deltaY) < 2) {
        // No animation needed — just re-enable snap
        sidebar.style.scrollSnapType = '';
        return;
      }

      // INVERT: position the element at its old location (filter slot)
      // Applied BEFORE paint — user never sees the item at its natural position
      el.style.transform = `translateY(${deltaY}px)`;
      el.style.transition = 'none';

      // PLAY: start animation on next frame (after browser paints the inverted state)
      requestAnimationFrame(() => {
        el.style.transition = 'transform var(--dur-slow) var(--ease-emphasized)';
        el.style.transform = 'translateY(0)';

        const cleanup = () => {
          el.style.transform = '';
          el.style.transition = '';
          // Re-enable scroll-snap after animation completes —
          // clear inline override so CSS class takes over
          if (sidebarRef.current) {
            sidebarRef.current.style.scrollSnapType = '';
          }
          el.removeEventListener('transitionend', cleanup);
        };
        el.addEventListener('transitionend', cleanup);
      });
    }
  }, [isFilterOpen]);

  // --- Cleanup on unmount ---
  // Cancel all timers AND any in-progress rAF animation.
  // Also re-enable scroll-snap and restore transit items in case unmount happens mid-animation.
  useEffect(() => {
    return () => {
      if (sidebarLockTimerRef.current)
        clearTimeout(sidebarLockTimerRef.current);
      if (programmaticTimerRef.current)
        clearTimeout(programmaticTimerRef.current);
      if (scrollEndTimerRef.current)
        clearTimeout(scrollEndTimerRef.current);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        // Re-enable scroll-snap if unmounting mid-animation
        if (mainFeedRef.current) {
          mainFeedRef.current.style.scrollSnapType = "";
        }
      }
      // Restore any hidden intermediate items
      transitItemsRef.current.forEach((el) => {
        el.classList.remove("zeros-media-transit");
      });
      transitItemsRef.current = [];
    };
  }, []);

  // --- RENDER ---
  return (
    <>
    {/* Mobile top bar — visible only on ≤640px via CSS */}
    <MobileTopBar
      onFilterClick={handleFilterToggle}
      isFilterOpen={isFilterOpen}
    />
    <div className="zeros-feed-layout">
      {/* ============================
          LEFT SIDEBAR (15%)
          ============================ */}
      <aside
        ref={sidebarRef}
        id="left-sidebar-scroll"
        className={`zeros-sidebar-left zeros-scroll-hidden${isFilterOpen ? " filter-open" : ""}`}
      >
        {/* --- HEADER: Explore tag + filter icon + selected chip --- */}
        <ListFeedHeader
          isFilterOpen={isFilterOpen}
          onFilterClick={handleFilterToggle}
          selectedFilter={selectedFilter}
          onClearFilter={handleClearFilter}
          className={hasEntered ? "zeros-entrance-header" : ""}
          ref={sidebarHeaderRef}
        />

        {/* --- FILTER OPEN MODE ---
            When the filter panel is open, the sidebar transforms:
              Header → Filter panel → Active item (fills remaining space, content at top)
            The active item sits directly below the filter panel. Its container
            fills the remaining viewport height (flex: 1), but the card content
            is top-aligned. Only when the filter panel's content exceeds the
            available space does the panel scroll internally, and the active item
            effectively appears at the bottom. All inactive items are hidden. */}
        {/* Skeleton loading state for sidebar */}
        {metadataItems.length === 0 && (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="zeros-list-item zeros-list-item--ghost">
                <div className="zeros-skeleton w-7 h-7 rounded-lg" />
                <div className="zeros-skeleton w-3/4 h-3 mt-2 rounded" />
              </div>
            ))}
          </>
        )}

        {isFilterOpen ? (
          <>
            {/* Filter panel — scrollable if content overflows */}
            <FilterPanel
              selectedFilter={selectedFilter}
              onSelectFilter={handleSelectFilter}
            />

            {/* Active item — fills remaining space below filter panel.
                Card content is top-aligned; container stretches to viewport bottom.
                When filter panel is short, card sits directly below it.
                When filter panel is tall, it scrolls and the card appears at the bottom. */}
            {activeItem && (
              <div ref={filterActiveItemRef} className="zeros-filter-active-item">
                <ListFeedItem
                  title={activeItem.title}
                  subcategory={activeItem.applications?.[0] || activeItem.module || ""}
                  mediaUrl={activeItem.media_url || ""}
                  tags={activeItem.tags}
                  selected={true}
                  onClick={() => {
                    // Capture rect before closing (FLIP: First for close)
                    if (filterActiveItemRef.current) {
                      savedActiveRectRef.current = filterActiveItemRef.current.getBoundingClientRect();
                      flipDirectionRef.current = 'close';
                    }
                    // Close filter — list remounts, FLIP effect animates to scroll position
                    setIsFilterOpen(false);
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <>
            {/* --- NORMAL MODE: all list items visible, scrollable --- */}
            {metadataItems.map((item, index) => (
              <div
                key={item.id}
                id={`sidebar-${item.id}`}
                className={hasEntered && !entranceDone && index < entranceCountRef.current ? "zeros-entrance-item" : ""}
                style={
                  hasEntered && !entranceDone && index < entranceCountRef.current
                    ? ({
                        "--entrance-delay": `${280 + index * 50 + Math.pow(index, 1.15) * 8}ms`,
                      } as React.CSSProperties)
                    : !entranceDone
                      ? ({ opacity: 0 } as React.CSSProperties)
                      : undefined
                }
              >
                <ListFeedItem
                  title={item.title}
                  subcategory={item.applications?.[0] || item.module || ""}
                  mediaUrl={item.media_url || ""}
                  tags={item.tags}
                  selected={item.id === activeItemId}
                  onClick={() => handleSidebarClick(item.id)}
                />
              </div>
            ))}

            {hasMoreMetadata && (
              <button
                onClick={handleLoadMoreMetadata}
                disabled={loadingMoreMetadata}
                className="zeros-sidebar-action"
              >
                <ChevronDown size={16} />
                <span>{loadingMoreMetadata ? "..." : "More"}</span>
              </button>
            )}

            {activeItemId && !isActiveItemVisible && (
              <button
                onClick={() => handleSidebarClick(activeItemId)}
                className="zeros-sidebar-action zeros-sidebar-action--sticky"
              >
                <LocateFixed size={14} />
                <span>Active</span>
              </button>
            )}
          </>
        )}
      </aside>

      {/* ============================
          MAIN FEED — CSS scroll-snap container
          ============================ */}
      <main
        ref={mainFeedRef}
        id="main-feed"
        className={`zeros-main-feed zeros-scroll-hidden${hasEntered ? " zeros-entrance-main" : ""}`}
      >
        {/* Skeleton loading state for main feed */}
        {metadataItems.length === 0 && (
          <div className="zeros-feed-card">
            <div className="zeros-media-wrapper">
              <div className="zeros-media-container zeros-skeleton" />
            </div>
          </div>
        )}

        {metadataItems.map((item) => (
          <MainFeedItem
            key={item.id}
            id={item.id}
            title={item.title}
            mediaUrl={item.media_url}
            mediaType={item.media_type}
            isActive={item.id === activeItemId}
          />
        ))}

        {loadingMoreMetadata && <div className="zeros-feed-loading">Loading...</div>}
      </main>

      {/* ============================
          RIGHT SIDEBAR (20%)
          ============================ */}
      <aside className={`zeros-sidebar-right${hasEntered ? " zeros-entrance-right" : ""}`}>
        {metadataItems.length === 0 ? (
          /* Skeleton loading state for side feed */
          <div className="zeros-side-card flex flex-col gap-3">
            <div className="zeros-skeleton w-20 h-5 rounded-full" />
            <div className="zeros-skeleton w-full h-5 rounded" />
            <div className="zeros-skeleton w-4/5 h-5 rounded" />
            <div className="zeros-skeleton w-full h-3 rounded mt-2" />
            <div className="zeros-skeleton w-full h-3 rounded" />
            <div className="zeros-skeleton w-3/5 h-3 rounded" />
          </div>
        ) : (
          <SideFeedItem
            title={activeItem?.title || ""}
            description={activeItem?.description || ""}
            module={activeItem?.module || ""}
            author=""
            mediaUrl={activeItem?.media_url}
            mediaType={activeItem?.media_type}
            sections={activeSections}
            applications={activeItem?.applications || []}
            psychology={activeItem?.psychology || []}
            industries={activeItem?.industries || []}
            ai_patterns={activeItem?.ai_patterns || []}
            ui_elements={activeItem?.ui_elements || []}
            tags={activeItem?.tags || []}
          />
        )}
      </aside>
    </div>

    {/* Mobile bottom sheet — visible only on ≤640px via CSS media query on parent */}
    <div className="zeros-mobile-sheet-wrapper">
      <MobileBottomSheet
        title={activeItem?.title || ""}
        description={activeItem?.description || ""}
        tags={activeItem?.tags || []}
        sections={activeSections}
        activeSectionIndex={0}
      />
    </div>
    </>
  );
}
