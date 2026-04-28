// ──────────────────────────────────────────────────────────
// OpenCode adapter — server-attached
// ──────────────────────────────────────────────────────────
//
// Stage 8.5 Slice 1: foundation.
//
// Each Zeros session owns one long-lived `opencode serve` child
// (managed by OpencodeRuntime) plus an SDK client attached to it.
// Slice 1 wires the lifecycle (newSession boots a server +
// creates an OpenCode session; dispose tears them down) and stubs
// out prompt + event subscription with helpful "wiring in
// progress" responses. Slice 2 will add the SSE bus subscription
// + canonical-event translator.
//
// Why bespoke (not StreamJsonAdapter): every other adapter is a
// per-prompt subprocess streaming NDJSON to stdout. OpenCode is
// a long-lived HTTP+SSE server; the lifecycle, transport, and
// session model are different enough that wrapping it in
// StreamJsonAdapter would add more friction than reuse.
// ──────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";

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
import { ensureSessionDir, writeSessionMeta } from "../../session-paths";
import { TERMINAL_AUTH_METHOD } from "../base";
import {
  startOpencodeRuntime,
  type OpencodeRuntimeHandle,
} from "./runtime";

// SDK imports kept narrow on purpose — anything we use must work
// against the v1.14 SDK. v2 is a parallel surface; we'll evaluate
// migrating in a follow-up once Slice 2 is verified.
import {
  createOpencodeClient,
  type OpencodeClient,
} from "@opencode-ai/sdk";

const AGENT_ID = "opencode";
const AGENT_NAME = "OpenCode";
const PROTOCOL_VERSION = 1;

interface OpencodeSessionState {
  sessionId: string;
  cwd: string;
  env?: Record<string, string>;
  /** OpenCode-side session id from `client.session.create()`. */
  opencodeSessionId: string | null;
  runtime: OpencodeRuntimeHandle | null;
  client: OpencodeClient | null;
  /** AbortController for the SSE bus subscription (Slice 2). Stored
   *  on the session so dispose() can cancel an in-flight stream. */
  busAbort: AbortController | null;
  /** Currently-in-flight prompt — null when idle. */
  pendingTurn: {
    abort: AbortController;
  } | null;
}

export class OpencodeAdapter implements AgentAdapter {
  readonly agentId = AGENT_ID;

  private readonly ctx: AgentAdapterContext;
  private readonly sessions = new Map<string, OpencodeSessionState>();
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
        // OpenCode supports MCP via POST /mcp; flagging http as the
        // injection capability the design-tools loader can use.
        // (The loader is wired in Slice 3.)
        mcpCapabilities: { http: true, sse: false } as never,
        sessionCapabilities: { list: {} } as never,
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

    await ensureSessionDir(sessionId);
    await writeSessionMeta(sessionId, {
      agentId: AGENT_ID,
      cwd: opts.cwd,
      createdAt: Date.now(),
    });

    const state: OpencodeSessionState = {
      sessionId,
      cwd: opts.cwd,
      env: opts.env,
      opencodeSessionId: null,
      runtime: null,
      client: null,
      busAbort: null,
      pendingTurn: null,
    };
    this.sessions.set(sessionId, state);

    // Server boot deferred to first prompt — keeps `newSession()`
    // fast (the chat UI shows a session before the user has typed
    // anything). Same posture as our other lazy-boot adapters.

    const session: NewSessionResponse = {
      sessionId,
      modes: {
        currentModeId: "default",
        availableModes: [
          { modeId: "default", name: "Default" },
          { modeId: "plan", name: "Plan" },
        ],
      } as never,
    } as never;
    return { session, initialize };
  }

  async loadSession(opts: {
    sessionId: string;
    cwd: string;
    env?: Record<string, string>;
  }): Promise<LoadSessionResponse> {
    // Resume path mirrors newSession — boot deferred to first
    // prompt; OpenCode session id flows in via opts but isn't
    // consumed until Slice 2 wires `client.session.get()` to
    // hydrate the prior turns into the chat.
    const state: OpencodeSessionState = {
      sessionId: opts.sessionId,
      cwd: opts.cwd,
      env: opts.env,
      opencodeSessionId: opts.sessionId,
      runtime: null,
      client: null,
      busAbort: null,
      pendingTurn: null,
    };
    this.sessions.set(opts.sessionId, state);
    return {} as LoadSessionResponse;
  }

  async listSessions(): Promise<ListSessionsResponse> {
    // Resumable sessions live in the OpenCode server's SQLite
    // (`~/.local/share/opencode/opencode.db`). Surfacing the list
    // requires a transient server boot purely for `client.session.list()`,
    // which is wasteful for a cold-start UI query. Slice 3 will add
    // a lightweight session-listing path; Slice 1 returns empty so
    // the chat list works without listing prior OpenCode sessions.
    return { sessions: [] } as never;
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

    // Lazy-boot the runtime + SDK client + OpenCode session on
    // first prompt.
    if (!state.runtime || !state.client) {
      await this.bootSession(state);
    }

    state.pendingTurn = { abort: new AbortController() };
    try {
      // Slice 1 stub: surface a clear message in chat instead of
      // silently discarding the prompt. Slice 2 will replace this
      // with `client.session.promptAsync()` + SSE bus subscription
      // feeding the canonical translator.
      this.ctx.emit.onSessionUpdate(AGENT_ID, {
        sessionId: state.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text:
              "OpenCode runtime is connected (Slice 8.5.1). Event translation lands in 8.5.2 — your prompt was received but no model call was issued.",
          } as ContentBlock,
          messageId: randomUUID(),
        },
      });

      return {
        stopReason: "end_turn" as StopReason,
        response: {} as PromptResponse,
      };
    } finally {
      state.pendingTurn = null;
    }
  }

  async cancel(opts: { sessionId: string }): Promise<void> {
    const state = this.sessions.get(opts.sessionId);
    if (!state) return;
    state.pendingTurn?.abort.abort();
    if (state.client && state.opencodeSessionId) {
      try {
        await state.client.session.abort({
          path: { id: state.opencodeSessionId },
        } as never);
      } catch {
        /* server may have died; ignore */
      }
    }
  }

  respondToPermission(_opts: {
    permissionId: string;
    response: RequestPermissionResponse;
  }): void {
    // Permission flow lands in Slice 3 — POST /permission/reply via
    // the SDK's permission.respond() method. Slice 1 has no
    // permission requests in flight (no model calls happen yet) so
    // this is a no-op stub.
  }

  async dispose(): Promise<void> {
    for (const state of this.sessions.values()) {
      state.pendingTurn?.abort.abort();
      state.busAbort?.abort();
      if (state.runtime) {
        try {
          await state.runtime.dispose();
        } catch {
          /* best-effort */
        }
      }
    }
    this.sessions.clear();
  }

  // ── internals ─────────────────────────────────────────────

  private mustState(sessionId: string): OpencodeSessionState {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new AgentFailureError({
        kind: "protocol-error",
        message: `unknown session id: ${sessionId}`,
        stage: "prompt",
        agentId: AGENT_ID,
      });
    }
    return state;
  }

  private async bootSession(state: OpencodeSessionState): Promise<void> {
    const runtime = await startOpencodeRuntime({
      cwd: state.cwd,
      env: state.env,
      onStderr: (line) =>
        this.ctx.emit.onAgentStderr(AGENT_ID, line),
      onExit: (code, signal) => {
        // If the server dies unexpectedly, drop the session's
        // pointers so the next prompt re-boots a fresh runtime.
        state.runtime = null;
        state.client = null;
        state.busAbort?.abort();
        state.busAbort = null;
        if (code !== 0 || signal) {
          this.ctx.emit.onAgentStderr(
            AGENT_ID,
            `[opencode] server exited unexpectedly (code=${code} signal=${signal ?? ""})`,
          );
        }
      },
    });

    const client = createOpencodeClient({
      baseUrl: runtime.baseUrl,
      auth: () =>
        // Basic auth header — OpenCode's serve mode rejects
        // requests without it when OPENCODE_SERVER_PASSWORD is
        // set (which our runtime always sets). Without auth the
        // client is forbidden from issuing session/prompt calls.
        `Basic ${Buffer.from(`opencode:${runtime.password}`).toString("base64")}`,
    } as never);

    state.runtime = runtime;
    state.client = client;

    // Create OpenCode session if we don't already have one (resume
    // path skips this — opencodeSessionId came from loadSession).
    if (!state.opencodeSessionId) {
      const created = await client.session.create({
        body: {} as never,
      } as never);
      const id =
        (created as unknown as { data?: { id?: string } }).data?.id ?? null;
      state.opencodeSessionId = id;
    }

    // SSE bus subscription wires up here in Slice 2.
  }
}

export function createOpencodeAdapter(
  ctx: AgentAdapterContext,
): AgentAdapter {
  return new OpencodeAdapter(ctx);
}
