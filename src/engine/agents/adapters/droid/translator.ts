// ──────────────────────────────────────────────────────────
// Factory Droid stream-json → SessionNotification translator
// ──────────────────────────────────────────────────────────
//
// Verified Stage 8.2 against `droid 0.105.1` running with
// `droid exec --output-format stream-json --auto medium`.
//
// Event shapes observed:
//
//   {"type":"system","subtype":"init",
//    "cwd":"/...","session_id":"...","model":"claude-opus-4-7",
//    "reasoning_effort":"high","tools":[...]}
//
//   {"type":"message","role":"user","id":"...","text":"prompt",
//    "timestamp":...,"session_id":"..."}
//
//   {"type":"reasoning","id":"...","text":"...",
//    "timestamp":...,"session_id":"..."}
//
//   {"type":"tool_call","id":"toolu_01...","messageId":"...",
//    "toolId":"Read","toolName":"Read",
//    "parameters":{"file_path":"..."},
//    "timestamp":...,"session_id":"..."}
//
//   {"type":"tool_result","id":"toolu_01...","messageId":"...",
//    "toolId":"Read","isError":false,"value":"file contents",
//    "timestamp":...,"session_id":"..."}
//
//   {"type":"message","role":"assistant","id":"...","text":"reply",
//    "timestamp":...,"session_id":"..."}
//
//   {"type":"completion","finalText":"...","numTurns":3,
//    "durationMs":12017,"usage":{...},"session_id":"..."}
//
// Two structural differences from Claude's stream-json:
//
// 1. Tool calls + reasoning + messages are TOP-LEVEL events, not
//    content blocks inside `assistant.message.content[]`. Same
//    structural posture as Cursor's translator (Stage 7.3).
//
// 2. `message` events carry FLAT TEXT in a `text` field (no content
//    blocks). The Claude translator never reaches its tool-use
//    branch for these events.
//
// 3. Terminal event is `completion` (not `result`).
//
// Tool-name set is a mix of canonical Claude names (Read / Edit /
// Grep / Glob / Bash → Execute / Task / WebSearch / TodoWrite) plus
// Droid-specific tools (ApplyPatch, Create, FetchUrl, Skill,
// ExitSpecMode, GenerateDroid, ProposeMission, …). The map below
// covers the canonical-kind subset; everything else falls through
// to "other" + the unified ToolCard.
//
// ──────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";

import type { ContentBlock, SessionNotification } from "../../types";

type ToolKind =
  | "read" | "edit" | "delete" | "move" | "search" | "web_search"
  | "execute" | "think" | "fetch" | "switch_mode"
  | "subagent" | "mcp" | "question" | "other";

type Emit = (notification: SessionNotification) => void;

interface DroidSystemInitEvent {
  type: "system";
  subtype: "init";
  session_id: string;
  cwd?: string;
  model?: string;
  reasoning_effort?: string;
  tools?: string[];
}

interface DroidUserOrAssistantMessageEvent {
  type: "message";
  role: "user" | "assistant";
  id: string;
  text: string;
}

interface DroidReasoningEvent {
  type: "reasoning";
  id: string;
  text: string;
}

interface DroidToolCallEvent {
  type: "tool_call";
  id: string;
  messageId?: string;
  toolId: string;
  toolName: string;
  parameters?: unknown;
}

interface DroidToolResultEvent {
  type: "tool_result";
  id: string;
  messageId?: string;
  toolId: string;
  isError: boolean;
  value: unknown;
}

interface DroidCompletionEvent {
  type: "completion";
  finalText?: string;
  numTurns?: number;
  durationMs?: number;
  usage?: unknown;
  session_id?: string;
}

export interface DroidTranslatorOptions {
  sessionId: string;
  emit: Emit;
  onUnknown?: (event: unknown) => void;
}

export class DroidStreamTranslator {
  private readonly sessionId: string;
  private readonly emit: Emit;
  private readonly onUnknown?: (event: unknown) => void;

  /** Droid's session id, captured from system init. Currently unused
   *  for resume (Droid's `--session-id` resume path requires sending
   *  the same id we already passed in via env, but the spec doesn't
   *  surface that yet). Kept for parity + future reuse. */
  droidSessionId: string | null = null;

  /** id (`toolu_xx`) → Zeros toolCallId. tool_result events correlate
   *  back to tool_call by exact id match. */
  private readonly toolCallIds = new Map<string, string>();

  /** Per-translator-instance prefix. Droid emits `reasoning` as a
   *  single event (not deltas), but we still bucket all reasoning
   *  text into one consistent messageId so the renderer treats the
   *  whole turn's thinking as one block. */
  private readonly turnPrefix: string = randomUUID();

  private hasSeenCompletion = false;
  /** True once any assistant `message` event has been emitted in this
   *  turn. Used to suppress `completion.finalText` — Droid sends the
   *  final reply text twice (once mid-turn as a `message`, once again
   *  as `completion.finalText`), and emitting both produces duplicate
   *  bubbles in chat. */
  private hasEmittedAssistantText = false;
  private lastStopReason: "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled" =
    "end_turn";

  constructor(opts: DroidTranslatorOptions) {
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
        this.onSystem(event as unknown as DroidSystemInitEvent);
        break;
      case "message":
        this.onMessage(event as unknown as DroidUserOrAssistantMessageEvent);
        break;
      case "reasoning":
        this.onReasoning(event as unknown as DroidReasoningEvent);
        break;
      case "tool_call":
        this.onToolCall(event as unknown as DroidToolCallEvent);
        break;
      case "tool_result":
        this.onToolResult(event as unknown as DroidToolResultEvent);
        break;
      case "completion":
        this.onCompletion(event as unknown as DroidCompletionEvent);
        break;
      default:
        this.onUnknown?.(event);
    }
  }

  get sawTerminal(): boolean {
    return this.hasSeenCompletion;
  }

  get stopReason() {
    return this.lastStopReason;
  }

  // ── handlers ────────────────────────────────────────────

  private onSystem(event: DroidSystemInitEvent): void {
    if (event.subtype === "init" && typeof event.session_id === "string") {
      this.droidSessionId = event.session_id;
    }
  }

  private onMessage(event: DroidUserOrAssistantMessageEvent): void {
    // User echoes are no-ops — Zeros already shows the prompt locally.
    if (event.role === "user") return;
    if (event.role !== "assistant") return;
    if (typeof event.text !== "string" || event.text.length === 0) return;
    this.hasEmittedAssistantText = true;
    this.emit({
      sessionId: this.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: event.text } as ContentBlock,
        // Droid's assistant `message` events carry stable per-segment
        // ids; pass them through so the renderer keys cleanly. Droid
        // emits each assistant text as a single complete bubble (no
        // delta streaming today) — one event = one bubble.
        messageId: `${this.turnPrefix}-${event.id}`,
      },
    });
  }

  private onReasoning(event: DroidReasoningEvent): void {
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

  private onToolCall(event: DroidToolCallEvent): void {
    if (typeof event.toolName !== "string") return;

    // TodoWrite intercept — same posture as Claude's translator: emit
    // a `plan` notification feeding the canonical PlanPanel rather
    // than rendering a tool card. Droid's `parameters.todos` is a
    // SINGLE STRING with newline-separated entries (not a structured
    // array like Claude's), so the parser is different.
    if (/^TodoWrite$/i.test(event.toolName)) {
      const entries = parseDroidTodoEntries(event.parameters);
      if (entries.length > 0) {
        this.emit({
          sessionId: this.sessionId,
          update: { sessionUpdate: "plan", entries },
        });
      }
      return;
    }

    const toolCallId = this.ensureToolCallId(event.id);
    const mergeKey = computeMergeKey(event.toolName, event.parameters);
    this.emit({
      sessionId: this.sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: describeTool(event.toolName, event.parameters),
        kind: mapToolKind(event.toolName),
        status: "in_progress",
        rawInput: event.parameters ?? null,
        ...(mergeKey ? { mergeKey } : {}),
      },
    });
  }

  private onToolResult(event: DroidToolResultEvent): void {
    const cached = this.toolCallIds.get(event.id);
    if (!cached) {
      // TodoWrite results have no matching `started` because we
      // intercepted the tool_call into a plan notification. Drop
      // them silently.
      return;
    }
    this.emit({
      sessionId: this.sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: cached,
        status: event.isError ? "failed" : "completed",
        rawOutput: event.value ?? null,
      },
    });
    this.toolCallIds.delete(event.id);
  }

  private onCompletion(event: DroidCompletionEvent): void {
    this.hasSeenCompletion = true;
    // Droid emits the final reply text twice — once as a mid-turn
    // `message` event and again as `completion.finalText`. Suppress
    // the second copy when we've already emitted any assistant text
    // this turn. Edge case: a tool-only run (zero assistant text)
    // would leave the chat empty without this fallback, but in
    // practice Droid always emits a closing `message` even when the
    // turn was just tool calls. Keeping the fallback in case a
    // future Droid version changes that.
    if (this.hasEmittedAssistantText) return;
    if (typeof event.finalText === "string" && event.finalText.length > 0) {
      this.emit({
        sessionId: this.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: event.finalText } as ContentBlock,
          messageId: `${this.turnPrefix}-final`,
        },
      });
    }
  }

  // ── helpers ─────────────────────────────────────────────

  private ensureToolCallId(droidId: string): string {
    const cached = this.toolCallIds.get(droidId);
    if (cached) return cached;
    const id = randomUUID();
    this.toolCallIds.set(droidId, id);
    return id;
  }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/** Map Droid's tool names → canonical ToolKind. Droid's tool surface
 *  is closest to Claude's of all the agents — `Read`, `Edit`, `Grep`,
 *  `Glob`, `Task`, `TodoWrite`, `WebSearch` match by name. The
 *  Droid-specific names (`ApplyPatch`, `Create`, `Execute`, `FetchUrl`,
 *  `LS`, `Skill`, `ExitSpecMode`, `AskUser`) get explicit cases. */
function mapToolKind(name: string): ToolKind {
  if (/^Read$/i.test(name)) return "read";
  if (/^(Edit|ApplyPatch|Create|Write)$/i.test(name)) return "edit";
  if (/^(Grep|Glob|LS)$/i.test(name)) return "search";
  if (/^(Bash|Execute)$/i.test(name)) return "execute";
  if (/^WebSearch$/i.test(name)) return "web_search";
  if (/^FetchUrl$/i.test(name)) return "fetch";
  if (/^Task$/i.test(name)) return "subagent";
  if (/^AskUser$/i.test(name)) return "question";
  if (/^ExitSpecMode$/i.test(name)) return "switch_mode";
  // Skill/GenerateDroid/ProposeMission/StartMissionRun/... — Droid's
  // mission-orchestration surface. No canonical kind today; surface
  // through the unified ToolCard until we design dedicated cards
  // (separate effort, post-Stage 8).
  return "other";
}

function describeTool(name: string, parameters: unknown): string {
  const p = isObj(parameters) ? parameters : {};
  switch (name) {
    case "Read":
      return `Reading ${p.file_path ?? p.path ?? "file"}`;
    case "Edit":
    case "ApplyPatch":
    case "Create":
    case "Write":
      return `Editing ${p.file_path ?? p.path ?? "file"}`;
    case "Bash":
    case "Execute":
      return `Running ${
        typeof p.command === "string" ? truncate(p.command, 60) : "shell command"
      }`;
    case "Grep":
      return `Grep ${truncate(String(p.pattern ?? p.query ?? ""), 40)}`;
    case "Glob":
      return `Searching for ${p.pattern ?? "files"}`;
    case "LS":
      return `Listing ${p.path ?? p.file_path ?? "directory"}`;
    case "FetchUrl":
      return `Fetching ${p.url ?? "URL"}`;
    case "WebSearch":
      return `Searching ${truncate(String(p.query ?? ""), 40)}`;
    case "Task":
      return `Subagent ${truncate(String(p.description ?? p.prompt ?? ""), 40)}`;
    case "AskUser":
      return "Asking user";
    case "ExitSpecMode":
      return "Exit spec mode";
    case "TodoWrite":
      return "Updating plan";
    default:
      return name;
  }
}

function computeMergeKey(name: string, parameters: unknown): string | null {
  if (!/^(Edit|ApplyPatch|Create|Write)$/i.test(name)) return null;
  const p = isObj(parameters) ? parameters : {};
  const path = typeof p.file_path === "string"
    ? p.file_path
    : typeof p.path === "string"
    ? p.path
    : null;
  return path ? `edit:${path}` : null;
}

/** Droid's TodoWrite parameter shape is `{todos: "1. [pending] First\n2.
 *  [in_progress] Second"}` — a single string with newline-separated
 *  numbered entries. Each entry is `<n>. [<status>] <content>` where
 *  status ∈ pending / in_progress / completed.
 *
 *  Defensive: also accept the structured Claude-shape `{todos: [...]}`
 *  in case Droid versions diverge. */
function parseDroidTodoEntries(parameters: unknown): Array<{
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}> {
  if (!isObj(parameters)) return [];
  const raw = parameters.todos;

  // Claude-style structured array — handle defensively.
  if (Array.isArray(raw)) {
    const out: Array<{
      content: string;
      status: "pending" | "in_progress" | "completed";
      priority: "high" | "medium" | "low";
    }> = [];
    for (const t of raw) {
      if (!isObj(t)) continue;
      const content = typeof t.content === "string" ? t.content : null;
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

  // Droid-style newline-separated string.
  if (typeof raw === "string") {
    const out: Array<{
      content: string;
      status: "pending" | "in_progress" | "completed";
      priority: "high" | "medium" | "low";
    }> = [];
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(
        /^\s*\d+\.\s*\[(pending|in_progress|completed)\]\s*(.+?)\s*$/,
      );
      if (!m) continue;
      const status = m[1] as "pending" | "in_progress" | "completed";
      const content = m[2];
      if (!content) continue;
      out.push({ content, status, priority: "medium" });
    }
    return out;
  }

  return [];
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
