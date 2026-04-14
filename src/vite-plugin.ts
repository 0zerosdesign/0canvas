// ──────────────────────────────────────────────────────────
// ZeroCanvas Vite Plugin — WebSocket bridge + dev integration
// ──────────────────────────────────────────────────────────
//
// Usage in vite.config.ts:
//
//   import { zeroCanvas } from "@zerosdesign/0canvas/vite";
//   export default defineConfig({
//     plugins: [react(), zeroCanvas()],
//   });
//
// The plugin:
//   1. Creates a WebSocket server at /__0canvas on the Vite dev server
//   2. Relays messages between browser overlay and VS Code extension
//   3. Writes a .0canvas/.port file so the extension can auto-discover
//
// ──────────────────────────────────────────────────────────

import type { Plugin, ViteDevServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import * as fs from "node:fs";
import * as path from "node:path";

export interface ZeroCanvasPluginOptions {
  /** WebSocket path on the Vite dev server. Default: "/__0canvas" */
  wsPath?: string;
}

type ClientRole = "browser" | "extension" | "unknown";

interface ClientInfo {
  role: ClientRole;
  capabilities: string[];
}

export function zeroCanvas(options?: ZeroCanvasPluginOptions): Plugin {
  const wsPath = options?.wsPath ?? "/__0canvas";
  let projectRoot = "";

  function writePortFile(port: number) {
    try {
      const dir = path.join(projectRoot, ".0canvas");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, ".port"), String(port), "utf-8");
      console.log(`[0canvas] Port file written: ${port}`);
    } catch (err) {
      console.error("[0canvas] Failed to write port file:", err);
    }
  }

  function removePortFile() {
    try {
      const portFile = path.join(projectRoot, ".0canvas", ".port");
      if (fs.existsSync(portFile)) fs.unlinkSync(portFile);
    } catch {
      // Ignore cleanup errors
    }
  }

  return {
    name: "0canvas",
    apply: "serve",

    configResolved(config) {
      projectRoot = config.root;
    },

    configureServer(server: ViteDevServer) {
      console.log("[0canvas] configureServer called");

      const wss = new WebSocketServer({ noServer: true });
      const clients = new Map<WebSocket, ClientInfo>();

      function relay(sender: WebSocket, raw: string) {
        let msg: { source?: string; type?: string };
        try {
          msg = JSON.parse(raw);
        } catch {
          return;
        }

        const senderInfo = clients.get(sender);
        const senderRole = senderInfo?.role ?? msg.source;

        for (const [client, info] of clients) {
          if (client === sender) continue;
          if (client.readyState !== WebSocket.OPEN) continue;

          if (senderRole === "browser" && info.role === "extension") {
            client.send(raw);
          }
          if (senderRole === "extension" && info.role === "browser") {
            client.send(raw);
          }
        }
      }

      // Wire up WebSocket upgrade handling
      function attachToHttpServer(httpServer: NonNullable<ViteDevServer["httpServer"]>) {
        console.log("[0canvas] Attaching WebSocket to httpServer");

        httpServer.on("upgrade", (request, socket, head) => {
          const url = new URL(request.url ?? "", `http://${request.headers.host}`);
          if (url.pathname !== wsPath) return;

          console.log("[0canvas] WebSocket upgrade for", url.pathname);
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
          });
        });

        // Write port file
        const addr = httpServer.address();
        if (addr && typeof addr === "object") {
          writePortFile(addr.port);
        } else {
          httpServer.on("listening", () => {
            const a = httpServer.address();
            if (a && typeof a === "object") writePortFile(a.port);
          });
        }
      }

      // Handle new WebSocket connections
      wss.on("connection", (ws) => {
        clients.set(ws, { role: "unknown", capabilities: [] });
        console.log("[0canvas] New WebSocket connection");

        ws.on("message", (data) => {
          const raw = data.toString();

          try {
            const msg = JSON.parse(raw);

            if (msg.type === "CONNECTED" && msg.role) {
              clients.set(ws, {
                role: msg.role as ClientRole,
                capabilities: msg.capabilities ?? [],
              });
              console.log(`[0canvas] Client identified as: ${msg.role}`);

              // Notify OTHER clients about this new peer
              const notification = JSON.stringify({
                id: `${Date.now()}-notify`,
                type: "PEER_CONNECTED",
                source: "vite",
                role: msg.role,
                timestamp: Date.now(),
              });
              for (const [client] of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(notification);
                }
              }

              // Tell THIS client about already-connected peers
              for (const [client, info] of clients) {
                if (client !== ws && info.role !== "unknown") {
                  ws.send(JSON.stringify({
                    id: `${Date.now()}-existing`,
                    type: "PEER_CONNECTED",
                    source: "vite",
                    role: info.role,
                    timestamp: Date.now(),
                  }));
                }
              }
              return;
            }
          } catch {
            // Not JSON
          }

          relay(ws, raw);
        });

        ws.on("close", () => {
          const info = clients.get(ws);
          clients.delete(ws);
          console.log(`[0canvas] Client disconnected: ${info?.role ?? "unknown"}`);

          if (info && info.role !== "unknown") {
            const notification = JSON.stringify({
              id: `${Date.now()}-notify`,
              type: "PEER_DISCONNECTED",
              source: "vite",
              role: info.role,
              timestamp: Date.now(),
            });
            for (const [client] of clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(notification);
              }
            }
          }
        });

        ws.on("error", () => {
          clients.delete(ws);
        });
      });

      // Attach to httpServer — handle both immediate and deferred cases
      if (server.httpServer) {
        attachToHttpServer(server.httpServer);
      } else {
        console.log("[0canvas] httpServer not ready, waiting...");
        const interval = setInterval(() => {
          if (server.httpServer) {
            clearInterval(interval);
            attachToHttpServer(server.httpServer);
          }
        }, 50);
        setTimeout(() => clearInterval(interval), 10000);
      }
    },

    buildEnd() {
      removePortFile();
    },
  };
}

export default zeroCanvas;
