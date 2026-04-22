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
// See docs/ACP_INTEGRATION.md for the architecture. These wire types
// mirror src/engine/types.ts — keep them in sync or the union breaks.

export interface AcpListAgentsMessage extends BaseMessage {
  type: "ACP_LIST_AGENTS";
  force?: boolean;
}

export interface AcpNewSessionMessage extends BaseMessage {
  type: "ACP_NEW_SESSION";
  agentId: string;
  cwd?: string;
  /** Env passed to the agent subprocess at spawn time. */
  env?: Record<string, string>;
}

export interface AcpInitAgentMessage extends BaseMessage {
  type: "ACP_INIT_AGENT";
  agentId: string;
}

export interface AcpAuthenticateMessage extends BaseMessage {
  type: "ACP_AUTHENTICATE";
  agentId: string;
  methodId: string;
}

export interface AcpPromptMessage extends BaseMessage {
  type: "ACP_PROMPT";
  agentId: string;
  sessionId: string;
  prompt: ContentBlock[];
}

export interface AcpCancelMessage extends BaseMessage {
  type: "ACP_CANCEL";
  agentId: string;
  sessionId: string;
}

export interface AcpPermissionResponseMessage extends BaseMessage {
  type: "ACP_PERMISSION_RESPONSE";
  permissionId: string;
  response: RequestPermissionResponse;
}

/** Change the agent's session mode (ACP `session/set_mode`).
 *  Used by the composer permissions pill. Fire-and-forget —
 *  engine replies with ACP_MODE_CHANGED (ack) or ACP_ERROR. */
export interface AcpSetModeMessage extends BaseMessage {
  type: "ACP_SET_MODE";
  agentId: string;
  sessionId: string;
  modeId: string;
}

export interface AcpModeChangedMessage extends BaseMessage {
  type: "ACP_MODE_CHANGED";
  requestId: string;
  agentId: string;
  sessionId: string;
  modeId: string;
}

export interface AcpListSessionsMessage extends BaseMessage {
  type: "ACP_LIST_SESSIONS";
  agentId: string;
  cwd?: string;
  cursor?: string | null;
}

export interface AcpLoadSessionMessage extends BaseMessage {
  type: "ACP_LOAD_SESSION";
  agentId: string;
  sessionId: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface AcpSessionsListMessage extends BaseMessage {
  type: "ACP_SESSIONS_LIST";
  requestId: string;
  agentId: string;
  sessions: ListSessionsResponse["sessions"];
  nextCursor?: string | null;
}

export interface AcpSessionLoadedMessage extends BaseMessage {
  type: "ACP_SESSION_LOADED";
  requestId: string;
  agentId: string;
  sessionId: string;
  response: LoadSessionResponse;
}

export interface AcpAgentsListMessage extends BaseMessage {
  type: "ACP_AGENTS_LIST";
  requestId: string;
  agents: BridgeRegistryAgent[];
}

export interface AcpSessionCreatedMessage extends BaseMessage {
  type: "ACP_SESSION_CREATED";
  requestId: string;
  agentId: string;
  session: NewSessionResponse;
  initialize: InitializeResponse;
}

export interface AcpAuthCompletedMessage extends BaseMessage {
  type: "ACP_AUTH_COMPLETED";
  requestId: string;
  agentId: string;
  methodId: string;
}

export interface AcpAgentInitializedMessage extends BaseMessage {
  type: "ACP_AGENT_INITIALIZED";
  requestId: string;
  agentId: string;
  initialize: InitializeResponse;
}

export interface AcpSessionUpdateMessage extends BaseMessage {
  type: "ACP_SESSION_UPDATE";
  agentId: string;
  notification: SessionNotification;
}

export interface AcpPermissionRequestMessage extends BaseMessage {
  type: "ACP_PERMISSION_REQUEST";
  agentId: string;
  permissionId: string;
  request: RequestPermissionRequest;
}

export interface AcpPromptCompleteMessage extends BaseMessage {
  type: "ACP_PROMPT_COMPLETE";
  requestId: string;
  agentId: string;
  sessionId: string;
  stopReason: StopReason;
  response: PromptResponse;
}

export interface AcpPromptFailedMessage extends BaseMessage {
  type: "ACP_PROMPT_FAILED";
  requestId: string;
  agentId: string;
  sessionId: string;
  error: string;
}

export interface AcpAgentStderrMessage extends BaseMessage {
  type: "ACP_AGENT_STDERR";
  agentId: string;
  line: string;
}

export interface AcpAgentExitedMessage extends BaseMessage {
  type: "ACP_AGENT_EXITED";
  agentId: string;
  code: number | null;
  signal: string | null;
}

export interface AcpErrorMessage extends BaseMessage {
  type: "ACP_ERROR";
  requestId?: string;
  agentId?: string;
  code: string;
  message: string;
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
  | AcpListAgentsMessage
  | AcpNewSessionMessage
  | AcpInitAgentMessage
  | AcpAuthenticateMessage
  | AcpPromptMessage
  | AcpCancelMessage
  | AcpPermissionResponseMessage
  | AcpSetModeMessage
  | AcpListSessionsMessage
  | AcpLoadSessionMessage
  // ACP (engine → browser)
  | AcpAgentsListMessage
  | AcpSessionCreatedMessage
  | AcpAgentInitializedMessage
  | AcpAuthCompletedMessage
  | AcpSessionUpdateMessage
  | AcpPermissionRequestMessage
  | AcpModeChangedMessage
  | AcpSessionsListMessage
  | AcpSessionLoadedMessage
  | AcpPromptCompleteMessage
  | AcpPromptFailedMessage
  | AcpAgentStderrMessage
  | AcpAgentExitedMessage
  | AcpErrorMessage;

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
