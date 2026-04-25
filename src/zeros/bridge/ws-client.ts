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
 *  a wedged engine can't balloon memory. */
const MAX_QUEUED_REQUESTS = 32;

/**
 * Resolve the engine port exactly once per page load. The result is
 * cached in-module so the reconnect timer doesn't re-hit native IPC on
 * every retry. Safe to call in both native-shell and plain-browser modes.
 */
const enginePortPromise: Promise<number> = (async () => {
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

    const port = await enginePortPromise;
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
