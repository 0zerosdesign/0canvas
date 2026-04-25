// ──────────────────────────────────────────────────────────
// Zeros Engine Protocol — Message types for engine ↔ overlay
// ──────────────────────────────────────────────────────────
//
// Defines the WebSocket protocol between:
//   - Design workspace / legacy browser overlay (connects as WebSocket client)
//   - Zeros Engine (Node.js process, WebSocket server)
//
// V2: The engine handles messages directly — no relay, no
// VS Code extension required.
//
// ──────────────────────────────────────────────────────────

import type {
  ContentBlock,
  InitializeResponse,
  ListSessionsResponse,
  LoadSessionResponse,
  NewSessionResponse,
  PromptResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  StopReason,
} from "@agentclientprotocol/sdk";

// Registry-agent shape emitted on AGENT_AGENTS_LIST. Inlined here after
// the ACP subdirectory was deleted — this is the engine's internal
// mirror of the browser-side `BridgeRegistryAgent` (in
// src/zeros/bridge/messages.ts). Fields with `installed`/`launchKind`
// are required so the broadcast payload always has them populated.

export interface RegistryAgent {
  id: string;
  name: string;
  version: string;
  description: string;
  repository?: string;
  website?: string;
  authors?: string[];
  license?: string;
  icon?: string;
  distribution: {
    npx?: { package: string; args?: string[]; env?: Record<string, string> };
    uvx?: { package: string; args?: string[]; env?: Record<string, string> };
    binary?: Record<string, {
      archive: string;
      cmd: string;
      args?: string[];
      env?: Record<string, string>;
    }>;
  };
}

export interface EnrichedRegistryAgent extends RegistryAgent {
  installed: boolean;
  launchKind: "npx" | "uvx" | "binary" | "unavailable";
  authBinary?: string;
  /** User-facing install command + docs URL. Rendered by the empty
   *  composer's "No agent CLI detected" state so the user can
   *  install the CLI without leaving the app. */
  installHint?: {
    command: string;
    docsUrl?: string;
  };
  /** Evaluated from `AuthProbe` in the engine manifest. True means the
   *  CLI has credentials on disk / keychain. Existence-only probe —
   *  never reads secret contents. Undefined when the probe couldn't
   *  run (e.g. platform mismatch, CLI not installed at all). */
  authenticated?: boolean;
  /** Raw version string from `<cliBinary> --version` (first semver
   *  substring, e.g. "1.2.3"). Undefined when the CLI isn't installed
   *  or the version probe timed out. */
  installedVersion?: string;
  /** Whether `installedVersion` falls inside the manifest's
   *  min/maxCliVersion range. True = known-good; false = out of
   *  range (UI shows a warning); undefined = version couldn't be
   *  probed, we default to allowing the user to try. */
  versionCompatible?: boolean;
  /** Min version we've tested. Exposed so the UI can render the
   *  "supported versions: X+" badge without re-fetching the manifest. */
  minCliVersion?: string;
  /** Max version we've tested. Usually undefined. */
  maxCliVersion?: string;
}

export type MessageSource = "browser" | "engine";

// ── Base envelope ────────────────────────────────────────

export interface BaseMessage {
  id: string;
  source: MessageSource;
  timestamp: number;
}

// ── Browser → Engine ─────────────────────────────────────

export interface StyleChangeMessage extends BaseMessage {
  type: "STYLE_CHANGE";
  selector: string;
  property: string;
  value: string;
  previousValue?: string;
}

export interface RequestSourceMapMessage extends BaseMessage {
  type: "REQUEST_SOURCE_MAP";
  selector: string;
  property: string;
}

export interface ElementSelectedMessage extends BaseMessage {
  type: "ELEMENT_SELECTED";
  selector: string;
  tagName: string;
  className: string;
  computedStyles: Record<string, string>;
}

export interface TailwindClassChangeMessage extends BaseMessage {
  type: "TAILWIND_CLASS_CHANGE";
  selector: string;
  action: "add" | "remove";
  className: string;
}

export interface AIChatRequestMessage extends BaseMessage {
  type: "AI_CHAT_REQUEST";
  query: string;
  selector?: string;
  styles?: Record<string, string>;
  route?: string;
}

export interface ProjectStateSyncMessage extends BaseMessage {
  type: "PROJECT_STATE_SYNC";
  projectFile: string; // JSON-serialized OCProjectFile
  filePath?: string;   // relative path to .0c file
  projectId?: string;
}

// ── Engine → Browser ─────────────────────────────────────

export interface StyleChangeAckMessage extends BaseMessage {
  type: "STYLE_CHANGE_ACK";
  requestId: string;
  success: boolean;
  file?: string;
  line?: number;
  error?: string;
}

export interface SourceMapResultMessage extends BaseMessage {
  type: "SOURCE_MAP_RESULT";
  requestId: string;
  selector: string;
  file: string;
  line: number;
  column?: number;
}

export interface ProjectStateLoadedMessage extends BaseMessage {
  type: "PROJECT_STATE_LOADED";
  projectFile: string; // JSON-serialized OCProjectFile
  filePath: string;    // relative path to .0c file
}

export interface AIChatResponseMessage extends BaseMessage {
  type: "AI_CHAT_RESPONSE";
  requestId: string;
  success: boolean;
  message: string;
  filesChanged?: string[];
}

export interface EngineReadyMessage extends BaseMessage {
  type: "ENGINE_READY";
  version: string;
  root: string;
  framework: string;
  port: number;
}

export interface ErrorMessage extends BaseMessage {
  type: "ERROR";
  code: string;
  message: string;
  requestId?: string;
}

export interface HeartbeatMessage extends BaseMessage {
  type: "HEARTBEAT";
}

export interface CSSFileChangedMessage extends BaseMessage {
  type: "CSS_FILE_CHANGED";
  file: string; // relative path
}

export interface OCFileChangedMessage extends BaseMessage {
  type: "OC_FILE_CHANGED";
  filePath: string;
  action: "created" | "updated" | "deleted";
}

// ── Connection ───────────────────────────────────────────

export interface ConnectedMessage extends BaseMessage {
  type: "CONNECTED";
  capabilities: string[];
}

// ── ACP (Agent Client Protocol) ──────────────────────────
//
// Zeros is an ACP *client*: it spawns the vendor's own published CLI
// (claude-agent-acp, codex-acp, gemini, etc.) as a subprocess and drives
// it via the shared ACP spec. The browser never talks to the agent
// directly — every message below rides the engine's existing WebSocket.
// See docs/AGENT_RUNTIME.md for the end-to-end plan.
//
// Wire shapes reuse ACP SDK types where possible; we only declare the
// browser ↔ engine envelope, not the agent-side protocol.

// ── Browser → Engine

export interface AgentListAgentsMessage extends BaseMessage {
  type: "AGENT_LIST_AGENTS";
  /** If true, bypass the on-disk cache and refetch from the CDN. */
  force?: boolean;
}

export interface AgentNewSessionMessage extends BaseMessage {
  type: "AGENT_NEW_SESSION";
  agentId: string;
  /** Optional override of the session cwd. Defaults to the engine's project root. */
  cwd?: string;
  /** Env passed to the agent subprocess at spawn time. Used for API-key-based
   *  auth (e.g. ANTHROPIC_API_KEY). The engine never stores this across
   *  restarts; the browser re-sends it each session. */
  env?: Record<string, string>;
}

/**
 * Spawn (or reuse) the agent subprocess and return the initialize response.
 * Used by the auth screen so the UI can show the agent's advertised auth
 * methods before we commit to creating a session.
 */
export interface AgentInitAgentMessage extends BaseMessage {
  type: "AGENT_INIT_AGENT";
  agentId: string;
}

export interface AgentAuthenticateMessage extends BaseMessage {
  type: "AGENT_AUTHENTICATE";
  agentId: string;
  methodId: string;
}

export interface AgentPromptMessage extends BaseMessage {
  type: "AGENT_PROMPT";
  agentId: string;
  sessionId: string;
  prompt: ContentBlock[];
}

export interface AgentCancelMessage extends BaseMessage {
  type: "AGENT_CANCEL";
  agentId: string;
  sessionId: string;
}

export interface AgentPermissionResponseMessage extends BaseMessage {
  type: "AGENT_PERMISSION_RESPONSE";
  /** Request id the engine assigned when it forwarded the permission prompt. */
  permissionId: string;
  response: RequestPermissionResponse;
}

export interface AgentSetModeMessage extends BaseMessage {
  type: "AGENT_SET_MODE";
  agentId: string;
  sessionId: string;
  modeId: string;
}

export interface AgentListSessionsMessage extends BaseMessage {
  type: "AGENT_LIST_SESSIONS";
  agentId: string;
  cwd?: string;
  cursor?: string | null;
}

export interface AgentLoadSessionMessage extends BaseMessage {
  type: "AGENT_LOAD_SESSION";
  agentId: string;
  sessionId: string;
  cwd?: string;
  env?: Record<string, string>;
}

// ── Engine → Browser

export interface AgentAgentsListMessage extends BaseMessage {
  type: "AGENT_AGENTS_LIST";
  requestId: string;
  agents: EnrichedRegistryAgent[];
}

export interface AgentSessionCreatedMessage extends BaseMessage {
  type: "AGENT_SESSION_CREATED";
  requestId: string;
  agentId: string;
  /** The raw SDK response so the browser has modes, configOptions, etc. */
  session: NewSessionResponse;
  /** Cached from the agent's initialize() response so the browser can render auth options. */
  initialize: InitializeResponse;
}

export interface AgentAuthCompletedMessage extends BaseMessage {
  type: "AGENT_AUTH_COMPLETED";
  requestId: string;
  agentId: string;
  methodId: string;
}

/** Response to an AGENT_INIT_AGENT — lets the browser read authMethods. */
export interface AgentAgentInitializedMessage extends BaseMessage {
  type: "AGENT_AGENT_INITIALIZED";
  requestId: string;
  agentId: string;
  initialize: InitializeResponse;
}

export interface AgentSessionUpdateMessage extends BaseMessage {
  type: "AGENT_SESSION_UPDATE";
  agentId: string;
  notification: SessionNotification;
}

export interface AgentPermissionRequestMessage extends BaseMessage {
  type: "AGENT_PERMISSION_REQUEST";
  agentId: string;
  /** Id the browser must echo back in AGENT_PERMISSION_RESPONSE. */
  permissionId: string;
  request: RequestPermissionRequest;
}

export interface AgentPromptCompleteMessage extends BaseMessage {
  type: "AGENT_PROMPT_COMPLETE";
  requestId: string;
  agentId: string;
  sessionId: string;
  stopReason: StopReason;
  response: PromptResponse;
}

export interface AgentPromptFailedMessage extends BaseMessage {
  type: "AGENT_PROMPT_FAILED";
  requestId: string;
  agentId: string;
  sessionId: string;
  error: string;
}

export interface AgentAgentStderrMessage extends BaseMessage {
  type: "AGENT_AGENT_STDERR";
  agentId: string;
  line: string;
}

export interface AgentAgentExitedMessage extends BaseMessage {
  type: "AGENT_AGENT_EXITED";
  agentId: string;
  code: number | null;
  signal: string | null;
}

export interface BridgeAgentFailure {
  kind:
    | "timeout"
    | "auth-required"
    | "subprocess-exited"
    | "protocol-error"
    | "transport-closed";
  message: string;
  stage?:
    | "initialize"
    | "newSession"
    | "loadSession"
    | "prompt"
    | "cancel"
    | "setMode";
  agentId?: string;
  exit?: {
    code: number | null;
    signal: string | null;
    stderrTail: string;
  };
}

export interface AgentErrorMessage extends BaseMessage {
  type: "AGENT_ERROR";
  requestId?: string;
  agentId?: string;
  code: string;
  message: string;
  failure?: BridgeAgentFailure;
}

export interface AgentSessionsListMessage extends BaseMessage {
  type: "AGENT_SESSIONS_LIST";
  requestId: string;
  agentId: string;
  sessions: ListSessionsResponse["sessions"];
  nextCursor?: string | null;
}

export interface AgentSessionLoadedMessage extends BaseMessage {
  type: "AGENT_SESSION_LOADED";
  requestId: string;
  agentId: string;
  sessionId: string;
  response: LoadSessionResponse;
}

export interface AgentModeChangedMessage extends BaseMessage {
  type: "AGENT_MODE_CHANGED";
  requestId: string;
  agentId: string;
  sessionId: string;
  modeId: string;
}

// ── Union ────────────────────────────────────────────────

export type EngineMessage =
  | StyleChangeMessage
  | RequestSourceMapMessage
  | ElementSelectedMessage
  | StyleChangeAckMessage
  | SourceMapResultMessage
  | ConnectedMessage
  | HeartbeatMessage
  | ErrorMessage
  | ProjectStateSyncMessage
  | ProjectStateLoadedMessage
  | TailwindClassChangeMessage
  | AIChatRequestMessage
  | AIChatResponseMessage
  | EngineReadyMessage
  | CSSFileChangedMessage
  | OCFileChangedMessage
  // ACP (browser → engine)
  | AgentListAgentsMessage
  | AgentNewSessionMessage
  | AgentInitAgentMessage
  | AgentAuthenticateMessage
  | AgentPromptMessage
  | AgentCancelMessage
  | AgentPermissionResponseMessage
  | AgentSetModeMessage
  | AgentListSessionsMessage
  | AgentLoadSessionMessage
  // ACP (engine → browser)
  | AgentAgentsListMessage
  | AgentSessionCreatedMessage
  | AgentAgentInitializedMessage
  | AgentAuthCompletedMessage
  | AgentSessionUpdateMessage
  | AgentPermissionRequestMessage
  | AgentPromptCompleteMessage
  | AgentPromptFailedMessage
  | AgentAgentStderrMessage
  | AgentAgentExitedMessage
  | AgentModeChangedMessage
  | AgentSessionsListMessage
  | AgentSessionLoadedMessage
  | AgentErrorMessage;

// ── Helpers ──────────────────────────────────────────────

export function createMessageId(): string {
  // Node.js 19+ has crypto.randomUUID globally
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createMessage<M extends EngineMessage["type"]>(
  msg: { type: M } & Omit<Extract<EngineMessage, { type: M }>, "id" | "timestamp" | "type">,
): Extract<EngineMessage, { type: M }> {
  return {
    ...msg,
    id: createMessageId(),
    timestamp: Date.now(),
  } as Extract<EngineMessage, { type: M }>;
}
