// ──────────────────────────────────────────────────────────
// Column 2 — Agent Workspace (Phase 1A scaffold)
// ──────────────────────────────────────────────────────────
//
// Tabbed panel that will host Chat / Git / Terminal / Env / Todo
// in subsequent phases:
//   - Phase 1B implements Chat (migrates ai-chat-panel into here)
//   - Phase 1C implements Git (git2-rs IPC), Terminal (tauri-plugin-pty +
//     xterm.js), Env (native fs), Todo (.0canvas/todo.md parser)
//
// For 1A-1 it renders the tab bar skeleton so the UI proportions
// are established and the layout reads as "three columns".
// ──────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  MessageSquare,
  GitBranch,
  TerminalSquare,
  KeyRound,
  ListChecks,
} from "lucide-react";

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

const TAB_PHASE: Record<TabId, string> = {
  chat: "Phase 1B — migrates today's AI chat panel into this tab.",
  git: "Phase 1C — git2-rs via Tauri IPC. Branch, stage, commit, push, pull.",
  terminal: "Phase 1C — tauri-plugin-pty + xterm.js. Shell in your project root.",
  env: "Phase 1C — native-fs .env editor with masked values and Add Variable.",
  todo: "Phase 1C — markdown-backed at .0canvas/todo.md, agent-editable.",
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

      <div className="oc-column-2__body" role="tabpanel">
        <div className="oc-column-2__placeholder">
          <h2>{TABS.find((t) => t.id === activeTab)?.label}</h2>
          <p>{TAB_PHASE[activeTab]}</p>
        </div>
      </div>
    </section>
  );
}
