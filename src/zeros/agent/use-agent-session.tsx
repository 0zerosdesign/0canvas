// ──────────────────────────────────────────────────────────
// useAgentSession — renderer-side agent session over the engine bridge
// ──────────────────────────────────────────────────────────
//
// Thin React hook on top of CanvasBridgeClient. It manages:
//   - registry fetch / agent selection
//   - session creation with an agent
//   - prompt send / cancel
//   - consumption of AGENT_SESSION_UPDATE notifications
//   - permission-prompt round-trip
//
// It does NOT interpret tool-call kinds or render anything — UI
// components consume the state slices this hook exposes.
// ──────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AvailableCommand,
  ContentBlock,
  InitializeResponse,
  NewSessionResponse,
  PlanEntry,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionMode,
  SessionNotification,
  StopReason,
  ToolCall,
  ToolCallUpdate,
} from "../bridge/agent-events";
import type {
  AgentAgentsListMessage,
  AgentAgentInitializedMessage,
  AgentErrorMessage,
  AgentPromptCompleteMessage,
  AgentPromptFailedMessage,
  AgentSessionCreatedMessage,
  BridgeRegistryAgent,
} from "../bridge/messages";
import { useBridge } from "../bridge/use-bridge";

export type AgentMessageRole = "user" | "agent" | "thought" | "system";

export interface AgentTextMessage {
  id: string;
  kind: "text";
  role: AgentMessageRole;
  text: string;
  createdAt: number;
  /** Engine-side message id from the SessionNotification chunk. Used
   *  to coalesce streaming chunks of the SAME message; differs across
   *  turns, so without this every turn's agent reply would merge into
   *  one growing bubble (the symptom that surfaced after we fixed the
   *  Codex stdin hang and turns started actually completing). */
  messageId?: string;
}

export interface AgentToolMessage {
  id: string;
  kind: "tool";
  toolCallId: string;
  title: string;
  toolKind: string | undefined;
  status: "pending" | "in_progress" | "completed" | "failed";
  content?: ToolCall["content"];
  locations?: ToolCall["locations"];
  rawInput?: unknown;
  rawOutput?: unknown;
  createdAt: number;
  updatedAt: number;
}

export type AgentMessage = AgentTextMessage | AgentToolMessage;

export interface PendingPermission {
  permissionId: string;
  agentId: string;
  request: RequestPermissionRequest;
}

export type SessionStatus =
  | "idle"           // no agent bound yet
  | "warming"        // agent initialize / newSession in flight, within budget
  | "ready"          // session created, no prompt running
  | "streaming"      // prompt turn in progress
  | "reconnecting"   // transient loss; engine's respawn pool is reviving
  | "auth-required"  // agent needs sign-in before we can connect
  | "failed";        // terminal error; user action needed

/** Token accounting accumulated from agent session notifications + turn
 *  completion. `size`/`used` come from `usage_update` notifications
 *  (context window view); `inputTokens`/`outputTokens` come from the
 *  PromptResponse.usage at turn end. */
export interface AgentUsage {
  /** Total context window the model is using (tokens). */
  size: number;
  /** Tokens currently in context. */
  used: number;
  /** Lifetime input tokens sent to the agent this session. */
  inputTokens: number;
  /** Lifetime output tokens emitted by the agent this session. */
  outputTokens: number;
  /** Cached token counts reported by the agent, when available. */
  cachedReadTokens: number;
  cachedWriteTokens: number;
  /** Tokens spent on reasoning / thought traces, when reported. */
  thoughtTokens: number;
}

export interface AgentSessionState {
  agentId: string | null;
  agentName: string | null;
  sessionId: string | null;
  initialize: InitializeResponse | null;
  session: NewSessionResponse | null;
  status: SessionStatus;
  messages: AgentMessage[];
  pendingPermission: PendingPermission | null;
  stderrLog: string[];
  /** Legacy free-form error message. Populated for `failed` state only —
   *  kept for backwards-compat with log viewers. Structured classification
   *  lives in `failure` and is the source of truth for UI routing. */
  error: string | null;
  /** Structured classification of the last failure. Drives the composer
   *  state chip, banner, and Sign-in button deterministically. Null
   *  whenever the session is warming/ready/streaming. */
  failure: import("../bridge/failure").AgentFailure | null;
  lastStopReason: StopReason | null;
  /** Modes advertised by the agent at session creation, if any. */
  availableModes: SessionMode[];
  /** Currently active mode id (echoed back by session/set_mode and
   *  current_mode_update notifications). */
  currentModeId: string | null;
  /** Token accounting for the context pill + usage popover. */
  usage: AgentUsage;
  /** Latest plan (todo list) the agent has produced. Replaced wholesale
   *  each time a `plan` notification arrives. Empty = no plan yet. */
  plan: PlanEntry[];
  /** Slash-command palette advertised by the agent via
   *  `available_commands_update`. Used by the composer "/" picker. */
  availableCommands: AvailableCommand[];
}

export interface StartSessionOptions {
  /** Display name to show in the chat header while the session is live. */
  agentName?: string;
  /** Env passed to the agent subprocess at spawn time (e.g. ANTHROPIC_API_KEY). */
  env?: Record<string, string>;
}

export interface AgentSessionControls {
  /** Fetch the registry. Force=true refetches from CDN. */
  listAgents(force?: boolean): Promise<BridgeRegistryAgent[]>;
  /** Spawn the agent (if needed) and return its initialize response so the
   *  auth screen can render the advertised auth methods. Lets the UI honour
   *  whatever the agent tells us without hardcoding per-vendor methods. */
  initAgent(agentId: string): Promise<InitializeResponse>;
  /** Create a new session with the given agent id. */
  startSession(agentId: string, options?: StartSessionOptions): Promise<void>;
  /** Send a user prompt. Enqueues a user message immediately.
   *  `displayText` is what the UI shows (may contain @tokens); `text` is
   *  what goes over the wire (with mentions expanded). When omitted,
   *  `text` is used for both. Optional `attachments` are protocol ContentBlocks
   *  (e.g. images) appended to the prompt after the text block. */
  sendPrompt(
    text: string,
    displayText?: string,
    attachments?: ContentBlock[],
  ): Promise<void>;
  /** Cancel the in-flight prompt (if any). */
  cancel(): Promise<void>;
  /** Resolve a pending permission request. */
  respondToPermission(response: RequestPermissionResponse): void;
  /** Change the agent session mode (calls `session/set_mode`). */
  setMode?(modeId: string): Promise<void>;
  /** Clear the session and return to idle. Does not kill the agent subprocess. */
  reset(): void;
}

const MAX_STDERR_LINES = 200;

export const BLANK_USAGE: AgentUsage = {
  size: 0,
  used: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedReadTokens: 0,
  cachedWriteTokens: 0,
  thoughtTokens: 0,
};

export function useAgentSession(): AgentSessionState & AgentSessionControls {
  const bridge = useBridge();

  const [state, setState] = useState<AgentSessionState>({
    agentId: null,
    agentName: null,
    sessionId: null,
    initialize: null,
    session: null,
    status: "idle",
    messages: [],
    pendingPermission: null,
    stderrLog: [],
    error: null,
    failure: null,
    lastStopReason: null,
    availableModes: [],
    currentModeId: null,
    usage: BLANK_USAGE,
    plan: [],
    availableCommands: [],
  });

  // Mutable view of live state, so listener callbacks don't close over stale refs.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Incoming notifications ──────────────────────────────

  useEffect(() => {
    if (!bridge) return;

    const unsubUpdate = bridge.on("AGENT_SESSION_UPDATE", (raw) => {
      const msg = raw as { agentId: string; notification: SessionNotification };
      if (msg.agentId !== stateRef.current.agentId) return;
      if (msg.notification.sessionId !== stateRef.current.sessionId) return;
      setState((prev) => ({
        ...prev,
        messages: applyUpdate(prev.messages, msg.notification),
      }));
    });

    const unsubPerm = bridge.on("AGENT_PERMISSION_REQUEST", (raw) => {
      const msg = raw as {
        agentId: string;
        permissionId: string;
        request: RequestPermissionRequest;
      };
      if (msg.agentId !== stateRef.current.agentId) return;
      setState((prev) => ({
        ...prev,
        pendingPermission: {
          agentId: msg.agentId,
          permissionId: msg.permissionId,
          request: msg.request,
        },
      }));
    });

    const unsubStderr = bridge.on("AGENT_AGENT_STDERR", (raw) => {
      const msg = raw as { agentId: string; line: string };
      if (msg.agentId !== stateRef.current.agentId) return;
      setState((prev) => ({
        ...prev,
        stderrLog: [...prev.stderrLog.slice(-(MAX_STDERR_LINES - 1)), msg.line],
      }));
    });

    const unsubExit = bridge.on("AGENT_AGENT_EXITED", (raw) => {
      const msg = raw as { agentId: string; code: number | null; signal: string | null };
      if (msg.agentId !== stateRef.current.agentId) return;
      setState((prev) => ({
        ...prev,
        status: "failed",
        error: `Agent exited (code=${msg.code ?? "null"}${msg.signal ? `, signal=${msg.signal}` : ""})`,
        messages: [
          ...prev.messages,
          {
            id: `sys-${Date.now()}`,
            kind: "text",
            role: "system",
            text: `Agent subprocess exited (${msg.code ?? "unknown"})`,
            createdAt: Date.now(),
          },
        ],
      }));
    });

    return () => {
      unsubUpdate();
      unsubPerm();
      unsubStderr();
      unsubExit();
    };
  }, [bridge]);

  // ── Controls ─────────────────────────────────────────────

  const listAgents = useCallback<AgentSessionControls["listAgents"]>(
    async (force = false) => {
      if (!bridge) return [];
      const resp = await bridge.request<AgentAgentsListMessage>(
        { type: "AGENT_LIST_AGENTS", force },
        30_000,
      );
      return resp.agents;
    },
    [bridge],
  );

  const initAgent = useCallback<AgentSessionControls["initAgent"]>(
    async (agentId) => {
      if (!bridge) throw new Error("Engine not connected");
      const resp = await bridge.request<
        AgentAgentInitializedMessage | AgentErrorMessage
      >({ type: "AGENT_INIT_AGENT", agentId }, 60_000);
      if (resp.type === "AGENT_ERROR") {
        throw new Error(resp.message);
      }
      return resp.initialize;
    },
    [bridge],
  );

  const startSession = useCallback<AgentSessionControls["startSession"]>(
    async (agentId, options) => {
      if (!bridge) throw new Error("Engine not connected");
      setState((prev) => ({
        ...prev,
        status: "warming",
        error: null,
        failure: null,
        agentId,
        agentName: options?.agentName ?? agentId,
        sessionId: null,
        session: null,
        initialize: null,
        messages: [],
        pendingPermission: null,
        stderrLog: [],
        lastStopReason: null,
        availableModes: [],
        currentModeId: null,
        usage: BLANK_USAGE,
        plan: [],
        availableCommands: [],
      }));

      try {
        const resp = await bridge.request<
          AgentSessionCreatedMessage | AgentErrorMessage
        >(
          { type: "AGENT_NEW_SESSION", agentId, env: options?.env },
          60_000,
        );

        if (resp.type === "AGENT_ERROR") {
          setState((prev) => ({
            ...prev,
            status: "failed",
            error: resp.message,
          }));
          return;
        }

        setState((prev) => ({
          ...prev,
          status: "ready",
          sessionId: resp.session.sessionId,
          session: resp.session,
          initialize: resp.initialize,
          availableModes: resp.session.modes?.availableModes ?? [],
          currentModeId: resp.session.modes?.currentModeId ?? null,
          error: null,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [bridge],
  );

  const sendPrompt = useCallback<AgentSessionControls["sendPrompt"]>(
    async (text, displayText) => {
      if (!bridge) return;
      const current = stateRef.current;
      if (!current.agentId || !current.sessionId) return;
      if (current.status === "streaming") return;

      const userMessage: AgentTextMessage = {
        id: `user-${Date.now()}`,
        kind: "text",
        role: "user",
        text: displayText ?? text,
        createdAt: Date.now(),
      };

      const prompt: ContentBlock[] = [{ type: "text", text }];

      setState((prev) => ({
        ...prev,
        status: "streaming",
        error: null,
        messages: [...prev.messages, userMessage],
      }));

      try {
        const resp = await bridge.request<
          AgentPromptCompleteMessage | AgentPromptFailedMessage
        >(
          {
            type: "AGENT_PROMPT",
            agentId: current.agentId,
            sessionId: current.sessionId,
            prompt,
          },
          10 * 60_000,
        );

        if (resp.type === "AGENT_PROMPT_FAILED") {
          setState((prev) => ({
            ...prev,
            status: "failed",
            error: resp.error,
          }));
          return;
        }

        setState((prev) => ({
          ...prev,
          status: "ready",
          lastStopReason: resp.stopReason,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [bridge],
  );

  const cancel = useCallback<AgentSessionControls["cancel"]>(async () => {
    if (!bridge) return;
    const current = stateRef.current;
    if (!current.agentId || !current.sessionId) return;
    bridge.send({
      type: "AGENT_CANCEL",
      agentId: current.agentId,
      sessionId: current.sessionId,
    });
  }, [bridge]);

  const respondToPermission = useCallback<
    AgentSessionControls["respondToPermission"]
  >((response) => {
    if (!bridge) return;
    const current = stateRef.current;
    if (!current.pendingPermission) return;
    bridge.send({
      type: "AGENT_PERMISSION_RESPONSE",
      permissionId: current.pendingPermission.permissionId,
      response,
    });
    setState((prev) => ({ ...prev, pendingPermission: null }));
  }, [bridge]);

  const reset = useCallback<AgentSessionControls["reset"]>(() => {
    setState({
      agentId: null,
      agentName: null,
      sessionId: null,
      initialize: null,
      session: null,
      status: "idle",
      messages: [],
      pendingPermission: null,
      stderrLog: [],
      error: null,
      failure: null,
      lastStopReason: null,
      availableModes: [],
      currentModeId: null,
      usage: BLANK_USAGE,
      plan: [],
      availableCommands: [],
    });
  }, []);

  return {
    ...state,
    listAgents,
    initAgent,
    startSession,
    sendPrompt,
    cancel,
    respondToPermission,
    reset,
  };
}

// ──────────────────────────────────────────────────────────
// Fold a SessionNotification into the running message list
// ──────────────────────────────────────────────────────────

export function applyUpdate(
  messages: AgentMessage[],
  notification: SessionNotification,
): AgentMessage[] {
  const upd = notification.update;
  switch (upd.sessionUpdate) {
    case "user_message_chunk": {
      // Speculative dedup. sendPrompt() adds the user's bubble locally
      // before the AGENT_PROMPT round-trip so the UI updates instantly.
      // The agent then echoes the prompt back through stream-json as a
      // user record, which the translator turns into user_message_chunk
      // — without dedup, this lands as a SECOND identical bubble.
      // Cursor's stream-json includes the echo; the bug surfaced there
      // first. Claude / Codex are subject to the same race depending
      // on schema. The check: the most recent message is a user text
      // bubble with no engine messageId yet (i.e. the speculative one
      // we just added). Adopt the engine's messageId on it instead of
      // creating a new bubble. Replay-from-disk is unaffected — there
      // the messages array fills *only* via translator events, so the
      // last-message check fails (or it has a messageId already from
      // a prior replayed turn). New messages from the user side never
      // race with replay because replay runs to completion before the
      // first live prompt.
      const last = messages[messages.length - 1];
      const incomingId =
        typeof upd.messageId === "string" ? upd.messageId : undefined;
      if (
        last &&
        last.kind === "text" &&
        last.role === "user" &&
        last.messageId === undefined &&
        incomingId !== undefined
      ) {
        const adopted: AgentTextMessage = {
          ...(last as AgentTextMessage),
          messageId: incomingId,
        };
        return [...messages.slice(0, -1), adopted];
      }
      return appendText(messages, "user", upd.content, incomingId);
    }
    case "agent_message_chunk":
      // ACP SDK 0.19 widened `messageId` to `string | null | undefined`.
      // Treat null the same as undefined — both mean "no engine id yet",
      // which falls through to role-only coalescing in appendText.
      return appendText(messages, "agent", upd.content, upd.messageId ?? undefined);
    case "agent_thought_chunk":
      return appendText(messages, "thought", upd.content, upd.messageId ?? undefined);
    case "tool_call": {
      const tc = upd as unknown as ToolCall & { sessionUpdate: "tool_call" };
      const msg: AgentToolMessage = {
        id: `tool-${tc.toolCallId}`,
        kind: "tool",
        toolCallId: tc.toolCallId,
        title: tc.title ?? tc.toolCallId,
        toolKind: tc.kind ?? undefined,
        status: tc.status ?? "pending",
        content: tc.content ?? undefined,
        locations: tc.locations ?? undefined,
        rawInput: tc.rawInput,
        rawOutput: tc.rawOutput,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return [...messages, msg];
    }
    case "tool_call_update": {
      const upd2 = upd as unknown as ToolCallUpdate & {
        sessionUpdate: "tool_call_update";
      };
      return messages.map((m) => {
        if (m.kind !== "tool" || m.toolCallId !== upd2.toolCallId) return m;
        return {
          ...m,
          status: upd2.status ?? m.status,
          title: upd2.title ?? m.title,
          toolKind: upd2.kind ?? m.toolKind,
          content: upd2.content ?? m.content,
          locations: upd2.locations ?? m.locations,
          rawInput: upd2.rawInput ?? m.rawInput,
          rawOutput: upd2.rawOutput ?? m.rawOutput,
          updatedAt: Date.now(),
        };
      });
    }
    // Plan / mode / commands updates are handled at the provider level
    // (they change session slots other than `messages`), so skip here.
    case "plan":
    case "current_mode_update":
    case "available_commands_update":
    default:
      return messages;
  }
}

function appendText(
  messages: AgentMessage[],
  role: AgentMessageRole,
  content: { type?: string; text?: string } | undefined,
  messageId: string | undefined,
): AgentMessage[] {
  if (!content || content.type !== "text" || typeof content.text !== "string") {
    return messages;
  }
  const chunkText = content.text;

  // Coalesce into the trailing text message ONLY if it's from the same
  // role AND carries the same engine-side messageId. Without the id
  // check, two consecutive turns' agent replies would merge into one
  // growing bubble. With it, streaming deltas of one message still
  // coalesce (the streaming use case), but a fresh message starts
  // a new bubble (the new-turn use case).
  //
  // If either side has no messageId we fall back to the role-only
  // merge — preserves the streaming behavior for adapters that
  // don't (yet) emit messageIds.
  const last = messages[messages.length - 1];
  if (
    last &&
    last.kind === "text" &&
    last.role === role &&
    sameMessageId(last.messageId, messageId)
  ) {
    return [
      ...messages.slice(0, -1),
      { ...last, text: last.text + chunkText },
    ];
  }

  return [
    ...messages,
    {
      id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "text",
      role,
      text: chunkText,
      createdAt: Date.now(),
      messageId,
    },
  ];
}

function sameMessageId(a: string | undefined, b: string | undefined): boolean {
  // Both undefined → coalesce (legacy behavior). Both set + equal → coalesce.
  // One set, one not → DON'T coalesce (treat as separate messages, since
  // the engine started identifying messages mid-conversation).
  if (a === undefined && b === undefined) return true;
  return a === b;
}
