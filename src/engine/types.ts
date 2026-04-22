// ──────────────────────────────────────────────────────────
// Zeros Engine Protocol — Message types for engine ↔ overlay
// ──────────────────────────────────────────────────────────
//
// Defines the WebSocket protocol between:
//   - Browser overlay (connects as WebSocket client)
//   - Zeros Engine (Node.js process, WebSocket server)
//
// V2: The engine handles messages directly — no relay, no
// VS Code extension required.
//
// ──────────────────────────────────────────────────────────

import type {
  ContentBlock,
  InitializeResponse,
  NewSessionResponse,
  PromptResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  StopReason,
} from "@agentclientprotocol/sdk";
import type { EnrichedRegistryAgent } from "./acp/registry.js";

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
// See docs/ACP_INTEGRATION.md for the end-to-end plan.
//
// Wire shapes reuse ACP SDK types where possible; we only declare the
// browser ↔ engine envelope, not the agent-side protocol.

// ── Browser → Engine

export interface AcpListAgentsMessage extends BaseMessage {
  type: "ACP_LIST_AGENTS";
  /** If true, bypass the on-disk cache and refetch from the CDN. */
  force?: boolean;
}

export interface AcpNewSessionMessage extends BaseMessage {
  type: "ACP_NEW_SESSION";
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
  /** Request id the engine assigned when it forwarded the permission prompt. */
  permissionId: string;
  response: RequestPermissionResponse;
}

export interface AcpSetModeMessage extends BaseMessage {
  type: "ACP_SET_MODE";
  agentId: string;
  sessionId: string;
  modeId: string;
}

// ── Engine → Browser

export interface AcpAgentsListMessage extends BaseMessage {
  type: "ACP_AGENTS_LIST";
  requestId: string;
  agents: EnrichedRegistryAgent[];
}

export interface AcpSessionCreatedMessage extends BaseMessage {
  type: "ACP_SESSION_CREATED";
  requestId: string;
  agentId: string;
  /** The raw SDK response so the browser has modes, configOptions, etc. */
  session: NewSessionResponse;
  /** Cached from the agent's initialize() response so the browser can render auth options. */
  initialize: InitializeResponse;
}

export interface AcpAuthCompletedMessage extends BaseMessage {
  type: "ACP_AUTH_COMPLETED";
  requestId: string;
  agentId: string;
  methodId: string;
}

/** Response to an ACP_INIT_AGENT — lets the browser read authMethods. */
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
  /** Id the browser must echo back in ACP_PERMISSION_RESPONSE. */
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

export interface AcpModeChangedMessage extends BaseMessage {
  type: "ACP_MODE_CHANGED";
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
  | AcpListAgentsMessage
  | AcpNewSessionMessage
  | AcpInitAgentMessage
  | AcpAuthenticateMessage
  | AcpPromptMessage
  | AcpCancelMessage
  | AcpPermissionResponseMessage
  | AcpSetModeMessage
  // ACP (engine → browser)
  | AcpAgentsListMessage
  | AcpSessionCreatedMessage
  | AcpAgentInitializedMessage
  | AcpAuthCompletedMessage
  | AcpSessionUpdateMessage
  | AcpPermissionRequestMessage
  | AcpPromptCompleteMessage
  | AcpPromptFailedMessage
  | AcpAgentStderrMessage
  | AcpAgentExitedMessage
  | AcpModeChangedMessage
  | AcpErrorMessage;

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
