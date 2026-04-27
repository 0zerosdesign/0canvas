// ──────────────────────────────────────────────────────────
// GitHub Copilot CLI stream-json → SessionNotification translator
// ──────────────────────────────────────────────────────────
//
// Verified Stage 8.4 against `copilot 1.0.36` running with
// `copilot -p <prompt> --output-format json --allow-all-tools`.
//
// Event envelope (every event):
//   {type, data, id, timestamp, parentId?, ephemeral?: true}
//
// Events flagged `ephemeral: true` are intermediate state — text
// deltas, MCP-status churn, internal turn-start markers, etc. We
// skip every ephemeral event and consume only the non-ephemeral
// finalization events (the consolidated `assistant.message` /
// `assistant.reasoning` / `tool.execution_*` / `result`). This is
// the same posture our Cursor and Droid translators take and gives
// the renderer one bubble per logical segment instead of N tiny
// bubbles.
//
// Non-ephemeral event shapes:
//
//   {type: "user.message", data: {content, transformedContent, ...}}
//     — echo of the prompt; ignored.
//
//   {type: "assistant.message",
//    data: {messageId, content, toolRequests, interactionId,
//           reasoningOpaque, reasoningText, ...}}
//     — finalized assistant text bubble. content is the full string.
//
//   {type: "assistant.reasoning",
//    data: {reasoningId, content}}
//     — finalized reasoning block. Renders as an agent_thought_chunk.
//
//   {type: "tool.execution_start",
//    data: {toolCallId, toolName, arguments}}
//     — start of a tool call. toolName ∈ {view, edit, bash, ...}
//       arguments differ per tool: view {path}, edit {path, old_str,
//       new_str}, bash {command, description}.
//
//   {type: "tool.execution_complete",
//    data: {toolCallId, success, result?, error?, toolTelemetry?}}
//     — tool finished. success: true → result.content + .detailedContent
//       (the latter has a unified diff for `edit`); success: false →
//       error.message + error.code.
//
//   {type: "result",
//    data: {sessionId, exitCode, usage}}
//     — terminal event. sessionId becomes the --resume target for
//     follow-up turns.
//
// Tool name set (from the documented Copilot CLI tool surface +
// our captured fixture):
//   view → read
//   edit → edit (also create/write/replace if Copilot ever ships them)
//   bash → execute
//   grep / glob → search
//   fetch / web → fetch / web_search (not yet observed)
//
// ──────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";

import type { ContentBlock, SessionNotification } from "../../types";

type ToolKind =
  | "read" | "edit" | "delete" | "move" | "search" | "web_search"
  | "execute" | "think" | "fetch" | "switch_mode"
  | "subagent" | "mcp" | "question" | "other";

type Emit = (notification: SessionNotification) => void;

interface CopilotEnvelope<TType extends string, TData> {
  type: TType;
  data: TData;
  id?: string;
  timestamp?: string;
  parentId?: string;
  ephemeral?: boolean;
}

interface CopilotAssistantMessageEvent
  extends CopilotEnvelope<
    "assistant.message",
    {
      messageId: string;
      content: string;
      toolRequests?: unknown[];
      interactionId?: string;
    }
  > {}

interface CopilotAssistantReasoningEvent
  extends CopilotEnvelope<
    "assistant.reasoning",
    {
      reasoningId: string;
      content: string;
    }
  > {}

interface CopilotToolExecutionStartEvent
  extends CopilotEnvelope<
    "tool.execution_start",
    {
      toolCallId: string;
      toolName: string;
      arguments?: Record<string, unknown>;
    }
  > {}

interface CopilotToolExecutionCompleteEvent
  extends CopilotEnvelope<
    "tool.execution_complete",
    {
      toolCallId: string;
      success: boolean;
      result?: { content?: string; detailedContent?: string };
      error?: { message?: string; code?: string };
    }
  > {}

interface CopilotResultEvent
  extends CopilotEnvelope<
    "result",
    {
      sessionId?: string;
      exitCode?: number;
      usage?: unknown;
    }
  > {}

export interface CopilotTranslatorOptions {
  sessionId: string;
  emit: Emit;
  onUnknown?: (event: unknown) => void;
}

export class CopilotStreamTranslator {
  private readonly sessionId: string;
  private readonly emit: Emit;
  private readonly onUnknown?: (event: unknown) => void;

  /** Copilot's session id captured from the terminal `result` event.
   *  Used by spec.ts to set `--resume <id>` on subsequent prompts. */
  copilotSessionId: string | null = null;

  /** Per-translator instance prefix. We bucket all reasoning text
   *  in this turn into one consistent messageId so the renderer
   *  treats the whole turn's thinking as one block, even though
   *  Copilot may emit several `assistant.reasoning` events. */
  private readonly turnPrefix: string = randomUUID();

  /** Copilot toolCallId → Zeros toolCallId. tool.execution_complete
   *  correlates back via toolCallId. */
  private readonly toolCallIds = new Map<string, string>();

  /** toolCallId → toolName captured at start so we can build a
   *  failed-card title even if completion arrives without any name
   *  hint of its own. */
  private readonly toolNames = new Map<string, string>();

  private hasSeenResult = false;

  constructor(opts: CopilotTranslatorOptions) {
    this.sessionId = opts.sessionId;
    this.emit = opts.emit;
    this.onUnknown = opts.onUnknown;
  }

  feed(event: unknown): void {
    if (!isObj(event) || typeof event.type !== "string") {
      this.onUnknown?.(event);
      return;
    }
    // Streaming-delta events are dropped (we get the consolidated
    // version separately). NOT all ephemeral events are deltas —
    // `assistant.reasoning` is flagged ephemeral but IS the
    // finalized reasoning text for its turn (Copilot 1.0.36 quirk),
    // so we have to keep ephemeral events that aren't named *_delta.
    const t = event.type;
    if (t.endsWith("_delta")) return;

    switch (t) {
      case "user.message":
        // No-op — Zeros already shows the user's prompt locally.
        break;
      case "assistant.turn_start":
      case "assistant.turn_end":
        // Logical-turn boundaries. Useful for analytics later; not
        // user-visible for now.
        break;
      case "assistant.message":
        this.onAssistantMessage(event as unknown as CopilotAssistantMessageEvent);
        break;
      case "assistant.reasoning":
        this.onAssistantReasoning(
          event as unknown as CopilotAssistantReasoningEvent,
        );
        break;
      case "tool.execution_start":
        this.onToolExecutionStart(
          event as unknown as CopilotToolExecutionStartEvent,
        );
        break;
      case "tool.execution_complete":
        this.onToolExecutionComplete(
          event as unknown as CopilotToolExecutionCompleteEvent,
        );
        break;
      case "result":
        this.onResult(event as unknown as CopilotResultEvent);
        break;
      default:
        // session.* events (mcp loaded, skills loaded, tools updated,
        // background tasks) are mostly chrome metadata. Drop without
        // logging — onUnknown was getting noisy.
        if (typeof event.type === "string" && event.type.startsWith("session.")) {
          break;
        }
        this.onUnknown?.(event);
    }
  }

  get sawTerminal(): boolean {
    return this.hasSeenResult;
  }

  get stopReason(): "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled" {
    return "end_turn";
  }

  // ── handlers ────────────────────────────────────────────

  private onAssistantMessage(event: CopilotAssistantMessageEvent): void {
    const text = event.data?.content;
    if (typeof text !== "string" || text.length === 0) return;
    const id = event.data.messageId ?? randomUUID();
    this.emit({
      sessionId: this.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text } as ContentBlock,
        messageId: `${this.turnPrefix}-msg-${id}`,
      },
    });
  }

  private onAssistantReasoning(event: CopilotAssistantReasoningEvent): void {
    const text = event.data?.content;
    if (typeof text !== "string" || text.length === 0) return;
    this.emit({
      sessionId: this.sessionId,
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text } as ContentBlock,
        messageId: `${this.turnPrefix}-thought`,
      },
    });
  }

  private onToolExecutionStart(event: CopilotToolExecutionStartEvent): void {
    const { toolCallId: copilotId, toolName, arguments: args } = event.data;
    if (typeof toolName !== "string" || typeof copilotId !== "string") return;

    const toolCallId = this.ensureToolCallId(copilotId);
    this.toolNames.set(copilotId, toolName);
    const mergeKey = computeMergeKey(toolName, args);
    this.emit({
      sessionId: this.sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: describeTool(toolName, args),
        kind: mapToolKind(toolName),
        status: "in_progress",
        rawInput: args ?? null,
        ...(mergeKey ? { mergeKey } : {}),
      },
    });
  }

  private onToolExecutionComplete(
    event: CopilotToolExecutionCompleteEvent,
  ): void {
    const { toolCallId: copilotId, success, result, error } = event.data;
    if (typeof copilotId !== "string") return;
    const cached = this.toolCallIds.get(copilotId);
    if (!cached) return;

    const rawOutput = success
      ? (result ?? null)
      : { error: error?.message ?? "tool failed", code: error?.code };

    this.emit({
      sessionId: this.sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: cached,
        status: success ? "completed" : "failed",
        rawOutput,
      },
    });
    this.toolCallIds.delete(copilotId);
    this.toolNames.delete(copilotId);
  }

  private onResult(event: CopilotResultEvent): void {
    this.hasSeenResult = true;
    // Copilot's `result` event puts sessionId at the top level
    // (not under `data`), unlike most other event kinds. Look in
    // both spots so we don't miss it if Copilot ever moves it.
    const top = (event as unknown as { sessionId?: unknown }).sessionId;
    const sid =
      typeof top === "string"
        ? top
        : typeof event.data?.sessionId === "string"
        ? event.data.sessionId
        : null;
    if (sid) {
      this.copilotSessionId = sid;
    }
  }

  // ── helpers ─────────────────────────────────────────────

  private ensureToolCallId(copilotId: string): string {
    const cached = this.toolCallIds.get(copilotId);
    if (cached) return cached;
    const id = randomUUID();
    this.toolCallIds.set(copilotId, id);
    return id;
  }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function mapToolKind(name: string): ToolKind {
  if (/^view$/i.test(name)) return "read";
  if (/^(edit|create|write|replace)$/i.test(name)) return "edit";
  if (/^bash$/i.test(name)) return "execute";
  if (/^(grep|glob|search)$/i.test(name)) return "search";
  if (/^(fetch|web_fetch)$/i.test(name)) return "fetch";
  if (/^(web_search)$/i.test(name)) return "web_search";
  if (/^mcp__/i.test(name)) return "mcp";
  return "other";
}

function describeTool(name: string, args: unknown): string {
  const a = isObj(args) ? args : {};
  switch (name) {
    case "view":
      return `Reading ${a.path ?? "file"}`;
    case "edit":
    case "create":
    case "write":
    case "replace":
      return `Editing ${a.path ?? a.file_path ?? "file"}`;
    case "bash":
      return `Running ${
        typeof a.command === "string" ? truncate(a.command, 60) : "shell command"
      }`;
    case "grep":
      return `Grep ${truncate(String(a.pattern ?? a.query ?? ""), 40)}`;
    case "glob":
      return `Searching for ${a.pattern ?? "files"}`;
    default:
      return name;
  }
}

function computeMergeKey(name: string, args: unknown): string | null {
  if (!/^(edit|create|write|replace)$/i.test(name)) return null;
  const a = isObj(args) ? args : {};
  const path = typeof a.path === "string"
    ? a.path
    : typeof a.file_path === "string"
    ? a.file_path
    : null;
  return path ? `edit:${path}` : null;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
