// ──────────────────────────────────────────────────────────
// Gemini CLI OpenTelemetry file tailer
// ──────────────────────────────────────────────────────────
//
// When spawned with:
//   GEMINI_TELEMETRY_ENABLED=true
//   GEMINI_TELEMETRY_TARGET=local
//   GEMINI_TELEMETRY_OUTFILE=<path>
// Gemini writes one JSON record per line of every internal event:
// ACP requests/responses, tool calls (`gemini.api.tool_call`), user
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
  | "read" | "edit" | "delete" | "move" | "search"
  | "execute" | "think" | "fetch" | "switch_mode" | "other";

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

    if (isStart) {
      const toolCallId = randomUUID();
      this.toolCallIds.set(callId, toolCallId);
      this.opts.emit({
        sessionId: this.opts.sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId,
          title: toolName,
          kind: mapToolKind(toolName),
          status: "in_progress",
          rawInput: attrs.function_args ?? attrs.tool_input ?? attrs,
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

function mapToolKind(name: string): ToolKind {
  if (/read|list/i.test(name)) return "read";
  if (/search|grep|find/i.test(name)) return "search";
  if (/write|edit|create|update/i.test(name)) return "edit";
  if (/shell|bash|exec|run/i.test(name)) return "execute";
  if (/fetch|web|http/i.test(name)) return "fetch";
  return "other";
}
