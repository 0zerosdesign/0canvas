// ──────────────────────────────────────────────────────────
// Zeros Protocol — Message types for browser ↔ engine
// ──────────────────────────────────────────────────────────
//
// These types define the WebSocket protocol between:
//   - Browser overlay (ws-client.ts)
//   - Zeros Engine (Node.js process on port 24193)
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

export type MessageSource = "browser" | "engine";

// ── ACP registry agent (mirror of the engine-side shape) ─
//
// We redeclare the browser-visible fields here rather than import the Node
// module from the browser bundle. Fields track src/engine/acp/registry.ts.

export interface BridgeRegistryAgent {
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
  /** True when the vendor's CLI is on PATH on this machine (user brought their own). */
  installed?: boolean;
  /** Platform-resolved launch strategy; `"unavailable"` means no runnable dist here. */
  launchKind?: "npx" | "uvx" | "binary" | "unavailable";
  /** CLI binary used by the Login-in-Terminal flow and the auth-state probe. */
  authBinary?: string;
  /** Install command + docs URL from the engine's manifest. Populated so the
   *  composer can render a "install this CLI" hint without hardcoding
   *  install strings in the UI. */
  installHint?: {
    command: string;
    docsUrl?: string;
  };
  /** Evaluated from the engine manifest's `AuthProbe`. True = CLI has
   *  credentials on disk / keychain. Lets the Agents panel stop
   *  calling `ai_cli_is_authenticated` on every mount (which had its
   *  own, drifted, marker table). */
  authenticated?: boolean;
  /** Raw version string from `<cliBinary> --version` — lets the UI
   *  surface "installed: X.Y.Z" next to the agent name. */
  installedVersion?: string;
  /** Whether `installedVersion` is within the manifest's tested
   *  range. False shows an "update required" warning in the pill. */
  versionCompatible?: boolean;
  /** Min / max versions from the engine manifest. Used for the
   *  "supported versions" hint text. */
  minCliVersion?: string;
  maxCliVersion?: string;
}

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

export interface CSSFileChangedMessage extends BaseMessage {
  type: "CSS_FILE_CHANGED";
  file: string;
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

export interface HeartbeatMessage extends BaseMessage {
  type: "HEARTBEAT";
}

export interface ErrorMessage extends BaseMessage {
  type: "ERROR";
  code: string;
  message: string;
  requestId?: string;
}

// ── ACP (Agent Client Protocol) ──────────────────────────
//
// See docs/AGENT_RUNTIME.md for the architecture. These wire types
// mirror src/engine/types.ts — keep them in sync or the union breaks.

export interface AgentListAgentsMessage extends BaseMessage {
  type: "AGENT_LIST_AGENTS";
  force?: boolean;
}

export interface AgentNewSessionMessage extends BaseMessage {
  type: "AGENT_NEW_SESSION";
  agentId: string;
  cwd?: string;
  /** Env passed to the agent subprocess at spawn time. */
  env?: Record<string, string>;
}

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
  permissionId: string;
  response: RequestPermissionResponse;
}

/** Change the agent's session mode (ACP `session/set_mode`).
 *  Used by the composer permissions pill. Fire-and-forget —
 *  engine replies with AGENT_MODE_CHANGED (ack) or AGENT_ERROR. */
export interface AgentSetModeMessage extends BaseMessage {
  type: "AGENT_SET_MODE";
  agentId: string;
  sessionId: string;
  modeId: string;
}

export interface AgentModeChangedMessage extends BaseMessage {
  type: "AGENT_MODE_CHANGED";
  requestId: string;
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

export interface AgentAgentsListMessage extends BaseMessage {
  type: "AGENT_AGENTS_LIST";
  requestId: string;
  agents: BridgeRegistryAgent[];
}

export interface AgentSessionCreatedMessage extends BaseMessage {
  type: "AGENT_SESSION_CREATED";
  requestId: string;
  agentId: string;
  session: NewSessionResponse;
  initialize: InitializeResponse;
}

export interface AgentAuthCompletedMessage extends BaseMessage {
  type: "AGENT_AUTH_COMPLETED";
  requestId: string;
  agentId: string;
  methodId: string;
}

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

/** Discriminated-union payload mirroring the engine's AgentFailure.
 *  Lets the UI route deterministically instead of regex-matching
 *  `message`. The string `message` field stays populated as a
 *  fallback / log-friendly description. */
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
  /** New: structured classification. Populated by the engine since the
   *  `AgentFailure` refactor. Older engine builds won't send this — the UI
   *  falls back to `message` + `code` in that case. */
  failure?: BridgeAgentFailure;
}

// ── Union ────────────────────────────────────────────────

export type BridgeMessage =
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
  | AgentModeChangedMessage
  | AgentSessionsListMessage
  | AgentSessionLoadedMessage
  | AgentPromptCompleteMessage
  | AgentPromptFailedMessage
  | AgentAgentStderrMessage
  | AgentAgentExitedMessage
  | AgentErrorMessage;

// ── Helpers ──────────────────────────────────────────────

export function createMessageId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createMessage<T extends BridgeMessage>(
  msg: Omit<T, "id" | "timestamp">
): T {
  return {
    ...msg,
    id: createMessageId(),
    timestamp: Date.now(),
  } as T;
}
