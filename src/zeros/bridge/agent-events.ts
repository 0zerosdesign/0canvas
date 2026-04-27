// ──────────────────────────────────────────────────────────
// Agent event types — wire format between engine + renderer
// ──────────────────────────────────────────────────────────
//
// Native event vocabulary owned by Zeros. Defines every shape
// the engine + renderer pass over the bridge — content blocks,
// tool calls, plan/mode/usage updates, permission flow.
// No external protocol dependency.
//
// Lives at the bridge layer because both processes consume them:
//   - engine (src/engine/agents/**) emits SessionNotification
//     payloads from each adapter's translator
//   - renderer (src/zeros/agent/**) folds them into the chat UI
//
// Shapes intentionally mirror what the engine adapters already
// emit — translators (Claude, Codex, Cursor, Amp, Droid, Gemini,
// Copilot) keep producing the same JSON; this module just gives
// us a type vocabulary we own.
//
// Phase 1 Stage 1A migrates ~27 import sites off the SDK and
// ends with the package dropped from package.json.
// ──────────────────────────────────────────────────────────

// ── Identifiers ─────────────────────────────────────────────

export type SessionId = string;
export type ToolCallId = string;
export type SessionModeId = string;
export type SessionModelId = string;

// ── Content blocks ──────────────────────────────────────────
//
// The basic unit of content inside a message chunk or tool-call
// payload. Mirrors the structure used by every adapter today.

export type ContentBlock =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceLinkContent
  | EmbeddedResourceContent;

export interface TextContent {
  type: "text";
  text: string;
  annotations?: ContentAnnotations;
}

export interface ImageContent {
  type: "image";
  data: string;       // base64
  mimeType: string;
  uri?: string;
  annotations?: ContentAnnotations;
}

export interface AudioContent {
  type: "audio";
  data: string;
  mimeType: string;
  annotations?: ContentAnnotations;
}

export interface ResourceLinkContent {
  type: "resource_link";
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  size?: number;
  title?: string;
  annotations?: ContentAnnotations;
}

export interface EmbeddedResourceContent {
  type: "resource";
  resource: TextResourceContents | BlobResourceContents;
  annotations?: ContentAnnotations;
}

export interface TextResourceContents {
  uri: string;
  text: string;
  mimeType?: string;
}

export interface BlobResourceContents {
  uri: string;
  blob: string;
  mimeType?: string;
}

export interface ContentAnnotations {
  audience?: Array<"user" | "assistant">;
  lastModified?: string;
  priority?: number;
}

// ── Tool calls ──────────────────────────────────────────────

/** Canonical tool category. Adapters set this so the renderer can
 *  pick the right card without guessing from `title`. New kinds
 *  (`subagent`, `clarifying_question`) are introduced in later
 *  Phase 1 stages — Stage 1A keeps the existing set 1:1. */
export type ToolKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "switch_mode"
  | "other";

export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";

/** Optional fields use `T | null | undefined` rather than `T | undefined`
 *  because the wire format carries `null` for cleared values (e.g. a
 *  tool-call update that resets `title` to nothing). Renderers/consumers
 *  treat both as absent. */
export interface ToolCall {
  toolCallId: ToolCallId;
  title: string;
  kind?: ToolKind | null;
  status?: ToolCallStatus | null;
  content?: ToolCallContent[] | null;
  locations?: ToolCallLocation[] | null;
  rawInput?: unknown;
  rawOutput?: unknown;
}

export interface ToolCallUpdate {
  toolCallId: ToolCallId;
  title?: string | null;
  kind?: ToolKind | null;
  status?: ToolCallStatus | null;
  content?: ToolCallContent[] | null;
  locations?: ToolCallLocation[] | null;
  rawInput?: unknown;
  rawOutput?: unknown;
}

export interface ToolCallLocation {
  path: string;
  line?: number;
}

export type ToolCallContent =
  | { type: "content"; content: ContentBlock }
  | { type: "diff"; path: string; oldText?: string; newText: string }
  | { type: "terminal"; terminalId: string };

// ── Plan / todo ─────────────────────────────────────────────

export type PlanEntryStatus = "pending" | "in_progress" | "completed";
export type PlanEntryPriority = "high" | "medium" | "low";

export interface PlanEntry {
  content: string;
  status: PlanEntryStatus;
  priority: PlanEntryPriority;
}

// ── Session-level state ────────────────────────────────────

export interface SessionMode {
  id: SessionModeId;
  name: string;
  description?: string;
}

export interface SessionModeState {
  currentModeId: SessionModeId;
  availableModes: SessionMode[];
}

export interface ModelInfo {
  modelId: SessionModelId;
  name: string;
  description?: string;
}

export interface SessionModelState {
  currentModelId: SessionModelId;
  availableModels: ModelInfo[];
}

export interface AvailableCommand {
  name: string;
  description: string;
  input?: { hint: string };
}

export interface UsageCost {
  inputCostUsd?: number;
  outputCostUsd?: number;
  totalCostUsd?: number;
}

export interface UsageStats {
  size: number;
  used: number;
  cost?: UsageCost;
}

// ── Session updates (the streaming notification payload) ────
//
// Engine adapters emit these over the bridge as the chat unfolds.
// Each variant carries enough fields to drive its renderer.

export type SessionUpdate =
  | UserMessageChunkUpdate
  | AgentMessageChunkUpdate
  | AgentThoughtChunkUpdate
  | ToolCallStartUpdate
  | ToolCallChangeUpdate
  | PlanUpdate
  | AvailableCommandsUpdate
  | CurrentModeUpdate
  | UsageUpdateNotification
  | SessionInfoUpdateNotification;

export interface UserMessageChunkUpdate {
  sessionUpdate: "user_message_chunk";
  content: ContentBlock;
  messageId?: string | null;
}

export interface AgentMessageChunkUpdate {
  sessionUpdate: "agent_message_chunk";
  content: ContentBlock;
  messageId?: string | null;
}

export interface AgentThoughtChunkUpdate {
  sessionUpdate: "agent_thought_chunk";
  content: ContentBlock;
  messageId?: string | null;
}

export interface ToolCallStartUpdate extends ToolCall {
  sessionUpdate: "tool_call";
}

export interface ToolCallChangeUpdate extends ToolCallUpdate {
  sessionUpdate: "tool_call_update";
}

export interface PlanUpdate {
  sessionUpdate: "plan";
  entries: PlanEntry[];
}

export interface AvailableCommandsUpdate {
  sessionUpdate: "available_commands_update";
  availableCommands: AvailableCommand[];
}

export interface CurrentModeUpdate {
  sessionUpdate: "current_mode_update";
  currentModeId: SessionModeId;
}

export interface UsageUpdateNotification {
  sessionUpdate: "usage_update";
  size: number;
  used: number;
  cost?: UsageCost;
}

export interface SessionInfoUpdateNotification {
  sessionUpdate: "session_info_update";
  title?: string;
  updatedAt?: string;
}

/** Top-level notification carried by AGENT_SESSION_UPDATE bridge
 *  messages. Maps `sessionId` to the session state it mutates. */
export interface SessionNotification {
  sessionId: SessionId;
  update: SessionUpdate;
}

// ── Permission flow ────────────────────────────────────────

export type PermissionOptionKind =
  | "allow_once"
  | "allow_always"
  | "reject_once"
  | "reject_always";

export interface PermissionOption {
  optionId: string;
  name: string;
  kind: PermissionOptionKind;
}

export interface RequestPermissionRequest {
  sessionId: SessionId;
  toolCall: ToolCall;
  options: PermissionOption[];
}

/** Outcome of a permission prompt. Discriminator is the inner
 *  `outcome` string — read as `response.outcome.outcome`. The
 *  shape is awkward but matches the existing wire format the
 *  engine adapters already produce. */
export type RequestPermissionOutcome =
  | { outcome: "cancelled" }
  | { outcome: "selected"; optionId: string };

export interface RequestPermissionResponse {
  outcome: RequestPermissionOutcome;
}

// ── Session lifecycle responses ────────────────────────────

export type StopReason =
  | "end_turn"
  | "max_tokens"
  | "max_turn_requests"
  | "refusal"
  | "cancelled";

export interface TurnUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  totalCostUsd?: number;
}

export interface PromptResponse {
  stopReason: StopReason;
  usage?: TurnUsage;
  userMessageId?: string;
}

export interface SessionInfo {
  sessionId: SessionId;
  cwd: string;
  title?: string;
  updatedAt?: string;
  additionalDirectories?: string[];
}

export interface NewSessionResponse {
  sessionId: SessionId;
  modes?: SessionModeState;
  models?: SessionModelState;
}

export interface LoadSessionResponse {
  modes?: SessionModeState;
  models?: SessionModelState;
}

export interface ListSessionsResponse {
  sessions: SessionInfo[];
  nextCursor?: string | null;
}

// ── Auth methods + capabilities ────────────────────────────

export interface AuthEnvVar {
  name: string;
  label?: string;
  optional?: boolean;
  secret?: boolean;
}

export type AuthMethod =
  | {
      type: "env_var";
      id: string;
      name: string;
      description?: string;
      link?: string;
      vars: AuthEnvVar[];
    }
  | {
      type: "terminal";
      id: string;
      name: string;
      description?: string;
    }
  | {
      type: "agent";
      id: string;
      name: string;
      description?: string;
    };

export interface PromptCapabilities {
  audio?: boolean;
  embeddedContext?: boolean;
  image?: boolean;
}

export interface AgentAuthCapabilities {
  terminal?: boolean;
}

export interface AgentCapabilities {
  loadSession?: boolean;
  promptCapabilities?: PromptCapabilities;
  auth?: AgentAuthCapabilities;
}

export interface AgentInfo {
  name?: string;
  version?: string;
}

export interface InitializeResponse {
  protocolVersion: number;
  agentCapabilities?: AgentCapabilities;
  authMethods?: AuthMethod[];
  agentInfo?: AgentInfo;
  /** Extensibility hatch — agents can attach arbitrary metadata
   *  (e.g. their advertised model catalog under `_meta.models`).
   *  Read by `model-catalog.ts` to pull per-agent catalogs from
   *  the InitializeResponse without inventing a new bridge field. */
  _meta?: { [key: string]: unknown } | null;
}
