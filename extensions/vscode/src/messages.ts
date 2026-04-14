// ──────────────────────────────────────────────────────────
// 0canvas Bridge Protocol — Shared message types
// ──────────────────────────────────────────────────────────
//
// KEEP IN SYNC WITH: src/0canvas/bridge/messages.ts
//
// ──────────────────────────────────────────────────────────

export type MessageSource = "browser" | "extension" | "vite";

export interface BaseMessage {
  id: string;
  source: MessageSource;
  timestamp: number;
}

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

export interface ConnectedMessage extends BaseMessage {
  type: "CONNECTED";
  role: MessageSource;
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

export interface ProjectStateSyncMessage extends BaseMessage {
  type: "PROJECT_STATE_SYNC";
  projectFile: string;
  filePath?: string;
}

export interface ProjectStateLoadedMessage extends BaseMessage {
  type: "PROJECT_STATE_LOADED";
  projectFile: string;
  filePath: string;
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

export interface AIChatResponseMessage extends BaseMessage {
  type: "AI_CHAT_RESPONSE";
  requestId: string;
  success: boolean;
  message: string;
  filesChanged?: string[];
}

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
  | AIChatResponseMessage;

export function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
