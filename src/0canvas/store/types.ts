// ──────────────────────────────────────────────────────────
// Store Types — Canonical type definitions for 0canvas
// ──────────────────────────────────────────────────────────
//
// All shared types live here so they can be imported without
// pulling in the full store (React context, reducer, etc.).
//
// The store re-exports everything from this file, so existing
// imports like `import { Foo } from "../store/store"` still work.
// ──────────────────────────────────────────────────────────

import type { OCProjectFile } from "../format/oc-project";

// ── Element types ──

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

// ── IDE types ──

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

// ── Project connection ──

export type ProjectConnection = {
  name: string;
  devServerUrl: string;
  productionUrl?: string;
  framework: string;
  status: "disconnected" | "connecting" | "connected" | "error";
  errorMessage?: string;
};

// ── Brainstorm ──

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

// ── WebSocket / MCP types ──

export type WSStatus = "disconnected" | "connecting" | "connected" | "error";

export type WSLogEntry = {
  id: string;
  timestamp: number;
  direction: "sent" | "received" | "system";
  method: string;
  summary: string;
  payload?: any;
};

// ── View / Page types ──

export type AppView = "onboarding" | "workspace";
export type WorkspacePage = "design" | "settings";

// ── Workspace state ──

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

  // WebSocket / MCP bridge
  wsStatus: WSStatus;
  wsLogs: WSLogEntry[];
  wsPort: number;

  // Feedback (used by project format and MCP bridge)
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
  inspectorMode: boolean;
  layersPanelOpen: boolean;
  stylePanelOpen: boolean;
  idePanelOpen: boolean;
  isLoading: boolean;
};

// ── Action types ──

export type Action =
  | { type: "SELECT_ELEMENT"; id: string | null; source?: "inspect" | "panel" }
  | { type: "HOVER_ELEMENT"; id: string | null }
  | { type: "UPDATE_STYLE"; elementId: string; property: string; value: string }
  | { type: "SET_ELEMENT_STYLES"; id: string; styles: Record<string, string> }
  | { type: "UPDATE_IDE_STATUS"; id: string; status: IDEConnection["status"] }
  | { type: "SET_ACTIVE_PAGE"; page: WorkspacePage }
  | { type: "TOGGLE_INSPECTOR" }
  | { type: "TOGGLE_LAYERS_PANEL" }
  | { type: "TOGGLE_STYLE_PANEL" }
  | { type: "TOGGLE_IDE_PANEL" }
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
  // WebSocket actions
  | { type: "WS_STATUS_UPDATE"; status: WSStatus }
  | { type: "WS_LOG"; entry: WSLogEntry }
  | { type: "WS_CLEAR_LOGS" }
  | { type: "WS_SET_PORT"; port: number };
