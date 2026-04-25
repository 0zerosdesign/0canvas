// ──────────────────────────────────────────────────────────
// Column 3 — Design canvas + IDE workspace tabs
// ──────────────────────────────────────────────────────────
//
// Column 3 is the primary work surface. It hosts:
//   Design   — the full EngineWorkspace (ReactFlow canvas,
//              inspector, themes). Phase 1-4 UI lives here.
//   Git      — repo status, branches, commits (GitPanel)
//   Terminal — embedded xterm.js sessions (TerminalPanel)
//   Env      — .env editor (EnvPanel)
//   Todo     — markdown todo tracker (TodoPanel)
//
// Moving Git/Terminal/Env/Todo here (from Column 2) frees
// Column 2 to focus on agent conversations. The IDE tools
// get the wide canvas they need (80-character lines, diff
// views, multi-pane terminals) and the chat stays compact.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  Sparkles,
  GitBranch,
  TerminalSquare,
  KeyRound,
  ListChecks,
  PanelRightClose,
  type LucideIcon,
} from "lucide-react";
import { EngineWorkspace } from "../zeros/engine/zeros-engine";
import { GitPanel } from "./git-panel";
import { TerminalPanel } from "./terminal-panel";
import { EnvPanel } from "./env-panel";
import { TodoPanel } from "./todo-panel";
import { Button } from "../zeros/ui";

type Col3Tab = "design" | "git" | "terminal" | "env" | "todo";

const TABS: Array<{ id: Col3Tab; label: string; icon: LucideIcon }> = [
  { id: "design", label: "Design", icon: Sparkles },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "terminal", label: "Terminal", icon: TerminalSquare },
  { id: "env", label: "Env", icon: KeyRound },
  { id: "todo", label: "Todo", icon: ListChecks },
];

export function Column3({ onCollapse }: { onCollapse?: () => void } = {}) {
  const [tab, setTab] = useState<Col3Tab>("design");

  // ⌘6..⌘9 + ⌘0 → jump between Column-3 tabs. Matches Col 2's ⌘1-5
  // pattern without clobbering it (tabs there own 1-5).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey || e.altKey) return;
      const map: Record<string, Col3Tab> = {
        "6": "design",
        "7": "git",
        "8": "terminal",
        "9": "env",
        "0": "todo",
      };
      const next = map[e.key];
      if (!next) return;
      e.preventDefault();
      setTab(next);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // The Zeros engine stylesheet scopes an aggressive reset to
  // [data-Zeros-root] that forces font-size, letter-spacing,
  // text-transform etc. to `inherit !important` on every descendant.
  // That reset is required for EngineWorkspace (which still uses the
  // design workspace CSS reset) but it wipes typography
  // on the IDE panels (Git/Env/Todo/Terminal) whose CSS lives in
  // app-shell.css. Apply the attribute only while the Design tab is
  // active so the other panels keep their own typography.
  return (
    <div className="oc-column-3">
      <nav className="oc-column-3__tabs" role="tablist" data-tauri-drag-region>
        {TABS.map(({ id, label, icon: Icon }, idx) => {
          const isActive = tab === id;
          return (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              role="tab"
              aria-selected={isActive}
              className={`oc-column-3__tab ${isActive ? "is-active" : ""}`}
              onClick={() => setTab(id)}
              title={`${label}  ⌘${(idx + 6) % 10}`}
            >
              <Icon size={14} />
              <span>{label}</span>
            </Button>
          );
        })}
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="oc-column-3__collapse"
            onClick={onCollapse}
            title="Hide Panel  ⌥⌘B"
            aria-label="Hide design panel"
          >
            <PanelRightClose size={14} />
          </Button>
        )}
      </nav>

      <div
        className={`oc-column-3__body is-${tab}`}
        role="tabpanel"
        data-Zeros-root={tab === "design" ? "" : undefined}
      >
        {tab === "design" && <EngineWorkspace />}
        {tab === "git" && <GitPanel />}
        {tab === "terminal" && <TerminalPanel />}
        {tab === "env" && <EnvPanel />}
        {tab === "todo" && <TodoPanel />}
      </div>
    </div>
  );
}
