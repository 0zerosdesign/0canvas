// ──────────────────────────────────────────────────────────
// Agent runtime — common types
// ──────────────────────────────────────────────────────────
//
// AgentAdapter is the contract every per-CLI adapter implements. The
// gateway multiplexes adapters behind a single surface so the
// WebSocket wire protocol is consistent across every CLI.
//
// Wire shapes are owned in src/zeros/bridge/agent-events.ts and
// shared by both processes (type-only — erased at compile time).
//
// ──────────────────────────────────────────────────────────

import type {
  AvailableCommand,
  ContentBlock,
  InitializeResponse,
  ListSessionsResponse,
  LoadSessionResponse,
  NewSessionResponse,
  PromptResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionMode,
  SessionNotification,
  StopReason,
} from "../../zeros/bridge/agent-events";

// ── Failure taxonomy ─────────────────────────────────────
//
// Mirrors BridgeAgentFailure in src/zeros/bridge/messages.ts. Kept name-
// compatible so the UI continues to route on `kind` without changes.

export type AgentFailureKind =
  | "timeout"
  | "auth-required"
  | "subprocess-exited"
  | "protocol-error"
  | "transport-closed";

export type AgentFailureStage =
  | "initialize"
  | "newSession"
  | "loadSession"
  | "prompt"
  | "cancel"
  | "setMode";

export interface AgentFailure {
  kind: AgentFailureKind;
  message: string;
  stage?: AgentFailureStage;
  agentId?: string;
  exit?: {
    code: number | null;
    signal: string | null;
    stderrTail: string;
  };
}

export class AgentFailureError extends Error {
  readonly failure: AgentFailure;
  constructor(failure: AgentFailure) {
    super(failure.message);
    this.name = "AgentFailureError";
    this.failure = failure;
  }
}

// ── Gateway-facing event channel ─────────────────────────
//
// Every adapter emits into this channel. The gateway translates to
// AGENT_* wire messages and broadcasts over the WebSocket.

export interface AgentGatewayEvents {
  onSessionUpdate: (agentId: string, notification: SessionNotification) => void;
  onPermissionRequest: (
    agentId: string,
    permissionId: string,
    request: RequestPermissionRequest,
  ) => void;
  onAgentStderr: (agentId: string, line: string) => void;
  onAgentExit: (
    agentId: string,
    code: number | null,
    signal: NodeJS.Signals | string | null,
  ) => void;
}

// ── Filesystem capability (for agents that ask the client to r/w) ─

export interface AgentFsCapability {
  readTextFile(args: {
    path: string;
    sessionId: string;
  }): Promise<{ content: string }>;
  writeTextFile(args: {
    path: string;
    sessionId: string;
    content: string;
  }): Promise<Record<string, never>>;
}

// ── MCP server registration (matches current AgentSessionManager API) ─

export interface McpServerRegistration {
  name: string;
  url: string;
}

// ── Gateway construction shape (drop-in with AgentSessionManager) ──

export interface AgentGatewayOptions {
  projectRoot: string;
  events: AgentGatewayEvents;
  fs: AgentFsCapability;
}

// ── AgentAdapter — the per-CLI contract ──────────────────
//
// One instance per agent id, lives for the engine's lifetime. Each
// adapter owns any number of concurrent sessions; session state is
// internal to the adapter.

export interface AgentAdapterContext {
  projectRoot: string;
  /** MCP servers to register with the agent (passed via agent-specific config). */
  mcpServers: McpServerRegistration[];
  /** Shared hook server — adapters that need hooks register paths here. */
  hookServer: HookServerHandle;
  /** Per-session state directory root. Adapter-owned subdirs inside. */
  sessionDirRoot: string;
  /** Emit events up to the gateway. */
  emit: AgentGatewayEvents;
  /** Filesystem capability for agents that request host reads/writes. */
  fs: AgentFsCapability;
}

export interface AgentAdapter {
  readonly agentId: string;

  /** One-time prep (probe version, open the hook channel, etc.). */
  initialize(): Promise<InitializeResponse>;

  /** Start a new session. Returns the session metadata the UI needs. */
  newSession(opts: {
    cwd: string;
    env?: Record<string, string>;
  }): Promise<{ session: NewSessionResponse; initialize: InitializeResponse }>;

  /** Resume a prior session by id. */
  loadSession(opts: {
    sessionId: string;
    cwd: string;
    env?: Record<string, string>;
  }): Promise<LoadSessionResponse>;

  /** List resumable sessions the CLI knows about. */
  listSessions(opts: {
    cwd?: string;
    cursor?: string | null;
  }): Promise<ListSessionsResponse>;

  /** Send a turn. Streaming events fan out via emit.onSessionUpdate. */
  prompt(opts: {
    sessionId: string;
    prompt: ContentBlock[];
  }): Promise<{ stopReason: StopReason; response: PromptResponse }>;

  /** Abort the current turn. */
  cancel(opts: { sessionId: string }): Promise<void>;

  /** Switch session mode (e.g. plan/default/accept-edits). */
  setMode?(opts: { sessionId: string; modeId: string }): Promise<void>;

  /** Respond to a permission prompt the adapter previously raised. */
  respondToPermission(opts: {
    permissionId: string;
    response: RequestPermissionResponse;
  }): void;

  /** Release resources: kill subprocesses, close sockets. */
  dispose(): Promise<void>;
}

// ── Hook server handle exposed to adapters ───────────────

export interface HookServerHandle {
  /** URL the CLI should POST hook payloads to. */
  readonly url: string;
  /** Register a session; returns the token to inject into the CLI env. */
  registerSession(
    sessionId: string,
    onEvent: (event: HookEvent) => HookResponse | Promise<HookResponse>,
  ): { token: string };
  /** Release a session's token; subsequent POSTs with it are rejected. */
  unregisterSession(sessionId: string): void;
}

export interface HookEvent {
  /** Logical event name as reported by the CLI (e.g. "PreToolUse"). */
  name: string;
  /** Session id this event belongs to (from request header). */
  sessionId: string;
  /** Full payload the CLI posted. Shape varies per CLI. */
  payload: unknown;
}

export interface HookResponse {
  /** HTTP status code. 200 is the normal success. */
  status: number;
  /** JSON body. For permission responses this is where we put
   *  `{"hookSpecificOutput":{"permissionDecision":"allow"}}` etc. */
  body?: unknown;
}

// ── Re-exports — convenience for adapter modules ─────────

export type {
  AvailableCommand,
  ContentBlock,
  InitializeResponse,
  ListSessionsResponse,
  LoadSessionResponse,
  NewSessionResponse,
  PromptResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionMode,
  SessionNotification,
  StopReason,
};
