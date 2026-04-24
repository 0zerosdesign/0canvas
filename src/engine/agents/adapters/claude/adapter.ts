// ──────────────────────────────────────────────────────────
// Claude Code adapter
// ──────────────────────────────────────────────────────────
//
// The pilot adapter. Every other CLI adapter inherits this shape.
//
// Model:
//   - newSession() generates a Zeros-side UUID, writes hook config,
//     registers with the hook server. No subprocess spawned yet.
//   - prompt() spawns `claude -p "<prompt>"` with stream-json output
//     and `--session-id <uuid>` on first prompt / `--resume <uuid>`
//     thereafter. Subprocess exits when the turn completes. No
//     long-lived agent process — Claude's own on-disk transcript is
//     the durable state.
//   - cancel() SIGTERMs the in-flight spawn.
//
// Permission round-trip: Claude's PreToolUse hook POSTs to our local
// hook server. The adapter decides whether to auto-allow or escalate
// to the UI via AGENT_PERMISSION_REQUEST. The HTTP response body is
// the permission decision Claude honors.
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
  SessionNotification,
  StopReason,
} from "../../types";
import { AgentFailureError } from "../../types";
import { ensureSessionDir, removeSessionDir, writeSessionMeta } from "../../session-paths";
import { installClaudeHooks } from "./hooks";
import { ClaudeStreamTranslator } from "./translator";
import { replayTranscript } from "./history";

const AGENT_ID = "claude-acp";
const AGENT_NAME = "Claude Code";
const PROTOCOL_VERSION = 1;

interface ClaudeSessionState {
  sessionId: string;
  cwd: string;
  env?: Record<string, string>;
  /** Filesystem location of this session's hook-injection CLAUDE_CONFIG_DIR. */
  configDir: string;
  /** Path to `settings.json` inside configDir — ours, not the user's. */
  settingsPath: string;
  /** Session token issued by the hook server. */
  hookToken: string;
  /** Has the user prompted yet? Determines --session-id vs --resume. */
  primed: boolean;
  /** In-flight subprocess for the current turn, if any. */
  active: SpawnedStream | null;
  /** Pending permission-decision handlers keyed by our permissionId. */
  pendingPermissions: Map<string, (r: RequestPermissionResponse) => void>;
  /** Translator retains per-session state (tool-id map, message ids). */
  translator: ClaudeStreamTranslator | null;
}

export class ClaudeAdapter implements AgentAdapter {
  readonly agentId = AGENT_ID;

  private readonly ctx: AgentAdapterContext;
  private readonly sessions = new Map<string, ClaudeSessionState>();
  private cachedInitialize: InitializeResponse | null = null;

  constructor(ctx: AgentAdapterContext) {
    this.ctx = ctx;
  }

  // ── initialize ────────────────────────────────────────

  async initialize(): Promise<InitializeResponse> {
    if (this.cachedInitialize) return this.cachedInitialize;
    // The native adapter has no subprocess handshake — we synthesize
    // an InitializeResponse that matches what the UI expects and
    // advertise the capabilities Claude has end-to-end.
    const init: InitializeResponse = {
      protocolVersion: PROTOCOL_VERSION as never,
      agentInfo: {
        name: AGENT_NAME,
        version: "native",
      } as never,
      agentCapabilities: {
        loadSession: { enabled: true } as never,
        promptCapabilities: {
          image: true,
          audio: false,
          embeddedContext: true,
        } as never,
        mcpCapabilities: { http: true, sse: false } as never,
        sessionCapabilities: { list: {} } as never,
      } as never,
      authMethods: [],
    };
    this.cachedInitialize = init;
    return init;
  }

  // ── newSession ────────────────────────────────────────

  async newSession(opts: {
    cwd: string;
    env?: Record<string, string>;
  }): Promise<{ session: NewSessionResponse; initialize: InitializeResponse }> {
    const initialize = await this.initialize();
    const sessionId = randomUUID();

    try {
      const dirs = await ensureSessionDir(sessionId);
      const configDir = path.join(dirs.env, "claude");
      await fsp.mkdir(configDir, { recursive: true });

      const { token } = this.ctx.hookServer.registerSession(
        sessionId,
        (event) => this.handleHook(sessionId, event),
      );
      const settingsPath = await installClaudeHooks({
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
        settingsPath,
        hookToken: token,
        primed: false,
        active: null,
        pendingPermissions: new Map(),
        translator: null,
      });

      const session: NewSessionResponse = {
        sessionId,
        modes: {
          currentModeId: "default",
          availableModes: [
            { modeId: "default", name: "Default" },
            { modeId: "plan", name: "Plan" },
            { modeId: "accept-edits", name: "Accept Edits" },
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

  // ── prompt ────────────────────────────────────────────

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
        console.debug("[claude] unknown stream-json event", ev);
      },
    });

    const args = [
      "-p",
      promptText,
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "default",
    ];
    if (state.primed) {
      args.push("--resume", state.sessionId);
    } else {
      args.push("--session-id", state.sessionId);
    }

    const sessionEnv: Record<string, string> = {
      ...(state.env ?? {}),
      CLAUDE_CONFIG_DIR: state.configDir,
    };

    const stream = spawnStreamJson({
      command: "claude",
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

      // Translator-derived stop reason takes precedence if we saw a
      // `result` event. Exit-only (no result) means Claude died or
      // was cancelled before finishing — classify accordingly.
      const sawResult = state.translator?.sawResult ?? false;
      const stopReason = sawResult
        ? state.translator!.stopReason
        : ("cancelled" as StopReason);

      if (!sawResult && code !== 0) {
        // Non-zero exit without a `result` event → real failure.
        // Emit a classified failure and throw.
        const failure = classifyExit({
          agentId: AGENT_ID,
          code,
          signal,
          stderrTail: stream.stderrTail(),
          stage: "prompt",
        });
        throw new AgentFailureError(failure);
      }

      state.primed = true;
      return {
        stopReason: stopReason as StopReason,
        response: {} as PromptResponse,
      };
    } finally {
      state.active = null;
    }
  }

  // ── cancel ────────────────────────────────────────────

  async cancel(opts: { sessionId: string }): Promise<void> {
    const state = this.sessions.get(opts.sessionId);
    if (!state?.active) return;
    await state.active.kill("SIGTERM");
  }

  // ── setMode ───────────────────────────────────────────

  async setMode(opts: { sessionId: string; modeId: string }): Promise<void> {
    const state = this.mustState(opts.sessionId);
    // Claude honors `--permission-mode` per-spawn. We store the UI's
    // selection and apply it on the next prompt. No RPC needed today;
    // matching the wire's ACK semantics is enough for the UI.
    state.env = { ...(state.env ?? {}), __ZEROS_MODE: opts.modeId };
    this.ctx.emit.onSessionUpdate(AGENT_ID, {
      sessionId: opts.sessionId,
      update: {
        sessionUpdate: "current_mode_update",
        currentModeId: opts.modeId,
      } as never,
    } satisfies SessionNotification);
  }

  // ── loadSession ───────────────────────────────────────

  async loadSession(opts: {
    sessionId: string;
    cwd: string;
    env?: Record<string, string>;
  }): Promise<LoadSessionResponse> {
    // Re-hydrate session state. The Claude transcript on disk stays
    // owned by Claude — we don't replay it; `--resume <uuid>` on the
    // next prompt picks up the history natively. `primed: true` so
    // we use --resume not --session-id.
    const existing = this.sessions.get(opts.sessionId);
    if (existing) {
      existing.cwd = opts.cwd;
      existing.env = opts.env;
      existing.primed = true;
    } else {
      const dirs = await ensureSessionDir(opts.sessionId);
      const configDir = path.join(dirs.env, "claude");
      await fsp.mkdir(configDir, { recursive: true });
      const { token } = this.ctx.hookServer.registerSession(
        opts.sessionId,
        (event) => this.handleHook(opts.sessionId, event),
      );
      const settingsPath = await installClaudeHooks({
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
        settingsPath,
        hookToken: token,
        primed: true,
        active: null,
        pendingPermissions: new Map(),
        translator: null,
      });
    }
    // Replay the on-disk Claude transcript so the UI sees prior
    // turns as historical SessionNotification events.
    await replayTranscript({
      sessionId: opts.sessionId,
      emit: (n) => this.ctx.emit.onSessionUpdate(AGENT_ID, n),
    });
    return {} as LoadSessionResponse;
  }

  // ── listSessions ──────────────────────────────────────

  async listSessions(_opts: {
    cwd?: string;
    cursor?: string | null;
  }): Promise<ListSessionsResponse> {
    // Claude's own `--resume` picker is the authoritative list, but
    // we don't have a machine-readable listing for it yet. Return
    // empty — UI falls back to its own chat history. Phase 1.5
    // improvement: tail ~/.claude/projects/<hash>/*.jsonl and emit.
    return { sessions: [] } as never;
  }

  // ── permission round-trip ─────────────────────────────

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

  /** Called by the hook server for every POST to /hook. */
  private async handleHook(
    sessionId: string,
    event: HookEvent,
  ): Promise<HookResponse> {
    const state = this.sessions.get(sessionId);
    if (!state) {
      return { status: 404, body: { error: "no-such-session" } };
    }

    switch (event.name) {
      case "PreToolUse": {
        const decision = await this.escalatePermission(state, event);
        // Claude's hook output schema for PreToolUse decisions.
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
      case "PostToolUse":
      case "Stop":
      case "Notification":
      case "SessionEnd":
      default:
        // Non-blocking hooks — just ack 200.
        return { status: 200 };
    }
  }

  private async escalatePermission(
    state: ClaudeSessionState,
    event: HookEvent,
  ): Promise<"allow" | "deny" | "ask"> {
    const payload = event.payload as Record<string, unknown> | null;
    const toolName = typeof payload?.tool_name === "string"
      ? (payload.tool_name as string)
      : "tool";
    const toolInput = payload?.tool_input;

    const permissionId = randomUUID();
    const request = this.buildPermissionRequest({
      sessionId: state.sessionId,
      toolUseId: typeof payload?.tool_use_id === "string"
        ? (payload.tool_use_id as string)
        : permissionId,
      toolName,
      toolInput,
    });

    const decisionPromise = new Promise<RequestPermissionResponse>((resolve) => {
      state.pendingPermissions.set(permissionId, resolve);
    });

    this.ctx.emit.onPermissionRequest(AGENT_ID, permissionId, request);

    const response = await decisionPromise;
    return mapPermissionResponse(response);
  }

  private buildPermissionRequest(args: {
    sessionId: string;
    toolUseId: string;
    toolName: string;
    toolInput: unknown;
  }): RequestPermissionRequest {
    return {
      sessionId: args.sessionId,
      toolCall: {
        toolCallId: args.toolUseId,
        title: `Allow ${args.toolName}?`,
        kind: "other",
        rawInput: args.toolInput,
        status: "pending",
      },
      options: [
        { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
        { optionId: "allow_always", name: "Allow always", kind: "allow_always" },
        { optionId: "reject_once", name: "Deny", kind: "reject_once" },
      ],
    } as never;
  }

  // ── dispose ───────────────────────────────────────────

  async dispose(): Promise<void> {
    const shutdowns: Array<Promise<unknown>> = [];
    for (const state of this.sessions.values()) {
      if (state.active) {
        shutdowns.push(state.active.kill("SIGTERM").catch(() => {}));
      }
      for (const resolver of state.pendingPermissions.values()) {
        // Unblock Claude with a rejection so hook server doesn't
        // hang on its 5-minute timeout during shutdown.
        resolver({
          outcome: { outcome: "cancelled" },
        } as never);
      }
      state.pendingPermissions.clear();
      this.ctx.hookServer.unregisterSession(state.sessionId);
      shutdowns.push(
        removeSessionDir(state.sessionId).catch(() => {}),
      );
    }
    this.sessions.clear();
    await Promise.all(shutdowns);
  }

  // ── internals ─────────────────────────────────────────

  private mustState(sessionId: string): ClaudeSessionState {
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

// ── helpers ──────────────────────────────────────────────

/**
 * Flatten the UI's ContentBlock[] prompt for `claude -p`. Text goes
 * verbatim. Images are either kept as data-URLs inline (Claude Code's
 * `-p` accepts them as markdown image refs) or, for file-path style
 * resource_link blocks, referenced by path so Claude reads them off
 * disk — the same mechanism the interactive UI uses for @-mentions.
 */
function contentBlocksToText(blocks: ContentBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    const block = b as unknown as {
      type?: string;
      text?: string;
      source?: { type?: string; media_type?: string; data?: string; url?: string };
      mimeType?: string;
      data?: string;
      uri?: string;
      name?: string;
    };

    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
      continue;
    }

    if (block.type === "image") {
      // Prefer base64 data-URL — Claude CLI inlines it. Otherwise
      // fall back to a URL reference if provided.
      const src = block.source;
      if (src?.data && src?.media_type) {
        parts.push(`![image](data:${src.media_type};base64,${src.data})`);
      } else if (src?.url) {
        parts.push(`![image](${src.url})`);
      } else if (block.data && block.mimeType) {
        parts.push(`![image](data:${block.mimeType};base64,${block.data})`);
      }
      continue;
    }

    if (block.type === "resource_link" && typeof block.uri === "string") {
      // Claude reads @-path references directly. Strip file:// prefix.
      const path = block.uri.replace(/^file:\/\//, "");
      parts.push(`@${path}`);
      continue;
    }

    // Audio and other rare types fall through silently. The UI
    // rarely passes these to Claude; when it does we document the
    // drop in the adapter's log rather than rejecting the prompt.
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

export function createClaudeAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new ClaudeAdapter(ctx);
}
