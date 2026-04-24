// ──────────────────────────────────────────────────────────
// Codex CLI adapter
// ──────────────────────────────────────────────────────────
//
// Model (mirrors Claude, simpler):
//   - newSession() generates a Zeros-side UUID, creates the session
//     state dir for crash recovery, stores empty state.
//   - prompt() spawns `codex exec --json "<text>"` on first turn;
//     subsequent turns use `codex exec resume <thread-id> --json
//     "<text>"`. We capture Codex's thread id from the
//     `thread.started` event and map it to our sessionId.
//   - No hook system. Codex's `exec` mode enforces its own sandbox;
//     users configure approval behavior in `~/.codex/config.toml`.
//   - cancel() SIGTERMs the in-flight spawn.
//
// Auth: `~/.codex/auth.json` existence probe. Never read.
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
import { CodexStreamTranslator } from "./translator";
import { listCodexSessions } from "./history";

const AGENT_ID = "codex-acp";
const AGENT_NAME = "Codex";
const PROTOCOL_VERSION = 1;

interface CodexSessionState {
  sessionId: string;
  cwd: string;
  env?: Record<string, string>;
  /** Codex's thread id, captured from thread.started. null until first
   *  successful prompt. Drives --resume on subsequent turns. */
  codexThreadId: string | null;
  active: SpawnedStream | null;
  translator: CodexStreamTranslator | null;
}

export class CodexAdapter implements AgentAdapter {
  readonly agentId = AGENT_ID;

  private readonly ctx: AgentAdapterContext;
  private readonly sessions = new Map<string, CodexSessionState>();
  private cachedInitialize: InitializeResponse | null = null;

  constructor(ctx: AgentAdapterContext) {
    this.ctx = ctx;
  }

  async initialize(): Promise<InitializeResponse> {
    if (this.cachedInitialize) return this.cachedInitialize;
    const init: InitializeResponse = {
      protocolVersion: PROTOCOL_VERSION as never,
      agentInfo: {
        name: AGENT_NAME,
        version: "native",
      } as never,
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
        codexThreadId: null,
        active: null,
        translator: null,
      });

      const session: NewSessionResponse = {
        sessionId,
        modes: {
          currentModeId: "default",
          availableModes: [
            { modeId: "default", name: "Default" },
          ],
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
    state.translator = new CodexStreamTranslator({
      sessionId: state.sessionId,
      emit: (n) => this.ctx.emit.onSessionUpdate(AGENT_ID, n),
      onUnknown: (ev) => {
        // eslint-disable-next-line no-console
        console.debug("[codex] unknown stream event", ev);
      },
    });

    const args = state.codexThreadId
      ? ["exec", "resume", state.codexThreadId, "--json", promptText]
      : ["exec", "--json", promptText];

    const stream = spawnStreamJson({
      command: "codex",
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

      // Capture Codex's thread id so subsequent prompts use --resume.
      const threadId = state.translator?.codexThreadId ?? null;
      if (threadId && !state.codexThreadId) {
        state.codexThreadId = threadId;
      }

      const sawTerminal = state.translator?.sawTurnTerminal ?? false;
      const stopReason = sawTerminal
        ? state.translator!.stopReason
        : ("cancelled" as StopReason);

      if (!sawTerminal && code !== 0) {
        const failure = classifyExit({
          agentId: AGENT_ID,
          code,
          signal,
          stderrTail: stream.stderrTail(),
          stage: "prompt",
        });
        throw new AgentFailureError(failure);
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
    // Codex doesn't expose named modes via `exec` today. Accept the
    // call so the wire contract doesn't change, but it's a no-op.
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
      // If the session already had a Codex thread id, keep it so the
      // next prompt resumes with --resume <id>. Otherwise treat the
      // incoming opts.sessionId as the thread id (Codex's own id is
      // what the UI stored when it listed sessions).
      if (!existing.codexThreadId) {
        existing.codexThreadId = opts.sessionId;
      }
    } else {
      await ensureSessionDir(opts.sessionId);
      // Assume opts.sessionId IS a Codex thread id — that's what
      // listSessions returned and the UI stored. First prompt will
      // use `codex exec resume <thread-id>`.
      this.sessions.set(opts.sessionId, {
        sessionId: opts.sessionId,
        cwd: opts.cwd,
        env: opts.env,
        codexThreadId: opts.sessionId,
        active: null,
        translator: null,
      });
    }
    return {} as LoadSessionResponse;
  }

  async listSessions(opts: {
    cwd?: string;
    cursor?: string | null;
  }): Promise<ListSessionsResponse> {
    // Enumerate rollout JSONL files under $CODEX_HOME/sessions and
    // return the 50 newest. Cursor pagination isn't wired in yet —
    // that'd require stable ordering + offset tokens, which the UI
    // doesn't currently page through anyway.
    return listCodexSessions({ cwd: opts.cwd });
  }

  respondToPermission(_opts: {
    permissionId: string;
    response: RequestPermissionResponse;
  }): void {
    // Codex doesn't route permission prompts through our hook server
    // — it has its own sandbox/approval config. Swallow responses so
    // the gateway fan-out is a no-op for us.
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

  private mustState(sessionId: string): CodexSessionState {
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

export function createCodexAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new CodexAdapter(ctx);
}
