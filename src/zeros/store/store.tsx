import React, { createContext, useContext, useReducer, ReactNode } from "react";
import type { OCProjectFile } from "../format/oc-project";
import { loadAiSettings } from "../lib/openai";

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export type ElementNode = {
  id: string;
  tag: string;
  classes: string[];
  children: ElementNode[];
  text?: string;
  styles: Record<string, string>;
  selector: string;
  visible: boolean;
  locked: boolean;
  componentName?: string;
};

export type ProjectConnection = {
  name: string;
  devServerUrl: string;
  productionUrl?: string;
  framework: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  errorMessage?: string;
};

export type BrainstormNote = {
  id: string;
  content: string;
  timestamp: number;
  linkedVersions: string[];
  color: string;
  category?: "feedback" | "idea" | "bug" | "improvement";
};

// ── Project types ──
export type OCProject = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  appUrl: string;
  saved: boolean;
};

// ── Theme Mode types ──
export type ThemeChangeItem = {
  id: string;
  elementId: string;
  elementSelector: string;
  elementTag: string;
  elementClasses: string[];
  property: string;              // "color", "background-color", etc.
  originalValue: string;         // computed value before change
  /** var() resolution chain, e.g. ["--text-primary", "--blue-600", "#2563EB"] — check:ui ignore-line */
  originalTokenChain: string[];
  originalSourceSelector: string; // CSS rule that originally set this, e.g. ".demo-card"
  originalSourceType: "rule" | "inline" | "inherited";
  newToken: string;              // token name applied, e.g. "--green-500"
  newValue: string;              // resolved value of the new token
  timestamp: number;
  boundingBox: { x: number; y: number; width: number; height: number };
};

// ── Feedback / Agent Waitlist types ──
export type FeedbackIntent = "fix" | "change" | "question" | "approve";
export type FeedbackSeverity = "blocking" | "important" | "suggestion";

export type FeedbackItem = {
  id: string;
  variantId: string;
  elementId: string;
  elementSelector: string;
  elementTag: string;
  elementClasses: string[];
  comment: string;
  intent: FeedbackIntent;
  severity: FeedbackSeverity;
  status: "pending" | "sent" | "resolved";
  timestamp: number;
  computedStyles?: Record<string, string>;
  boundingBox?: { x: number; y: number; width: number; height: number };
};

// ── Variant types ──
export type VariantData = {
  id: string;
  name: string;
  html: string;
  css: string;
  mockData: {
    images: string[];
    texts: string[];
  };
  sourceType: "page" | "component";
  sourceSelector?: string;
  sourceElementId?: string | null;
  sourcePageRoute?: string;
  sourceOuterHTML?: string;
  parentId: string | null;
  status: "draft" | "finalized" | "sent" | "pushed";
  createdAt: number;
  modifiedHtml?: string;
  modifiedCss?: string;
  sourceViewportWidth?: number;
  sourceContentHeight?: number;
};

export type AppView = "onboarding" | "workspace";
export type WorkspacePage = "design" | "themes" | "settings";
export type DesignMode = "style" | "feedback";
export type Breakpoint = "desktop" | "laptop" | "tablet" | "mobile";

export const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  desktop: 1440,
  laptop: 1280,
  tablet: 768,
  mobile: 375,
};
// Phase 4 introduces the CLI-subprocess backends. Legacy values
// ("chatgpt" / "openai" / "ide") stay in the union so existing
// saved settings round-trip — loadAiSettings() migrates them to
// the new values on read.
export type AiProvider =
  | "claude"
  | "codex"
  // legacy, kept for backward-compat on reload
  | "chatgpt"
  | "openai"
  | "ide";

export type AiAuthMethod = "subscription" | "api-key";
export type AiThinkingEffort = "low" | "medium" | "high" | "xhigh";
export type AiPermissionMode = "plan" | "ask" | "auto-edit" | "full";

export type AiSettings = {
  provider: AiProvider;
  authMethod: AiAuthMethod;
  proxyUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  autoSendFeedback: boolean;
  thinkingEffort: AiThinkingEffort;
  /** Default permission mode for new chats. Individual chats may
   *  override this; for now the composer reads/writes this global
   *  default — per-chat override is in the Stream 5 TODO. */
  permissionMode: AiPermissionMode;
  agentTeams: boolean;
};
export type ViewMode = "canvas" | "fullscreen";

// ── Theme / Token types ──
export type TokenSyntax = "color" | "length-percentage" | "percentage" | "number" | "angle" | "time" | "*";

export type DesignToken = {
  name: string;          // e.g. "--blue-500"
  /** themeId → value, e.g. { default: "#3B82F6", light: "#2563EB" } — check:ui ignore-line */
  values: Record<string, string>;
  syntax: TokenSyntax;
  description: string;
  inherits: boolean;
  group: string;         // derived from name, e.g. "blue"
};

export type ThemeColumn = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type ThemeFile = {
  id: string;
  name: string;          // filename, e.g. "variables.css"
  // In the Mac app we keep an absolute path; the browser-only File
  // System Access API handle stays around for the legacy dev harness.
  // One of the two must be set.
  handle: FileSystemFileHandle | null;
  path: string | null;
  content: string;       // raw CSS content
  tokens: DesignToken[];
  themes: ThemeColumn[];
  lastSynced: number;
};

export type ThemesState = {
  files: ThemeFile[];
  activeFileId: string | null;
  selectedTokens: Set<string>; // set of token names
  searchQuery: string;
  editingToken: string | null; // token name being edited in detail panel
};

export type WorkspaceState = {
  // App-level
  currentView: AppView;
  project: ProjectConnection | null;

  // Element tree
  elements: ElementNode[];
  selectedElementId: string | null;
  hoveredElementId: string | null;

  // Feedback
  feedbackItems: FeedbackItem[];

  // Selection source tracking
  selectionSource: "inspect" | "panel" | null;

  // Variants
  variants: VariantData[];
  activeVariantId: string | null;

  // Project management
  ocProject: OCProject;
  ocProjectFile: OCProjectFile | null;

  // Route switching
  currentRoute: string;
  routeHistory: string[];

  // UI state
  activePage: WorkspacePage;
  designMode: DesignMode;
  viewMode: ViewMode;
  activeBreakpoint: Breakpoint;
  inspectorMode: boolean;
  stylePanelOpen: boolean;
  showInlineEdit: boolean;
  showCommandPalette: boolean;
  showVisualDiff: { before: { html: string; css: string }; after: { html: string; css: string }; variantName: string } | null;
  isLoading: boolean;

  // Themes
  themes: ThemesState;

  // Theme Mode (color inspection)
  themeMode: boolean;
  themeChanges: ThemeChangeItem[];

  // AI settings
  aiSettings: AiSettings;

  // Chat threads (Phase 1B-e). Persisted via src/native/settings.ts;
  // `activeChatId` scopes which conversation the Column 2 Chat panel
  // is currently rendering. Messages are kept per-mount inside
  // AIChatPanel; switching chats remounts with a fresh message list.
  chats: ChatThread[];
  activeChatId: string | null;

  // One-shot hand-off to Column 2's chat panel (Phase 2-B). InlineEdit
  // and the feedback pill used to call the AI themselves; in the Mac
  // app all AI flows route into the integrated chat instead. Setting
  // this triggers Column 2 to switch to the Chat tab, AIChatPanel to
  // auto-submit the text, then clear via CONSUME_CHAT_SUBMISSION.
  pendingChatSubmission: PendingChatSubmission | null;

  // Scope override for the EmptyComposer. Normally the new-agent
  // surface resolves its folder from the engine's project root. When
  // the user clicks "+" on a secondary workspace section in Column 1,
  // we want the empty composer to be contextual to *that* workspace,
  // not the engine root — so the first chat created from it lands in
  // the right project. Cleared by the composer after ADD_CHAT.
  newAgentFolder: string | null;

  // Bumps every time the user swaps the engine project root via Open
  // Workspace. Project-scoped consumers (column 1's currentRoot probe,
  // column 3 file tree, terminal, git panel) read this in their effect
  // deps so they refresh without needing a full webview reload.
  // Source-of-truth on the new root lives in the native engine — we
  // don't carry the path in the store, only the generation counter.
  projectGeneration: number;
};

export type PendingChatSubmission = {
  id: string;
  text: string;
  source: "inline-edit" | "feedback" | "manual";
};

/** How much reasoning effort the model should spend before replying.
 *  Mapped per-agent to the right flag/env on session spawn. */
export type ChatEffort = "low" | "medium" | "high" | "xhigh";

/** Permission gate for tool-call execution within a chat. */
export type ChatPermissionMode =
  | "full"         // auto-approve everything
  | "auto-edit"    // auto-approve reads + file edits
  | "ask"          // prompt before writes/commands
  | "plan-only";   // agent plans but doesn't execute

export type ChatThread = {
  id: string;
  /** Absolute path of the project this chat belongs to, or "" for the
   *  ambient "No project" folder when Zeros hasn't been rooted yet.
   *  Doubles as the cwd for the ACP session, git panel, terminal, env. */
  folder: string;
  /** ACP agent id bound to this chat. null means "pick the default agent
   *  when the session first starts" — set once and immutable thereafter. */
  agentId: string | null;
  /** Human label for the agent (e.g. "Claude Agent"). Cached on chat
   *  creation so the header can render without a registry lookup. */
  agentName: string | null;
  /** Model id (agent-specific — e.g. "claude-opus-4-7" for claude-acp).
   *  null means "use the agent's default". Changing forces session respawn
   *  because most agents read the model from env at spawn time. */
  model: string | null;
  /** Reasoning effort — mapped to each agent's flag/env at spawn. */
  effort: ChatEffort;
  /** Permission gate. Plumbed via ACP session/set_mode when the agent
   *  advertises mode support; otherwise stored and applied to new
   *  sessions. */
  permissionMode: ChatPermissionMode;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Persistent ACP/agent sessionId. Source-of-truth link from a chat
   *  in our sidebar to the on-disk transcript the agent CLI writes
   *  (Claude: ~/.claude/projects/<hash>/<sessionId>.jsonl, Codex:
   *  ~/.codex/sessions/...). Set in three ways:
   *    - "Resume from recent thread" UI seeds it on chat creation.
   *    - First successful new-session creation writes it back.
   *    - It updates whenever the active agent forks / starts a new
   *      session under the same chat (model swap with force=true).
   *  Provider state is a hot cache; this field survives app restarts
   *  and is what lets us replay history on next mount. Cleared if a
   *  loadIntoChat fails so retry can fall through to a fresh session. */
  sessionId?: string;
  /** Pinned to the top of the sidebar, independent of project grouping.
   *  Cursor-style favorites. Defaults to false / undefined for old records. */
  pinned?: boolean;
  /** Soft-deleted. Archived chats hide from the main sidebar groupings
   *  (pinned + per-project) and surface in a collapsible "Archived"
   *  section at the bottom, where they can be restored or permanently
   *  deleted. The on-disk transcript is never touched by archive —
   *  only DELETE_CHAT removes the metadata entry. */
  archived?: boolean;
  /** Chat that spawned this one via agent-switch. When set and this chat
   *  has no messages yet, the composer offers a "summary handoff" pill
   *  at the top so the user can paste the prior conversation into the
   *  new agent's first turn. Cleared the moment the user either accepts
   *  or dismisses the handoff. */
  sourceChatId?: string;
};

type Action =
  | { type: "SELECT_ELEMENT"; id: string | null; source?: "inspect" | "panel" }
  | { type: "HOVER_ELEMENT"; id: string | null }
  | { type: "UPDATE_STYLE"; elementId: string; property: string; value: string }
  | { type: "SET_ELEMENT_STYLES"; id: string; styles: Record<string, string> }
  | { type: "SET_ACTIVE_PAGE"; page: WorkspacePage }
  | { type: "TOGGLE_INSPECTOR" }
  | { type: "TOGGLE_STYLE_PANEL" }
  | { type: "TOGGLE_ELEMENT_VISIBILITY"; id: string }
  | { type: "TOGGLE_ELEMENT_LOCK"; id: string }
  | { type: "SET_ELEMENTS"; elements: ElementNode[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "CLEAR_PAGE" }
  | { type: "SET_VIEW"; view: AppView }
  | { type: "CONNECT_PROJECT"; project: ProjectConnection }
  | { type: "UPDATE_PROJECT_STATUS"; status: ProjectConnection["status"]; errorMessage?: string }
  | { type: "DISCONNECT_PROJECT" }
  // Feedback / Agent Waitlist actions
  | { type: "ADD_FEEDBACK"; item: FeedbackItem }
  | { type: "UPDATE_FEEDBACK"; id: string; updates: Partial<FeedbackItem> }
  | { type: "REMOVE_FEEDBACK"; id: string }
  | { type: "CLEAR_FEEDBACK" }
  | { type: "MARK_FEEDBACK_SENT"; ids: string[] }
  // Variant actions
  | { type: "ADD_VARIANT"; variant: VariantData }
  | { type: "UPDATE_VARIANT"; id: string; updates: Partial<VariantData> }
  | { type: "DELETE_VARIANT"; id: string }
  | { type: "SET_ACTIVE_VARIANT"; id: string | null }
  | { type: "FINALIZE_VARIANT"; id: string }
  | { type: "PUSH_VARIANT_TO_MAIN"; id: string }
  // Project management actions
  | { type: "SET_OC_PROJECT_NAME"; name: string }
  | { type: "SAVE_OC_PROJECT" }
  | { type: "LOAD_OC_PROJECT"; project: OCProject; variants: VariantData[]; feedbackItems: FeedbackItem[] }
  | { type: "SET_OC_PROJECT_FILE"; file: OCProjectFile | null }
  | { type: "LOAD_FROM_OC_FILE"; file: OCProjectFile; project: OCProject; variants: VariantData[]; feedbackItems: FeedbackItem[] }
  // Route actions
  | { type: "SET_CURRENT_ROUTE"; route: string }
  | { type: "ADD_ROUTE_HISTORY"; route: string }
  // Theme Mode actions
  | { type: "TOGGLE_THEME_MODE" }
  | { type: "ADD_THEME_CHANGE"; item: ThemeChangeItem }
  | { type: "UPDATE_THEME_CHANGE"; id: string; updates: Partial<ThemeChangeItem> }
  | { type: "REMOVE_THEME_CHANGE"; id: string }
  | { type: "CLEAR_THEME_CHANGES" }
  // Themes actions
  | { type: "ADD_THEME_FILE"; file: ThemeFile }
  | { type: "REMOVE_THEME_FILE"; id: string }
  | { type: "SET_ACTIVE_THEME_FILE"; id: string | null }
  | { type: "UPDATE_THEME_FILE"; id: string; updates: Partial<ThemeFile> }
  | { type: "SET_THEME_TOKENS"; fileId: string; tokens: DesignToken[]; themes: ThemeColumn[] }
  | { type: "UPDATE_TOKEN_VALUE"; fileId: string; tokenName: string; themeId: string; value: string }
  | { type: "UPDATE_TOKEN_META"; fileId: string; tokenName: string; updates: Partial<DesignToken> }
  | { type: "ADD_THEME_COLUMN"; fileId: string; theme: ThemeColumn }
  | { type: "REMOVE_THEME_COLUMN"; fileId: string; themeId: string }
  | { type: "SET_SELECTED_TOKENS"; tokens: Set<string> }
  | { type: "TOGGLE_TOKEN_SELECTION"; tokenName: string }
  | { type: "SET_THEME_SEARCH"; query: string }
  | { type: "SET_EDITING_TOKEN"; tokenName: string | null }
  | { type: "RENAME_TOKENS"; fileId: string; renames: { from: string; to: string }[] }
  | { type: "DELETE_TOKENS"; fileId: string; tokenNames: string[] }
  | { type: "ADD_TOKENS"; fileId: string; tokens: DesignToken[] }
  // View mode
  | { type: "SET_VIEW_MODE"; mode: ViewMode }
  | { type: "SET_DESIGN_MODE"; mode: DesignMode }
  | { type: "SET_AI_SETTINGS"; settings: AiSettings }
  | { type: "SET_BREAKPOINT"; breakpoint: Breakpoint }
  | { type: "SHOW_INLINE_EDIT"; show: boolean }
  | { type: "SHOW_COMMAND_PALETTE"; show: boolean }
  | { type: "SHOW_VISUAL_DIFF"; diff: WorkspaceState["showVisualDiff"] }
  // Chat threading (Phase 1B-e)
  | { type: "HYDRATE_CHATS"; chats: ChatThread[]; activeChatId: string | null }
  | { type: "ADD_CHAT"; chat: ChatThread }
  | { type: "SET_ACTIVE_CHAT"; id: string | null }
  | { type: "DELETE_CHAT"; id: string }
  | { type: "ARCHIVE_CHAT"; id: string }
  | { type: "UNARCHIVE_CHAT"; id: string }
  | { type: "UPDATE_CHAT_TITLE"; id: string; title: string }
  | { type: "UPDATE_CHAT_SETTINGS"; id: string; updates: Partial<Pick<ChatThread, "model" | "effort" | "permissionMode" | "agentId" | "agentName" | "sessionId" | "sourceChatId">> }
  | { type: "TOUCH_CHAT"; id: string }
  | { type: "TOGGLE_PIN_CHAT"; id: string }
  // Auto-submit into Column 2 chat (Phase 2-B)
  | { type: "ENQUEUE_CHAT_SUBMISSION"; submission: PendingChatSubmission }
  | { type: "CONSUME_CHAT_SUBMISSION"; id: string }
  // EmptyComposer scope override — see newAgentFolder doc on WorkspaceState.
  | { type: "SET_NEW_AGENT_FOLDER"; folder: string | null }
  | { type: "BUMP_PROJECT_GENERATION" }

// ──────────────────────────────────────────────────────────
// IDE definitions
// ──────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────
// Initial state
// ──────────────────────────────────────────────────────────
const initialState: WorkspaceState = {
  currentView: "workspace",
  project: null,
  elements: [],
  selectedElementId: null,
  hoveredElementId: null,
  feedbackItems: [],
  selectionSource: null,
  variants: [],
  activeVariantId: null,
  ocProject: {
    id: `proj-${Date.now()}`,
    name: "Untitled",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    appUrl: typeof window !== "undefined" ? window.location.origin : "",
    saved: false,
  },
  ocProjectFile: null,
  currentRoute: typeof window !== "undefined" ? window.location.pathname : "/",
  routeHistory: typeof window !== "undefined" ? [window.location.pathname] : ["/"],
  activePage: "design",
  designMode: "style",
  viewMode: "canvas",
  activeBreakpoint: "desktop",
  inspectorMode: true,
  stylePanelOpen: true,
  showInlineEdit: false,
  showCommandPalette: false,
  showVisualDiff: null,
  isLoading: false,
  themes: {
    files: [],
    activeFileId: null,
    selectedTokens: new Set(),
    searchQuery: "",
    editingToken: null,
  },
  themeMode: false,
  themeChanges: [],
  aiSettings: loadAiSettings(),
  chats: [],
  activeChatId: null,
  pendingChatSubmission: null,
  newAgentFolder: null,
  projectGeneration: 0,
};

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/** Derive group name from a CSS custom property name, e.g. "--blue-500" → "blue", "--text-muted" → "color" */
export function deriveGroup(name: string): string {
  const stripped = name.replace(/^--/, "");
  const dashIdx = stripped.indexOf("-");
  const doubleDashIdx = stripped.indexOf("--");
  if (doubleDashIdx > 0) return stripped.substring(0, doubleDashIdx);
  if (dashIdx > 0) return stripped.substring(0, dashIdx);
  return stripped;
}

function findElement(elements: ElementNode[], id: string): ElementNode | null {
  for (const el of elements) {
    if (el.id === id) return el;
    const found = findElement(el.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * Walk the tree looking for the first element whose canonical selector
 * matches. Used by ACP follow-along so the canvas can jump to the element
 * the agent just edited. Returns null when nothing matches — callers
 * should treat that as "agent edited a selector we don't have a live node
 * for" (happens for variants rendered off-screen).
 */
export function findBySelector(
  elements: ElementNode[],
  selector: string,
): ElementNode | null {
  if (!selector) return null;
  for (const el of elements) {
    if (el.selector === selector) return el;
    const found = findBySelector(el.children, selector);
    if (found) return found;
  }
  return null;
}

function updateElementInTree(
  elements: ElementNode[],
  id: string,
  updater: (el: ElementNode) => ElementNode
): ElementNode[] {
  return elements.map((el) => {
    if (el.id === id) return updater(el);
    return { ...el, children: updateElementInTree(el.children, id, updater) };
  });
}

// ──────────────────────────────────────────────────────────
// Reducer
// ──────────────────────────────────────────────────────────
function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "SELECT_ELEMENT":
      return { ...state, selectedElementId: action.id, selectionSource: action.source || "panel" };
    case "HOVER_ELEMENT":
      return { ...state, hoveredElementId: action.id };
    case "UPDATE_STYLE": {
      return {
        ...state,
        elements: updateElementInTree(state.elements, action.elementId, (el) => ({
          ...el,
          styles: { ...el.styles, [action.property]: action.value },
        })),
      };
    }
    case "SET_ELEMENT_STYLES":
      return {
        ...state,
        elements: updateElementInTree(state.elements, action.id, (el) => ({
          ...el,
          styles: action.styles,
        })),
      };
    case "SET_ACTIVE_PAGE":
      return { ...state, activePage: action.page };
    case "TOGGLE_INSPECTOR":
      return { ...state, inspectorMode: !state.inspectorMode };
    case "TOGGLE_STYLE_PANEL":
      return { ...state, stylePanelOpen: !state.stylePanelOpen, themeMode: false };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
    case "SET_DESIGN_MODE":
      return { ...state, designMode: action.mode };
    case "SET_AI_SETTINGS":
      return { ...state, aiSettings: action.settings };
    case "SET_BREAKPOINT":
      return { ...state, activeBreakpoint: action.breakpoint };
    case "SHOW_INLINE_EDIT":
      return { ...state, showInlineEdit: action.show };
    case "SHOW_COMMAND_PALETTE":
      return { ...state, showCommandPalette: action.show };
    case "SHOW_VISUAL_DIFF":
      return { ...state, showVisualDiff: action.diff };
    // ── Chat threads ──────────────────────────────────────
    case "HYDRATE_CHATS":
      return { ...state, chats: action.chats, activeChatId: action.activeChatId };
    case "ADD_CHAT":
      // Creating a chat consumes the EmptyComposer scope — the chat
      // now carries its own folder, so the override is stale.
      return {
        ...state,
        chats: [...state.chats, action.chat],
        activeChatId: action.chat.id,
        newAgentFolder: null,
      };
    case "SET_ACTIVE_CHAT":
      // Activating an existing chat also clears the scope override;
      // the user left the new-agent surface. Only the empty case
      // preserves the override so "+" on a workspace flows through.
      return {
        ...state,
        activeChatId: action.id,
        newAgentFolder: action.id === null ? state.newAgentFolder : null,
      };
    case "DELETE_CHAT": {
      const next = state.chats.filter((c) => c.id !== action.id);
      return {
        ...state,
        chats: next,
        activeChatId:
          state.activeChatId === action.id
            ? next[next.length - 1]?.id ?? null
            : state.activeChatId,
      };
    }
    case "ARCHIVE_CHAT": {
      // Soft-delete: flip the archived flag and drop the active
      // selection if the archived chat was open. Pin is cleared so the
      // chat doesn't reappear in pinned the moment it's restored — the
      // user can re-pin from Archived if they want.
      const target = state.chats.find((c) => c.id === action.id);
      if (!target || target.archived) return state;
      return {
        ...state,
        chats: state.chats.map((c) =>
          c.id === action.id ? { ...c, archived: true, pinned: false } : c,
        ),
        activeChatId:
          state.activeChatId === action.id ? null : state.activeChatId,
      };
    }
    case "UNARCHIVE_CHAT": {
      const target = state.chats.find((c) => c.id === action.id);
      if (!target || !target.archived) return state;
      return {
        ...state,
        chats: state.chats.map((c) =>
          c.id === action.id ? { ...c, archived: false } : c,
        ),
      };
    }
    case "UPDATE_CHAT_TITLE":
      return {
        ...state,
        chats: state.chats.map((c) =>
          c.id === action.id ? { ...c, title: action.title, updatedAt: Date.now() } : c,
        ),
      };
    case "UPDATE_CHAT_SETTINGS":
      return {
        ...state,
        chats: state.chats.map((c) =>
          c.id === action.id
            ? { ...c, ...action.updates, updatedAt: Date.now() }
            : c,
        ),
      };
    case "TOUCH_CHAT":
      return {
        ...state,
        chats: state.chats.map((c) =>
          c.id === action.id ? { ...c, updatedAt: Date.now() } : c,
        ),
      };
    case "TOGGLE_PIN_CHAT":
      return {
        ...state,
        chats: state.chats.map((c) =>
          c.id === action.id ? { ...c, pinned: !c.pinned } : c,
        ),
      };
    case "ENQUEUE_CHAT_SUBMISSION":
      return { ...state, pendingChatSubmission: action.submission };
    case "CONSUME_CHAT_SUBMISSION":
      // Only clear if the id matches — prevents a race where a new
      // submission lands between AIChatPanel reading and dispatching.
      if (state.pendingChatSubmission?.id !== action.id) return state;
      return { ...state, pendingChatSubmission: null };
    case "SET_NEW_AGENT_FOLDER":
      return { ...state, newAgentFolder: action.folder };
    case "BUMP_PROJECT_GENERATION":
      return { ...state, projectGeneration: state.projectGeneration + 1 };
    case "TOGGLE_ELEMENT_VISIBILITY":
      return {
        ...state,
        elements: updateElementInTree(state.elements, action.id, (el) => ({
          ...el,
          visible: !el.visible,
        })),
      };
    case "TOGGLE_ELEMENT_LOCK":
      return {
        ...state,
        elements: updateElementInTree(state.elements, action.id, (el) => ({
          ...el,
          locked: !el.locked,
        })),
      };
    case "SET_ELEMENTS":
      return {
        ...state,
        elements: action.elements,
        selectedElementId: null,
        hoveredElementId: null,
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "CLEAR_PAGE":
      return {
        ...state,
        elements: [],
        selectedElementId: null,
        hoveredElementId: null,
      };
    case "SET_VIEW":
      return { ...state, currentView: action.view };
    case "CONNECT_PROJECT":
      return {
        ...state,
        project: action.project,
        currentView: "workspace",
      };
    case "UPDATE_PROJECT_STATUS":
      return {
        ...state,
        project: state.project
          ? { ...state.project, status: action.status, errorMessage: action.errorMessage }
          : null,
      };
    case "DISCONNECT_PROJECT":
      return {
        ...state,
        project: null,
        currentView: "onboarding",
        elements: [],
        selectedElementId: null,
        hoveredElementId: null,
      };
    // Feedback / Agent Waitlist
    case "ADD_FEEDBACK":
      return { ...state, feedbackItems: [...state.feedbackItems, action.item] };
    case "UPDATE_FEEDBACK":
      return {
        ...state,
        feedbackItems: state.feedbackItems.map((f) =>
          f.id === action.id ? { ...f, ...action.updates } : f
        ),
      };
    case "REMOVE_FEEDBACK":
      return {
        ...state,
        feedbackItems: state.feedbackItems.filter((f) => f.id !== action.id),
      };
    case "CLEAR_FEEDBACK":
      return { ...state, feedbackItems: [] };
    case "MARK_FEEDBACK_SENT":
      return {
        ...state,
        feedbackItems: state.feedbackItems.map((f) =>
          action.ids.includes(f.id) ? { ...f, status: "sent" as const } : f
        ),
      };
    // Variant actions
    case "ADD_VARIANT":
      return { ...state, variants: [...state.variants, action.variant] };
    case "UPDATE_VARIANT":
      return {
        ...state,
        variants: state.variants.map((v) =>
          v.id === action.id ? { ...v, ...action.updates } : v
        ),
      };
    case "DELETE_VARIANT":
      return {
        ...state,
        variants: state.variants.filter((v) => v.id !== action.id),
        activeVariantId: state.activeVariantId === action.id ? null : state.activeVariantId,
      };
    case "SET_ACTIVE_VARIANT":
      return { ...state, activeVariantId: action.id };
    case "FINALIZE_VARIANT":
      return {
        ...state,
        variants: state.variants.map((v) =>
          v.id === action.id ? { ...v, status: "finalized" as const } : v
        ),
      };
    case "PUSH_VARIANT_TO_MAIN":
      return {
        ...state,
        variants: state.variants.map((v) =>
          v.id === action.id ? { ...v, status: "pushed" as const } : v
        ),
      };
    // Project management
    case "SET_OC_PROJECT_NAME":
      return {
        ...state,
        ocProject: { ...state.ocProject, name: action.name, updatedAt: Date.now() },
      };
    case "SAVE_OC_PROJECT":
      return {
        ...state,
        ocProject: { ...state.ocProject, saved: true, updatedAt: Date.now() },
      };
    case "LOAD_OC_PROJECT":
      return {
        ...state,
        ocProject: action.project,
        variants: action.variants,
        feedbackItems: action.feedbackItems,
      };
    case "SET_OC_PROJECT_FILE":
      return { ...state, ocProjectFile: action.file };
    case "LOAD_FROM_OC_FILE":
      return {
        ...state,
        ocProjectFile: action.file,
        ocProject: action.project,
        variants: action.variants,
        feedbackItems: action.feedbackItems,
      };
    // Route actions
    case "SET_CURRENT_ROUTE":
      return { ...state, currentRoute: action.route };
    case "ADD_ROUTE_HISTORY": {
      const history = state.routeHistory.includes(action.route)
        ? state.routeHistory
        : [...state.routeHistory, action.route];
      return { ...state, routeHistory: history };
    }
    // ── Theme Mode ─────────────────────────────────────────
    case "TOGGLE_THEME_MODE": {
      const entering = !state.themeMode;
      return {
        ...state,
        themeMode: entering,
        stylePanelOpen: entering ? false : state.stylePanelOpen,
      };
    }
    case "ADD_THEME_CHANGE":
      return { ...state, themeChanges: [...state.themeChanges, action.item] };
    case "UPDATE_THEME_CHANGE":
      return {
        ...state,
        themeChanges: state.themeChanges.map((c) =>
          c.id === action.id ? { ...c, ...action.updates } : c
        ),
      };
    case "REMOVE_THEME_CHANGE":
      return { ...state, themeChanges: state.themeChanges.filter((c) => c.id !== action.id) };
    case "CLEAR_THEME_CHANGES":
      return { ...state, themeChanges: [] };
    // ── Themes ──────────────────────────────────────────────
    case "ADD_THEME_FILE":
      return { ...state, themes: { ...state.themes, files: [...state.themes.files, action.file], activeFileId: action.file.id } };
    case "REMOVE_THEME_FILE":
      return {
        ...state,
        themes: {
          ...state.themes,
          files: state.themes.files.filter((f) => f.id !== action.id),
          activeFileId: state.themes.activeFileId === action.id ? null : state.themes.activeFileId,
        },
      };
    case "SET_ACTIVE_THEME_FILE":
      return { ...state, themes: { ...state.themes, activeFileId: action.id } };
    case "UPDATE_THEME_FILE":
      return {
        ...state,
        themes: {
          ...state.themes,
          files: state.themes.files.map((f) => (f.id === action.id ? { ...f, ...action.updates } : f)),
        },
      };
    case "SET_THEME_TOKENS":
      return {
        ...state,
        themes: {
          ...state.themes,
          files: state.themes.files.map((f) =>
            f.id === action.fileId ? { ...f, tokens: action.tokens, themes: action.themes, lastSynced: Date.now() } : f
          ),
        },
      };
    case "UPDATE_TOKEN_VALUE":
      return {
        ...state,
        themes: {
          ...state.themes,
          files: state.themes.files.map((f) =>
            f.id === action.fileId
              ? {
                  ...f,
                  tokens: f.tokens.map((t) =>
                    t.name === action.tokenName
                      ? { ...t, values: { ...t.values, [action.themeId]: action.value } }
                      : t
                  ),
                }
              : f
          ),
        },
      };
    case "UPDATE_TOKEN_META":
      return {
        ...state,
        themes: {
          ...state.themes,
          files: state.themes.files.map((f) =>
            f.id === action.fileId
              ? { ...f, tokens: f.tokens.map((t) => (t.name === action.tokenName ? { ...t, ...action.updates } : t)) }
              : f
          ),
        },
      };
    case "ADD_THEME_COLUMN":
      return {
        ...state,
        themes: {
          ...state.themes,
          files: state.themes.files.map((f) =>
            f.id === action.fileId ? { ...f, themes: [...f.themes, action.theme] } : f
          ),
        },
      };
    case "REMOVE_THEME_COLUMN":
      return {
        ...state,
        themes: {
          ...state.themes,
          files: state.themes.files.map((f) =>
            f.id === action.fileId
              ? {
                  ...f,
                  themes: f.themes.filter((t) => t.id !== action.themeId),
                  tokens: f.tokens.map((t) => {
                    const { [action.themeId]: _, ...rest } = t.values;
                    return { ...t, values: rest };
                  }),
                }
              : f
          ),
        },
      };
    case "SET_SELECTED_TOKENS":
      return { ...state, themes: { ...state.themes, selectedTokens: action.tokens } };
    case "TOGGLE_TOKEN_SELECTION": {
      const next = new Set(state.themes.selectedTokens);
      if (next.has(action.tokenName)) next.delete(action.tokenName);
      else next.add(action.tokenName);
      return { ...state, themes: { ...state.themes, selectedTokens: next } };
    }
    case "SET_THEME_SEARCH":
      return { ...state, themes: { ...state.themes, searchQuery: action.query } };
    case "SET_EDITING_TOKEN":
      return { ...state, themes: { ...state.themes, editingToken: action.tokenName } };
    case "RENAME_TOKENS":
      return {
        ...state,
        themes: {
          ...state.themes,
          files: state.themes.files.map((f) =>
            f.id === action.fileId
              ? {
                  ...f,
                  tokens: f.tokens.map((t) => {
                    const rename = action.renames.find((r) => r.from === t.name);
                    return rename ? { ...t, name: rename.to, group: deriveGroup(rename.to) } : t;
                  }),
                }
              : f
          ),
        },
      };
    case "DELETE_TOKENS":
      return {
        ...state,
        themes: {
          ...state.themes,
          files: state.themes.files.map((f) =>
            f.id === action.fileId
              ? { ...f, tokens: f.tokens.filter((t) => !action.tokenNames.includes(t.name)) }
              : f
          ),
          selectedTokens: new Set([...state.themes.selectedTokens].filter((n) => !action.tokenNames.includes(n))),
        },
      };
    case "ADD_TOKENS":
      return {
        ...state,
        themes: {
          ...state.themes,
          files: state.themes.files.map((f) =>
            f.id === action.fileId ? { ...f, tokens: [...f.tokens, ...action.tokens] } : f
          ),
        },
      };
    default:
      return state;
  }
}

// ──────────────────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────────────────
const noopDispatch: React.Dispatch<Action> = () => {};

const WorkspaceContext = createContext<{
  state: WorkspaceState;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: noopDispatch });

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <WorkspaceContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export { findElement };