// ──────────────────────────────────────────────────────────
// Hook server — localhost HTTP endpoint for CLI hooks
// ──────────────────────────────────────────────────────────
//
// Claude Code, Factory Droid, and Copilot CLI all support sending
// lifecycle events (PreToolUse, PostToolUse, Stop, Notification…) to
// an HTTP endpoint. We run a single localhost server for all of them;
// each session gets a per-session token that the CLI echoes in the
// X-Zeros-Token header, and we dispatch to the session's registered
// handler.
//
// Invariants:
//   - Bind 127.0.0.1 only. Never 0.0.0.0. Never exposed off-host.
//   - Every request must carry a valid X-Zeros-Token that maps to a
//     live session. Anything else → 401 silently.
//   - The handler can return a body; for permission hooks that body
//     is the permission decision that Claude will honor.
//   - Requests time out at 5min to prevent hung hooks blocking agents.
//
// ──────────────────────────────────────────────────────────

import * as http from "node:http";
import { randomUUID } from "node:crypto";

import type { HookEvent, HookResponse, HookServerHandle } from "../types";

const HOOK_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB — JSONL payloads can be chunky
const TOKEN_HEADER = "x-zeros-token";
const SESSION_HEADER = "x-zeros-session-id";
const EVENT_HEADER = "x-zeros-event";

type Handler = (event: HookEvent) => HookResponse | Promise<HookResponse>;

interface Registration {
  sessionId: string;
  handler: Handler;
}

export class HookServer implements HookServerHandle {
  private server: http.Server | null = null;
  private port = 0;
  private readonly byToken = new Map<string, Registration>();
  private readonly bySession = new Map<string, string>(); // sessionId → token

  async start(): Promise<void> {
    if (this.server) return;
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        // Last-ditch catch. Respond 500 without leaking internals.
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "application/json" });
          res.end('{"error":"internal"}');
        }
        // eslint-disable-next-line no-console
        console.error("[hook-server] unhandled error", err);
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(0, "127.0.0.1", () => {
        const addr = this.server!.address();
        if (addr && typeof addr === "object") {
          this.port = addr.port;
        }
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.byToken.clear();
    this.bySession.clear();
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      // Force-close lingering keep-alives so we don't hang on shutdown.
      server.closeAllConnections?.();
    });
  }

  get url(): string {
    if (!this.port) {
      throw new Error("hook-server: url requested before start()");
    }
    return `http://127.0.0.1:${this.port}/hook`;
  }

  registerSession(
    sessionId: string,
    onEvent: (event: HookEvent) => HookResponse | Promise<HookResponse>,
  ): { token: string } {
    // If the session re-registers (shouldn't happen under normal flow but
    // defensive against retries), reuse the same token.
    const existing = this.bySession.get(sessionId);
    if (existing) {
      this.byToken.set(existing, { sessionId, handler: onEvent });
      return { token: existing };
    }
    const token = randomUUID();
    this.byToken.set(token, { sessionId, handler: onEvent });
    this.bySession.set(sessionId, token);
    return { token };
  }

  unregisterSession(sessionId: string): void {
    const token = this.bySession.get(sessionId);
    if (token) {
      this.byToken.delete(token);
      this.bySession.delete(sessionId);
    }
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (req.method !== "POST" || (req.url ?? "") !== "/hook") {
      res.writeHead(404);
      res.end();
      return;
    }

    const token = headerString(req, TOKEN_HEADER);
    const reg = token ? this.byToken.get(token) : undefined;
    if (!reg) {
      res.writeHead(401);
      res.end();
      return;
    }

    const sessionFromHeader = headerString(req, SESSION_HEADER);
    if (sessionFromHeader && sessionFromHeader !== reg.sessionId) {
      // Token/session mismatch — a leaked token being reused for another
      // session. Reject silently.
      res.writeHead(401);
      res.end();
      return;
    }

    let body: unknown;
    try {
      const raw = await readBody(req);
      body = raw.length ? JSON.parse(raw) : {};
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end('{"error":"invalid-json"}');
      return;
    }

    const event: HookEvent = {
      name: headerString(req, EVENT_HEADER) ?? "unknown",
      sessionId: reg.sessionId,
      payload: body,
    };

    let response: HookResponse;
    try {
      response = await withTimeout(
        Promise.resolve(reg.handler(event)),
        HOOK_TIMEOUT_MS,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "handler-failed", message }));
      return;
    }

    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(JSON.stringify(response.body ?? {}));
  }
}

function headerString(req: http.IncomingMessage, name: string): string | null {
  const raw = req.headers[name];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return null;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("hook timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
