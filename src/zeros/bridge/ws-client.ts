// ──────────────────────────────────────────────────────────
// Browser-side WebSocket client for the Zeros engine
// ──────────────────────────────────────────────────────────
//
// Connects to the Zeros engine on localhost.
// Port resolution order (first match wins):
//   1. window.__ZEROS_PORT__   — direct eval from Rust, if present
//   2. Tauri command get_engine_port — source of truth in the Mac app
//   3. hardcoded 24193           — plain browser dev harness fallback
//
// The Tauri command path handles the common case where the engine
// retries onto 24194–24200 because 24193 was taken by a stale process.
// ──────────────────────────────────────────────────────────

import type { BridgeMessage } from "./messages";
import { createMessageId } from "./messages";

const DEFAULT_ENGINE_PORT = 24193;

/**
 * Resolve the engine port exactly once per page load. The result is
 * cached in-module so the reconnect timer doesn't re-hit Tauri on
 * every retry. Safe to call in both Tauri and plain-browser modes.
 */
const enginePortPromise: Promise<number> = (async () => {
  if (typeof window === "undefined") return DEFAULT_ENGINE_PORT;

  const injected = (window as unknown as { __ZEROS_PORT__?: number })
    .__ZEROS_PORT__;
  if (typeof injected === "number" && Number.isFinite(injected) && injected > 0) {
    return injected;
  }

  // Runtime-agnostic: ask the native shell for the engine port. Works
  // under Tauri (src-tauri/src/sidecar.rs) and Electron (Phase 2 wires
  // electron/ipc/commands/sidecar.ts). Any failure degrades to the
  // default port so the WebSocket bridge still has a chance to attach.
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

export class CanvasBridgeClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<(msg: BridgeMessage) => void>>();
  private pendingRequests = new Map<string, PendingRequest>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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

    const port = await enginePortPromise;
    if (this._disposed) return;

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

    ws.onopen = () => {
      this.ws = ws;
      this._engineConnected = true;
      this.setStatus("connected");

      // Announce ourselves
      this.send({
        type: "CONNECTED",
        source: "browser",
        capabilities: ["style-edit", "element-select"],
      } as BridgeMessage);
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
      this.ws = null;
      this.setStatus("disconnected");
      this._engineConnected = false;
      this.scheduleReconnect();
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

  /** Send a message and await a correlated response. */
  request<T extends BridgeMessage = BridgeMessage>(
    msg: Partial<BridgeMessage> & { type: string },
    timeoutMs = 5000
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
    this.handlers.clear();
    this.statusListeners.clear();
    this.ws?.close();
    this.ws = null;
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status;
    for (const cb of this.statusListeners) cb(status);
  }

  private scheduleReconnect() {
    if (this._disposed) return;
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        console.warn("[Zeros] reconnect failed:", err);
      });
    }, 2000);
  }
}
