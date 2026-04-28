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
import { OpencodeBusTranslator } from "./translator";

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
  /** AbortController for the SSE bus subscription. Stored on the
   *  session so dispose() can cancel an in-flight stream. */
  busAbort: AbortController | null;
  /** Bus translator instance for this session. Lives across turns
   *  so coalesced messageIds (`oc-<partID>`) stay consistent. */
  translator: OpencodeBusTranslator | null;
  /** Pending OpenCode permission requests indexed by Zeros
   *  permissionId (which we mint per request). The stored callId is
   *  the OpenCode-side identifier we POST against. */
  pendingPermissions: Map<string, { opencodePermissionId: string }>;
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
      translator: null,
      pendingPermissions: new Map(),
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
      translator: null,
      pendingPermissions: new Map(),
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

    if (!state.runtime || !state.client || !state.opencodeSessionId) {
      await this.bootSession(state);
    }

    state.pendingTurn = { abort: new AbortController() };
    try {
      // Convert ContentBlock[] → OpenCode `parts` array. We currently
      // forward only text blocks; image/audio/embedded support lands
      // when the canonical content taxonomy gains those shapes.
      const parts: Array<{ type: "text"; text: string }> = [];
      for (const b of opts.prompt) {
        const block = b as unknown as { type?: string; text?: string };
        if (block.type === "text" && typeof block.text === "string") {
          parts.push({ type: "text", text: block.text });
        }
      }
      if (parts.length === 0) {
        return {
          stopReason: "end_turn" as StopReason,
          response: {} as PromptResponse,
        };
      }

      // Resolve the active model selection. The composer's model
      // pill writes the chosen value to state.env.OPENCODE_MODEL
      // (per the modelEnvVars entry in catalogs/models-v1.json).
      // Format is `providerID/modelID`, where modelID may itself
      // contain a slash for nested namespaces (e.g.
      // `openrouter/moonshot/kimi-k2` = providerID `openrouter`,
      // modelID `moonshot/kimi-k2`). Split on the FIRST slash.
      const modelSelector = state.env?.OPENCODE_MODEL ?? null;
      let providerID: string | undefined;
      let modelID: string | undefined;
      if (modelSelector) {
        const idx = modelSelector.indexOf("/");
        if (idx > 0) {
          providerID = modelSelector.slice(0, idx);
          modelID = modelSelector.slice(idx + 1);
        }
      }

      // promptAsync returns immediately and the bus delivers the
      // streaming reply. We've already subscribed to the bus in
      // bootSession, so the translator picks up everything from
      // here.
      await state.client!.session.prompt({
        path: { id: state.opencodeSessionId! },
        body: {
          parts,
          ...(providerID && modelID
            ? { providerID, modelID }
            : {}),
        } as never,
      } as never);

      // Wait for the translator to see a session.idle / status:idle.
      await this.waitForTurnEnd(state);

      return {
        stopReason: "end_turn" as StopReason,
        response: {} as PromptResponse,
      };
    } finally {
      state.pendingTurn = null;
    }
  }

  /** Block until the bus translator marks the turn as terminal. The
   *  bus subscription is already running in the background; this is
   *  a polling wait. Slice 3 may add an explicit completion future. */
  private async waitForTurnEnd(state: OpencodeSessionState): Promise<void> {
    const abort = state.pendingTurn?.abort.signal;
    const start = Date.now();
    const HARD_CAP_MS = 5 * 60 * 1000; // 5min — safety net
    while (!state.translator?.sawTerminal) {
      if (abort?.aborted) return;
      if (Date.now() - start > HARD_CAP_MS) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    // Reset for the next turn — sawTerminal is sticky so we'd flush
    // through subsequent prompts otherwise. Translator state stays
    // (partID dedup, toolCallId map) so coalescing still works.
    (state.translator as unknown as { hasSeenTerminal: boolean }).hasSeenTerminal = false;
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

  respondToPermission(opts: {
    permissionId: string;
    response: RequestPermissionResponse;
  }): void {
    // Locate the session that minted this permissionId. We linear-
    // scan rather than maintain a global pendingPermissions map
    // because permission events are per-session and the count is
    // small (usually 1 in flight per session).
    let owner: OpencodeSessionState | null = null;
    let pending: { opencodePermissionId: string } | null = null;
    for (const state of this.sessions.values()) {
      const p = state.pendingPermissions.get(opts.permissionId);
      if (p) {
        owner = state;
        pending = p;
        break;
      }
    }
    if (!owner || !pending) return;

    // Map Zeros's outcome shape onto OpenCode's
    // `"once" | "always" | "reject"`.
    const outcome = opts.response.outcome;
    let response: "once" | "always" | "reject" = "reject";
    if (outcome.outcome === "selected") {
      const oid = outcome.optionId;
      if (oid === "allow_once") response = "once";
      else if (oid === "allow_always") response = "always";
      else response = "reject"; // reject_once / reject_always
    }
    // outcome=cancelled → reject (the user dismissed the prompt).

    owner.pendingPermissions.delete(opts.permissionId);

    // Fire-and-forget POST. If the server is gone the bus will
    // surface that separately; we don't want respondToPermission
    // to be async because it's called from synchronous UI handlers.
    void this.postPermissionReply(
      owner,
      pending.opencodePermissionId,
      response,
    );
  }

  private async postPermissionReply(
    state: OpencodeSessionState,
    opencodePermissionId: string,
    response: "once" | "always" | "reject",
  ): Promise<void> {
    if (!state.client || !state.opencodeSessionId) return;
    try {
      await state.client.postSessionIdPermissionsPermissionId({
        path: {
          id: state.opencodeSessionId,
          permissionID: opencodePermissionId,
        },
        body: { response },
      } as never);
    } catch (err) {
      this.ctx.emit.onAgentStderr(
        AGENT_ID,
        `[opencode] permission reply failed: ${String(err)}`,
      );
    }
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

    // Build the translator + start the SSE bus drain. The bus
    // subscription is per-session (a single GET /event per server)
    // and lives until dispose(). Events for OTHER opencode sessions
    // on the same server arrive too — we filter by sessionID.
    const translator = new OpencodeBusTranslator({
      sessionId: state.sessionId,
      emit: (n) => this.ctx.emit.onSessionUpdate(AGENT_ID, n),
      onUnknown: () => { /* ignored — most "unknown"s are bus chrome */ },
      onPermission: (props) => this.onPermissionAsked(state, props),
    });
    state.translator = translator;
    state.busAbort = new AbortController();
    void this.drainBus(state, translator, state.busAbort.signal);

    // Slice 3 — design-tools MCP injection. Only attempts when
    // `ctx.zerosMcpUrl` is wired through; we don't have that pipe
    // today (the engine doesn't yet expose its MCP URL to adapters).
    // Stub the call as a no-op until the URL plumbing lands; when
    // it does, this turns into a single client.mcp.add() call.
    await this.maybeInjectDesignToolsMcp(state);
  }

  /** Translate an OpenCode permission.asked into the canonical
   *  permission_request event. The inline permission cluster (Stage
   *  6.x) consumes this and offers Allow / Deny / Always-for-X
   *  buttons. The user's choice flows back through respondToPermission. */
  private onPermissionAsked(
    state: OpencodeSessionState,
    props: {
      id: string;
      permission: string;
      patterns?: string[];
      metadata?: Record<string, unknown>;
      always?: string[];
      tool?: { messageID?: string; callID?: string };
    },
  ): void {
    const callId = props.tool?.callID ?? null;
    const snapshot = callId
      ? state.translator?.toolCallForCallId(callId) ?? null
      : null;

    // The canonical permission_request needs a ToolCall reference.
    // If we don't have a snapshot (rare — permission arrived before
    // any tool started, or callID was missing), synthesize a stub
    // ToolCall whose card the inline cluster will still attach
    // under via toolCallId match.
    const toolCallId = snapshot?.toolCallId ?? randomUUID();
    const toolCall = {
      toolCallId,
      title: snapshot?.title ?? `Permission: ${props.permission}`,
      kind: (snapshot?.kind ?? "other") as never,
      status: "pending" as never,
    };

    // OpenCode's three response kinds map onto our four canonical
    // PermissionOptionKinds. We surface all four to the UI so the
    // "always for X" flow has a button; the responder maps both
    // reject_* → "reject".
    const options = [
      { optionId: "allow_once", name: "Allow", kind: "allow_once" as const },
      {
        optionId: "allow_always",
        name: "Always allow",
        kind: "allow_always" as const,
      },
      { optionId: "reject_once", name: "Deny", kind: "reject_once" as const },
    ];

    // Mint a Zeros-side permission id and remember the OpenCode
    // counterpart so respondToPermission can POST to the right
    // endpoint. Zeros-side ids stay opaque to the UI.
    const zerosPermissionId = randomUUID();
    state.pendingPermissions.set(zerosPermissionId, {
      opencodePermissionId: props.id,
    });

    this.ctx.emit.onPermissionRequest(AGENT_ID, zerosPermissionId, {
      sessionId: state.sessionId as never,
      toolCall: toolCall as never,
      options: options as never,
    } as never);
  }

  /** §2.10.4 — inject every MCP server registered on the gateway
   *  (today: just `Zeros` with its design-tools endpoint) into the
   *  fresh OpenCode session via POST /mcp. Without this, OpenCode
   *  runs with an empty MCP set because we set OPENCODE_CONFIG_CONTENT
   *  to "{}" at boot — neutering the user's `~/.config/opencode/
   *  opencode.json` also drops their MCP entries, so we have to
   *  re-add ours dynamically. Per-server failures are logged but
   *  don't abort session boot — a working OpenCode session without
   *  Zeros tools beats a failed boot. */
  private async maybeInjectDesignToolsMcp(
    state: OpencodeSessionState,
  ): Promise<void> {
    if (!state.client) return;
    for (const server of this.ctx.mcpServers) {
      try {
        await state.client.mcp.add({
          body: {
            name: server.name,
            config: { type: "remote", url: server.url },
          },
        } as never);
      } catch (err) {
        this.ctx.emit.onAgentStderr(
          AGENT_ID,
          `[opencode] mcp.add(${server.name}) failed: ${String(err)}`,
        );
      }
    }
  }

  /** Long-lived SSE drain. Runs until the AbortController is fired
   *  (dispose) or the connection closes (server died). Filters bus
   *  events to this session's id; cross-session events on the same
   *  server are ignored. */
  private async drainBus(
    state: OpencodeSessionState,
    translator: OpencodeBusTranslator,
    signal: AbortSignal,
  ): Promise<void> {
    if (!state.runtime) return;
    const url = `${state.runtime.baseUrl}/event`;
    const auth = `Basic ${Buffer.from(`opencode:${state.runtime.password}`).toString("base64")}`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: auth, Accept: "text/event-stream" },
        signal,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        if (signal.aborted) break;
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl = buf.indexOf("\n");
        while (nl !== -1) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.startsWith("data: ")) {
            const json = line.slice(6).trim();
            if (json) {
              try {
                const event = JSON.parse(json) as Record<string, unknown>;
                // Filter to this session's events. Cross-session
                // bus events on the same server (rare today since
                // each adapter spawns its own server, but safe in
                // case we ever share servers) are dropped.
                const props = (event as { properties?: Record<string, unknown> }).properties;
                const sid = props && typeof props.sessionID === "string"
                  ? props.sessionID
                  : null;
                if (sid && sid !== state.opencodeSessionId) {
                  // Different session — skip.
                } else {
                  translator.feed(event);
                }
              } catch {
                /* malformed line — ignore */
              }
            }
          }
          nl = buf.indexOf("\n");
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      this.ctx.emit.onAgentStderr(
        AGENT_ID,
        `[opencode] bus drain error: ${String(err)}`,
      );
    }
  }
}

export function createOpencodeAdapter(
  ctx: AgentAdapterContext,
): AgentAdapter {
  return new OpencodeAdapter(ctx);
}
