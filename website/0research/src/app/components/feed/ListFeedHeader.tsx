// ============================================
// COMPONENT: ListFeedHeader
// PURPOSE: Fixed header at the top of the left sidebar (list feed container).
//          Shows the current page context ("Explore") with an animated gradient
//          pill tag and a filter/settings icon (Settings2 from Lucide).
//          When a filter is selected, a chip appears below the header row.
//
// REF FORWARDING:
//   Accepts a forwarded ref (via React.forwardRef) that attaches to the root
//   wrapper div (.zeros-sidebar-header). FeedExperience uses a ResizeObserver
//   on this ref to dynamically update scroll-padding-top on the sidebar,
//   ensuring no list item is ever clipped by the header — even when the header
//   grows taller due to filter chips (one or many in the future).
//
// GRADIENT:
//   Shader-inspired flowing gradient using multiple layered backgrounds.
//   Colors: deep slate blue → dark burgundy → muted indigo, all very dark
//   and subtle for the dark theme. Two animation layers create organic movement:
//   - Primary: slow diagonal flow (15s cycle)
//   - Secondary: radial pulse that shifts position (12s cycle)
//   The result is a living, breathing gradient that feels premium and soothing.
//
// FILTER CHIP:
//   When a filter is active (selectedFilter is not null), a small pill chip
//   appears below the header row showing the selected filter name with an ×
//   button to clear it. This chip persists whether the filter panel is open or not.
//   In the future, multiple chips may be shown — the ResizeObserver approach
//   ensures scroll-padding-top always matches the actual header height.
//
// RESPONSIVE:
//   - Mobile (<640px): sidebar hidden entirely
//   - All other breakpoints: full layout — "Explore" pill + filter icon side by side
//     at 15% width (180-220px)
//
// STICKY: position: sticky + top: 0 inside the scrollable sidebar
// ============================================

import { forwardRef } from "react";
import { Settings2, X } from "lucide-react";
import { AuthButton } from "../auth/AuthButton";

interface ListFeedHeaderProps {
  /** Current page/section title displayed in the gradient pill */
  title?: string;
  /** Whether the filter panel is currently open */
  isFilterOpen?: boolean;
  /** Callback when the filter icon is clicked */
  onFilterClick?: () => void;
  /** Currently selected filter name (null if none) */
  selectedFilter?: string | null;
  /** Callback to clear the selected filter */
  onClearFilter?: () => void;
  /** Optional extra CSS class(es) appended to the root element (e.g. entrance animation) */
  className?: string;
}

export const ListFeedHeader = forwardRef<HTMLDivElement, ListFeedHeaderProps>(
  function ListFeedHeader(
    {
      title = "Explore",
      isFilterOpen = false,
      onFilterClick,
      selectedFilter = null,
      onClearFilter,
      className,
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={`zeros-sidebar-header${className ? ` ${className}` : ""}`}
      >
        {/* Top row: gradient pill + filter icon */}
        <div className="flex items-center gap-2 w-full">
          {/* Gradient pill tag — the animated flowing gradient background */}
          <div className="zeros-explore-tag">
            {/* Gradient animation layer — sits behind the text */}
            <div className="zeros-explore-gradient" aria-hidden="true" />
            {/* Subtle inner border for depth */}
            <div className="zeros-explore-border" aria-hidden="true" />
            {/* Logo text */}
            <span className="zeros-explore-text">zero research</span>
          </div>

          {/* Filter/settings icon — visible on wider screens.
              Visual feedback: slightly brighter when filter panel is open. */}
          <button
            className={`zeros-filter-btn${isFilterOpen ? " is-open" : ""}`}
            aria-label="Filter settings"
            onClick={onFilterClick}
          >
            <Settings2 size={16} strokeWidth={1.8} />
          </button>

          <AuthButton />
        </div>

        {/* Selected filter chip — shown below the header row when a filter is active.
            Future-proof: multiple chips can stack here; ResizeObserver in FeedExperience
            will automatically adjust scroll-padding-top to match the new header height. */}
        {selectedFilter && (
          <div className="zeros-filter-chip-row">
            <button
              className="zeros-filter-chip"
              onClick={onClearFilter}
              aria-label={`Clear filter: ${selectedFilter}`}
            >
              <span>{selectedFilter}</span>
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }
);
