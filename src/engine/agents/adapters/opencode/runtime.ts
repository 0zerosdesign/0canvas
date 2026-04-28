// ──────────────────────────────────────────────────────────
// OpenCode runtime — server lifecycle (one server per session)
// ──────────────────────────────────────────────────────────
//
// Stage 8.5 Slice 1. OpenCode is the only adapter that drives a
// long-lived child server (`opencode serve --port <random>`)
// rather than a per-prompt subprocess. Each Zeros session owns
// one OpencodeRuntime; prompts go through the SDK's HTTP+SSE
// client; dispose() shuts the child.
//
// Why server-attached and not `opencode run`:
//   - `opencode run` is a strict subset of the bus: no
//     token-streaming deltas, no permission events, no
//     question events.
//   - The SSE bus exposes the full event taxonomy required by
//     the canonical-event mapping table (§2.10.4 of the
//     roadmap).
//
// Config-neutering: `OPENCODE_CONFIG_CONTENT='{}'` forces the
// child server to run with an empty user config, ignoring
// whatever's in `~/.config/opencode/opencode.json`. This is
// DPCode's trick (§2.10.2 C); it stops user-configured MCP
// servers / system prompts / permission rules from bleeding
// into our wrapper.
//
// ──────────────────────────────────────────────────────────

import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";

type OpencodeServerProcess = ChildProcessByStdio<null, Readable, Readable>;

export interface OpencodeRuntimeOptions {
  /** Project working directory the server runs in. */
  cwd: string;
  /** Optional hint for the binary path; defaults to `opencode` on PATH. */
  binaryPath?: string;
  /** Extra env to layer on top of the inherited process.env. */
  env?: Record<string, string>;
  /** Called with each line the server writes to stderr. */
  onStderr?: (line: string) => void;
  /** Called when the server exits (gracefully or otherwise). */
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

export interface OpencodeRuntimeHandle {
  /** Base URL the SDK client should connect to. */
  readonly baseUrl: string;
  /** Random shared secret passed to the server via env; the SDK
   *  client authenticates Basic against it. Without this any local
   *  process could hit the unsecured server. */
  readonly password: string;
  /** Underlying child for diagnostics (kill, pid). */
  readonly child: OpencodeServerProcess;
  /** Tear down the server. Idempotent. */
  dispose(): Promise<void>;
}

/** Spawn an `opencode serve` child, wait for the "listening" log,
 *  and return a handle the SDK client can attach to. Throws if the
 *  server doesn't come up within `timeoutMs`.
 *
 *  Retries once with a fresh port on listen failure — Phase 1 audit
 *  fix #7. The TOCTOU window between our pickFreePort()'s close and
 *  the child's bind is small but non-zero, and on busy machines a
 *  third process can grab the port in between. One retry catches
 *  >99% of those cases. */
export async function startOpencodeRuntime(
  opts: OpencodeRuntimeOptions,
  timeoutMs = 15_000,
): Promise<OpencodeRuntimeHandle> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await spawnOpencodeServer(opts, timeoutMs);
    } catch (err) {
      lastErr = err;
      // Only retry on listen-related failures. Auth / binary-missing
      // shape errors will fail again with the same message.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/listen|EADDR|did not become ready|EACCES/i.test(msg)) break;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr ?? "opencode runtime failed to start"));
}

async function spawnOpencodeServer(
  opts: OpencodeRuntimeOptions,
  timeoutMs: number,
): Promise<OpencodeRuntimeHandle> {
  const password = randomUUID();
  const binary = opts.binaryPath ?? "opencode";
  // OpenCode 1.14.x interprets `--port=0` as "use the default 4096"
  // rather than "ask the kernel for a free port", so parallel sessions
  // would collide on 4096. Pre-allocating a free port ourselves and
  // passing it explicitly avoids that.
  const port = await pickFreePort();
  const child = spawn(
    binary,
    [
      "serve",
      "--hostname=127.0.0.1",
      `--port=${port}`,
      "--print-logs",
    ],
    {
      cwd: opts.cwd,
      env: {
        ...process.env,
        ...(opts.env ?? {}),
        OPENCODE_SERVER_PASSWORD: password,
        // Empty config object — fully overrides the user's
        // ~/.config/opencode/opencode.json so our wrapper controls
        // the runtime. Per §2.10.2 C.
        OPENCODE_CONFIG_CONTENT: "{}",
        // Don't bleed Claude Code's project-context (~/.claude/CLAUDE.md)
        // into OpenCode runs — the user's chat state shouldn't depend
        // on which agent they happen to use.
        OPENCODE_DISABLE_CLAUDE_CODE_PROMPT: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  ) as OpencodeServerProcess;

  // Wait for the "opencode server listening on http://host:port"
  // line so we know the server is ready AND we can extract the
  // chosen port.
  const baseUrl = await waitForListening(child, opts.onStderr, timeoutMs);

  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    if (!child.killed) {
      child.kill("SIGTERM");
      // Give the server 2s to flush state and exit cleanly; SIGKILL
      // if it's still alive after.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
          resolve();
        }, 2_000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  };

  child.once("exit", (code, signal) => {
    opts.onExit?.(code, signal);
  });

  return {
    baseUrl,
    password,
    child,
    dispose,
  };
}

/** Drain stderr until we see the "listening on" line (success) or
 *  the process exits / timeout fires (failure). Returns the parsed
 *  base URL. Stderr lines are forwarded to `onStderr` so callers
 *  can surface server logs in the engine's diagnostic stream. */
async function waitForListening(
  child: OpencodeServerProcess,
  onStderr: ((line: string) => void) | undefined,
  timeoutMs: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let buf = "";
    let stdoutBuf = "";
    let resolved = false;

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      reject(
        new Error(
          `opencode serve did not become ready within ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);

    const tryParse = (chunk: string): string | null => {
      // Two log layouts seen in 1.14.x:
      //   "opencode server listening on http://127.0.0.1:53921"
      //   "INFO ... opencode server listening on http://..."
      const m = chunk.match(/listening on (https?:\/\/[^\s]+)/);
      return m ? m[1] : null;
    };

    child.stderr.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      let idx = buf.indexOf("\n");
      while (idx !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line) onStderr?.(line);
        if (!resolved) {
          const url = tryParse(line);
          if (url) {
            resolved = true;
            clearTimeout(timer);
            resolve(url);
            return;
          }
        }
        idx = buf.indexOf("\n");
      }
    });

    // The "listening on" line lands on stdout in 1.14.x, not stderr,
    // even with --print-logs. Read both streams.
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString("utf8");
      let idx = stdoutBuf.indexOf("\n");
      while (idx !== -1) {
        const line = stdoutBuf.slice(0, idx);
        stdoutBuf = stdoutBuf.slice(idx + 1);
        if (!resolved) {
          const url = tryParse(line);
          if (url) {
            resolved = true;
            clearTimeout(timer);
            resolve(url);
            return;
          }
        }
        idx = stdoutBuf.indexOf("\n");
      }
    });

    child.once("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      reject(err);
    });

    child.once("exit", (code, signal) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      reject(
        new Error(
          `opencode serve exited before listening (code=${code} signal=${signal ?? ""})`,
        ),
      );
    });
  });
}

/** Ask the kernel for a free port by binding port 0 on a temp
 *  server, reading the assigned port, and closing. There's a tiny
 *  TOCTOU window between close() and opencode's bind, but it's
 *  vanishingly unlikely on a single-user machine. */
async function pickFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (typeof addr === "object" && addr && typeof addr.port === "number") {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close();
        reject(new Error("could not resolve a free port"));
      }
    });
  });
}
