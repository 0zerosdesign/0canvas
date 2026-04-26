// ──────────────────────────────────────────────────────────
// AgentGateway — orchestrator for per-agent adapters
// ──────────────────────────────────────────────────────────
//
// Native agent gateway. Exposes the same public surface the engine
// entry point (src/engine/index.ts) already uses:
//
//   new AgentGateway({ projectRoot, events, fs })
//   gateway.registerMcpServer({ name, url })
//   gateway.refreshRegistry() / gateway.listAgents()
//   gateway.initializeAgent(agentId)
//   gateway.ensureAgent(agentId, { env })
//   gateway.authenticate(agentId, methodId)
//   gateway.newSession(agentId, { cwd, env })
//   gateway.loadSession(agentId, sessionId, { cwd, env })
//   gateway.listSessions(agentId, { cwd, cursor })
//   gateway.prompt(agentId, sessionId, prompt)
//   gateway.cancel(agentId, sessionId)
//   gateway.setMode(agentId, sessionId, modeId)
//   gateway.answerPermission(permissionId, response)
//   gateway.dispose()
//
// Internally the gateway routes by agent id to a lazily-instantiated
// AgentAdapter. Each adapter owns its own subprocesses; the gateway
// owns only the HookServer, the adapter cache, and the session→agent
// routing table.
//
// ──────────────────────────────────────────────────────────

import * as fsp from "node:fs/promises";

import { HookServer } from "./hook-server/server";
import {
  AGENT_MANIFEST,
  findAgent,
  toBridgeAgents,
  type AgentVersionInfo,
} from "./registry";
import { sessionsRoot } from "./session-paths";
import {
  probeCliInstalled,
  evaluateAuthProbe,
  probeCliCompatibility,
} from "./probes";
import type {
  AgentAdapter,
  AgentAdapterContext,
  AgentGatewayEvents,
  AgentGatewayOptions,
  ContentBlock,
  HookServerHandle,
  InitializeResponse,
  ListSessionsResponse,
  LoadSessionResponse,
  McpServerRegistration,
  NewSessionResponse,
  PromptResponse,
  RequestPermissionResponse,
} from "./types";
import type { EnrichedRegistryAgent } from "../types";

export class AgentGateway {
  private readonly projectRoot: string;
  private readonly events: AgentGatewayEvents;
  private readonly fs: AgentGatewayOptions["fs"];

  private readonly hookServer = new HookServer();
  private hookServerStarted = false;

  private readonly mcpServers: McpServerRegistration[] = [];
  private readonly adapters = new Map<string, AgentAdapter>();
  private readonly sessionToAgent = new Map<string, string>();
  private readonly agentInitializes = new Map<string, InitializeResponse>();
  /** Dedupe concurrent listAgents calls. Without this, every render
   *  loop in the renderer that hits sessions.listAgents() spawns its
   *  own round of 7 PATH+auth+version probes. The renderer sometimes
   *  fires listAgents 5-10×/sec on session-state churn, which used
   *  to balloon the engine to 200+ live `--version` subprocesses. */
  private listAgentsInFlight: Promise<EnrichedRegistryAgent[]> | null = null;

  /** Runtime auth invalidation. When an adapter throws `auth-required`,
   *  the agent's CLI is the source of truth — even if our file/keychain
   *  probe came back positive (stale / expired / scoped credentials).
   *  We override the probe result for any agent in this set so the
   *  green dot disappears the moment the CLI itself disagrees. Cleared
   *  on a successful prompt, on adapter dispose, and after a 30 min
   *  TTL so a long-running app doesn't get stuck. */
  private readonly runtimeAuthFailed = new Map<string, number>();
  private static readonly AUTH_FAIL_TTL_MS = 30 * 60_000;

  /** Called by adapters whenever a prompt fails with auth-required.
   *  Drives the green-dot back to gray on the next listAgents fetch. */
  markAuthFailed(agentId: string): void {
    this.runtimeAuthFailed.set(agentId, Date.now());
  }

  /** Called when a prompt succeeds — clears any prior auth-failed
   *  marker so the dot turns green again as soon as the user re-logs. */
  markAuthOk(agentId: string): void {
    this.runtimeAuthFailed.delete(agentId);
  }

  private isAuthRuntimeInvalidated(agentId: string): boolean {
    const at = this.runtimeAuthFailed.get(agentId);
    if (at === undefined) return false;
    if (Date.now() - at > AgentGateway.AUTH_FAIL_TTL_MS) {
      this.runtimeAuthFailed.delete(agentId);
      return false;
    }
    return true;
  }

  constructor(opts: AgentGatewayOptions) {
    this.projectRoot = opts.projectRoot;
    this.events = opts.events;
    this.fs = opts.fs;
  }

  // ── Engine-facing gateway API ───────────────────────────

  registerMcpServer(server: McpServerRegistration): void {
    this.mcpServers.push(server);
  }

  async listAgents(): Promise<EnrichedRegistryAgent[]> {
    // Concurrent calls share the same in-flight promise so we never
    // fan out 7×N subprocesses on render-loop churn.
    if (this.listAgentsInFlight) return this.listAgentsInFlight;
    this.listAgentsInFlight = this.listAgentsImpl().finally(() => {
      this.listAgentsInFlight = null;
    });
    return this.listAgentsInFlight;
  }

  private async listAgentsImpl(): Promise<EnrichedRegistryAgent[]> {
    // Install-probe + auth-probe fan out in parallel. Version probe
    // is scoped to *installed* binaries only (running `--version` on
    // an ENOENT is slow ENOENT + noise in logs), so it waits for the
    // install probe first. probeCliVersion has its own 5min cache so
    // repeated listAgents calls are cheap.
    const [installed, authenticated] = await Promise.all([
      probeCliInstalled(AGENT_MANIFEST.map((a) => a.cliBinary)),
      (async () => {
        const set = new Set<string>();
        await Promise.all(
          AGENT_MANIFEST.map(async (m) => {
            // Runtime invalidation wins. If the agent's CLI itself
            // told us "not logged in" recently, trust that over the
            // file/keychain probe (which can show stale positives).
            if (this.isAuthRuntimeInvalidated(m.id)) return;
            try {
              if (await evaluateAuthProbe(m.authProbe)) set.add(m.id);
            } catch {
              /* probe failed — treat as unauthenticated */
            }
          }),
        );
        return set;
      })(),
    ]);

    const versionInfo = new Map<string, AgentVersionInfo>();
    await Promise.all(
      AGENT_MANIFEST.map(async (m) => {
        if (!installed.has(m.cliBinary)) return;
        try {
          const { version, compatible } = await probeCliCompatibility({
            binary: m.cliBinary,
            minVersion: m.minCliVersion,
            maxVersion: m.maxCliVersion,
          });
          versionInfo.set(m.id, {
            installedVersion: version ?? undefined,
            versionCompatible: compatible ?? undefined,
          });
        } catch {
          /* timeout / parse error → leave entry absent */
        }
      }),
    );

    return toBridgeAgents(installed, authenticated, versionInfo);
  }

  /** The registry is local/manifest-backed, so `refresh` re-probes PATH. */
  async refreshRegistry(): Promise<EnrichedRegistryAgent[]> {
    return this.listAgents();
  }

  async initializeAgent(agentId: string): Promise<InitializeResponse> {
    const adapter = await this.adapterFor(agentId);
    const cached = this.agentInitializes.get(agentId);
    if (cached) return cached;
    const init = await adapter.initialize();
    this.agentInitializes.set(agentId, init);
    return init;
  }

  async ensureAgent(
    agentId: string,
    _opts: { env?: Record<string, string> } = {},
  ): Promise<InitializeResponse> {
    // PTY adapters spawn per-session, so env is applied at newSession
    // time; ensureAgent just means "the adapter is initialized."
    return this.initializeAgent(agentId);
  }

  async authenticate(_agentId: string, _methodId: string): Promise<void> {
    // Authentication for native CLIs happens in Terminal (see
    // registry.loginCommand + electron/ipc/commands/ai-cli.ts's
    // runCliLogin). The AGENT_AUTHENTICATE message is a compatibility
    // handshake; we accept it and no-op so the
    // UI flow doesn't regress. The `ai_cli_run_login` IPC path is
    // where real auth gets triggered.
    return;
  }

  async newSession(
    agentId: string,
    opts: { cwd?: string; env?: Record<string, string> } = {},
  ): Promise<NewSessionResponse> {
    const adapter = await this.adapterFor(agentId);
    const { session } = await adapter.newSession({
      cwd: opts.cwd ?? this.projectRoot,
      env: opts.env,
    });
    this.sessionToAgent.set(session.sessionId, agentId);
    return session;
  }

  async loadSession(
    agentId: string,
    sessionId: string,
    opts: { cwd?: string; env?: Record<string, string> } = {},
  ): Promise<LoadSessionResponse> {
    const adapter = await this.adapterFor(agentId);
    const response = await adapter.loadSession({
      sessionId,
      cwd: opts.cwd ?? this.projectRoot,
      env: opts.env,
    });
    this.sessionToAgent.set(sessionId, agentId);
    return response;
  }

  async listSessions(
    agentId: string,
    opts: { cwd?: string; cursor?: string | null } = {},
  ): Promise<ListSessionsResponse> {
    const adapter = await this.adapterFor(agentId);
    return adapter.listSessions({ cwd: opts.cwd, cursor: opts.cursor });
  }

  async prompt(
    agentId: string,
    sessionId: string,
    prompt: ContentBlock[],
  ): Promise<PromptResponse> {
    const adapter = this.adapterForSession(sessionId, agentId);
    try {
      const { response } = await adapter.prompt({ sessionId, prompt });
      // A clean prompt is the strongest possible signal that auth is
      // good — clear any prior failed-auth marker so the green dot
      // re-illuminates the moment the user resolves their login.
      this.markAuthOk(adapter.agentId);
      return response;
    } catch (err) {
      // Adapter raised AgentFailureError; if it's auth-required, mark
      // the agent so the next listAgents shows the dot as gray + the
      // chat picker shows "Sign in". Engine-driven, can't be fooled by
      // a stale ~/.claude/.credentials.json that the file probe sees.
      const failure = (err as { failure?: { kind?: string } }).failure;
      if (failure?.kind === "auth-required") {
        this.markAuthFailed(adapter.agentId);
      }
      throw err;
    }
  }

  async cancel(agentId: string, sessionId: string): Promise<void> {
    const adapter = this.adapterForSession(sessionId, agentId);
    await adapter.cancel({ sessionId });
  }

  async setMode(
    agentId: string,
    sessionId: string,
    modeId: string,
  ): Promise<void> {
    const adapter = this.adapterForSession(sessionId, agentId);
    if (!adapter.setMode) {
      throw new Error(`agent ${adapter.agentId} does not support set-mode`);
    }
    await adapter.setMode({ sessionId, modeId });
  }

  answerPermission(
    permissionId: string,
    response: RequestPermissionResponse,
  ): void {
    // Permission IDs are uuids; at most one adapter will have it
    // pending. Fan out rather than tracking a permissionId→agent map
    // — simpler and avoids a second source of truth.
    for (const adapter of this.adapters.values()) {
      adapter.respondToPermission({ permissionId, response });
    }
  }

  async dispose(): Promise<void> {
    const disposals = Array.from(this.adapters.values()).map((a) =>
      a.dispose().catch((err) => {
        // eslint-disable-next-line no-console
        console.warn(`[agents] ${a.agentId} dispose error:`, err);
      }),
    );
    await Promise.all(disposals);
    this.adapters.clear();
    this.sessionToAgent.clear();
    this.agentInitializes.clear();
    if (this.hookServerStarted) {
      await this.hookServer.stop();
      this.hookServerStarted = false;
    }
  }

  // ── Internals ─────────────────────────────────────────

  private async adapterFor(agentId: string): Promise<AgentAdapter> {
    const cached = this.adapters.get(agentId);
    if (cached) return cached;

    const entry = findAgent(agentId);
    if (!entry) throw new Error(`unknown agent id: ${agentId}`);

    await this.ensureHookServer();

    const ctx: AgentAdapterContext = {
      projectRoot: this.projectRoot,
      mcpServers: this.mcpServers,
      hookServer: this.hookServerHandle(),
      sessionDirRoot: sessionsRoot(),
      emit: this.events,
      fs: this.fs,
    };
    const adapter = entry.createAdapter(ctx);
    this.adapters.set(agentId, adapter);
    // eslint-disable-next-line no-console
    console.log(
      `[agents] adapter created: ${agentId} (live=[${Array.from(this.adapters.keys()).join(",")}])`,
    );
    return adapter;
  }

  /** Resolve the adapter responsible for a session id. We trust the
   *  agentId on the incoming message rather than the internal map
   *  when both are present — saves one failure mode if the map got
   *  out of sync with a re-spawn. */
  private adapterForSession(sessionId: string, agentId?: string): AgentAdapter {
    const resolvedId = agentId ?? this.sessionToAgent.get(sessionId);
    if (!resolvedId) throw new Error(`unknown session: ${sessionId}`);
    const adapter = this.adapters.get(resolvedId);
    if (!adapter) {
      // Diagnostic: which adapters DO we have, and what's the routing
      // table look like? Without this the "adapter not live" error
      // gives the user a black-box failure with no recovery path.
      // eslint-disable-next-line no-console
      console.warn(
        `[agents] adapterForSession miss: agentId=${resolvedId} sessionId=${sessionId} ` +
          `live=[${Array.from(this.adapters.keys()).join(",")}] ` +
          `routes=${this.sessionToAgent.size}`,
      );
      throw new Error(`adapter not live: ${resolvedId}`);
    }
    return adapter;
  }

  private async ensureHookServer(): Promise<void> {
    if (this.hookServerStarted) return;
    // Session dir must exist before adapters try to write config into
    // it. Idempotent.
    await fsp.mkdir(sessionsRoot(), { recursive: true });
    await this.hookServer.start();
    this.hookServerStarted = true;
  }

  private hookServerHandle(): HookServerHandle {
    // Narrow interface the adapters see — prevents them from
    // start/stop-ing the shared server. The `url` getter proxies to
    // the live HookServer so it always reflects the current bound port.
    const hs = this.hookServer;
    return {
      get url() { return hs.url; },
      registerSession: (sessionId, onEvent) =>
        hs.registerSession(sessionId, onEvent),
      unregisterSession: (sessionId) => hs.unregisterSession(sessionId),
    };
  }
}
