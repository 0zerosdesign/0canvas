// ──────────────────────────────────────────────────────────
// IPC commands: todo
// ──────────────────────────────────────────────────────────
//
// Markdown-backed todo list at <project>/.zeros/todo.md. Checkbox
// lines (`- [ ]` / `- [x]`, or `*` variants) are actionable items;
// every other line is preserved verbatim on round-trip so headings,
// blanks, and notes survive editing.
// ──────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { currentRoot } from "../../sidecar";
import type { CommandHandler } from "../router";

interface TodoItemPayload {
  line: number;
  done: boolean;
  text: string;
}

interface TodoFilePayload {
  path: string;
  raw: string;
  items: TodoItemPayload[];
}

function resolveRoot(args: Record<string, unknown>): string {
  const explicit = typeof args.cwd === "string" ? args.cwd.trim() : "";
  if (explicit) return explicit;
  const fallback = currentRoot();
  if (!fallback) throw new Error("no project root");
  return fallback;
}

function todoPath(root: string): string {
  return path.join(root, ".zeros", "todo.md");
}

/** Parse one checkbox line. Matches parse_todo_line() in todo.rs:
 *    "- [ ] task"  → { done:false, text:"task" }
 *    "- [x] task"  → { done:true,  text:"task" }
 *    "* [X] task"  → same as above (case-insensitive, allows * marker)
 *  Leading whitespace on the source line is NOT returned in `text`
 *  so the UI doesn't drift indentation on every round-trip. */
function parseTodoLine(line: string, idx: number): TodoItemPayload | null {
  const trimmed = line.replace(/^\s+/, "");
  if (trimmed.length < 6) return null;

  let rest: string;
  if (trimmed.startsWith("- ")) rest = trimmed.slice(2);
  else if (trimmed.startsWith("* ")) rest = trimmed.slice(2);
  else return null;

  if (!rest.startsWith("[")) return null;

  const inner = rest.charAt(1);
  let done: boolean;
  if (inner === " ") done = false;
  else if (inner === "x" || inner === "X") done = true;
  else return null;

  if (rest.charAt(2) !== "]") return null;

  const after = rest.slice(3).replace(/^\s+/, "");
  return { line: idx, done, text: after };
}

export const loadTodoFile: CommandHandler = (args) => {
  const root = resolveRoot(args);
  const p = todoPath(root);
  let raw = "";
  try {
    raw = fs.readFileSync(p, "utf-8");
  } catch {
    // file may not exist yet -> treat as empty
  }
  const items: TodoItemPayload[] = [];
  // `.split(/\r?\n/)` would keep a final empty row; `.trimEnd()` avoids that.
  const lines = raw.split("\n");
  const hasTrailingNewline = raw.endsWith("\n");
  const iterLen = hasTrailingNewline ? lines.length - 1 : lines.length;
  for (let i = 0; i < iterLen; i++) {
    const item = parseTodoLine(lines[i], i);
    if (item) items.push(item);
  }
  const payload: TodoFilePayload = { path: p, raw, items };
  return payload;
};

export const saveTodoFile: CommandHandler = (args) => {
  const root = resolveRoot(args);
  const p = todoPath(root);
  const raw = String(args.raw ?? "");

  const parent = path.dirname(p);
  try {
    fs.mkdirSync(parent, { recursive: true });
  } catch (err) {
    throw new Error(
      `create_dir_all: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let content = raw;
  if (!content.endsWith("\n")) content += "\n";

  const tmp = p.replace(/\.md$/, ".md.zeros-tmp");
  try {
    fs.writeFileSync(tmp, content);
  } catch (err) {
    throw new Error(
      `write tmp: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  try {
    fs.renameSync(tmp, p);
  } catch (err) {
    throw new Error(
      `rename: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};
