// ──────────────────────────────────────────────────────────
// Column 2 — Agent Workspace
// ──────────────────────────────────────────────────────────
//
// Col 2 hosts the conversation layer:
//   Chat     — AIChatPanel / ACP session for the active chat
//   Mission  — Mission-control panel for orchestrating multi-chat runs
//
// IDE tools (Git / Terminal / Env / Todo) live in Column 3
// where they have room to breathe.
//
// Tab state persists within a session but resets on reload,
// which is fine: the underlying data (chat thread, git index,
// env files) is owned by the workspace store or the filesystem,
// not by the tab itself.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  Sparkles,
  PanelRightOpen,
  type LucideIcon,
} from "lucide-react";
import { Column2ChatView } from "./column2-chat-view";
import { MissionPanel } from "./mission-panel";
import { useWorkspace } from "../zeros/store/store";
import { Button } from "../zeros/ui";

type TabId = "chat" | "mission";

const TABS: Array<{
  id: TabId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "mission", label: "Mission", icon: Sparkles },
];

const TAB_PLACEHOLDERS: Partial<Record<TabId, { title: string; body: string }>> = {};

export function Column2Workspace({
  col3Collapsed = false,
  onExpandCol3,
}: {
  col3Collapsed?: boolean;
  onExpandCol3?: () => void;
} = {}) {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const { state } = useWorkspace();
  // Remount AIChatPanel when the active chat changes so each thread
  // starts with a clean slate. Message persistence per-chat is a v0.2
  // concern (needs message array in the store).
  const chatKey = state.activeChatId ?? "default";

  // Phase 2-B: when InlineEdit or the feedback pill queues a chat
  // submission, flip to the Chat tab so the user sees it being sent.
  useEffect(() => {
    if (state.pendingChatSubmission && activeTab !== "chat") {
      setActiveTab("chat");
    }
  }, [state.pendingChatSubmission, activeTab]);

  // ⌘1 / ⌘2 → Chat / Mission. Column 3 owns ⌘6-0 for its own tabs.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey || e.altKey) return;
      const idx = ["1", "2"].indexOf(e.key);
      if (idx === -1) return;
      const tab = TABS[idx];
      if (!tab) return;
      e.preventDefault();
      setActiveTab(tab.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <section
      className={`oc-column-2 ${col3Collapsed ? "is-wide" : ""}`}
      aria-label="Agent Workspace"
    >
      <nav className="oc-column-2__tabs" role="tablist" data-tauri-drag-region>
        {TABS.map(({ id, label, icon: Icon }, idx) => {
          const isActive = activeTab === id;
          return (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              role="tab"
              aria-selected={isActive}
              className={`oc-column-2__tab ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveTab(id)}
              title={`${label}  ⌘${idx + 1}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Button>
          );
        })}
        {col3Collapsed && onExpandCol3 && (
          <Button
            variant="ghost"
            size="sm"
            className="oc-column-2__show-panel"
            onClick={onExpandCol3}
            title="Show Panel  ⌥⌘B"
            aria-label="Show design panel"
          >
            <PanelRightOpen size={14} />
            <span>Show Panel</span>
            <kbd className="oc-column-2__show-panel-kbd" aria-hidden="true">⌥⌘B</kbd>
          </Button>
        )}
      </nav>

      <div
        className={`oc-column-2__body ${
          activeTab === "chat" ? "is-chat" : ""
        } ${activeTab === "mission" ? "is-mission" : ""}`}
        role="tabpanel"
      >
        {/* ACP session UI is scoped under [data-Zeros-root] for
            engine-injected tokens. Remount per-chat via the chatKey
            so state flips cleanly when the user switches chats. */}
        {activeTab === "chat" && (
          <div data-Zeros-root="" className="oc-column-2__chat-root">
            <Column2ChatView key={chatKey} />
          </div>
        )}
        {activeTab === "mission" && <MissionPanel />}
        {(() => {
          const p = TAB_PLACEHOLDERS[activeTab];
          return p ? (
            <div className="oc-column-2__placeholder">
              <h2>{p.title}</h2>
              <p>{p.body}</p>
            </div>
          ) : null;
        })()}
      </div>
    </section>
  );
}
