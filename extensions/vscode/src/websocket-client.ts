// ──────────────────────────────────────────────────────────
// VS Code Extension — WebSocket client for 0canvas bridge
// ──────────────────────────────────────────────────────────
//
// Connects to the Vite plugin's WebSocket server at /__0canvas.
// Auto-discovers the port by watching .0canvas/.port in the workspace.
//
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import WebSocket from "ws";
import type { BridgeMessage } from "./messages";
import { createMessage } from "./messages";

export type BridgeStatus = "disconnected" | "connecting" | "connected";

export class BridgeWebSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, ((msg: BridgeMessage) => void)[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private portWatcher: vscode.FileSystemWatcher | null = null;
  private disposed = false;
  private _status: BridgeStatus = "disconnected";
  private statusListeners: ((status: BridgeStatus) => void)[] = [];
  private port: number | null = null;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  get status(): BridgeStatus {
    return this._status;
  }

  /** Start watching for the .port file and connect when found. */
  start(): void {
    console.log(`[0canvas] WS client watching workspace: ${this.workspaceRoot}`);
    const portFilePath = path.join(this.workspaceRoot, ".0canvas", ".port");
    console.log(`[0canvas] Looking for port file: ${portFilePath}`);
    console.log(`[0canvas] Port file exists: ${fs.existsSync(portFilePath)}`);

    // Try to connect immediately if port file exists
    this.readPortAndConnect();

    // Watch for port file changes
    const portPattern = new vscode.RelativePattern(
      this.workspaceRoot,
      ".0canvas/.port"
    );
    this.portWatcher = vscode.workspace.createFileSystemWatcher(portPattern);
    this.portWatcher.onDidCreate(() => {
      console.log("[0canvas] Port file created");
      this.readPortAndConnect();
    });
    this.portWatcher.onDidChange(() => {
      console.log("[0canvas] Port file changed");
      this.readPortAndConnect();
    });
    this.portWatcher.onDidDelete(() => {
      console.log("[0canvas] Port file deleted");
      this.disconnect();
    });

    // Polling fallback — only when truly disconnected and no active connection
    this.pollTimer = setInterval(() => {
      if (this._status === "disconnected" && !this.disposed && !this.ws) {
        this.readPortAndConnect();
      }
    }, 10000);
  }

  private readPortAndConnect(): void {
    try {
      const portFile = path.join(this.workspaceRoot, ".0canvas", ".port");
      if (!fs.existsSync(portFile)) {
        console.log(`[0canvas] Port file not found: ${portFile}`);
        return;
      }

      const portStr = fs.readFileSync(portFile, "utf-8").trim();
      const port = parseInt(portStr, 10);
      console.log(`[0canvas] Read port from file: ${port}`);
      if (isNaN(port) || port < 1 || port > 65535) return;

      // Don't reconnect if already connected/connecting to the same port
      if (port === this.port && this._status !== "disconnected") return;

      this.port = port;
      this.connect();
    } catch (err) {
      console.error(`[0canvas] Error reading port file:`, err);
    }
  }

  private connect(): void {
    if (this.disposed || !this.port) return;

    // Close existing connection
    this.ws?.close();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const url = `ws://localhost:${this.port}/__0canvas`;
    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.setStatus("disconnected");
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.setStatus("connected");
      // Announce ourselves
      this.send(
        createMessage({
          type: "CONNECTED",
          source: "extension",
          role: "extension",
          capabilities: ["css-write", "source-resolve"],
        } as BridgeMessage)
      );
    });

    this.ws.on("message", (data) => {
      let msg: BridgeMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      const handlers = this.handlers.get(msg.type);
      if (handlers) {
        for (const handler of handlers) handler(msg);
      }
    });

    this.ws.on("close", () => {
      this.setStatus("disconnected");
      this.scheduleReconnect();
    });

    this.ws.on("error", () => {
      // onclose fires after onerror
    });
  }

  private disconnect(): void {
    this.port = null;
    this.ws?.close();
    this.ws = null;
    this.setStatus("disconnected");
  }

  /** Register a handler for a message type. */
  on(type: string, handler: (msg: BridgeMessage) => void): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  /** Send a message to the bridge. */
  send(msg: BridgeMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  /** Subscribe to status changes. */
  onStatusChange(cb: (status: BridgeStatus) => void): void {
    this.statusListeners.push(cb);
  }

  dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.portWatcher?.dispose();
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
    this.statusListeners = [];
  }

  private setStatus(status: BridgeStatus): void {
    this._status = status;
    for (const cb of this.statusListeners) cb(status);
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.port) this.connect();
    }, 2000);
  }
}
