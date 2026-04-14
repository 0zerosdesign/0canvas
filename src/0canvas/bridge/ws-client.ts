// ──────────────────────────────────────────────────────────
// Browser-side WebSocket client for the 0canvas bridge
// ──────────────────────────────────────────────────────────
//
// Connects to the Vite plugin's WebSocket server at /__0canvas.
// Uses the browser's native WebSocket API — no npm dependencies.
//
// ──────────────────────────────────────────────────────────

import type { BridgeMessage } from "./messages";
import { createMessageId } from "./messages";

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

  /** Whether the extension side is connected (we received PEER_CONNECTED) */
  private _extensionConnected = false;
  get extensionConnected(): boolean {
    return this._extensionConnected;
  }

  connect(): void {
    if (this._disposed) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    // Derive WS URL from the page's own origin (same host/port as Vite)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/__0canvas`;

    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(wsUrl);
    } catch {
      this.setStatus("disconnected");
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.setStatus("connected");
      // Announce ourselves
      this.send({
        type: "CONNECTED",
        source: "browser",
        role: "browser",
        capabilities: ["style-edit", "element-select"],
      } as BridgeMessage);
    };

    this.ws.onmessage = (event) => {
      let msg: BridgeMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      // Track extension connection state
      if (msg.type === "PEER_CONNECTED" && msg.role === "extension") {
        this._extensionConnected = true;
      }
      if (msg.type === "PEER_DISCONNECTED" && msg.role === "extension") {
        this._extensionConnected = false;
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

    this.ws.onclose = () => {
      this.setStatus("disconnected");
      this._extensionConnected = false;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
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
        reject(new Error(`Bridge request timeout: ${msg.type}`));
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
      pending.reject(new Error("Bridge disposed"));
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
      this.connect();
    }, 2000);
  }
}
