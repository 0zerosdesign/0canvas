// ──────────────────────────────────────────────────────────
// AgentSessionsProvider — bridge-connected actions over the Zustand store
// ──────────────────────────────────────────────────────────
//
// Phase 0 step 3 split this file in two:
//   - sessions-store.ts owns *data* (per-chat slots, warm-agent set,
//     bridge-notification reducers). Subscribes via selectors so chat
//     A's stream doesn't re-render chat B's components.
//   - This file owns *actions that need the bridge* (ensureSession,
//     sendPrompt, …). It writes to the store via store actions.
//
// The public API (`useChatSession`, `useAgentSessions`) is unchanged
// from the caller's perspective. Internally, slot reads are now
// scoped to one chat via Zustand selectors, killing the cross-chat
// re-render cascade.
//
// ──────────────────────────────────────────────────────────

import React, {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type {
  ContentBlock,
  InitializeResponse,
  RequestPermissionResponse,
} from "@agentclientprotocol/sdk";
import type { ListSessionsResponse } from "@agentclientprotocol/sdk";
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
import { useBridge } from "../bridge/use-bridge";
import {
  BLANK_USAGE,
  type AgentMessage,
  type AgentSessionControls,
  type AgentSessionState,
  type AgentTextMessage,
  type AgentUsage,
  type SessionStatus,
  type StartSessionOptions,
} from "./use-agent-session";
import {
  BLANK,
  MAX_MESSAGES_PER_CHAT,
  useSessionsStore,
} from "./sessions-store";
import {
  appendMessages as persistAppendMessages,
  clearChat as persistClearChat,
  setChatMeta as persistSetChatMeta,
  windowMessages as persistWindowMessages,
} from "./agent-history-client";
import {
  classifyRpcError,
  isRecoverable as failureIsRecoverable,
  type AgentFailure,
} from "../bridge/failure";

/** How many messages we hydrate into memory per chat on first mount.
 *  Older messages stay on disk and load on scroll-up. 200 covers a
 *  multi-hour session without scrolling. */
const HYDRATE_WINDOW = 200;

// MAX_MESSAGES_PER_CHAT is re-exported for any caller that needs the
// cap (display threshold, etc.). The store enforces it on writes.
export { MAX_MESSAGES_PER_CHAT };

/** User-visible ceiling for session creation. Single attempt — if it
 *  fails we surface the classified failure rather than loop. 10s gives
 *  Claude Agent and Codex enough room for their cold newSession RPC. */
const ENSURE_SESSION_ATTEMPT_TIMEOUT_MS = 10_000;
const ENSURE_SESSION_ATTEMPTS = 1;

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

/** Map a failure classification to the UI session status. */
function statusForFailure(failure: AgentFailure): SessionStatus {
  if (failure.kind === "auth-required") return "auth-required";
  if (failureIsRecoverable(failure)) return "reconnecting";
  return "failed";
}

interface StartForChatOptions extends StartSessionOptions {
  /** Absolute path the agent subprocess should use as cwd. */
  cwd?: string;
  /** Force a fresh session even when one is already ready. Used when
   *  the user changes model/effort. */
  force?: boolean;
}

/** Bridge-connected actions. The context value contains ONLY these —
 *  no session data — so the value is stable and downstream consumers
 *  using `useContext(ActionsCtx)` don't re-render on every token. */
interface SessionsActions {
  getSession(chatId: string): AgentSessionState | undefined;
  listAgents(force?: boolean): Promise<BridgeRegistryAgent[]>;
  initAgent(agentId: string): Promise<InitializeResponse>;
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
  setMode(chatId: string, modeId: string): Promise<void>;
  reset(chatId: string): void;
  listSessionsFor(
    agentId: string,
    opts?: { cwd?: string; cursor?: string | null },
  ): Promise<ListSessionsResponse>;
  loadIntoChat(
    chatId: string,
    agentId: string,
    sessionId: string,
    options?: StartForChatOptions,
  ): Promise<void>;
  /** Load on-disk transcript for `chatId` if the in-memory slot is
   *  empty. Idempotent — safe to call from a chat view's mount effect.
   *  Does NOT touch a slot that's already populated; the live store
   *  is the source of truth once the user is interacting. */
  hydrateChat(chatId: string): Promise<void>;
  disposeAll(): void;
}

/** Public surface — what `useAgentSessions()` returns.
 *
 *  This used to also expose `sessions: Record<string, AgentSessionState>`
 *  and `warmAgentIds: ReadonlySet<string>` as direct fields. That broke
 *  consumers' useEffect dependency arrays — every store mutation
 *  produced a new returned-object reference, so any effect with
 *  `[..., sessions]` in its deps re-fired on every token stream chunk.
 *  One such effect (empty-composer) called `sessions.initAgent` inside,
 *  which produced a runaway 50+/sec AGENT_INIT_AGENT loop that
 *  saturated the bridge queue and prevented real prompts from getting
 *  through (observed 2026-04-26 with codex never responding).
 *
 *  The data fields now live behind dedicated hooks
 *  (`useChatSlot(id)` for one chat, `useWarmAgentIds()` for the warm
 *  set, `useAgentSessions().getSession(id)` for one-shot access). The
 *  context value itself is the stable actions object — its identity
 *  only changes if a memo dep on the provider does. */
export type SessionsCtx = SessionsActions;

const ActionsCtx = createContext<SessionsActions | null>(null);

export function AgentSessionsProvider({ children }: { children: React.ReactNode }) {
  const bridge = useBridge();

  // Helper: snapshot the store. Used inside async actions to bypass
  // React's closure capture problem (state read pre-await is stale).
  const getStore = useSessionsStore.getState;

  // Per-chat in-flight ensureSession promises. Concurrent callers wait on
  // the existing promise instead of starting a duplicate. Force=true
  // bypasses (model swap intends a rebuild).
  const ensureInFlightRef = useRef(new Map<string, Promise<void>>());

  // Bridge listeners feed the store. Phase 0 step 5: notifications are
  // buffered into a ring of arrays and flushed once per animation frame
  // inside `startTransition`. Token-rate inputs (10–100/s during a
  // streaming response) collapse to ≤60 store updates per second, and
  // React tags those updates as non-urgent so typing/clicks always
  // pre-empt them. Pre-buffer the path was: 1 setState per chunk
  // = render storm; now: 1 setState per frame = smooth.
  useEffect(() => {
    if (!bridge) return;

    type SessionNotification =
      import("@agentclientprotocol/sdk").SessionNotification;
    type PermissionReq =
      import("@agentclientprotocol/sdk").RequestPermissionRequest;

    const updateBuffer: SessionNotification[] = [];
    const permBuffer: Array<{
      agentId: string;
      permissionId: string;
      request: PermissionReq;
    }> = [];
    const stderrBuffer: Array<{ agentId: string; line: string }> = [];
    const exitBuffer: Array<{
      agentId: string;
      code: number | null;
      signal: string | null;
    }> = [];

    let rafHandle: number | null = null;

    const flush = () => {
      rafHandle = null;
      if (
        updateBuffer.length === 0 &&
        permBuffer.length === 0 &&
        stderrBuffer.length === 0 &&
        exitBuffer.length === 0
      ) {
        return;
      }
      // Drain into local arrays so any new event arriving mid-flush
      // queues for the next frame instead of being lost or re-processed.
      const updates = updateBuffer.splice(0);
      const perms = permBuffer.splice(0);
      const stderrs = stderrBuffer.splice(0);
      const exits = exitBuffer.splice(0);

      // Permissions and exits are control-plane events — they affect
      // routing (session status, sign-in chip). Keep them URGENT so the
      // user sees the prompt / failure immediately. Token chunks and
      // stderr are content; they go through startTransition so React
      // can drop intermediate frames if a newer one arrives.
      const store = useSessionsStore.getState();

      for (const p of perms) {
        store.applyBridgePermissionRequest(
          p.agentId,
          p.permissionId,
          p.request,
        );
      }
      for (const e of exits) {
        console.log(
          `[Zeros AGENT_AGENT_EXITED] ${e.agentId} code=${e.code} signal=${e.signal}`,
        );
        store.applyBridgeAgentExit(e.agentId);
      }

      startTransition(() => {
        const s = useSessionsStore.getState();
        for (const n of updates) s.applyBridgeUpdate(n);
        for (const t of stderrs) s.applyBridgeStderr(t.agentId, t.line);
      });
    };

    const schedule = () => {
      if (rafHandle === null) {
        rafHandle = requestAnimationFrame(flush);
      }
    };

    const unsubUpdate = bridge.on("AGENT_SESSION_UPDATE", (raw) => {
      const msg = raw as { agentId: string; notification: SessionNotification };
      // Drop replay content events SYNCHRONOUSLY at receive time.
      //
      // Why here and not in applyBridgeUpdate (the rAF flush): the flag
      // toggles inside loadIntoChat's finally block. The flush runs
      // lazily, on the next animation frame. For a long replay (Claude
      // Code dumps 100+ session_updates), the AGENT_SESSION_LOADED RPC
      // resolves *before* the rAF fires — so by the time the flush
      // checks the flag, it's already false, and every replay event
      // gets through. That's the duplication that grows on every
      // reopen (observed 2026-04-26).
      //
      // Checking at receive time is reliable because the flag is set
      // synchronously *before* loadIntoChat awaits the bridge, so all
      // replay events arrive while the flag is still true.
      const state = useSessionsStore.getState();
      const chatId = state.sessionToChatId[msg.notification.sessionId];
      if (chatId && state.loadInProgress.has(chatId)) {
        const upd = msg.notification.update as { sessionUpdate?: string };
        const isContentEvent =
          upd.sessionUpdate === "user_message_chunk" ||
          upd.sessionUpdate === "agent_message_chunk" ||
          upd.sessionUpdate === "agent_thought_chunk" ||
          upd.sessionUpdate === "tool_call" ||
          upd.sessionUpdate === "tool_call_update";
        if (isContentEvent) return;
      }
      updateBuffer.push(msg.notification);
      schedule();
    });

    const unsubPerm = bridge.on("AGENT_PERMISSION_REQUEST", (raw) => {
      const msg = raw as {
        agentId: string;
        permissionId: string;
        request: PermissionReq;
      };
      permBuffer.push({
        agentId: msg.agentId,
        permissionId: msg.permissionId,
        request: msg.request,
      });
      schedule();
    });

    const unsubStderr = bridge.on("AGENT_AGENT_STDERR", (raw) => {
      const msg = raw as { agentId: string; line: string };
      stderrBuffer.push({ agentId: msg.agentId, line: msg.line });
      schedule();
    });

    const unsubExit = bridge.on("AGENT_AGENT_EXITED", (raw) => {
      const msg = raw as {
        agentId: string;
        code: number | null;
        signal: string | null;
      };
      // Agent subprocess exited. The ENGINE owns respawn entirely (see
      // the always-warm pool in session-manager.ts). The UI's job is
      // just to reflect the blip — mark chats `reconnecting` and clear
      // the dead sessionId. The next user action triggers ensureSession,
      // which lands on the (by-then) respawned subprocess.
      //
      // We intentionally do NOT schedule an automatic retry. Loops here
      // produced "reconnecting forever" bugs when revival was impossible
      // (e.g. missing auth).
      exitBuffer.push({
        agentId: msg.agentId,
        code: msg.code,
        signal: msg.signal,
      });
      schedule();
    });

    return () => {
      // Flush anything still queued so a tear-down (e.g. provider remount,
      // bridge swap on engine respawn) doesn't drop final permission
      // prompts or exit events that the next listener can't observe.
      if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
      flush();
      unsubUpdate();
      unsubPerm();
      unsubStderr();
      unsubExit();
    };
  }, [bridge]);

  // ── Actions ─────────────────────────────────────────────

  const listAgents = useCallback<SessionsActions["listAgents"]>(
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

  const initAgent = useCallback<SessionsActions["initAgent"]>(
    async (agentId) => {
      if (!bridge) throw new Error("Engine not connected");
      // 5 min ceiling on the bridge request covers first-time npx/uvx
      // cold starts. The engine's always-warm pool keeps subsequent
      // calls sub-second.
      const resp = await bridge.request<
        AgentAgentInitializedMessage | AgentErrorMessage
      >({ type: "AGENT_INIT_AGENT", agentId }, 5 * 60_000);
      if (resp.type === "AGENT_ERROR") {
        getStore().setWarmAgent(agentId, false);
        const failure = failureFromAcpError(resp, "initialize");
        const err = new Error(failure.message) as Error & {
          failure?: AgentFailure;
        };
        err.failure = failure;
        throw err;
      }
      getStore().setWarmAgent(agentId, true);
      return resp.initialize;
    },
    [bridge, getStore],
  );

  // ensureSession is referenced by sendPrompt's recovery path (and could
  // be by future bridge handlers); a ref breaks the circular dependency
  // without re-arranging the component.
  const ensureSessionRef = useRef<SessionsActions["ensureSession"] | null>(null);

  const ensureSession = useCallback<SessionsActions["ensureSession"]>(
    async (chatId, agentId, options) => {
      if (!bridge) return;
      const store = getStore();
      const existing = store.sessions[chatId];

      // Already wired up and healthy — nothing to do unless the caller
      // forces a rebuild. `reconnecting` and `auth-required` count as
      // "not healthy" so user interaction kicks retry.
      if (
        !options?.force &&
        existing &&
        existing.sessionId &&
        existing.agentId === agentId &&
        (existing.status === "ready" || existing.status === "streaming")
      ) {
        return;
      }

      // De-dup concurrent calls. A user clicking Send while initial
      // creation is mid-warming would otherwise kick off a parallel
      // newSession, orphaning the first sessionId. Wait on the existing
      // promise instead. Force still bypasses.
      if (!options?.force) {
        const inflight = ensureInFlightRef.current.get(chatId);
        if (inflight) return inflight;
      }

      const work = (async () => {
        getStore().setSession(chatId, {
          ...BLANK,
          agentId,
          agentName: options?.agentName ?? agentId,
          status: "warming",
          messages: existing?.messages ?? [],
        });

        // Race the bridge request against an outer setTimeout. The
        // ws-client has its own reconnect-queue window
        // (RECONNECT_GRACE_MS, ~7s) which would otherwise mask the cap
        // we pass down — the race makes it absolute.
        let lastFailure: AgentFailure | null = null;
        const attemptOnce = async (): Promise<
          AgentSessionCreatedMessage | AgentErrorMessage
        > => {
          const timer = new Promise<never>((_, reject) => {
            window.setTimeout(
              () =>
                reject(
                  new Error(
                    `Request timeout: AGENT_NEW_SESSION (${ENSURE_SESSION_ATTEMPT_TIMEOUT_MS}ms cap)`,
                  ),
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
              if (!failureIsRecoverable(lastFailure)) break;
              continue;
            }
            getStore().patchSession(chatId, {
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
            getStore().setWarmAgent(agentId, true);
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

        // Both attempts exhausted (or fast-failed). Route by
        // classification: recoverable → reconnecting (muted),
        // auth-required → Sign-in chip, else → failed (red).
        const failure =
          lastFailure ??
          classifyRpcError({
            agentId,
            stage: "newSession",
            error: new Error("No response"),
          });
        getStore().patchSession(chatId, {
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
    [bridge, getStore],
  );

  useEffect(() => {
    ensureSessionRef.current = ensureSession;
  }, [ensureSession]);

  const sendPrompt = useCallback<SessionsActions["sendPrompt"]>(
    async (chatId, text, displayText, attachments) => {
      if (!bridge) return;
      let current = getStore().sessions[chatId];
      if (!current || !current.agentId) return;
      if (current.status === "streaming") return;

      // If the session bounced (engine respawn, agent crashed mid-turn)
      // await one rebuild before dropping the prompt.
      if (!current.sessionId && ensureSessionRef.current) {
        try {
          await ensureSessionRef.current(chatId, current.agentId);
        } catch {
          /* ensureSession patches the slot with the failure */
        }
        current = getStore().sessions[chatId];
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

      // Append the user bubble immediately for instant UX feedback.
      getStore().patchSession(chatId, {
        status: "streaming",
        error: null,
        messages: capUserAppend(current.messages, userMessage),
      });

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
        getStore().patchSession(chatId, {
          status: "warming",
          error: null,
          failure: null,
        });
        try {
          await ensureSessionRef.current?.(chatId, current.agentId!, {
            force: true,
          });
        } catch {
          /* surfaces via store below */
        }
        const rebuilt = getStore().sessions[chatId];
        if (!rebuilt?.sessionId || rebuilt.status !== "ready") return null;
        getStore().patchSession(chatId, {
          status: "streaming",
          error: null,
          failure: null,
          messages: capUserAppend(rebuilt.messages, userMessage),
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
            getStore().patchSession(chatId, {
              status: statusForFailure(failure),
              error: failure.message,
              failure,
            });
            return;
          }
          resp = await rebuildAndRetry();
          if (!resp) return;
        }

        if (resp.type === "AGENT_PROMPT_FAILED") {
          const failure = failureFromAcpError(
            { ...resp, message: resp.error } as unknown as AgentErrorMessage,
            "prompt",
          );
          getStore().patchSession(chatId, {
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
        const slot = getStore().sessions[chatId];
        if (!slot) return;
        const u = slot.usage;
        const nextUsage: AgentUsage = turnUsage
          ? {
              ...u,
              inputTokens: u.inputTokens + (turnUsage.inputTokens ?? 0),
              outputTokens: u.outputTokens + (turnUsage.outputTokens ?? 0),
              cachedReadTokens:
                u.cachedReadTokens + (turnUsage.cachedReadTokens ?? 0),
              cachedWriteTokens:
                u.cachedWriteTokens + (turnUsage.cachedWriteTokens ?? 0),
              thoughtTokens: u.thoughtTokens + (turnUsage.thoughtTokens ?? 0),
            }
          : u;
        getStore().patchSession(chatId, {
          status: "ready",
          lastStopReason:
            resp.type === "AGENT_PROMPT_COMPLETE" ? resp.stopReason : null,
          usage: nextUsage,
        });
      } catch (err) {
        const failure = classifyRpcError({
          agentId: current.agentId!,
          stage: "prompt",
          error: err,
        });
        getStore().patchSession(chatId, {
          status: statusForFailure(failure),
          error: failure.message,
          failure,
        });
      }
    },
    [bridge, getStore],
  );

  const cancel = useCallback<SessionsActions["cancel"]>(
    async (chatId) => {
      if (!bridge) return;
      const current = getStore().sessions[chatId];
      if (!current?.agentId || !current.sessionId) return;
      bridge.send({
        type: "AGENT_CANCEL",
        agentId: current.agentId,
        sessionId: current.sessionId,
      });
    },
    [bridge, getStore],
  );

  const respondToPermission = useCallback<SessionsActions["respondToPermission"]>(
    (chatId, response) => {
      if (!bridge) return;
      const current = getStore().sessions[chatId];
      if (!current?.pendingPermission) return;
      bridge.send({
        type: "AGENT_PERMISSION_RESPONSE",
        permissionId: current.pendingPermission.permissionId,
        response,
      });
      getStore().patchSession(chatId, { pendingPermission: null });
    },
    [bridge, getStore],
  );

  const setMode = useCallback<SessionsActions["setMode"]>(
    async (chatId, modeId) => {
      if (!bridge) return;
      const current = getStore().sessions[chatId];
      if (!current?.agentId || !current.sessionId) return;
      // Optimistic flip; engine echoes back via AGENT_MODE_CHANGED or AGENT_ERROR.
      const previousModeId = current.currentModeId;
      getStore().patchSession(chatId, { currentModeId: modeId });
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
          getStore().patchSession(chatId, {
            currentModeId: previousModeId,
            error: resp.message,
          });
        }
      } catch (err) {
        getStore().patchSession(chatId, {
          currentModeId: previousModeId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [bridge, getStore],
  );

  const reset = useCallback<SessionsActions["reset"]>(
    (chatId) => {
      getStore().removeSession(chatId);
      // Drop on-disk transcript too so a "reset" really starts clean.
      void persistClearChat(chatId).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[Zeros agent-history] reset clear failed:", err);
      });
    },
    [getStore],
  );

  const hydrateChat = useCallback<SessionsActions["hydrateChat"]>(
    async (chatId) => {
      const slot = getStore().sessions[chatId];
      // Only hydrate when the slot is genuinely empty. If the user has
      // already started talking we trust the live state — disk is just
      // a snapshot, the live store is canonical until the user reloads.
      if (slot && slot.messages.length > 0) return;
      try {
        const messages = await persistWindowMessages(chatId, HYDRATE_WINDOW);
        if (messages.length === 0) return;
        // Pre-fix builds (before 2026-04-26) wrote agent replay events
        // to disk on every reopen, so existing chats have stacked
        // duplicates. Collapse runs of identical consecutive messages
        // before showing them. The fix that stops new duplicates lives
        // in the bridge listener (loadInProgress at receive time) — this
        // is purely cleanup of pre-existing disk content.
        const deduped = dedupeConsecutiveMessages(messages);
        // Re-read the slot after the await — the user may have started
        // typing while we were fetching, in which case live state wins.
        const fresh = getStore().sessions[chatId];
        if (fresh && fresh.messages.length > 0) return;
        getStore().setSession(chatId, {
          ...BLANK,
          ...(fresh ?? {}),
          messages: deduped,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[Zeros agent-history] hydrate failed:", err);
      }
    },
    [getStore],
  );

  const listSessionsFor = useCallback<SessionsActions["listSessionsFor"]>(
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

  const loadIntoChat = useCallback<SessionsActions["loadIntoChat"]>(
    async (chatId, agentId, sessionId, options) => {
      if (!bridge) return;
      // Preserve any messages already in the slot (typically just put
      // there by hydrateChat) — wiping them here is what produced the
      // "chat empty on reopen" bug for agents whose loadSession doesn't
      // replay (Codex, Cursor). Disk is the source of truth.
      const existing = getStore().sessions[chatId];
      getStore().setSession(chatId, {
        ...BLANK,
        agentId,
        agentName: options?.agentName ?? agentId,
        sessionId,
        status: "warming",
        messages: existing?.messages ?? [],
      });
      // Suppress the agent's loadSession replay (if any) while the RPC
      // is in flight. Without this, Claude Code re-emits every prior
      // turn as a fresh session_update, duplicating the disk hydrate.
      // The flag clears in the finally block so live messages from the
      // user's next prompt flow normally.
      getStore().setLoadInProgress(chatId, true);
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
          getStore().patchSession(chatId, {
            status: "failed",
            error: resp.message,
          });
          return;
        }
        getStore().patchSession(chatId, {
          status: "ready",
          sessionId: resp.sessionId,
          availableModes: resp.response.modes?.availableModes ?? [],
          currentModeId: resp.response.modes?.currentModeId ?? null,
          error: null,
        });
      } catch (err) {
        getStore().patchSession(chatId, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        getStore().setLoadInProgress(chatId, false);
      }
    },
    [bridge, getStore],
  );

  const getSession = useCallback<SessionsActions["getSession"]>(
    (chatId) => getStore().sessions[chatId],
    [getStore],
  );

  const disposeAll = useCallback<SessionsActions["disposeAll"]>(() => {
    getStore().clearAll();
    // Note: we deliberately do NOT clear the disk transcript here.
    // disposeAll is called on engine respawn (in-place project swap),
    // when the in-memory sessionIds become stale but the user still
    // wants their history when chats reopen on the new engine.
  }, [getStore]);

  // The actions object is stable across renders. No `sessions` field —
  // consumers reach into the store directly via useChatSession (sliced)
  // or useAgentSessions (full snapshot via subscription).
  const actions = useMemo<SessionsActions>(
    () => ({
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
      hydrateChat,
      disposeAll,
    }),
    [
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
      hydrateChat,
      disposeAll,
    ],
  );

  // ── Persistence subscription ────────────────────────────
  //
  // Fires after every store mutation (which is rAF-coalesced via the
  // bridge effect above). Diffs each chat's message list against the
  // last-persisted reference map and writes only the changed entries.
  // Streaming text chunks share a stable msgId, so the main process
  // upserts in place — no row explosion.
  //
  // Reference equality is the dirty marker: the store's reducers return
  // identical state when nothing changed, so unchanged chats short-circuit
  // before any diffing.
  useEffect(() => {
    let prevSessions = useSessionsStore.getState().sessions;
    const lastWritten = new Map<string, Map<string, AgentMessage>>();

    const unsubscribe = useSessionsStore.subscribe((state) => {
      if (state.sessions === prevSessions) return;
      const nextSessions = state.sessions;

      for (const [chatId, slot] of Object.entries(nextSessions)) {
        if (slot === prevSessions[chatId]) continue; // unchanged
        let chatMap = lastWritten.get(chatId);
        if (!chatMap) {
          chatMap = new Map();
          lastWritten.set(chatId, chatMap);
        }
        const toWrite: AgentMessage[] = [];
        for (const m of slot.messages) {
          // Reference identity tells us if this message was touched.
          // The store does immutable updates: a streaming chunk produces
          // a new message object, completed cards produce a new tool
          // object. Pristine messages keep the same ref → no write.
          if (chatMap.get(m.id) !== m) {
            toWrite.push(m);
            chatMap.set(m.id, m);
          }
        }
        if (toWrite.length > 0) {
          void persistAppendMessages(chatId, toWrite).catch((err) => {
            // eslint-disable-next-line no-console
            console.warn(
              `[Zeros agent-history] append failed for ${chatId}:`,
              err,
            );
          });
        }
        // Persist meta (agent + session id) when those change. Cheap —
        // only fires on session create / load / agent swap.
        const prevSlot = prevSessions[chatId];
        if (
          !prevSlot ||
          prevSlot.agentId !== slot.agentId ||
          prevSlot.sessionId !== slot.sessionId ||
          prevSlot.agentName !== slot.agentName
        ) {
          void persistSetChatMeta({
            chatId,
            agentId: slot.agentId,
            agentName: slot.agentName,
            sessionId: slot.sessionId,
          }).catch(() => {
            /* meta is best-effort */
          });
        }
      }

      // Drop entries from lastWritten for chats that disappeared (reset).
      // Lets the next ensureSession/hydrate write a full transcript again
      // instead of relying on stale diff state.
      for (const chatId of lastWritten.keys()) {
        if (!(chatId in nextSessions)) {
          lastWritten.delete(chatId);
        }
      }

      prevSessions = nextSessions;
    });

    return () => unsubscribe();
  }, []);

  return <ActionsCtx.Provider value={actions}>{children}</ActionsCtx.Provider>;
}

/** Append the user's just-sent bubble to a message list, preserving the
 *  per-chat cap. Extracted because it's used in two places (initial
 *  send + retry-after-rebuild). */
function capUserAppend(
  messages: AgentMessage[],
  userMessage: AgentTextMessage,
): AgentMessage[] {
  const next = [...messages, userMessage];
  if (next.length <= MAX_MESSAGES_PER_CHAT) return next;
  return next.slice(-MAX_MESSAGES_PER_CHAT);
}

/** Collapse runs of consecutive content-equal messages into one. Used
 *  by hydrateChat to clean up pre-existing on-disk duplicates from
 *  builds where the agent's loadSession replay landed in the store on
 *  every reopen. Conservative — only consecutive duplicates are
 *  removed, so a user who legitimately repeats themselves across
 *  separate turns keeps both bubbles. */
function dedupeConsecutiveMessages(messages: AgentMessage[]): AgentMessage[] {
  if (messages.length < 2) return messages;
  const out: AgentMessage[] = [];
  let prev: AgentMessage | null = null;
  for (const m of messages) {
    if (prev && messagesContentEqual(prev, m)) continue;
    out.push(m);
    prev = m;
  }
  return out;
}

function messagesContentEqual(a: AgentMessage, b: AgentMessage): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "text" && b.kind === "text") {
    return a.role === b.role && a.text === b.text;
  }
  if (a.kind === "tool" && b.kind === "tool") {
    if (a.title !== b.title) return false;
    if (a.toolKind !== b.toolKind) return false;
    // Stringified rawInput catches "same tool, same arguments" — the
    // shape replay always reproduces identically. We don't compare
    // status because a replayed tool can land in a different terminal
    // state (completed vs failed-but-retried) and we'd rather keep
    // both than collapse a real second invocation.
    try {
      return JSON.stringify(a.rawInput) === JSON.stringify(b.rawInput);
    } catch {
      return false;
    }
  }
  return false;
}

/** Per-chat session access. Returns an object shaped like the old
 *  useAgentSession return value so <AgentChat session={...} /> works as-is.
 *  Also exposes ensureSession for the Chat view to warm up on mount.
 *
 *  Subscribes via Zustand selector so this hook only re-renders when
 *  *this chat's* slot changes — not when sibling chats stream tokens. */
export function useChatSession(
  chatId: string,
): AgentSessionState & AgentSessionControls & {
  ensureSession(agentId: string, options?: StartForChatOptions): Promise<void>;
  hydrateChat(): Promise<void>;
} {
  const ctx = useContext(ActionsCtx);
  if (!ctx) {
    throw new Error("useChatSession must be used inside <AgentSessionsProvider>");
  }
  const slot = useSessionsStore((s) => s.sessions[chatId] ?? BLANK);

  return {
    ...slot,
    listAgents: ctx.listAgents,
    initAgent: ctx.initAgent,
    // startSession kept for API compatibility; forwards to ensureSession
    // with the chat's id baked in.
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
    hydrateChat: () => ctx.hydrateChat(chatId),
  };
}

/** App-level access for flows that aren't tied to a single chat
 *  (e.g. the settings Agents panel fetching the registry).
 *
 *  Returns the **stable** actions context. Its identity does NOT change
 *  on every store mutation — that's the whole point. Consumers can put
 *  this in `useEffect` / `useCallback` deps without their effects
 *  re-firing on every chat token (the bug that produced the 50+/sec
 *  AGENT_INIT_AGENT flood).
 *
 *  For chat-slot data: use `useChatSession(chatId)` (sliced) or
 *  `useChatSlot(chatId)` (raw slot).
 *
 *  For warm-agent state: use `useWarmAgentIds()`. */
export function useAgentSessions(): SessionsCtx {
  const ctx = useContext(ActionsCtx);
  if (!ctx) {
    throw new Error("useAgentSessions must be used inside <AgentSessionsProvider>");
  }
  return ctx;
}

// Re-export the warm-agent hook so consumers don't have to reach into
// the store module directly.
export { useWarmAgentIds } from "./sessions-store";

// Re-export the AgentMessage type so consumers don't have to reach into
// the older hook file.
export type { AgentMessage };
