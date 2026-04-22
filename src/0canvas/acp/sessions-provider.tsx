// ──────────────────────────────────────────────────────────
// AcpSessionsProvider — one ACP session per chat, all sharing
// agent subprocesses via the engine's session manager.
// ──────────────────────────────────────────────────────────
//
// Why this exists: the old useAcpSession hook owns exactly one
// session per mount. That works for a single-chat beta surface,
// but the production app has N concurrent chats — each with its
// own cwd, messages, and permission queue. We want:
//
//   - One subprocess per agent id (shared across chats)
//   - One session per chat (own sessionId + messages)
//   - Session state survives tab switches within the app run
//
// Implementation: single bridge listener at provider level,
// indexed by sessionId → chatId. The per-chat hook slices the
// session map and returns an object shaped like the old hook so
// <AcpChat> can be reused unchanged.
// ──────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ContentBlock,
  InitializeResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
} from "@agentclientprotocol/sdk";
import type {
  AcpAgentsListMessage,
  AcpAgentInitializedMessage,
  AcpErrorMessage,
  AcpModeChangedMessage,
  AcpPromptCompleteMessage,
  AcpPromptFailedMessage,
  AcpSessionCreatedMessage,
  BridgeRegistryAgent,
} from "../bridge/messages";
import { useBridge } from "../bridge/use-bridge";
import {
  applyUpdate,
  BLANK_USAGE,
  type AcpMessage,
  type AcpSessionControls,
  type AcpSessionState,
  type AcpTextMessage,
  type AcpUsage,
  type SessionStatus,
  type StartSessionOptions,
} from "./use-acp-session";

const MAX_STDERR_LINES = 200;

const BLANK: AcpSessionState = {
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
  availableModes: [],
  currentModeId: null,
  usage: BLANK_USAGE,
};

interface StartForChatOptions extends StartSessionOptions {
  /** Absolute path the agent subprocess should use as cwd. */
  cwd?: string;
  /** Force a fresh session even when one is already ready. Used when
   *  the user changes model/effort — those propagate via env and only
   *  take effect on spawn. */
  force?: boolean;
}

interface SessionsCtx {
  sessions: Record<string, AcpSessionState>;

  /** Ask for the registry. */
  listAgents(force?: boolean): Promise<BridgeRegistryAgent[]>;

  /** Spawn the subprocess with empty env so the auth screen can read
   *  advertised auth methods. No-op if already started. */
  initAgent(agentId: string): Promise<InitializeResponse>;

  /** Idempotent — creates a session for the chat if one doesn't exist.
   *  Safe to call on every render; bails out early when session is ready. */
  ensureSession(
    chatId: string,
    agentId: string,
    options?: StartForChatOptions,
  ): Promise<void>;

  sendPrompt(
    chatId: string,
    text: string,
    displayText?: string,
    attachments?: ContentBlock[],
  ): Promise<void>;

  cancel(chatId: string): Promise<void>;

  respondToPermission(
    chatId: string,
    response: RequestPermissionResponse,
  ): void;

  /** Switch session mode via ACP `session/set_mode`. Echoes the change
   *  back into session state on success. */
  setMode(chatId: string, modeId: string): Promise<void>;

  /** Drop browser-side state for this chat. Subprocess stays warm. */
  reset(chatId: string): void;
}

const Ctx = createContext<SessionsCtx | null>(null);

export function AcpSessionsProvider({ children }: { children: React.ReactNode }) {
  const bridge = useBridge();

  const [sessions, setSessions] = useState<Record<string, AcpSessionState>>({});

  // Mutable mirrors of state so listener callbacks don't close over stale
  // values. The listeners fire off-render, so React's normal stale-closure
  // story doesn't work — we keep a ref per piece of derived lookup data.
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  /** sessionId → chatId. Rebuilt whenever sessions change so notification
   *  dispatch is O(1) and we never touch an unrelated chat. */
  const sessionToChatRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const [chatId, s] of Object.entries(sessions)) {
      if (s.sessionId) map[s.sessionId] = chatId;
    }
    sessionToChatRef.current = map;
  }, [sessions]);

  // Patch helper — avoids writing 20 variants of "update one chat's slot".
  const patch = useCallback(
    (chatId: string, update: Partial<AcpSessionState>) => {
      setSessions((prev) => ({
        ...prev,
        [chatId]: { ...(prev[chatId] ?? BLANK), ...update },
      }));
    },
    [],
  );

  // ── Bridge listeners (single set for all chats) ──────────

  useEffect(() => {
    if (!bridge) return;

    const unsubUpdate = bridge.on("ACP_SESSION_UPDATE", (raw) => {
      const msg = raw as {
        agentId: string;
        notification: SessionNotification;
      };
      const chatId = sessionToChatRef.current[msg.notification.sessionId];
      if (!chatId) return;

      const upd = msg.notification.update as {
        sessionUpdate?: string;
        size?: number;
        used?: number;
        currentModeId?: string;
      };

      // usage_update → context window accounting. Keep any per-turn
      // cumulative counters from prompt-response usage; overwrite size/used.
      if (upd.sessionUpdate === "usage_update") {
        setSessions((prev) => {
          const slot = prev[chatId];
          if (!slot) return prev;
          const nextUsage: AcpUsage = {
            ...slot.usage,
            size: typeof upd.size === "number" ? upd.size : slot.usage.size,
            used: typeof upd.used === "number" ? upd.used : slot.usage.used,
          };
          return { ...prev, [chatId]: { ...slot, usage: nextUsage } };
        });
        return;
      }

      // current_mode_update → agent told us the mode flipped (e.g. after
      // a /plan-mode slash command). Echo into state so the pill updates.
      if (upd.sessionUpdate === "current_mode_update" && upd.currentModeId) {
        patch(chatId, { currentModeId: upd.currentModeId });
        return;
      }

      // Everything else → feed to the messages reducer.
      setSessions((prev) => {
        const slot = prev[chatId];
        if (!slot) return prev;
        return {
          ...prev,
          [chatId]: {
            ...slot,
            messages: applyUpdate(slot.messages, msg.notification),
          },
        };
      });
    });

    const unsubPerm = bridge.on("ACP_PERMISSION_REQUEST", (raw) => {
      const msg = raw as {
        agentId: string;
        permissionId: string;
        request: RequestPermissionRequest;
      };
      const sid = (msg.request as { sessionId?: string }).sessionId;
      const chatId = sid ? sessionToChatRef.current[sid] : undefined;
      if (!chatId) return;
      patch(chatId, {
        pendingPermission: {
          agentId: msg.agentId,
          permissionId: msg.permissionId,
          request: msg.request,
        },
      });
    });

    const unsubStderr = bridge.on("ACP_AGENT_STDERR", (raw) => {
      const msg = raw as { agentId: string; line: string };
      // Stderr isn't session-scoped; attach to every chat on this agent
      // so the user sees it wherever they're looking.
      setSessions((prev) => {
        let changed = false;
        const next: Record<string, AcpSessionState> = {};
        for (const [chatId, slot] of Object.entries(prev)) {
          if (slot.agentId === msg.agentId) {
            next[chatId] = {
              ...slot,
              stderrLog: [
                ...slot.stderrLog.slice(-(MAX_STDERR_LINES - 1)),
                msg.line,
              ],
            };
            changed = true;
          } else {
            next[chatId] = slot;
          }
        }
        return changed ? next : prev;
      });
    });

    const unsubExit = bridge.on("ACP_AGENT_EXITED", (raw) => {
      const msg = raw as {
        agentId: string;
        code: number | null;
        signal: string | null;
      };
      // All sessions on this agent die with it — mark them failed.
      setSessions((prev) => {
        let changed = false;
        const next: Record<string, AcpSessionState> = {};
        for (const [chatId, slot] of Object.entries(prev)) {
          if (slot.agentId === msg.agentId) {
            const detail = `code=${msg.code ?? "null"}${
              msg.signal ? `, signal=${msg.signal}` : ""
            }`;
            next[chatId] = {
              ...slot,
              status: "failed" as SessionStatus,
              error: `Agent exited (${detail})`,
              messages: [
                ...slot.messages,
                {
                  id: `sys-${Date.now()}`,
                  kind: "text",
                  role: "system",
                  text: `Agent subprocess exited (${detail})`,
                  createdAt: Date.now(),
                },
              ],
            };
            changed = true;
          } else {
            next[chatId] = slot;
          }
        }
        return changed ? next : prev;
      });
    });

    return () => {
      unsubUpdate();
      unsubPerm();
      unsubStderr();
      unsubExit();
    };
  }, [bridge, patch]);

  // ── Public controls ─────────────────────────────────────

  const listAgents = useCallback<SessionsCtx["listAgents"]>(
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

  const initAgent = useCallback<SessionsCtx["initAgent"]>(
    async (agentId) => {
      if (!bridge) throw new Error("Engine not connected");
      const resp = await bridge.request<
        AcpAgentInitializedMessage | AcpErrorMessage
      >({ type: "ACP_INIT_AGENT", agentId }, 60_000);
      if (resp.type === "ACP_ERROR") throw new Error(resp.message);
      return resp.initialize;
    },
    [bridge],
  );

  const ensureSession = useCallback<SessionsCtx["ensureSession"]>(
    async (chatId, agentId, options) => {
      if (!bridge) return;
      const existing = sessionsRef.current[chatId];
      // Already wired up to this agent — nothing to do unless the caller
      // asks to rebuild (model/effort change). Forced rebuild drops the
      // browser-side messages too, since the new session won't share
      // context with the old one.
      if (
        !options?.force &&
        existing &&
        existing.sessionId &&
        existing.agentId === agentId &&
        existing.status !== "failed"
      ) {
        return;
      }
      patch(chatId, {
        ...BLANK,
        agentId,
        agentName: options?.agentName ?? agentId,
        status: "starting",
      });
      try {
        const resp = await bridge.request<
          AcpSessionCreatedMessage | AcpErrorMessage
        >(
          {
            type: "ACP_NEW_SESSION",
            agentId,
            cwd: options?.cwd,
            env: options?.env,
          },
          60_000,
        );
        if (resp.type === "ACP_ERROR") {
          patch(chatId, { status: "failed", error: resp.message });
          return;
        }
        patch(chatId, {
          status: "ready",
          sessionId: resp.session.sessionId,
          session: resp.session,
          initialize: resp.initialize,
          availableModes: resp.session.modes?.availableModes ?? [],
          currentModeId: resp.session.modes?.currentModeId ?? null,
          usage: BLANK_USAGE,
          error: null,
        });
      } catch (err) {
        patch(chatId, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [bridge, patch],
  );

  const sendPrompt = useCallback<SessionsCtx["sendPrompt"]>(
    async (chatId, text, displayText, attachments) => {
      if (!bridge) return;
      const current = sessionsRef.current[chatId];
      if (!current || !current.agentId || !current.sessionId) return;
      if (current.status === "streaming") return;

      const userMessage: AcpTextMessage = {
        id: `user-${Date.now()}`,
        kind: "text",
        role: "user",
        text: displayText ?? text,
        createdAt: Date.now(),
      };
      const prompt: ContentBlock[] = [
        { type: "text", text },
        ...(attachments ?? []),
      ];

      patch(chatId, {
        status: "streaming",
        error: null,
        messages: [...current.messages, userMessage],
      });

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
          patch(chatId, { status: "failed", error: resp.error });
          return;
        }
        // Fold per-turn usage counters into the running session total.
        const turnUsage = (resp.response as { usage?: unknown } | undefined)
          ?.usage as
          | {
              inputTokens?: number;
              outputTokens?: number;
              cachedReadTokens?: number;
              cachedWriteTokens?: number;
              thoughtTokens?: number;
            }
          | undefined;
        setSessions((prev) => {
          const slot = prev[chatId];
          if (!slot) return prev;
          const u = slot.usage;
          const next: AcpUsage = turnUsage
            ? {
                ...u,
                inputTokens: u.inputTokens + (turnUsage.inputTokens ?? 0),
                outputTokens: u.outputTokens + (turnUsage.outputTokens ?? 0),
                cachedReadTokens:
                  u.cachedReadTokens + (turnUsage.cachedReadTokens ?? 0),
                cachedWriteTokens:
                  u.cachedWriteTokens + (turnUsage.cachedWriteTokens ?? 0),
                thoughtTokens:
                  u.thoughtTokens + (turnUsage.thoughtTokens ?? 0),
              }
            : u;
          return {
            ...prev,
            [chatId]: {
              ...slot,
              status: "ready",
              lastStopReason: resp.stopReason,
              usage: next,
            },
          };
        });
      } catch (err) {
        patch(chatId, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [bridge, patch],
  );

  const cancel = useCallback<SessionsCtx["cancel"]>(
    async (chatId) => {
      if (!bridge) return;
      const current = sessionsRef.current[chatId];
      if (!current?.agentId || !current.sessionId) return;
      bridge.send({
        type: "ACP_CANCEL",
        agentId: current.agentId,
        sessionId: current.sessionId,
      });
    },
    [bridge],
  );

  const respondToPermission = useCallback<
    SessionsCtx["respondToPermission"]
  >(
    (chatId, response) => {
      if (!bridge) return;
      const current = sessionsRef.current[chatId];
      if (!current?.pendingPermission) return;
      bridge.send({
        type: "ACP_PERMISSION_RESPONSE",
        permissionId: current.pendingPermission.permissionId,
        response,
      });
      patch(chatId, { pendingPermission: null });
    },
    [bridge, patch],
  );

  const setMode = useCallback<SessionsCtx["setMode"]>(
    async (chatId, modeId) => {
      if (!bridge) return;
      const current = sessionsRef.current[chatId];
      if (!current?.agentId || !current.sessionId) return;
      // Optimistically flip the pill so the user sees feedback; the
      // engine echoes back via ACP_MODE_CHANGED (or ACP_ERROR).
      patch(chatId, { currentModeId: modeId });
      try {
        const resp = await bridge.request<
          AcpModeChangedMessage | AcpErrorMessage
        >(
          {
            type: "ACP_SET_MODE",
            agentId: current.agentId,
            sessionId: current.sessionId,
            modeId,
          },
          10_000,
        );
        if (resp.type === "ACP_ERROR") {
          // Revert on failure so the pill reflects reality.
          patch(chatId, { currentModeId: current.currentModeId });
          patch(chatId, { error: resp.message });
        }
      } catch (err) {
        patch(chatId, { currentModeId: current.currentModeId });
        patch(chatId, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [bridge, patch],
  );

  const reset = useCallback<SessionsCtx["reset"]>(
    (chatId) => {
      setSessions((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
    },
    [],
  );

  const value = useMemo<SessionsCtx>(
    () => ({
      sessions,
      listAgents,
      initAgent,
      ensureSession,
      sendPrompt,
      cancel,
      respondToPermission,
      setMode,
      reset,
    }),
    [
      sessions,
      listAgents,
      initAgent,
      ensureSession,
      sendPrompt,
      cancel,
      setMode,
      respondToPermission,
      reset,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Per-chat session access. Returns an object shaped like the old
 *  useAcpSession return value so <AcpChat session={...} /> works as-is.
 *  Also exposes ensureSession for the Chat view to warm up on mount. */
export function useChatSession(
  chatId: string,
): AcpSessionState & AcpSessionControls & {
  ensureSession(agentId: string, options?: StartForChatOptions): Promise<void>;
} {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useChatSession must be used inside <AcpSessionsProvider>");
  }
  const slot = ctx.sessions[chatId] ?? BLANK;

  return {
    ...slot,
    listAgents: ctx.listAgents,
    initAgent: ctx.initAgent,
    // startSession kept for API compatibility with AcpChat / AcpMode —
    // forwards to ensureSession with the chat's id baked in.
    startSession: (agentId, options) =>
      ctx.ensureSession(chatId, agentId, options),
    sendPrompt: (text, displayText, attachments) =>
      ctx.sendPrompt(chatId, text, displayText, attachments),
    cancel: () => ctx.cancel(chatId),
    respondToPermission: (response) =>
      ctx.respondToPermission(chatId, response),
    setMode: (modeId: string) => ctx.setMode(chatId, modeId),
    reset: () => ctx.reset(chatId),
    ensureSession: (agentId, options) =>
      ctx.ensureSession(chatId, agentId, options),
  };
}

/** App-level access for flows that aren't tied to a single chat
 *  (e.g. the settings Agents panel fetching the registry). */
export function useAcpSessions(): SessionsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useAcpSessions must be used inside <AcpSessionsProvider>");
  }
  return ctx;
}

// Re-export the AcpMessage type so consumers don't have to reach into
// the older hook file.
export type { AcpMessage };
