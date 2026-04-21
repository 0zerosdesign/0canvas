// ============================================================
// ActivityBar — 48px vertical icon-only primary nav.
//
// Cursor/VSCode pattern. Each entry switches the Sidebar view.
// Footer pinned to bottom: Settings.
// ============================================================
import React from "react";
import {
  FolderGit2,
  MessageSquare,
  Globe,
  Search,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { Button, Tooltip } from "../0canvas/ui";
import { useWorkspace } from "../0canvas/store/store";

export type ActivityView = "projects" | "chats" | "ports" | "search" | "settings";

interface ActivityBarProps {
  active: ActivityView;
  onChange: (view: ActivityView) => void;
}

const TOP_ITEMS: Array<{ id: ActivityView; label: string; icon: LucideIcon }> = [
  { id: "projects", label: "Projects", icon: FolderGit2 },
  { id: "chats",    label: "Chats",    icon: MessageSquare },
  { id: "ports",    label: "Ports",    icon: Globe },
  { id: "search",   label: "Search",   icon: Search },
];

export function ActivityBar({ active, onChange }: ActivityBarProps) {
  const { state, dispatch } = useWorkspace();
  const openSettings = () => {
    dispatch({ type: "SET_ACTIVE_PAGE", page: "settings" });
  };
  const closeSettings = () => {
    dispatch({ type: "SET_ACTIVE_PAGE", page: "design" });
  };
  const inSettings = state.activePage === "settings";

  return (
    <nav className="oc-activitybar" aria-label="Primary navigation">
      <ul className="oc-activitybar__list">
        {TOP_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id && !inSettings;
          return (
            <li key={id}>
              <Tooltip label={label} side="right">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  className="oc-activitybar__btn"
                  data-active={isActive ? "true" : "false"}
                  onClick={() => {
                    if (inSettings) closeSettings();
                    onChange(id);
                  }}
                  aria-label={label}
                  aria-pressed={isActive}
                >
                  <Icon size={16} />
                </Button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      <ul className="oc-activitybar__list oc-activitybar__list--footer">
        <li>
          <Tooltip label="Settings" side="right">
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              className="oc-activitybar__btn"
              data-active={inSettings ? "true" : "false"}
              onClick={() => (inSettings ? closeSettings() : openSettings())}
              aria-label="Settings"
              aria-pressed={inSettings}
            >
              <SettingsIcon size={16} />
            </Button>
          </Tooltip>
        </li>
      </ul>
    </nav>
  );
}
