// ──────────────────────────────────────────────────────────
// GitHub Copilot CLI adapter (PTY transport)
// ──────────────────────────────────────────────────────────
//
// Copilot CLI has no stream-json output — it's a TUI. We run it in a
// pseudo-terminal and drive it by writing the user's prompt to stdin
// and reading the response from stdout.
//
// Turn boundary detection:
//   - The PTY is long-lived per session (unlike Claude/Codex which
//     spawn one subprocess per turn).
//   - We flush any pending buffer, write the user prompt + Enter,
//     then accumulate output until we see the shell-like prompt
//     cursor return ("> " or "❯ " at column 0 following a newline) —
//     that's Copilot's ready-for-input state.
//   - Fallback: 60s idle timeout (no output for 2s after activity +
//     total cap of 60s) to avoid hanging forever on malformed UI
//     states.
//
// HTTP hooks:
//   Copilot CLI posts sessionStart / preToolUse / postToolUse /
//   userPromptSubmitted / sessionEnd / errorOccurred to the URL in
//   its config. We run a session-scoped COPILOT_HOME pointing at our
//   session-state dir, write hooks config there, and register a
//   handler with the shared hook server. preToolUse is the permission
//   gate; other events inform UI state. If Copilot's config filename
//   or env var differs in a given CLI version, hooks silently no-op
//   and we fall back to pure PTY turn-detection (still functional).
//
// Per-newline streaming:
//   Instead of emitting one big agent_message_chunk at turn end, we
//   emit a chunk every time a newline-terminated line lands in the
//   PTY output buffer — the user sees Copilot type as it types.
//
// Auth: system credential store primary, `~/.copilot/config.json`
//   fallback. Probed existence-only.
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
import { TERMINAL_AUTH_METHOD } from "../base";
import { stripAnsi } from "./ansi";
import { installCopilotHooks } from "./hooks";

const AGENT_ID = "github-copilot-cli";
const AGENT_NAME = "GitHub Copilot CLI";
const PROTOCOL_VERSION = 1;

// Copilot's ready-for-input prompt. "❯" is its default glyph; "> "
// is the fallback on terminals without powerline support. Match at
// the start of a line after a newline so we don't false-trigger on
// the same characters mid-output.
const PROMPT_CURSOR = /(?:^|\r?\n)[\s]*(?:❯|>)\s*$/u;

const IDLE_TIMEOUT_MS = 2000;
const TURN_CAP_MS = 60_000;

interface CopilotSessionState {
  sessionId: string;
  cwd: string;
  env?: Record<string, string>;
  /** Session-scoped COPILOT_HOME — contains our hooks config. */
  copilotHome: string;
  /** Hook-server token for this session. */
  hookToken: string;
  pty: IPty | null;
  /** Accumulates PTY output between prompts. Reset at each prompt. */
  buffer: string;
  /** Text emitted to the UI for the current turn (prefix of `buffer`
   *  minus the most recent partial line). Used to diff deltas. */
  emittedLen: number;
  /** Stable message id for the current turn so chunks merge. */
  turnMessageId: string | null;
  /** Resolved when the next turn's output completes. */
  pendingTurn: {
    resolve: (text: string) => void;
    reject: (err: Error) => void;
    idleTimer: NodeJS.Timeout | null;
    capTimer: NodeJS.Timeout | null;
  } | null;
  /** Permission-decision handlers keyed by permissionId. */
  pendingPermissions: Map<string, (r: RequestPermissionResponse) => void>;
}

export class CopilotAdapter implements AgentAdapter {
  readonly agentId = AGENT_ID;

  private readonly ctx: AgentAdapterContext;
  private readonly sessions = new Map<string, CopilotSessionState>();
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
    const copilotHome = path.join(dirs.env, "copilot");
    await fsp.mkdir(copilotHome, { recursive: true });

    const { token } = this.ctx.hookServer.registerSession(
      sessionId,
      (event) => this.handleHook(sessionId, event),
    );
    await installCopilotHooks({
      configDir: copilotHome,
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
      copilotHome,
      hookToken: token,
      pty: null,
      buffer: "",
      emittedLen: 0,
      turnMessageId: null,
      pendingTurn: null,
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
      if (!state.pty) {
        await this.spawnPty(state);
      }

      const promptText = contentBlocksToText(opts.prompt);
      state.buffer = "";
      state.emittedLen = 0;
      state.turnMessageId = randomUUID();

      // Write the prompt followed by Enter. Copilot reads line-buffered
      // TTY input, so a single CR is enough; CRLF may cause a stray
      // blank prompt on Windows PTYs but is harmless on macOS.
      state.pty!.write(promptText + "\r");

      // The turn promise resolves when the prompt cursor reappears or
      // an idle/cap timer fires. We don't need the text it resolves
      // with — streaming already emitted the content in emitDelta.
      await this.collectTurn(state);

      // Flush any final delta the streaming layer didn't hand off
      // yet (last line without a trailing newline).
      this.emitDelta(state, /* finalFlush */ true);

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

    // Ctrl-C into the PTY cancels the current Copilot turn without
    // closing the session. If no turn is active, it's a no-op in the
    // agent's own shell loop.
    if (state.pty) {
      state.pty.write("\x03");
    }

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
      const copilotHome = path.join(dirs.env, "copilot");
      await fsp.mkdir(copilotHome, { recursive: true });
      const { token } = this.ctx.hookServer.registerSession(
        opts.sessionId,
        (event) => this.handleHook(opts.sessionId, event),
      );
      await installCopilotHooks({
        configDir: copilotHome,
        hookUrl: this.ctx.hookServer.url,
        token,
        sessionId: opts.sessionId,
      });
      this.sessions.set(opts.sessionId, {
        sessionId: opts.sessionId,
        cwd: opts.cwd,
        env: opts.env,
        copilotHome,
        hookToken: token,
        pty: null,
        buffer: "",
        emittedLen: 0,
        turnMessageId: null,
        pendingTurn: null,
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
    if (!state) return { status: 404 };
    if (event.name === "preToolUse") {
      const decision = await this.escalatePermission(state, event);
      return {
        status: 200,
        // Copilot's hook-response schema accepts only
        // {"permissionDecision":"deny"} to block; allow is implicit.
        body: decision === "deny" ? { permissionDecision: "deny" } : {},
      };
    }
    return { status: 200 };
  }

  private async escalatePermission(
    state: CopilotSessionState,
    event: HookEvent,
  ): Promise<"allow" | "deny"> {
    const payload = event.payload as Record<string, unknown> | null;
    const toolName = typeof payload?.toolName === "string"
      ? (payload.toolName as string)
      : "tool";
    const toolInput = payload?.toolArgs ?? payload?.tool_input;

    const permissionId = randomUUID();
    const request: RequestPermissionRequest = {
      sessionId: state.sessionId,
      toolCall: {
        toolCallId: randomUUID(),
        title: `Allow ${toolName}?`,
        kind: "other",
        rawInput: toolInput,
        status: "pending",
      },
      options: [
        { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
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
    for (const state of this.sessions.values()) {
      if (state.pendingTurn) {
        const { reject, idleTimer, capTimer } = state.pendingTurn;
        if (idleTimer) clearTimeout(idleTimer);
        if (capTimer) clearTimeout(capTimer);
        state.pendingTurn = null;
        try { reject(new Error("adapter disposing")); } catch {}
      }
      for (const resolver of state.pendingPermissions.values()) {
        resolver({ outcome: { outcome: "cancelled" } } as never);
      }
      state.pendingPermissions.clear();
      this.ctx.hookServer.unregisterSession(state.sessionId);
      if (state.pty) {
        try { state.pty.kill(); } catch {}
        state.pty = null;
      }
      void removeSessionDir(state.sessionId).catch(() => {});
    }
    this.sessions.clear();
  }

  // ── internals ─────────────────────────────────────────

  private async spawnPty(state: CopilotSessionState): Promise<void> {
    // node-pty is loaded lazily so that non-PTY adapters don't pull
    // the native binding into the engine's startup.
    const nodePty = (await import("node-pty")) as typeof import("node-pty");
    const pty = nodePty.spawn("copilot", [], {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: state.cwd,
      env: {
        ...(process.env as Record<string, string>),
        ...(state.env ?? {}),
        // Session-scoped config dir so our hook file is the only one
        // Copilot finds. macOS Keychain (primary auth store) is not
        // relocated by COPILOT_HOME so login state is preserved.
        COPILOT_HOME: state.copilotHome,
      } as Record<string, string>,
    });

    pty.onData((data) => {
      state.buffer += data;

      if (state.pendingTurn) {
        const p = state.pendingTurn;
        if (p.idleTimer) clearTimeout(p.idleTimer);
        p.idleTimer = setTimeout(() => this.completeTurn(state, "idle"), IDLE_TIMEOUT_MS);

        // Per-newline streaming: emit each complete line as soon as
        // it's in the buffer so the UI shows Copilot's output
        // incrementally instead of waiting for turn end.
        this.emitDelta(state, /* finalFlush */ false);

        if (PROMPT_CURSOR.test(state.buffer)) {
          this.completeTurn(state, "prompt");
        }
      }
    });

    pty.onExit(({ exitCode, signal }) => {
      // node-pty reports `signal` as a numeric code (or undefined);
      // our event bus wants `string | null` for wire-compat with the
      // ACP backend. Coerce so broadcast payloads serialize cleanly.
      const sigStr = signal != null ? String(signal) : null;
      this.ctx.emit.onAgentExit(AGENT_ID, exitCode ?? null, sigStr);
      state.pty = null;
      if (state.pendingTurn) {
        const { reject, idleTimer, capTimer } = state.pendingTurn;
        if (idleTimer) clearTimeout(idleTimer);
        if (capTimer) clearTimeout(capTimer);
        state.pendingTurn = null;
        try {
          reject(new Error(`copilot exited code=${exitCode} signal=${signal ?? "null"}`));
        } catch {}
      }
    });

    state.pty = pty;
    // Override env going forward: when we respawn (session load or
    // crash recovery), honor the new COPILOT_HOME. Stored on state
    // for reference; the actual env is passed to nodePty.spawn().
    void state.copilotHome;

    // Wait briefly for Copilot to draw its initial prompt so the
    // first user-turn doesn't race against startup banners. Bounded:
    // if nothing appears in 5s we proceed anyway.
    await new Promise<void>((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; resolve(); }
      }, 5000);
      const check = () => {
        if (done) return;
        if (PROMPT_CURSOR.test(state.buffer)) {
          done = true;
          clearTimeout(timer);
          resolve();
        }
      };
      const id = setInterval(check, 100);
      setTimeout(() => clearInterval(id), 5000);
    });
    state.buffer = ""; // discard startup banner
  }

  private collectTurn(state: CopilotSessionState): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const turn = {
        resolve,
        reject,
        idleTimer: setTimeout(
          () => this.completeTurn(state, "idle"),
          IDLE_TIMEOUT_MS,
        ),
        capTimer: setTimeout(
          () => this.completeTurn(state, "cap"),
          TURN_CAP_MS,
        ),
      };
      state.pendingTurn = turn;
    });
  }

  private completeTurn(
    state: CopilotSessionState,
    _reason: "prompt" | "idle" | "cap",
  ): void {
    const turn = state.pendingTurn;
    if (!turn) return;
    if (turn.idleTimer) clearTimeout(turn.idleTimer);
    if (turn.capTimer) clearTimeout(turn.capTimer);
    state.pendingTurn = null;

    // Trim the trailing prompt-cursor from the captured text so the
    // UI doesn't see "...response here\n❯".
    const text = state.buffer.replace(PROMPT_CURSOR, "");
    state.buffer = "";
    turn.resolve(text);
  }

  /** Emit a streaming delta for the current turn. When finalFlush is
   *  true we emit everything not yet emitted (including any trailing
   *  partial line); otherwise we hold back the last partial line so
   *  we don't send half a token. */
  private emitDelta(state: CopilotSessionState, finalFlush: boolean): void {
    if (!state.turnMessageId) return;
    let commitUpTo: number;
    if (finalFlush) {
      commitUpTo = state.buffer.length;
    } else {
      const lastNl = state.buffer.lastIndexOf("\n");
      if (lastNl < state.emittedLen) return; // no new complete line
      commitUpTo = lastNl + 1;
    }
    if (commitUpTo <= state.emittedLen) return;
    const raw = state.buffer.slice(state.emittedLen, commitUpTo);
    state.emittedLen = commitUpTo;
    const clean = stripAnsi(raw);
    // Drop lines that are just the prompt glyph reappearing — that's
    // turn-end signal, not assistant content.
    const trimmed = clean.replace(PROMPT_CURSOR, "").trim();
    if (!trimmed) return;
    this.ctx.emit.onSessionUpdate(AGENT_ID, {
      sessionId: state.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: clean } as ContentBlock,
        messageId: state.turnMessageId,
      },
    } satisfies SessionNotification);
  }

  private mustState(sessionId: string): CopilotSessionState {
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
): "allow" | "deny" {
  const outcome = (response as unknown as {
    outcome?: { outcome?: string; optionId?: string };
  }).outcome;
  if (!outcome || outcome.outcome === "cancelled") return "deny";
  if (outcome.outcome === "selected") {
    const opt = outcome.optionId ?? "";
    if (opt === "allow_once" || opt === "allow_always") return "allow";
  }
  return "deny";
}

export function createCopilotAdapter(ctx: AgentAdapterContext): AgentAdapter {
  return new CopilotAdapter(ctx);
}
