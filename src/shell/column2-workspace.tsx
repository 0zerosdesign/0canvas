// ──────────────────────────────────────────────────────────
// Column 2 — Agent Workspace
// ──────────────────────────────────────────────────────────
//
// Phase 1B-d: Chat tab now mounts the real AIChatPanel — the
// same component Column 3's right-panel-slot used in Phase 0.
// Git / Terminal / Env / Todo remain placeholders until 1C.
//
// Tab state persists within a session but resets on reload,
// which is fine: the underlying data (chat thread, git index,
// env files) is owned by the workspace store or the filesystem,
// not by the tab itself.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  GitBranch,
  TerminalSquare,
  KeyRound,
  ListChecks,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { AIChatPanel } from "../0canvas/panels/ai-chat-panel";
import { TerminalPanel } from "./terminal-panel";
import { EnvPanel } from "./env-panel";
import { TodoPanel } from "./todo-panel";
import { GitPanel } from "./git-panel";
import { MissionPanel } from "./mission-panel";
import { useWorkspace } from "../0canvas/store/store";
import { Button } from "../0canvas/ui";

type TabId = "chat" | "git" | "terminal" | "env" | "todo" | "mission";

const TABS: Array<{
  id: TabId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "terminal", label: "Terminal", icon: TerminalSquare },
  { id: "env", label: "Env", icon: KeyRound },
  { id: "todo", label: "Todo", icon: ListChecks },
  { id: "mission", label: "Mission", icon: Sparkles },
];

const TAB_PLACEHOLDERS: Partial<Record<TabId, { title: string; body: string }>> = {};

export function Column2Workspace() {
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

  // ⌘1..⌘5 → jump to the nth tab. Not fired if any modifier beyond the
  // primary meta/ctrl is held so this doesn't clobber xterm's Cmd+Shift+
  // shortcuts inside the Terminal tab.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey || e.altKey) return;
      const idx = ["1", "2", "3", "4", "5"].indexOf(e.key);
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
    <section className="oc-column-2" aria-label="Agent Workspace">
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
      </nav>

      <div
        className={`oc-column-2__body ${
          activeTab === "chat" ? "is-chat" : ""
        } ${activeTab === "terminal" ? "is-terminal" : ""} ${
          activeTab === "env" ? "is-env" : ""
        } ${activeTab === "todo" ? "is-todo" : ""} ${
          activeTab === "git" ? "is-git" : ""
        } ${activeTab === "mission" ? "is-mission" : ""}`}
        role="tabpanel"
      >
        {/* AIChatPanel's CSS is scoped under [data-0canvas-root]
            (same injected stylesheet as Column 3). Wrap it in a root
            marker so its styles apply here too. */}
        {activeTab === "chat" && (
          <div data-0canvas-root="" className="oc-column-2__chat-root">
            <AIChatPanel key={chatKey} />
          </div>
        )}
        {activeTab === "terminal" && <TerminalPanel />}
        {activeTab === "env" && <EnvPanel />}
        {activeTab === "todo" && <TodoPanel />}
        {activeTab === "git" && <GitPanel />}
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
