// ──────────────────────────────────────────────────────────
// AgentSessionsProvider — one ACP session per chat, all sharing
// agent subprocesses via the engine's session manager.
// ──────────────────────────────────────────────────────────
//
// Why this exists: the old useAgentSession hook owns exactly one
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
// <AgentChat> can be reused unchanged.
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
  AvailableCommand,
  ContentBlock,
  InitializeResponse,
  PlanEntry,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
} from "@agentclientprotocol/sdk";
import type {
  AgentAgentsListMessage,
  AgentAgentInitializedMessage,
  AgentErrorMessage,
  AgentModeChangedMessage,
  AgentPromptCompleteMessage,
  AgentPromptFailedMessage,
  AgentSessionCreatedMessage,
  AgentSessionLoadedMessage,
  AgentSessionsListMessage,
  BridgeRegistryAgent,
} from "../bridge/messages";
import type { ListSessionsResponse } from "@agentclientprotocol/sdk";
import { useBridge } from "../bridge/use-bridge";
import {
  applyUpdate,
  BLANK_USAGE,
  type AgentMessage,
  type AgentSessionControls,
  type AgentSessionState,
  type AgentTextMessage,
  type AgentUsage,
  type SessionStatus,
  type StartSessionOptions,
} from "./use-agent-session";

const MAX_STDERR_LINES = 200;

/** Renderer-side cap on per-chat message history. The engine streams
 *  every tool-call delta as a separate notification; a long session
 *  with many edits can produce tens of thousands of entries. We keep
 *  the most recent N so the renderer process doesn't grow without
 *  bound. The cap is a memory safety net — visible chat scrollback
 *  in practice never exceeds a few hundred turns. */
const MAX_MESSAGES_PER_CHAT = 1000;

function capMessages(messages: AgentMessage[]): AgentMessage[] {
  if (messages.length <= MAX_MESSAGES_PER_CHAT) return messages;
  return messages.slice(-MAX_MESSAGES_PER_CHAT);
}

/** User-visible ceiling for session creation. Single attempt — if it
 *  fails we surface the classified failure rather than loop. 10s gives
 *  Claude Agent and Codex enough room for their cold newSession RPC
 *  (the prior 2s was firing before the adapter finished handshaking
 *  with Anthropic / OpenAI, even on a warm subprocess). */
const ENSURE_SESSION_ATTEMPT_TIMEOUT_MS = 10_000;
const ENSURE_SESSION_ATTEMPTS = 1;

import {
  classifyRpcError,
  isRecoverable as failureIsRecoverable,
  type AgentFailure,
} from "../bridge/failure";

/** Pull the classified failure off an AGENT_ERROR bridge message when
 *  the engine populated it; otherwise classify from the free-form
 *  message so older engine builds still produce the right UI state. */
function failureFromAcpError(
  msg: AgentErrorMessage,
  fallbackStage: AgentFailure["stage"],
): AgentFailure {
  if (msg.failure) return msg.failure as AgentFailure;
  return classifyRpcError({
    agentId: msg.agentId,
    stage: fallbackStage ?? "initialize",
    error: new Error(msg.message),
  });
}

/** Map a failure classification to the UI session status. The source
 *  of truth for "which status does the UI land in after a failure?" —
 *  keeps acp-chat / composer routing deterministic. */
function statusForFailure(failure: AgentFailure): SessionStatus {
  if (failure.kind === "auth-required") return "auth-required";
  if (failureIsRecoverable(failure)) return "reconnecting";
  return "failed";
}

const BLANK: AgentSessionState = {
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
  sessions: Record<string, AgentSessionState>;

  /** Read the LATEST session state for a chat — bypasses the React
   *  closure capture problem. After `await ensureSession`, the ctx
   *  object held in scope is stale; reading `sessions[chatId]` shows
   *  pre-await state. Callers that gate on session status across an
   *  async boundary must use this getter instead. */
  getSession(chatId: string): AgentSessionState | undefined;

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

  /** Switch session mode via protocol-level `session/set_mode`. Echoes the change
   *  back into session state on success. */
  setMode(chatId: string, modeId: string): Promise<void>;

  /** Drop browser-side state for this chat. Subprocess stays warm. */
  reset(chatId: string): void;

  /** Enumerate resumable sessions for an agent. Only agents with
   *  thread-history support (see agent-ui-registry.hasThreadHistory) will
   *  return anything useful. Errors are surfaced to the caller. */
  listSessionsFor(
    agentId: string,
    opts?: { cwd?: string; cursor?: string | null },
  ): Promise<ListSessionsResponse>;

  /** Load a previously-saved agent session into a chat. Replaces any
   *  existing session for the chat. Does NOT call newSession — the agent
   *  replays history via session/update notifications. */
  loadIntoChat(
    chatId: string,
    agentId: string,
    sessionId: string,
    options?: StartForChatOptions,
  ): Promise<void>;

  /** Agent ids with a live subprocess known to the engine. Powers the
   *  green-dot indicator on agent pills. Best-effort — we add on a
   *  successful initAgent / newSession and remove on AGENT_AGENT_EXITED. */
  warmAgentIds: ReadonlySet<string>;

  /** Drop every in-memory session and warm-agent flag without
   *  attempting RPC teardown. Used by the in-place project swap: when
   *  Electron respawns the engine on a fresh port, every sessionId we
   *  hold belongs to a dead process — the new engine has its own
   *  subprocess pool. The persistent chat.sessionId on disk lets us
   *  re-load on the user's next chat-open. */
  disposeAll(): void;
}

const Ctx = createContext<SessionsCtx | null>(null);

export function AgentSessionsProvider({ children }: { children: React.ReactNode }) {
  const bridge = useBridge();

  const [sessions, setSessions] = useState<Record<string, AgentSessionState>>({});
  const [warmAgentIds, setWarmAgentIds] = useState<Set<string>>(() => new Set());
  const markWarm = useCallback((agentId: string) => {
    setWarmAgentIds((prev) => {
      if (prev.has(agentId)) return prev;
      const next = new Set(prev);
      next.add(agentId);
      return next;
    });
  }, []);
  const markCold = useCallback((agentId: string) => {
    setWarmAgentIds((prev) => {
      if (!prev.has(agentId)) return prev;
      const next = new Set(prev);
      next.delete(agentId);
      return next;
    });
  }, []);

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
    (chatId: string, update: Partial<AgentSessionState>) => {
      setSessions((prev) => ({
        ...prev,
        [chatId]: { ...(prev[chatId] ?? BLANK), ...update },
      }));
    },
    [],
  );

  // ensureSession isn't in scope of the bridge-listeners effect (it's
  // declared below), so a ref lets the AGENT_AGENT_EXITED handler trigger
  // a silent respawn without re-arranging the component.
  const ensureSessionRef = useRef<SessionsCtx["ensureSession"] | null>(null);

  // Per-chat in-flight ensureSession promises. Without this lock, a
  // user clicking Send while the initial session creation is still
  // "warming" fires a second AGENT_NEW_SESSION — both succeed, the
  // engine returns two different sessionIds, the second overwrites
  // the first, and any stream events emitted under the orphaned
  // sessionId can't be routed back through sessionToChatRef. The
  // user's bubble shows but the response never lands. Concurrent
  // callers now await the in-flight call instead of starting a
  // duplicate. Force=true bypasses (model swap intends a rebuild).
  const ensureInFlightRef = useRef(new Map<string, Promise<void>>());

  // ── Bridge listeners (single set for all chats) ──────────

  useEffect(() => {
    if (!bridge) return;

    const unsubUpdate = bridge.on("AGENT_SESSION_UPDATE", (raw) => {
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
        entries?: PlanEntry[];
        availableCommands?: AvailableCommand[];
      };

      // usage_update → context window accounting. Keep any per-turn
      // cumulative counters from prompt-response usage; overwrite size/used.
      if (upd.sessionUpdate === "usage_update") {
        setSessions((prev) => {
          const slot = prev[chatId];
          if (!slot) return prev;
          const nextUsage: AgentUsage = {
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

      // plan → agent emitted a fresh todo list. Replaces wholesale (ACP
      // spec: `plan` always carries the full list, not a delta).
      if (upd.sessionUpdate === "plan" && Array.isArray(upd.entries)) {
        patch(chatId, { plan: upd.entries });
        return;
      }

      // available_commands_update → slash-command palette refresh.
      if (
        upd.sessionUpdate === "available_commands_update" &&
        Array.isArray(upd.availableCommands)
      ) {
        patch(chatId, { availableCommands: upd.availableCommands });
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
            messages: capMessages(applyUpdate(slot.messages, msg.notification)),
          },
        };
      });
    });

    const unsubPerm = bridge.on("AGENT_PERMISSION_REQUEST", (raw) => {
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

    const unsubStderr = bridge.on("AGENT_AGENT_STDERR", (raw) => {
      const msg = raw as { agentId: string; line: string };
      // Stderr isn't session-scoped; attach to every chat on this agent
      // so the user sees it wherever they're looking.
      setSessions((prev) => {
        let changed = false;
        const next: Record<string, AgentSessionState> = {};
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

    const unsubExit = bridge.on("AGENT_AGENT_EXITED", (raw) => {
      const msg = raw as {
        agentId: string;
        code: number | null;
        signal: string | null;
      };
      // Green-dot: the subprocess is gone.
      markCold(msg.agentId);
      // Agent subprocess exited. The ENGINE owns respawn entirely (see
      // the always-warm pool in session-manager.ts). The UI's job is
      // just to reflect the blip — mark the chat `reconnecting` and
      // clear the dead sessionId. The NEXT user action (sending a
      // prompt, switching to the chat, agent/model change) triggers
      // ensureSession, which lands on the (by-then) respawned subprocess.
      //
      // We intentionally do NOT schedule an automatic retry here.
      // Every loop we added previously turned into a "reconnecting
      // forever" bug when the engine couldn't revive (e.g. missing
      // auth). Let the engine's respawn pool fail loudly via its own
      // exit events and let user interaction drive session recreation.
      console.log(
        `[Zeros AGENT_AGENT_EXITED] ${msg.agentId} code=${msg.code} signal=${msg.signal}`,
      );
      setSessions((prev) => {
        let changed = false;
        const next: Record<string, AgentSessionState> = {};
        for (const [chatId, slot] of Object.entries(prev)) {
          if (slot.agentId === msg.agentId) {
            changed = true;
            const terminal =
              slot.status === "failed" ||
              slot.status === "auth-required";
            if (terminal) {
              next[chatId] = slot;
              continue;
            }
            next[chatId] = {
              ...slot,
              status: "reconnecting" as SessionStatus,
              error: null,
              failure: null,
              sessionId: null,
              session: null,
            };
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
  }, [bridge, patch, markCold]);

  // ── Public controls ─────────────────────────────────────

  const listAgents = useCallback<SessionsCtx["listAgents"]>(
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

  const initAgent = useCallback<SessionsCtx["initAgent"]>(
    async (agentId) => {
      if (!bridge) throw new Error("Engine not connected");
      // 5 min ceiling on the bridge request covers first-time npx/uvx
      // cold starts (downloads can take 10–40 s on slow networks). The
      // engine's always-warm pool keeps subsequent calls sub-second.
      const resp = await bridge.request<
        AgentAgentInitializedMessage | AgentErrorMessage
      >({ type: "AGENT_INIT_AGENT", agentId }, 5 * 60_000);
      if (resp.type === "AGENT_ERROR") {
        markCold(agentId);
        const failure = failureFromAcpError(resp, "initialize");
        // Throw a structured error the caller can destructure without
        // regex-matching the message.
        const err = new Error(failure.message) as Error & {
          failure?: AgentFailure;
        };
        err.failure = failure;
        throw err;
      }
      markWarm(agentId);
      return resp.initialize;
    },
    [bridge, markWarm, markCold],
  );

  const ensureSession = useCallback<SessionsCtx["ensureSession"]>(
    async (chatId, agentId, options) => {
      if (!bridge) return;
      const existing = sessionsRef.current[chatId];
      // Already wired up and healthy — nothing to do unless the caller
      // forces a rebuild (model/effort change). We treat `reconnecting`
      // and `auth-required` as "not healthy" so a fresh ensureSession
      // from user interaction kicks retry.
      if (
        !options?.force &&
        existing &&
        existing.sessionId &&
        existing.agentId === agentId &&
        (existing.status === "ready" || existing.status === "streaming")
      ) {
        return;
      }
      // De-dup concurrent calls. A user clicking Send while the
      // initial creation is mid-warming would otherwise kick off a
      // parallel newSession, orphaning the first sessionId. Wait on
      // the existing promise instead. Force still bypasses — the
      // caller wants a fresh subprocess (model swap).
      if (!options?.force) {
        const inflight = ensureInFlightRef.current.get(chatId);
        if (inflight) return inflight;
      }

      const work = (async () => {
        patch(chatId, {
          ...BLANK,
          agentId,
          agentName: options?.agentName ?? agentId,
          status: "warming",
          messages: existing?.messages ?? [],
        });

      // Retry budget: 2 attempts × 2 s = 4 s ceiling from the user's
      // perspective. The engine's always-warm pool is doing heavier
      // lifting in parallel (~ensures subprocess is alive); if both
      // attempts still can't create a session we classify and route.
      // No silent third loop — that was the root cause of the eternal
      // "Reconnecting…" spinner.
      //
      // IMPORTANT: we Promise.race the bridge request against an outer
      // setTimeout. The ws-client has its own reconnect-queue window
      // (RECONNECT_GRACE_MS, ~7s) which would otherwise mask the 2s
      // we pass down — the race makes the cap absolute.
      let lastFailure: AgentFailure | null = null;
      const attemptOnce = async (): Promise<
        AgentSessionCreatedMessage | AgentErrorMessage
      > => {
        const timer = new Promise<never>((_, reject) => {
          window.setTimeout(
            () =>
              reject(
                new Error(`Request timeout: AGENT_NEW_SESSION (${ENSURE_SESSION_ATTEMPT_TIMEOUT_MS}ms cap)`),
              ),
            ENSURE_SESSION_ATTEMPT_TIMEOUT_MS,
          );
        });
        const request = bridge.request<
          AgentSessionCreatedMessage | AgentErrorMessage
        >(
          {
            type: "AGENT_NEW_SESSION",
            agentId,
            cwd: options?.cwd,
            env: options?.env,
          },
          // Inner bridge timeout matches; both layers bail at 2s.
          ENSURE_SESSION_ATTEMPT_TIMEOUT_MS,
        );
        return Promise.race([request, timer]);
      };

      for (let attempt = 1; attempt <= ENSURE_SESSION_ATTEMPTS; attempt++) {
        try {
          const resp = await attemptOnce();
          if (resp.type === "AGENT_ERROR") {
            lastFailure = failureFromAcpError(resp, "newSession");
            console.warn(
              `[Zeros ensureSession] attempt ${attempt}/${ENSURE_SESSION_ATTEMPTS} for ${agentId}: AGENT_ERROR kind=${lastFailure.kind} message=${lastFailure.message}`,
            );
            // auth-required / protocol-error → fail fast, no second try
            if (!failureIsRecoverable(lastFailure)) break;
            continue;
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
            failure: null,
          });
          markWarm(agentId);
          return;
        } catch (err) {
          lastFailure = classifyRpcError({
            agentId,
            stage: "newSession",
            error: err,
          });
          console.warn(
            `[Zeros ensureSession] attempt ${attempt}/${ENSURE_SESSION_ATTEMPTS} for ${agentId} threw: kind=${lastFailure.kind} msg=${lastFailure.message}`,
          );
          if (!failureIsRecoverable(lastFailure)) break;
        }
      }

      // Both attempts exhausted (or we fast-failed on a terminal error).
      // Route by classification: recoverable → reconnecting (muted),
      // auth-required → Sign-in chip, anything else → failed (red).
      const failure =
        lastFailure ??
        classifyRpcError({
          agentId,
          stage: "newSession",
          error: new Error("No response"),
        });
      patch(chatId, {
        status: statusForFailure(failure),
        error: failure.message,
        failure,
      });
      })();

      ensureInFlightRef.current.set(chatId, work);
      try {
        await work;
      } finally {
        ensureInFlightRef.current.delete(chatId);
      }
    },
    [bridge, patch, markWarm],
  );

  // Expose ensureSession to the bridge-listeners effect (for silent
  // respawn on AGENT_AGENT_EXITED).
  useEffect(() => {
    ensureSessionRef.current = ensureSession;
  }, [ensureSession]);

  const sendPrompt = useCallback<SessionsCtx["sendPrompt"]>(
    async (chatId, text, displayText, attachments) => {
      if (!bridge) return;
      let current = sessionsRef.current[chatId];
      if (!current || !current.agentId) return;
      if (current.status === "streaming") return;
      // If the session bounced to warming/reconnecting (engine
      // respawn, agent crashed mid-turn) await one rebuild before
      // dropping the prompt. Previously we'd silently return when
      // sessionId was null, so the user's send button click did
      // nothing. Now we surface a real failure status if the rebuild
      // can't recover.
      if (!current.sessionId && ensureSessionRef.current) {
        try {
          await ensureSessionRef.current(chatId, current.agentId);
        } catch {
          /* ensureSession patches the slot with the failure */
        }
        current = sessionsRef.current[chatId];
        if (!current || !current.sessionId) return;
      }
      if (!current.sessionId) return;

      const userMessage: AgentTextMessage = {
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
        messages: capMessages([...current.messages, userMessage]),
      });

      // Prompt flow:
      //   1. Send the prompt against the current sessionId.
      //   2. If it fails with a RECOVERABLE failure (timeout /
      //      transport-closed), the engine is most likely still warm
      //      but our session is stale; silently rebuild ONCE via
      //      ensureSession(force) and retry the prompt.
      //   3. Anything non-recoverable (auth-required, protocol-error,
      //      subprocess-exited) surfaces via classification. No sentinel
      //      strings, no loops.
      const runPrompt = async (sessionId: string) =>
        bridge.request<AgentPromptCompleteMessage | AgentPromptFailedMessage>(
          {
            type: "AGENT_PROMPT",
            agentId: current.agentId!,
            sessionId,
            prompt,
          },
          10 * 60_000,
        );

      const rebuildAndRetry = async (): Promise<
        AgentPromptCompleteMessage | AgentPromptFailedMessage | null
      > => {
        patch(chatId, { status: "warming", error: null, failure: null });
        try {
          await ensureSessionRef.current?.(chatId, current.agentId!, {
            force: true,
          });
        } catch {
          /* surfaces via sessionsRef below */
        }
        const rebuilt = sessionsRef.current[chatId];
        if (!rebuilt?.sessionId || rebuilt.status !== "ready") return null;
        patch(chatId, {
          status: "streaming",
          error: null,
          failure: null,
          messages: capMessages([...rebuilt.messages, userMessage]),
        });
        return runPrompt(rebuilt.sessionId);
      };

      try {
        let resp: AgentPromptCompleteMessage | AgentPromptFailedMessage | null;
        try {
          resp = await runPrompt(current.sessionId);
        } catch (firstErr) {
          const failure = classifyRpcError({
            agentId: current.agentId!,
            stage: "prompt",
            error: firstErr,
          });
          if (!failureIsRecoverable(failure)) {
            patch(chatId, {
              status: statusForFailure(failure),
              error: failure.message,
              failure,
            });
            return;
          }
          resp = await rebuildAndRetry();
          if (!resp) {
            // ensureSession already reflected the right status (reconnecting
            // / auth-required / failed) into the slot — nothing to do here.
            return;
          }
        }

        if (resp.type === "AGENT_PROMPT_FAILED") {
          const failure = failureFromAcpError(
            { ...resp, message: resp.error } as unknown as AgentErrorMessage,
            "prompt",
          );
          patch(chatId, {
            status: statusForFailure(failure),
            error: failure.message,
            failure,
          });
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
          const next: AgentUsage = turnUsage
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
              lastStopReason: resp!.type === "AGENT_PROMPT_COMPLETE" ? resp!.stopReason : null,
              usage: next,
            },
          };
        });
      } catch (err) {
        const failure = classifyRpcError({
          agentId: current.agentId!,
          stage: "prompt",
          error: err,
        });
        patch(chatId, {
          status: statusForFailure(failure),
          error: failure.message,
          failure,
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
        type: "AGENT_CANCEL",
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
        type: "AGENT_PERMISSION_RESPONSE",
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
      // engine echoes back via AGENT_MODE_CHANGED (or AGENT_ERROR).
      patch(chatId, { currentModeId: modeId });
      try {
        const resp = await bridge.request<
          AgentModeChangedMessage | AgentErrorMessage
        >(
          {
            type: "AGENT_SET_MODE",
            agentId: current.agentId,
            sessionId: current.sessionId,
            modeId,
          },
          10_000,
        );
        if (resp.type === "AGENT_ERROR") {
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

  const listSessionsFor = useCallback<SessionsCtx["listSessionsFor"]>(
    async (agentId, opts) => {
      if (!bridge) throw new Error("Engine not connected");
      const resp = await bridge.request<
        AgentSessionsListMessage | AgentErrorMessage
      >(
        {
          type: "AGENT_LIST_SESSIONS",
          agentId,
          cwd: opts?.cwd,
          cursor: opts?.cursor,
        },
        30_000,
      );
      if (resp.type === "AGENT_ERROR") throw new Error(resp.message);
      return {
        sessions: resp.sessions,
        nextCursor: resp.nextCursor ?? null,
      };
    },
    [bridge],
  );

  const loadIntoChat = useCallback<SessionsCtx["loadIntoChat"]>(
    async (chatId, agentId, sessionId, options) => {
      if (!bridge) return;
      patch(chatId, {
        ...BLANK,
        agentId,
        agentName: options?.agentName ?? agentId,
        sessionId,
        status: "warming",
      });
      try {
        const resp = await bridge.request<
          AgentSessionLoadedMessage | AgentErrorMessage
        >(
          {
            type: "AGENT_LOAD_SESSION",
            agentId,
            sessionId,
            cwd: options?.cwd,
            env: options?.env,
          },
          5 * 60_000,
        );
        if (resp.type === "AGENT_ERROR") {
          patch(chatId, { status: "failed", error: resp.message });
          return;
        }
        patch(chatId, {
          status: "ready",
          sessionId: resp.sessionId,
          availableModes: resp.response.modes?.availableModes ?? [],
          currentModeId: resp.response.modes?.currentModeId ?? null,
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

  const getSession = useCallback<SessionsCtx["getSession"]>(
    (chatId) => sessionsRef.current[chatId],
    [],
  );

  const disposeAll = useCallback<SessionsCtx["disposeAll"]>(() => {
    setSessions({});
    sessionToChatRef.current = {};
    setWarmAgentIds(new Set());
  }, []);

  const value = useMemo<SessionsCtx>(
    () => ({
      sessions,
      getSession,
      listAgents,
      initAgent,
      ensureSession,
      sendPrompt,
      cancel,
      respondToPermission,
      setMode,
      reset,
      listSessionsFor,
      loadIntoChat,
      warmAgentIds,
      disposeAll,
    }),
    [
      sessions,
      getSession,
      listAgents,
      initAgent,
      ensureSession,
      sendPrompt,
      cancel,
      setMode,
      respondToPermission,
      reset,
      listSessionsFor,
      loadIntoChat,
      warmAgentIds,
      disposeAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Per-chat session access. Returns an object shaped like the old
 *  useAgentSession return value so <AgentChat session={...} /> works as-is.
 *  Also exposes ensureSession for the Chat view to warm up on mount. */
export function useChatSession(
  chatId: string,
): AgentSessionState & AgentSessionControls & {
  ensureSession(agentId: string, options?: StartForChatOptions): Promise<void>;
} {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useChatSession must be used inside <AgentSessionsProvider>");
  }
  const slot = ctx.sessions[chatId] ?? BLANK;

  return {
    ...slot,
    listAgents: ctx.listAgents,
    initAgent: ctx.initAgent,
    // startSession kept for API compatibility with AgentChat / AgentMode —
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
export function useAgentSessions(): SessionsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useAgentSessions must be used inside <AgentSessionsProvider>");
  }
  return ctx;
}

// Re-export the AgentMessage type so consumers don't have to reach into
// the older hook file.
export type { AgentMessage };
