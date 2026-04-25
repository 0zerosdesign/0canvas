// ──────────────────────────────────────────────────────────
// Gemini CLI adapter (PTY transport)
// ──────────────────────────────────────────────────────────
//
// Gemini CLI has two relevant modes:
//   1. `--acp` / `--experimental-acp`  → JSON-RPC over stdio. We
//      deliberately skip this — the whole point of the migration is
//      to drop ACP as a transport dependency.
//   2. TUI (default invocation)        → the interactive terminal UI.
//
// So we drive Gemini via PTY, like Copilot. Long-lived subprocess
// per session, regex turn detection, idle+cap safety net.
//
// Structured events (Phase 6.5):
//   We spawn Gemini with GEMINI_TELEMETRY_ENABLED=true /
//   GEMINI_TELEMETRY_TARGET=local / GEMINI_TELEMETRY_OUTFILE pointing
//   at a session-scoped JSONL. The telemetry tailer watches that
//   file and translates tool_call events into
//   tool_call / tool_call_update SessionNotifications so the UI gets
//   pills. Text/thought chunks still flow through the PTY buffer.
//
// Auth: `~/.gemini/oauth_creds.json` existence probe.
//
// ──────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { IPty } from "node-pty";

import type {
  AgentAdapter,
  AgentAdapterContext,
  ContentBlock,
  InitializeResponse,
  ListSessionsResponse,
  LoadSessionResponse,
  NewSessionResponse,
  PromptResponse,
  RequestPermissionResponse,
  SessionNotification,
  StopReason,
} from "../../types";
import { AgentFailureError } from "../../types";
import { ensureSessionDir, removeSessionDir, writeSessionMeta } from "../../session-paths";
import { TERMINAL_AUTH_METHOD } from "../base";
import { stripAnsi } from "../copilot/ansi";
import { GeminiTelemetryTailer } from "./telemetry";

const AGENT_ID = "gemini";
const AGENT_NAME = "Gemini CLI";
const PROTOCOL_VERSION = 1;

// Gemini's TUI prompt glyph varies across versions. Match common
// cursor styles at start-of-line: ">", "❯", "»", or ">>".
const PROMPT_CURSOR = /(?:^|\r?\n)[\s]*(?:❯|»|>{1,2})\s*$/u;

const IDLE_TIMEOUT_MS = 2500;
const TURN_CAP_MS = 90_000;

interface GeminiSessionState {
  sessionId: string;
  cwd: string;
  env?: Record<string, string>;
  /** Path to the OTel JSONL Gemini writes to for this session. */
  telemetryPath: string;
  /** Tailer that turns telemetry records into SessionNotifications. */
  telemetry: GeminiTelemetryTailer | null;
  pty: IPty | null;
  buffer: string;
  pendingTurn: {
    resolve: (text: string) => void;
    reject: (err: Error) => void;
    idleTimer: NodeJS.Timeout | null;
    capTimer: NodeJS.Timeout | null;
  } | null;
}

export class GeminiAdapter implements AgentAdapter {
  readonly agentId = AGENT_ID;

  private readonly ctx: AgentAdapterContext;
  private readonly sessions = new Map<string, GeminiSessionState>();
  private cachedInitialize: InitializeResponse | null = null;

  constructor(ctx: AgentAdapterContext) {
    this.ctx = ctx;
  }

  async initialize(): Promise<InitializeResponse> {
    if (this.cachedInitialize) return this.cachedInitialize;
    const init: InitializeResponse = {
      protocolVersion: PROTOCOL_VERSION as never,
      agentInfo: { name: AGENT_NAME, version: "native" } as never,
      agentCapabilities: {
        loadSession: { enabled: false } as never,
        promptCapabilities: {
          image: false,
          audio: false,
          embeddedContext: false,
        } as never,
        mcpCapabilities: { http: false, sse: false } as never,
      } as never,
      authMethods: [TERMINAL_AUTH_METHOD] as never,
    };
    this.cachedInitialize = init;
    return init;
  }

  async newSession(opts: {
    cwd: string;
    env?: Record<string, string>;
  }): Promise<{ session: NewSessionResponse; initialize: InitializeResponse }> {
    const initialize = await this.initialize();
    const sessionId = randomUUID();

    const dirs = await ensureSessionDir(sessionId);
    const telemetryPath = path.join(dirs.telemetry, "gemini.jsonl");
    await fsp.writeFile(telemetryPath, "", { flag: "a" });

    await writeSessionMeta(sessionId, {
      agentId: AGENT_ID,
      cwd: opts.cwd,
      createdAt: Date.now(),
    });

    this.sessions.set(sessionId, {
      sessionId,
      cwd: opts.cwd,
      env: opts.env,
      telemetryPath,
      telemetry: null,
      pty: null,
      buffer: "",
      pendingTurn: null,
    });

    const session: NewSessionResponse = {
      sessionId,
      modes: {
        currentModeId: "default",
        availableModes: [{ modeId: "default", name: "Default" }],
      } as never,
    } as never;
    return { session, initialize };
  }

  async prompt(opts: {
    sessionId: string;
    prompt: ContentBlock[];
  }): Promise<{ stopReason: StopReason; response: PromptResponse }> {
    const state = this.mustState(opts.sessionId);
    if (state.pendingTurn) {
      throw new AgentFailureError({
        kind: "protocol-error",
        message: "a prompt is already in flight for this session",
        stage: "prompt",
        agentId: AGENT_ID,
      });
    }

    try {
      if (!state.pty) await this.spawnPty(state);
      const promptText = contentBlocksToText(opts.prompt);
      state.buffer = "";
      state.pty!.write(promptText + "\r");

      const text = await this.collectTurn(state);
      const clean = stripAnsi(text).trim();
      if (clean.length > 0) {
        this.ctx.emit.onSessionUpdate(AGENT_ID, {
          sessionId: state.sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: clean } as ContentBlock,
            messageId: randomUUID(),
          },
        } satisfies SessionNotification);
      }

      return {
        stopReason: "end_turn" as StopReason,
        response: {} as PromptResponse,
      };
    } catch (err) {
      throw new AgentFailureError({
        kind: "protocol-error",
        message: err instanceof Error ? err.message : String(err),
        stage: "prompt",
        agentId: AGENT_ID,
      });
    }
  }

  async cancel(opts: { sessionId: string }): Promise<void> {
    const state = this.sessions.get(opts.sessionId);
    if (!state) return;
    if (state.pty) state.pty.write("\x03"); // Ctrl-C
    if (state.pendingTurn) {
      const { resolve, idleTimer, capTimer } = state.pendingTurn;
      if (idleTimer) clearTimeout(idleTimer);
      if (capTimer) clearTimeout(capTimer);
      state.pendingTurn = null;
      resolve(state.buffer);
    }
  }

  async setMode(_opts: { sessionId: string; modeId: string }): Promise<void> {}

  async loadSession(opts: {
    sessionId: string;
    cwd: string;
    env?: Record<string, string>;
  }): Promise<LoadSessionResponse> {
    const existing = this.sessions.get(opts.sessionId);
    if (existing) {
      existing.cwd = opts.cwd;
      existing.env = opts.env;
    } else {
      const dirs = await ensureSessionDir(opts.sessionId);
      const telemetryPath = path.join(dirs.telemetry, "gemini.jsonl");
      await fsp.writeFile(telemetryPath, "", { flag: "a" });
      this.sessions.set(opts.sessionId, {
        sessionId: opts.sessionId,
        cwd: opts.cwd,
        env: opts.env,
        telemetryPath,
        telemetry: null,
        pty: null,
        buffer: "",
        pendingTurn: null,
      });
    }
    return {} as LoadSessionResponse;
  }

  async listSessions(_opts: {
    cwd?: string;
    cursor?: string | null;
  }): Promise<ListSessionsResponse> {
    return { sessions: [] } as never;
  }

  respondToPermission(_opts: {
    permissionId: string;
    response: RequestPermissionResponse;
  }): void {}

  async dispose(): Promise<void> {
    for (const state of this.sessions.values()) {
      if (state.pendingTurn) {
        const { reject, idleTimer, capTimer } = state.pendingTurn;
        if (idleTimer) clearTimeout(idleTimer);
        if (capTimer) clearTimeout(capTimer);
        state.pendingTurn = null;
        try { reject(new Error("adapter disposing")); } catch {}
      }
      if (state.telemetry) {
        void state.telemetry.stop();
        state.telemetry = null;
      }
      if (state.pty) {
        try { state.pty.kill(); } catch {}
        state.pty = null;
      }
      void removeSessionDir(state.sessionId).catch(() => {});
    }
    this.sessions.clear();
  }

  // ── internals ─────────────────────────────────────────

  private async spawnPty(state: GeminiSessionState): Promise<void> {
    const nodePty = (await import("node-pty")) as typeof import("node-pty");
    const pty = nodePty.spawn("gemini", [], {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: state.cwd,
      env: {
        ...(process.env as Record<string, string>),
        ...(state.env ?? {}),
        // Telemetry — Gemini writes every internal event (tool calls,
        // API I/O, errors) to this file. We tail it in parallel with
        // the PTY to extract structured events.
        GEMINI_TELEMETRY_ENABLED: "true",
        GEMINI_TELEMETRY_TARGET: "local",
        GEMINI_TELEMETRY_OUTFILE: state.telemetryPath,
      } as Record<string, string>,
    });

    // Attach the telemetry tailer before the first turn.
    state.telemetry = new GeminiTelemetryTailer({
      filePath: state.telemetryPath,
      sessionId: state.sessionId,
      emit: (n) => this.ctx.emit.onSessionUpdate(AGENT_ID, n),
      onUnknown: () => { /* ignore non-tool events */ },
    });
    void state.telemetry.start();

    pty.onData((data) => {
      state.buffer += data;
      if (state.pendingTurn) {
        const p = state.pendingTurn;
        if (p.idleTimer) clearTimeout(p.idleTimer);
        p.idleTimer = setTimeout(() => this.completeTurn(state), IDLE_TIMEOUT_MS);
        if (PROMPT_CURSOR.test(state.buffer)) this.completeTurn(state);
      }
    });

    pty.onExit(({ exitCode, signal }) => {
      const sigStr = signal != null ? String(signal) : null;
      this.ctx.emit.onAgentExit(AGENT_ID, exitCode ?? null, sigStr);
      state.pty = null;
      if (state.pendingTurn) {
        const { reject, idleTimer, capTimer } = state.pendingTurn;
        if (idleTimer) clearTimeout(idleTimer);
        if (capTimer) clearTimeout(capTimer);
        state.pendingTurn = null;
        try {
          reject(new Error(`gemini exited code=${exitCode} signal=${signal ?? "null"}`));
        } catch {}
      }
    });

    state.pty = pty;

    // Wait for Gemini's startup banner to draw so the first user-turn
    // doesn't capture it as assistant output. Bounded at 8s since
    // Gemini's CLI has heavier startup (Google auth refresh, model
    // selection banner, MCP server discovery).
    await new Promise<void>((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; resolve(); }
      }, 8000);
      const id = setInterval(() => {
        if (done) return;
        if (PROMPT_CURSOR.test(state.buffer)) {
          done = true;
          clearTimeout(timer);
          clearInterval(id);
          resolve();
        }
      }, 100);
      setTimeout(() => clearInterval(id), 8000);
    });
    state.buffer = "";
  }

  private collectTurn(state: GeminiSessionState): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      state.pendingTurn = {
        resolve,
        reject,
        idleTimer: setTimeout(() => this.completeTurn(state), IDLE_TIMEOUT_MS),
        capTimer: setTimeout(() => this.completeTurn(state), TURN_CAP_MS),
      };
    });
  }

  private completeTurn(state: GeminiSessionState): void {
    const turn = state.pendingTurn;
    if (!turn) return;
    if (turn.idleTimer) clearTimeout(turn.idleTimer);
    if (turn.capTimer) clearTimeout(turn.capTimer);
    state.pendingTurn = null;
    const text = state.buffer.replace(PROMPT_CURSOR, "");
    state.buffer = "";
    turn.resolve(text);
  }

  private mustState(sessionId: string): GeminiSessionState {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new AgentFailureError({
        kind: "protocol-error",
        message: `unknown session: ${sessionId}`,
        stage: "prompt",
        agentId: AGENT_ID,
      });
    }
    return state;
  }
}

function contentBlocksToText(blocks: ContentBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    const block = b as unknown as { type?: string; text?: string };
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n\n");
}

export function createGeminiAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new GeminiAdapter(ctx);
}
