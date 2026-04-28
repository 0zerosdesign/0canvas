// ──────────────────────────────────────────────────────────
// OpenCode SSE bus → SessionNotification translator
// ──────────────────────────────────────────────────────────
//
// Stage 8.5 Slice 2. Verified against opencode 1.14.28 running
// `opencode serve` with the free hosted models (no provider auth
// required to capture the fixture — the `opencode` provider ships
// free models like `big-pickle`).
//
// Event envelope: every bus event is `{type, properties}` over SSE.
// We drop `server.heartbeat` and `session.diff` (chrome metadata).
//
// Top-level event types observed:
//
//   server.connected        — initial bus handshake; no-op
//   server.heartbeat        — keepalive; no-op
//   session.updated         — session metadata sync; currentModeId etc.
//   session.status          — {type: "busy"|"idle"} status pulse
//   session.idle            — alternative form of "turn complete"
//   session.diff            — file changes summary; deferred (run-summary)
//   message.updated         — message lifecycle (created → tokens →
//                             completed). assistant messages pass through
//                             this with finish:"stop" + time.completed
//                             at end of turn
//   message.part.updated    — part lifecycle. part.type ∈ {text, tool,
//                             step-start, reasoning?}; tool parts have
//                             state.status pending/running/completed/error
//   message.part.delta      — streaming delta {field:"text"|"reasoning",
//                             delta:"..."}
//   permission.asked        — {id, permission, patterns, metadata, always,
//                             tool:{messageID, callID}}
//
// What we emit:
//
//   message.part.delta (field=text)              → agent_message_chunk
//   message.part.delta (field=reasoning)         → agent_thought_chunk
//   message.part.updated (part.type=text, final) → flushed message_chunk
//   message.part.updated (part.type=tool, started)   → tool_call
//   message.part.updated (part.type=tool, in-progress) → tool_call_update
//   message.part.updated (part.type=tool, completed)   → tool_call_update
//   permission.asked                              → permission_request
//                                                   (Slice 3 wires the
//                                                   matching response)
//   session.idle / session.status:idle           → turn-end signal
//                                                   (sets sawTerminal)
//
// step-start parts are timeline boundaries (each tool step opens with
// one). They're not user-visible; we drop them.
//
// ──────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";

import type { ContentBlock, SessionNotification } from "../../types";

type ToolKind =
  | "read" | "edit" | "delete" | "move" | "search" | "web_search"
  | "execute" | "think" | "fetch" | "switch_mode"
  | "subagent" | "mcp" | "question" | "other";

type Emit = (notification: SessionNotification) => void;

interface OpencodeBusEvent {
  type: string;
  properties?: Record<string, unknown>;
}

interface MessagePartDeltaProps {
  sessionID: string;
  messageID: string;
  partID: string;
  field: "text" | "reasoning";
  delta: string;
}

interface MessagePartUpdatedProps {
  sessionID: string;
  part: OpencodePart;
  time?: number;
}

interface OpencodePart {
  id: string;
  messageID: string;
  sessionID: string;
  type: string;
  // text part
  text?: string;
  // tool part
  tool?: string;
  callID?: string;
  state?: {
    status?: "pending" | "running" | "completed" | "error";
    input?: Record<string, unknown>;
    output?: unknown;
    title?: string;
    metadata?: Record<string, unknown>;
    error?: string;
    raw?: string;
    time?: { start?: number; end?: number };
  };
}

interface PermissionAskedProps {
  id: string;
  sessionID: string;
  permission: string;
  patterns?: string[];
  metadata?: Record<string, unknown>;
  always?: string[];
  tool?: { messageID?: string; callID?: string };
}

export interface OpencodeTranslatorOptions {
  sessionId: string;
  emit: Emit;
  onUnknown?: (event: unknown) => void;
  /** Called when a permission request arrives. Slice 3 wires this to
   *  the inline permission cluster + POST /permission/respond. */
  onPermission?: (props: PermissionAskedProps) => void;
}

export class OpencodeBusTranslator {
  private readonly sessionId: string;
  private readonly emit: Emit;
  private readonly onUnknown?: (event: unknown) => void;
  private readonly onPermission?: (props: PermissionAskedProps) => void;

  /** OpenCode part-id → Zeros toolCallId. tool parts go through several
   *  state transitions; the part-id is stable across all of them. */
  private readonly toolCallIds = new Map<string, string>();

  /** Set of OpenCode part-ids we've already started a tool_call for, so
   *  the second/third "updated" doesn't emit a new card. */
  private readonly startedTools = new Set<string>();

  /** Tracks how much of a streaming text/reasoning part we've already
   *  emitted. OpenCode's `message.part.delta` events are append-only
   *  but `message.part.updated` carries the full accumulated text on
   *  finalization — without this dedup we'd render the body twice. */
  private readonly emittedTextLen = new Map<string, number>();

  /** OpenCode messageID → role. `message.updated` carries this; we
   *  use it to skip echoing the user's own prompt back as an agent
   *  message, since OpenCode emits a `message.part.updated` for the
   *  user's text input the same way it does for assistant replies. */
  private readonly messageRoles = new Map<string, "user" | "assistant">();

  private hasSeenTerminal = false;

  constructor(opts: OpencodeTranslatorOptions) {
    this.sessionId = opts.sessionId;
    this.emit = opts.emit;
    this.onUnknown = opts.onUnknown;
    this.onPermission = opts.onPermission;
  }

  feed(event: unknown): void {
    if (!isObj(event) || typeof event.type !== "string") {
      this.onUnknown?.(event);
      return;
    }
    const props = isObj(event.properties)
      ? (event.properties as Record<string, unknown>)
      : {};

    switch (event.type) {
      case "server.connected":
      case "server.heartbeat":
      case "session.diff":
        return;

      case "message.updated": {
        // Capture role for messageID → role lookups so we can skip
        // the user-echo case. Token totals + completion time are
        // surfaced via session.status / session.idle terminals; the
        // mid-turn metadata isn't user-visible.
        const info = isObj(props.info)
          ? (props.info as { id?: string; role?: string })
          : null;
        if (
          info &&
          typeof info.id === "string" &&
          (info.role === "user" || info.role === "assistant")
        ) {
          this.messageRoles.set(info.id, info.role);
        }
        return;
      }

      case "session.updated":
        // Session metadata sync (mode changes, title updates). No
        // user-visible event today; mode changes will be wired in
        // Slice 3 via the canonical mode_switch event.
        return;

      case "session.status": {
        const status = isObj(props.status)
          ? (props.status as { type?: string }).type
          : undefined;
        if (status === "idle") this.hasSeenTerminal = true;
        return;
      }

      case "session.idle":
        this.hasSeenTerminal = true;
        return;

      case "message.part.delta":
        this.onPartDelta(props as unknown as MessagePartDeltaProps);
        return;

      case "message.part.updated":
        this.onPartUpdated(props as unknown as MessagePartUpdatedProps);
        return;

      case "permission.asked":
        this.onPermissionAsked(props as unknown as PermissionAskedProps);
        return;

      default:
        this.onUnknown?.(event);
    }
  }

  get sawTerminal(): boolean {
    return this.hasSeenTerminal;
  }

  get stopReason(): "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled" {
    return "end_turn";
  }

  // ── handlers ────────────────────────────────────────────

  private onPartDelta(props: MessagePartDeltaProps): void {
    if (typeof props.delta !== "string" || props.delta.length === 0) return;
    // Skip user-message deltas (Zeros already shows the prompt
    // locally; without this filter the user's own text echoes back
    // as an agent_message_chunk and renders twice).
    if (this.messageRoles.get(props.messageID) === "user") return;
    const isReasoning = props.field === "reasoning";
    // Track cumulative emitted length so the matching `message.part.
    // updated` (which carries the FULL accumulated text) doesn't
    // re-emit what we already streamed.
    const prev = this.emittedTextLen.get(props.partID) ?? 0;
    this.emittedTextLen.set(props.partID, prev + props.delta.length);
    this.emit({
      sessionId: this.sessionId,
      update: {
        sessionUpdate: isReasoning
          ? "agent_thought_chunk"
          : "agent_message_chunk",
        content: { type: "text", text: props.delta } as ContentBlock,
        // Stable per-part id so the renderer coalesces all deltas of
        // the same logical bubble.
        messageId: `oc-${props.partID}`,
      },
    });
  }

  private onPartUpdated(props: MessagePartUpdatedProps): void {
    const part = props.part;
    if (!isObj(part)) return;

    if (part.type === "step-start") {
      // Timeline boundary — not user-visible. Drop.
      return;
    }

    if (part.type === "text") {
      // Skip the user's own prompt — see onPartDelta for why.
      if (this.messageRoles.get(part.messageID) === "user") return;
      // Some opencode flows emit a text part as a single full update
      // without preceding deltas. In that case we have no record of
      // what we've emitted, so flush the entire body. When deltas
      // already streamed, emittedTextLen tells us how much to skip.
      const fullText = typeof part.text === "string" ? part.text : "";
      const already = this.emittedTextLen.get(part.id) ?? 0;
      if (fullText.length > already) {
        const tail = fullText.slice(already);
        this.emittedTextLen.set(part.id, fullText.length);
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: tail } as ContentBlock,
            messageId: `oc-${part.id}`,
          },
        });
      }
      return;
    }

    if (part.type === "tool") {
      this.onToolPartUpdated(part);
      return;
    }

    if (part.type === "reasoning") {
      // Same posture as text — flush whatever's new.
      const fullText = typeof part.text === "string" ? part.text : "";
      const already = this.emittedTextLen.get(part.id) ?? 0;
      if (fullText.length > already) {
        const tail = fullText.slice(already);
        this.emittedTextLen.set(part.id, fullText.length);
        this.emit({
          sessionId: this.sessionId,
          update: {
            sessionUpdate: "agent_thought_chunk",
            content: { type: "text", text: tail } as ContentBlock,
            messageId: `oc-${part.id}`,
          },
        });
      }
      return;
    }
  }

  private onToolPartUpdated(part: OpencodePart): void {
    const partId = part.id;
    const toolName = typeof part.tool === "string" ? part.tool : "tool";
    const status = part.state?.status ?? "pending";
    const args = part.state?.input ?? null;

    if (!this.startedTools.has(partId)) {
      this.startedTools.add(partId);
      const toolCallId = this.ensureToolCallId(partId);
      const mergeKey = computeMergeKey(toolName, args);
      this.emit({
        sessionId: this.sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId,
          title: describeTool(toolName, args, part.state?.title),
          kind: mapToolKind(toolName),
          status: "in_progress",
          rawInput: args,
          ...(mergeKey ? { mergeKey } : {}),
        },
      });
    }

    if (status === "completed" || status === "error") {
      const toolCallId = this.toolCallIds.get(partId);
      if (!toolCallId) return;
      this.emit({
        sessionId: this.sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId,
          status: status === "error" ? "failed" : "completed",
          rawOutput:
            status === "error"
              ? { error: part.state?.error ?? "tool failed" }
              : (part.state?.output ?? null),
        },
      });
      this.toolCallIds.delete(partId);
      this.startedTools.delete(partId);
    } else if (status === "running") {
      const toolCallId = this.toolCallIds.get(partId);
      if (!toolCallId) return;
      this.emit({
        sessionId: this.sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId,
          status: "in_progress",
          rawOutput: part.state?.output ?? null,
        },
      });
    }
  }

  private onPermissionAsked(props: PermissionAskedProps): void {
    // Forward to the adapter's permission handler. Slice 3 wires this
    // to ctx.emit.onSessionUpdate's permission_request channel + the
    // POST /permission/{id}/respond reply path. For now, we just hand
    // the raw payload up.
    this.onPermission?.(props);
  }

  // ── helpers ─────────────────────────────────────────────

  private ensureToolCallId(partId: string): string {
    const cached = this.toolCallIds.get(partId);
    if (cached) return cached;
    const id = randomUUID();
    this.toolCallIds.set(partId, id);
    return id;
  }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/** Map OpenCode's tool names → canonical ToolKind. Per §2.3 mapping
 *  table + observed in real fixtures (`read`, `edit`, `bash`, etc.). */
function mapToolKind(name: string): ToolKind {
  if (/^read$/i.test(name)) return "read";
  if (/^(edit|write|apply_patch)$/i.test(name)) return "edit";
  if (/^(grep|glob|codesearch)$/i.test(name)) return "search";
  if (/^bash$/i.test(name)) return "execute";
  if (/^webfetch$/i.test(name)) return "fetch";
  if (/^websearch$/i.test(name)) return "web_search";
  if (/^todowrite$/i.test(name)) return "other"; // intercepted to plan
  if (/^task$/i.test(name)) return "subagent";
  if (/^skill$/i.test(name)) return "switch_mode";
  if (/^mcp__/i.test(name)) return "mcp";
  return "other";
}

function describeTool(
  name: string,
  args: unknown,
  hintTitle?: string,
): string {
  if (typeof hintTitle === "string" && hintTitle.length > 0) return hintTitle;
  const a = isObj(args) ? args : {};
  switch (name) {
    case "read":
      return `Reading ${a.filePath ?? a.path ?? a.file_path ?? "file"}`;
    case "edit":
    case "write":
    case "apply_patch":
      return `Editing ${a.filePath ?? a.path ?? a.file_path ?? "file"}`;
    case "bash":
      return `Running ${
        typeof a.command === "string" ? truncate(a.command, 60) : "shell command"
      }`;
    case "grep":
      return `Grep ${truncate(String(a.pattern ?? a.query ?? ""), 40)}`;
    case "glob":
      return `Searching for ${a.pattern ?? "files"}`;
    case "webfetch":
      return `Fetching ${a.url ?? "URL"}`;
    case "websearch":
      return `Searching ${truncate(String(a.query ?? ""), 40)}`;
    case "task":
      return `Subagent ${truncate(String(a.description ?? a.prompt ?? ""), 40)}`;
    case "todowrite":
      return "Updating plan";
    default:
      return name;
  }
}

function computeMergeKey(name: string, args: unknown): string | null {
  if (!/^(edit|write|apply_patch)$/i.test(name)) return null;
  const a = isObj(args) ? args : {};
  const path = typeof a.filePath === "string"
    ? a.filePath
    : typeof a.path === "string"
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
