// ──────────────────────────────────────────────────────────
// AgentGateway — orchestrator for per-agent adapters
// ──────────────────────────────────────────────────────────
//
// Drop-in replacement for src/engine/acp/session-manager.ts. Exposes
// the same public surface the engine entry point (src/engine/index.ts)
// already uses:
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
} from "./registry";
import { sessionsRoot } from "./session-paths";
import { probeCliInstalled } from "./probes";
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

  constructor(opts: AgentGatewayOptions) {
    this.projectRoot = opts.projectRoot;
    this.events = opts.events;
    this.fs = opts.fs;
  }

  // ── Drop-in parity with AgentSessionManager ─────────────

  registerMcpServer(server: McpServerRegistration): void {
    this.mcpServers.push(server);
  }

  async listAgents(): Promise<EnrichedRegistryAgent[]> {
    const installed = await probeCliInstalled(
      AGENT_MANIFEST.map((a) => a.cliBinary),
    );
    return toBridgeAgents(installed);
  }

  /** ACP implementation refreshed a CDN-backed registry; ours is
   *  local, so `refresh` just re-probes PATH. */
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
    // In ACP this would respawn with the given env if it changed. PTY
    // adapters spawn per-session, so env is applied at newSession
    // time; ensureAgent just means "the adapter is initialized."
    return this.initializeAgent(agentId);
  }

  async authenticate(_agentId: string, _methodId: string): Promise<void> {
    // Authentication for native CLIs happens in Terminal (see
    // registry.loginCommand + electron/ipc/commands/ai-cli.ts's
    // runCliLogin). The AGENT_AUTHENTICATE message is a leftover from
    // the ACP protocol's auth handshake; we accept it and no-op so the
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
    const { response } = await adapter.prompt({ sessionId, prompt });
    return response;
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
    if (!adapter) throw new Error(`adapter not live: ${resolvedId}`);
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
