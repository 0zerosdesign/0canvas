// ──────────────────────────────────────────────────────────
// useAcpSession — browser-side ACP session over the engine bridge
// ──────────────────────────────────────────────────────────
//
// Thin React hook on top of CanvasBridgeClient. It manages:
//   - registry fetch / agent selection
//   - session creation with an agent
//   - prompt send / cancel
//   - consumption of ACP_SESSION_UPDATE notifications
//   - permission-prompt round-trip
//
// It does NOT interpret tool-call kinds or render anything — UI
// components consume the state slices this hook exposes.
// ──────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ContentBlock,
  InitializeResponse,
  NewSessionResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  StopReason,
  ToolCall,
  ToolCallUpdate,
} from "@agentclientprotocol/sdk";
import type {
  AcpAgentsListMessage,
  AcpErrorMessage,
  AcpPromptCompleteMessage,
  AcpPromptFailedMessage,
  AcpSessionCreatedMessage,
  BridgeRegistryAgent,
} from "../bridge/messages";
import { useBridge } from "../bridge/use-bridge";

export type AcpMessageRole = "user" | "agent" | "thought" | "system";

export interface AcpTextMessage {
  id: string;
  kind: "text";
  role: AcpMessageRole;
  text: string;
  createdAt: number;
}

export interface AcpToolMessage {
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

export type AcpMessage = AcpTextMessage | AcpToolMessage;

export interface PendingPermission {
  permissionId: string;
  agentId: string;
  request: RequestPermissionRequest;
}

export type SessionStatus =
  | "idle"           // no session yet
  | "starting"       // ACP_NEW_SESSION in flight
  | "ready"          // session created, no prompt running
  | "streaming"      // prompt turn in progress
  | "failed";        // last operation errored; details in `error`

export interface AcpSessionState {
  agentId: string | null;
  agentName: string | null;
  sessionId: string | null;
  initialize: InitializeResponse | null;
  session: NewSessionResponse | null;
  status: SessionStatus;
  messages: AcpMessage[];
  pendingPermission: PendingPermission | null;
  stderrLog: string[];
  error: string | null;
  lastStopReason: StopReason | null;
}

export interface StartSessionOptions {
  /** Display name to show in the chat header while the session is live. */
  agentName?: string;
  /** Env passed to the agent subprocess at spawn time (e.g. ANTHROPIC_API_KEY). */
  env?: Record<string, string>;
}

export interface AcpSessionControls {
  /** Fetch the registry. Force=true refetches from CDN. */
  listAgents(force?: boolean): Promise<BridgeRegistryAgent[]>;
  /** Create a new session with the given agent id. */
  startSession(agentId: string, options?: StartSessionOptions): Promise<void>;
  /** Send a user prompt. Enqueues a user message immediately.
   *  `displayText` is what the UI shows (may contain @tokens); `text` is
   *  what goes over the wire (with mentions expanded). When omitted,
   *  `text` is used for both. */
  sendPrompt(text: string, displayText?: string): Promise<void>;
  /** Cancel the in-flight prompt (if any). */
  cancel(): Promise<void>;
  /** Resolve a pending permission request. */
  respondToPermission(response: RequestPermissionResponse): void;
  /** Clear the session and return to idle. Does not kill the agent subprocess. */
  reset(): void;
}

const MAX_STDERR_LINES = 200;

export function useAcpSession(): AcpSessionState & AcpSessionControls {
  const bridge = useBridge();

  const [state, setState] = useState<AcpSessionState>({
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
    lastStopReason: null,
  });

  // Mutable view of live state, so listener callbacks don't close over stale refs.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Incoming notifications ──────────────────────────────

  useEffect(() => {
    if (!bridge) return;

    const unsubUpdate = bridge.on("ACP_SESSION_UPDATE", (raw) => {
      const msg = raw as { agentId: string; notification: SessionNotification };
      if (msg.agentId !== stateRef.current.agentId) return;
      if (msg.notification.sessionId !== stateRef.current.sessionId) return;
      setState((prev) => ({
        ...prev,
        messages: applyUpdate(prev.messages, msg.notification),
      }));
    });

    const unsubPerm = bridge.on("ACP_PERMISSION_REQUEST", (raw) => {
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

    const unsubStderr = bridge.on("ACP_AGENT_STDERR", (raw) => {
      const msg = raw as { agentId: string; line: string };
      if (msg.agentId !== stateRef.current.agentId) return;
      setState((prev) => ({
        ...prev,
        stderrLog: [...prev.stderrLog.slice(-(MAX_STDERR_LINES - 1)), msg.line],
      }));
    });

    const unsubExit = bridge.on("ACP_AGENT_EXITED", (raw) => {
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

  const listAgents = useCallback<AcpSessionControls["listAgents"]>(
    async (force = false) => {
      if (!bridge) return [];
      const resp = await bridge.request<AcpAgentsListMessage>(
        { type: "ACP_LIST_AGENTS", force },
        30_000,
      );
      return resp.agents;
    },
    [bridge],
  );

  const startSession = useCallback<AcpSessionControls["startSession"]>(
    async (agentId, options) => {
      if (!bridge) throw new Error("Engine not connected");
      setState((prev) => ({
        ...prev,
        status: "starting",
        error: null,
        agentId,
        agentName: options?.agentName ?? agentId,
        sessionId: null,
        session: null,
        initialize: null,
        messages: [],
        pendingPermission: null,
        stderrLog: [],
        lastStopReason: null,
      }));

      try {
        const resp = await bridge.request<
          AcpSessionCreatedMessage | AcpErrorMessage
        >(
          { type: "ACP_NEW_SESSION", agentId, env: options?.env },
          60_000,
        );

        if (resp.type === "ACP_ERROR") {
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

  const sendPrompt = useCallback<AcpSessionControls["sendPrompt"]>(
    async (text, displayText) => {
      if (!bridge) return;
      const current = stateRef.current;
      if (!current.agentId || !current.sessionId) return;
      if (current.status === "streaming") return;

      const userMessage: AcpTextMessage = {
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
          AcpPromptCompleteMessage | AcpPromptFailedMessage
        >(
          {
            type: "ACP_PROMPT",
            agentId: current.agentId,
            sessionId: current.sessionId,
            prompt,
          },
          10 * 60_000,
        );

        if (resp.type === "ACP_PROMPT_FAILED") {
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

  const cancel = useCallback<AcpSessionControls["cancel"]>(async () => {
    if (!bridge) return;
    const current = stateRef.current;
    if (!current.agentId || !current.sessionId) return;
    bridge.send({
      type: "ACP_CANCEL",
      agentId: current.agentId,
      sessionId: current.sessionId,
    });
  }, [bridge]);

  const respondToPermission = useCallback<
    AcpSessionControls["respondToPermission"]
  >((response) => {
    if (!bridge) return;
    const current = stateRef.current;
    if (!current.pendingPermission) return;
    bridge.send({
      type: "ACP_PERMISSION_RESPONSE",
      permissionId: current.pendingPermission.permissionId,
      response,
    });
    setState((prev) => ({ ...prev, pendingPermission: null }));
  }, [bridge]);

  const reset = useCallback<AcpSessionControls["reset"]>(() => {
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
      lastStopReason: null,
    });
  }, []);

  return {
    ...state,
    listAgents,
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

function applyUpdate(
  messages: AcpMessage[],
  notification: SessionNotification,
): AcpMessage[] {
  const upd = notification.update;
  switch (upd.sessionUpdate) {
    case "user_message_chunk":
      return appendText(messages, "user", upd.content);
    case "agent_message_chunk":
      return appendText(messages, "agent", upd.content);
    case "agent_thought_chunk":
      return appendText(messages, "thought", upd.content);
    case "tool_call": {
      const tc = upd as unknown as ToolCall & { sessionUpdate: "tool_call" };
      const msg: AcpToolMessage = {
        id: `tool-${tc.toolCallId}`,
        kind: "tool",
        toolCallId: tc.toolCallId,
        title: tc.title ?? tc.toolCallId,
        toolKind: tc.kind,
        status: tc.status ?? "pending",
        content: tc.content,
        locations: tc.locations,
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
    // Plan / mode / commands updates — ignored by the minimal UI for now.
    // They still arrive over the wire; we'll surface them in a later phase.
    case "plan":
    case "current_mode_update":
    case "available_commands_update":
    default:
      return messages;
  }
}

function appendText(
  messages: AcpMessage[],
  role: AcpMessageRole,
  content: { type?: string; text?: string } | undefined,
): AcpMessage[] {
  if (!content || content.type !== "text" || typeof content.text !== "string") {
    return messages;
  }
  const chunkText = content.text;

  // Coalesce into the trailing text message if it's from the same role.
  // Agents emit many small chunks during streaming; rendering one DOM node
  // per chunk kills scroll performance.
  const last = messages[messages.length - 1];
  if (last && last.kind === "text" && last.role === role) {
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
    },
  ];
}
