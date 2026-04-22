// ──────────────────────────────────────────────────────────
// ACP Client — spawn an agent subprocess, wrap in ClientSideConnection
// ──────────────────────────────────────────────────────────
//
// This is the Zeros ↔ agent seam. We spawn the vendor's own published
// CLI (claude-agent-acp, codex-acp, gemini, etc.) as a child process,
// pipe its stdin/stdout through ACP's ndJsonStream, and expose the
// resulting ClientSideConnection so the session-manager can drive it.
//
// What this module DOES NOT do:
//   - touch credentials (the agent handles auth internally)
//   - interpret agent-specific wire formats (ACP is the only wire)
//   - reimplement anything from the SDK (we use ClientSideConnection as-is)
//
// ──────────────────────────────────────────────────────────

import { spawn, type ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import {
  ClientSideConnection,
  ndJsonStream,
  type Client,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
} from "@agentclientprotocol/sdk";

import { resolveLaunch, type RegistryAgent } from "./registry.js";

/**
 * Callbacks the session-manager plugs in. Each call is proxied to the browser
 * over WebSocket; Zeros itself never makes agent decisions.
 */
export interface AcpClientCallbacks {
  onSessionUpdate(notification: SessionNotification): void;
  onPermissionRequest(
    req: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse>;
  /** Optional: agent wants to read a file. If undefined we refuse the capability. */
  onReadTextFile?(req: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  /** Optional: agent wants to write a file. If undefined we refuse the capability. */
  onWriteTextFile?(
    req: WriteTextFileRequest,
  ): Promise<WriteTextFileResponse>;
  onStderr?(line: string): void;
  onExit?(code: number | null, signal: NodeJS.Signals | null): void;
}

export interface AcpClientOptions {
  /** Additional env passed to the agent subprocess (e.g. API keys). */
  env?: Record<string, string>;
  /** Working directory for the agent. Defaults to the engine's project root. */
  cwd?: string;
}

export interface AcpClient {
  /** Registry id, e.g. "claude-acp". */
  agentId: string;
  /** Registry version at spawn time, e.g. "0.30.0". */
  agentVersion: string;
  /** SDK connection wrapper. Use this for initialize/newSession/prompt/cancel. */
  connection: ClientSideConnection;
  /** Resolves when the subprocess exits. */
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  /** Send SIGTERM and await exit. */
  dispose(): Promise<void>;
}

/**
 * Spawn an ACP agent from the registry and wrap its stdio in
 * a ClientSideConnection. The returned client is ready for initialize().
 */
export function startAcpClient(
  agent: RegistryAgent,
  callbacks: AcpClientCallbacks,
  options: AcpClientOptions = {},
): AcpClient {
  const launch = resolveLaunch(agent);

  const child: ChildProcess = spawn(launch.cmd, launch.args, {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      ...launch.env,
      ...options.env,
    },
    // Detach is false — if the engine dies the child dies with it.
    detached: false,
  });

  if (!child.stdin || !child.stdout || !child.stderr) {
    throw new Error(
      `[acp ${agent.id}] subprocess started without stdio pipes (cmd=${launch.cmd})`,
    );
  }

  // Forward stderr line-by-line. Agents chat a lot on stderr — debug logs,
  // startup banners, auth prompts — and surfacing it helps triage.
  const stderrBuf: string[] = [];
  child.stderr.setEncoding("utf-8");
  child.stderr.on("data", (chunk: string) => {
    stderrBuf.push(chunk);
    const combined = stderrBuf.join("");
    const lines = combined.split(/\r?\n/);
    stderrBuf.length = 0;
    const leftover = lines.pop();
    if (leftover) stderrBuf.push(leftover);
    for (const line of lines) {
      if (!line) continue;
      if (callbacks.onStderr) callbacks.onStderr(line);
      else console.error(`[acp ${agent.id}] ${line}`);
    }
  });

  // Web Streams over Node streams. The SDK speaks WHATWG streams; Node provides
  // adapters via Readable.toWeb / Writable.toWeb.
  const stdinWeb = Writable.toWeb(child.stdin) as WritableStream<Uint8Array>;
  const stdoutWeb = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
  const stream = ndJsonStream(stdinWeb, stdoutWeb);

  // The Client impl — everything the agent may ask of Zeros. We forward to
  // the session-manager's callbacks; we never decide anything in here.
  const clientImpl: Client = {
    async sessionUpdate(params) {
      callbacks.onSessionUpdate(params);
    },
    async requestPermission(params) {
      return callbacks.onPermissionRequest(params);
    },
  };

  if (callbacks.onReadTextFile) {
    clientImpl.readTextFile = callbacks.onReadTextFile;
  }
  if (callbacks.onWriteTextFile) {
    clientImpl.writeTextFile = callbacks.onWriteTextFile;
  }

  const connection = new ClientSideConnection(() => clientImpl, stream);

  const exited = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    child.once("exit", (code, signal) => {
      if (callbacks.onExit) callbacks.onExit(code, signal);
      resolve({ code, signal });
    });
  });

  return {
    agentId: agent.id,
    agentVersion: agent.version,
    connection,
    exited,
    async dispose() {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      // Give the agent a moment to flush; if it's still alive, SIGKILL.
      const killed = await Promise.race([
        exited.then(() => true),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 2000),
        ),
      ]);
      if (!killed && child.exitCode === null) child.kill("SIGKILL");
      await exited;
    },
  };
}
