// ──────────────────────────────────────────────────────────
// 0canvas Engine Protocol — Message types for engine ↔ overlay
// ──────────────────────────────────────────────────────────
//
// Defines the WebSocket protocol between:
//   - Browser overlay (connects as WebSocket client)
//   - 0canvas Engine (Node.js process, WebSocket server)
//
// V2: The engine handles messages directly — no relay, no
// VS Code extension required.
//
// ──────────────────────────────────────────────────────────

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
  | OCFileChangedMessage;

// ── Helpers ──────────────────────────────────────────────

export function createMessageId(): string {
  // Node.js 19+ has crypto.randomUUID globally
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createMessage<T extends EngineMessage>(
  msg: Omit<T, "id" | "timestamp">
): T {
  return {
    ...msg,
    id: createMessageId(),
    timestamp: Date.now(),
  } as T;
}
