"use client";

// src/app/components/designdead-engine.tsx
import { useState as useState10, useEffect as useEffect4, useCallback as useCallback3 } from "react";

// src/app/store.tsx
import { createContext, useContext, useReducer } from "react";
import { jsx } from "react/jsx-runtime";
var defaultIDEs = [
  {
    id: "claude-code",
    name: "Claude Code",
    type: "claude-code",
    status: "disconnected",
    description: "AI-powered coding agent by Anthropic",
    color: "#ff6b35",
    icon: "CC",
    setupMethod: "mcp"
  },
  {
    id: "cursor",
    name: "Cursor",
    type: "cursor",
    status: "disconnected",
    description: "AI-first code editor",
    color: "#0070f3",
    icon: "Cu",
    setupMethod: "extension"
  },
  {
    id: "windsurf",
    name: "Windsurf",
    type: "windsurf",
    status: "disconnected",
    description: "Agentic IDE by Codeium",
    color: "#50e3c2",
    icon: "Ws",
    setupMethod: "extension"
  },
  {
    id: "vscode",
    name: "VS Code",
    type: "vscode",
    status: "disconnected",
    description: "With GitHub Copilot",
    color: "#007acc",
    icon: "VS",
    setupMethod: "extension"
  },
  {
    id: "antigravity",
    name: "Antigravity",
    type: "antigravity",
    status: "disconnected",
    description: "Visual-first AI development",
    color: "#7928ca",
    icon: "AG",
    setupMethod: "cli"
  }
];
var initialState = {
  currentView: "workspace",
  project: null,
  elements: [],
  selectedElementId: null,
  hoveredElementId: null,
  versions: [],
  activeVersionId: null,
  styleChanges: [],
  ides: defaultIDEs,
  brainstormNotes: [],
  annotations: [],
  annotationMode: false,
  annotationTool: "select",
  annotationColor: "#ff0000",
  fileMappings: [],
  fileMapPanelOpen: false,
  wsStatus: "disconnected",
  wsLogs: [],
  wsPort: 0,
  inspectorMode: true,
  layersPanelOpen: true,
  stylePanelOpen: true,
  idePanelOpen: false,
  brainstormMode: false,
  commandPaletteOpen: false,
  isLoading: false
};
function findElement(elements, id) {
  for (const el of elements) {
    if (el.id === id) return el;
    const found = findElement(el.children, id);
    if (found) return found;
  }
  return null;
}
function updateElementInTree(elements, id, updater) {
  return elements.map((el) => {
    if (el.id === id) return updater(el);
    return { ...el, children: updateElementInTree(el.children, id, updater) };
  });
}
function reducer(state, action) {
  switch (action.type) {
    case "SELECT_ELEMENT":
      return { ...state, selectedElementId: action.id };
    case "HOVER_ELEMENT":
      return { ...state, hoveredElementId: action.id };
    case "UPDATE_STYLE": {
      const element = findElement(state.elements, action.elementId);
      if (!element) return state;
      const oldValue = element.styles[action.property] || "";
      const change = {
        elementId: action.elementId,
        property: action.property,
        oldValue,
        newValue: action.value,
        timestamp: Date.now()
      };
      return {
        ...state,
        elements: updateElementInTree(state.elements, action.elementId, (el) => ({
          ...el,
          styles: { ...el.styles, [action.property]: action.value }
        })),
        styleChanges: [...state.styleChanges, change]
      };
    }
    case "SET_ELEMENT_STYLES":
      return {
        ...state,
        elements: updateElementInTree(state.elements, action.id, (el) => ({
          ...el,
          styles: action.styles
        }))
      };
    case "ADD_VERSION":
      return { ...state, versions: [...state.versions, action.version] };
    case "SET_ACTIVE_VERSION":
      return { ...state, activeVersionId: action.id };
    case "UPDATE_VERSION_STATUS":
      return {
        ...state,
        versions: state.versions.map(
          (v) => v.id === action.id ? { ...v, status: action.status } : v
        )
      };
    case "UPDATE_IDE_STATUS":
      return {
        ...state,
        ides: state.ides.map(
          (ide) => ide.id === action.id ? {
            ...ide,
            status: action.status,
            lastSync: action.status === "connected" ? Date.now() : ide.lastSync
          } : ide
        )
      };
    case "SEND_TO_IDE": {
      const ide = state.ides.find((i) => i.id === action.ideId);
      return {
        ...state,
        versions: state.versions.map(
          (v) => v.id === action.versionId ? { ...v, status: "sent", agentTarget: ide?.name } : v
        ),
        ides: state.ides.map(
          (i) => i.id === action.ideId ? { ...i, status: "connected", lastSync: Date.now() } : i
        )
      };
    }
    case "ADD_BRAINSTORM_NOTE":
      return { ...state, brainstormNotes: [...state.brainstormNotes, action.note] };
    case "DELETE_BRAINSTORM_NOTE":
      return {
        ...state,
        brainstormNotes: state.brainstormNotes.filter((n) => n.id !== action.id)
      };
    case "TOGGLE_INSPECTOR":
      return { ...state, inspectorMode: !state.inspectorMode };
    case "TOGGLE_LAYERS_PANEL":
      return { ...state, layersPanelOpen: !state.layersPanelOpen };
    case "TOGGLE_STYLE_PANEL":
      return { ...state, stylePanelOpen: !state.stylePanelOpen };
    case "TOGGLE_IDE_PANEL":
      return { ...state, idePanelOpen: !state.idePanelOpen };
    case "TOGGLE_BRAINSTORM":
      return { ...state, brainstormMode: !state.brainstormMode };
    case "TOGGLE_COMMAND_PALETTE":
      return { ...state, commandPaletteOpen: !state.commandPaletteOpen };
    case "TOGGLE_ELEMENT_VISIBILITY":
      return {
        ...state,
        elements: updateElementInTree(state.elements, action.id, (el) => ({
          ...el,
          visible: !el.visible
        }))
      };
    case "TOGGLE_ELEMENT_LOCK":
      return {
        ...state,
        elements: updateElementInTree(state.elements, action.id, (el) => ({
          ...el,
          locked: !el.locked
        }))
      };
    case "SET_ELEMENTS":
      return {
        ...state,
        elements: action.elements,
        selectedElementId: null,
        hoveredElementId: null,
        styleChanges: []
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "CLEAR_PAGE":
      return {
        ...state,
        elements: [],
        selectedElementId: null,
        hoveredElementId: null,
        styleChanges: []
      };
    case "SET_VIEW":
      return { ...state, currentView: action.view };
    case "CONNECT_PROJECT":
      return {
        ...state,
        project: action.project,
        currentView: "workspace"
      };
    case "UPDATE_PROJECT_STATUS":
      return {
        ...state,
        project: state.project ? { ...state.project, status: action.status, errorMessage: action.errorMessage } : null
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
        activeVersionId: null
      };
    // Annotation actions
    case "ADD_ANNOTATION":
      return { ...state, annotations: [...state.annotations, action.annotation] };
    case "UPDATE_ANNOTATION":
      return {
        ...state,
        annotations: state.annotations.map(
          (a) => a.id === action.id ? { ...a, ...action.updates } : a
        )
      };
    case "DELETE_ANNOTATION":
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.id)
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
var noopDispatch = () => {
};
var WorkspaceContext = createContext({ state: initialState, dispatch: noopDispatch });
function WorkspaceProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return /* @__PURE__ */ jsx(WorkspaceContext.Provider, { value: { state, dispatch }, children });
}
function useWorkspace() {
  return useContext(WorkspaceContext);
}

// src/app/components/designdead-styles.ts
var STYLE_ID = "designdead-injected-styles";
var DESIGNDEAD_CSS = `
/* \u2500\u2500 DesignDead Scoped Styles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

[data-designdead-root] {
  /* Color tokens (Vercel Geist dark theme) */
  --background: #000000;
  --foreground: #ededed;
  --card: #0a0a0a;
  --card-foreground: #ededed;
  --popover: #0a0a0a;
  --popover-foreground: #ededed;
  --primary: #ffffff;
  --primary-foreground: #000000;
  --secondary: #1a1a1a;
  --secondary-foreground: #ededed;
  --muted: #111111;
  --muted-foreground: #888888;
  --accent: #1a1a1a;
  --accent-foreground: #ededed;
  --destructive: #ff4444;
  --destructive-foreground: #ffffff;
  --border: #222222;
  --input: transparent;
  --input-background: #111111;
  --switch-background: #333333;
  --ring: #333333;
  --radius: 0.5rem;

  /* Tailwind v4 color mappings */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-input-background: var(--input-background);
  --color-ring: var(--ring);

  /* Scoped reset */
  font-family: 'Geist Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* Ensure DesignDead sits on top of everything */
  position: fixed;
  inset: 0;
  z-index: 2147483640;
  pointer-events: auto;
}

/* Reset all elements inside DesignDead root */
[data-designdead-root] *,
[data-designdead-root] *::before,
[data-designdead-root] *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

[data-designdead-root] *:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Border default */
[data-designdead-root] * {
  border-color: var(--border);
}

/* Scrollbar styling */
[data-designdead-root] ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
[data-designdead-root] ::-webkit-scrollbar-track {
  background: transparent;
}
[data-designdead-root] ::-webkit-scrollbar-thumb {
  background: #333333;
  border-radius: 3px;
}
[data-designdead-root] ::-webkit-scrollbar-thumb:hover {
  background: #444444;
}

/* Animations */
@keyframes dd-pulse {
  50% { opacity: .5; }
}
@keyframes dd-spin {
  to { transform: rotate(360deg); }
}
[data-designdead-root] .animate-pulse {
  animation: dd-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
[data-designdead-root] .animate-spin {
  animation: dd-spin 1s linear infinite;
}
`;
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = DESIGNDEAD_CSS;
  document.head.appendChild(style);
}
function removeStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
}

// src/app/components/dom-inspector.ts
var IGNORED_TAGS = /* @__PURE__ */ new Set([
  "SCRIPT",
  "STYLE",
  "LINK",
  "META",
  "HEAD",
  "NOSCRIPT",
  "BR",
  "WBR"
]);
var DD_ATTR = "data-designdead";
var idCounter = 0;
function generateId() {
  return `dd-${++idCounter}`;
}
function resetIdCounter() {
  idCounter = 0;
}
function getSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).filter((c) => !c.startsWith("dd-")).slice(0, 3).map((c) => `.${CSS.escape(c)}`).join("");
  if (classes) return `${tag}${classes}`;
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (s) => s.tagName === el.tagName
    );
    if (siblings.length > 1) {
      const idx = siblings.indexOf(el) + 1;
      return `${tag}:nth-child(${idx})`;
    }
  }
  return tag;
}
var STYLE_PROPS = [
  "color",
  "backgroundColor",
  "fontSize",
  "fontFamily",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "width",
  "height",
  "maxWidth",
  "maxHeight",
  "minWidth",
  "minHeight",
  "display",
  "flexDirection",
  "alignItems",
  "justifyContent",
  "gap",
  "gridTemplateColumns",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "overflow",
  "opacity",
  "borderRadius",
  "border",
  "borderColor",
  "borderWidth",
  "boxShadow",
  "transform",
  "transition"
];
function getComputedStyles(el) {
  const computed = window.getComputedStyle(el);
  const styles = {};
  for (const prop of STYLE_PROPS) {
    const value = computed.getPropertyValue(
      prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
    );
    if (value && value !== "none" && value !== "normal" && value !== "auto") {
      styles[prop] = value;
    }
  }
  return styles;
}
function getTextContent(el) {
  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent?.trim() || "";
    }
  }
  return text || void 0;
}
function walkElement(el, depth = 0) {
  if (el.hasAttribute(DD_ATTR)) return null;
  if (el.closest(`[${DD_ATTR}]`)) return null;
  if (IGNORED_TAGS.has(el.tagName)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && el.children.length === 0) {
    return null;
  }
  if (depth > 15) return null;
  const children = [];
  for (const child of el.children) {
    const node = walkElement(child, depth + 1);
    if (node) children.push(node);
  }
  return {
    id: generateId(),
    tag: el.tagName.toLowerCase(),
    classes: Array.from(el.classList).filter((c) => !c.startsWith("dd-")),
    children,
    text: getTextContent(el),
    styles: depth < 8 ? getComputedStyles(el) : {},
    // Only compute styles for top levels
    selector: getSelector(el),
    visible: true,
    locked: false
  };
}
function buildElementTree() {
  resetIdCounter();
  const body = document.body;
  if (!body) return [];
  const nodes = [];
  for (const child of body.children) {
    const node = walkElement(child, 0);
    if (node) nodes.push(node);
  }
  return nodes;
}
var elementMap = /* @__PURE__ */ new WeakMap();
var idToElement = /* @__PURE__ */ new Map();
function buildElementMap(el, depth = 0) {
  if (el.hasAttribute(DD_ATTR)) return;
  if (el.closest(`[${DD_ATTR}]`)) return;
  if (IGNORED_TAGS.has(el.tagName)) return;
  if (depth > 15) return;
  const id = elementMap.get(el) || generateId();
  elementMap.set(el, id);
  idToElement.set(id, el);
  for (const child of el.children) {
    buildElementMap(child, depth + 1);
  }
}
function rebuildElementMap() {
  idToElement.clear();
  resetIdCounter();
  for (const child of document.body.children) {
    buildElementMap(child, 0);
  }
}
function getElementById(id) {
  return idToElement.get(id) || null;
}
function applyStyle(elementId, property, value) {
  const el = getElementById(elementId);
  if (!el) return null;
  const camelProp = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const oldValue = el.style.getPropertyValue(property) || "";
  el.style[camelProp] = value;
  return oldValue;
}
var highlightOverlay = null;
var selectOverlay = null;
function ensureOverlay(type) {
  const isHover = type === "hover";
  let overlay = isHover ? highlightOverlay : selectOverlay;
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.setAttribute(DD_ATTR, "overlay");
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483646;
      border: ${isHover ? "1.5px dashed rgba(0, 112, 243, 0.6)" : "2px solid rgba(0, 112, 243, 0.9)"};
      background: ${isHover ? "rgba(0, 112, 243, 0.04)" : "rgba(0, 112, 243, 0.06)"};
      border-radius: 2px;
      transition: all 0.1s ease;
      display: none;
    `;
    document.body.appendChild(overlay);
    if (isHover) highlightOverlay = overlay;
    else selectOverlay = overlay;
  }
  return overlay;
}
function highlightElement(elementId, type = "hover") {
  const overlay = ensureOverlay(type);
  if (!elementId) {
    overlay.style.display = "none";
    return;
  }
  const el = getElementById(elementId);
  if (!el) {
    overlay.style.display = "none";
    return;
  }
  const rect = el.getBoundingClientRect();
  overlay.style.display = "block";
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}
function cleanup() {
  document.querySelectorAll(`[${DD_ATTR}]`).forEach((el) => el.remove());
  highlightOverlay = null;
  selectOverlay = null;
  idToElement.clear();
}
var inspectActive = false;
var inspectHandler = null;
var inspectHoverHandler = null;
function startInspect(onSelect) {
  stopInspect();
  inspectActive = true;
  rebuildElementMap();
  inspectHoverHandler = (e) => {
    const target = e.target;
    if (target.hasAttribute(DD_ATTR) || target.closest(`[${DD_ATTR}]`)) return;
    const id = elementMap.get(target);
    if (id) highlightElement(id, "hover");
  };
  inspectHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target;
    if (target.hasAttribute(DD_ATTR) || target.closest(`[${DD_ATTR}]`)) return;
    const id = elementMap.get(target);
    if (id) {
      highlightElement(null, "hover");
      highlightElement(id, "select");
      onSelect(id, target);
    }
  };
  document.addEventListener("mousemove", inspectHoverHandler, true);
  document.addEventListener("click", inspectHandler, true);
  document.body.style.cursor = "crosshair";
}
function stopInspect() {
  if (inspectHandler) {
    document.removeEventListener("click", inspectHandler, true);
    inspectHandler = null;
  }
  if (inspectHoverHandler) {
    document.removeEventListener("mousemove", inspectHoverHandler, true);
    inspectHoverHandler = null;
  }
  highlightElement(null, "hover");
  document.body.style.cursor = "";
  inspectActive = false;
}
function isInspecting() {
  return inspectActive;
}
function generateAgentOutput(elementId) {
  const el = getElementById(elementId);
  if (!el) return "";
  const tag = el.tagName.toLowerCase();
  const selector = getSelector(el);
  const classes = Array.from(el.classList).join(" ");
  const rect = el.getBoundingClientRect();
  const styles = getComputedStyles(el);
  const lines = [
    `## Element: \`${selector}\``,
    "",
    `- **Tag:** \`<${tag}>\``,
    `- **Classes:** \`${classes || "(none)"}\``,
    `- **Position:** ${Math.round(rect.x)}x${Math.round(rect.y)}, ${Math.round(rect.width)}x${Math.round(rect.height)}`
  ];
  const text = el.textContent?.trim().slice(0, 100);
  if (text) {
    lines.push(`- **Text:** "${text}${text.length >= 100 ? "..." : ""}"`);
  }
  const styleEntries = Object.entries(styles).slice(0, 15);
  if (styleEntries.length > 0) {
    lines.push("", "### Computed Styles", "```css");
    for (const [prop, val] of styleEntries) {
      const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      lines.push(`${cssProp}: ${val};`);
    }
    lines.push("```");
  }
  const path = [];
  let current = el;
  while (current && current !== document.body) {
    path.unshift(getSelector(current));
    current = current.parentElement;
  }
  if (path.length > 0) {
    lines.push("", `### Selector Path`, `\`${path.join(" > ")}\``);
  }
  return lines.join("\n");
}

// src/app/components/workspace-toolbar.tsx
import {
  Layers,
  Palette,
  Zap,
  Lightbulb,
  MousePointer2,
  Command,
  Monitor,
  Tablet,
  Smartphone,
  FileCode,
  PenTool,
  Wifi
} from "lucide-react";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function WorkspaceToolbar() {
  const { state, dispatch } = useWorkspace();
  const connectedIDEs = state.ides.filter((i) => i.status === "connected").length;
  const projectName = state.project?.name || "Untitled";
  const framework = state.project?.framework || "";
  const annotationCount = state.annotations.length;
  return /* @__PURE__ */ jsxs("div", { className: "h-12 border-b border-border bg-[#0a0a0a] flex items-center justify-between px-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx2("div", { className: "w-6 h-6 rounded bg-foreground flex items-center justify-center", children: /* @__PURE__ */ jsxs(
          "svg",
          {
            width: "14",
            height: "14",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2.5",
            className: "text-background",
            children: [
              /* @__PURE__ */ jsx2("path", { d: "M12 2L2 7l10 5 10-5-10-5z" }),
              /* @__PURE__ */ jsx2("path", { d: "M2 17l10 5 10-5" }),
              /* @__PURE__ */ jsx2("path", { d: "M2 12l10 5 10-5" })
            ]
          }
        ) }),
        /* @__PURE__ */ jsx2("span", { className: "text-[13px] text-foreground tracking-tight", children: "designdead" })
      ] }),
      /* @__PURE__ */ jsx2("div", { className: "w-px h-5 bg-border" }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 px-2 py-1 rounded bg-[#111111] border border-[#1a1a1a]", children: [
        /* @__PURE__ */ jsx2(
          "span",
          {
            className: `w-1.5 h-1.5 rounded-full ${state.project?.status === "connected" ? "bg-[#50e3c2]" : "bg-[#444444]"}`
          }
        ),
        /* @__PURE__ */ jsx2("span", { className: "text-[12px] text-foreground max-w-[140px] truncate", children: projectName }),
        framework && /* @__PURE__ */ jsx2("span", { className: "text-[10px] text-muted-foreground bg-[#1a1a1a] px-1.5 py-0.5 rounded", children: framework })
      ] }),
      state.wsStatus === "connected" && /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1 text-[10px] text-[#50e3c2] bg-[#50e3c2]/10 px-1.5 py-0.5 rounded", children: [
        /* @__PURE__ */ jsx2(Wifi, { className: "w-3 h-3" }),
        "MCP"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 bg-[#111111] rounded-lg p-0.5 border border-[#1a1a1a]", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          className: `flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${state.layersPanelOpen ? "bg-[#1a1a1a] text-foreground" : "text-muted-foreground hover:text-foreground"}`,
          onClick: () => dispatch({ type: "TOGGLE_LAYERS_PANEL" }),
          title: "Layers Panel",
          children: [
            /* @__PURE__ */ jsx2(Layers, { className: "w-3.5 h-3.5" }),
            "Layers"
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          className: `flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${state.inspectorMode ? "bg-[#0070f3]/15 text-[#0070f3]" : "text-muted-foreground hover:text-foreground"}`,
          onClick: () => dispatch({ type: "TOGGLE_INSPECTOR" }),
          title: "Inspector Mode",
          children: [
            /* @__PURE__ */ jsx2(MousePointer2, { className: "w-3.5 h-3.5" }),
            "Inspect"
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          className: `flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${state.stylePanelOpen ? "bg-[#1a1a1a] text-foreground" : "text-muted-foreground hover:text-foreground"}`,
          onClick: () => dispatch({ type: "TOGGLE_STYLE_PANEL" }),
          title: "Style Panel",
          children: [
            /* @__PURE__ */ jsx2(Palette, { className: "w-3.5 h-3.5" }),
            "Style"
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          className: `flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${state.fileMapPanelOpen ? "bg-[#0070f3]/15 text-[#0070f3]" : "text-muted-foreground hover:text-foreground"}`,
          onClick: () => dispatch({ type: "TOGGLE_FILE_MAP_PANEL" }),
          title: "File Map",
          children: [
            /* @__PURE__ */ jsx2(FileCode, { className: "w-3.5 h-3.5" }),
            "Files"
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          className: `flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${state.annotationMode ? "bg-[#ff0080]/15 text-[#ff0080]" : "text-muted-foreground hover:text-foreground"}`,
          onClick: () => dispatch({ type: "TOGGLE_ANNOTATION_MODE" }),
          title: "Annotation Mode",
          children: [
            /* @__PURE__ */ jsx2(PenTool, { className: "w-3.5 h-3.5" }),
            "Annotate",
            annotationCount > 0 && /* @__PURE__ */ jsx2("span", { className: "text-[9px] bg-[#ff0080]/20 text-[#ff0080] px-1 rounded", children: annotationCount })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          className: `flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${state.idePanelOpen ? "bg-[#f5a623]/15 text-[#f5a623]" : "text-muted-foreground hover:text-foreground"}`,
          onClick: () => dispatch({ type: "TOGGLE_IDE_PANEL" }),
          title: "IDE & Agents",
          children: [
            /* @__PURE__ */ jsx2(Zap, { className: "w-3.5 h-3.5" }),
            "IDE",
            connectedIDEs > 0 && /* @__PURE__ */ jsx2("span", { className: "w-1.5 h-1.5 rounded-full bg-[#50e3c2]" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          className: `flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors ${state.brainstormMode ? "bg-[#7928ca]/15 text-[#7928ca]" : "text-muted-foreground hover:text-foreground"}`,
          onClick: () => dispatch({ type: "TOGGLE_BRAINSTORM" }),
          title: "Brainstorm",
          children: [
            /* @__PURE__ */ jsx2(Lightbulb, { className: "w-3.5 h-3.5" }),
            "Ideas"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-0.5 bg-[#111111] rounded p-0.5 border border-[#1a1a1a]", children: [
        /* @__PURE__ */ jsx2("button", { className: "p-1 rounded bg-[#1a1a1a] text-foreground", children: /* @__PURE__ */ jsx2(Monitor, { className: "w-3.5 h-3.5" }) }),
        /* @__PURE__ */ jsx2("button", { className: "p-1 rounded text-muted-foreground hover:text-foreground", children: /* @__PURE__ */ jsx2(Tablet, { className: "w-3.5 h-3.5" }) }),
        /* @__PURE__ */ jsx2("button", { className: "p-1 rounded text-muted-foreground hover:text-foreground", children: /* @__PURE__ */ jsx2(Smartphone, { className: "w-3.5 h-3.5" }) })
      ] }),
      /* @__PURE__ */ jsx2("div", { className: "w-px h-5 bg-border" }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          className: "flex items-center gap-1.5 px-2 py-1 rounded border border-[#222222] hover:border-[#333333] transition-colors",
          onClick: () => dispatch({ type: "TOGGLE_COMMAND_PALETTE" }),
          children: [
            /* @__PURE__ */ jsx2(Command, { className: "w-3 h-3 text-muted-foreground" }),
            /* @__PURE__ */ jsx2("span", { className: "text-[11px] text-muted-foreground", children: "K" })
          ]
        }
      )
    ] })
  ] });
}

// src/app/components/layers-panel.tsx
import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Box,
  Type,
  Image,
  Link2,
  Layout,
  Square,
  Circle,
  Table,
  List,
  FileText,
  Globe,
  Minus,
  Loader2
} from "lucide-react";

// src/app/components/ui/scroll-area.tsx
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

// src/app/components/ui/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// src/app/components/ui/scroll-area.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function ScrollArea({
  className,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs2(
    ScrollAreaPrimitive.Root,
    {
      "data-slot": "scroll-area",
      className: cn("relative", className),
      ...props,
      children: [
        /* @__PURE__ */ jsx3(
          ScrollAreaPrimitive.Viewport,
          {
            "data-slot": "scroll-area-viewport",
            className: "focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
            style: { overflowY: "scroll" },
            children
          }
        ),
        /* @__PURE__ */ jsx3(ScrollBar, {}),
        /* @__PURE__ */ jsx3(ScrollAreaPrimitive.Corner, {})
      ]
    }
  );
}
function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}) {
  return /* @__PURE__ */ jsx3(
    ScrollAreaPrimitive.ScrollAreaScrollbar,
    {
      "data-slot": "scroll-area-scrollbar",
      orientation,
      className: cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsx3(
        ScrollAreaPrimitive.ScrollAreaThumb,
        {
          "data-slot": "scroll-area-thumb",
          className: "bg-border relative flex-1 rounded-full"
        }
      )
    }
  );
}

// src/app/components/layers-panel.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var TAG_ICONS = {
  body: /* @__PURE__ */ jsx4(Layout, { className: "w-3.5 h-3.5 text-blue-400" }),
  html: /* @__PURE__ */ jsx4(Layout, { className: "w-3.5 h-3.5 text-blue-400" }),
  main: /* @__PURE__ */ jsx4(Layout, { className: "w-3.5 h-3.5 text-blue-400" }),
  nav: /* @__PURE__ */ jsx4(Layout, { className: "w-3.5 h-3.5 text-purple-400" }),
  header: /* @__PURE__ */ jsx4(Layout, { className: "w-3.5 h-3.5 text-purple-400" }),
  footer: /* @__PURE__ */ jsx4(Layout, { className: "w-3.5 h-3.5 text-purple-400" }),
  aside: /* @__PURE__ */ jsx4(Layout, { className: "w-3.5 h-3.5 text-indigo-400" }),
  section: /* @__PURE__ */ jsx4(Square, { className: "w-3.5 h-3.5 text-green-400" }),
  article: /* @__PURE__ */ jsx4(FileText, { className: "w-3.5 h-3.5 text-green-400" }),
  div: /* @__PURE__ */ jsx4(Box, { className: "w-3.5 h-3.5 text-muted-foreground" }),
  span: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-orange-400" }),
  h1: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-yellow-400" }),
  h2: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-yellow-400" }),
  h3: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-yellow-400" }),
  h4: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-yellow-300" }),
  h5: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-yellow-300" }),
  h6: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-yellow-300" }),
  p: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-muted-foreground" }),
  a: /* @__PURE__ */ jsx4(Link2, { className: "w-3.5 h-3.5 text-blue-400" }),
  button: /* @__PURE__ */ jsx4(Square, { className: "w-3.5 h-3.5 text-blue-500" }),
  input: /* @__PURE__ */ jsx4(Square, { className: "w-3.5 h-3.5 text-cyan-400" }),
  textarea: /* @__PURE__ */ jsx4(Square, { className: "w-3.5 h-3.5 text-cyan-400" }),
  select: /* @__PURE__ */ jsx4(Square, { className: "w-3.5 h-3.5 text-cyan-400" }),
  form: /* @__PURE__ */ jsx4(Square, { className: "w-3.5 h-3.5 text-teal-400" }),
  img: /* @__PURE__ */ jsx4(Image, { className: "w-3.5 h-3.5 text-pink-400" }),
  svg: /* @__PURE__ */ jsx4(Circle, { className: "w-3.5 h-3.5 text-cyan-400" }),
  ul: /* @__PURE__ */ jsx4(List, { className: "w-3.5 h-3.5 text-muted-foreground" }),
  ol: /* @__PURE__ */ jsx4(List, { className: "w-3.5 h-3.5 text-muted-foreground" }),
  li: /* @__PURE__ */ jsx4(Minus, { className: "w-3.5 h-3.5 text-muted-foreground" }),
  table: /* @__PURE__ */ jsx4(Table, { className: "w-3.5 h-3.5 text-indigo-400" }),
  thead: /* @__PURE__ */ jsx4(Table, { className: "w-3.5 h-3.5 text-indigo-300" }),
  tbody: /* @__PURE__ */ jsx4(Table, { className: "w-3.5 h-3.5 text-indigo-300" }),
  tr: /* @__PURE__ */ jsx4(Minus, { className: "w-3.5 h-3.5 text-indigo-300" }),
  td: /* @__PURE__ */ jsx4(Box, { className: "w-3.5 h-3.5 text-indigo-200" }),
  th: /* @__PURE__ */ jsx4(Box, { className: "w-3.5 h-3.5 text-indigo-200" }),
  label: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-muted-foreground" }),
  strong: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-orange-300" }),
  em: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-orange-300" }),
  blockquote: /* @__PURE__ */ jsx4(FileText, { className: "w-3.5 h-3.5 text-blue-300" }),
  code: /* @__PURE__ */ jsx4(Type, { className: "w-3.5 h-3.5 text-green-300" }),
  pre: /* @__PURE__ */ jsx4(FileText, { className: "w-3.5 h-3.5 text-green-300" })
};
function getIcon(tag) {
  return TAG_ICONS[tag] || /* @__PURE__ */ jsx4(Box, { className: "w-3.5 h-3.5 text-muted-foreground" });
}
function matchesSearch(element, search) {
  const s = search.toLowerCase();
  if (element.tag.toLowerCase().includes(s)) return true;
  if (element.text?.toLowerCase().includes(s)) return true;
  if (element.classes.some((c) => c.toLowerCase().includes(s))) return true;
  if (element.selector.toLowerCase().includes(s)) return true;
  return element.children.some((child) => matchesSearch(child, s));
}
function LayerItem({
  element,
  depth = 0,
  search = ""
}) {
  const { state, dispatch } = useWorkspace();
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = element.children.length > 0;
  const isSelected = state.selectedElementId === element.id;
  const isHovered = state.hoveredElementId === element.id;
  const isSearching = search.length > 0;
  const shouldShow = !isSearching || matchesSearch(element, search);
  if (!shouldShow) return null;
  const displayName = element.text ? `${element.tag} "${element.text.slice(0, 20)}${element.text.length > 20 ? "..." : ""}"` : element.tag;
  const classPreview = element.classes.length > 0 ? `.${element.classes.slice(0, 2).join(".")}` : "";
  return /* @__PURE__ */ jsxs3("div", { children: [
    /* @__PURE__ */ jsxs3(
      "div",
      {
        className: `group flex items-center h-7 cursor-pointer transition-colors ${isSelected ? "bg-[#0070f3]/15 text-[#0070f3]" : isHovered ? "bg-[#ffffff08]" : "hover:bg-[#ffffff06]"}`,
        style: { paddingLeft: `${depth * 14 + 8}px` },
        onClick: () => dispatch({ type: "SELECT_ELEMENT", id: element.id }),
        onMouseEnter: () => dispatch({ type: "HOVER_ELEMENT", id: element.id }),
        onMouseLeave: () => dispatch({ type: "HOVER_ELEMENT", id: null }),
        children: [
          /* @__PURE__ */ jsx4(
            "button",
            {
              className: "w-4 h-4 flex items-center justify-center shrink-0",
              onClick: (e) => {
                e.stopPropagation();
                if (hasChildren) setExpanded(!expanded);
              },
              children: hasChildren ? expanded || isSearching ? /* @__PURE__ */ jsx4(ChevronDown, { className: "w-3 h-3 text-muted-foreground" }) : /* @__PURE__ */ jsx4(ChevronRight, { className: "w-3 h-3 text-muted-foreground" }) : null
            }
          ),
          /* @__PURE__ */ jsx4("span", { className: "ml-0.5 mr-1.5 shrink-0", children: getIcon(element.tag) }),
          /* @__PURE__ */ jsxs3(
            "span",
            {
              className: `truncate flex-1 ${!element.visible ? "opacity-40" : ""}`,
              style: { fontSize: "12px" },
              children: [
                displayName,
                classPreview && /* @__PURE__ */ jsx4("span", { className: "text-muted-foreground opacity-50 ml-1", style: { fontSize: "10px" }, children: classPreview })
              ]
            }
          ),
          /* @__PURE__ */ jsxs3("div", { className: "hidden group-hover:flex items-center gap-0.5 mr-2 shrink-0", children: [
            /* @__PURE__ */ jsx4(
              "button",
              {
                className: "p-0.5 hover:bg-[#ffffff10] rounded",
                onClick: (e) => {
                  e.stopPropagation();
                  dispatch({ type: "TOGGLE_ELEMENT_VISIBILITY", id: element.id });
                },
                children: element.visible ? /* @__PURE__ */ jsx4(Eye, { className: "w-3 h-3 text-muted-foreground" }) : /* @__PURE__ */ jsx4(EyeOff, { className: "w-3 h-3 text-muted-foreground" })
              }
            ),
            /* @__PURE__ */ jsx4(
              "button",
              {
                className: "p-0.5 hover:bg-[#ffffff10] rounded",
                onClick: (e) => {
                  e.stopPropagation();
                  dispatch({ type: "TOGGLE_ELEMENT_LOCK", id: element.id });
                },
                children: element.locked ? /* @__PURE__ */ jsx4(Lock, { className: "w-3 h-3 text-orange-400" }) : /* @__PURE__ */ jsx4(Unlock, { className: "w-3 h-3 text-muted-foreground" })
              }
            )
          ] })
        ]
      }
    ),
    (expanded || isSearching) && hasChildren && element.children.map((child) => /* @__PURE__ */ jsx4(LayerItem, { element: child, depth: depth + 1, search }, child.id))
  ] });
}
function LayersPanel() {
  const { state } = useWorkspace();
  const [search, setSearch] = useState("");
  const elementCount = countElements(state.elements);
  const isEmpty = state.elements.length === 0;
  return /* @__PURE__ */ jsxs3("div", { className: "h-full flex flex-col bg-[#0a0a0a] border-r border-border", children: [
    /* @__PURE__ */ jsxs3("div", { className: "px-3 py-2.5 border-b border-border flex items-center justify-between", children: [
      /* @__PURE__ */ jsx4("span", { className: "text-[11px] tracking-wider text-muted-foreground uppercase", children: "Layers" }),
      /* @__PURE__ */ jsx4("span", { className: "text-[10px] text-muted-foreground bg-[#1a1a1a] px-1.5 py-0.5 rounded", children: elementCount })
    ] }),
    /* @__PURE__ */ jsx4("div", { className: "px-3 py-2 border-b border-border", children: /* @__PURE__ */ jsx4(
      "input",
      {
        type: "text",
        placeholder: "Search layers...",
        value: search,
        onChange: (e) => setSearch(e.target.value),
        className: "w-full bg-[#111111] border border-[#222222] rounded px-2 py-1 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#333333] transition-colors"
      }
    ) }),
    /* @__PURE__ */ jsx4(ScrollArea, { className: "flex-1 min-h-0", children: isEmpty && state.isLoading ? /* @__PURE__ */ jsxs3("div", { className: "flex flex-col items-center justify-center p-6 pt-16 text-center", children: [
      /* @__PURE__ */ jsx4(Loader2, { className: "w-6 h-6 text-[#0070f3] animate-spin mb-3" }),
      /* @__PURE__ */ jsx4("p", { className: "text-[12px] text-muted-foreground mb-1", children: "Loading page..." }),
      /* @__PURE__ */ jsx4("p", { className: "text-[10px] text-muted-foreground", children: "Scanning DOM tree and building layers" })
    ] }) : isEmpty ? /* @__PURE__ */ jsxs3("div", { className: "flex flex-col items-center justify-center p-6 pt-16 text-center", children: [
      /* @__PURE__ */ jsx4(Globe, { className: "w-8 h-8 text-[#222222] mb-3" }),
      /* @__PURE__ */ jsx4("p", { className: "text-[12px] text-muted-foreground mb-1", children: "No page loaded" }),
      /* @__PURE__ */ jsx4("p", { className: "text-[10px] text-muted-foreground", children: "Connect your project to inspect its structure" })
    ] }) : /* @__PURE__ */ jsx4("div", { className: "py-1", children: state.elements.map((el) => /* @__PURE__ */ jsx4(LayerItem, { element: el, search }, el.id)) }) })
  ] });
}
function countElements(elements) {
  let count = elements.length;
  for (const el of elements) {
    count += countElements(el.children);
  }
  return count;
}

// src/app/components/style-panel.tsx
import { useState as useState2 } from "react";
import {
  ChevronDown as ChevronDown2,
  ChevronRight as ChevronRight2,
  Copy,
  Palette as Palette2,
  Ruler,
  Type as Type2,
  Box as Box2,
  Grid3x3,
  Globe as Globe2,
  MousePointer2 as MousePointer22
} from "lucide-react";

// src/app/components/clipboard.ts
function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  } catch {
    fallbackCopy(text);
  }
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
  }
  document.body.removeChild(ta);
}

// src/app/components/style-panel.tsx
import { Fragment, jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var STYLE_CATEGORIES = [
  {
    name: "Layout",
    icon: /* @__PURE__ */ jsx5(Grid3x3, { className: "w-3.5 h-3.5" }),
    properties: [
      "display",
      "position",
      "flexDirection",
      "alignItems",
      "justifyContent",
      "flexWrap",
      "gap",
      "gridTemplateColumns",
      "gridTemplateRows",
      "overflow",
      "float",
      "clear",
      "zIndex"
    ]
  },
  {
    name: "Spacing",
    icon: /* @__PURE__ */ jsx5(Box2, { className: "w-3.5 h-3.5" }),
    properties: [
      "padding",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "margin",
      "marginTop",
      "marginRight",
      "marginBottom",
      "marginLeft"
    ]
  },
  {
    name: "Size",
    icon: /* @__PURE__ */ jsx5(Ruler, { className: "w-3.5 h-3.5" }),
    properties: ["width", "height", "maxWidth", "maxHeight", "minHeight", "minWidth"]
  },
  {
    name: "Typography",
    icon: /* @__PURE__ */ jsx5(Type2, { className: "w-3.5 h-3.5" }),
    properties: [
      "fontSize",
      "fontWeight",
      "lineHeight",
      "textAlign",
      "color",
      "letterSpacing",
      "fontFamily",
      "textDecoration",
      "textTransform",
      "whiteSpace",
      "verticalAlign",
      "listStyleType"
    ]
  },
  {
    name: "Fill & Border",
    icon: /* @__PURE__ */ jsx5(Palette2, { className: "w-3.5 h-3.5" }),
    properties: [
      "background",
      "backgroundColor",
      "border",
      "borderTop",
      "borderBottom",
      "borderLeft",
      "borderRight",
      "borderRadius",
      "opacity",
      "boxShadow",
      "cursor"
    ]
  }
];
function StylePropertyRow({
  property,
  value,
  elementId
}) {
  const { dispatch } = useWorkspace();
  const [editing, setEditing] = useState2(false);
  const [editValue, setEditValue] = useState2(value);
  const isColor = property === "background" || property === "backgroundColor" || property === "color" || typeof value === "string" && (value.startsWith("#") || value.startsWith("rgb"));
  const handleSave = () => {
    dispatch({ type: "UPDATE_STYLE", elementId, property, value: editValue });
    setEditing(false);
  };
  const formatProperty = (prop) => {
    return prop.replace(/([A-Z])/g, "-$1").toLowerCase();
  };
  const colorMatch = typeof value === "string" ? value.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/) : null;
  const swatchColor = isColor && colorMatch ? colorMatch[0] : null;
  return /* @__PURE__ */ jsxs4("div", { className: "flex items-center h-7 group hover:bg-[#ffffff06] px-3", children: [
    /* @__PURE__ */ jsx5(
      "span",
      {
        className: "w-[120px] shrink-0 text-[11px] text-muted-foreground truncate",
        style: { fontFamily: "'JetBrains Mono', monospace" },
        children: formatProperty(property)
      }
    ),
    /* @__PURE__ */ jsxs4("div", { className: "flex-1 flex items-center gap-1.5", children: [
      swatchColor && /* @__PURE__ */ jsx5(
        "span",
        {
          className: "w-3 h-3 rounded-sm border border-[#333333] shrink-0",
          style: { background: swatchColor }
        }
      ),
      editing ? /* @__PURE__ */ jsx5(
        "input",
        {
          autoFocus: true,
          value: editValue,
          onChange: (e) => setEditValue(e.target.value),
          onBlur: handleSave,
          onKeyDown: (e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setEditValue(value);
              setEditing(false);
            }
          },
          className: "flex-1 bg-[#0070f3]/10 border border-[#0070f3]/30 rounded px-1.5 py-0 text-[11px] text-foreground focus:outline-none",
          style: { fontFamily: "'JetBrains Mono', monospace" }
        }
      ) : /* @__PURE__ */ jsx5(
        "span",
        {
          className: "flex-1 text-[11px] text-foreground truncate cursor-text",
          style: { fontFamily: "'JetBrains Mono', monospace" },
          onClick: () => {
            setEditValue(value);
            setEditing(true);
          },
          children: value
        }
      )
    ] })
  ] });
}
function StyleSection({
  category,
  elementStyles,
  elementId
}) {
  const [expanded, setExpanded] = useState2(true);
  const activeProperties = category.properties.filter(
    (p) => elementStyles[p] !== void 0 && elementStyles[p] !== ""
  );
  if (activeProperties.length === 0) return null;
  return /* @__PURE__ */ jsxs4("div", { className: "border-b border-[#1a1a1a]", children: [
    /* @__PURE__ */ jsxs4(
      "button",
      {
        className: "flex items-center w-full px-3 py-2 hover:bg-[#ffffff06] transition-colors",
        onClick: () => setExpanded(!expanded),
        children: [
          expanded ? /* @__PURE__ */ jsx5(ChevronDown2, { className: "w-3 h-3 text-muted-foreground mr-1.5" }) : /* @__PURE__ */ jsx5(ChevronRight2, { className: "w-3 h-3 text-muted-foreground mr-1.5" }),
          /* @__PURE__ */ jsx5("span", { className: "mr-1.5 text-muted-foreground", children: category.icon }),
          /* @__PURE__ */ jsx5("span", { className: "text-[11px] text-foreground", children: category.name }),
          /* @__PURE__ */ jsx5("span", { className: "ml-auto text-[10px] text-muted-foreground", children: activeProperties.length })
        ]
      }
    ),
    expanded && /* @__PURE__ */ jsx5("div", { className: "pb-1", children: activeProperties.map((prop) => /* @__PURE__ */ jsx5(
      StylePropertyRow,
      {
        property: prop,
        value: elementStyles[prop],
        elementId
      },
      prop
    )) })
  ] });
}
function StylePanel() {
  const { state } = useWorkspace();
  const [tab, setTab] = useState2("styles");
  const selectedElement = state.selectedElementId ? findElement(state.elements, state.selectedElementId) : null;
  if (!selectedElement) {
    return /* @__PURE__ */ jsxs4("div", { className: "h-full flex flex-col bg-[#0a0a0a] border-l border-border", children: [
      /* @__PURE__ */ jsx5("div", { className: "px-3 py-2.5 border-b border-border", children: /* @__PURE__ */ jsx5("span", { className: "text-[11px] tracking-wider text-muted-foreground uppercase", children: "Style" }) }),
      /* @__PURE__ */ jsx5("div", { className: "flex-1 flex items-center justify-center p-6", children: /* @__PURE__ */ jsx5("div", { className: "text-center", children: state.elements.length === 0 ? /* @__PURE__ */ jsxs4(Fragment, { children: [
        /* @__PURE__ */ jsx5(Globe2, { className: "w-8 h-8 text-[#222222] mx-auto mb-3" }),
        /* @__PURE__ */ jsx5("p", { className: "text-[12px] text-muted-foreground", children: "Connect a project to inspect styles" })
      ] }) : /* @__PURE__ */ jsxs4(Fragment, { children: [
        /* @__PURE__ */ jsx5(MousePointer22, { className: "w-8 h-8 text-[#222222] mx-auto mb-3" }),
        /* @__PURE__ */ jsx5("p", { className: "text-[12px] text-muted-foreground", children: "Select an element to inspect its styles" })
      ] }) }) })
    ] });
  }
  const styleCount = Object.keys(selectedElement.styles).length;
  const cssOutput = Object.entries(selectedElement.styles).map(
    ([k, v]) => `  ${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`
  ).join("\n");
  return /* @__PURE__ */ jsxs4("div", { className: "h-full flex flex-col bg-[#0a0a0a] border-l border-border", children: [
    /* @__PURE__ */ jsxs4("div", { className: "px-3 py-2.5 border-b border-border", children: [
      /* @__PURE__ */ jsxs4("div", { className: "flex items-center justify-between mb-2", children: [
        /* @__PURE__ */ jsx5("span", { className: "text-[11px] tracking-wider text-muted-foreground uppercase", children: "Style" }),
        /* @__PURE__ */ jsx5(
          "button",
          {
            className: "p-1 hover:bg-[#1a1a1a] rounded transition-colors",
            onClick: () => {
              copyToClipboard(
                `${selectedElement.selector} {
${cssOutput}
}`
              );
            },
            title: "Copy CSS",
            children: /* @__PURE__ */ jsx5(Copy, { className: "w-3.5 h-3.5 text-muted-foreground" })
          }
        )
      ] }),
      /* @__PURE__ */ jsxs4("div", { className: "flex items-center gap-2 mb-2", children: [
        /* @__PURE__ */ jsxs4(
          "span",
          {
            className: "text-[12px] text-[#0070f3] bg-[#0070f3]/10 px-1.5 py-0.5 rounded",
            style: { fontFamily: "'JetBrains Mono', monospace" },
            children: [
              "<",
              selectedElement.tag,
              ">"
            ]
          }
        ),
        styleCount > 0 && /* @__PURE__ */ jsxs4("span", { className: "text-[10px] text-muted-foreground", children: [
          styleCount,
          " properties"
        ] })
      ] }),
      selectedElement.classes.length > 0 && /* @__PURE__ */ jsxs4("div", { className: "flex flex-wrap gap-1", children: [
        selectedElement.classes.slice(0, 6).map((cls) => /* @__PURE__ */ jsxs4(
          "span",
          {
            className: "text-[10px] text-muted-foreground bg-[#111111] px-1.5 py-0.5 rounded border border-[#1a1a1a]",
            style: { fontFamily: "'JetBrains Mono', monospace" },
            children: [
              ".",
              cls
            ]
          },
          cls
        )),
        selectedElement.classes.length > 6 && /* @__PURE__ */ jsxs4("span", { className: "text-[10px] text-muted-foreground", children: [
          "+",
          selectedElement.classes.length - 6
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx5("div", { className: "flex border-b border-border", children: ["styles", "computed", "code"].map((t) => /* @__PURE__ */ jsx5(
      "button",
      {
        className: `flex-1 py-2 text-[11px] transition-colors ${tab === t ? "text-foreground border-b border-foreground" : "text-muted-foreground hover:text-foreground"}`,
        onClick: () => setTab(t),
        children: t.charAt(0).toUpperCase() + t.slice(1)
      },
      t
    )) }),
    /* @__PURE__ */ jsxs4(ScrollArea, { className: "flex-1", children: [
      tab === "styles" && /* @__PURE__ */ jsxs4("div", { children: [
        STYLE_CATEGORIES.map((cat) => /* @__PURE__ */ jsx5(
          StyleSection,
          {
            category: cat,
            elementStyles: selectedElement.styles,
            elementId: selectedElement.id
          },
          cat.name
        )),
        styleCount === 0 && /* @__PURE__ */ jsxs4("div", { className: "p-6 text-center", children: [
          /* @__PURE__ */ jsx5("p", { className: "text-[12px] text-muted-foreground", children: "No computed styles available yet." }),
          /* @__PURE__ */ jsx5("p", { className: "text-[10px] text-muted-foreground mt-1", children: "Click this element in the preview to load styles." })
        ] })
      ] }),
      tab === "computed" && /* @__PURE__ */ jsxs4("div", { className: "p-3", children: [
        /* @__PURE__ */ jsxs4("div", { className: "mb-4", children: [
          /* @__PURE__ */ jsx5("span", { className: "text-[11px] text-muted-foreground mb-2 block", children: "Box Model" }),
          /* @__PURE__ */ jsxs4("div", { className: "bg-[#ff980020] border border-[#ff980040] rounded-lg p-3 text-center", children: [
            /* @__PURE__ */ jsxs4("div", { className: "text-[10px] text-[#ff9800] mb-1", children: [
              "margin",
              /* @__PURE__ */ jsx5("span", { className: "text-[9px] opacity-60 ml-1", children: selectedElement.styles.margin || selectedElement.styles.marginTop || "0" })
            ] }),
            /* @__PURE__ */ jsxs4("div", { className: "bg-[#4caf5020] border border-[#4caf5040] rounded p-3", children: [
              /* @__PURE__ */ jsxs4("div", { className: "text-[10px] text-[#4caf50] mb-1", children: [
                "padding",
                /* @__PURE__ */ jsx5("span", { className: "text-[9px] opacity-60 ml-1", children: selectedElement.styles.padding || selectedElement.styles.paddingTop || "0" })
              ] }),
              /* @__PURE__ */ jsx5("div", { className: "bg-[#2196f320] border border-[#2196f340] rounded p-2", children: /* @__PURE__ */ jsxs4("span", { className: "text-[11px] text-[#2196f3]", children: [
                selectedElement.styles.width || "auto",
                " x",
                " ",
                selectedElement.styles.height || "auto"
              ] }) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs4("div", { className: "mb-3", children: [
          /* @__PURE__ */ jsx5("span", { className: "text-[11px] text-muted-foreground mb-1 block", children: "Selector" }),
          /* @__PURE__ */ jsx5(
            "code",
            {
              className: "text-[11px] text-[#50e3c2] bg-[#111111] px-2 py-1.5 rounded block border border-[#1a1a1a] break-all",
              style: { fontFamily: "'JetBrains Mono', monospace" },
              children: selectedElement.selector
            }
          )
        ] }),
        /* @__PURE__ */ jsxs4("div", { children: [
          /* @__PURE__ */ jsxs4("span", { className: "text-[11px] text-muted-foreground mb-2 block", children: [
            "All Properties (",
            styleCount,
            ")"
          ] }),
          /* @__PURE__ */ jsx5("div", { className: "space-y-0", children: Object.entries(selectedElement.styles).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => /* @__PURE__ */ jsxs4(
            "div",
            {
              className: "flex items-center py-1 text-[10px] border-b border-[#111111]",
              style: { fontFamily: "'JetBrains Mono', monospace" },
              children: [
                /* @__PURE__ */ jsx5("span", { className: "text-muted-foreground w-[110px] shrink-0 truncate", children: k.replace(/([A-Z])/g, "-$1").toLowerCase() }),
                /* @__PURE__ */ jsx5("span", { className: "text-foreground truncate", children: v })
              ]
            },
            k
          )) })
        ] })
      ] }),
      tab === "code" && /* @__PURE__ */ jsx5("div", { className: "p-3", children: /* @__PURE__ */ jsxs4(
        "pre",
        {
          className: "text-[11px] text-foreground bg-[#111111] p-3 rounded border border-[#1a1a1a] overflow-x-auto whitespace-pre",
          style: { fontFamily: "'JetBrains Mono', monospace" },
          children: [
            /* @__PURE__ */ jsx5("span", { className: "text-muted-foreground", children: "/* CSS */\n" }),
            /* @__PURE__ */ jsx5("span", { className: "text-[#50e3c2]", children: selectedElement.selector }),
            /* @__PURE__ */ jsx5("span", { className: "text-muted-foreground", children: " {\n" }),
            Object.entries(selectedElement.styles).map(([k, v]) => /* @__PURE__ */ jsxs4("span", { children: [
              /* @__PURE__ */ jsxs4("span", { className: "text-[#79b8ff]", children: [
                "  ",
                k.replace(/([A-Z])/g, "-$1").toLowerCase()
              ] }),
              /* @__PURE__ */ jsx5("span", { className: "text-muted-foreground", children: ": " }),
              /* @__PURE__ */ jsx5("span", { className: "text-[#f5a623]", children: v }),
              /* @__PURE__ */ jsx5("span", { className: "text-muted-foreground", children: ";\n" })
            ] }, k)),
            /* @__PURE__ */ jsx5("span", { className: "text-muted-foreground", children: "}" })
          ]
        }
      ) })
    ] })
  ] });
}

// src/app/components/live-canvas.tsx
import { useEffect, useCallback, useRef, useState as useState3 } from "react";
import {
  MousePointer2 as MousePointer23,
  RefreshCw,
  Copy as Copy2,
  Check,
  Crosshair,
  Zap as Zap2,
  Eye as Eye2
} from "lucide-react";
import { Fragment as Fragment2, jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function LiveCanvas() {
  const { state, dispatch } = useWorkspace();
  const [inspecting, setInspecting] = useState3(false);
  const [copied, setCopied] = useState3(false);
  const [elementCount, setElementCount] = useState3(0);
  const [lastScan, setLastScan] = useState3(0);
  const hasScannedRef = useRef(false);
  const scanDOM = useCallback(() => {
    const tree = buildElementTree();
    rebuildElementMap();
    dispatch({ type: "SET_ELEMENTS", elements: tree });
    setElementCount(countNodes(tree));
    setLastScan(Date.now());
  }, [dispatch]);
  useEffect(() => {
    if (!hasScannedRef.current) {
      hasScannedRef.current = true;
      const timer = setTimeout(scanDOM, 300);
      return () => clearTimeout(timer);
    }
  }, [scanDOM]);
  useEffect(() => {
    if (state.hoveredElementId) {
      highlightElement(state.hoveredElementId, "hover");
    } else {
      highlightElement(null, "hover");
    }
  }, [state.hoveredElementId]);
  useEffect(() => {
    if (state.selectedElementId) {
      highlightElement(state.selectedElementId, "select");
    } else {
      highlightElement(null, "select");
    }
  }, [state.selectedElementId]);
  const toggleInspect = useCallback(() => {
    if (isInspecting()) {
      stopInspect();
      setInspecting(false);
    } else {
      startInspect((id, el) => {
        dispatch({ type: "SELECT_ELEMENT", id });
        const computed = window.getComputedStyle(el);
        const styles = {};
        const props = [
          "color",
          "backgroundColor",
          "fontSize",
          "fontFamily",
          "fontWeight",
          "lineHeight",
          "letterSpacing",
          "textAlign",
          "padding",
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
          "margin",
          "marginTop",
          "marginRight",
          "marginBottom",
          "marginLeft",
          "width",
          "height",
          "maxWidth",
          "maxHeight",
          "minWidth",
          "minHeight",
          "display",
          "flexDirection",
          "alignItems",
          "justifyContent",
          "gap",
          "position",
          "top",
          "right",
          "bottom",
          "left",
          "zIndex",
          "overflow",
          "opacity",
          "borderRadius",
          "border",
          "borderColor",
          "borderWidth",
          "boxShadow",
          "transform",
          "transition",
          "gridTemplateColumns"
        ];
        for (const prop of props) {
          const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
          const val = computed.getPropertyValue(cssProp);
          if (val && val !== "none" && val !== "normal" && val !== "auto") {
            styles[prop] = val;
          }
        }
        dispatch({ type: "SET_ELEMENT_STYLES", id, styles });
        stopInspect();
        setInspecting(false);
      });
      setInspecting(true);
    }
  }, [dispatch]);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        toggleInspect();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleInspect]);
  const handleCopy = useCallback(() => {
    if (!state.selectedElementId) return;
    const output = generateAgentOutput(state.selectedElementId);
    copyToClipboard(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  }, [state.selectedElementId]);
  useEffect(() => {
    return () => {
      stopInspect();
      cleanup();
    };
  }, []);
  const timeSinceScan = lastScan ? Math.round((Date.now() - lastScan) / 1e3) : null;
  return /* @__PURE__ */ jsxs5("div", { className: "flex-1 flex flex-col bg-[#0a0a0a] relative", children: [
    /* @__PURE__ */ jsxs5("div", { className: "h-9 border-b border-border bg-[#0a0a0a] flex items-center justify-between px-3", children: [
      /* @__PURE__ */ jsxs5("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxs5(
          "button",
          {
            onClick: toggleInspect,
            className: `flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-all ${inspecting ? "bg-[#0070f3] text-white" : "bg-[#111111] border border-[#1a1a1a] text-muted-foreground hover:text-foreground hover:border-[#333333]"}`,
            children: [
              /* @__PURE__ */ jsx6(Crosshair, { className: "w-3 h-3" }),
              inspecting ? "Inspecting..." : "Inspect",
              /* @__PURE__ */ jsx6("kbd", { className: "text-[9px] opacity-50 ml-1", children: "I" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs5(
          "button",
          {
            onClick: scanDOM,
            className: "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] bg-[#111111] border border-[#1a1a1a] text-muted-foreground hover:text-foreground hover:border-[#333333] transition-all",
            children: [
              /* @__PURE__ */ jsx6(RefreshCw, { className: "w-3 h-3" }),
              "Rescan"
            ]
          }
        ),
        /* @__PURE__ */ jsx6("span", { className: "text-[10px] text-[#444444]", children: elementCount > 0 ? `${elementCount} elements` : "" })
      ] }),
      /* @__PURE__ */ jsxs5("div", { className: "flex items-center gap-2", children: [
        state.selectedElementId && /* @__PURE__ */ jsx6(
          "button",
          {
            onClick: handleCopy,
            className: "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-[#0070f3]/10 border border-[#0070f3]/20 text-[#0070f3] hover:bg-[#0070f3]/20 transition-all",
            children: copied ? /* @__PURE__ */ jsxs5(Fragment2, { children: [
              /* @__PURE__ */ jsx6(Check, { className: "w-3 h-3" }),
              "Copied!"
            ] }) : /* @__PURE__ */ jsxs5(Fragment2, { children: [
              /* @__PURE__ */ jsx6(Copy2, { className: "w-3 h-3" }),
              "Copy for Agent"
            ] })
          }
        ),
        /* @__PURE__ */ jsxs5("div", { className: "flex items-center gap-1 px-2 py-0.5 rounded bg-[#50e3c2]/10 border border-[#50e3c2]/20", children: [
          /* @__PURE__ */ jsx6(Zap2, { className: "w-2.5 h-2.5 text-[#50e3c2]" }),
          /* @__PURE__ */ jsx6("span", { className: "text-[9px] text-[#50e3c2]", children: "Engine Mode" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx6("div", { className: "flex-1 flex items-center justify-center", children: /* @__PURE__ */ jsx6("div", { className: "text-center max-w-[360px] px-4", children: inspecting ? /* @__PURE__ */ jsxs5(Fragment2, { children: [
      /* @__PURE__ */ jsx6("div", { className: "w-12 h-12 rounded-2xl bg-[#0070f3]/10 border border-[#0070f3]/20 flex items-center justify-center mx-auto mb-4", children: /* @__PURE__ */ jsx6(Crosshair, { className: "w-5 h-5 text-[#0070f3] animate-pulse" }) }),
      /* @__PURE__ */ jsx6("h3", { className: "text-[15px] text-foreground mb-2", children: "Click any element on the page" }),
      /* @__PURE__ */ jsx6("p", { className: "text-[12px] text-muted-foreground", style: { lineHeight: "1.6" }, children: "Hover to preview, click to select. The element's styles and selector will appear in the panels." }),
      /* @__PURE__ */ jsx6(
        "button",
        {
          onClick: toggleInspect,
          className: "mt-4 text-[11px] text-[#0070f3] hover:underline",
          children: "Cancel inspection"
        }
      )
    ] }) : state.selectedElementId ? /* @__PURE__ */ jsxs5(Fragment2, { children: [
      /* @__PURE__ */ jsx6("div", { className: "w-12 h-12 rounded-2xl bg-[#50e3c2]/10 border border-[#50e3c2]/20 flex items-center justify-center mx-auto mb-4", children: /* @__PURE__ */ jsx6(Eye2, { className: "w-5 h-5 text-[#50e3c2]" }) }),
      /* @__PURE__ */ jsx6("h3", { className: "text-[15px] text-foreground mb-2", children: "Element selected" }),
      /* @__PURE__ */ jsx6("p", { className: "text-[12px] text-muted-foreground mb-1", children: "View and edit styles in the Style panel (right)." }),
      /* @__PURE__ */ jsx6("p", { className: "text-[12px] text-muted-foreground mb-4", children: "Browse the DOM tree in the Layers panel (left)." }),
      /* @__PURE__ */ jsxs5("div", { className: "flex items-center justify-center gap-2", children: [
        /* @__PURE__ */ jsxs5(
          "button",
          {
            onClick: toggleInspect,
            className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] bg-foreground text-background hover:opacity-90 transition-opacity",
            children: [
              /* @__PURE__ */ jsx6(Crosshair, { className: "w-3 h-3" }),
              "Inspect another"
            ]
          }
        ),
        /* @__PURE__ */ jsxs5(
          "button",
          {
            onClick: handleCopy,
            className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] border border-[#1a1a1a] text-muted-foreground hover:text-foreground hover:border-[#333333] transition-all",
            children: [
              copied ? /* @__PURE__ */ jsx6(Check, { className: "w-3 h-3" }) : /* @__PURE__ */ jsx6(Copy2, { className: "w-3 h-3" }),
              copied ? "Copied!" : "Copy for Agent"
            ]
          }
        )
      ] })
    ] }) : /* @__PURE__ */ jsxs5(Fragment2, { children: [
      /* @__PURE__ */ jsx6("div", { className: "w-12 h-12 rounded-2xl bg-[#111111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-4", children: /* @__PURE__ */ jsx6(MousePointer23, { className: "w-5 h-5 text-muted-foreground" }) }),
      /* @__PURE__ */ jsx6("h3", { className: "text-[15px] text-foreground mb-2", children: "Ready to inspect" }),
      /* @__PURE__ */ jsxs5("p", { className: "text-[12px] text-muted-foreground mb-1", style: { lineHeight: "1.6" }, children: [
        "DesignDead is running in engine mode. Click",
        " ",
        /* @__PURE__ */ jsx6("strong", { children: "Inspect" }),
        " or press",
        " ",
        /* @__PURE__ */ jsx6("kbd", { className: "px-1 py-0.5 bg-[#111111] border border-[#1a1a1a] rounded text-[10px]", children: "I" }),
        " ",
        "to start selecting elements on the page."
      ] }),
      /* @__PURE__ */ jsx6("p", { className: "text-[11px] text-[#444444] mt-3", style: { lineHeight: "1.6" }, children: "The layers panel shows the DOM tree. Select any element to view and edit its styles. Copy structured output for your AI agent." }),
      /* @__PURE__ */ jsxs5(
        "button",
        {
          onClick: toggleInspect,
          className: "mt-5 flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] bg-foreground text-background hover:opacity-90 transition-opacity mx-auto",
          children: [
            /* @__PURE__ */ jsx6(Crosshair, { className: "w-3.5 h-3.5" }),
            "Start inspecting"
          ]
        }
      )
    ] }) }) }),
    /* @__PURE__ */ jsxs5("div", { className: "h-6 border-t border-border bg-[#0a0a0a] flex items-center justify-between px-3", children: [
      /* @__PURE__ */ jsx6("span", { className: "text-[9px] text-[#444444]", children: elementCount > 0 ? `DOM: ${elementCount} elements scanned` : "No elements scanned yet" }),
      /* @__PURE__ */ jsx6("span", { className: "text-[9px] text-[#444444]", children: lastScan > 0 && `Last scan: ${new Date(lastScan).toLocaleTimeString()}` })
    ] })
  ] });
}
function countNodes(nodes) {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children) count += countNodes(node.children);
  }
  return count;
}

// src/app/components/agent-panel.tsx
import { useState as useState4 } from "react";
import {
  Zap as Zap3,
  Wifi as Wifi2,
  WifiOff,
  RefreshCw as RefreshCw2,
  Check as Check2,
  Clock,
  Copy as Copy3,
  Send
} from "lucide-react";
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 6e4);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
function IDECard({ ide }) {
  const { dispatch } = useWorkspace();
  const [copied, setCopied] = useState4(false);
  const copyCmd = (cmd) => {
    copyToClipboard(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  };
  const setupCmd = ide.type === "claude-code" ? "claude mcp add designdead" : `npx designdead@latest init --${ide.type}`;
  return /* @__PURE__ */ jsxs6("div", { className: "p-3 border border-[#1a1a1a] rounded-xl bg-[#080808] hover:border-[#333333] transition-colors", children: [
    /* @__PURE__ */ jsxs6("div", { className: "flex items-center justify-between mb-2.5", children: [
      /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-2.5", children: [
        /* @__PURE__ */ jsx7(
          "div",
          {
            className: "w-8 h-8 rounded-lg flex items-center justify-center text-[11px] text-white",
            style: { background: ide.color },
            children: ide.icon
          }
        ),
        /* @__PURE__ */ jsxs6("div", { children: [
          /* @__PURE__ */ jsx7("span", { className: "text-[13px] text-foreground block", children: ide.name }),
          /* @__PURE__ */ jsx7("span", { className: "text-[10px] text-muted-foreground", children: ide.description })
        ] })
      ] }),
      /* @__PURE__ */ jsx7("div", { children: ide.status === "connected" ? /* @__PURE__ */ jsxs6("span", { className: "flex items-center gap-1 text-[10px] text-[#50e3c2] bg-[#50e3c2]/10 px-1.5 py-0.5 rounded", children: [
        /* @__PURE__ */ jsx7("span", { className: "w-1.5 h-1.5 rounded-full bg-[#50e3c2] animate-pulse" }),
        "Connected"
      ] }) : ide.status === "connecting" ? /* @__PURE__ */ jsxs6("span", { className: "flex items-center gap-1 text-[10px] text-[#f5a623] bg-[#f5a623]/10 px-1.5 py-0.5 rounded", children: [
        /* @__PURE__ */ jsx7(RefreshCw2, { className: "w-3 h-3 animate-spin" }),
        "Connecting"
      ] }) : /* @__PURE__ */ jsxs6("span", { className: "flex items-center gap-1 text-[10px] text-muted-foreground bg-[#1a1a1a] px-1.5 py-0.5 rounded", children: [
        /* @__PURE__ */ jsx7("span", { className: "w-1.5 h-1.5 rounded-full bg-[#444444]" }),
        "Offline"
      ] }) })
    ] }),
    ide.lastSync && /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-1 text-[10px] text-muted-foreground mb-2.5", children: [
      /* @__PURE__ */ jsx7(Clock, { className: "w-3 h-3" }),
      "Last synced ",
      formatTimeAgo(ide.lastSync)
    ] }),
    ide.status === "disconnected" && /* @__PURE__ */ jsxs6(
      "button",
      {
        onClick: () => copyCmd(setupCmd),
        className: "w-full flex items-center justify-between bg-[#111111] border border-[#1a1a1a] rounded-lg px-3 py-2 hover:border-[#333333] transition-colors group mb-2.5",
        children: [
          /* @__PURE__ */ jsx7(
            "code",
            {
              className: "text-[10px] text-[#50e3c2]",
              style: { fontFamily: "'Geist Mono', monospace" },
              children: setupCmd
            }
          ),
          copied ? /* @__PURE__ */ jsx7(Check2, { className: "w-3 h-3 text-[#50e3c2]" }) : /* @__PURE__ */ jsx7(Copy3, { className: "w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" })
        ]
      }
    ),
    /* @__PURE__ */ jsx7("div", { className: "flex gap-2", children: ide.status === "connected" ? /* @__PURE__ */ jsxs6(
      "button",
      {
        className: "flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-[#1a1a1a] rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:border-[#333333] transition-colors",
        onClick: () => dispatch({ type: "UPDATE_IDE_STATUS", id: ide.id, status: "disconnected" }),
        children: [
          /* @__PURE__ */ jsx7(WifiOff, { className: "w-3 h-3" }),
          "Disconnect"
        ]
      }
    ) : /* @__PURE__ */ jsxs6(
      "button",
      {
        className: "flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-foreground text-background rounded-lg text-[11px] hover:opacity-90 transition-opacity",
        onClick: () => dispatch({ type: "UPDATE_IDE_STATUS", id: ide.id, status: "connected" }),
        children: [
          /* @__PURE__ */ jsx7(Wifi2, { className: "w-3 h-3" }),
          "Connect"
        ]
      }
    ) })
  ] });
}
function AgentPanel() {
  const { state } = useWorkspace();
  const [tab, setTab] = useState4("ides");
  const [copied, setCopied] = useState4(false);
  const connectedCount = state.ides.filter((i) => i.status === "connected").length;
  const generateOutput = () => {
    const changes = state.styleChanges.map((c) => {
      const findSel = (els, id) => {
        for (const el of els) {
          if (el.id === id) return el.selector;
          const found = findSel(el.children, id);
          if (found) return found;
        }
        return "";
      };
      return {
        selector: findSel(state.elements, c.elementId),
        property: c.property.replace(/([A-Z])/g, "-$1").toLowerCase(),
        from: c.oldValue,
        to: c.newValue
      };
    });
    return `## Design Changes from designdead

${changes.map(
      (c) => `- **${c.selector}**: \`${c.property}\` changed from \`${c.from || "(none)"}\` to \`${c.to}\``
    ).join("\n")}

---

Please apply these CSS changes to the codebase. Use \`grep\` to find the relevant selectors and update the styles accordingly.`;
  };
  return /* @__PURE__ */ jsxs6("div", { className: "h-full flex flex-col bg-[#0a0a0a]", children: [
    /* @__PURE__ */ jsx7("div", { className: "px-4 py-3 border-b border-border flex items-center justify-between", children: /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx7(Zap3, { className: "w-4 h-4 text-[#f5a623]" }),
      /* @__PURE__ */ jsx7("span", { className: "text-[13px] text-foreground", children: "IDE & Agents" }),
      connectedCount > 0 && /* @__PURE__ */ jsxs6("span", { className: "text-[10px] text-[#50e3c2] bg-[#50e3c2]/10 px-1.5 py-0.5 rounded", children: [
        connectedCount,
        " active"
      ] })
    ] }) }),
    /* @__PURE__ */ jsx7("div", { className: "flex border-b border-border", children: ["ides", "output", "activity"].map((t) => /* @__PURE__ */ jsx7(
      "button",
      {
        className: `flex-1 py-2 text-[11px] transition-colors ${tab === t ? "text-foreground border-b border-foreground" : "text-muted-foreground hover:text-foreground"}`,
        onClick: () => setTab(t),
        children: t === "ides" ? "IDE" : t.charAt(0).toUpperCase() + t.slice(1)
      },
      t
    )) }),
    /* @__PURE__ */ jsxs6(ScrollArea, { className: "flex-1", children: [
      tab === "ides" && /* @__PURE__ */ jsx7("div", { className: "p-3 space-y-2", children: state.ides.map((ide) => /* @__PURE__ */ jsx7(IDECard, { ide }, ide.id)) }),
      tab === "output" && /* @__PURE__ */ jsxs6("div", { className: "p-3", children: [
        /* @__PURE__ */ jsxs6("div", { className: "flex items-center justify-between mb-2", children: [
          /* @__PURE__ */ jsx7("span", { className: "text-[11px] text-muted-foreground", children: "Structured output for AI agents" }),
          /* @__PURE__ */ jsxs6(
            "button",
            {
              className: "flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors",
              onClick: () => {
                copyToClipboard(generateOutput());
                setCopied(true);
                setTimeout(() => setCopied(false), 2e3);
              },
              children: [
                copied ? /* @__PURE__ */ jsx7(Check2, { className: "w-3 h-3 text-[#50e3c2]" }) : /* @__PURE__ */ jsx7(Copy3, { className: "w-3 h-3" }),
                copied ? "Copied" : "Copy"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsx7(
          "pre",
          {
            className: "text-[11px] text-foreground bg-[#111111] p-3 rounded-xl border border-[#1a1a1a] overflow-x-auto whitespace-pre-wrap",
            style: { fontFamily: "'Geist Mono', 'JetBrains Mono', monospace" },
            children: state.styleChanges.length > 0 ? generateOutput() : "No style changes yet.\n\nEdit element styles in the Style panel to generate\nstructured instructions for your AI agent."
          }
        ),
        state.styleChanges.length > 0 && connectedCount > 0 && /* @__PURE__ */ jsxs6("button", { className: "w-full mt-3 flex items-center justify-center gap-2 py-2 bg-foreground text-background rounded-lg text-[12px] hover:opacity-90 transition-opacity", children: [
          /* @__PURE__ */ jsx7(Send, { className: "w-3.5 h-3.5" }),
          "Send to connected IDE"
        ] })
      ] }),
      tab === "activity" && /* @__PURE__ */ jsx7("div", { className: "p-3 space-y-1", children: [
        { time: "12:45:02", msg: "Connected to Claude Code via MCP", type: "success" },
        { time: "12:45:05", msg: "Project detected: Next.js (localhost:3000)", type: "info" },
        { time: "12:46:12", msg: "3 style changes captured", type: "info" },
        { time: "12:46:14", msg: "Changes sent to Claude Code", type: "success" },
        { time: "12:47:30", msg: "Applied: src/components/Hero.tsx", type: "success" },
        { time: "12:48:01", msg: "Watching for new edits...", type: "info" }
      ].map((log, i) => /* @__PURE__ */ jsxs6(
        "div",
        {
          className: "flex items-start gap-2 py-1.5 border-b border-[#111111] last:border-0",
          children: [
            /* @__PURE__ */ jsx7(
              "span",
              {
                className: "text-[10px] text-muted-foreground shrink-0 mt-0.5",
                style: { fontFamily: "'Geist Mono', monospace" },
                children: log.time
              }
            ),
            /* @__PURE__ */ jsx7(
              "span",
              {
                className: `text-[11px] ${log.type === "success" ? "text-[#50e3c2]" : "text-muted-foreground"}`,
                children: log.msg
              }
            )
          ]
        },
        i
      )) })
    ] })
  ] });
}

// src/app/components/brainstorm-panel.tsx
import { useState as useState5 } from "react";
import {
  Lightbulb as Lightbulb2,
  Plus,
  X,
  Link2 as Link22,
  Sparkles,
  MessageSquare,
  ArrowRight as ArrowRight2,
  Star
} from "lucide-react";
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
var NOTE_COLORS = [
  "#0070f3",
  "#7928ca",
  "#ff0080",
  "#f5a623",
  "#50e3c2",
  "#ff4444"
];
function BrainstormPanel() {
  const { state, dispatch } = useWorkspace();
  const [newNote, setNewNote] = useState5("");
  const [selectedColor, setSelectedColor] = useState5(NOTE_COLORS[0]);
  const addNote = () => {
    if (!newNote.trim()) return;
    const note = {
      id: `note-${Date.now()}`,
      content: newNote,
      timestamp: Date.now(),
      linkedVersions: [],
      color: selectedColor
    };
    dispatch({ type: "ADD_BRAINSTORM_NOTE", note });
    setNewNote("");
  };
  const quickPrompts = [
    "Try a gradient background on the hero",
    "Make the CTA more prominent",
    "Add more whitespace between sections",
    "Test a dark variant of this layout",
    "Reduce font sizes for mobile",
    "Try rounded corners on cards"
  ];
  return /* @__PURE__ */ jsxs7("div", { className: "h-full flex flex-col bg-[#0a0a0a]", children: [
    /* @__PURE__ */ jsxs7("div", { className: "px-4 py-3 border-b border-border flex items-center gap-2", children: [
      /* @__PURE__ */ jsx8(Lightbulb2, { className: "w-4 h-4 text-[#f5a623]" }),
      /* @__PURE__ */ jsx8("span", { className: "text-[13px] text-foreground", children: "Brainstorm" }),
      /* @__PURE__ */ jsx8(Sparkles, { className: "w-3 h-3 text-[#7928ca]" })
    ] }),
    /* @__PURE__ */ jsx8(ScrollArea, { className: "flex-1", children: /* @__PURE__ */ jsxs7("div", { className: "p-3", children: [
      /* @__PURE__ */ jsxs7("div", { className: "mb-4", children: [
        /* @__PURE__ */ jsx8("span", { className: "text-[11px] text-muted-foreground mb-2 block", children: "Quick Ideas" }),
        /* @__PURE__ */ jsx8("div", { className: "flex flex-wrap gap-1.5", children: quickPrompts.map((prompt, i) => /* @__PURE__ */ jsx8(
          "button",
          {
            className: "text-[10px] text-muted-foreground bg-[#111111] border border-[#1a1a1a] px-2 py-1 rounded-full hover:text-foreground hover:border-[#333333] transition-colors",
            onClick: () => setNewNote(prompt),
            children: prompt
          },
          i
        )) })
      ] }),
      /* @__PURE__ */ jsxs7("div", { className: "mb-4", children: [
        /* @__PURE__ */ jsx8(
          "textarea",
          {
            placeholder: "Describe a design idea or variation...",
            value: newNote,
            onChange: (e) => setNewNote(e.target.value),
            className: "w-full bg-[#111111] border border-[#222222] rounded-lg px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#333333] resize-none h-20 transition-colors",
            onKeyDown: (e) => {
              if (e.key === "Enter" && e.metaKey) addNote();
            }
          }
        ),
        /* @__PURE__ */ jsxs7("div", { className: "flex items-center justify-between mt-2", children: [
          /* @__PURE__ */ jsx8("div", { className: "flex items-center gap-1.5", children: NOTE_COLORS.map((color) => /* @__PURE__ */ jsx8(
            "button",
            {
              className: `w-4 h-4 rounded-full transition-transform ${selectedColor === color ? "scale-125 ring-1 ring-white/30" : ""}`,
              style: { background: color },
              onClick: () => setSelectedColor(color)
            },
            color
          )) }),
          /* @__PURE__ */ jsxs7(
            "button",
            {
              className: "flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded text-[11px] hover:opacity-90 transition-opacity disabled:opacity-30",
              disabled: !newNote.trim(),
              onClick: addNote,
              children: [
                /* @__PURE__ */ jsx8(Plus, { className: "w-3 h-3" }),
                "Add"
              ]
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs7("div", { className: "space-y-2", children: [
        state.brainstormNotes.length === 0 && /* @__PURE__ */ jsxs7("div", { className: "text-center py-8", children: [
          /* @__PURE__ */ jsx8(MessageSquare, { className: "w-8 h-8 text-[#222222] mx-auto mb-3" }),
          /* @__PURE__ */ jsx8("p", { className: "text-[12px] text-muted-foreground", children: "No ideas yet. Start brainstorming!" }),
          /* @__PURE__ */ jsx8("p", { className: "text-[10px] text-muted-foreground mt-1", children: "Ideas will be linked to versions and sent to agents" })
        ] }),
        state.brainstormNotes.map((note) => /* @__PURE__ */ jsxs7(
          "div",
          {
            className: "p-3 border rounded-lg bg-[#0a0a0a] hover:border-[#333333] transition-colors group",
            style: { borderColor: `${note.color}30` },
            children: [
              /* @__PURE__ */ jsxs7("div", { className: "flex items-start justify-between", children: [
                /* @__PURE__ */ jsxs7("div", { className: "flex items-start gap-2 flex-1", children: [
                  /* @__PURE__ */ jsx8(
                    "div",
                    {
                      className: "w-2 h-2 rounded-full mt-1 shrink-0",
                      style: { background: note.color }
                    }
                  ),
                  /* @__PURE__ */ jsx8("p", { className: "text-[12px] text-foreground", children: note.content })
                ] }),
                /* @__PURE__ */ jsx8(
                  "button",
                  {
                    className: "opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#1a1a1a] rounded transition-all",
                    onClick: () => dispatch({ type: "DELETE_BRAINSTORM_NOTE", id: note.id }),
                    children: /* @__PURE__ */ jsx8(X, { className: "w-3 h-3 text-muted-foreground" })
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs7("div", { className: "flex items-center gap-2 mt-2 ml-4", children: [
                /* @__PURE__ */ jsxs7("button", { className: "flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[#0070f3] transition-colors", children: [
                  /* @__PURE__ */ jsx8(ArrowRight2, { className: "w-3 h-3" }),
                  "Send to IDE"
                ] }),
                /* @__PURE__ */ jsxs7("button", { className: "flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[#7928ca] transition-colors", children: [
                  /* @__PURE__ */ jsx8(Link22, { className: "w-3 h-3" }),
                  "Link Version"
                ] }),
                /* @__PURE__ */ jsxs7("button", { className: "flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[#f5a623] transition-colors", children: [
                  /* @__PURE__ */ jsx8(Star, { className: "w-3 h-3" }),
                  "Favorite"
                ] })
              ] })
            ]
          },
          note.id
        ))
      ] })
    ] }) })
  ] });
}

// src/app/components/version-manager.tsx
import { useState as useState6 } from "react";
import {
  GitBranch,
  Plus as Plus2,
  Send as Send2,
  Clock as Clock2,
  MoreHorizontal,
  ArrowUpRight,
  Copy as Copy4
} from "lucide-react";
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
function formatTimeAgo2(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 6e4);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
var STATUS_STYLES = {
  draft: { bg: "bg-[#333333]", text: "text-[#888888]", label: "Draft" },
  active: { bg: "bg-[#0070f3]/20", text: "text-[#0070f3]", label: "Active" },
  sent: { bg: "bg-[#7928ca]/20", text: "text-[#7928ca]", label: "Sent" },
  applied: { bg: "bg-[#50e3c2]/20", text: "text-[#50e3c2]", label: "Applied" }
};
function VersionCard({ version }) {
  const { state, dispatch } = useWorkspace();
  const isActive = state.activeVersionId === version.id;
  const status = STATUS_STYLES[version.status];
  return /* @__PURE__ */ jsxs8(
    "div",
    {
      className: `p-3 border rounded-lg transition-all cursor-pointer ${isActive ? "border-[#0070f3]/40 bg-[#0070f3]/5" : "border-[#1a1a1a] bg-[#0a0a0a] hover:border-[#333333]"}`,
      onClick: () => dispatch({ type: "SET_ACTIVE_VERSION", id: version.id }),
      children: [
        /* @__PURE__ */ jsxs8("div", { className: "flex items-start justify-between mb-2", children: [
          /* @__PURE__ */ jsxs8("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx9(GitBranch, { className: "w-3.5 h-3.5 text-muted-foreground" }),
            /* @__PURE__ */ jsx9("span", { className: "text-[13px] text-foreground", children: version.name })
          ] }),
          /* @__PURE__ */ jsxs8("div", { className: "flex items-center gap-1.5", children: [
            /* @__PURE__ */ jsx9("span", { className: `text-[10px] px-1.5 py-0.5 rounded ${status.bg} ${status.text}`, children: status.label }),
            /* @__PURE__ */ jsx9("button", { className: "p-0.5 hover:bg-[#1a1a1a] rounded", children: /* @__PURE__ */ jsx9(MoreHorizontal, { className: "w-3.5 h-3.5 text-muted-foreground" }) })
          ] })
        ] }),
        version.description && /* @__PURE__ */ jsx9("p", { className: "text-[11px] text-muted-foreground mb-2 pl-5.5", children: version.description }),
        /* @__PURE__ */ jsxs8("div", { className: "flex items-center justify-between pl-5.5", children: [
          /* @__PURE__ */ jsxs8("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx9(Clock2, { className: "w-3 h-3 text-muted-foreground" }),
            /* @__PURE__ */ jsx9("span", { className: "text-[10px] text-muted-foreground", children: formatTimeAgo2(version.timestamp) })
          ] }),
          version.agentTarget && /* @__PURE__ */ jsxs8("span", { className: "text-[10px] text-[#7928ca] flex items-center gap-1", children: [
            /* @__PURE__ */ jsx9(ArrowUpRight, { className: "w-3 h-3" }),
            version.agentTarget
          ] })
        ] }),
        isActive && /* @__PURE__ */ jsxs8("div", { className: "flex gap-2 mt-3 pt-3 border-t border-[#1a1a1a]", children: [
          /* @__PURE__ */ jsxs8(
            "button",
            {
              className: "flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#0070f3] text-white rounded text-[11px] hover:bg-[#0070f3]/90 transition-colors",
              onClick: (e) => {
                e.stopPropagation();
                const ide = state.ides.find((i) => i.status === "connected");
                if (ide) {
                  dispatch({ type: "SEND_TO_IDE", versionId: version.id, ideId: ide.id });
                }
              },
              children: [
                /* @__PURE__ */ jsx9(Send2, { className: "w-3 h-3" }),
                "Send to IDE"
              ]
            }
          ),
          /* @__PURE__ */ jsx9(
            "button",
            {
              className: "p-1.5 border border-[#1a1a1a] rounded hover:bg-[#1a1a1a] transition-colors",
              onClick: (e) => e.stopPropagation(),
              children: /* @__PURE__ */ jsx9(Copy4, { className: "w-3 h-3 text-muted-foreground" })
            }
          )
        ] })
      ]
    }
  );
}
function VersionManager() {
  const { state, dispatch } = useWorkspace();
  const [showNew, setShowNew] = useState6(false);
  const [newName, setNewName] = useState6("");
  const createVersion = () => {
    if (!newName.trim()) return;
    const version = {
      id: `v${Date.now()}`,
      name: newName,
      timestamp: Date.now(),
      changes: [...state.styleChanges],
      status: "draft",
      description: `${state.styleChanges.length} style changes captured`
    };
    dispatch({ type: "ADD_VERSION", version });
    setNewName("");
    setShowNew(false);
  };
  return /* @__PURE__ */ jsxs8("div", { className: "h-full flex flex-col", children: [
    /* @__PURE__ */ jsxs8("div", { className: "px-4 py-3 border-b border-border flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs8("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx9(GitBranch, { className: "w-4 h-4 text-muted-foreground" }),
        /* @__PURE__ */ jsx9("span", { className: "text-[13px] text-foreground", children: "Versions" }),
        /* @__PURE__ */ jsx9("span", { className: "text-[10px] text-muted-foreground bg-[#1a1a1a] px-1.5 py-0.5 rounded", children: state.versions.length })
      ] }),
      /* @__PURE__ */ jsx9(
        "button",
        {
          className: "p-1 hover:bg-[#1a1a1a] rounded transition-colors",
          onClick: () => setShowNew(!showNew),
          children: /* @__PURE__ */ jsx9(Plus2, { className: "w-4 h-4 text-muted-foreground" })
        }
      )
    ] }),
    showNew && /* @__PURE__ */ jsxs8("div", { className: "p-3 border-b border-border", children: [
      /* @__PURE__ */ jsx9(
        "input",
        {
          autoFocus: true,
          placeholder: "Version name...",
          value: newName,
          onChange: (e) => setNewName(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") createVersion();
            if (e.key === "Escape") setShowNew(false);
          },
          className: "w-full bg-[#111111] border border-[#222222] rounded px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#0070f3] mb-2"
        }
      ),
      /* @__PURE__ */ jsxs8("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx9(
          "button",
          {
            className: "flex-1 py-1.5 bg-foreground text-background rounded text-[11px] hover:opacity-90",
            onClick: createVersion,
            children: "Save Version"
          }
        ),
        /* @__PURE__ */ jsx9(
          "button",
          {
            className: "px-3 py-1.5 border border-border rounded text-[11px] text-muted-foreground hover:text-foreground",
            onClick: () => setShowNew(false),
            children: "Cancel"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx9(ScrollArea, { className: "flex-1 p-3", children: /* @__PURE__ */ jsx9("div", { className: "space-y-2", children: state.versions.slice().sort((a, b) => b.timestamp - a.timestamp).map((version) => /* @__PURE__ */ jsx9(VersionCard, { version }, version.id)) }) }),
    state.styleChanges.length > 0 && /* @__PURE__ */ jsxs8("div", { className: "p-3 border-t border-border bg-[#0a0a0a]", children: [
      /* @__PURE__ */ jsxs8("div", { className: "flex items-center justify-between mb-2", children: [
        /* @__PURE__ */ jsx9("span", { className: "text-[11px] text-foreground", children: "Unsaved Changes" }),
        /* @__PURE__ */ jsx9("span", { className: "text-[10px] text-[#f5a623] bg-[#f5a623]/10 px-1.5 py-0.5 rounded", children: state.styleChanges.length })
      ] }),
      /* @__PURE__ */ jsx9(
        "button",
        {
          className: "w-full py-1.5 border border-dashed border-[#333333] rounded text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground transition-colors",
          onClick: () => setShowNew(true),
          children: "+ Save as Version"
        }
      )
    ] })
  ] });
}

// src/app/components/command-palette.tsx
import { useState as useState7, useEffect as useEffect2, useRef as useRef2 } from "react";
import {
  Search,
  Layers as Layers2,
  Palette as Palette3,
  Zap as Zap4,
  Lightbulb as Lightbulb3,
  GitBranch as GitBranch2,
  MousePointer2 as MousePointer24,
  Send as Send3,
  Copy as Copy5,
  FileCode as FileCode3,
  PenTool as PenTool2
} from "lucide-react";
import { jsx as jsx10, jsxs as jsxs9 } from "react/jsx-runtime";
function CommandPalette() {
  const { state, dispatch } = useWorkspace();
  const [search, setSearch] = useState7("");
  const inputRef = useRef2(null);
  useEffect2(() => {
    inputRef.current?.focus();
  }, []);
  useEffect2(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch]);
  const commands = [
    {
      id: "toggle-layers",
      label: "Toggle Layers Panel",
      description: "Show or hide the layers panel",
      icon: /* @__PURE__ */ jsx10(Layers2, { className: "w-4 h-4" }),
      shortcut: "L",
      action: () => {
        dispatch({ type: "TOGGLE_LAYERS_PANEL" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Panels"
    },
    {
      id: "toggle-styles",
      label: "Toggle Style Panel",
      description: "Show or hide the style panel",
      icon: /* @__PURE__ */ jsx10(Palette3, { className: "w-4 h-4" }),
      shortcut: "S",
      action: () => {
        dispatch({ type: "TOGGLE_STYLE_PANEL" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Panels"
    },
    {
      id: "toggle-agents",
      label: "Toggle IDE Panel",
      description: "Show or hide the IDE & agents panel",
      icon: /* @__PURE__ */ jsx10(Zap4, { className: "w-4 h-4" }),
      shortcut: "A",
      action: () => {
        dispatch({ type: "TOGGLE_IDE_PANEL" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Panels"
    },
    {
      id: "toggle-brainstorm",
      label: "Toggle Brainstorm Mode",
      description: "Open the brainstorming panel",
      icon: /* @__PURE__ */ jsx10(Lightbulb3, { className: "w-4 h-4" }),
      shortcut: "B",
      action: () => {
        dispatch({ type: "TOGGLE_BRAINSTORM" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Panels"
    },
    {
      id: "toggle-inspector",
      label: "Toggle Inspector",
      description: "Enable or disable element inspector",
      icon: /* @__PURE__ */ jsx10(MousePointer24, { className: "w-4 h-4" }),
      shortcut: "I",
      action: () => {
        dispatch({ type: "TOGGLE_INSPECTOR" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Tools"
    },
    {
      id: "toggle-file-map",
      label: "Toggle File Map",
      description: "Show or hide file-to-element mappings",
      icon: /* @__PURE__ */ jsx10(FileCode3, { className: "w-4 h-4" }),
      shortcut: "F",
      action: () => {
        dispatch({ type: "TOGGLE_FILE_MAP_PANEL" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Panels"
    },
    {
      id: "toggle-annotations",
      label: "Toggle Annotation Mode",
      description: "Draw annotations on the preview",
      icon: /* @__PURE__ */ jsx10(PenTool2, { className: "w-4 h-4" }),
      shortcut: "D",
      action: () => {
        dispatch({ type: "TOGGLE_ANNOTATION_MODE" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Tools"
    },
    {
      id: "clear-annotations",
      label: "Clear All Annotations",
      description: "Remove all drawn annotations",
      icon: /* @__PURE__ */ jsx10(PenTool2, { className: "w-4 h-4" }),
      action: () => {
        dispatch({ type: "CLEAR_ANNOTATIONS" });
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Actions"
    },
    {
      id: "send-to-ide",
      label: "Send to IDE",
      description: "Send current changes to connected IDE",
      icon: /* @__PURE__ */ jsx10(Send3, { className: "w-4 h-4" }),
      action: () => {
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Actions"
    },
    {
      id: "save-version",
      label: "Save Version",
      description: "Save current state as a new version",
      icon: /* @__PURE__ */ jsx10(GitBranch2, { className: "w-4 h-4" }),
      shortcut: "V",
      action: () => {
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Actions"
    },
    {
      id: "copy-css",
      label: "Copy All CSS Changes",
      description: "Copy all pending CSS changes to clipboard",
      icon: /* @__PURE__ */ jsx10(Copy5, { className: "w-4 h-4" }),
      action: () => {
        dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
      },
      category: "Actions"
    }
  ];
  const filtered = commands.filter(
    (cmd) => cmd.label.toLowerCase().includes(search.toLowerCase()) || cmd.description.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = filtered.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd);
      return acc;
    },
    {}
  );
  return /* @__PURE__ */ jsx10(
    "div",
    {
      className: "fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm",
      onClick: () => dispatch({ type: "TOGGLE_COMMAND_PALETTE" }),
      children: /* @__PURE__ */ jsxs9(
        "div",
        {
          className: "w-[520px] bg-[#0a0a0a] border border-[#222222] rounded-xl shadow-2xl overflow-hidden",
          onClick: (e) => e.stopPropagation(),
          children: [
            /* @__PURE__ */ jsxs9("div", { className: "flex items-center px-4 py-3 border-b border-[#1a1a1a]", children: [
              /* @__PURE__ */ jsx10(Search, { className: "w-4 h-4 text-muted-foreground mr-3 shrink-0" }),
              /* @__PURE__ */ jsx10(
                "input",
                {
                  ref: inputRef,
                  type: "text",
                  placeholder: "Type a command...",
                  value: search,
                  onChange: (e) => setSearch(e.target.value),
                  className: "flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none",
                  style: { fontSize: "14px" }
                }
              ),
              /* @__PURE__ */ jsx10("kbd", { className: "text-[10px] text-muted-foreground bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#222222]", children: "ESC" })
            ] }),
            /* @__PURE__ */ jsx10("div", { className: "max-h-[300px] overflow-y-auto py-2", children: Object.entries(grouped).map(([category, cmds]) => /* @__PURE__ */ jsxs9("div", { children: [
              /* @__PURE__ */ jsx10("div", { className: "px-4 py-1.5", children: /* @__PURE__ */ jsx10("span", { className: "text-[10px] tracking-wider text-muted-foreground uppercase", children: category }) }),
              cmds.map((cmd) => /* @__PURE__ */ jsxs9(
                "button",
                {
                  className: "w-full flex items-center gap-3 px-4 py-2 hover:bg-[#1a1a1a] transition-colors",
                  onClick: cmd.action,
                  children: [
                    /* @__PURE__ */ jsx10("span", { className: "text-muted-foreground", children: cmd.icon }),
                    /* @__PURE__ */ jsxs9("div", { className: "flex-1 text-left", children: [
                      /* @__PURE__ */ jsx10("span", { className: "text-[13px] text-foreground block", children: cmd.label }),
                      /* @__PURE__ */ jsx10("span", { className: "text-[11px] text-muted-foreground", children: cmd.description })
                    ] }),
                    cmd.shortcut && /* @__PURE__ */ jsx10("kbd", { className: "text-[10px] text-muted-foreground bg-[#111111] px-1.5 py-0.5 rounded border border-[#1a1a1a]", children: cmd.shortcut })
                  ]
                },
                cmd.id
              ))
            ] }, category)) })
          ]
        }
      )
    }
  );
}

// src/app/components/file-map-panel.tsx
import { useState as useState8, useMemo } from "react";
import {
  FileCode as FileCode4,
  FolderOpen,
  ChevronRight as ChevronRight3,
  ChevronDown as ChevronDown3,
  Search as Search2,
  ExternalLink,
  MapPin,
  AlertCircle,
  Sparkles as Sparkles2,
  ArrowRight as ArrowRight3,
  Eye as Eye3
} from "lucide-react";
import { jsx as jsx11, jsxs as jsxs10 } from "react/jsx-runtime";
function inferFileMappings(elements, framework) {
  const mappings = [];
  function walk(el) {
    const mapping = inferSingleMapping(el, framework);
    if (mapping) mappings.push(mapping);
    if (el.children) el.children.forEach(walk);
  }
  elements.forEach(walk);
  return mappings;
}
function inferSingleMapping(el, framework) {
  const classes = el.classes || [];
  const tag = el.tag || "";
  const selector = el.selector || "";
  const componentPatterns = [
    [/navbar|nav-bar|navigation/i, "Navbar", "components/Navbar"],
    [/header/i, "Header", "components/Header"],
    [/footer/i, "Footer", "components/Footer"],
    [/sidebar/i, "Sidebar", "components/Sidebar"],
    [/hero/i, "Hero", "components/Hero"],
    [/card/i, "Card", "components/Card"],
    [/button|btn/i, "Button", "components/ui/Button"],
    [/modal|dialog/i, "Modal", "components/Modal"],
    [/form/i, "Form", "components/Form"],
    [/input/i, "Input", "components/ui/Input"],
    [/avatar/i, "Avatar", "components/Avatar"],
    [/badge/i, "Badge", "components/ui/Badge"],
    [/dropdown/i, "Dropdown", "components/Dropdown"],
    [/tooltip/i, "Tooltip", "components/ui/Tooltip"],
    [/table/i, "Table", "components/Table"],
    [/tab/i, "Tabs", "components/Tabs"],
    [/accordion/i, "Accordion", "components/Accordion"],
    [/carousel|slider/i, "Carousel", "components/Carousel"],
    [/search/i, "Search", "components/Search"],
    [/pricing/i, "Pricing", "components/Pricing"],
    [/features?/i, "Features", "components/Features"],
    [/testimonial/i, "Testimonials", "components/Testimonials"],
    [/cta|call.?to.?action/i, "CTA", "components/CTA"],
    [/banner/i, "Banner", "components/Banner"]
  ];
  const allText = [...classes, selector, tag].join(" ");
  for (const [pattern, name, path] of componentPatterns) {
    if (pattern.test(allText)) {
      const ext = framework.toLowerCase().includes("next") ? ".tsx" : framework.toLowerCase().includes("vue") ? ".vue" : framework.toLowerCase().includes("svelte") ? ".svelte" : ".tsx";
      return {
        elementId: el.id,
        filePath: `src/${path}${ext}`,
        componentName: name,
        confidence: classes.some((c) => pattern.test(c)) ? "high" : "medium"
      };
    }
  }
  const semanticMap = {
    nav: ["Navigation", "components/Navigation"],
    header: ["Header", "layouts/Header"],
    footer: ["Footer", "layouts/Footer"],
    main: ["Main", "layouts/Main"],
    aside: ["Sidebar", "components/Sidebar"],
    article: ["Article", "components/Article"],
    section: ["Section", "components/Section"],
    form: ["Form", "components/Form"]
  };
  if (semanticMap[tag]) {
    const [name, path] = semanticMap[tag];
    return {
      elementId: el.id,
      filePath: `src/${path}.tsx`,
      componentName: name,
      confidence: "medium"
    };
  }
  return null;
}
function buildFileTree(mappings) {
  const root = {
    name: "src",
    path: "src",
    isDir: true,
    children: [],
    mappings: []
  };
  for (const m of mappings) {
    const parts = m.filePath.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        let existing = current.children.find(
          (c) => !c.isDir && c.name === part
        );
        if (!existing) {
          existing = {
            name: part,
            path: m.filePath,
            isDir: false,
            children: [],
            mappings: []
          };
          current.children.push(existing);
        }
        existing.mappings.push(m);
      } else {
        let dir = current.children.find((c) => c.isDir && c.name === part);
        if (!dir) {
          dir = {
            name: part,
            path: parts.slice(0, i + 1).join("/"),
            isDir: true,
            children: [],
            mappings: []
          };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }
  function sortTree(node) {
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortTree);
  }
  sortTree(root);
  return root;
}
function FileTreeItem({
  node,
  depth = 0,
  onSelectElement
}) {
  const [expanded, setExpanded] = useState8(depth < 2);
  const confidenceColor = {
    high: "#50e3c2",
    medium: "#f5a623",
    low: "#666666"
  };
  if (!node.isDir) {
    return /* @__PURE__ */ jsxs10("div", { children: [
      /* @__PURE__ */ jsxs10(
        "div",
        {
          className: "flex items-center gap-1.5 py-1 px-2 hover:bg-[#111111] rounded transition-colors group",
          style: { paddingLeft: `${depth * 16 + 8}px` },
          children: [
            /* @__PURE__ */ jsx11(FileCode4, { className: "w-3.5 h-3.5 text-[#0070f3] shrink-0" }),
            /* @__PURE__ */ jsx11("span", { className: "text-[11px] text-foreground truncate flex-1", children: node.name }),
            /* @__PURE__ */ jsx11("span", { className: "text-[9px] text-muted-foreground bg-[#1a1a1a] px-1 py-0.5 rounded", children: node.mappings.length })
          ]
        }
      ),
      node.mappings.map((m) => /* @__PURE__ */ jsxs10(
        "button",
        {
          onClick: () => onSelectElement(m.elementId),
          className: "w-full flex items-center gap-1.5 py-1 px-2 hover:bg-[#0070f3]/5 rounded transition-colors text-left group",
          style: { paddingLeft: `${(depth + 1) * 16 + 8}px` },
          children: [
            /* @__PURE__ */ jsx11(
              MapPin,
              {
                className: "w-3 h-3 shrink-0",
                style: { color: confidenceColor[m.confidence] }
              }
            ),
            /* @__PURE__ */ jsx11("span", { className: "text-[10px] text-muted-foreground truncate flex-1", children: m.componentName }),
            /* @__PURE__ */ jsx11(
              "span",
              {
                className: "w-1.5 h-1.5 rounded-full shrink-0",
                style: { background: confidenceColor[m.confidence] }
              }
            ),
            m.lineNumber && /* @__PURE__ */ jsxs10(
              "span",
              {
                className: "text-[9px] text-muted-foreground",
                style: { fontFamily: "'Geist Mono', monospace" },
                children: [
                  "L",
                  m.lineNumber
                ]
              }
            ),
            /* @__PURE__ */ jsx11(Eye3, { className: "w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" })
          ]
        },
        m.elementId
      ))
    ] });
  }
  return /* @__PURE__ */ jsxs10("div", { children: [
    /* @__PURE__ */ jsxs10(
      "button",
      {
        className: "w-full flex items-center gap-1.5 py-1 px-2 hover:bg-[#111111] rounded transition-colors",
        style: { paddingLeft: `${depth * 16 + 8}px` },
        onClick: () => setExpanded(!expanded),
        children: [
          expanded ? /* @__PURE__ */ jsx11(ChevronDown3, { className: "w-3 h-3 text-muted-foreground shrink-0" }) : /* @__PURE__ */ jsx11(ChevronRight3, { className: "w-3 h-3 text-muted-foreground shrink-0" }),
          /* @__PURE__ */ jsx11(FolderOpen, { className: "w-3.5 h-3.5 text-[#f5a623] shrink-0" }),
          /* @__PURE__ */ jsx11("span", { className: "text-[11px] text-foreground truncate", children: node.name })
        ]
      }
    ),
    expanded && node.children.map((child) => /* @__PURE__ */ jsx11(
      FileTreeItem,
      {
        node: child,
        depth: depth + 1,
        onSelectElement
      },
      child.path
    ))
  ] });
}
function FileMapPanel() {
  const { state, dispatch } = useWorkspace();
  const [search, setSearch] = useState8("");
  const [tab, setTab] = useState8("tree");
  const allMappings = useMemo(() => {
    if (state.fileMappings.length > 0) return state.fileMappings;
    return inferFileMappings(
      state.elements,
      state.project?.framework || "react"
    );
  }, [state.fileMappings, state.elements, state.project?.framework]);
  const filteredMappings = useMemo(() => {
    if (!search) return allMappings;
    const lower = search.toLowerCase();
    return allMappings.filter(
      (m) => m.filePath.toLowerCase().includes(lower) || m.componentName.toLowerCase().includes(lower)
    );
  }, [allMappings, search]);
  const fileTree = useMemo(
    () => buildFileTree(filteredMappings),
    [filteredMappings]
  );
  const selectedMapping = state.selectedElementId ? allMappings.find((m) => m.elementId === state.selectedElementId) : null;
  const selectedElement = state.selectedElementId ? findElement(state.elements, state.selectedElementId) : null;
  const handleSelectElement = (id) => {
    dispatch({ type: "SELECT_ELEMENT", id });
  };
  const serverMappingCount = state.fileMappings.length;
  const isInferred = serverMappingCount === 0 && allMappings.length > 0;
  return /* @__PURE__ */ jsxs10("div", { className: "h-full flex flex-col bg-[#0a0a0a]", children: [
    /* @__PURE__ */ jsxs10("div", { className: "px-4 py-3 border-b border-border flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs10("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx11(FileCode4, { className: "w-4 h-4 text-[#0070f3]" }),
        /* @__PURE__ */ jsx11("span", { className: "text-[13px] text-foreground", children: "File Map" }),
        isInferred && /* @__PURE__ */ jsxs10("span", { className: "flex items-center gap-1 text-[9px] text-[#f5a623] bg-[#f5a623]/10 px-1.5 py-0.5 rounded", children: [
          /* @__PURE__ */ jsx11(Sparkles2, { className: "w-2.5 h-2.5" }),
          "Inferred"
        ] })
      ] }),
      /* @__PURE__ */ jsxs10("span", { className: "text-[10px] text-muted-foreground", children: [
        allMappings.length,
        " mappings"
      ] })
    ] }),
    /* @__PURE__ */ jsx11("div", { className: "flex border-b border-border", children: ["tree", "element"].map((t) => /* @__PURE__ */ jsx11(
      "button",
      {
        className: `flex-1 py-2 text-[11px] transition-colors ${tab === t ? "text-foreground border-b border-foreground" : "text-muted-foreground hover:text-foreground"}`,
        onClick: () => setTab(t),
        children: t === "tree" ? "File Tree" : "Selected"
      },
      t
    )) }),
    tab === "tree" && /* @__PURE__ */ jsx11("div", { className: "px-3 py-2 border-b border-[#1a1a1a]", children: /* @__PURE__ */ jsxs10("div", { className: "flex items-center gap-2 bg-[#111111] border border-[#1a1a1a] rounded-lg px-2.5 h-[28px]", children: [
      /* @__PURE__ */ jsx11(Search2, { className: "w-3 h-3 text-muted-foreground shrink-0" }),
      /* @__PURE__ */ jsx11(
        "input",
        {
          type: "text",
          placeholder: "Search files or components...",
          value: search,
          onChange: (e) => setSearch(e.target.value),
          className: "flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs10(ScrollArea, { className: "flex-1 min-h-0", children: [
      tab === "tree" && /* @__PURE__ */ jsx11("div", { className: "py-1", children: allMappings.length === 0 ? /* @__PURE__ */ jsxs10("div", { className: "flex flex-col items-center justify-center py-12 px-4 text-center", children: [
        /* @__PURE__ */ jsx11(FileCode4, { className: "w-8 h-8 text-[#1a1a1a] mb-3" }),
        /* @__PURE__ */ jsx11("p", { className: "text-[12px] text-muted-foreground mb-1", children: "No file mappings" }),
        /* @__PURE__ */ jsx11("p", { className: "text-[10px] text-muted-foreground", children: "Load a page to auto-detect component-to-file mappings, or connect an IDE for precise resolution" })
      ] }) : fileTree.children.map((child) => /* @__PURE__ */ jsx11(
        FileTreeItem,
        {
          node: child,
          onSelectElement: handleSelectElement
        },
        child.path
      )) }),
      tab === "element" && /* @__PURE__ */ jsx11("div", { className: "p-3", children: !selectedElement ? /* @__PURE__ */ jsxs10("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [
        /* @__PURE__ */ jsx11(MapPin, { className: "w-8 h-8 text-[#1a1a1a] mb-3" }),
        /* @__PURE__ */ jsx11("p", { className: "text-[12px] text-muted-foreground mb-1", children: "No element selected" }),
        /* @__PURE__ */ jsx11("p", { className: "text-[10px] text-muted-foreground", children: "Select an element to see its file mapping" })
      ] }) : /* @__PURE__ */ jsxs10("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsxs10("div", { className: "p-3 bg-[#111111] rounded-xl border border-[#1a1a1a]", children: [
          /* @__PURE__ */ jsxs10("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ jsxs10("span", { className: "text-[12px] text-[#0070f3]", children: [
              "<",
              selectedElement.tag,
              ">"
            ] }),
            selectedElement.classes.length > 0 && /* @__PURE__ */ jsxs10(
              "span",
              {
                className: "text-[10px] text-muted-foreground truncate",
                style: { fontFamily: "'Geist Mono', monospace" },
                children: [
                  ".",
                  selectedElement.classes[0]
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx11(
            "p",
            {
              className: "text-[10px] text-muted-foreground",
              style: { fontFamily: "'Geist Mono', monospace" },
              children: selectedElement.selector
            }
          )
        ] }),
        selectedMapping ? /* @__PURE__ */ jsxs10("div", { className: "p-3 border border-[#0070f3]/20 bg-[#0070f3]/5 rounded-xl", children: [
          /* @__PURE__ */ jsxs10("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ jsx11(FileCode4, { className: "w-4 h-4 text-[#0070f3]" }),
            /* @__PURE__ */ jsx11("span", { className: "text-[12px] text-foreground", children: selectedMapping.componentName }),
            /* @__PURE__ */ jsx11(
              "span",
              {
                className: "w-1.5 h-1.5 rounded-full",
                style: {
                  background: selectedMapping.confidence === "high" ? "#50e3c2" : selectedMapping.confidence === "medium" ? "#f5a623" : "#666666"
                }
              }
            )
          ] }),
          /* @__PURE__ */ jsxs10(
            "p",
            {
              className: "text-[11px] text-muted-foreground mb-1",
              style: { fontFamily: "'Geist Mono', monospace" },
              children: [
                selectedMapping.filePath,
                selectedMapping.lineNumber ? `:${selectedMapping.lineNumber}` : ""
              ]
            }
          ),
          /* @__PURE__ */ jsxs10("div", { className: "flex items-center gap-1.5 mt-2", children: [
            /* @__PURE__ */ jsxs10(
              "span",
              {
                className: "text-[9px] px-1.5 py-0.5 rounded",
                style: {
                  background: selectedMapping.confidence === "high" ? "rgba(80,227,194,0.1)" : "rgba(245,166,35,0.1)",
                  color: selectedMapping.confidence === "high" ? "#50e3c2" : "#f5a623"
                },
                children: [
                  selectedMapping.confidence,
                  " confidence"
                ]
              }
            ),
            isInferred && /* @__PURE__ */ jsx11("span", { className: "text-[9px] text-muted-foreground", children: "(heuristic)" })
          ] }),
          /* @__PURE__ */ jsxs10("button", { className: "w-full mt-3 flex items-center justify-center gap-1.5 py-1.5 border border-[#0070f3]/30 rounded-lg text-[10px] text-[#0070f3] hover:bg-[#0070f3]/10 transition-colors", children: [
            /* @__PURE__ */ jsx11(ExternalLink, { className: "w-3 h-3" }),
            "Open in IDE"
          ] })
        ] }) : /* @__PURE__ */ jsxs10("div", { className: "p-3 border border-[#1a1a1a] rounded-xl", children: [
          /* @__PURE__ */ jsxs10("div", { className: "flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ jsx11(AlertCircle, { className: "w-4 h-4 text-muted-foreground" }),
            /* @__PURE__ */ jsx11("span", { className: "text-[12px] text-muted-foreground", children: "No mapping found" })
          ] }),
          /* @__PURE__ */ jsx11("p", { className: "text-[10px] text-muted-foreground", children: "This element doesn't match any known component pattern. Connect an IDE for exact file resolution via source maps." })
        ] }),
        selectedElement.children.length > 0 && /* @__PURE__ */ jsxs10("div", { children: [
          /* @__PURE__ */ jsx11("span", { className: "text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5", children: "Child Components" }),
          allMappings.filter(
            (m) => selectedElement.children.some(
              (c) => c.id === m.elementId
            )
          ).slice(0, 8).map((m) => /* @__PURE__ */ jsxs10(
            "button",
            {
              onClick: () => handleSelectElement(m.elementId),
              className: "w-full flex items-center gap-2 py-1.5 px-2 hover:bg-[#111111] rounded transition-colors text-left",
              children: [
                /* @__PURE__ */ jsx11(ArrowRight3, { className: "w-3 h-3 text-muted-foreground" }),
                /* @__PURE__ */ jsx11("span", { className: "text-[10px] text-foreground", children: m.componentName }),
                /* @__PURE__ */ jsx11(
                  "span",
                  {
                    className: "text-[9px] text-muted-foreground flex-1 truncate",
                    style: { fontFamily: "'Geist Mono', monospace" },
                    children: m.filePath
                  }
                )
              ]
            },
            m.elementId
          ))
        ] })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs10("div", { className: "px-3 py-2 border-t border-[#1a1a1a] flex items-center gap-3", children: [
      /* @__PURE__ */ jsx11("span", { className: "text-[9px] text-muted-foreground", children: "Confidence:" }),
      [
        ["#50e3c2", "High"],
        ["#f5a623", "Med"],
        ["#666666", "Low"]
      ].map(([color, label]) => /* @__PURE__ */ jsxs10("span", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ jsx11(
          "span",
          {
            className: "w-1.5 h-1.5 rounded-full",
            style: { background: color }
          }
        ),
        /* @__PURE__ */ jsx11("span", { className: "text-[9px] text-muted-foreground", children: label })
      ] }, label))
    ] })
  ] });
}

// src/app/components/annotation-overlay.tsx
import { useState as useState9, useRef as useRef3, useCallback as useCallback2, useEffect as useEffect3 } from "react";
import {
  MousePointer2 as MousePointer25,
  Square as Square2,
  ArrowUpRight as ArrowUpRight2,
  Type as Type3,
  Pencil,
  Circle as Circle2,
  Trash2 as Trash22,
  Copy as Copy6,
  Check as Check4,
  X as X2,
  Undo2
} from "lucide-react";
import { Fragment as Fragment3, jsx as jsx12, jsxs as jsxs11 } from "react/jsx-runtime";
var ANNOTATION_COLORS = [
  "#ff0000",
  "#ff6b35",
  "#f5a623",
  "#50e3c2",
  "#0070f3",
  "#7928ca",
  "#ff0080",
  "#ffffff"
];
var TOOLS = [
  {
    id: "select",
    icon: /* @__PURE__ */ jsx12(MousePointer25, { className: "w-3.5 h-3.5" }),
    label: "Select"
  },
  { id: "rect", icon: /* @__PURE__ */ jsx12(Square2, { className: "w-3.5 h-3.5" }), label: "Rectangle" },
  {
    id: "circle",
    icon: /* @__PURE__ */ jsx12(Circle2, { className: "w-3.5 h-3.5" }),
    label: "Circle"
  },
  {
    id: "arrow",
    icon: /* @__PURE__ */ jsx12(ArrowUpRight2, { className: "w-3.5 h-3.5" }),
    label: "Arrow"
  },
  { id: "text", icon: /* @__PURE__ */ jsx12(Type3, { className: "w-3.5 h-3.5" }), label: "Text" },
  {
    id: "freehand",
    icon: /* @__PURE__ */ jsx12(Pencil, { className: "w-3.5 h-3.5" }),
    label: "Freehand"
  }
];
function AnnotationShape({
  ann,
  isSelected,
  onSelect
}) {
  const strokeWidth = isSelected ? 2.5 : 2;
  switch (ann.tool) {
    case "rect":
      return /* @__PURE__ */ jsxs11("g", { onClick: onSelect, style: { cursor: "pointer" }, children: [
        /* @__PURE__ */ jsx12(
          "rect",
          {
            x: Math.min(ann.x, ann.x + (ann.width || 0)),
            y: Math.min(ann.y, ann.y + (ann.height || 0)),
            width: Math.abs(ann.width || 0),
            height: Math.abs(ann.height || 0),
            fill: `${ann.color}10`,
            stroke: ann.color,
            strokeWidth,
            strokeDasharray: isSelected ? "6 3" : "none",
            rx: 3
          }
        ),
        isSelected && /* @__PURE__ */ jsxs11(Fragment3, { children: [
          /* @__PURE__ */ jsx12("circle", { cx: ann.x, cy: ann.y, r: 4, fill: ann.color }),
          /* @__PURE__ */ jsx12(
            "circle",
            {
              cx: ann.x + (ann.width || 0),
              cy: ann.y + (ann.height || 0),
              r: 4,
              fill: ann.color
            }
          )
        ] })
      ] });
    case "circle":
      const cx = ann.x + (ann.width || 0) / 2;
      const cy = ann.y + (ann.height || 0) / 2;
      const rx = Math.abs((ann.width || 0) / 2);
      const ry = Math.abs((ann.height || 0) / 2);
      return /* @__PURE__ */ jsx12("g", { onClick: onSelect, style: { cursor: "pointer" }, children: /* @__PURE__ */ jsx12(
        "ellipse",
        {
          cx,
          cy,
          rx,
          ry,
          fill: `${ann.color}10`,
          stroke: ann.color,
          strokeWidth,
          strokeDasharray: isSelected ? "6 3" : "none"
        }
      ) });
    case "arrow": {
      const endX = ann.endX ?? ann.x;
      const endY = ann.endY ?? ann.y;
      const angle = Math.atan2(endY - ann.y, endX - ann.x);
      const headLen = 12;
      const x1 = endX - headLen * Math.cos(angle - Math.PI / 6);
      const y1 = endY - headLen * Math.sin(angle - Math.PI / 6);
      const x2 = endX - headLen * Math.cos(angle + Math.PI / 6);
      const y2 = endY - headLen * Math.sin(angle + Math.PI / 6);
      return /* @__PURE__ */ jsxs11("g", { onClick: onSelect, style: { cursor: "pointer" }, children: [
        /* @__PURE__ */ jsx12(
          "line",
          {
            x1: ann.x,
            y1: ann.y,
            x2: endX,
            y2: endY,
            stroke: ann.color,
            strokeWidth,
            strokeLinecap: "round"
          }
        ),
        /* @__PURE__ */ jsx12(
          "polygon",
          {
            points: `${endX},${endY} ${x1},${y1} ${x2},${y2}`,
            fill: ann.color
          }
        ),
        isSelected && /* @__PURE__ */ jsxs11(Fragment3, { children: [
          /* @__PURE__ */ jsx12("circle", { cx: ann.x, cy: ann.y, r: 4, fill: ann.color }),
          /* @__PURE__ */ jsx12("circle", { cx: endX, cy: endY, r: 4, fill: ann.color })
        ] })
      ] });
    }
    case "text":
      return /* @__PURE__ */ jsxs11("g", { onClick: onSelect, style: { cursor: "pointer" }, children: [
        isSelected && /* @__PURE__ */ jsx12(
          "rect",
          {
            x: ann.x - 4,
            y: ann.y - 18,
            width: (ann.text?.length || 1) * 8 + 8,
            height: 24,
            fill: "transparent",
            stroke: ann.color,
            strokeWidth: 1,
            strokeDasharray: "4 2",
            rx: 3
          }
        ),
        /* @__PURE__ */ jsx12(
          "text",
          {
            x: ann.x,
            y: ann.y,
            fill: ann.color,
            style: {
              fontSize: "14px",
              fontFamily: "'Geist Sans', sans-serif",
              fontWeight: 500,
              userSelect: "none"
            },
            children: ann.text || "Text"
          }
        )
      ] });
    case "freehand": {
      if (!ann.points || ann.points.length < 2) return null;
      const d = ann.points.map((p, i) => i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`).join(" ");
      return /* @__PURE__ */ jsx12("g", { onClick: onSelect, style: { cursor: "pointer" }, children: /* @__PURE__ */ jsx12(
        "path",
        {
          d,
          fill: "none",
          stroke: ann.color,
          strokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ) });
    }
    default:
      return null;
  }
}
function AnnotationOverlay() {
  const { state, dispatch } = useWorkspace();
  const svgRef = useRef3(null);
  const [drawing, setDrawing] = useState9(false);
  const [currentAnnotation, setCurrentAnnotation] = useState9(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState9(null);
  const [textInput, setTextInput] = useState9("");
  const [textPosition, setTextPosition] = useState9(null);
  const [copied, setCopied] = useState9(false);
  const tool = state.annotationTool;
  const color = state.annotationColor;
  const getCursor = () => {
    switch (tool) {
      case "select":
        return "default";
      case "text":
        return "text";
      case "freehand":
        return "crosshair";
      default:
        return "crosshair";
    }
  };
  const getRelativePos = useCallback2(
    (e) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    []
  );
  const handleMouseDown = useCallback2(
    (e) => {
      if (tool === "select") {
        setSelectedAnnotationId(null);
        return;
      }
      const pos = getRelativePos(e);
      if (tool === "text") {
        setTextPosition(pos);
        setTextInput("");
        return;
      }
      setDrawing(true);
      setSelectedAnnotationId(null);
      if (tool === "freehand") {
        setCurrentAnnotation({
          tool,
          x: pos.x,
          y: pos.y,
          points: [pos],
          color
        });
      } else if (tool === "arrow") {
        setCurrentAnnotation({
          tool,
          x: pos.x,
          y: pos.y,
          endX: pos.x,
          endY: pos.y,
          color
        });
      } else {
        setCurrentAnnotation({
          tool,
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          color
        });
      }
    },
    [tool, color, getRelativePos]
  );
  const handleMouseMove = useCallback2(
    (e) => {
      if (!drawing || !currentAnnotation) return;
      const pos = getRelativePos(e);
      if (tool === "freehand") {
        setCurrentAnnotation((prev) => ({
          ...prev,
          points: [...prev?.points || [], pos]
        }));
      } else if (tool === "arrow") {
        setCurrentAnnotation((prev) => ({
          ...prev,
          endX: pos.x,
          endY: pos.y
        }));
      } else {
        setCurrentAnnotation((prev) => ({
          ...prev,
          width: pos.x - (prev?.x || 0),
          height: pos.y - (prev?.y || 0)
        }));
      }
    },
    [drawing, currentAnnotation, tool, getRelativePos]
  );
  const handleMouseUp = useCallback2(() => {
    if (!drawing || !currentAnnotation) return;
    setDrawing(false);
    const isValid = tool === "freehand" ? (currentAnnotation.points?.length || 0) > 3 : tool === "arrow" ? Math.hypot(
      (currentAnnotation.endX || 0) - (currentAnnotation.x || 0),
      (currentAnnotation.endY || 0) - (currentAnnotation.y || 0)
    ) > 10 : Math.abs(currentAnnotation.width || 0) > 5 || Math.abs(currentAnnotation.height || 0) > 5;
    if (isValid) {
      const annotation = {
        id: `ann-${Date.now()}`,
        tool: currentAnnotation.tool || tool,
        x: currentAnnotation.x || 0,
        y: currentAnnotation.y || 0,
        width: currentAnnotation.width,
        height: currentAnnotation.height,
        points: currentAnnotation.points,
        endX: currentAnnotation.endX,
        endY: currentAnnotation.endY,
        color: currentAnnotation.color || color,
        timestamp: Date.now()
      };
      dispatch({ type: "ADD_ANNOTATION", annotation });
    }
    setCurrentAnnotation(null);
  }, [drawing, currentAnnotation, tool, color, dispatch]);
  const handleTextSubmit = () => {
    if (!textPosition || !textInput.trim()) {
      setTextPosition(null);
      return;
    }
    const annotation = {
      id: `ann-${Date.now()}`,
      tool: "text",
      x: textPosition.x,
      y: textPosition.y,
      text: textInput,
      color,
      timestamp: Date.now()
    };
    dispatch({ type: "ADD_ANNOTATION", annotation });
    setTextPosition(null);
    setTextInput("");
  };
  const deleteSelected = () => {
    if (selectedAnnotationId) {
      dispatch({ type: "DELETE_ANNOTATION", id: selectedAnnotationId });
      setSelectedAnnotationId(null);
    }
  };
  const exportAnnotations = () => {
    const data = JSON.stringify(state.annotations, null, 2);
    copyToClipboard(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  };
  useEffect3(() => {
    if (!state.annotationMode) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        setTextPosition(null);
        setSelectedAnnotationId(null);
        if (drawing) {
          setDrawing(false);
          setCurrentAnnotation(null);
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedAnnotationId && !textPosition) {
          deleteSelected();
        }
      }
      if (!textPosition) {
        if (e.key === "v") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "select" });
        if (e.key === "r") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "rect" });
        if (e.key === "o") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "circle" });
        if (e.key === "a") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "arrow" });
        if (e.key === "t") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "text" });
        if (e.key === "p") dispatch({ type: "SET_ANNOTATION_TOOL", tool: "freehand" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.annotationMode, drawing, selectedAnnotationId, textPosition, dispatch]);
  if (!state.annotationMode) return null;
  return /* @__PURE__ */ jsxs11("div", { className: "absolute inset-0 z-20 pointer-events-none", children: [
    /* @__PURE__ */ jsx12("div", { className: "absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto", children: /* @__PURE__ */ jsxs11("div", { className: "flex items-center gap-1 bg-[#0a0a0a]/95 backdrop-blur-sm border border-[#222222] rounded-xl px-2 py-1.5 shadow-2xl", children: [
      TOOLS.map((t) => /* @__PURE__ */ jsx12(
        "button",
        {
          onClick: () => dispatch({ type: "SET_ANNOTATION_TOOL", tool: t.id }),
          className: `p-1.5 rounded-lg transition-colors ${tool === t.id ? "bg-[#0070f3]/15 text-[#0070f3]" : "text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]"}`,
          title: `${t.label} (${t.id === "select" ? "V" : t.id[0].toUpperCase()})`,
          children: t.icon
        },
        t.id
      )),
      /* @__PURE__ */ jsx12("div", { className: "w-px h-5 bg-[#222222] mx-1" }),
      /* @__PURE__ */ jsx12("div", { className: "flex items-center gap-1", children: ANNOTATION_COLORS.map((c) => /* @__PURE__ */ jsx12(
        "button",
        {
          onClick: () => dispatch({ type: "SET_ANNOTATION_COLOR", color: c }),
          className: `w-4 h-4 rounded-full transition-transform ${color === c ? "scale-125 ring-1 ring-white/40" : ""}`,
          style: { background: c, border: c === "#ffffff" ? "1px solid #444" : "none" }
        },
        c
      )) }),
      /* @__PURE__ */ jsx12("div", { className: "w-px h-5 bg-[#222222] mx-1" }),
      /* @__PURE__ */ jsx12(
        "button",
        {
          onClick: () => {
            if (state.annotations.length > 0) {
              const last = state.annotations[state.annotations.length - 1];
              dispatch({ type: "DELETE_ANNOTATION", id: last.id });
            }
          },
          className: "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors",
          title: "Undo last",
          disabled: state.annotations.length === 0,
          children: /* @__PURE__ */ jsx12(Undo2, { className: "w-3.5 h-3.5" })
        }
      ),
      /* @__PURE__ */ jsx12(
        "button",
        {
          onClick: deleteSelected,
          className: "p-1.5 rounded-lg text-muted-foreground hover:text-[#ff4444] hover:bg-[#ff4444]/10 transition-colors disabled:opacity-30",
          title: "Delete selected",
          disabled: !selectedAnnotationId,
          children: /* @__PURE__ */ jsx12(Trash22, { className: "w-3.5 h-3.5" })
        }
      ),
      /* @__PURE__ */ jsx12(
        "button",
        {
          onClick: exportAnnotations,
          className: "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors",
          title: "Copy annotations",
          children: copied ? /* @__PURE__ */ jsx12(Check4, { className: "w-3.5 h-3.5 text-[#50e3c2]" }) : /* @__PURE__ */ jsx12(Copy6, { className: "w-3.5 h-3.5" })
        }
      ),
      /* @__PURE__ */ jsx12(
        "button",
        {
          onClick: () => dispatch({ type: "CLEAR_ANNOTATIONS" }),
          className: "p-1.5 rounded-lg text-muted-foreground hover:text-[#ff4444] hover:bg-[#ff4444]/10 transition-colors disabled:opacity-30",
          title: "Clear all",
          disabled: state.annotations.length === 0,
          children: /* @__PURE__ */ jsx12(X2, { className: "w-3.5 h-3.5" })
        }
      ),
      /* @__PURE__ */ jsx12("div", { className: "w-px h-5 bg-[#222222] mx-1" }),
      /* @__PURE__ */ jsx12("span", { className: "text-[10px] text-muted-foreground px-1.5", children: state.annotations.length }),
      /* @__PURE__ */ jsx12(
        "button",
        {
          onClick: () => dispatch({ type: "TOGGLE_ANNOTATION_MODE" }),
          className: "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors ml-0.5",
          title: "Exit annotation mode",
          children: /* @__PURE__ */ jsx12(X2, { className: "w-3.5 h-3.5" })
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs11(
      "svg",
      {
        ref: svgRef,
        className: "absolute inset-0 w-full h-full pointer-events-auto",
        style: { cursor: getCursor() },
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseUp,
        children: [
          state.annotations.map((ann) => /* @__PURE__ */ jsx12(
            AnnotationShape,
            {
              ann,
              isSelected: ann.id === selectedAnnotationId,
              onSelect: () => {
                if (tool === "select") {
                  setSelectedAnnotationId(ann.id);
                }
              }
            },
            ann.id
          )),
          currentAnnotation && drawing && /* @__PURE__ */ jsx12(
            AnnotationShape,
            {
              ann: {
                id: "drawing",
                ...currentAnnotation,
                timestamp: Date.now()
              },
              isSelected: false,
              onSelect: () => {
              }
            }
          )
        ]
      }
    ),
    textPosition && /* @__PURE__ */ jsx12(
      "div",
      {
        className: "absolute pointer-events-auto z-40",
        style: { left: textPosition.x, top: textPosition.y - 6 },
        children: /* @__PURE__ */ jsxs11("div", { className: "flex items-center gap-1 bg-[#0a0a0a] border border-[#333333] rounded-lg shadow-xl overflow-hidden", children: [
          /* @__PURE__ */ jsx12(
            "input",
            {
              type: "text",
              autoFocus: true,
              value: textInput,
              onChange: (e) => setTextInput(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") handleTextSubmit();
                if (e.key === "Escape") setTextPosition(null);
              },
              className: "w-48 px-2.5 py-1.5 bg-transparent text-[12px] text-foreground focus:outline-none",
              placeholder: "Type annotation...",
              style: { color }
            }
          ),
          /* @__PURE__ */ jsx12(
            "button",
            {
              onClick: handleTextSubmit,
              className: "px-2 py-1.5 text-[#0070f3] hover:bg-[#0070f3]/10 transition-colors",
              children: /* @__PURE__ */ jsx12(Check4, { className: "w-3.5 h-3.5" })
            }
          )
        ] })
      }
    )
  ] });
}

// src/app/components/designdead-engine.tsx
import { Fragment as Fragment4, jsx as jsx13, jsxs as jsxs12 } from "react/jsx-runtime";
var POSITION_STYLES = {
  "bottom-right": { bottom: 20, right: 20 },
  "bottom-left": { bottom: 20, left: 20 },
  "top-right": { top: 20, right: 20 },
  "top-left": { top: 20, left: 20 }
};
function AutoConnect({ children }) {
  const { state, dispatch } = useWorkspace();
  useEffect4(() => {
    if (!state.project) {
      dispatch({
        type: "CONNECT_PROJECT",
        project: {
          name: document.title || "Current Page",
          devServerUrl: window.location.origin,
          framework: "Engine Mode",
          status: "connected"
        }
      });
    }
  }, [state.project, dispatch]);
  if (!state.project) {
    return /* @__PURE__ */ jsx13(
      "div",
      {
        style: {
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          color: "#888888",
          fontSize: "13px",
          fontFamily: "'Geist Sans', 'Inter', sans-serif"
        },
        children: "Loading DesignDead..."
      }
    );
  }
  return /* @__PURE__ */ jsx13(Fragment4, { children });
}
function ToggleButton({
  position,
  zIndex,
  shortcut,
  onClick
}) {
  const [hovered, setHovered] = useState10(false);
  return /* @__PURE__ */ jsx13(
    "button",
    {
      onClick,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      title: `Open DesignDead (Ctrl+Shift+${shortcut.toUpperCase()})`,
      "data-designdead": "toggle",
      style: {
        position: "fixed",
        ...POSITION_STYLES[position],
        zIndex,
        width: 44,
        height: 44,
        borderRadius: 12,
        border: "1px solid #222222",
        background: hovered ? "#1a1a1a" : "#0a0a0a",
        color: "#ededed",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        transform: hovered ? "scale(1.05)" : "scale(1)",
        fontFamily: "'Geist Sans', 'Inter', sans-serif",
        fontSize: 0,
        padding: 0,
        outline: "none"
      },
      children: /* @__PURE__ */ jsxs12(
        "svg",
        {
          width: "20",
          height: "20",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2.5",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          children: [
            /* @__PURE__ */ jsx13("path", { d: "M12 2L2 7l10 5 10-5-10-5z" }),
            /* @__PURE__ */ jsx13("path", { d: "M2 17l10 5 10-5" }),
            /* @__PURE__ */ jsx13("path", { d: "M2 12l10 5 10-5" })
          ]
        }
      )
    }
  );
}
function DesignDead({
  position = "bottom-right",
  defaultOpen = false,
  theme = "dark",
  shortcut = "d",
  devOnly = true,
  zIndex = 2147483640,
  onToggle
}) {
  const [isOpen, setIsOpen] = useState10(defaultOpen);
  const _g = globalThis;
  const _proc = typeof _g["process"] === "object" ? _g["process"] : void 0;
  const _env = _proc && typeof _proc["env"] === "object" ? _proc["env"] : void 0;
  const isProduction = _env?.["NODE_ENV"] === "production";
  useEffect4(() => {
    injectStyles();
    return () => {
      removeStyles();
      cleanup();
    };
  }, []);
  const toggle = useCallback3(() => {
    setIsOpen((prev) => {
      const next = !prev;
      onToggle?.(next);
      return next;
    });
  }, [onToggle]);
  useEffect4(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === shortcut.toLowerCase()) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcut, toggle]);
  if (devOnly && isProduction) return null;
  if (!isOpen) {
    return /* @__PURE__ */ jsx13(
      ToggleButton,
      {
        position,
        zIndex,
        shortcut,
        onClick: toggle
      }
    );
  }
  return /* @__PURE__ */ jsx13(
    "div",
    {
      "data-designdead-root": "",
      "data-designdead": "root",
      style: {
        position: "fixed",
        inset: 0,
        zIndex,
        // Isolate our styles from the consumer's app
        isolation: "isolate"
      },
      children: /* @__PURE__ */ jsx13(WorkspaceProvider, { children: /* @__PURE__ */ jsxs12(AutoConnect, { children: [
        /* @__PURE__ */ jsx13(
          "button",
          {
            onClick: toggle,
            "data-designdead": "close",
            title: `Close DesignDead (Ctrl+Shift+${shortcut.toUpperCase()})`,
            style: {
              position: "absolute",
              top: 14,
              right: 14,
              zIndex: zIndex + 1,
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "1px solid #333333",
              background: "#111111",
              color: "#888888",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontFamily: "'Geist Sans', sans-serif",
              transition: "all 0.15s ease",
              padding: 0,
              outline: "none"
            },
            onMouseEnter: (e) => {
              e.target.style.color = "#ededed";
              e.target.style.borderColor = "#555555";
            },
            onMouseLeave: (e) => {
              e.target.style.color = "#888888";
              e.target.style.borderColor = "#333333";
            },
            children: /* @__PURE__ */ jsxs12(
              "svg",
              {
                width: "14",
                height: "14",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "2",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                children: [
                  /* @__PURE__ */ jsx13("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                  /* @__PURE__ */ jsx13("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
                ]
              }
            )
          }
        ),
        /* @__PURE__ */ jsx13(EngineWorkspace, {})
      ] }) })
    }
  );
}
function EngineWorkspace() {
  const { state, dispatch } = useWorkspace();
  useEffect4(() => {
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "k") {
          e.preventDefault();
          dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch]);
  const showVersions = !state.idePanelOpen && !state.brainstormMode && !state.fileMapPanelOpen;
  return /* @__PURE__ */ jsxs12(
    "div",
    {
      style: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#000000",
        overflow: "hidden"
      },
      "data-designdead": "workspace",
      children: [
        /* @__PURE__ */ jsx13(WorkspaceToolbar, {}),
        /* @__PURE__ */ jsxs12("div", { style: { flex: 1, display: "flex", overflow: "hidden" }, children: [
          state.layersPanelOpen && /* @__PURE__ */ jsx13("div", { style: { width: 260, flexShrink: 0, height: "100%", overflow: "hidden" }, children: /* @__PURE__ */ jsx13(LayersPanel, {}) }),
          /* @__PURE__ */ jsxs12("div", { style: { flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }, children: [
            /* @__PURE__ */ jsx13(LiveCanvas, {}),
            /* @__PURE__ */ jsx13(AnnotationOverlay, {})
          ] }),
          state.stylePanelOpen && /* @__PURE__ */ jsx13("div", { style: { width: 280, flexShrink: 0, height: "100%", overflow: "hidden" }, children: /* @__PURE__ */ jsx13(StylePanel, {}) }),
          state.fileMapPanelOpen && !state.stylePanelOpen && /* @__PURE__ */ jsx13("div", { style: { width: 280, flexShrink: 0, borderLeft: "1px solid #1a1a1a" }, children: /* @__PURE__ */ jsx13(FileMapPanel, {}) }),
          state.idePanelOpen && /* @__PURE__ */ jsx13("div", { style: { width: 300, flexShrink: 0, borderLeft: "1px solid #1a1a1a" }, children: /* @__PURE__ */ jsx13(AgentPanel, {}) }),
          state.brainstormMode && !state.idePanelOpen && /* @__PURE__ */ jsx13("div", { style: { width: 300, flexShrink: 0, borderLeft: "1px solid #1a1a1a" }, children: /* @__PURE__ */ jsx13(BrainstormPanel, {}) }),
          showVersions && !state.stylePanelOpen && /* @__PURE__ */ jsx13("div", { style: { width: 280, flexShrink: 0, borderLeft: "1px solid #1a1a1a", background: "#0a0a0a" }, children: /* @__PURE__ */ jsx13(VersionManager, {}) })
        ] }),
        state.commandPaletteOpen && /* @__PURE__ */ jsx13(CommandPalette, {})
      ]
    }
  );
}
export {
  DesignDead,
  applyStyle,
  buildElementTree,
  cleanup,
  DesignDead as default,
  generateAgentOutput,
  getElementById,
  highlightElement,
  injectStyles,
  isInspecting,
  rebuildElementMap,
  removeStyles,
  startInspect,
  stopInspect
};
//# sourceMappingURL=index.mjs.map