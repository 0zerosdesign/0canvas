// ──────────────────────────────────────────────────────────
// Browser-side WebSocket client for the Zeros engine
// ──────────────────────────────────────────────────────────
//
// Connects to the Zeros engine on localhost.
// Port resolution order (first match wins):
//   1. window.__ZEROS_PORT__   — optional native-shell injection
//   2. native get_engine_port command — source of truth in the Mac app
//   3. hardcoded 24193           — plain browser dev harness fallback
//
// Reconnect strategy uses exponential backoff (1s → 15s cap) so a
// briefly-flaky engine respawns quickly without hammering the port
// once it's genuinely down. Requests made during a transient
// disconnect are queued for RECONNECT_GRACE_MS; inside that window
// we trust the watchdog to bring the engine back, and the queued
// message flushes on open — the user never sees the blip. After
// the grace window a queued request rejects with a soft-fail error
// the UI can match to show a muted "Reconnecting…" line.
// ──────────────────────────────────────────────────────────

import type { BridgeMessage } from "./messages";
import { createMessageId } from "./messages";

const DEFAULT_ENGINE_PORT = 24193;

/** Ladder for reconnect backoff in ms. Index = consecutive-failure count. */
const RECONNECT_LADDER = [1_000, 2_000, 4_000, 8_000, 15_000];

/** How long to buffer requests made while the socket is briefly down,
 *  before giving up and surfacing a soft-fail error. Matches Phase 3's
 *  7-second "Reconnecting…" threshold in the chat UI. */
const RECONNECT_GRACE_MS = 7_000;

/** Cap on the number of requests we'll queue during a disconnect so
 *  a runaway caller can't pin unbounded memory. The previous 32 was
 *  too tight for realistic multi-chat use — every project switch
 *  triggers a brief disconnect, every chat that's mid-mount fires
 *  AGENT_LOAD_SESSION, and listAgents from the empty composer adds
 *  one more. With 7+ live chats and a 7s reconnect grace window,
 *  hitting the cap was easy and surfaced as "queue full" timeouts on
 *  random chats. 256 covers the realistic upper bound (every chat
 *  the user has open + a handful of registry probes) without burning
 *  meaningful memory. The deadline check still expires entries so a
 *  stuck reconnect doesn't grow the queue forever. */
const MAX_QUEUED_REQUESTS = 256;

/** Phase 2 §2.11.3 — per-type cap on queued requests for high-fan-out
 *  message types that React effects can re-fire while disconnected.
 *  AGENT_LOAD_SESSION is the worst offender: every chat-view mount
 *  emits one, and a chat-switch storm during a brief reconnect can
 *  pile up dozens for the same chatId. We cap each type at 50 entries
 *  in the queue and drop the oldest when the cap is reached. The
 *  newest write always wins because session state is monotonic. */
const PER_TYPE_QUEUE_CAP: Record<string, number> = {
  AGENT_LOAD_SESSION: 50,
  AGENT_LIST_SESSIONS: 50,
};

/**
 * Resolve the engine port. Cached at module level so the reconnect
 * timer doesn't hit native IPC on every retry. The cache can be
 * invalidated via `invalidateEnginePort()` — used by the in-place
 * project swap, where Electron respawns the engine on a fresh port
 * and we need to drop the old value before the next connect().
 */
let cachedPortPromise: Promise<number> | null = null;
function resolveEnginePort(): Promise<number> {
  if (cachedPortPromise) return cachedPortPromise;
  cachedPortPromise = (async () => {
    if (typeof window === "undefined") return DEFAULT_ENGINE_PORT;

    const injected = (window as unknown as { __ZEROS_PORT__?: number })
      .__ZEROS_PORT__;
    if (typeof injected === "number" && Number.isFinite(injected) && injected > 0) {
      return injected;
    }

    try {
      const { isNativeRuntime, nativeInvoke } = await import("../../native/runtime");
      if (isNativeRuntime()) {
        const port = await nativeInvoke<number | null>("get_engine_port");
        if (typeof port === "number" && port > 0) return port;
      }
    } catch (err) {
      console.warn("[Zeros] get_engine_port failed:", err);
    }

    return DEFAULT_ENGINE_PORT;
  })();
  return cachedPortPromise;
}

/** Drop the cached engine port. Call when the engine respawns on a
 *  new port (in-place project swap) — the next connect() will
 *  re-resolve via native IPC. */
export function invalidateEnginePort(): void {
  cachedPortPromise = null;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface PendingRequest {
  resolve: (msg: BridgeMessage) => void;
  reject: (err: Error) => void;
  timer: number;
}

interface QueuedRequest {
  msg: Partial<BridgeMessage> & { type: string };
  timeoutMs: number;
  resolve: (msg: BridgeMessage) => void;
  reject: (err: Error) => void;
  /** Absolute-time deadline. If we're still disconnected at this moment,
   *  the request rejects with a soft-fail error. */
  deadline: number;
}

export class CanvasBridgeClient {
  private ws: WebSocket | null = null;
  /** A WebSocket that's been created but hasn't fired onopen yet.
   *  Tracking this prevents `connect()` from racing with itself: HMR
   *  reloads or rapid status churn used to stack orphan sockets, each
   *  holding an open connection to the engine. The engine broadcasts to
   *  every client, so 3 orphans = every chunk arriving at the renderer
   *  3 times = one bubble with the response text concatenated 3x.
   *  See coalesce logic in use-agent-session.tsx:appendText. */
  private pendingWs: WebSocket | null = null;
  private handlers = new Map<string, Set<(msg: BridgeMessage) => void>>();
  private pendingRequests = new Map<string, PendingRequest>();
  private queuedRequests: QueuedRequest[] = [];
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private _status: ConnectionStatus = "disconnected";
  private _disposed = false;

  get status(): ConnectionStatus {
    return this._status;
  }

  /** Whether the engine is connected and ready */
  private _engineConnected = false;
  get extensionConnected(): boolean {
    return this._engineConnected;
  }

  async connect(): Promise<void> {
    if (this._disposed) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;
    // In-flight guard. Without it, two concurrent connect() calls both
    // await enginePortPromise then both `new WebSocket(...)` — the
    // earlier one is orphaned (its onopen never wins the assignment to
    // this.ws) but its TCP connection stays open until GC. The engine
    // broadcasts to every connected client, so the renderer sees every
    // chunk multiplied by the orphan count.
    if (this.pendingWs) return;

    const port = await resolveEnginePort();
    if (this._disposed) return;
    // Re-check after the async hop — another connect() could have won
    // the race and we'd duplicate.
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.pendingWs) return;

    const wsUrl = `ws://localhost:${port}/ws`;
    this.setStatus("connecting");

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      this.setStatus("disconnected");
      this.scheduleReconnect();
      return;
    }
    this.pendingWs = ws;

    ws.onopen = () => {
      // If we were disposed (or another socket beat us to it) while
      // pending, drop this one rather than promoting it.
      if (this._disposed || this.pendingWs !== ws) {
        try { ws.close(); } catch { /* already dead */ }
        return;
      }
      this.pendingWs = null;
      this.ws = ws;
      this._engineConnected = true;
      this.reconnectAttempts = 0;
      this.setStatus("connected");

      // Announce ourselves
      this.send({
        type: "CONNECTED",
        source: "browser",
        capabilities: ["style-edit", "element-select"],
      } as BridgeMessage);

      // Flush anything queued during the last disconnect. The soft-fail
      // timer on each queued entry still decides whether to surface an
      // error — flushing early just means the chance of success is
      // higher. Any deadline-expired entries get rejected here.
      this.flushQueue();
    };

    ws.onmessage = (event) => {
      let msg: BridgeMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      // ENGINE_READY confirms the engine is fully initialized
      if (msg.type === "ENGINE_READY") {
        this._engineConnected = true;
      }

      // Resolve pending request-response
      const requestId = "requestId" in msg ? (msg as { requestId?: string }).requestId : undefined;
      if (requestId && this.pendingRequests.has(requestId)) {
        const pending = this.pendingRequests.get(requestId)!;
        window.clearTimeout(pending.timer);
        this.pendingRequests.delete(requestId);
        pending.resolve(msg);
      }

      // Notify type-based listeners
      const listeners = this.handlers.get(msg.type);
      if (listeners) {
        for (const handler of listeners) handler(msg);
      }
    };

    ws.onclose = () => {
      // Clear whichever slot held this socket; an orphan that lost the
      // race could close after the winner promoted itself, and we
      // don't want to null out the live this.ws.
      if (this.pendingWs === ws) this.pendingWs = null;
      if (this.ws !== ws) return;
      this.ws = null;
      this.setStatus("disconnected");
      this._engineConnected = false;
      // In-flight requests: move them into the silent-retry queue
      // rather than rejecting. If the engine comes back within the
      // grace window they flush cleanly — the user never sees the
      // blip. Preserves request ordering by prepending.
      const now = Date.now();
      const revived: QueuedRequest[] = [];
      for (const [, pending] of this.pendingRequests) {
        window.clearTimeout(pending.timer);
      }
      this.pendingRequests.clear();
      // No message payload retained — by design, in-flight requests
      // after a disconnect can't be replayed safely (the server lost
      // our request id). The sessions-provider's own retry loop is
      // the layer that re-sends application-level requests.
      // Below we reject them with the soft-fail string; upstream
      // retry decides whether to requeue.
      this.rejectInFlightSoftFail();
      if (revived.length) this.queuedRequests.push(...revived);
      this.scheduleReconnect();
      // Reject any queue entries whose deadlines have elapsed. The
      // grace window is computed per-entry so long-waiting requests
      // don't hold up the queue.
      this.expireQueue(now);
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  /** Send a message (fire-and-forget). */
  send(msg: Partial<BridgeMessage> & { type: string }): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    const envelope = {
      id: createMessageId(),
      source: "browser",
      timestamp: Date.now(),
      ...msg,
    };
    this.ws.send(JSON.stringify(envelope));
  }

  /**
   * Send a message and await a correlated response. When disconnected,
   * the request is held in an in-memory queue for RECONNECT_GRACE_MS
   * to let a watchdog-driven engine respawn complete silently. Only
   * after that grace period do we reject with a soft-fail error that
   * upstream retry loops recognise.
   */
  request<T extends BridgeMessage = BridgeMessage>(
    msg: Partial<BridgeMessage> & { type: string },
    timeoutMs = 5000,
  ): Promise<T> {
    // Happy path — socket ready, go now.
    if (this.ws?.readyState === WebSocket.OPEN) {
      return this.sendRequest<T>(msg, timeoutMs);
    }

    // Disconnected: queue under the grace window. A connection attempt
    // is already running (onclose → scheduleReconnect), so we just
    // wait for onopen → flushQueue() to pick this up.

    // Phase 2 §2.11.3 — dedup by (type, sessionId). For idempotent
    // requests like AGENT_LOAD_SESSION targeting the same session, the
    // newer call supersedes any older queued copy: chat-view mount
    // effects and chat-switch storms used to stack 5× the same call.
    // Drop older copies with a "superseded" reject so upstream retry
    // loops can decide what to do.
    this.dedupSupersededInQueue(msg);

    // Per-type cap (§2.11.3) — for message types that can balloon under
    // a sustained disconnect, drop the oldest of that type rather than
    // overflowing the global cap and rejecting unrelated traffic.
    const typeCap = PER_TYPE_QUEUE_CAP[msg.type];
    if (typeCap !== undefined) {
      const sameType = this.queuedRequests.filter(
        (q) => q.msg.type === msg.type,
      );
      if (sameType.length >= typeCap) {
        const oldest = sameType[0];
        oldest.reject(new Error(`Queued ${msg.type} dropped (per-type cap)`));
        const idx = this.queuedRequests.indexOf(oldest);
        if (idx >= 0) this.queuedRequests.splice(idx, 1);
      }
    }

    if (this.queuedRequests.length >= MAX_QUEUED_REQUESTS) {
      return Promise.reject(
        new Error(`Request timeout: ${msg.type} (queue full)`),
      );
    }
    return new Promise<T>((resolve, reject) => {
      this.queuedRequests.push({
        msg,
        timeoutMs,
        resolve: resolve as (m: BridgeMessage) => void,
        reject,
        deadline: Date.now() + RECONNECT_GRACE_MS,
      });
      // Kick off a best-effort connect if somehow no reconnect is
      // scheduled yet (e.g. first request before connect() ever ran).
      if (!this.reconnectTimer && !this._disposed) {
        void this.connect();
      }
    });
  }

  /** Reject any queued request that the incoming message supersedes.
   *  Two queued requests with the same `type` AND same `sessionId`/
   *  `chatId` are by definition redundant — the newer one carries the
   *  newer caller's intent. Older copies surface as "superseded" so
   *  upstream callers know they've been replaced rather than vanishing. */
  private dedupSupersededInQueue(
    incoming: Partial<BridgeMessage> & { type: string },
  ): void {
    const inSession = (incoming as Record<string, unknown>).sessionId as
      | string
      | undefined;
    const inChat = (incoming as Record<string, unknown>).chatId as
      | string
      | undefined;
    // Only dedup when there's *some* identity key — a bare type match
    // would over-collapse legitimate distinct calls.
    if (!inSession && !inChat) return;
    const before = this.queuedRequests.length;
    this.queuedRequests = this.queuedRequests.filter((q) => {
      if (q.msg.type !== incoming.type) return true;
      const qSession = (q.msg as Record<string, unknown>).sessionId as
        | string
        | undefined;
      const qChat = (q.msg as Record<string, unknown>).chatId as
        | string
        | undefined;
      const sameKey =
        (inSession && qSession === inSession) ||
        (inChat && qChat === inChat);
      if (!sameKey) return true;
      q.reject(new Error(`${q.msg.type} superseded by newer queued copy`));
      return false;
    });
    void before; // helper for future logging if we need to see hit-rate
  }

  /** Subscribe to a specific message type. Returns an unsubscribe function. */
  on(type: string, handler: (msg: BridgeMessage) => void): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  /** Subscribe to connection status changes. */
  onStatusChange(cb: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  /** Drop the current connection and reconnect, re-resolving the
   *  engine port. Used by the in-place project swap when Electron
   *  respawns the engine on a fresh port. The client object survives
   *  (consumer hooks keep their ref) — only the underlying socket and
   *  in-flight state are reset. Pending RPCs and queued requests are
   *  rejected immediately so callers don't wait on a server that no
   *  longer knows about them. */
  async forceReconnect(): Promise<void> {
    if (this._disposed) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    // Reject anything in flight — those request ids are bound to a
    // server process that's about to die. Soft-fail so upstream retry
    // loops can decide to resend; we don't requeue silently because
    // the new engine is a different process entirely.
    for (const [, pending] of this.pendingRequests) {
      window.clearTimeout(pending.timer);
      pending.reject(new Error("Engine swapping — request aborted"));
    }
    this.pendingRequests.clear();
    for (const q of this.queuedRequests) {
      q.reject(new Error("Engine swapping — request aborted"));
    }
    this.queuedRequests = [];
    // Close any live or pending socket. Closing flips us to
    // "disconnected" via onclose, but we set it explicitly here to
    // cover the (rare) case where neither socket fires the event.
    try { this.ws?.close(); } catch { /* already dead */ }
    try { this.pendingWs?.close(); } catch { /* already dead */ }
    this.ws = null;
    this.pendingWs = null;
    this._engineConnected = false;
    this.setStatus("disconnected");
    invalidateEnginePort();
    // Kick the reconnect immediately rather than going through the
    // backoff ladder — the user just clicked "Open Workspace" and is
    // actively waiting for the new engine.
    await this.connect();
  }

  dispose(): void {
    this._disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    for (const [, pending] of this.pendingRequests) {
      window.clearTimeout(pending.timer);
      pending.reject(new Error("Client disposed"));
    }
    this.pendingRequests.clear();
    for (const q of this.queuedRequests) {
      q.reject(new Error("Client disposed"));
    }
    this.queuedRequests = [];
    this.handlers.clear();
    this.statusListeners.clear();
    // Close BOTH the active socket and any in-flight pending one — an
    // un-disposed pendingWs would keep its TCP connection to the engine
    // open even though this client is gone, and on next mount the new
    // client would see itself as the 2nd connection.
    try { this.ws?.close(); } catch { /* already dead */ }
    try { this.pendingWs?.close(); } catch { /* already dead */ }
    this.ws = null;
    this.pendingWs = null;
  }

  // ── Internals ───────────────────────────────────────────

  private sendRequest<T extends BridgeMessage>(
    msg: Partial<BridgeMessage> & { type: string },
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = createMessageId();

      const timer = window.setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${msg.type}`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: resolve as (msg: BridgeMessage) => void,
        reject,
        timer,
      });

      this.send({ ...msg, id });
    });
  }

  private flushQueue(): void {
    if (!this.queuedRequests.length) return;
    const now = Date.now();
    const pending = this.queuedRequests;
    this.queuedRequests = [];
    for (const q of pending) {
      if (q.deadline <= now) {
        q.reject(new Error(`Request timeout: ${q.msg.type} (reconnecting)`));
        continue;
      }
      // Re-enter through sendRequest so the new request gets a fresh id
      // and lands in pendingRequests.
      this.sendRequest(q.msg, q.timeoutMs)
        .then(q.resolve)
        .catch(q.reject);
    }
  }

  private expireQueue(now: number): void {
    if (!this.queuedRequests.length) return;
    const keep: QueuedRequest[] = [];
    for (const q of this.queuedRequests) {
      if (q.deadline <= now) {
        q.reject(new Error(`Request timeout: ${q.msg.type} (reconnecting)`));
      } else {
        keep.push(q);
      }
    }
    this.queuedRequests = keep;
  }

  private rejectInFlightSoftFail(): void {
    // Called from onclose. Any request that was already on the wire
    // when the socket dropped — we can't replay safely (response id
    // is lost), so we reject with the soft-fail shape. Upstream retry
    // loops (sessions-provider.ensureSession) recognise this and back
    // off silently.
    for (const [id, pending] of this.pendingRequests) {
      window.clearTimeout(pending.timer);
      pending.reject(new Error("Request timeout: engine disconnected"));
      this.pendingRequests.delete(id);
    }
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status;
    for (const cb of this.statusListeners) cb(status);
  }

  private scheduleReconnect() {
    if (this._disposed) return;
    if (this.reconnectTimer) return;
    const delay =
      RECONNECT_LADDER[
        Math.min(this.reconnectAttempts, RECONNECT_LADDER.length - 1)
      ];
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        console.warn("[Zeros] reconnect failed:", err);
      });
    }, delay);
  }
}
