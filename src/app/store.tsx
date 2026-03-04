import React, { createContext, useContext, useReducer, ReactNode } from "react";

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
};

export type StyleChange = {
  elementId: string;
  property: string;
  oldValue: string;
  newValue: string;
  timestamp: number;
};

export type DesignVersion = {
  id: string;
  name: string;
  timestamp: number;
  changes: StyleChange[];
  thumbnail?: string;
  status: "draft" | "active" | "sent" | "applied";
  agentTarget?: string;
  description?: string;
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

// ── Annotation types ──
export type AnnotationTool = "select" | "rect" | "arrow" | "text" | "freehand" | "circle";

export type Annotation = {
  id: string;
  tool: AnnotationTool;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  endX?: number;
  endY?: number;
  text?: string;
  color: string;
  timestamp: number;
  author?: string;
};

// ── File mapping types ──
export type FileMapping = {
  elementId: string;
  filePath: string;
  componentName: string;
  lineNumber?: number;
  confidence: "high" | "medium" | "low";
};

// ── Project types ──
export type DDProject = {
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

export type AppView = "onboarding" | "workspace";

export type WorkspaceState = {
  // App-level
  currentView: AppView;
  project: ProjectConnection | null;

  // Element tree
  elements: ElementNode[];
  selectedElementId: string | null;
  hoveredElementId: string | null;

  // Versions & changes
  versions: DesignVersion[];
  activeVersionId: string | null;
  styleChanges: StyleChange[];

  // IDE connections
  ides: IDEConnection[];

  // Annotations
  annotations: Annotation[];
  annotationMode: boolean;
  annotationTool: AnnotationTool;
  annotationColor: string;

  // File mappings
  fileMappings: FileMapping[];
  fileMapPanelOpen: boolean;

  // WebSocket / MCP bridge
  wsStatus: WSStatus;
  wsLogs: WSLogEntry[];
  wsPort: number;

  // Feedback / Agent Waitlist
  feedbackItems: FeedbackItem[];
  waitlistOpen: boolean;

  // Selection source tracking
  selectionSource: "inspect" | "panel" | null;

  // Variants
  variants: VariantData[];
  activeVariantId: string | null;

  // Project management
  ddProject: DDProject;

  // Route switching
  currentRoute: string;
  routeHistory: string[];

  // UI state
  inspectorMode: boolean;
  layersPanelOpen: boolean;
  stylePanelOpen: boolean;
  idePanelOpen: boolean;
  commandPaletteOpen: boolean;
  isLoading: boolean;
};

type Action =
  | { type: "SELECT_ELEMENT"; id: string | null; source?: "inspect" | "panel" }
  | { type: "HOVER_ELEMENT"; id: string | null }
  | { type: "UPDATE_STYLE"; elementId: string; property: string; value: string }
  | { type: "SET_ELEMENT_STYLES"; id: string; styles: Record<string, string> }
  | { type: "ADD_VERSION"; version: DesignVersion }
  | { type: "SET_ACTIVE_VERSION"; id: string }
  | { type: "UPDATE_VERSION_STATUS"; id: string; status: DesignVersion["status"] }
  | { type: "UPDATE_IDE_STATUS"; id: string; status: IDEConnection["status"] }
  | { type: "SEND_TO_IDE"; versionId: string; ideId: string }
  | { type: "TOGGLE_INSPECTOR" }
  | { type: "TOGGLE_LAYERS_PANEL" }
  | { type: "TOGGLE_STYLE_PANEL" }
  | { type: "TOGGLE_IDE_PANEL" }
  | { type: "TOGGLE_COMMAND_PALETTE" }
  | { type: "TOGGLE_ELEMENT_VISIBILITY"; id: string }
  | { type: "TOGGLE_ELEMENT_LOCK"; id: string }
  | { type: "SET_ELEMENTS"; elements: ElementNode[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "CLEAR_PAGE" }
  | { type: "SET_VIEW"; view: AppView }
  | { type: "CONNECT_PROJECT"; project: ProjectConnection }
  | { type: "UPDATE_PROJECT_STATUS"; status: ProjectConnection["status"]; errorMessage?: string }
  | { type: "DISCONNECT_PROJECT" }
  // Annotation actions
  | { type: "ADD_ANNOTATION"; annotation: Annotation }
  | { type: "UPDATE_ANNOTATION"; id: string; updates: Partial<Annotation> }
  | { type: "DELETE_ANNOTATION"; id: string }
  | { type: "CLEAR_ANNOTATIONS" }
  | { type: "TOGGLE_ANNOTATION_MODE" }
  | { type: "SET_ANNOTATION_TOOL"; tool: AnnotationTool }
  | { type: "SET_ANNOTATION_COLOR"; color: string }
  // File mapping actions
  | { type: "SET_FILE_MAPPINGS"; mappings: FileMapping[] }
  | { type: "TOGGLE_FILE_MAP_PANEL" }
  // Feedback / Agent Waitlist actions
  | { type: "ADD_FEEDBACK"; item: FeedbackItem }
  | { type: "UPDATE_FEEDBACK"; id: string; updates: Partial<FeedbackItem> }
  | { type: "REMOVE_FEEDBACK"; id: string }
  | { type: "CLEAR_FEEDBACK" }
  | { type: "MARK_FEEDBACK_SENT"; ids: string[] }
  | { type: "SET_WAITLIST_OPEN"; open: boolean }
  // Variant actions
  | { type: "ADD_VARIANT"; variant: VariantData }
  | { type: "UPDATE_VARIANT"; id: string; updates: Partial<VariantData> }
  | { type: "DELETE_VARIANT"; id: string }
  | { type: "SET_ACTIVE_VARIANT"; id: string | null }
  | { type: "FINALIZE_VARIANT"; id: string }
  | { type: "PUSH_VARIANT_TO_MAIN"; id: string }
  // Project management actions
  | { type: "SET_DD_PROJECT_NAME"; name: string }
  | { type: "SAVE_DD_PROJECT" }
  | { type: "LOAD_DD_PROJECT"; project: DDProject; variants: VariantData[]; feedbackItems: FeedbackItem[] }
  // Route actions
  | { type: "SET_CURRENT_ROUTE"; route: string }
  | { type: "ADD_ROUTE_HISTORY"; route: string }
  // WebSocket actions
  | { type: "WS_STATUS_UPDATE"; status: WSStatus }
  | { type: "WS_LOG"; entry: WSLogEntry }
  | { type: "WS_CLEAR_LOGS" }
  | { type: "WS_SET_PORT"; port: number };

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
    color: "#ff6b35",
    icon: "CC",
    setupMethod: "mcp",
  },
  {
    id: "cursor",
    name: "Cursor",
    type: "cursor",
    status: "disconnected",
    description: "AI-first code editor",
    color: "#0070f3",
    icon: "Cu",
    setupMethod: "extension",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    type: "windsurf",
    status: "disconnected",
    description: "Agentic IDE by Codeium",
    color: "#50e3c2",
    icon: "Ws",
    setupMethod: "extension",
  },
  {
    id: "vscode",
    name: "VS Code",
    type: "vscode",
    status: "disconnected",
    description: "With GitHub Copilot",
    color: "#007acc",
    icon: "VS",
    setupMethod: "extension",
  },
  {
    id: "antigravity",
    name: "Antigravity",
    type: "antigravity",
    status: "disconnected",
    description: "Visual-first AI development",
    color: "#7928ca",
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
  versions: [],
  activeVersionId: null,
  styleChanges: [],
  ides: defaultIDEs,
  annotations: [],
  annotationMode: false,
  annotationTool: "select",
  annotationColor: "#ff0000",
  fileMappings: [],
  fileMapPanelOpen: false,
  wsStatus: "disconnected",
  wsLogs: [],
  wsPort: 0,
  feedbackItems: [],
  waitlistOpen: false,
  selectionSource: null,
  variants: [],
  activeVariantId: null,
  ddProject: {
    id: `proj-${Date.now()}`,
    name: "Untitled",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    appUrl: typeof window !== "undefined" ? window.location.origin : "",
    saved: false,
  },
  currentRoute: typeof window !== "undefined" ? window.location.pathname : "/",
  routeHistory: typeof window !== "undefined" ? [window.location.pathname] : ["/"],
  inspectorMode: true,
  layersPanelOpen: true,
  stylePanelOpen: true,
  idePanelOpen: false,
  commandPaletteOpen: false,
  isLoading: false,
};

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
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
      const element = findElement(state.elements, action.elementId);
      if (!element) return state;
      const oldValue = element.styles[action.property] || "";
      const change: StyleChange = {
        elementId: action.elementId,
        property: action.property,
        oldValue,
        newValue: action.value,
        timestamp: Date.now(),
      };
      return {
        ...state,
        elements: updateElementInTree(state.elements, action.elementId, (el) => ({
          ...el,
          styles: { ...el.styles, [action.property]: action.value },
        })),
        styleChanges: [...state.styleChanges, change],
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
    case "ADD_VERSION":
      return { ...state, versions: [...state.versions, action.version] };
    case "SET_ACTIVE_VERSION":
      return { ...state, activeVersionId: action.id };
    case "UPDATE_VERSION_STATUS":
      return {
        ...state,
        versions: state.versions.map((v) =>
          v.id === action.id ? { ...v, status: action.status } : v
        ),
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
    case "SEND_TO_IDE": {
      const ide = state.ides.find((i) => i.id === action.ideId);
      return {
        ...state,
        versions: state.versions.map((v) =>
          v.id === action.versionId ? { ...v, status: "sent", agentTarget: ide?.name } : v
        ),
        ides: state.ides.map((i) =>
          i.id === action.ideId ? { ...i, status: "connected", lastSync: Date.now() } : i
        ),
      };
    }
    case "TOGGLE_INSPECTOR":
      return { ...state, inspectorMode: !state.inspectorMode };
    case "TOGGLE_LAYERS_PANEL":
      return { ...state, layersPanelOpen: !state.layersPanelOpen };
    case "TOGGLE_STYLE_PANEL":
      return { ...state, stylePanelOpen: !state.stylePanelOpen };
    case "TOGGLE_IDE_PANEL":
      return { ...state, idePanelOpen: !state.idePanelOpen };
    case "TOGGLE_COMMAND_PALETTE":
      return { ...state, commandPaletteOpen: !state.commandPaletteOpen };
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
        styleChanges: [],
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "CLEAR_PAGE":
      return {
        ...state,
        elements: [],
        selectedElementId: null,
        hoveredElementId: null,
        styleChanges: [],
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
        styleChanges: [],
        versions: [],
        activeVersionId: null,
      };
    // Annotation actions
    case "ADD_ANNOTATION":
      return { ...state, annotations: [...state.annotations, action.annotation] };
    case "UPDATE_ANNOTATION":
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.id ? { ...a, ...action.updates } : a
        ),
      };
    case "DELETE_ANNOTATION":
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.id),
      };
    case "CLEAR_ANNOTATIONS":
      return { ...state, annotations: [] };
    case "TOGGLE_ANNOTATION_MODE":
      return { ...state, annotationMode: !state.annotationMode };
    case "SET_ANNOTATION_TOOL":
      return { ...state, annotationTool: action.tool };
    case "SET_ANNOTATION_COLOR":
      return { ...state, annotationColor: action.color };
    // File mapping actions
    case "SET_FILE_MAPPINGS":
      return { ...state, fileMappings: action.mappings };
    case "TOGGLE_FILE_MAP_PANEL":
      return { ...state, fileMapPanelOpen: !state.fileMapPanelOpen };
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
    case "SET_WAITLIST_OPEN":
      return { ...state, waitlistOpen: action.open };
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
    case "SET_DD_PROJECT_NAME":
      return {
        ...state,
        ddProject: { ...state.ddProject, name: action.name, updatedAt: Date.now() },
      };
    case "SAVE_DD_PROJECT":
      return {
        ...state,
        ddProject: { ...state.ddProject, saved: true, updatedAt: Date.now() },
      };
    case "LOAD_DD_PROJECT":
      return {
        ...state,
        ddProject: action.project,
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
    // WebSocket actions
    case "WS_STATUS_UPDATE":
      return { ...state, wsStatus: action.status };
    case "WS_LOG":
      return { ...state, wsLogs: [...state.wsLogs, action.entry] };
    case "WS_CLEAR_LOGS":
      return { ...state, wsLogs: [] };
    case "WS_SET_PORT":
      return { ...state, wsPort: action.port };
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