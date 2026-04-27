// ──────────────────────────────────────────────────────────
// AgentSpec — declarative adapter shape
// ──────────────────────────────────────────────────────────
//
// Every per-CLI adapter that streams NDJSON output (Claude, Codex,
// Cursor, Amp, Droid) is now a thin spec object consumed by the shared
// `StreamJsonAdapter` base class. Per-agent files dropped from
// ~300-580 lines to ~100-200 — they capture only what's actually
// different (CLI args, env, translator, optional hook handler).
//
// What "different" means in practice:
//   - args — `claude -p ...` vs `codex exec ...` vs `cursor ...`
//   - env — Claude needs CLAUDE_CONFIG_DIR; others are stock
//   - translator — each agent emits different stream-json schema, so
//                  the per-agent translator class stays
//   - hooks — Claude/Droid/Copilot install settings.json hook config;
//             others don't
//   - resume — Codex tracks an internal threadId; Claude uses --resume
//              with our own UUID; others by file
//
// The base class owns: session map, dispose, respondToPermission,
// failure classification, hook server registration, the prompt
// spawn + drain + classify dance.
// ──────────────────────────────────────────────────────────

import type {
  AvailableCommand,
  ContentBlock,
  InitializeResponse,
  ListSessionsResponse,
  LoadSessionResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionMode,
  SessionNotification,
  StopReason,
} from "../../../../zeros/bridge/agent-events";

import type { AgentAdapterContext, HookEvent, HookResponse } from "../../types";

// ── Per-session state shape ──────────────────────────────
//
// Common state every adapter tracks. Spec implementations can extend
// via the `extra` slot for per-agent fields (e.g. Codex's threadId,
// Claude's settingsPath).

export interface SessionState<Extra = unknown> {
  sessionId: string;
  cwd: string;
  env?: Record<string, string>;
  /** Has the user sent a prompt yet? Determines first-vs-resume args. */
  primed: boolean;
  /** In-flight subprocess for the current turn, if any. */
  active: { kill: (signal?: NodeJS.Signals) => Promise<void> } | null;
  /** Pending permission resolvers, keyed by our permissionId. */
  pendingPermissions: Map<string, (r: RequestPermissionResponse) => void>;
  /** Per-session translator instance (recreated each prompt). */
  translator: StreamTranslator | null;
  /** Per-agent extension slot. */
  extra: Extra;
}

// ── Translator contract ──────────────────────────────────

export interface StreamTranslator {
  /** Feed a parsed stream-json object. May emit SessionNotifications. */
  feed(obj: unknown): void;
  /** True once a "result" event was observed (clean turn boundary). */
  readonly sawTerminal: boolean;
  /** Final stop reason from the result event. */
  readonly stopReason: StopReason;
}

// ── Permission escalation handle ─────────────────────────
//
// Passed to spec.handleHook so the per-agent hook handler can pop the
// permission UI without owning the round-trip plumbing. Resolves with
// the user's decision once the renderer answers.

export interface PermissionEscalator {
  request(args: {
    toolUseId: string;
    toolName: string;
    toolInput: unknown;
  }): Promise<"allow" | "deny" | "ask">;
}

// ── Spec interface ───────────────────────────────────────

export interface StreamJsonAgentSpec<Extra = unknown> {
  // ── Identity ──
  readonly agentId: string;
  readonly agentName: string;
  readonly protocolVersion: number;
  readonly cliBinary: string;

  // ── Static capability advertisement ──
  /** Modes shown in the chat-mode picker. Optional. */
  readonly modes?: {
    defaultId: string;
    available: SessionMode[];
  };

  /** Available slash-commands shown in the composer's "/" picker. */
  readonly availableCommands?: AvailableCommand[];

  // ── Per-session lifecycle hooks ──

  /** Build the initial extra-state for a fresh session. Called once
   *  during newSession AFTER the base class registers a hook-server
   *  handler that routes events through spec.handleHook. The hook
   *  token + url are provided so spec implementations that install
   *  hooks (Claude, Droid, Copilot) can write settings.json with the
   *  right token without re-registering. */
  initSessionExtra(args: {
    sessionId: string;
    ctx: AgentAdapterContext;
    cwd: string;
    /** Token the hook server issued for this session. */
    hookToken: string;
    /** Base URL of the local hook server. */
    hookUrl: string;
  }): Promise<Extra>;

  /** Optional cleanup when a session is disposed. Default: nothing. */
  disposeSessionExtra?(args: {
    sessionId: string;
    ctx: AgentAdapterContext;
    extra: Extra;
  }): Promise<void>;

  /** Optional pre-prompt setup (e.g. write hooks settings, copy creds).
   *  Called BEFORE every prompt spawn. Idempotent. Default: nothing. */
  beforePrompt?(state: SessionState<Extra>): Promise<void>;

  // ── Subprocess command shape ──

  /** CLI args for `<cliBinary> ...` for the prompt subprocess. */
  buildPromptArgs(args: {
    state: SessionState<Extra>;
    promptText: string;
  }): string[];

  /** Optional env additions on top of the parent process env. */
  buildPromptEnv?(state: SessionState<Extra>): Record<string, string>;

  /** Format ContentBlock[] into the plain text the CLI accepts.
   *  Default: text-and-resource-link concatenation. */
  formatPromptText?(blocks: ContentBlock[]): string;

  // ── Stream translator ──

  createTranslator(args: {
    sessionId: string;
    state: SessionState<Extra>;
    emit: (n: SessionNotification) => void;
  }): StreamTranslator;

  /** Optional: capture per-turn metadata from the translator (e.g.
   *  Codex's internal thread id) into session.extra so subsequent
   *  prompts can reference it. */
  captureAfterPrompt?(args: {
    state: SessionState<Extra>;
    translator: StreamTranslator;
  }): void;

  // ── Hooks (optional) ──
  //
  // Returning `undefined` from handleHook means "no hook config to
  // install" — the spec doesn't speak hooks.

  /** Returns the hook config writer used during newSession. */
  installHooks?(args: {
    sessionId: string;
    configDir: string;
    hookUrl: string;
    token: string;
  }): Promise<{ settingsPath: string }>;

  /** Per-event hook handler. Called by the hook server when the agent
   *  POSTs a hook event. The escalator gives access to the renderer's
   *  permission UI. */
  handleHook?(args: {
    state: SessionState<Extra>;
    event: HookEvent;
    escalator: PermissionEscalator;
  }): Promise<HookResponse>;

  // ── Mode + session management (optional) ──

  /** Default no-op. Spec implementations that want mode flags persist
   *  the modeId into state.extra and apply on next spawn. */
  setMode?(args: {
    state: SessionState<Extra>;
    modeId: string;
  }): void;

  /** loadSession — re-hydrate an existing session id. Default:
   *  re-create state with primed=true and emit no replay events. */
  loadSession?(args: {
    sessionId: string;
    cwd: string;
    env?: Record<string, string>;
    ctx: AgentAdapterContext;
    emit: (n: SessionNotification) => void;
  }): Promise<{
    response: LoadSessionResponse;
    extra: Extra;
  }>;

  /** Enumerate resumable sessions for the resume picker. Default: []. */
  listSessions?(args: {
    cwd?: string;
    cursor?: string | null;
    ctx: AgentAdapterContext;
  }): Promise<ListSessionsResponse>;

  // ── Initialize response synthesis ──
  //
  // Override only to advertise non-default capabilities. Default
  // returns a permissive InitializeResponse with sessionCapabilities.list.

  buildInitializeResponse?(): InitializeResponse;
}

// ── Re-exports for spec implementations ──────────────────

export type {
  AvailableCommand,
  ContentBlock,
  InitializeResponse,
  ListSessionsResponse,
  LoadSessionResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionMode,
  SessionNotification,
  StopReason,
};
