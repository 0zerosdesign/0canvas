import React, { useState, useEffect, useRef, useCallback } from "react";
import { useWorkspace, findElement } from "../store/store";
import {
  downloadProjectFile,
  importProjectFile,
  buildCurrentProjectFile,
} from "../format/oc-project-store";
import { projectFileToState } from "../format/oc-project";
import { copyToClipboard } from "../utils/clipboard";

// ── Types ────────────────────────────────────────────────────

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

// ── Fuzzy filter ─────────────────────────────────────────────

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ── Command Palette Component ────────────────────────────────

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useWorkspace();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Build command list ──
  const buildCommands = useCallback((): Command[] => {
    const cmds: Command[] = [];

    // Modes
    cmds.push({
      id: "mode-design",
      label: "Switch to Design",
      category: "Modes",
      action: () => dispatch({ type: "SET_ACTIVE_PAGE", page: "design" }),
    });
    cmds.push({
      id: "mode-settings",
      label: "Switch to Settings",
      category: "Modes",
      action: () => dispatch({ type: "SET_ACTIVE_PAGE", page: "settings" }),
    });

    // Panel toggles
    cmds.push({
      id: "toggle-layers",
      label: "Toggle Layers Panel",
      shortcut: "L",
      category: "Panels",
      action: () => dispatch({ type: "TOGGLE_STYLE_PANEL" }),
    });
    cmds.push({
      id: "toggle-style",
      label: "Toggle Style Panel",
      shortcut: "S",
      category: "Panels",
      action: () => dispatch({ type: "TOGGLE_STYLE_PANEL" }),
    });

    // Tools
    cmds.push({
      id: "toggle-inspector",
      label: "Toggle Inspector",
      shortcut: "I",
      category: "Tools",
      action: () => dispatch({ type: "TOGGLE_INSPECTOR" }),
    });

    // Actions
    cmds.push({
      id: "export-0c",
      label: "Export .0c File",
      category: "Actions",
      action: async () => {
        try {
          const file = await buildCurrentProjectFile(
            state.ocProject,
            state.variants,
            state.feedbackItems,
            state.currentRoute,
          );
          downloadProjectFile(file);
        } catch (err) {
          console.warn("[CommandPalette] Export failed:", err);
        }
      },
    });
    cmds.push({
      id: "import-0c",
      label: "Import .0c File",
      category: "Actions",
      action: async () => {
        const file = await importProjectFile();
        if (file) {
          const { project, variants, feedbackItems } = projectFileToState(file);
          dispatch({ type: "LOAD_FROM_OC_FILE", file, project, variants, feedbackItems });
        }
      },
    });
    cmds.push({
      id: "copy-css",
      label: "Copy CSS of Selected Element",
      category: "Actions",
      action: () => {
        if (state.selectedElementId) {
          const el = findElement(state.elements, state.selectedElementId);
          if (el) {
            const css = Object.entries(el.styles)
              .map(([k, v]) => `  ${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
              .join("\n");
            copyToClipboard(`${el.selector} {\n${css}\n}`);
          }
        }
      },
    });

    // Navigation
    cmds.push({
      id: "nav-settings",
      label: "Open Settings",
      category: "Navigation",
      action: () => dispatch({ type: "SET_ACTIVE_PAGE", page: "settings" }),
    });
    cmds.push({
      id: "nav-design",
      label: "Open Design Canvas",
      category: "Navigation",
      action: () => dispatch({ type: "SET_ACTIVE_PAGE", page: "design" }),
    });

    return cmds;
  }, [state, dispatch]);

  const commands = buildCommands();

  // ── Filter commands ──
  const filtered = query
    ? commands.filter((cmd) => fuzzyMatch(query, cmd.label) || fuzzyMatch(query, cmd.category))
    : commands;

  const visible = filtered.slice(0, 10);

  // ── Group by category ──
  const grouped = visible.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  // ── Keep active index in bounds ──
  useEffect(() => {
    if (activeIndex >= visible.length) {
      setActiveIndex(Math.max(0, visible.length - 1));
    }
  }, [visible.length, activeIndex]);

  // ── Scroll active item into view ──
  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-cmd-index="${activeIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // ── Execute command ──
  const execute = useCallback(
    (cmd: Command) => {
      onClose();
      requestAnimationFrame(() => cmd.action());
    },
    [onClose],
  );

  // ── Keyboard handling ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (visible[activeIndex]) execute(visible[activeIndex]);
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [visible, activeIndex, execute, onClose],
  );

  // ── Auto-focus ──
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Close on backdrop click ──
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  let globalIdx = 0;

  return (
    <div
      className="oc-cmd-overlay"
      data-0canvas="command-palette"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="oc-cmd-panel">
        <input
          ref={inputRef}
          className="oc-cmd-input"
          placeholder="Type a command..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
        />
        <div className="oc-cmd-divider" />
        <div className="oc-cmd-list" ref={listRef}>
          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category}>
              <div className="oc-cmd-category">{category}</div>
              {cmds.map((cmd) => {
                const idx = globalIdx++;
                return (
                  <div
                    key={cmd.id}
                    data-cmd-index={idx}
                    className={`oc-cmd-item${idx === activeIndex ? " is-active" : ""}`}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <span className="oc-cmd-label">{cmd.label}</span>
                    {cmd.shortcut && (
                      <span className="oc-cmd-kbd">{cmd.shortcut}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {visible.length === 0 && (
            <div className="oc-cmd-empty">No commands found</div>
          )}
        </div>
      </div>
    </div>
  );
}
