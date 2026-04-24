// ──────────────────────────────────────────────────────────
// Cursor Agent adapter
// ──────────────────────────────────────────────────────────
//
// Transport:
//   - `cursor-agent -p "<prompt>" --output-format stream-json
//      --stream-partial-output`
//   - First turn generates a Cursor session id (we capture from
//     `{"type":"system","subtype":"init"}` — same shape as Claude's
//     stream-json).
//   - Followups: `... --resume <cursorSessionId>` or `--continue`.
//
// Cursor's stream-json schema is close enough to Claude's that we
// reuse ClaudeStreamTranslator. Any divergence lands in the
// translator's onUnknown hook for diagnostics.
//
// Auth: `~/.cursor/cli-config.json` or `cursor-agent status` exit code.
//
// ──────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";

import {
  spawnStreamJson,
  failureFromError,
  classifyExit,
  type SpawnedStream,
} from "../base";
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
  StopReason,
} from "../../types";
import { AgentFailureError } from "../../types";
import { ensureSessionDir, removeSessionDir, writeSessionMeta } from "../../session-paths";
import { ClaudeStreamTranslator } from "../claude/translator";

const AGENT_ID = "cursor";
const AGENT_NAME = "Cursor Agent";
const PROTOCOL_VERSION = 1;

interface CursorSessionState {
  sessionId: string;
  cwd: string;
  env?: Record<string, string>;
  /** Cursor-side session id, captured from stream-json init event. */
  cursorSessionId: string | null;
  active: SpawnedStream | null;
  translator: ClaudeStreamTranslator | null;
}

export class CursorAdapter implements AgentAdapter {
  readonly agentId = AGENT_ID;

  private readonly ctx: AgentAdapterContext;
  private readonly sessions = new Map<string, CursorSessionState>();
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
        loadSession: { enabled: true } as never,
        promptCapabilities: {
          image: false,
          audio: false,
          embeddedContext: false,
        } as never,
        mcpCapabilities: { http: false, sse: false } as never,
        sessionCapabilities: { list: {} } as never,
      } as never,
      authMethods: [],
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

    try {
      await ensureSessionDir(sessionId);
      await writeSessionMeta(sessionId, {
        agentId: AGENT_ID,
        cwd: opts.cwd,
        createdAt: Date.now(),
      });
      this.sessions.set(sessionId, {
        sessionId,
        cwd: opts.cwd,
        env: opts.env,
        cursorSessionId: null,
        active: null,
        translator: null,
      });
      const session: NewSessionResponse = {
        sessionId,
        modes: {
          currentModeId: "default",
          availableModes: [{ modeId: "default", name: "Default" }],
        } as never,
      } as never;
      return { session, initialize };
    } catch (err) {
      throw new AgentFailureError(
        failureFromError(err, AGENT_ID, "newSession"),
      );
    }
  }

  async prompt(opts: {
    sessionId: string;
    prompt: ContentBlock[];
  }): Promise<{ stopReason: StopReason; response: PromptResponse }> {
    const state = this.mustState(opts.sessionId);
    if (state.active) {
      throw new AgentFailureError({
        kind: "protocol-error",
        message: "a prompt is already in flight for this session",
        stage: "prompt",
        agentId: AGENT_ID,
      });
    }

    const promptText = contentBlocksToText(opts.prompt);
    state.translator = new ClaudeStreamTranslator({
      sessionId: state.sessionId,
      emit: (n) => this.ctx.emit.onSessionUpdate(AGENT_ID, n),
      onUnknown: (ev) => {
        // eslint-disable-next-line no-console
        console.debug("[cursor] unknown stream event", ev);
      },
    });

    const args = [
      "-p",
      promptText,
      "--output-format",
      "stream-json",
      "--stream-partial-output",
    ];
    if (state.cursorSessionId) {
      args.push("--resume", state.cursorSessionId);
    }

    const stream = spawnStreamJson({
      command: "cursor-agent",
      args,
      cwd: state.cwd,
      env: state.env,
      onEvent: (obj) => state.translator?.feed(obj),
      onStderrLine: (line) =>
        this.ctx.emit.onAgentStderr(AGENT_ID, line),
    });
    state.active = stream;

    try {
      const { code, signal } = await stream.exited;
      // Claude translator captures the session id into claudeSessionId.
      // For Cursor we repurpose that same field — same event shape.
      const cursorSid = state.translator?.claudeSessionId ?? null;
      if (cursorSid && !state.cursorSessionId) {
        state.cursorSessionId = cursorSid;
      }

      const sawResult = state.translator?.sawResult ?? false;
      const stopReason = sawResult
        ? state.translator!.stopReason
        : ("cancelled" as StopReason);

      if (!sawResult && code !== 0) {
        throw new AgentFailureError(classifyExit({
          agentId: AGENT_ID,
          code,
          signal,
          stderrTail: stream.stderrTail(),
          stage: "prompt",
        }));
      }
      return {
        stopReason: stopReason as StopReason,
        response: {} as PromptResponse,
      };
    } finally {
      state.active = null;
    }
  }

  async cancel(opts: { sessionId: string }): Promise<void> {
    const state = this.sessions.get(opts.sessionId);
    if (!state?.active) return;
    await state.active.kill("SIGTERM");
  }

  async setMode(_opts: { sessionId: string; modeId: string }): Promise<void> {
    // Cursor doesn't expose named modes through stream-json today.
  }

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
      await ensureSessionDir(opts.sessionId);
      this.sessions.set(opts.sessionId, {
        sessionId: opts.sessionId,
        cwd: opts.cwd,
        env: opts.env,
        cursorSessionId: null,
        active: null,
        translator: null,
      });
    }
    return {} as LoadSessionResponse;
  }

  async listSessions(_opts: {
    cwd?: string;
    cursor?: string | null;
  }): Promise<ListSessionsResponse> {
    // `cursor-agent ls` would enumerate prior chats — Phase 3.5.
    return { sessions: [] } as never;
  }

  respondToPermission(_opts: {
    permissionId: string;
    response: RequestPermissionResponse;
  }): void {
    // Cursor-agent doesn't route permissions through hooks.
  }

  async dispose(): Promise<void> {
    const shutdowns: Array<Promise<unknown>> = [];
    for (const state of this.sessions.values()) {
      if (state.active) {
        shutdowns.push(state.active.kill("SIGTERM").catch(() => {}));
      }
      shutdowns.push(removeSessionDir(state.sessionId).catch(() => {}));
    }
    this.sessions.clear();
    await Promise.all(shutdowns);
  }

  private mustState(sessionId: string): CursorSessionState {
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

export function createCursorAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new CursorAdapter(ctx);
}
