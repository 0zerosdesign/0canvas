// ──────────────────────────────────────────────────────────
// Todo Panel — markdown-backed at <project>/.0canvas/todo.md
// ──────────────────────────────────────────────────────────
//
// UI surfaces only the `- [ ]` / `- [x]` lines as interactive
// checkboxes. Any other markdown (headings, prose, blank lines)
// in the file is preserved verbatim across edits so the file
// stays writable by both this UI and the user's editor / an
// agent.
//
// Editing model:
//   - Toggle checkbox → flips `- [ ]` ↔ `- [x]` in raw.
//   - Edit text → patches the line in raw.
//   - Add item → appends a new `- [ ] ` line.
//   - Remove item → deletes that line from raw.
// Everything debounces into a single write; the draft stays in
// memory between keystrokes so typing stays snappy.
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, RefreshCw, CheckSquare, Square } from "lucide-react";
import {
  loadTodoFile,
  saveTodoFile,
  type TodoFile,
  type TodoItem,
} from "../native/tauri-events";

function isTauriWebview(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type LineModel =
  | { kind: "todo"; done: boolean; text: string; indent: string; marker: "-" | "*" }
  | { kind: "other"; raw: string };

function parseLine(raw: string): LineModel {
  const indentMatch = raw.match(/^(\s*)(.*)$/);
  const indent = indentMatch?.[1] ?? "";
  const rest = indentMatch?.[2] ?? raw;
  let marker: "-" | "*" | null = null;
  if (rest.startsWith("- ")) marker = "-";
  else if (rest.startsWith("* ")) marker = "*";
  if (marker) {
    const after = rest.slice(2);
    if (after[0] === "[" && after[2] === "]") {
      const c = after[1];
      if (c === " " || c === "x" || c === "X") {
        return {
          kind: "todo",
          done: c !== " ",
          text: after.slice(3).trimStart(),
          indent,
          marker,
        };
      }
    }
  }
  return { kind: "other", raw };
}

function serializeLine(line: LineModel): string {
  if (line.kind === "other") return line.raw;
  const box = line.done ? "[x]" : "[ ]";
  return `${line.indent}${line.marker} ${box} ${line.text}`;
}

function buildRaw(lines: LineModel[]): string {
  return lines.map(serializeLine).join("\n");
}

export function TodoPanel() {
  const [lines, setLines] = useState<LineModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const file = await loadTodoFile();
      if (!file) {
        setLines([]);
        return;
      }
      setLines(file.raw.length === 0 ? [] : file.raw.split("\n").map(parseLine));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Debounced write — 400ms after the last keystroke / toggle / add / remove.
  const scheduleSave = useCallback((next: LineModel[]) => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        await saveTodoFile(buildRaw(next));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    }, 400);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const todoIndices = useMemo(
    () =>
      lines
        .map((l, i) => (l.kind === "todo" ? i : -1))
        .filter((i) => i >= 0),
    [lines],
  );

  const updateLine = (lineIdx: number, patch: Partial<LineModel>) => {
    setLines((prev) => {
      const next = prev.map((l, i) =>
        i === lineIdx
          ? ({ ...l, ...patch } as LineModel)
          : l,
      );
      scheduleSave(next);
      return next;
    });
  };

  const addItem = () => {
    setLines((prev) => {
      const next: LineModel[] = [
        ...prev,
        { kind: "todo", done: false, text: "", indent: "", marker: "-" },
      ];
      scheduleSave(next);
      return next;
    });
  };

  const removeLine = (lineIdx: number) => {
    setLines((prev) => {
      const next = prev.filter((_, i) => i !== lineIdx);
      scheduleSave(next);
      return next;
    });
  };

  if (!isTauriWebview()) {
    return (
      <div className="oc-todo__empty">
        Todo editor requires the Mac app (pnpm tauri:dev).
      </div>
    );
  }

  if (loading) {
    return <div className="oc-todo__empty">Loading .0canvas/todo.md…</div>;
  }

  const openCount = todoIndices.reduce(
    (acc, i) => acc + (lines[i].kind === "todo" && !(lines[i] as any).done ? 1 : 0),
    0,
  );

  return (
    <div className="oc-todo">
      <header className="oc-todo__header">
        <h3 className="oc-todo__title">
          Todo
          <span className="oc-todo__count">{openCount} open</span>
        </h3>
        <div className="oc-todo__header-actions">
          {saving && <span className="oc-todo__saving">saving…</span>}
          <button
            className="oc-todo__icon-btn"
            onClick={refresh}
            title="Reload from disk"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </header>

      <div className="oc-todo__list">
        {todoIndices.length === 0 && (
          <p className="oc-todo__empty-rows">
            No tasks yet. Click <strong>Add task</strong> or have the agent
            write into <code>.0canvas/todo.md</code>.
          </p>
        )}
        {todoIndices.map((i) => {
          const line = lines[i] as LineModel & { kind: "todo" };
          return (
            <div key={i} className={`oc-todo__row ${line.done ? "is-done" : ""}`}>
              <button
                className="oc-todo__check"
                onClick={() => updateLine(i, { done: !line.done })}
                title={line.done ? "Mark open" : "Mark done"}
              >
                {line.done ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>
              <input
                className="oc-todo__text"
                value={line.text}
                placeholder="task description"
                onChange={(e) => updateLine(i, { text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  } else if (e.key === "Backspace" && line.text.length === 0) {
                    e.preventDefault();
                    removeLine(i);
                  }
                }}
              />
              <button
                className="oc-todo__icon-btn is-danger"
                onClick={() => removeLine(i)}
                title="Delete task"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <footer className="oc-todo__footer">
        <button className="oc-todo__add" onClick={addItem}>
          <Plus size={13} /> Add task
        </button>
        <span className="oc-todo__path">.0canvas/todo.md</span>
      </footer>

      {error && <div className="oc-todo__error">{error}</div>}
    </div>
  );
}
