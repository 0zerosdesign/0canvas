// ============================================
// COMPONENT: FilterPanel
// PURPOSE: Dropdown filter panel that appears below the sidebar header
//          when the user clicks the filter (Settings2) icon.
//
// BEHAVIOR:
//   - Displays a "Category" heading with tag-style filter options
//   - Single-select: clicking a tag selects it (and deselects any previous)
//   - Clicking an already-selected tag deselects it (clears filter)
//   - When the panel has too many filters to fit, it becomes scrollable
//   - The panel sits between the header and the active item
//
// MOCK DATA:
//   Categories are hardcoded for now. In production, these would come from
//   the Directus CMS backend via API.
//
// USED IN: FeedExperience (left sidebar, when filter is open)
// ============================================

// --- MOCK FILTER CATEGORIES ---
// Placeholder categories for a content discovery / learning platform.
// Each is a string label displayed as a tag pill.
const FILTER_CATEGORIES: string[] = [
  "Technology",
  "Design",
  "Science",
  "Business",
  "Health",
  "Education",
  "Arts",
  "Finance",
  "Engineering",
  "Philosophy",
  "Marketing",
  "Psychology",
];

interface FilterPanelProps {
  /** Currently selected filter (null if none) */
  selectedFilter: string | null;
  /** Called when a filter tag is clicked */
  onSelectFilter: (filter: string | null) => void;
}

export function FilterPanel({
  selectedFilter,
  onSelectFilter,
}: FilterPanelProps) {
  return (
    <div className="zeros-filter-panel zeros-scroll-hidden">
      {/* Category heading */}
      <p className="zeros-filter-panel-heading">Category</p>

      {/* Tag grid — each category as a pill button */}
      <div className="zeros-filter-panel-tags">
        {FILTER_CATEGORIES.map((category) => {
          const isSelected = selectedFilter === category;
          return (
            <button
              key={category}
              className={`zeros-filter-tag${isSelected ? " selected" : ""}`}
              onClick={() => {
                // Toggle: clicking the already-selected filter clears it
                onSelectFilter(isSelected ? null : category);
              }}
            >
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
}
