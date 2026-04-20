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

import React, { useState } from "react";
import {
  MessageSquare,
  GitBranch,
  TerminalSquare,
  KeyRound,
  ListChecks,
} from "lucide-react";
import { AIChatPanel } from "../0canvas/panels/ai-chat-panel";

type TabId = "chat" | "git" | "terminal" | "env" | "todo";

const TABS: Array<{
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "terminal", label: "Terminal", icon: TerminalSquare },
  { id: "env", label: "Env", icon: KeyRound },
  { id: "todo", label: "Todo", icon: ListChecks },
];

const TAB_PLACEHOLDERS: Partial<Record<TabId, { title: string; body: string }>> = {
  git: {
    title: "Git",
    body: "Phase 1C — git2-rs via Tauri IPC. Branch, stage, commit, push, pull.",
  },
  terminal: {
    title: "Terminal",
    body: "Phase 1C — tauri-plugin-pty + xterm.js. Shell in your project root.",
  },
  env: {
    title: "Env",
    body: "Phase 1C — native-fs .env editor with masked values and Add Variable.",
  },
  todo: {
    title: "Todo",
    body: "Phase 1C — markdown-backed at .0canvas/todo.md, agent-editable.",
  },
};

export function Column2Workspace() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");

  return (
    <section className="oc-column-2" aria-label="Agent Workspace">
      <nav className="oc-column-2__tabs" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={isActive}
              className={`oc-column-2__tab ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveTab(id)}
              title={label}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div
        className={`oc-column-2__body ${
          activeTab === "chat" ? "is-chat" : ""
        }`}
        role="tabpanel"
      >
        {activeTab === "chat" ? (
          <AIChatPanel />
        ) : (
          (() => {
            const p = TAB_PLACEHOLDERS[activeTab];
            return p ? (
              <div className="oc-column-2__placeholder">
                <h2>{p.title}</h2>
                <p>{p.body}</p>
              </div>
            ) : null;
          })()
        )}
      </div>
    </section>
  );
}
