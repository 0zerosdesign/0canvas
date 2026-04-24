// ──────────────────────────────────────────────────────────
// Factory Droid adapter
// ──────────────────────────────────────────────────────────
//
// Transport:
//   - `droid exec --output-format json "<prompt>"` — emits NDJSON
//     stream of events. Per Factory's docs, the stream shape mirrors
//     Claude's stream-json (intentional — Droid's hook API is
//     Claude-parity), so we reuse ClaudeStreamTranslator.
//
// Hooks:
//   Droid fires the same hook events as Claude (PreToolUse,
//   PostToolUse, Stop, Notification, SessionEnd) with identical
//   stdin-JSON envelopes and exit-2 blocking. We write a
//   settings.json with HTTP hooks into a session-scoped config dir
//   and point Droid at it via FACTORY_CONFIG_DIR. If Droid honors a
//   different env var name, the hooks silently don't fire and the
//   adapter still works via the stream-json exec output — degraded,
//   not broken.
//
// Resume: not wired in Phase 4. Each prompt is a fresh Droid
// invocation. The chat UI owns the transcript.
//
// Auth: `~/.factory/config.json` existence probe.
//
// ──────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

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
  HookEvent,
  HookResponse,
  InitializeResponse,
  ListSessionsResponse,
  LoadSessionResponse,
  NewSessionResponse,
  PromptResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  StopReason,
} from "../../types";
import { AgentFailureError } from "../../types";
import { ensureSessionDir, removeSessionDir, writeSessionMeta } from "../../session-paths";
import { ClaudeStreamTranslator } from "../claude/translator";
import { installDroidHooks } from "./hooks";

const AGENT_ID = "factory-droid";
const AGENT_NAME = "Factory Droid";
const PROTOCOL_VERSION = 1;

interface DroidSessionState {
  sessionId: string;
  cwd: string;
  env?: Record<string, string>;
  /** Session-scoped config dir pointed at by FACTORY_CONFIG_DIR. */
  configDir: string;
  /** Session token issued by the hook server. */
  hookToken: string;
  active: SpawnedStream | null;
  translator: ClaudeStreamTranslator | null;
  /** Permission-decision handlers keyed by permissionId, same pattern
   *  as ClaudeAdapter. Fan-out from the gateway's answerPermission. */
  pendingPermissions: Map<string, (r: RequestPermissionResponse) => void>;
}

export class DroidAdapter implements AgentAdapter {
  readonly agentId = AGENT_ID;

  private readonly ctx: AgentAdapterContext;
  private readonly sessions = new Map<string, DroidSessionState>();
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
      const dirs = await ensureSessionDir(sessionId);
      const configDir = path.join(dirs.env, "factory");
      await fsp.mkdir(configDir, { recursive: true });

      const { token } = this.ctx.hookServer.registerSession(
        sessionId,
        (event) => this.handleHook(sessionId, event),
      );
      await installDroidHooks({
        configDir,
        hookUrl: this.ctx.hookServer.url,
        token,
        sessionId,
      });

      await writeSessionMeta(sessionId, {
        agentId: AGENT_ID,
        cwd: opts.cwd,
        createdAt: Date.now(),
      });
      this.sessions.set(sessionId, {
        sessionId,
        cwd: opts.cwd,
        env: opts.env,
        configDir,
        hookToken: token,
        active: null,
        translator: null,
        pendingPermissions: new Map(),
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
        console.debug("[droid] unknown stream event", ev);
      },
    });

    const args = ["exec", "--output-format", "json", promptText];

    // Point Droid at our session-scoped config dir so its hook
    // discovery picks up the settings.json we wrote. FACTORY_CONFIG_DIR
    // is a best-guess env name — if Droid uses something different,
    // the hooks silently no-op (stream-json still works).
    const sessionEnv: Record<string, string> = {
      ...(state.env ?? {}),
      FACTORY_CONFIG_DIR: state.configDir,
    };

    const stream = spawnStreamJson({
      command: "droid",
      args,
      cwd: state.cwd,
      env: sessionEnv,
      onEvent: (obj) => state.translator?.feed(obj),
      onStderrLine: (line) =>
        this.ctx.emit.onAgentStderr(AGENT_ID, line),
    });
    state.active = stream;

    try {
      const { code, signal } = await stream.exited;
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
      const configDir = path.join(dirs.env, "factory");
      await fsp.mkdir(configDir, { recursive: true });
      const { token } = this.ctx.hookServer.registerSession(
        opts.sessionId,
        (event) => this.handleHook(opts.sessionId, event),
      );
      await installDroidHooks({
        configDir,
        hookUrl: this.ctx.hookServer.url,
        token,
        sessionId: opts.sessionId,
      });
      this.sessions.set(opts.sessionId, {
        sessionId: opts.sessionId,
        cwd: opts.cwd,
        env: opts.env,
        configDir,
        hookToken: token,
        active: null,
        translator: null,
        pendingPermissions: new Map(),
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

  respondToPermission(opts: {
    permissionId: string;
    response: RequestPermissionResponse;
  }): void {
    for (const state of this.sessions.values()) {
      const resolver = state.pendingPermissions.get(opts.permissionId);
      if (!resolver) continue;
      state.pendingPermissions.delete(opts.permissionId);
      resolver(opts.response);
      return;
    }
  }

  private async handleHook(
    sessionId: string,
    event: HookEvent,
  ): Promise<HookResponse> {
    const state = this.sessions.get(sessionId);
    if (!state) return { status: 404, body: { error: "no-such-session" } };

    if (event.name === "PreToolUse") {
      const decision = await this.escalatePermission(state, event);
      return {
        status: 200,
        body: {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: decision,
          },
        },
      };
    }
    return { status: 200 };
  }

  private async escalatePermission(
    state: DroidSessionState,
    event: HookEvent,
  ): Promise<"allow" | "deny" | "ask"> {
    const payload = event.payload as Record<string, unknown> | null;
    const toolName = typeof payload?.tool_name === "string"
      ? (payload.tool_name as string)
      : "tool";
    const toolInput = payload?.tool_input;
    const toolUseId = typeof payload?.tool_use_id === "string"
      ? (payload.tool_use_id as string)
      : randomUUID();

    const permissionId = randomUUID();
    const request: RequestPermissionRequest = {
      sessionId: state.sessionId,
      toolCall: {
        toolCallId: toolUseId,
        title: `Allow ${toolName}?`,
        kind: "other",
        rawInput: toolInput,
        status: "pending",
      },
      options: [
        { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
        { optionId: "allow_always", name: "Allow always", kind: "allow_always" },
        { optionId: "reject_once", name: "Deny", kind: "reject_once" },
      ],
    } as never;

    const decisionPromise = new Promise<RequestPermissionResponse>((resolve) => {
      state.pendingPermissions.set(permissionId, resolve);
    });

    this.ctx.emit.onPermissionRequest(AGENT_ID, permissionId, request);

    const response = await decisionPromise;
    return mapPermissionResponse(response);
  }

  async dispose(): Promise<void> {
    const shutdowns: Array<Promise<unknown>> = [];
    for (const state of this.sessions.values()) {
      if (state.active) {
        shutdowns.push(state.active.kill("SIGTERM").catch(() => {}));
      }
      for (const resolver of state.pendingPermissions.values()) {
        resolver({ outcome: { outcome: "cancelled" } } as never);
      }
      state.pendingPermissions.clear();
      this.ctx.hookServer.unregisterSession(state.sessionId);
      shutdowns.push(removeSessionDir(state.sessionId).catch(() => {}));
    }
    this.sessions.clear();
    await Promise.all(shutdowns);
  }

  private mustState(sessionId: string): DroidSessionState {
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

function mapPermissionResponse(
  response: RequestPermissionResponse,
): "allow" | "deny" | "ask" {
  const outcome = (response as unknown as {
    outcome?: { outcome?: string; optionId?: string };
  }).outcome;
  if (!outcome) return "deny";
  if (outcome.outcome === "cancelled") return "deny";
  if (outcome.outcome === "selected") {
    const opt = outcome.optionId ?? "";
    if (opt === "allow_once" || opt === "allow_always") return "allow";
    if (opt === "reject_once" || opt === "reject_always") return "deny";
  }
  return "ask";
}

export function createDroidAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new DroidAdapter(ctx);
}
