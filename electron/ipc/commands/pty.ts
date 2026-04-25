// ──────────────────────────────────────────────────────────
// IPC commands: pseudo-terminal via node-pty
// ──────────────────────────────────────────────────────────
//
// xterm.js talks to these through the renderer shim in
// src/native/pty-shim.ts, which exposes the native-shell spawn()
// interface so
// terminal-panel.tsx doesn't branch on runtime.
//
// Sessions are tracked in a main-process Map<sessionId, IPty>.
// All PTY output fans out via the `pty-data` event with a
// { sessionId, data } envelope so the renderer can demux
// multiple concurrent terminals.
//
// Kills all sessions on app.on("before-quit") — if we don't,
// the zsh children outlive Electron and keep the shell running
// invisibly.
// ──────────────────────────────────────────────────────────

import * as nodePty from "node-pty";
import { app } from "electron";
import type { CommandHandler } from "../router";
import { emitEvent } from "../events";

interface Session {
  pty: nodePty.IPty;
  // Track subscriber handles so we can clean them up on kill/exit
  dataHandle: { dispose: () => void };
  exitHandle: { dispose: () => void };
}

const sessions = new Map<string, Session>();

function newSessionId(): string {
  return `pty-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const ptySpawn: CommandHandler = (args) => {
  const shell = typeof args.shell === "string" && args.shell ? args.shell : "/bin/zsh";
  const shellArgs = Array.isArray(args.args)
    ? (args.args as unknown[]).map((x) => String(x))
    : ["-l"];
  const cwd = typeof args.cwd === "string" && args.cwd ? args.cwd : process.env.HOME;
  const cols = typeof args.cols === "number" ? args.cols : 80;
  const rows = typeof args.rows === "number" ? args.rows : 24;
  const extraEnv =
    args.env && typeof args.env === "object"
      ? (args.env as Record<string, string>)
      : {};

  const sessionId = newSessionId();
  const pty = nodePty.spawn(shell, shellArgs, {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    // Inherit process env but allow caller overrides (e.g. chat
    // folder's custom PATH). The AI-agent registry passes env vars
    // here to provide credentials / config.
    env: { ...process.env, ...extraEnv } as { [key: string]: string },
  });

  const dataHandle = pty.onData((data) => {
    emitEvent("pty-data", { sessionId, data });
  });

  const exitHandle = pty.onExit(({ exitCode, signal }) => {
    emitEvent("pty-exit", { sessionId, exitCode, signal: signal ?? null });
    const s = sessions.get(sessionId);
    if (s) {
      s.dataHandle.dispose();
      s.exitHandle.dispose();
      sessions.delete(sessionId);
    }
  });

  sessions.set(sessionId, { pty, dataHandle, exitHandle });
  return { sessionId, pid: pty.pid };
};

export const ptyWrite: CommandHandler = (args) => {
  const sessionId = String(args.sessionId ?? "");
  const data = String(args.data ?? "");
  if (!sessionId) throw new Error("pty_write: missing sessionId");
  const s = sessions.get(sessionId);
  if (!s) throw new Error(`pty_write: unknown sessionId ${sessionId}`);
  s.pty.write(data);
};

export const ptyResize: CommandHandler = (args) => {
  const sessionId = String(args.sessionId ?? "");
  const cols = typeof args.cols === "number" ? args.cols : 80;
  const rows = typeof args.rows === "number" ? args.rows : 24;
  if (!sessionId) throw new Error("pty_resize: missing sessionId");
  const s = sessions.get(sessionId);
  if (!s) return; // silent — a resize to a dead session is benign
  try {
    s.pty.resize(Math.max(1, Math.floor(cols)), Math.max(1, Math.floor(rows)));
  } catch {
    /* resize can race with exit; ignore */
  }
};

export const ptyKill: CommandHandler = (args) => {
  const sessionId = String(args.sessionId ?? "");
  if (!sessionId) throw new Error("pty_kill: missing sessionId");
  const s = sessions.get(sessionId);
  if (!s) return; // idempotent — already dead is fine
  try {
    s.pty.kill();
  } catch {
    /* kill can race with exit; ignore */
  }
  s.dataHandle.dispose();
  s.exitHandle.dispose();
  sessions.delete(sessionId);
};

/** Called from app.on("before-quit"). Kills every open PTY so the
 *  zsh children don't outlive Electron and leak. */
export function shutdownAllPtys(): void {
  for (const [sessionId, s] of sessions.entries()) {
    try {
      s.pty.kill();
    } catch {
      /* ignore */
    }
    s.dataHandle.dispose();
    s.exitHandle.dispose();
    sessions.delete(sessionId);
  }
}

// Register the quit hook exactly once at module load. Safe under
// hot-reload in dev because app.on dedupes by reference (and tsup's
// CJS output loads each module once per process life).
app.on("before-quit", shutdownAllPtys);
