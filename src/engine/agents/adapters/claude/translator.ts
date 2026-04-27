// ──────────────────────────────────────────────────────────
// Claude stream-json → SessionNotification translator
// ──────────────────────────────────────────────────────────
//
// Claude Code emits one JSON object per line when run with
// `--output-format stream-json --verbose`. Shape roughly:
//
//   {"type":"system","subtype":"init","session_id":"...","model":"...","tools":[...]}
//   {"type":"user","message":{"role":"user","content":[...]}}
//   {"type":"assistant","message":{"role":"assistant","content":[
//     {"type":"thinking","thinking":"..."},
//     {"type":"text","text":"..."},
//     {"type":"tool_use","id":"toolu_01","name":"Read","input":{...}}
//   ]}}
//   {"type":"user","message":{"role":"user","content":[
//     {"type":"tool_result","tool_use_id":"toolu_01","content":"...","is_error":false}
//   ]}}
//   {"type":"result","subtype":"success","result":"...","total_cost_usd":0.01,"usage":{...},"session_id":"..."}
//
// This class converts each Claude event into one or more
// SessionNotification payloads matching the wire shape. The UI
// already knows how to render them (unchanged).
//
// State is per-translator-instance, keyed on the Zeros session id
// passed at construction. Each new session gets a fresh translator.
//
// ──────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";

import type {
  ContentBlock,
  SessionNotification,
} from "../../types";

// engine ToolKind union — hoisted as a string set for runtime checks.
// Mirrors src/zeros/bridge/agent-events.ts ToolKind. Stage 4 added
// web_search / subagent / mcp / question for the new card kinds.
type ToolKind =
  | "read" | "edit" | "delete" | "move" | "search" | "web_search"
  | "execute" | "think" | "fetch" | "switch_mode"
  | "subagent" | "mcp" | "question" | "other";

type Emit = (notification: SessionNotification) => void;

interface ClaudeAssistantContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface ClaudeMessageEvent {
  type: "user" | "assistant";
  message?: {
    role?: string;
    content?: ClaudeAssistantContentBlock[];
  };
}

interface ClaudeSystemInitEvent {
  type: "system";
  subtype: "init";
  session_id?: string;
  model?: string;
  tools?: string[];
  mcp_servers?: Array<{ name: string; status?: string }>;
}

interface ClaudeResultEvent {
  type: "result";
  subtype?: "success" | "error_max_turns" | "error_during_execution" | string;
  session_id?: string;
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
  is_error?: boolean;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  result?: string;
}

interface ClaudeToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content?: string | Array<{ type: string; text?: string }>;
  is_error?: boolean;
}

export interface ClaudeTranslatorOptions {
  /** Zeros-side session id — goes into every emitted SessionNotification. */
  sessionId: string;
  /** Called once for each SessionNotification produced. */
  emit: Emit;
  /** Optional hook for diagnostics of unknown Claude event shapes. */
  onUnknown?: (event: unknown) => void;
}

export class ClaudeStreamTranslator {
  private readonly sessionId: string;
  private readonly emit: Emit;
  private readonly onUnknown?: (event: unknown) => void;

  /** Zeros-side tool call ids keyed by Claude's tool_use_id so
   *  tool_call_update can cross-reference a prior tool_call. */
  private readonly toolCallIds = new Map<string, string>();

  /** Messages emitted in this turn get stable IDs so the UI can
   *  merge chunks. Claude doesn't send a messageId today — we
   *  synthesize one and share it across consecutive text-only
   *  assistant events (Cursor's --stream-partial-output emits
   *  deltas as many separate events; we want them in one bubble).
   *  Rotated on tool_use, onUser, or onResult. */
  private currentAssistantMessageId: string | null = null;
  private currentUserMessageId: string | null = null;
  /** Running concatenation of text we've already emitted under
   *  `currentAssistantMessageId`. Used to detect Cursor's final
   *  full-text event (which arrives after a chain of partial deltas
   *  and would otherwise re-emit the entire message a second time). */
  private emittedAssistantText = "";

  private lastStopReason: string = "end_turn";
  private hasSeenResult = false;

  /** Claude's session id from the `system.init` event. Kept for
   *  resume bookkeeping; not emitted to the UI. */
  claudeSessionId: string | null = null;

  constructor(opts: ClaudeTranslatorOptions) {
    this.sessionId = opts.sessionId;
    this.emit = opts.emit;
    this.onUnknown = opts.onUnknown;
  }

  /** Feed a parsed JSON event from Claude's stdout. */
  feed(event: unknown): void {
    if (!isObj(event) || typeof event.type !== "string") {
      this.onUnknown?.(event);
      return;
    }
    switch (event.type) {
      case "system":
        this.onSystem(event as unknown as ClaudeSystemInitEvent);
        break;
      case "user":
        this.onUser(event as unknown as ClaudeMessageEvent);
        break;
      case "assistant":
        this.onAssistant(event as unknown as ClaudeMessageEvent);
        break;
      case "result":
        this.onResult(event as unknown as ClaudeResultEvent);
        break;
      default:
        this.onUnknown?.(event);
    }
  }

  /** Retrieve the last terminal reason the translator saw. Defaults
   *  to "end_turn" until a `result` event arrives. */
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

  get sawResult(): boolean {
    return this.hasSeenResult;
  }

  // ── System init ─────────────────────────────────────────
  private onSystem(event: ClaudeSystemInitEvent): void {
    if (event.subtype === "init" && typeof event.session_id === "string") {
      this.claudeSessionId = event.session_id;
    }
    // Nothing to emit to the UI — the init event is just bookkeeping.
  }

  // ── User turn (echo + tool results) ─────────────────────
  //
  // Claude echoes the user prompt back as a `{"type":"user"}` event,
  // and sends tool results as subsequent `{"type":"user"}` events
  // with a tool_result content block. We distinguish by block type.
  private onUser(event: ClaudeMessageEvent): void {
    // A user event ends the previous assistant message logically — the
    // next assistant chunk should start a fresh bubble even if it's
    // text-only (e.g. tool result → assistant continues with more text).
    this.currentAssistantMessageId = null;
    this.emittedAssistantText = "";

    const blocks = event.message?.content ?? [];
    // Echo of the user prompt — a fresh user message.
    const userTextBlocks = blocks.filter(
      (b) => b.type === "text" && typeof b.text === "string",
    );
    if (userTextBlocks.length > 0) {
      this.currentUserMessageId = randomUUID();
      for (const b of userTextBlocks) {
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "user_message_chunk",
            content: {
              type: "text",
              text: b.text ?? "",
            } as ContentBlock,
            messageId: this.currentUserMessageId,
          },
        });
      }
    }

    // Tool results — emit as tool_call_update with completed status.
    for (const b of blocks) {
      if (b.type !== "tool_result") continue;
      const tool = b as unknown as ClaudeToolResultBlock;
      const toolCallId = this.toolCallIds.get(tool.tool_use_id)
        ?? tool.tool_use_id;
      const text = toolResultText(tool);
      this.emit({
        sessionId: this.sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId,
          status: tool.is_error ? "failed" : "completed",
          rawOutput: tool.content,
          content: text
            ? [{ type: "content", content: { type: "text", text } as ContentBlock }]
            : null,
        },
      });
    }
  }

  // ── Assistant turn (thinking, text, tool_use) ───────────
  private onAssistant(event: ClaudeMessageEvent): void {
    const blocks = event.message?.content ?? [];

    // Claude emits one assistant event per turn with the full text in
    // one block — a single messageId per call is correct.
    //
    // Cursor (which reuses this translator) with --stream-partial-output
    // emits MANY assistant events per turn, each carrying a single text
    // block holding a delta. If we mint a fresh UUID per call, every
    // word becomes its own bubble. So: reuse the same messageId across
    // consecutive text-only assistant events, and rotate it whenever a
    // boundary fires (tool_use seen here, or onUser / onResult elsewhere).
    const isTextOnly = blocks.every(
      (b) => b.type === "text" || b.type === "thinking",
    );
    if (!this.currentAssistantMessageId || !isTextOnly) {
      this.currentAssistantMessageId = randomUUID();
      this.emittedAssistantText = "";
    }

    for (const block of blocks) {
      if (block.type === "thinking" && typeof block.thinking === "string") {
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "agent_thought_chunk",
            content: { type: "text", text: block.thinking } as ContentBlock,
            messageId: this.currentAssistantMessageId,
          },
        });
      } else if (block.type === "text" && typeof block.text === "string") {
        const text = block.text;
        // Cursor's --stream-partial-output protocol: many partial
        // events with `timestamp_ms` carry small deltas, then ONE
        // final event without `timestamp_ms` carries the full text.
        // The final's text equals what we've already streamed, so
        // we'd emit the same content twice. Detect three cases:
        //   1. text === running    → exact duplicate (Cursor final), skip
        //   2. text startsWith(running) → text is "running + new"; emit only the new part
        //   3. else                → fresh content (Claude single-shot, or first
        //                            chunk after a rotated id); emit and append
        let toEmit: string;
        if (text === this.emittedAssistantText) {
          continue;
        } else if (
          this.emittedAssistantText.length > 0 &&
          text.startsWith(this.emittedAssistantText)
        ) {
          toEmit = text.slice(this.emittedAssistantText.length);
          this.emittedAssistantText = text;
        } else {
          toEmit = text;
          this.emittedAssistantText += text;
        }
        if (!toEmit) continue;
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: toEmit } as ContentBlock,
            messageId: this.currentAssistantMessageId,
          },
        });
      } else if (
        block.type === "tool_use" &&
        typeof block.id === "string" &&
        typeof block.name === "string"
      ) {
        // Tool use ends the current logical message — next text stream
        // is a separate reply.
        this.currentAssistantMessageId = null;
        this.emittedAssistantText = "";
        const toolCallId = randomUUID();
        this.toolCallIds.set(block.id, toolCallId);
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "tool_call",
            toolCallId,
            title: describeTool(block.name, block.input),
            kind: mapToolKind(block.name),
            status: "in_progress",
            rawInput: block.input,
          },
        });
      }
    }
  }

  // ── Result (final) ──────────────────────────────────────
  private onResult(event: ClaudeResultEvent): void {
    this.hasSeenResult = true;
    // Turn boundary — any text after this should bubble separately.
    this.currentAssistantMessageId = null;
    this.emittedAssistantText = "";
    if (event.is_error) {
      this.lastStopReason = "refusal";
    } else if (event.subtype === "error_max_turns") {
      this.lastStopReason = "max_turn_requests";
    } else {
      this.lastStopReason = "end_turn";
    }

    // UsageUpdate is "how full is the context window". Claude's
    // result.usage gives per-turn API costs. Best-effort map:
    //   - used  = input_tokens + cache-read (what Claude just saw)
    //   - size  = model's context window (Claude 4.x = 200k; 1M on
    //             opus-4-7 [1m] variant. We default to 200k; the UI
    //             shows approximate fill.)
    // Not perfect but better than nothing — users see usage grow as
    // the conversation extends.
    const u = event.usage;
    if (u) {
      const used =
        (u.input_tokens ?? 0) +
        (u.cache_read_input_tokens ?? 0) +
        (u.cache_creation_input_tokens ?? 0);
      this.emit({
        sessionId: this.sessionId,
        update: {
          sessionUpdate: "usage_update",
          size: CLAUDE_DEFAULT_CONTEXT_WINDOW,
          used,
          cost: typeof event.total_cost_usd === "number"
            ? ({ totalCostUsd: event.total_cost_usd } as never)
            : null,
        } as never,
      });
    }
  }
}

// Claude 4.x default context. Overridden in Phase 1.5b when we
// inspect the SessionInit event's model id and pick the right cap
// (opus-4-7[1m] = 1_000_000; sonnet = 200_000).
const CLAUDE_DEFAULT_CONTEXT_WINDOW = 200_000;

// ── helpers ──────────────────────────────────────────────

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function toolResultText(t: ClaudeToolResultBlock): string {
  if (typeof t.content === "string") return t.content;
  if (Array.isArray(t.content)) {
    return t.content
      .map((c) => (typeof c?.text === "string" ? c.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/**
 * Short human-readable title for the tool-call pill. Matches the
 * phrasing the UI uses for ToolCall titles — "Reading file",
 * "Running shell command", etc.
 */
function describeTool(name: string, input: unknown): string {
  const inp = isObj(input) ? input : {};
  switch (name) {
    case "Read":
    case "ReadFile":
      return `Reading ${inp.file_path ?? inp.path ?? "file"}`;
    case "Edit":
    case "Write":
      return `Editing ${inp.file_path ?? inp.path ?? "file"}`;
    case "Bash":
      return `Running ${typeof inp.command === "string"
        ? truncate(inp.command, 60)
        : "shell command"}`;
    case "Glob":
      return `Searching for ${inp.pattern ?? "files"}`;
    case "Grep":
      return `Grep ${truncate(String(inp.pattern ?? ""), 40)}`;
    case "WebFetch":
      return `Fetching ${inp.url ?? "URL"}`;
    case "TodoWrite":
      return "Updating plan";
    default:
      return name;
  }
}

/** Coarse ToolKind categorization. */
function mapToolKind(name: string): ToolKind {
  if (/^Read$/i.test(name)) return "read";
  if (/^(Glob|Grep|LS)$/i.test(name)) return "search";
  if (/^WebSearch$/i.test(name)) return "web_search";
  if (/^(Edit|Write)$/i.test(name)) return "edit";
  if (/^Bash$/i.test(name)) return "execute";
  if (/^WebFetch$/i.test(name)) return "fetch";
  if (/^Task$/i.test(name)) return "subagent";
  if (/^AskUserQuestion$/i.test(name)) return "question";
  // MCP-prefixed tool names: `mcp__<server>__<tool>`. Anthropic's
  // convention. Surface as `mcp` so the dedicated card renders.
  if (/^mcp__/i.test(name)) return "mcp";
  return "other";
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
