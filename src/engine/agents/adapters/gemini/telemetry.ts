// ──────────────────────────────────────────────────────────
// Gemini CLI OpenTelemetry file tailer
// ──────────────────────────────────────────────────────────
//
// When spawned with:
//   GEMINI_TELEMETRY_ENABLED=true
//   GEMINI_TELEMETRY_TARGET=local
//   GEMINI_TELEMETRY_OUTFILE=<path>
// Gemini writes one JSON record per line of every internal event:
// agent requests/responses, tool calls (`gemini.api.tool_call`), user
// and model messages, etc. The schema is OpenTelemetry-ish with
// `resource.attributes`, `instrumentation_scope`, `body`, and
// `attributes` fields.
//
// This tailer watches the file, parses each new line, and translates
// tool-call events into SessionNotification so the UI gets pills.
// All other event types are logged silently (Phase 6.5 ships tool
// calls only; thought/text chunks already come from the PTY).
//
// ──────────────────────────────────────────────────────────

import * as fs from "node:fs";
import { randomUUID } from "node:crypto";

import type { ContentBlock, SessionNotification } from "../../types";

type Emit = (notification: SessionNotification) => void;

type ToolKind =
  | "read" | "edit" | "delete" | "move" | "search" | "web_search"
  | "execute" | "think" | "fetch" | "switch_mode"
  | "subagent" | "mcp" | "question" | "other";

export interface TelemetryTailerOptions {
  filePath: string;
  sessionId: string;
  emit: Emit;
  onUnknown?: (rec: unknown) => void;
}

export class GeminiTelemetryTailer {
  private readonly opts: TelemetryTailerOptions;
  private watcher: fs.FSWatcher | null = null;
  private offset = 0;
  private buffer = "";
  private stopped = false;
  /** Gemini tool-call-id (from `attributes.call_id`) → our internal
   *  tool_call_id. Links pre/in-progress/completed events. */
  private readonly toolCallIds = new Map<string, string>();
  /** Touch debounce: file writes fire rapidly; process once per tick. */
  private pending = false;

  constructor(opts: TelemetryTailerOptions) {
    this.opts = opts;
  }

  /** Begin watching. Safe to call multiple times — idempotent. */
  async start(): Promise<void> {
    if (this.watcher) return;
    // Ensure the file exists before watching (fs.watch throws on
    // missing files on some platforms).
    try {
      await fs.promises.writeFile(this.opts.filePath, "", { flag: "a" });
    } catch {
      // parent dir may not exist yet — caller responsible for mkdir.
      return;
    }
    try {
      this.watcher = fs.watch(this.opts.filePath, () => this.schedule());
    } catch {
      this.watcher = null;
    }
    // Initial drain in case Gemini wrote before the watcher attached.
    await this.drain();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.watcher) {
      try { this.watcher.close(); } catch {}
      this.watcher = null;
    }
  }

  private schedule(): void {
    if (this.pending || this.stopped) return;
    this.pending = true;
    setImmediate(() => {
      this.pending = false;
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    let fh: fs.promises.FileHandle | null = null;
    try {
      fh = await fs.promises.open(this.opts.filePath, "r");
      const stat = await fh.stat();
      if (stat.size <= this.offset) return;
      const len = stat.size - this.offset;
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, this.offset);
      this.offset = stat.size;
      this.buffer += buf.toString("utf-8");
      this.flushLines();
    } catch {
      /* file rotated or deleted — resume on next watch event */
    } finally {
      if (fh) await fh.close();
    }
  }

  private flushLines(): void {
    let nl = this.buffer.indexOf("\n");
    while (nl !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (line) this.parseLine(line);
      nl = this.buffer.indexOf("\n");
    }
  }

  private parseLine(line: string): void {
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }
    // Gemini's OpenTelemetry records carry a `body` or `name` that
    // identifies the event. Different versions use slightly
    // different shapes — handle both common layouts.
    const name =
      typeof rec.name === "string" ? (rec.name as string)
      : typeof rec.body === "string" ? (rec.body as string)
      : "";
    const attrs = isObj(rec.attributes)
      ? (rec.attributes as Record<string, unknown>)
      : {};

    if (/tool_call/i.test(name) || /function_call/i.test(name)) {
      this.onToolCallEvent(name, attrs);
      return;
    }
    this.opts.onUnknown?.(rec);
  }

  private onToolCallEvent(name: string, attrs: Record<string, unknown>): void {
    const callId =
      typeof attrs.call_id === "string" ? (attrs.call_id as string)
      : typeof attrs.tool_call_id === "string" ? (attrs.tool_call_id as string)
      : typeof attrs.id === "string" ? (attrs.id as string)
      : null;
    if (!callId) return;

    const toolName =
      typeof attrs.function_name === "string" ? (attrs.function_name as string)
      : typeof attrs.tool_name === "string" ? (attrs.tool_name as string)
      : "tool";

    // Event classes we care about. Gemini uses names like
    // `gemini.api.tool_call.start`, `...finish`, `...error`.
    const isStart = /start|request/.test(name);
    const isEnd = /finish|complete|success|end/.test(name);
    const isError = /error|fail/.test(name);

    const args = attrs.function_args ?? attrs.tool_input ?? attrs;

    if (isStart) {
      // Stage 8.3 — intercepts:
      //
      //   write_todos          → canonical `plan` notification (§2.3)
      //   enter_plan_mode      → canonical `mode_switch` banner (§2.7.6)
      //   exit_plan_mode       → canonical `mode_switch` banner (§2.7.6)
      //
      // None of these render as tool cards; they update other surfaces
      // of the chat. Returning early after the emit means we don't
      // also create a tool_call entry that would never get its
      // matching tool_call_update.
      if (/^write_todos$/i.test(toolName)) {
        const entries = parseGeminiTodos(args);
        if (entries.length > 0) {
          this.opts.emit({
            sessionId: this.opts.sessionId,
            update: { sessionUpdate: "plan", entries },
          });
        }
        return;
      }
      if (/^(enter|exit)_plan_mode$/i.test(toolName)) {
        const entering = /^enter/i.test(toolName);
        this.opts.emit({
          sessionId: this.opts.sessionId,
          update: {
            sessionUpdate: "mode_switch",
            axis: "phase",
            from: entering ? "execute" : "plan",
            to: entering ? "plan" : "execute",
            source: "agent",
            reason:
              isObj(args) && typeof args.reason === "string"
                ? (args.reason as string)
                : undefined,
            at: Date.now(),
          } as never,
        });
        return;
      }

      const toolCallId = randomUUID();
      this.toolCallIds.set(callId, toolCallId);
      const mergeKey = computeMergeKey(toolName, args);
      this.opts.emit({
        sessionId: this.opts.sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId,
          title: describeTool(toolName, args),
          kind: mapToolKind(toolName),
          status: "in_progress",
          rawInput: args,
          ...(mergeKey ? { mergeKey } : {}),
        },
      });
      return;
    }

    const toolCallId = this.toolCallIds.get(callId);
    if (!toolCallId) return;

    if (isEnd || isError) {
      const output = attrs.function_response
        ?? attrs.tool_output
        ?? attrs.response
        ?? null;
      const text = typeof output === "string" ? output : "";
      this.opts.emit({
        sessionId: this.opts.sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId,
          status: isError ? "failed" : "completed",
          rawOutput: output,
          content: text
            ? [{ type: "content", content: { type: "text", text } as ContentBlock }]
            : null,
        },
      });
      this.toolCallIds.delete(callId);
    }
  }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/** Map Gemini's tool names → canonical ToolKind. Names per §2.3 of
 *  the roadmap, observed in geminicli.com/docs/tools. The previous
 *  loose-regex map was misrouting `list_directory` → read and
 *  `google_web_search` → search; explicit cases here fix both. */
function mapToolKind(name: string): ToolKind {
  if (/^read_(file|many_files)$/i.test(name)) return "read";
  if (/^(replace|write_file)$/i.test(name)) return "edit";
  if (/^(grep_search|glob|list_directory)$/i.test(name)) return "search";
  if (/^run_shell_command$/i.test(name)) return "execute";
  if (/^web_fetch$/i.test(name)) return "fetch";
  if (/^google_web_search$/i.test(name)) return "web_search";
  if (/^ask_user$/i.test(name)) return "question";
  // §2.7.7 — activate_skill is conceptually a system-level chip, not
  // a tool card. We don't have a chip surface yet, so route to
  // switch_mode which renders as a banner — closest existing affordance.
  if (/^activate_skill$/i.test(name)) return "switch_mode";
  // MCP-prefixed names: convention varies, accept either. Goose-style
  // MCP UI payloads are deferred (Phase 2 polish per §2.4.12).
  if (/^mcp__/i.test(name) || /^mcp_/i.test(name)) return "mcp";
  return "other";
}

function describeTool(name: string, args: unknown): string {
  const a = isObj(args) ? args : {};
  switch (name) {
    case "read_file":
    case "read_many_files":
      return `Reading ${a.absolute_path ?? a.path ?? a.file_path ?? "file"}`;
    case "replace":
    case "write_file":
      return `Editing ${a.file_path ?? a.path ?? "file"}`;
    case "run_shell_command":
      return `Running ${
        typeof a.command === "string" ? truncate(a.command, 60) : "shell command"
      }`;
    case "grep_search":
      return `Grep ${truncate(String(a.pattern ?? a.query ?? ""), 40)}`;
    case "glob":
      return `Searching for ${a.pattern ?? "files"}`;
    case "list_directory":
      return `Listing ${a.path ?? a.directory ?? "directory"}`;
    case "web_fetch":
      return `Fetching ${a.url ?? "URL"}`;
    case "google_web_search":
      return `Searching ${truncate(String(a.query ?? ""), 40)}`;
    case "ask_user":
      return "Asking user";
    case "activate_skill":
      return `Activating skill ${a.skill_name ?? a.name ?? ""}`;
    case "write_todos":
      return "Updating plan";
    default:
      return name;
  }
}

function computeMergeKey(name: string, args: unknown): string | null {
  if (!/^(replace|write_file)$/i.test(name)) return null;
  const a = isObj(args) ? args : {};
  const path = typeof a.file_path === "string"
    ? a.file_path
    : typeof a.path === "string"
    ? a.path
    : null;
  return path ? `edit:${path}` : null;
}

/** Gemini's `write_todos` parameter shape isn't fully observed yet
 *  (no captured fixture); the doc suggests `{todos: [{content,
 *  status}, …]}` mirroring Claude's TodoWrite. Defensive parser
 *  accepts that shape and the alternate `entries`/`items` field
 *  names. */
function parseGeminiTodos(args: unknown): Array<{
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}> {
  if (!isObj(args)) return [];
  const list = Array.isArray(args.todos)
    ? args.todos
    : Array.isArray(args.entries)
    ? args.entries
    : Array.isArray(args.items)
    ? args.items
    : [];
  const out: Array<{
    content: string;
    status: "pending" | "in_progress" | "completed";
    priority: "high" | "medium" | "low";
  }> = [];
  for (const t of list) {
    if (!isObj(t)) continue;
    const content =
      typeof t.content === "string"
        ? t.content
        : typeof t.text === "string"
        ? t.text
        : null;
    if (!content) continue;
    const rawStatus = typeof t.status === "string" ? t.status : "pending";
    const status: "pending" | "in_progress" | "completed" =
      rawStatus === "in_progress" || rawStatus === "completed"
        ? rawStatus
        : "pending";
    out.push({ content, status, priority: "medium" });
  }
  return out;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
