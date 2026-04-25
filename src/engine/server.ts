// ──────────────────────────────────────────────────────────
// Engine Server — HTTP + WebSocket on a single port
// ──────────────────────────────────────────────────────────
//
// HTTP routes:
//   GET /health — JSON status
//   POST /mcp   — Reserved for Phase 1B (MCP Streamable HTTP)
//
// WebSocket:
//   /ws — Design workspace / legacy browser overlay connects here
//
// ──────────────────────────────────────────────────────────

import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { EngineMessage } from "./types";

export type McpRequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export interface EngineServerOptions {
  port: number;
  onMessage: (msg: EngineMessage, ws: WebSocket) => void;
  onConnect: (ws: WebSocket) => void;
  onDisconnect: (ws: WebSocket) => void;
}

export interface EngineServerInfo {
  version: string;
  uptime: number;
  connections: number;
  stats?: { selectors: number; files: number; tokens: number };
}

export class EngineServer {
  private httpServer: HttpServer;
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private options: EngineServerOptions;
  private startTime = Date.now();
  private getInfo: (() => EngineServerInfo) | null = null;
  private mcpHandler: McpRequestHandler | null = null;

  constructor(options: EngineServerOptions) {
    this.options = options;

    // Create HTTP server
    this.httpServer = createServer((req, res) => this.handleHTTP(req, res));

    // Create WebSocket server (noServer mode — we handle upgrade manually)
    this.wss = new WebSocketServer({ noServer: true });

    // Handle WebSocket upgrade
    this.httpServer.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url ?? "", `http://localhost`);

      if (url.pathname === "/ws") {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    // Handle WebSocket connections
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);

      ws.on("message", (data) => {
        let msg: EngineMessage;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }
        this.options.onMessage(msg, ws);
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        this.options.onDisconnect(ws);
      });

      ws.on("error", () => {
        this.clients.delete(ws);
      });

      this.options.onConnect(ws);
    });
  }

  /**
   * Set a function that returns server info for the health endpoint.
   */
  setInfoProvider(fn: () => EngineServerInfo): void {
    this.getInfo = fn;
  }

  /**
   * Set the MCP request handler for /mcp endpoint.
   */
  setMcpHandler(handler: McpRequestHandler): void {
    this.mcpHandler = handler;
  }

  /**
   * Start the server. Tries the requested port, then 24194-24200 if busy.
   * Returns the actual port used.
   */
  async start(): Promise<number> {
    const basePort = this.options.port;
    const maxAttempts = 8; // try ports 24193-24200

    for (let i = 0; i < maxAttempts; i++) {
      const port = basePort + i;
      try {
        await this.listen(port);
        return port;
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === "EADDRINUSE" && i < maxAttempts - 1) {
          continue; // try next port
        }
        throw err;
      }
    }

    throw new Error(`Could not find an available port (tried ${basePort}-${basePort + maxAttempts - 1})`);
  }

  /**
   * Stop the server gracefully.
   */
  async stop(): Promise<void> {
    // Close all WebSocket clients
    for (const client of this.clients) {
      client.close(1001, "Engine shutting down");
    }
    this.clients.clear();

    // Close the WebSocket server
    await new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });

    // Close the HTTP server
    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Send a message to all connected browser clients.
   */
  broadcast(msg: EngineMessage): void {
    const raw = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  }

  /**
   * Send a message to a specific client.
   */
  send(ws: WebSocket, msg: EngineMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  get connectionCount(): number {
    return this.clients.size;
  }

  // ── Private ────────────────────────────────────────────

  private listen(port: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        this.httpServer.removeListener("listening", onListening);
        reject(err);
      };
      const onListening = () => {
        this.httpServer.removeListener("error", onError);
        resolve();
      };

      this.httpServer.once("error", onError);
      this.httpServer.once("listening", onListening);
      this.httpServer.listen(port, "127.0.0.1");
    });
  }

  private handleHTTP(req: IncomingMessage, res: ServerResponse): void {
    // CORS headers for cross-origin requests
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "", `http://localhost`);

    // MCP endpoint (Streamable HTTP)
    if (url.pathname === "/mcp" && this.mcpHandler) {
      this.mcpHandler(req, res).catch((err) => {
        console.error("[Zeros] MCP request error:", err);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });
      return;
    }

    if (url.pathname === "/health" && req.method === "GET") {
      const info = this.getInfo?.() ?? {
        version: "unknown",
        uptime: Date.now() - this.startTime,
        connections: this.clients.size,
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        ...info,
      }));
      return;
    }

    // Default response
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      name: "zeros-engine",
      health: "/health",
      ws: "/ws",
      mcp: "/mcp",
    }));
  }
}
