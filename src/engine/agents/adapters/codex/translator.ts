// ──────────────────────────────────────────────────────────
// Codex stream-json → SessionNotification translator
// ──────────────────────────────────────────────────────────
//
// `codex exec --json` emits one JSON object per line. Event shapes
// (from github.com/openai/codex docs/config.md + noninteractive
// docs):
//
//   {"type":"thread.started","thread_id":"0199a213-..."}
//   {"type":"turn.started"}
//   {"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"bash -lc ls","status":"in_progress"}}
//   {"type":"item.updated","item":{"id":"item_1","status":"in_progress","output":"docs\n..."}}
//   {"type":"item.completed","item":{"id":"item_1","type":"command_execution","exit_code":0,"output":"docs\n..."}}
//   {"type":"item.completed","item":{"id":"item_3","type":"agent_message","text":"Repo contains docs..."}}
//   {"type":"turn.completed","usage":{"input_tokens":24763,"output_tokens":122}}
//   {"type":"turn.failed","error":{...}}
//   {"type":"error","message":"..."}
//
// `item.type` options (from the Codex repo):
//   agent_message, reasoning, command_execution, file_change,
//   mcp_tool_call, web_search, plan_update, patch_apply
//
// We map:
//   agent_message     → agent_message_chunk
//   reasoning         → agent_thought_chunk
//   command_execution → tool_call / tool_call_update
//   file_change       → tool_call / tool_call_update (edit)
//   mcp_tool_call     → tool_call / tool_call_update
//   web_search        → tool_call / tool_call_update (fetch/search)
//   plan_update       → plan
//   patch_apply       → tool_call / tool_call_update (edit)
//
// ──────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";

import type {
  ContentBlock,
  SessionNotification,
} from "../../types";

type ToolKind =
  | "read" | "edit" | "delete" | "move" | "search" | "web_search"
  | "execute" | "think" | "fetch" | "switch_mode"
  | "subagent" | "mcp" | "question" | "other";

type Emit = (notification: SessionNotification) => void;

interface CodexItem {
  id: string;
  type?: string;
  status?: string;
  text?: string;
  command?: string;
  output?: string;
  exit_code?: number;
  path?: string;
  url?: string;
  query?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_output?: unknown;
  changes?: Array<{ path?: string }>;
  error?: string;
}

interface CodexThreadStartedEvent {
  type: "thread.started";
  thread_id: string;
}

interface CodexTurnCompletedEvent {
  type: "turn.completed";
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
  };
}

interface CodexTurnFailedEvent {
  type: "turn.failed";
  error?: { code?: string; message?: string };
}

interface CodexItemEvent {
  type: "item.started" | "item.updated" | "item.completed";
  item: CodexItem;
}

interface CodexErrorEvent {
  type: "error";
  message?: string;
}

export interface CodexTranslatorOptions {
  sessionId: string;
  emit: Emit;
  onUnknown?: (event: unknown) => void;
}

export class CodexStreamTranslator {
  private readonly sessionId: string;
  private readonly emit: Emit;
  private readonly onUnknown?: (event: unknown) => void;

  /** Codex item.id → Zeros tool call id. One tool per item.id so we
   *  can correlate item.completed back to the originating tool_call. */
  private readonly toolCallIds = new Map<string, string>();

  /** The agent-message text we emitted for a given item.id. Codex's
   *  item.updated sometimes sends the *full* current text rather
   *  than a delta, so we diff to emit only the new portion. */
  private readonly emittedMessageText = new Map<string, string>();

  /** Per-translator-instance prefix for the messageIds we emit on
   *  agent_message_chunk / agent_thought_chunk. Codex resets item.id
   *  to "item_0" on every fresh `codex exec` (and a new translator is
   *  created each turn), so the bare item.id collides across turns
   *  and the renderer merges every reply into one bubble. Prefixing
   *  with this UUID keeps streaming deltas of the same item coalesced
   *  while making cross-turn ids distinct. */
  private readonly turnPrefix: string = randomUUID();

  /** Codex's thread id (not our sessionId). Captured from thread.started. */
  codexThreadId: string | null = null;

  private lastStopReason: string = "end_turn";
  private hasSeenTurnTerminal = false;

  constructor(opts: CodexTranslatorOptions) {
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
      case "thread.started":
        this.onThreadStarted(event as unknown as CodexThreadStartedEvent);
        break;
      case "turn.started":
        // Nothing to emit — the turn boundary is implicit.
        break;
      case "turn.completed":
        this.onTurnCompleted(event as unknown as CodexTurnCompletedEvent);
        break;
      case "turn.failed":
        this.onTurnFailed(event as unknown as CodexTurnFailedEvent);
        break;
      case "item.started":
        this.onItemStarted(event as unknown as CodexItemEvent);
        break;
      case "item.updated":
        this.onItemUpdated(event as unknown as CodexItemEvent);
        break;
      case "item.completed":
        this.onItemCompleted(event as unknown as CodexItemEvent);
        break;
      case "error":
        this.onError(event as unknown as CodexErrorEvent);
        break;
      default:
        this.onUnknown?.(event);
    }
  }

  get stopReason(): "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled" {
    switch (this.lastStopReason) {
      case "end_turn":
      case "max_tokens":
      case "max_turn_requests":
      case "refusal":
      case "cancelled":
        return this.lastStopReason;
      default:
        return "end_turn";
    }
  }

  get sawTurnTerminal(): boolean {
    return this.hasSeenTurnTerminal;
  }

  // ── Thread start ────────────────────────────────────────
  private onThreadStarted(event: CodexThreadStartedEvent): void {
    this.codexThreadId = event.thread_id;
  }

  // ── Item lifecycle ──────────────────────────────────────

  private onItemStarted(event: CodexItemEvent): void {
    const item = event.item;
    const kind = item.type ?? "";

    switch (kind) {
      case "agent_message":
      case "reasoning":
        // Seed an empty emittedMessageText; the actual text arrives in
        // updated/completed. Codex sometimes sends the full text on
        // started for short messages — handle that below.
        if (typeof item.text === "string" && item.text.length > 0) {
          this.emitMessageDelta(item, item.text);
        } else {
          this.emittedMessageText.set(item.id, "");
        }
        break;

      case "command_execution":
      case "file_change":
      case "patch_apply":
      case "mcp_tool_call":
      case "web_search": {
        const toolCallId = this.ensureToolCallId(item.id);
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "tool_call",
            toolCallId,
            title: describeItem(item),
            kind: mapToolKind(kind),
            status: "in_progress",
            rawInput: toolInput(item),
          },
        });
        break;
      }

      case "plan_update":
        // Plans arrive structured — emit on completed when we have
        // the full entries. No-op on started.
        break;

      default:
        // Unknown item kind — best-effort as "other" tool call so the
        // UI shows it rather than silently dropping it.
        const toolCallId = this.ensureToolCallId(item.id);
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "tool_call",
            toolCallId,
            title: kind || "tool",
            kind: "other" as ToolKind,
            status: "in_progress",
            rawInput: item,
          },
        });
    }
  }

  private onItemUpdated(event: CodexItemEvent): void {
    const item = event.item;
    const kind = item.type ?? "";

    switch (kind) {
      case "agent_message":
      case "reasoning":
        if (typeof item.text === "string") {
          this.emitMessageDelta(item, item.text);
        }
        break;

      case "command_execution":
      case "file_change":
      case "patch_apply":
      case "mcp_tool_call":
      case "web_search": {
        const toolCallId = this.toolCallIds.get(item.id);
        if (!toolCallId) break; // Updated before started — ignore.
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId,
            status: "in_progress",
            rawOutput: toolOutput(item),
          },
        });
        break;
      }
    }
  }

  private onItemCompleted(event: CodexItemEvent): void {
    const item = event.item;
    const kind = item.type ?? "";

    switch (kind) {
      case "agent_message":
      case "reasoning":
        if (typeof item.text === "string") {
          // Emit any remaining delta not yet flushed.
          this.emitMessageDelta(item, item.text);
        }
        this.emittedMessageText.delete(item.id);
        break;

      case "command_execution":
      case "file_change":
      case "patch_apply":
      case "mcp_tool_call":
      case "web_search": {
        const toolCallId = this.toolCallIds.get(item.id);
        if (!toolCallId) break;
        const failed =
          kind === "command_execution" && typeof item.exit_code === "number"
            ? item.exit_code !== 0
            : typeof item.error === "string";
        const output = toolOutput(item);
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId,
            status: failed ? "failed" : "completed",
            rawOutput: output,
            content: typeof output === "string" && output.length > 0
              ? [{ type: "content", content: { type: "text", text: output } as ContentBlock }]
              : null,
          },
        });
        this.toolCallIds.delete(item.id);
        break;
      }

      case "plan_update":
        this.emitPlan(item);
        break;

      default:
        // fall-through to ensure any leftover tool call is finalized
        const toolCallId = this.toolCallIds.get(item.id);
        if (toolCallId) {
          this.emit({
            sessionId: this.sessionId,
            update: {
              sessionUpdate: "tool_call_update",
              toolCallId,
              status: "completed",
            },
          });
          this.toolCallIds.delete(item.id);
        }
    }
  }

  // ── Terminal events ─────────────────────────────────────

  private onTurnCompleted(_event: CodexTurnCompletedEvent): void {
    this.hasSeenTurnTerminal = true;
    this.lastStopReason = "end_turn";
    // UsageUpdate is context-window semantics; Codex's usage is
    // per-turn API tokens. Defer (Phase 1.5 parity w/ Claude).
  }

  private onTurnFailed(event: CodexTurnFailedEvent): void {
    this.hasSeenTurnTerminal = true;
    const code = event.error?.code ?? "";
    if (/max[_ ]turns?/i.test(code)) {
      this.lastStopReason = "max_turn_requests";
    } else if (/refus/i.test(code)) {
      this.lastStopReason = "refusal";
    } else {
      this.lastStopReason = "end_turn";
    }
    // Surface the failure to the user. Pre-fix, turn.failed was silent —
    // an invalid model / quota error / auth problem produced a chat that
    // appeared to stream forever (renderer status stuck in "streaming"
    // because nothing visible arrived in the message list, only the
    // stopReason at exit time). Now we extract the human-readable text
    // from the nested OpenAI error envelope and emit it as a system
    // message bubble.
    const message = extractErrorMessage(event.error?.message);
    if (message) {
      this.emit({
        sessionId: this.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: `⚠ Codex error: ${message}` } as ContentBlock,
          messageId: `${this.turnPrefix}-error`,
        },
      });
    }
  }

  private onError(event: CodexErrorEvent): void {
    // Codex sometimes sends both `error` and `turn.failed` for the same
    // failure (the API returned an error mid-turn). Emit the message
    // here too — onTurnFailed dedups by messageId via the same prefix
    // so the user sees one bubble, not two.
    const message = extractErrorMessage(event.message);
    if (message) {
      this.emit({
        sessionId: this.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: `⚠ Codex error: ${message}` } as ContentBlock,
          messageId: `${this.turnPrefix}-error`,
        },
      });
    }
  }

  // ── helpers ─────────────────────────────────────────────

  private ensureToolCallId(itemId: string): string {
    const cached = this.toolCallIds.get(itemId);
    if (cached) return cached;
    const id = randomUUID();
    this.toolCallIds.set(itemId, id);
    return id;
  }

  /** Codex sometimes re-sends the full accumulated text in each
   *  update rather than a delta. Emit only the new suffix so the
   *  UI doesn't duplicate characters. */
  private emitMessageDelta(item: CodexItem, fullText: string): void {
    const already = this.emittedMessageText.get(item.id) ?? "";
    if (fullText.length <= already.length) return;
    const delta = fullText.slice(already.length);
    if (!delta) return;
    this.emittedMessageText.set(item.id, fullText);

    const isThought = item.type === "reasoning";
    this.emit({
      sessionId: this.sessionId,
      update: {
        sessionUpdate: isThought ? "agent_thought_chunk" : "agent_message_chunk",
        content: { type: "text", text: delta } as ContentBlock,
        messageId: `${this.turnPrefix}-${item.id}`,
      },
    });
  }

  private emitPlan(item: CodexItem): void {
    // Codex's plan_update item carries structured entries. Different
    // versions use different shapes; extract best-effort.
    const raw = (item as unknown as { plan?: { entries?: unknown } }).plan;
    const entries = Array.isArray(raw?.entries) ? raw.entries : [];
    if (entries.length === 0) return;
    this.emit({
      sessionId: this.sessionId,
      update: {
        sessionUpdate: "plan",
        entries: entries as never,
      } as never,
    });
  }
}

// ── shaped-item helpers ──────────────────────────────────

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function describeItem(item: CodexItem): string {
  switch (item.type) {
    case "command_execution":
      return `Running ${truncate(item.command ?? "", 60) || "shell command"}`;
    case "file_change":
    case "patch_apply":
      return `Editing ${item.path ?? "files"}`;
    case "mcp_tool_call":
      return item.tool_name ?? "MCP tool";
    case "web_search":
      return `Searching ${truncate(item.query ?? item.url ?? "web", 40)}`;
    default:
      return item.type ?? "tool";
  }
}

function mapToolKind(kind: string): ToolKind {
  switch (kind) {
    case "command_execution":
      return "execute";
    case "file_change":
    case "patch_apply":
      return "edit";
    case "web_search":
      return "search";
    case "mcp_tool_call":
      return "other";
    default:
      return "other";
  }
}

function toolInput(item: CodexItem): unknown {
  if (item.type === "command_execution") return { command: item.command };
  if (item.type === "file_change" || item.type === "patch_apply") {
    return { path: item.path, changes: item.changes };
  }
  if (item.type === "mcp_tool_call") {
    return { tool_name: item.tool_name, tool_input: item.tool_input };
  }
  if (item.type === "web_search") return { query: item.query, url: item.url };
  return item;
}

function toolOutput(item: CodexItem): unknown {
  if (item.type === "command_execution") {
    return {
      exit_code: item.exit_code,
      output: item.output,
    };
  }
  if (item.type === "mcp_tool_call") return item.tool_output;
  if (typeof item.output === "string") return item.output;
  return item;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

/** Codex CLI nests OpenAI-API-style errors inside its own envelope:
 *
 *    {"type":"error","message":"{\"type\":\"error\",\"status\":400,
 *      \"error\":{\"type\":\"invalid_request_error\",
 *        \"message\":\"The 'gpt-5.5' model requires a newer version…\"}}"}
 *
 *  Walk one level of that JSON-in-JSON to surface the human message.
 *  Falls back to the outer message if parsing fails. */
function extractErrorMessage(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0) return "";
  // Common case: the message is itself JSON.
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };
    if (parsed?.error?.message) return parsed.error.message;
    if (parsed?.message) return parsed.message;
  } catch {
    /* not JSON, fall through */
  }
  return raw;
}
