import React, { createContext, useContext, useReducer, ReactNode } from "react";
import type { OCProjectFile } from "../format/oc-project";

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

export type IDEType = "claude-code" | "cursor" | "vscode" | "windsurf" | "antigravity" | "custom";

export type IDEConnection = {
  id: string;
  name: string;
  type: IDEType;
  status: "connected" | "disconnected" | "connecting";
  lastSync?: number;
  projectPath?: string;
  description: string;
  color: string;
  icon: string; // 2-letter abbreviation
  setupMethod: "cli" | "extension" | "mcp";
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
  originalTokenChain: string[];  // var() resolution chain, e.g. ["--color--text--primary", "--blue-600", "#2563EB"]
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
export type DesignMode = "style" | "feedback" | "ai";
export type Breakpoint = "desktop" | "laptop" | "tablet" | "mobile";

export const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  desktop: 1440,
  laptop: 1280,
  tablet: 768,
  mobile: 375,
};
export type AiProvider = "chatgpt" | "openai" | "ide";

export type AiSettings = {
  provider: AiProvider;
  proxyUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  autoSendFeedback: boolean;
};
export type ViewMode = "canvas" | "fullscreen";

// ── Theme / Token types ──
export type TokenSyntax = "color" | "length-percentage" | "percentage" | "number" | "angle" | "time" | "*";

export type DesignToken = {
  name: string;          // e.g. "--blue-500"
  values: Record<string, string>; // themeId → value, e.g. { default: "#3B82F6", light: "#2563EB" }
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
  handle: FileSystemFileHandle | null; // File System Access API handle for two-way sync
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

  // IDE connections
  ides: IDEConnection[];

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
  isLoading: boolean;

  // Themes
  themes: ThemesState;

  // Theme Mode (color inspection)
  themeMode: boolean;
  themeChanges: ThemeChangeItem[];

  // AI settings
  aiSettings: AiSettings;
};

type Action =
  | { type: "SELECT_ELEMENT"; id: string | null; source?: "inspect" | "panel" }
  | { type: "HOVER_ELEMENT"; id: string | null }
  | { type: "UPDATE_STYLE"; elementId: string; property: string; value: string }
  | { type: "SET_ELEMENT_STYLES"; id: string; styles: Record<string, string> }
  | { type: "UPDATE_IDE_STATUS"; id: string; status: IDEConnection["status"] }
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

// ──────────────────────────────────────────────────────────
// IDE definitions
// ──────────────────────────────────────────────────────────
const defaultIDEs: IDEConnection[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    type: "claude-code",
    status: "disconnected",
    description: "AI-powered coding agent by Anthropic",
    color: "#2563EB",
    icon: "CC",
    setupMethod: "mcp",
  },
  {
    id: "cursor",
    name: "Cursor",
    type: "cursor",
    status: "disconnected",
    description: "AI-first code editor",
    color: "#3B82F6",
    icon: "Cu",
    setupMethod: "extension",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    type: "windsurf",
    status: "disconnected",
    description: "Agentic IDE by Codeium",
    color: "#1D4ED8",
    icon: "Ws",
    setupMethod: "extension",
  },
  {
    id: "vscode",
    name: "VS Code",
    type: "vscode",
    status: "disconnected",
    description: "With GitHub Copilot",
    color: "#60A5FA",
    icon: "VS",
    setupMethod: "extension",
  },
  {
    id: "antigravity",
    name: "Antigravity",
    type: "antigravity",
    status: "disconnected",
    description: "Visual-first AI development",
    color: "#1E40AF",
    icon: "AG",
    setupMethod: "cli",
  },
];

// ──────────────────────────────────────────────────────────
// Initial state
// ──────────────────────────────────────────────────────────
const initialState: WorkspaceState = {
  currentView: "workspace",
  project: null,
  elements: [],
  selectedElementId: null,
  hoveredElementId: null,
  ides: defaultIDEs,
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
  aiSettings: {
    provider: "ide",
    proxyUrl: "http://127.0.0.1:10531",
    apiKey: "",
    model: "gpt-4o",
    temperature: 0.7,
    autoSendFeedback: false,
  },
};

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/** Derive group name from a CSS custom property name, e.g. "--blue-500" → "blue", "--color--text--muted" → "color" */
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
    case "UPDATE_IDE_STATUS":
      return {
        ...state,
        ides: state.ides.map((ide) =>
          ide.id === action.id
            ? {
                ...ide,
                status: action.status,
                lastSync: action.status === "connected" ? Date.now() : ide.lastSync,
              }
            : ide
        ),
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