import React from "react";
import { Palette, Settings, X } from "lucide-react";
import { useWorkspace, type WorkspacePage } from "../store/store";

export function AppSidebar({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useWorkspace();

  const setPage = (page: WorkspacePage) => {
    dispatch({ type: "SET_ACTIVE_PAGE", page });
  };

  return (
    <div className="oc-sidebar" data-0canvas="sidebar">
      {/* Top icons */}
      <div className="oc-sidebar-top">
        <button
          className="oc-sidebar-btn"
          onClick={onClose}
          title="Close 0canvas"
        >
          <X size={18} />
        </button>

        <div className="oc-sidebar-divider" />

        <button
          className={`oc-sidebar-btn ${state.activePage === "design" ? "is-active" : ""}`}
          onClick={() => setPage("design")}
          title="Design"
        >
          <Palette size={18} />
        </button>

        <button
          className={`oc-sidebar-btn ${state.activePage === "settings" ? "is-active" : ""}`}
          onClick={() => setPage("settings")}
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Bottom: logo */}
      <div className="oc-sidebar-bottom">
        <div className="oc-sidebar-logo" title="0canvas">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
