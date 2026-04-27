// ──────────────────────────────────────────────────────────
// StreamJsonAdapter — shared base for all NDJSON-streaming agents
// ──────────────────────────────────────────────────────────
//
// Owns the full per-agent lifecycle that previously lived duplicated
// across 5 adapter files (Claude/Codex/Cursor/Amp/Droid):
//
//   - sessions Map<sessionId, SessionState>
//   - cachedInitialize
//   - newSession (UUID, optional hook install, session meta, registry)
//   - prompt (spawn → translator drain → exit classify)
//   - cancel (SIGTERM the active subprocess)
//   - setMode (stash modeId into state.extra; spawn time applies)
//   - loadSession (delegate to spec, default re-hydrate)
//   - listSessions (delegate to spec, default empty)
//   - respondToPermission (find resolver across sessions)
//   - dispose (kill all active, unregister hook server, cleanup)
//   - hook routing (HookServer registers our handleHook; we
//                   delegate to spec.handleHook with an escalator)
//
// Per-agent files now declare a `StreamJsonAgentSpec` and let this
// class do everything else. ~70% line reduction across the 5 agents.
//
// ──────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

import {
  spawnStreamJson,
  failureFromError,
  classifyExit,
  TERMINAL_AUTH_METHOD,
} from "../base";
import {
  ensureSessionDir,
  removeSessionDir,
  writeSessionMeta,
} from "../../session-paths";
import {
  AgentFailureError,
  type AgentAdapter,
  type AgentAdapterContext,
  type ContentBlock,
  type HookEvent,
  type HookResponse,
  type InitializeResponse,
  type ListSessionsResponse,
  type LoadSessionResponse,
  type NewSessionResponse,
  type PromptResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type StopReason,
} from "../../types";
import type {
  PermissionEscalator,
  SessionState,
  StreamJsonAgentSpec,
  StreamTranslator,
} from "./spec";

export class StreamJsonAdapter<Extra = unknown> implements AgentAdapter {
  readonly agentId: string;

  private readonly spec: StreamJsonAgentSpec<Extra>;
  private readonly ctx: AgentAdapterContext;
  private readonly sessions = new Map<string, SessionState<Extra>>();
  private cachedInitialize: InitializeResponse | null = null;

  constructor(spec: StreamJsonAgentSpec<Extra>, ctx: AgentAdapterContext) {
    this.spec = spec;
    this.ctx = ctx;
    this.agentId = spec.agentId;
  }

  // ── initialize ────────────────────────────────────────

  async initialize(): Promise<InitializeResponse> {
    if (this.cachedInitialize) return this.cachedInitialize;
    const init = this.spec.buildInitializeResponse
      ? this.spec.buildInitializeResponse()
      : this.defaultInitializeResponse();
    this.cachedInitialize = init;
    return init;
  }

  private defaultInitializeResponse(): InitializeResponse {
    return {
      protocolVersion: this.spec.protocolVersion as never,
      agentInfo: {
        name: this.spec.agentName,
        version: "native",
      } as never,
      agentCapabilities: {
        loadSession: { enabled: !!this.spec.loadSession } as never,
        promptCapabilities: {
          image: true,
          audio: false,
          embeddedContext: true,
        } as never,
        mcpCapabilities: { http: true, sse: false } as never,
        sessionCapabilities: { list: {} } as never,
      } as never,
      authMethods: [TERMINAL_AUTH_METHOD] as never,
    };
  }

  // ── newSession ────────────────────────────────────────

  async newSession(opts: {
    cwd: string;
    env?: Record<string, string>;
  }): Promise<{ session: NewSessionResponse; initialize: InitializeResponse }> {
    const initialize = await this.initialize();
    const sessionId = randomUUID();

    try {
      // Create the session dir BEFORE anything that writes into it.
      // writeSessionMeta below + spec.initSessionExtra (which may write
      // hook config) both depend on the dir existing. Old per-agent
      // adapters called this themselves; the base now owns it so the
      // spec can stay declarative.
      await ensureSessionDir(sessionId);

      // Register hook routing FIRST so the spec can install settings.json
      // with the right token. registerHookSession wires this.handleHook,
      // which then delegates to spec.handleHook. Specs that don't speak
      // hooks (Codex, Cursor, Amp) just ignore the token.
      const { token: hookToken, url: hookUrl } =
        this.registerHookSession(sessionId);

      // Per-agent extra state (Codex thread id, Claude config dir, etc.)
      const extra = await this.spec.initSessionExtra({
        sessionId,
        ctx: this.ctx,
        cwd: opts.cwd,
        hookToken,
        hookUrl,
      });

      await writeSessionMeta(sessionId, {
        agentId: this.agentId,
        cwd: opts.cwd,
        createdAt: Date.now(),
      });

      this.sessions.set(sessionId, {
        sessionId,
        cwd: opts.cwd,
        env: opts.env,
        primed: false,
        active: null,
        pendingPermissions: new Map(),
        translator: null,
        extra,
      });

      const session: NewSessionResponse = {
        sessionId,
        modes: this.spec.modes
          ? ({
              currentModeId: this.spec.modes.defaultId,
              availableModes: this.spec.modes.available,
            } as never)
          : (undefined as never),
      } as never;

      return { session, initialize };
    } catch (err) {
      throw new AgentFailureError(
        failureFromError(err, this.agentId, "newSession"),
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
        agentId: this.agentId,
      });
    }

    if (this.spec.beforePrompt) await this.spec.beforePrompt(state);

    const promptText = this.spec.formatPromptText
      ? this.spec.formatPromptText(opts.prompt)
      : defaultFormatPromptText(opts.prompt);

    // Wrap the emit so we can scan agent text content for auth-required
    // hints (Claude / Codex sometimes stream "Not logged in · Please run
    // /login" instead of exiting non-zero). When detected we still let
    // the chunk render so the user sees the agent's own message, then
    // throw auth-required at the end of the turn so the green dot
    // updates and the chat surfaces the right chip.
    let sawAuthHint = false;
    state.translator = this.spec.createTranslator({
      sessionId: state.sessionId,
      state,
      emit: (n) => {
        if (!sawAuthHint && containsAuthHint(n)) sawAuthHint = true;
        this.ctx.emit.onSessionUpdate(this.agentId, n);
      },
    });

    const args = this.spec.buildPromptArgs({ state, promptText });
    const env = this.spec.buildPromptEnv
      ? { ...(state.env ?? {}), ...this.spec.buildPromptEnv(state) }
      : state.env;

    // eslint-disable-next-line no-console
    console.log(
      `[agents] ${this.agentId} prompt spawn: cmd=${this.spec.cliBinary} ` +
        `args=${JSON.stringify(args)} cwd=${state.cwd}`,
    );
    let eventCount = 0;
    const stream = spawnStreamJson({
      command: this.spec.cliBinary,
      args,
      cwd: state.cwd,
      env,
      onEvent: (obj) => {
        eventCount++;
        const evType = (obj as { type?: string } | null)?.type;
        if (eventCount <= 5) {
          // eslint-disable-next-line no-console
          console.log(
            `[agents] ${this.agentId} event ${eventCount}: type=${evType}`,
          );
        }
        // First event = the agent's CLI accepted the spawn and is
        // emitting on the session-id we passed. From this moment the
        // session is "in use" from the vendor's perspective; any
        // future spawn for the same session must use --resume (or
        // equivalent) instead of --session-id. Without this, a
        // cancelled-mid-stream prompt would leave primed=false (the
        // line 327 setter throws past, see comment there) and the
        // next prompt would re-spawn with --session-id, which Claude
        // rejects with "Session ID … is already in use." (Pre-stage-2
        // followup this manifested as a chat that worked once then
        // permanently failed after a cancel.)
        if (eventCount === 1) state.primed = true;
        state.translator?.feed(obj);
      },
      onStderrLine: (line) => {
        // eslint-disable-next-line no-console
        console.log(`[agents] ${this.agentId} stderr: ${line}`);
        this.ctx.emit.onAgentStderr(this.agentId, line);
      },
    });
    state.active = stream;

    try {
      const { code, signal } = await stream.exited;
      // eslint-disable-next-line no-console
      console.log(
        `[agents] ${this.agentId} prompt exit: code=${code} signal=${signal ?? ""} ` +
          `events=${eventCount} sawTerminal=${state.translator?.sawTerminal ?? false}`,
      );

      if (this.spec.captureAfterPrompt) {
        this.spec.captureAfterPrompt({ state, translator: state.translator });
      }

      const sawTerminal = state.translator?.sawTerminal ?? false;
      const stopReason = sawTerminal
        ? state.translator!.stopReason
        : ("cancelled" as StopReason);

      if (!sawTerminal && code !== 0) {
        throw new AgentFailureError(
          classifyExit({
            agentId: this.agentId,
            code,
            signal,
            stderrTail: stream.stderrTail(),
            stage: "prompt",
          }),
        );
      }

      // Subprocess exited cleanly (code 0) but produced no terminal
      // event. Pre-fix this surfaced as `cancelled` and the chat went
      // silent — visible as "Codex never responds" / "Cursor sends
      // nothing". The likely cause is a CLI-version mismatch (event
      // schema drift) or a wrong-command path. Either way, "no events"
      // is a real failure the user needs to see — log the spawn for
      // diagnosis and throw a structured protocol-error so the chat
      // surfaces an actionable message instead of going dark.
      if (!sawTerminal) {
        const stderrTail = stream.stderrTail();
        // eslint-disable-next-line no-console
        console.warn(
          `[agents] ${this.agentId} exited cleanly (code 0) with no terminal event. ` +
            `cmd=${this.spec.cliBinary} args=${JSON.stringify(args)} ` +
            `stderr=${JSON.stringify(stderrTail).slice(0, 500)}`,
        );
        throw new AgentFailureError({
          kind: "protocol-error",
          message:
            `${this.spec.agentName} produced no events. ` +
            `This usually means the CLI version is incompatible with the ` +
            `streaming schema we expect. ` +
            (stderrTail
              ? `Stderr: ${stderrTail.slice(0, 200)}`
              : `Try running '${this.spec.cliBinary} --version' in a terminal.`),
          stage: "prompt",
          agentId: this.agentId,
          exit: { code, signal: signal ? String(signal) : null, stderrTail },
        });
      }

      // Agent finished cleanly but its message content told the user
      // they're not logged in — turn that into a real auth-required
      // failure so the gateway's runtime auth invalidation flips the
      // green dot to gray. Without this the user has no signal beyond
      // a confusing in-chat message and our auth probe lies.
      if (sawAuthHint) {
        throw new AgentFailureError({
          kind: "auth-required",
          message: `${this.spec.agentName} is not signed in — open Settings → Agents to sign in.`,
          stage: "prompt",
          agentId: this.agentId,
        });
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

  async setMode(opts: {
    sessionId: string;
    modeId: string;
  }): Promise<void> {
    const state = this.mustState(opts.sessionId);
    if (this.spec.setMode) {
      this.spec.setMode({ state, modeId: opts.modeId });
    }
    // Echo the change into the session-update stream so the UI pill
    // updates without waiting for the next prompt.
    this.ctx.emit.onSessionUpdate(this.agentId, {
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
    // Register hook routing for the resumed session — same contract
    // as newSession. Idempotent if the session is already in our map.
    const existing = this.sessions.get(opts.sessionId);
    const { token: hookToken, url: hookUrl } = existing
      ? { token: "", url: this.ctx.hookServer.url }
      : this.registerHookSession(opts.sessionId);

    if (this.spec.loadSession) {
      const { response, extra } = await this.spec.loadSession({
        sessionId: opts.sessionId,
        cwd: opts.cwd,
        env: opts.env,
        ctx: this.ctx,
        emit: (n) => this.ctx.emit.onSessionUpdate(this.agentId, n),
      });
      if (existing) {
        existing.cwd = opts.cwd;
        existing.env = opts.env;
        existing.primed = true;
        existing.extra = extra;
      } else {
        this.sessions.set(opts.sessionId, {
          sessionId: opts.sessionId,
          cwd: opts.cwd,
          env: opts.env,
          primed: true,
          active: null,
          pendingPermissions: new Map(),
          translator: null,
          extra,
        });
      }
      return response;
    }
    // Default: re-hydrate state with primed=true, no history replay.
    if (existing) {
      existing.cwd = opts.cwd;
      existing.env = opts.env;
      existing.primed = true;
    } else {
      const extra = await this.spec.initSessionExtra({
        sessionId: opts.sessionId,
        ctx: this.ctx,
        cwd: opts.cwd,
        hookToken,
        hookUrl,
      });
      this.sessions.set(opts.sessionId, {
        sessionId: opts.sessionId,
        cwd: opts.cwd,
        env: opts.env,
        primed: true,
        active: null,
        pendingPermissions: new Map(),
        translator: null,
        extra,
      });
    }
    return {} as LoadSessionResponse;
  }

  // ── listSessions ──────────────────────────────────────

  async listSessions(opts: {
    cwd?: string;
    cursor?: string | null;
  }): Promise<ListSessionsResponse> {
    if (this.spec.listSessions) {
      return this.spec.listSessions({ ...opts, ctx: this.ctx });
    }
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

  /** Hook server hands events to this method; we delegate to the spec
   *  which in turn uses the escalator for permission round-trips. */
  private async handleHook(
    sessionId: string,
    event: HookEvent,
  ): Promise<HookResponse> {
    const state = this.sessions.get(sessionId);
    if (!state) return { status: 404, body: { error: "no-such-session" } };
    if (!this.spec.handleHook) return { status: 200 };

    const escalator: PermissionEscalator = {
      request: async ({ toolUseId, toolName, toolInput }) => {
        const permissionId = randomUUID();
        const request: RequestPermissionRequest = {
          sessionId,
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

        const decision = new Promise<RequestPermissionResponse>((resolve) => {
          state.pendingPermissions.set(permissionId, resolve);
        });
        this.ctx.emit.onPermissionRequest(this.agentId, permissionId, request);
        return mapPermissionResponse(await decision);
      },
    };

    return this.spec.handleHook({ state, event, escalator });
  }

  /** Wire the hook server to this adapter. Spec implementations that
   *  need hooks call this from `initSessionExtra` after computing the
   *  session config dir and before installing the hook config. */
  protected registerHookSession(
    sessionId: string,
  ): { token: string; url: string } {
    const { token } = this.ctx.hookServer.registerSession(
      sessionId,
      (event) => this.handleHook(sessionId, event),
    );
    return { token, url: this.ctx.hookServer.url };
  }

  // ── dispose ───────────────────────────────────────────

  async dispose(): Promise<void> {
    const shutdowns: Array<Promise<unknown>> = [];
    for (const state of this.sessions.values()) {
      if (state.active) {
        shutdowns.push(state.active.kill("SIGTERM").catch(() => {}));
      }
      for (const resolver of state.pendingPermissions.values()) {
        resolver({
          outcome: { outcome: "cancelled" },
        } as never);
      }
      state.pendingPermissions.clear();
      this.ctx.hookServer.unregisterSession(state.sessionId);
      if (this.spec.disposeSessionExtra) {
        shutdowns.push(
          this.spec.disposeSessionExtra({
            sessionId: state.sessionId,
            ctx: this.ctx,
            extra: state.extra,
          }).catch(() => {}),
        );
      }
      shutdowns.push(removeSessionDir(state.sessionId).catch(() => {}));
    }
    this.sessions.clear();
    await Promise.all(shutdowns);
  }

  // ── internals ─────────────────────────────────────────

  private mustState(sessionId: string): SessionState<Extra> {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new AgentFailureError({
        kind: "protocol-error",
        message: `unknown session: ${sessionId}`,
        stage: "prompt",
        agentId: this.agentId,
      });
    }
    return state;
  }

  /** Per-agent specs that need a session config dir (Claude, Droid)
   *  call this from `initSessionExtra` to get a stable, isolated path
   *  under ~/.zeros/sessions/<id>/env/<agent>/. The dir is created.
   *  Returns the path. */
  protected async makeSessionConfigDir(
    sessionId: string,
    subdir: string,
  ): Promise<string> {
    const dirs = await ensureSessionDir(sessionId);
    const configDir = path.join(dirs.env, subdir);
    await fsp.mkdir(configDir, { recursive: true });
    return configDir;
  }
}

// ── Helpers ──────────────────────────────────────────────

/** Pattern an agent uses to tell the user it's not signed in.
 *  Matches Claude's "Not logged in · Please run /login", Codex's
 *  similar phrasing, and Cursor / Amp variants. We're conservative —
 *  the bare `run /login` alternative was removed because agents
 *  routinely *explain* the login flow inside chats and we'd flip the
 *  green dot to gray on a benign sentence. */
const AUTH_HINT_RX =
  /\b(not\s+(?:logged|signed)\s*in|please\s+run\s*\/?login|sign[- ]in\s+required|api\s*key\s+(?:not|required|invalid))\b/i;

/** Cap on chunk text we'll classify. Real auth complaints are short
 *  one-liners; a long explanatory paragraph that happens to mention
 *  signing in is almost certainly the agent answering a question. */
const AUTH_HINT_MAX_LEN = 200;

function containsAuthHint(notification: SessionNotification): boolean {
  const update = notification.update as {
    sessionUpdate?: string;
    content?: { type?: string; text?: string };
  };
  // Only the agent's own chunks. user_message_chunk is the user's
  // input echo — matching there would let users trigger a fake
  // auth-required by typing "I'm not logged in" into the composer.
  if (update.sessionUpdate !== "agent_message_chunk") return false;
  const text = update.content?.text;
  if (typeof text !== "string") return false;
  if (text.length > AUTH_HINT_MAX_LEN) return false;
  return AUTH_HINT_RX.test(text);
}

function defaultFormatPromptText(blocks: ContentBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    const block = b as unknown as {
      type?: string;
      text?: string;
      uri?: string;
      source?: { type?: string; media_type?: string; data?: string; url?: string };
      mimeType?: string;
      data?: string;
    };
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
      continue;
    }
    if (block.type === "image") {
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
      parts.push(`@${block.uri.replace(/^file:\/\//, "")}`);
      continue;
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
