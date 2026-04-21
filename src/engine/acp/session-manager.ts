// ──────────────────────────────────────────────────────────
// ACP Session Manager — owns all live agent subprocesses + sessions
// ──────────────────────────────────────────────────────────
//
// One subprocess per registry agent id (shared across sessions, so
// authenticate() is amortized). Multiple sessions per subprocess.
// The browser drives this via WebSocket frames dispatched from
// src/engine/index.ts — the manager never talks to WebSockets directly.
//
// Permission requests flow asynchronously:
//   agent → SDK calls clientImpl.requestPermission
//       → manager stores a pending resolver keyed by a fresh requestId
//       → manager emits onPermissionRequest to the engine (→ browser)
//       → browser answers via answerPermission(requestId, outcome)
//       → resolver fires, SDK returns to agent
//
// ──────────────────────────────────────────────────────────

import type {
  ContentBlock,
  InitializeResponse,
  NewSessionResponse,
  PromptResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from "@agentclientprotocol/sdk";

import { RegistryClient, type RegistryAgent } from "./registry.js";
import { startAcpClient, type AcpClient } from "./client.js";

const ACP_PROTOCOL_VERSION = 1;

/** The external events the session-manager emits, to be fanned out over WS. */
export interface SessionManagerEvents {
  onSessionUpdate(
    agentId: string,
    notification: SessionNotification,
  ): void;
  onPermissionRequest(
    agentId: string,
    requestId: string,
    req: RequestPermissionRequest,
  ): void;
  onAgentStderr(agentId: string, line: string): void;
  onAgentExit(
    agentId: string,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void;
}

/** File-system capability hooks. Provided by the engine since it owns the project root. */
export interface SessionManagerFsHooks {
  readTextFile(req: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile(req: WriteTextFileRequest): Promise<WriteTextFileResponse>;
}

export interface SessionManagerOptions {
  projectRoot: string;
  events: SessionManagerEvents;
  fs?: SessionManagerFsHooks;
}

export interface McpServerHandle {
  name: string;
  url: string;
  headers?: Array<{ name: string; value: string }>;
}

interface PendingPermission {
  resolve: (res: RequestPermissionResponse) => void;
  reject: (err: Error) => void;
}

interface LiveAgent {
  client: AcpClient;
  initialized: InitializeResponse | null;
  sessions: Set<string>;
  /** Snapshot of the env that was passed into this subprocess at spawn time.
   *  If the browser asks to start a session with a different env we dispose
   *  and respawn — subprocess env is immutable after fork. */
  spawnedEnv: Record<string, string>;
}

export class AcpSessionManager {
  private registry: RegistryClient;
  private opts: SessionManagerOptions;
  private agents = new Map<string, LiveAgent>();
  private pendingPermissions = new Map<string, PendingPermission>();
  private mcpServers: McpServerHandle[] = [];

  constructor(options: SessionManagerOptions) {
    this.opts = options;
    this.registry = new RegistryClient(options.projectRoot);
  }

  /**
   * Register an MCP server to be attached to every new ACP session. The engine
   * calls this after it binds its port so the 0canvas design-state MCP endpoint
   * becomes reachable to the spawned agent.
   */
  registerMcpServer(server: McpServerHandle): void {
    const existing = this.mcpServers.findIndex((s) => s.name === server.name);
    if (existing >= 0) {
      this.mcpServers[existing] = server;
    } else {
      this.mcpServers.push(server);
    }
  }

  unregisterMcpServer(name: string): void {
    this.mcpServers = this.mcpServers.filter((s) => s.name !== name);
  }

  /** List all agents runnable on this host. Used for the registry UI. */
  async listAgents(): Promise<RegistryAgent[]> {
    return this.registry.listRunnable();
  }

  /** Force-refresh the on-disk registry cache from the CDN. */
  async refreshRegistry(): Promise<RegistryAgent[]> {
    await this.registry.fetch({ force: true });
    return this.registry.listRunnable();
  }

  /**
   * Ensure a subprocess exists for this agent id and has been initialized.
   * Subsequent calls with an env matching the spawned subprocess are no-ops.
   * If env differs (e.g. user rotated their API key), we tear the subprocess
   * down and respawn — env is baked at fork time.
   */
  async ensureAgent(
    agentId: string,
    opts?: { env?: Record<string, string> },
  ): Promise<InitializeResponse> {
    const requestedEnv = opts?.env ?? {};
    const existing = this.agents.get(agentId);

    if (existing?.initialized) {
      if (sameEnv(existing.spawnedEnv, requestedEnv)) {
        return existing.initialized;
      }
      // Env drifted — respawn under the new environment so the user's
      // auth change actually takes effect.
      await existing.client.dispose();
      this.agents.delete(agentId);
    }

    const meta = await this.registry.findById(agentId);
    if (!meta) throw new Error(`Unknown agent: ${agentId}`);

    const client = startAcpClient(
      meta,
      {
        onSessionUpdate: (n) => this.opts.events.onSessionUpdate(agentId, n),
        onPermissionRequest: (req) =>
          this.awaitPermissionFromBrowser(agentId, req),
        onReadTextFile: this.opts.fs?.readTextFile,
        onWriteTextFile: this.opts.fs?.writeTextFile,
        onStderr: (line) => this.opts.events.onAgentStderr(agentId, line),
        onExit: (code, signal) => {
          this.agents.delete(agentId);
          this.opts.events.onAgentExit(agentId, code, signal);
        },
      },
      { cwd: this.opts.projectRoot, env: requestedEnv },
    );

    const live: LiveAgent = {
      client,
      initialized: null,
      sessions: new Set(),
      spawnedEnv: requestedEnv,
    };
    this.agents.set(agentId, live);

    const initialized = await client.connection.initialize({
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: !!this.opts.fs,
          writeTextFile: !!this.opts.fs,
        },
        terminal: false,
      },
    });
    live.initialized = initialized;
    return initialized;
  }

  /**
   * Run the agent's advertised authentication method. Most agents handle their
   * own auth via environment/OS-keychain side channels; this simply calls the
   * SDK with the chosen method id.
   */
  async authenticate(agentId: string, methodId: string): Promise<void> {
    const live = this.requireAgent(agentId);
    await live.client.connection.authenticate({ methodId });
  }

  /** Create a new conversation session for an agent. */
  async newSession(
    agentId: string,
    opts?: {
      cwd?: string;
      mcpServers?: unknown[];
      /** Optional env override. If the subprocess is already running with a
       *  different env the session manager will respawn it. */
      env?: Record<string, string>;
    },
  ): Promise<NewSessionResponse> {
    await this.ensureAgent(agentId, { env: opts?.env });
    const live = this.requireAgent(agentId);

    // Combine registered MCP servers (0canvas design-state endpoint) with any
    // the caller wanted to add on top. This is how the agent picks up our 5
    // design tools without any agent-side config.
    const mcpServers = [
      ...this.mcpServers.map((s) => ({
        type: "http" as const,
        name: s.name,
        url: s.url,
        headers: s.headers ?? [],
      })),
      ...((opts?.mcpServers as never[]) ?? []),
    ];

    const response = await live.client.connection.newSession({
      cwd: opts?.cwd ?? this.opts.projectRoot,
      mcpServers: mcpServers as never,
    });
    live.sessions.add(response.sessionId);
    return response;
  }

  /** Send a prompt to an existing session. */
  async prompt(
    agentId: string,
    sessionId: string,
    prompt: ContentBlock[],
  ): Promise<PromptResponse> {
    const live = this.requireAgent(agentId);
    return live.client.connection.prompt({ sessionId, prompt });
  }

  /** Cancel an in-flight prompt for a session. */
  async cancel(agentId: string, sessionId: string): Promise<void> {
    const live = this.agents.get(agentId);
    if (!live) return;
    await live.client.connection.cancel({ sessionId });
  }

  /**
   * Resolve a permission request previously routed to the browser. Safe to
   * call with an unknown requestId (returns false); duplicate responses no-op.
   */
  answerPermission(
    requestId: string,
    response: RequestPermissionResponse,
  ): boolean {
    const pending = this.pendingPermissions.get(requestId);
    if (!pending) return false;
    this.pendingPermissions.delete(requestId);
    pending.resolve(response);
    return true;
  }

  /** Tear everything down. Called on engine shutdown. */
  async dispose(): Promise<void> {
    for (const [, pending] of this.pendingPermissions) {
      pending.reject(new Error("Session manager disposed"));
    }
    this.pendingPermissions.clear();

    const children = Array.from(this.agents.values()).map((a) =>
      a.client.dispose(),
    );
    await Promise.allSettled(children);
    this.agents.clear();
  }

  // ── private ────────────────────────────────────────────

  private requireAgent(agentId: string): LiveAgent {
    const live = this.agents.get(agentId);
    if (!live) throw new Error(`Agent ${agentId} not running`);
    return live;
  }

  private awaitPermissionFromBrowser(
    agentId: string,
    req: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> {
    const requestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise<RequestPermissionResponse>((resolve, reject) => {
      this.pendingPermissions.set(requestId, { resolve, reject });
      try {
        this.opts.events.onPermissionRequest(agentId, requestId, req);
      } catch (err) {
        this.pendingPermissions.delete(requestId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}

function sameEnv(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}
