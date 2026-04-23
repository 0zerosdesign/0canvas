// ============================================
// COMPONENT: MobileTopBar
// PURPOSE: Sticky top bar for mobile (≤640px).
//          Shows logo + filter icon.
// USED IN: FeedExperience (mobile breakpoint only)
// ============================================

import { Settings2 } from "lucide-react";
import { AuthButton } from "../auth/AuthButton";

interface MobileTopBarProps {
  onFilterClick?: () => void;
  isFilterOpen?: boolean;
}

export function MobileTopBar({ onFilterClick, isFilterOpen }: MobileTopBarProps) {
  return (
    <div className="zeros-mobile-topbar">
      {/* Logo */}
      <span className="zeros-mobile-logo">zero research</span>

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {/* Filter icon */}
        <button
          className={`zeros-filter-btn${isFilterOpen ? " is-open" : ""}`}
          aria-label="Filter"
          onClick={onFilterClick}
        >
          <Settings2 size={16} strokeWidth={1.8} />
        </button>

        <AuthButton />
      </div>
    </div>
  );
}
