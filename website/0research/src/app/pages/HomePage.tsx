// ============================================
// PAGE: HomePage (Main Feed Page)
// ROUTE: / (root path)
// PURPOSE: Main content discovery and browsing interface
//
// DATA MODEL OVERVIEW (two APIs, one truth):
//
//   1. METADATA API  — basic info for the sidebar/list
//      Returns: title, description, category, tags, thumbnail_url
//      Pagination: 20 items per batch, auto-loads at 75% scroll threshold
//
//   2. MEDIA API  — rich content for the main feed + side feed detail
//      Returns: primary_media (image/video URL) + content_block (detailed text)
//      Loading: smart prefetch in batches of 6, triggered by scroll position
//
// MEDIA PREFETCH STRATEGY:
//
//   Page load → fetch media for items 1-6 (indices 0-5).
//
//   MAIN CONTAINER SCROLL (forward):
//     Trigger: when any of the next 3 items ahead are unloaded
//     Action:  fetch 6 items forward from the first unloaded index
//     Example: at item 4 → items 5,6 loaded but 7 not → fetch 7-12
//              at item 10 → items 11,12 loaded but 13 not → fetch 13-18
//              at item 16 → items 17,18 loaded but 19 not → fetch 19-24
//
//   MAIN CONTAINER SCROLL (backward):
//     Trigger: when any of the previous 3 items behind are unloaded
//     Action:  fetch 6 items backward ending at the first unloaded index
//     Example: at item 16 → item 13 not loaded → fetch 8-13
//              at item 10 → item 7 not loaded → fetch 2-7
//
//   SIDEBAR CLICK (jump to arbitrary item):
//     Action:  fetch 6 items BEFORE clicked index + 6 items FROM clicked index
//     Example: click item 20 → fetch 14-19 AND 20-25
//     Then forward/backward scroll triggers continue from the new position.
//
// ============================================

import { useState, useEffect, useCallback, useRef } from "react";
import { FeedExperience } from "../components/feed/FeedExperience";
import { getMetadata, getMedia } from "../api/feeds";
import type { MetadataItem, MediaItem } from "../types";

// --- MEDIA PREFETCH CONSTANTS ---

/** Number of media items to fetch per batch */
const MEDIA_BATCH_SIZE = 6;

/** How many items ahead/behind to check before triggering a prefetch.
 *  If ANY of the next/prev MEDIA_PREFETCH_LOOKAHEAD items are unloaded → fetch. */
const MEDIA_PREFETCH_LOOKAHEAD = 3;

/** How many items to load BEFORE the clicked item on sidebar jump */
const SIDEBAR_PREFETCH_BEFORE = 6;

/** How many items to load FROM the clicked item (inclusive) on sidebar jump */
const SIDEBAR_PREFETCH_AFTER = 6;

export function HomePage() {
  // --- VARIABLES ---

  // Array of loaded media content objects (primary_media + content_block)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  // ID of the currently active/selected feed item
  const [activeItemId, setActiveItemId] = useState<string>("");

  // Array of feed metadata items (titles, descriptions, thumbnails for sidebar)
  const [metadataItems, setMetadataItems] = useState<MetadataItem[]>([]);

  // Whether there are more metadata items to load (pagination flag)
  const [hasMoreMetadata, setHasMoreMetadata] = useState<boolean>(true);

  // Whether metadata is currently being loaded
  const [loadingMoreMetadata, setLoadingMoreMetadata] = useState<boolean>(false);

  // --- MEDIA PREFETCH TRACKING ---

  // Set of item IDs for which media has been loaded (prevents duplicate fetches)
  const loadedMediaIdsRef = useRef<Set<string>>(new Set());

  // Set of item IDs currently being fetched (prevents concurrent duplicate requests)
  const inFlightMediaIdsRef = useRef<Set<string>>(new Set());

  // Previous active item index — used to detect scroll direction
  const prevActiveIndexRef = useRef<number>(0);

  // --- AUTO-LOAD THRESHOLD TRACKING (METADATA) ---

  // The 1-based item position that triggers the next metadata batch load
  // Starts at 15 (75% of initial 20 items)
  // After each batch loads, advances by 20 (e.g., 15 → 35 → 55 → ...)
  const nextLoadThresholdRef = useRef<number>(15);

  // Prevents duplicate auto-load triggers while a metadata batch is loading
  const isAutoLoadingRef = useRef<boolean>(false);

  // Tracks previous metadata count — used by gap-fill to detect actual expansion
  const prevMetadataLengthRef = useRef<number>(0);

  // Stable ref for activeItemId — used by gap-fill without adding to deps
  const activeItemIdRef = useRef<string>("");
  activeItemIdRef.current = activeItemId;

  // Stable reference to metadataItems for use in callbacks without stale closures
  const metadataItemsRef = useRef<MetadataItem[]>([]);
  metadataItemsRef.current = metadataItems;

  // --- CORE MEDIA FETCH ---

  // WORKFLOW: ensureMediaForRange
  // PURPOSE: Fetches media for a range of metadata indices, skipping already-loaded
  //          and in-flight items. This is the single entry point for ALL media fetching.
  // PARAMS:  startIdx, endIdx — inclusive range of indices into metadataItems
  // CALLED BY: loadInitialData, handleScrollPrefetch, handleClickPrefetch
  const ensureMediaForRange = useCallback(
    async (startIdx: number, endIdx: number) => {
      const items = metadataItemsRef.current;
      if (items.length === 0) return;

      // Clamp to valid range
      const safeStart = Math.max(0, startIdx);
      const safeEnd = Math.min(items.length - 1, endIdx);

      // Collect IDs that need fetching (not loaded, not in-flight)
      const idsToFetch: string[] = [];
      for (let i = safeStart; i <= safeEnd; i++) {
        const id = items[i].id;
        if (
          !loadedMediaIdsRef.current.has(id) &&
          !inFlightMediaIdsRef.current.has(id)
        ) {
          idsToFetch.push(id);
        }
      }

      if (idsToFetch.length === 0) return;

      // Mark as in-flight to prevent concurrent duplicate requests
      idsToFetch.forEach((id) => inFlightMediaIdsRef.current.add(id));

      try {
        const newMedia = await getMedia(idsToFetch);

        // Append to mediaItems state
        setMediaItems((prev) => [...prev, ...newMedia]);

        // Mark as loaded and clear in-flight
        idsToFetch.forEach((id) => {
          loadedMediaIdsRef.current.add(id);
          inFlightMediaIdsRef.current.delete(id);
        });
      } catch (error) {
        console.error(
          "Failed to fetch media for range:",
          startIdx,
          "-",
          endIdx,
          error
        );
        // Clear in-flight on error so retry is possible
        idsToFetch.forEach((id) => inFlightMediaIdsRef.current.delete(id));
      }
    },
    []
  );

  // --- WORKFLOWS ---

  // WORKFLOW: loadInitialData (Auto-fetch)
  // TRIGGERED BY: Page load (useEffect with empty dependency)
  // WHAT IT DOES:
  // 1. Fetches first 20 metadata items
  // 2. Sets the first item as active
  // 3. Fetches media for the first 6 items (MEDIA_BATCH_SIZE)
  // 4. Checks if more metadata exists
  const loadInitialData = useCallback(async () => {
    try {
      // Step 1: Fetch metadata
      const metadataResponse = await getMetadata(0, 20);
      setMetadataItems(metadataResponse.items);
      // Update ref immediately so ensureMediaForRange can use it
      metadataItemsRef.current = metadataResponse.items;

      // Step 2: Set first item as active
      if (metadataResponse.items.length > 0) {
        setActiveItemId(metadataResponse.items[0].id);
        prevActiveIndexRef.current = 0;
      }

      // Step 3: Fetch media for first MEDIA_BATCH_SIZE items
      const firstBatchIds = metadataResponse.items
        .slice(0, MEDIA_BATCH_SIZE)
        .map((item) => item.id);

      if (firstBatchIds.length > 0) {
        console.log(
          `%c[PAGE LOAD]%c Initial media fetch: items 1–${MEDIA_BATCH_SIZE}`,
          "color: #81C784; font-weight: bold",
          "color: inherit"
        );
        const mediaResponse = await getMedia(firstBatchIds);
        setMediaItems(mediaResponse);
        // Mark as loaded
        firstBatchIds.forEach((id) => loadedMediaIdsRef.current.add(id));
      }

      // Step 4: Check if more metadata exists
      if (metadataResponse.items.length < 20) {
        setHasMoreMetadata(false);
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  }, []);

  // WORKFLOW: loadMoreMetadata
  // TRIGGERED BY: Auto-load threshold or "More" button in sidebar
  // WHAT IT DOES:
  // 1. Fetches next batch of metadata from API
  // 2. Appends new metadata items to existing list
  // 3. If returned items < limit: Sets hasMoreMetadata = false
  const loadMoreMetadata = useCallback(
    async (offset: number, limit: number = 20) => {
      setLoadingMoreMetadata(true);

      try {
        const response = await getMetadata(offset, limit);

        if (response.items.length > 0) {
          setMetadataItems((prev) => [...prev, ...response.items]);
        }

        // Check if we've loaded all items
        if (response.items.length < limit) {
          setHasMoreMetadata(false);
        }
      } catch (error) {
        console.error("Failed to load more metadata:", error);
      } finally {
        setLoadingMoreMetadata(false);
      }
    },
    []
  );

  // --- MEDIA PREFETCH LOGIC ---

  // WORKFLOW: handleScrollPrefetch
  // PURPOSE: Called when the active item changes due to main container scroll.
  //          Detects direction (forward/backward) and prefetches the next batch
  //          of media if any of the upcoming items are unloaded.
  //
  // FORWARD TRIGGER EXAMPLE (initial state: items 0-5 loaded):
  //   User at index 3 → check indices 4,5,6 → index 6 not loaded → fetch 6-11
  //   User at index 9 → check indices 10,11,12 → index 12 not loaded → fetch 12-17
  //   User at index 15 → check indices 16,17,18 → index 18 not loaded → fetch 18-23
  //
  // BACKWARD TRIGGER EXAMPLE (user jumped to index 19, loaded 13-24):
  //   User at index 15 → check indices 14,13,12 → index 12 not loaded → fetch 7-12
  //   User at index 9 → check indices 8,7,6 → index 6 not loaded → fetch 1-6
  const handleScrollPrefetch = useCallback(
    (activeIndex: number) => {
      const items = metadataItemsRef.current;
      if (items.length === 0) return;

      // --- FIX: Always ensure the active item itself has media loaded ---
      // Handles edge case: user scrolls to an item that arrived via metadata
      // auto-load AFTER a sidebar click couldn't fetch beyond the old boundary.
      // Example: sidebar click to item 20 when metadata had 20 items → items 21+
      //          couldn't be fetched. After metadata auto-load adds items 21-40,
      //          scrolling to item 21 needs its media but forward prefetch only
      //          fetches items AHEAD (22+). This ensures the current item is covered.
      if (
        !loadedMediaIdsRef.current.has(items[activeIndex].id) &&
        !inFlightMediaIdsRef.current.has(items[activeIndex].id)
      ) {
        console.log(
          `%c[SCROLL GAP-FILL]%c Active item ${activeIndex + 1} has no media → fetching items ${activeIndex + 1}–${Math.min(activeIndex + MEDIA_BATCH_SIZE, items.length)}`,
          "color: #FFD54F; font-weight: bold",
          "color: inherit"
        );
        ensureMediaForRange(activeIndex, activeIndex + MEDIA_BATCH_SIZE - 1);
      }

      const prevIdx = prevActiveIndexRef.current;
      const goingForward = activeIndex >= prevIdx;

      if (goingForward) {
        // --- FORWARD PREFETCH ---
        // Check if any of the next LOOKAHEAD items are unloaded
        let needsFetch = false;
        for (let i = 1; i <= MEDIA_PREFETCH_LOOKAHEAD; i++) {
          const checkIdx = activeIndex + i;
          if (checkIdx < items.length && !loadedMediaIdsRef.current.has(items[checkIdx].id)) {
            needsFetch = true;
            break;
          }
        }

        if (needsFetch) {
          // Find the first unloaded index ahead
          let firstUnloaded = activeIndex + 1;
          while (
            firstUnloaded < items.length &&
            loadedMediaIdsRef.current.has(items[firstUnloaded].id)
          ) {
            firstUnloaded++;
          }
          // Fetch a batch starting from the first unloaded index
          console.log(
            `%c[SCROLL ▼]%c Forward prefetch triggered at item ${activeIndex + 1} → fetching items ${firstUnloaded + 1}–${Math.min(firstUnloaded + MEDIA_BATCH_SIZE, items.length)}`,
            "color: #CE93D8; font-weight: bold",
            "color: inherit"
          );
          ensureMediaForRange(firstUnloaded, firstUnloaded + MEDIA_BATCH_SIZE - 1);
        }
      } else {
        // --- BACKWARD PREFETCH ---
        // Check if any of the previous LOOKAHEAD items are unloaded
        let needsFetch = false;
        for (let i = 1; i <= MEDIA_PREFETCH_LOOKAHEAD; i++) {
          const checkIdx = activeIndex - i;
          if (checkIdx >= 0 && !loadedMediaIdsRef.current.has(items[checkIdx].id)) {
            needsFetch = true;
            break;
          }
        }

        if (needsFetch) {
          // Find the first unloaded index behind
          let firstUnloaded = activeIndex - 1;
          while (
            firstUnloaded >= 0 &&
            loadedMediaIdsRef.current.has(items[firstUnloaded].id)
          ) {
            firstUnloaded--;
          }
          // Fetch a batch ending at the first unloaded index
          const fetchEnd = firstUnloaded;
          const fetchStart = fetchEnd - MEDIA_BATCH_SIZE + 1;
          console.log(
            `%c[SCROLL ▲]%c Backward prefetch triggered at item ${activeIndex + 1} → fetching items ${Math.max(fetchStart + 1, 1)}–${fetchEnd + 1}`,
            "color: #CE93D8; font-weight: bold",
            "color: inherit"
          );
          ensureMediaForRange(fetchStart, fetchEnd);
        }
      }

      prevActiveIndexRef.current = activeIndex;
    },
    [ensureMediaForRange]
  );

  // WORKFLOW: handleClickPrefetch
  // PURPOSE: Called when the user clicks an item in the sidebar (list feed).
  //          Loads media for a window around the clicked item:
  //          [clickedIndex - SIDEBAR_PREFETCH_BEFORE, clickedIndex + SIDEBAR_PREFETCH_AFTER - 1]
  //          This ensures smooth forward AND backward scrolling from the new position.
  //
  // EXAMPLE: User clicks item 20 (index 19), only items 0-5 loaded:
  //   → fetch indices 13-18 (6 items before) AND 19-24 (6 items from clicked)
  //   → total: 12 items fetched, user can scroll ±6 items from click position
  const handleClickPrefetch = useCallback(
    (clickedIndex: number) => {
      console.log(
        `%c[SIDEBAR CLICK]%c Clicked item ${clickedIndex + 1} → fetching items ${Math.max(clickedIndex - SIDEBAR_PREFETCH_BEFORE + 1, 1)}–${clickedIndex} (before) + ${clickedIndex + 1}–${clickedIndex + SIDEBAR_PREFETCH_AFTER} (after)`,
        "color: #F06292; font-weight: bold",
        "color: inherit"
      );
      // Previous SIDEBAR_PREFETCH_BEFORE items
      ensureMediaForRange(
        clickedIndex - SIDEBAR_PREFETCH_BEFORE,
        clickedIndex - 1
      );
      // Clicked item + next SIDEBAR_PREFETCH_AFTER - 1 items
      ensureMediaForRange(
        clickedIndex,
        clickedIndex + SIDEBAR_PREFETCH_AFTER - 1
      );
    },
    [ensureMediaForRange]
  );

  // --- EVENT HANDLERS ---

  // EVENT: onItemActive (from FeedExperience)
  // TRIGGERED BY: IntersectionObserver detects item in viewport (main container scroll)
  // WHAT IT DOES:
  // 1. Updates activeItemId
  // 2. Triggers scroll-based media prefetch (forward or backward)
  const handleItemActive = useCallback(
    (itemId: string) => {
      setActiveItemId(itemId);

      // Find the index of the newly active item
      const activeIndex = metadataItemsRef.current.findIndex(
        (item) => item.id === itemId
      );
      if (activeIndex >= 0) {
        handleScrollPrefetch(activeIndex);
      }
    },
    [handleScrollPrefetch]
  );

  // EVENT: onItemClick (from FeedExperience)
  // TRIGGERED BY: User clicks an item in the left sidebar (list feed)
  // WHAT IT DOES:
  // 1. Updates activeItemId
  // 2. Triggers sidebar-click media prefetch (prev 6 + next 6 around clicked item)
  const handleItemClick = useCallback(
    (itemId: string) => {
      setActiveItemId(itemId);

      // Find the index of the clicked item
      const clickedIndex = metadataItemsRef.current.findIndex(
        (item) => item.id === itemId
      );
      if (clickedIndex >= 0) {
        prevActiveIndexRef.current = clickedIndex;
        handleClickPrefetch(clickedIndex);
      }
    },
    [handleClickPrefetch]
  );

  // --- AUTO-FETCH: Load data on page mount ---
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // --- AUTO-LOAD: Prefetch next metadata batch when active item crosses threshold ---
  // WORKFLOW: autoLoadNextBatch
  // TRIGGERED BY: activeItemId changes (from scroll OR click)
  useEffect(() => {
    if (!activeItemId || !hasMoreMetadata) return;
    if (isAutoLoadingRef.current) return;
    if (metadataItems.length === 0) return;

    // Find the 1-based position of the active item
    const activeIndex = metadataItems.findIndex(
      (item) => item.id === activeItemId
    );
    // activeIndex is 0-based; convert to 1-based position
    const activePosition = activeIndex + 1;

    // Check if the active position has reached or passed the threshold
    if (activePosition >= nextLoadThresholdRef.current) {
      // Lock to prevent duplicate triggers during this batch load
      isAutoLoadingRef.current = true;

      // Current offset = total items loaded so far
      const currentOffset = metadataItems.length;
      const batchSize = 20;

      // Advance threshold for the NEXT batch
      // e.g., after loading items 21-40, next threshold = 35 (75% of 40)
      nextLoadThresholdRef.current = currentOffset + Math.floor(batchSize * 0.75);

      console.log(
        `%c[METADATA AUTO-LOAD]%c Threshold reached at item ${activePosition} → loading metadata ${currentOffset + 1}–${currentOffset + batchSize} (next threshold: ${nextLoadThresholdRef.current})`,
        "color: #4FC3F7; font-weight: bold",
        "color: inherit"
      );

      // Trigger the batch load
      (async () => {
        try {
          await loadMoreMetadata(currentOffset, batchSize);
        } finally {
          // Release lock so next threshold can trigger
          isAutoLoadingRef.current = false;
        }
      })();
    }
  }, [activeItemId, metadataItems, hasMoreMetadata, loadMoreMetadata]);

  // --- MEDIA GAP-FILL: Fill media gaps after metadata expansion ---
  // WORKFLOW: fillMediaGapsOnMetadataExpand
  // TRIGGERED BY: metadataItems.length changes (new metadata batch arrived)
  // PURPOSE: When a sidebar click tries to fetch media for items beyond the
  //          current metadata boundary (e.g., click item 20 when only 20 items
  //          exist → "after" batch gets clamped to just item 20), the remaining
  //          items (21-25) can't be fetched until their metadata arrives.
  //          This effect detects when metadata expands and fills any media gaps
  //          in a ±6 window around the current active item.
  // EXAMPLE: User clicks item 20, metadata had 20 items → only item-020 fetched.
  //          Metadata auto-loads items 21-40 → this effect runs and fills 021-025.
  useEffect(() => {
    const currentActiveId = activeItemIdRef.current;
    if (!currentActiveId || metadataItems.length === 0) return;

    // GUARD: Only run when metadata has ACTUALLY expanded (not on every render)
    // This prevents the effect from firing on every activeItemId change
    if (metadataItems.length <= prevMetadataLengthRef.current) return;
    prevMetadataLengthRef.current = metadataItems.length;

    const activeIndex = metadataItems.findIndex(
      (item) => item.id === currentActiveId
    );
    if (activeIndex < 0) return;

    // Check if there are unfilled media gaps around the active item
    const rangeStart = Math.max(0, activeIndex - SIDEBAR_PREFETCH_BEFORE);
    const rangeEnd = Math.min(
      metadataItems.length - 1,
      activeIndex + SIDEBAR_PREFETCH_AFTER - 1
    );

    let hasGaps = false;
    for (let i = rangeStart; i <= rangeEnd; i++) {
      if (
        !loadedMediaIdsRef.current.has(metadataItems[i].id) &&
        !inFlightMediaIdsRef.current.has(metadataItems[i].id)
      ) {
        hasGaps = true;
        break;
      }
    }

    if (hasGaps) {
      console.log(
        `%c[METADATA EXPAND GAP-FILL]%c Metadata expanded to ${metadataItems.length} items → filling media gaps around item ${activeIndex + 1} (range ${rangeStart + 1}–${rangeEnd + 1})`,
        "color: #FFD54F; font-weight: bold",
        "color: inherit"
      );
      ensureMediaForRange(rangeStart, rangeEnd);
    }
    // NOTE: We intentionally exclude activeItemId from deps — we read it from
    // activeItemIdRef to avoid re-running on every scroll. This effect should
    // ONLY fire when metadataItems.length changes (new metadata batch arrived).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadataItems, ensureMediaForRange]);

  // --- RENDER ---
  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ background: "var(--zeros-bg1)" }}
    >
      {/* ============================
          MAIN FEED EXPERIENCE
          ============================ */}
      <FeedExperience
        mediaItems={mediaItems}
        activeItemId={activeItemId}
        metadataItems={metadataItems}
        hasMoreMetadata={hasMoreMetadata}
        loadingMoreMetadata={loadingMoreMetadata}
        onItemClick={handleItemClick}
        onItemActive={handleItemActive}
        onLoadMoreMetadata={loadMoreMetadata}
      />
    </div>
  );
}