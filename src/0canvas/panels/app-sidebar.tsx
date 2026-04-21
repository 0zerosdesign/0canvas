import React from "react";
import { PenTool, Palette, X, type LucideIcon } from "lucide-react";
import { useWorkspace, type WorkspacePage } from "../store/store";
import { Button } from "../ui";

const TABS: Array<{ id: WorkspacePage; label: string; icon: LucideIcon }> = [
  { id: "design", label: "Design", icon: PenTool },
  { id: "themes", label: "Themes", icon: Palette },
];

export function AppSidebar({ onClose }: { onClose?: () => void }) {
  const { state, dispatch } = useWorkspace();

  const setPage = (page: WorkspacePage) => {
    dispatch({ type: "SET_ACTIVE_PAGE", page });
  };

  return (
    <nav className="oc-page-tabs" role="tablist" data-0canvas="sidebar" data-tauri-drag-region>
      {onClose && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="oc-page-tab oc-page-tab--close"
          onClick={onClose}
          title="Close 0canvas"
        >
          <X size={14} />
        </Button>
      )}

      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = state.activePage === id;
        return (
          <Button
            key={id}
            variant="ghost"
            role="tab"
            aria-selected={isActive}
            className={`oc-page-tab ${isActive ? "is-active" : ""}`}
            onClick={() => setPage(id)}
            title={label}
          >
            <Icon size={14} />
            <span>{label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
