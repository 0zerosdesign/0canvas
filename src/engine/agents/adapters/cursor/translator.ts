// ──────────────────────────────────────────────────────────
// Cursor stream-json → SessionNotification translator
// ──────────────────────────────────────────────────────────
//
// Cursor's stream-json schema is *structurally* different from
// Claude's despite surface-level similarities (verified Stage 7.3
// against real `cursor-agent` 2026.04.17 output).
//
// Event shapes:
//
//   {"type":"system","subtype":"init","session_id":"...","model":"Auto",
//    "cwd":"/...","permissionMode":"default","apiKeySource":"login"}
//
//   {"type":"user","message":{...}}                        — echo of prompt
//
//   {"type":"thinking","subtype":"delta","text":"..."}     — top-level event
//                                                            (NOT a content
//                                                            block inside
//                                                            assistant.message)
//
//   {"type":"assistant","message":{"role":"assistant",
//      "content":[{"type":"text","text":"chunk"}]}}        — text delta
//
//   {"type":"tool_call","subtype":"started",
//      "call_id":"call_xxx",
//      "tool_call":{"readToolCall":{"args":{"path":"..."}}}}
//
//   {"type":"tool_call","subtype":"completed",
//      "call_id":"call_xxx",
//      "tool_call":{"readToolCall":{
//         "args":{"path":"..."},
//         "result":{"success":{...}}|{"error":{...}}}}}
//
//   {"type":"result", ...}                                 — terminal
//
// Two key quirks vs Claude:
//
// 1. Tool name is the *key* of the single object inside `tool_call.tool_call`,
//    not a `name` field. (`{readToolCall: {args, result}}`, not `{name:"Read",
//    input:...}`.)
//
// 2. The cursor-agent flag `--stream-partial-output` causes *every* text
//    segment to be emitted twice — once during streaming, once as the
//    finalized chunk. We drop that flag in cursor/spec.ts so text arrives
//    chunked but un-duplicated. (Without the flag we still get streaming;
//    we just lose token-level granularity, which is fine.)
//
// ──────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";

import type { ContentBlock, SessionNotification } from "../../types";

type ToolKind =
  | "read" | "edit" | "delete" | "move" | "search" | "web_search"
  | "execute" | "think" | "fetch" | "switch_mode"
  | "subagent" | "mcp" | "question" | "other";

type Emit = (notification: SessionNotification) => void;

interface CursorSystemInitEvent {
  type: "system";
  subtype: "init";
  session_id: string;
  model?: string;
  cwd?: string;
  permissionMode?: string;
}

interface CursorThinkingEvent {
  type: "thinking";
  subtype?: "delta";
  text: string;
}

interface CursorAssistantEvent {
  type: "assistant";
  message: {
    role: string;
    content?: Array<{ type?: string; text?: string }>;
  };
}

interface CursorToolCallEvent {
  type: "tool_call";
  subtype: "started" | "completed";
  call_id: string;
  tool_call: Record<string, { args?: unknown; result?: unknown }>;
}

interface CursorResultEvent {
  type: "result";
  subtype?: string;
}

export interface CursorTranslatorOptions {
  sessionId: string;
  emit: Emit;
  onUnknown?: (event: unknown) => void;
}

export class CursorStreamTranslator {
  private readonly sessionId: string;
  private readonly emit: Emit;
  private readonly onUnknown?: (event: unknown) => void;

  /** Cursor's session id, captured from the system init event. Used by
   *  cursor/spec.ts to set --resume on subsequent prompts. */
  cursorSessionId: string | null = null;

  /** Per-translator-instance prefix. Cursor doesn't tag text/thinking
   *  deltas with stable message ids, so we synthesize one per turn —
   *  one fixed id for "all text in this turn", one for "all thoughts".
   *  Renderer coalesces them into single bubbles. */
  private readonly turnPrefix: string = randomUUID();

  /** Cursor call_id → Zeros toolCallId. Lets `completed` events update
   *  the card created by the matching `started` event. */
  private readonly toolCallIds = new Map<string, string>();

  private hasSeenResult = false;

  constructor(opts: CursorTranslatorOptions) {
    this.sessionId = opts.sessionId;
    this.emit = opts.emit;
    this.onUnknown = opts.onUnknown;
  }

  feed(event: unknown): void {
    if (!isObj(event) || typeof event.type !== "string") {
      this.onUnknown?.(event);
      return;
    }
    switch (event.type) {
      case "system":
        this.onSystem(event as unknown as CursorSystemInitEvent);
        break;
      case "user":
        // No-op — Zeros already shows the user's prompt locally.
        break;
      case "thinking":
        this.onThinking(event as unknown as CursorThinkingEvent);
        break;
      case "assistant":
        this.onAssistant(event as unknown as CursorAssistantEvent);
        break;
      case "tool_call":
        this.onToolCall(event as unknown as CursorToolCallEvent);
        break;
      case "result":
        this.onResult(event as unknown as CursorResultEvent);
        break;
      default:
        this.onUnknown?.(event);
    }
  }

  get sawTerminal(): boolean {
    return this.hasSeenResult;
  }

  get stopReason(): "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled" {
    // Cursor's `result` event doesn't expose a structured stop reason
    // today; treat as normal end_turn. If the process exits non-zero
    // the shared adapter surfaces that as a CLI-exit error separately.
    return "end_turn";
  }

  // ── handlers ────────────────────────────────────────────

  private onSystem(event: CursorSystemInitEvent): void {
    if (event.subtype === "init" && typeof event.session_id === "string") {
      this.cursorSessionId = event.session_id;
    }
  }

  private onThinking(event: CursorThinkingEvent): void {
    if (typeof event.text !== "string" || event.text.length === 0) return;
    this.emit({
      sessionId: this.sessionId,
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: event.text } as ContentBlock,
        messageId: `${this.turnPrefix}-thought`,
      },
    });
  }

  private onAssistant(event: CursorAssistantEvent): void {
    const blocks = event.message?.content;
    if (!Array.isArray(blocks)) return;
    for (const block of blocks) {
      if (
        block?.type === "text" &&
        typeof block.text === "string" &&
        block.text.length > 0
      ) {
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: block.text } as ContentBlock,
            messageId: `${this.turnPrefix}-text`,
          },
        });
      }
    }
  }

  private onToolCall(event: CursorToolCallEvent): void {
    const wrapper = event.tool_call;
    if (!isObj(wrapper)) return;
    const keys = Object.keys(wrapper);
    if (keys.length === 0) return;
    const toolName = keys[0];
    const body = wrapper[toolName];
    if (!isObj(body)) return;

    const args = (body as { args?: unknown }).args ?? null;
    const result = (body as { result?: unknown }).result;

    // Cursor's todo tools collapse into the canonical Plan panel,
    // mirroring how Claude's TodoWrite is intercepted in claude/translator.
    if (/^(todoToolCall|updateTodosToolCall)$/i.test(toolName)) {
      if (event.subtype === "started") {
        const entries = parseCursorTodoEntries(args);
        if (entries.length > 0) {
          this.emit({
            sessionId: this.sessionId,
            update: { sessionUpdate: "plan", entries },
          });
        }
      }
      return;
    }

    if (event.subtype === "started") {
      const toolCallId = this.ensureToolCallId(event.call_id);
      const mergeKey = computeMergeKey(toolName, args);
      this.emit({
        sessionId: this.sessionId,
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

    if (event.subtype === "completed") {
      const failed = isFailureResult(result);
      const cached = this.toolCallIds.get(event.call_id);
      if (cached) {
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: cached,
            status: failed ? "failed" : "completed",
            rawOutput: result,
          },
        });
        this.toolCallIds.delete(event.call_id);
        return;
      }
      // No matching `started` — emit a one-shot completed card so the
      // event isn't silently dropped.
      const toolCallId = this.ensureToolCallId(event.call_id);
      const mergeKey = computeMergeKey(toolName, args);
      this.emit({
        sessionId: this.sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId,
          title: describeTool(toolName, args),
          kind: mapToolKind(toolName),
          status: failed ? "failed" : "completed",
          rawInput: args,
          rawOutput: result,
          ...(mergeKey ? { mergeKey } : {}),
        },
      });
      this.toolCallIds.delete(event.call_id);
    }
  }

  private onResult(_event: CursorResultEvent): void {
    this.hasSeenResult = true;
  }

  // ── helpers ─────────────────────────────────────────────

  private ensureToolCallId(callId: string): string {
    const cached = this.toolCallIds.get(callId);
    if (cached) return cached;
    const id = randomUUID();
    this.toolCallIds.set(callId, id);
    return id;
  }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/** Cursor wraps tool results in `{success: {...}}` on the happy path
 *  and `{error: {...}}` on failure. Treat anything else (or missing)
 *  as success — the renderer can show what it has. */
function isFailureResult(result: unknown): boolean {
  if (!isObj(result)) return false;
  return "error" in result;
}

function mapToolKind(name: string): ToolKind {
  if (/^readToolCall$/i.test(name)) return "read";
  if (/^(editToolCall|writeToolCall)$/i.test(name)) return "edit";
  if (/^shellToolCall$/i.test(name)) return "execute";
  if (/^(grepToolCall|globToolCall)$/i.test(name)) return "search";
  // Cursor has no native fetch / web_search / subagent / mcp surface
  // exposed in its CLI today. Future tool names land in `other` and
  // render through the unified ToolCard fallback until we teach this
  // function about them.
  return "other";
}

function describeTool(name: string, args: unknown): string {
  const a = isObj(args) ? args : {};
  switch (name) {
    case "readToolCall":
      return `Reading ${a.path ?? "file"}`;
    case "editToolCall":
    case "writeToolCall":
      return `Editing ${a.path ?? "file"}`;
    case "shellToolCall":
      return `Running ${
        typeof a.command === "string" ? truncate(a.command, 60) : "shell command"
      }`;
    case "grepToolCall":
      return `Grep ${truncate(String(a.pattern ?? a.query ?? ""), 40)}`;
    case "globToolCall":
      return `Searching for ${a.pattern ?? "files"}`;
    case "todoToolCall":
    case "updateTodosToolCall":
      return "Updating plan";
    default:
      return name;
  }
}

function computeMergeKey(name: string, args: unknown): string | null {
  if (!/^(editToolCall|writeToolCall)$/i.test(name)) return null;
  const path = isObj(args) && typeof args.path === "string" ? args.path : null;
  return path ? `edit:${path}` : null;
}

/** Cursor's todoToolCall args shape isn't observed in our test corpus
 *  yet — accept both `{todos:[...]}` and `{items:[...]}` and read either
 *  `content` or `text` on each entry. Status maps 1:1; priority defaults
 *  to medium (Cursor doesn't expose priority). */
function parseCursorTodoEntries(
  args: unknown,
): Array<{
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}> {
  if (!isObj(args)) return [];
  const list = Array.isArray(args.todos)
    ? args.todos
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
