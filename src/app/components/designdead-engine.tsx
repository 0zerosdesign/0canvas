// ──────────────────────────────────────────────────────────
// DesignDead Engine — The npm package entry component
// ──────────────────────────────────────────────────────────
//
// This is the self-contained `<DesignDead />` component that
// users import into their own app. It renders as a floating
// overlay and inspects the current page DOM directly.
//
// Usage (after `npm install designdead`):
//
//   import { DesignDead } from 'designdead';
//
//   function App() {
//     return (
//       <>
//         <YourApp />
//         <DesignDead />
//       </>
//     );
//   }
//
// No server. No iframe. No proxy. No build pipeline.
// It runs entirely in the browser inside your app.
// ──────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Eye,
  EyeOff,
  Layers,
  Palette,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  X,
  Minus,
  Maximize2,
  Minimize2,
  Move,
  Sparkles,
  MousePointer2,
  GripVertical,
  Type,
  Box,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  ToggleLeft,
  Code2,
  Search,
  Settings,
  MessageSquare,
  Zap,
} from "lucide-react";
import {
  buildElementTree,
  rebuildElementMap,
  getElementById,
  highlightElement,
  applyStyle,
  startInspect,
  stopInspect,
  isInspecting,
  generateAgentOutput,
  cleanup,
} from "./dom-inspector";
import type { ElementNode } from "../store";

// ── Types ──────────────────────────────────────────────────

export interface DesignDeadProps {
  /** Initial position of the floating panel */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Start with the panel open */
  defaultOpen?: boolean;
  /** Dark or light theme */
  theme?: "dark" | "light" | "auto";
  /** Keyboard shortcut to toggle (default: Ctrl+Shift+D) */
  shortcut?: string;
  /** Only show in development mode */
  devOnly?: boolean;
  /** Custom z-index for the overlay */
  zIndex?: number;
}

// ── Styles (injected at runtime, no Tailwind dependency) ──

const STYLES = `
[data-designdead] * {
  box-sizing: border-box;
}

.dd-panel {
  position: fixed;
  z-index: var(--dd-z, 2147483640);
  font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 12px;
  line-height: 1.5;
  color: #ededed;
  -webkit-font-smoothing: antialiased;
}

.dd-panel-dark {
  --dd-bg: #0a0a0a;
  --dd-bg-elevated: #111111;
  --dd-bg-hover: #1a1a1a;
  --dd-border: #222222;
  --dd-text: #ededed;
  --dd-text-muted: #888888;
  --dd-text-dim: #555555;
  --dd-accent: #0070f3;
  --dd-accent-muted: rgba(0, 112, 243, 0.15);
  --dd-success: #50e3c2;
  --dd-warning: #f5a623;
}

.dd-panel-light {
  --dd-bg: #ffffff;
  --dd-bg-elevated: #fafafa;
  --dd-bg-hover: #f0f0f0;
  --dd-border: #e5e5e5;
  --dd-text: #171717;
  --dd-text-muted: #737373;
  --dd-text-dim: #a3a3a3;
  --dd-accent: #0070f3;
  --dd-accent-muted: rgba(0, 112, 243, 0.08);
  --dd-success: #10b981;
  --dd-warning: #f59e0b;
  color: #171717;
}

.dd-container {
  background: var(--dd-bg);
  border: 1px solid var(--dd-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  width: 320px;
  max-height: 70vh;
  resize: both;
  min-width: 280px;
  min-height: 200px;
}

.dd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--dd-border);
  background: var(--dd-bg-elevated);
  cursor: move;
  user-select: none;
  gap: 6px;
}

.dd-header-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--dd-text);
}

.dd-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.dd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: transparent;
  color: var(--dd-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.dd-btn:hover {
  background: var(--dd-bg-hover);
  color: var(--dd-text);
}

.dd-btn-active {
  background: var(--dd-accent-muted);
  color: var(--dd-accent);
}

.dd-btn-primary {
  background: var(--dd-accent);
  color: #fff;
  padding: 4px 10px;
  font-size: 11px;
  gap: 4px;
  border-radius: 6px;
}

.dd-btn-primary:hover {
  opacity: 0.9;
  background: var(--dd-accent);
  color: #fff;
}

.dd-tabs {
  display: flex;
  border-bottom: 1px solid var(--dd-border);
  background: var(--dd-bg);
  gap: 0;
}

.dd-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 0;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--dd-text-dim);
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.dd-tab:hover {
  color: var(--dd-text-muted);
}

.dd-tab-active {
  color: var(--dd-text);
  border-bottom-color: var(--dd-accent);
}

.dd-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.dd-content::-webkit-scrollbar {
  width: 4px;
}

.dd-content::-webkit-scrollbar-track {
  background: transparent;
}

.dd-content::-webkit-scrollbar-thumb {
  background: var(--dd-border);
  border-radius: 2px;
}

.dd-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  gap: 8px;
}

.dd-empty-icon {
  color: var(--dd-text-dim);
  opacity: 0.5;
}

.dd-empty-text {
  font-size: 12px;
  color: var(--dd-text-muted);
}

.dd-empty-hint {
  font-size: 10px;
  color: var(--dd-text-dim);
}

/* Layer tree */
.dd-layer {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  padding-left: var(--dd-indent, 8px);
  cursor: pointer;
  transition: background 0.1s;
  border-left: 2px solid transparent;
}

.dd-layer:hover {
  background: var(--dd-bg-hover);
}

.dd-layer-selected {
  background: var(--dd-accent-muted);
  border-left-color: var(--dd-accent);
}

.dd-layer-tag {
  font-size: 11px;
  color: var(--dd-accent);
  font-family: 'Geist Mono', 'JetBrains Mono', monospace;
}

.dd-layer-class {
  font-size: 10px;
  color: var(--dd-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.dd-layer-text {
  font-size: 10px;
  color: var(--dd-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
  font-style: italic;
}

/* Style properties */
.dd-style-group {
  padding: 8px;
  border-bottom: 1px solid var(--dd-border);
}

.dd-style-group-title {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--dd-text-dim);
  margin-bottom: 6px;
}

.dd-style-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
  gap: 8px;
}

.dd-style-prop {
  font-size: 10px;
  color: var(--dd-text-muted);
  font-family: 'Geist Mono', 'JetBrains Mono', monospace;
  white-space: nowrap;
}

.dd-style-val {
  font-size: 10px;
  color: var(--dd-text);
  font-family: 'Geist Mono', 'JetBrains Mono', monospace;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
  background: transparent;
  border: 1px solid transparent;
  padding: 1px 4px;
  border-radius: 3px;
  outline: none;
  transition: all 0.15s;
}

.dd-style-val:hover {
  border-color: var(--dd-border);
}

.dd-style-val:focus {
  border-color: var(--dd-accent);
  background: var(--dd-bg-elevated);
}

/* Floating trigger button */
.dd-trigger {
  position: fixed;
  z-index: var(--dd-z, 2147483640);
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--dd-border);
  background: var(--dd-bg);
  color: var(--dd-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transition: all 0.2s;
}

.dd-trigger:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}

/* Status bar */
.dd-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  border-top: 1px solid var(--dd-border);
  background: var(--dd-bg-elevated);
  font-size: 9px;
  color: var(--dd-text-dim);
}

.dd-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--dd-accent-muted);
  color: var(--dd-accent);
}

/* Color swatch */
.dd-color {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid var(--dd-border);
  vertical-align: middle;
  margin-right: 4px;
}
`;

// ── Inject styles once ─────────────────────────────────────

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  if (typeof document === "undefined") return;

  const style = document.createElement("style");
  style.id = "designdead-engine-styles";
  style.textContent = STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ── Tag icon helper ────────────────────────────────────────

function TagIcon({ tag }: { tag: string }) {
  const size = 12;
  switch (tag) {
    case "div":
    case "section":
    case "main":
    case "article":
    case "aside":
    case "header":
    case "footer":
    case "nav":
      return <Box size={size} />;
    case "p":
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
    case "span":
    case "label":
      return <Type size={size} />;
    case "img":
    case "svg":
    case "picture":
    case "video":
    case "canvas":
      return <ImageIcon size={size} />;
    case "a":
      return <LinkIcon size={size} />;
    case "ul":
    case "ol":
    case "li":
      return <List size={size} />;
    case "button":
    case "input":
    case "select":
    case "textarea":
      return <ToggleLeft size={size} />;
    default:
      return <Code2 size={size} />;
  }
}

// ── Layer tree component ───────────────────────────────────

function LayerNode({
  node,
  depth,
  selectedId,
  onSelect,
  onHover,
}: {
  node: ElementNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const indent = 8 + depth * 14;

  return (
    <>
      <div
        className={`dd-layer ${isSelected ? "dd-layer-selected" : ""}`}
        style={{ "--dd-indent": `${indent}px` } as React.CSSProperties}
        onClick={() => onSelect(node.id)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
      >
        {hasChildren ? (
          <button
            className="dd-btn"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{ padding: 0, width: 14, height: 14 }}
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        ) : (
          <span style={{ width: 14 }} />
        )}
        <span style={{ color: "var(--dd-text-dim)", flexShrink: 0 }}>
          <TagIcon tag={node.tag} />
        </span>
        <span className="dd-layer-tag">{node.tag}</span>
        {node.classes.length > 0 && (
          <span className="dd-layer-class">
            .{node.classes.slice(0, 2).join(".")}
          </span>
        )}
        {node.text && <span className="dd-layer-text">"{node.text.slice(0, 20)}"</span>}
      </div>
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <LayerNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
    </>
  );
}

// ── Styles panel component ─────────────────────────────────

const STYLE_GROUPS: Record<string, string[]> = {
  Layout: ["display", "flexDirection", "alignItems", "justifyContent", "gap", "position"],
  Spacing: ["padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft"],
  Size: ["width", "height", "maxWidth", "maxHeight", "minWidth", "minHeight"],
  Typography: ["fontSize", "fontFamily", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "color"],
  Background: ["backgroundColor", "opacity"],
  Border: ["border", "borderColor", "borderWidth", "borderRadius", "boxShadow"],
  Transform: ["transform", "transition", "zIndex", "overflow"],
};

function StylesView({
  elementId,
  styles,
  onStyleChange,
}: {
  elementId: string;
  styles: Record<string, string>;
  onStyleChange: (prop: string, value: string) => void;
}) {
  return (
    <div>
      {Object.entries(STYLE_GROUPS).map(([group, props]) => {
        const activeProps = props.filter((p) => styles[p]);
        if (activeProps.length === 0) return null;

        return (
          <div key={group} className="dd-style-group">
            <div className="dd-style-group-title">{group}</div>
            {activeProps.map((prop) => {
              const cssProp = prop.replace(
                /[A-Z]/g,
                (m) => `-${m.toLowerCase()}`
              );
              const value = styles[prop];
              const isColor =
                prop.includes("color") || prop.includes("Color") || prop === "backgroundColor";

              return (
                <div key={prop} className="dd-style-row">
                  <span className="dd-style-prop">{cssProp}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {isColor && value && (
                      <span
                        className="dd-color"
                        style={{ backgroundColor: value }}
                      />
                    )}
                    <input
                      className="dd-style-val"
                      defaultValue={value}
                      onBlur={(e) => {
                        if (e.target.value !== value) {
                          onStyleChange(prop, e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Main DesignDead Component ──────────────────────────────

export function DesignDead({
  position = "bottom-right",
  defaultOpen = false,
  theme = "dark",
  shortcut,
  devOnly = true,
  zIndex = 2147483640,
}: DesignDeadProps) {
  // Dev-only guard
  if (devOnly && typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
    return null;
  }

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<"layers" | "styles" | "output">("layers");
  const [elements, setElements] = useState<ElementNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<Record<string, string>>({});
  const [inspecting, setInspecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Inject styles
  useEffect(() => {
    injectStyles();
    return () => cleanup();
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = shortcut || "d";
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === key) {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcut]);

  // Initial position
  useEffect(() => {
    if (typeof window === "undefined") return;
    const margin = 16;
    const w = 320;
    const h = 400;

    const positions: Record<string, { x: number; y: number }> = {
      "bottom-right": { x: window.innerWidth - w - margin, y: window.innerHeight - h - margin },
      "bottom-left": { x: margin, y: window.innerHeight - h - margin },
      "top-right": { x: window.innerWidth - w - margin, y: margin },
      "top-left": { x: margin, y: margin },
    };

    setPanelPos(positions[position] || positions["bottom-right"]);
  }, [position]);

  // Scan DOM when opening
  const scanDOM = useCallback(() => {
    const tree = buildElementTree();
    rebuildElementMap();
    setElements(tree);
  }, []);

  useEffect(() => {
    if (isOpen) scanDOM();
  }, [isOpen, scanDOM]);

  // Select element
  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      highlightElement(id, "select");

      // Get styles
      const el = getElementById(id);
      if (el) {
        const computed = window.getComputedStyle(el);
        const styles: Record<string, string> = {};
        for (const group of Object.values(STYLE_GROUPS)) {
          for (const prop of group) {
            const cssProp = prop.replace(
              /[A-Z]/g,
              (m) => `-${m.toLowerCase()}`
            );
            const val = computed.getPropertyValue(cssProp);
            if (val && val !== "none" && val !== "normal" && val !== "auto") {
              styles[prop] = val;
            }
          }
        }
        setSelectedStyles(styles);
        setTab("styles");
      }
    },
    []
  );

  // Hover element
  const handleHover = useCallback((id: string | null) => {
    highlightElement(id, "hover");
  }, []);

  // Toggle inspect mode
  const toggleInspect = useCallback(() => {
    if (isInspecting()) {
      stopInspect();
      setInspecting(false);
    } else {
      startInspect((id) => {
        handleSelect(id);
        stopInspect();
        setInspecting(false);
      });
      setInspecting(true);
    }
  }, [handleSelect]);

  // Style change
  const handleStyleChange = useCallback(
    (prop: string, value: string) => {
      if (!selectedId) return;
      applyStyle(selectedId, prop, value);
      setSelectedStyles((prev) => ({ ...prev, [prop]: value }));
    },
    [selectedId]
  );

  // Copy agent output
  const handleCopyOutput = useCallback(() => {
    if (!selectedId) return;
    const output = generateAgentOutput(selectedId);
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [selectedId]);

  // Dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      setDragging(true);
      dragOffset.current = {
        x: e.clientX - panelPos.x,
        y: e.clientY - panelPos.y,
      };
    },
    [panelPos]
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      setPanelPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const onUp = () => setDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  // Resolve theme
  const resolvedTheme =
    theme === "auto"
      ? typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  const themeClass = resolvedTheme === "dark" ? "dd-panel-dark" : "dd-panel-light";

  // ── Trigger button (when closed) ─────────────────────────

  if (!isOpen) {
    const triggerPositions: Record<string, React.CSSProperties> = {
      "bottom-right": { bottom: 16, right: 16 },
      "bottom-left": { bottom: 16, left: 16 },
      "top-right": { top: 16, right: 16 },
      "top-left": { top: 16, left: 16 },
    };

    return (
      <button
        data-designdead="trigger"
        className={`dd-trigger ${themeClass}`}
        style={{
          ...triggerPositions[position],
          "--dd-z": zIndex,
        } as React.CSSProperties}
        onClick={() => setIsOpen(true)}
        title="Open DesignDead (Ctrl+Shift+D)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </button>
    );
  }

  // ── Main panel (when open) ───────────────────────────────

  return (
    <div
      data-designdead="panel"
      className={`dd-panel ${themeClass}`}
      ref={panelRef}
      style={{
        left: panelPos.x,
        top: panelPos.y,
        "--dd-z": zIndex,
      } as React.CSSProperties}
    >
      <div className="dd-container">
        {/* Header */}
        <div className="dd-header" onMouseDown={handleMouseDown}>
          <div className="dd-header-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            designdead
          </div>
          <div className="dd-header-actions">
            <button
              className={`dd-btn ${inspecting ? "dd-btn-active" : ""}`}
              onClick={toggleInspect}
              title="Click-to-inspect (I)"
            >
              <MousePointer2 size={14} />
            </button>
            <button className="dd-btn" onClick={scanDOM} title="Rescan DOM">
              <Search size={14} />
            </button>
            <button
              className="dd-btn"
              onClick={() => {
                stopInspect();
                setInspecting(false);
                highlightElement(null, "hover");
                highlightElement(null, "select");
                setIsOpen(false);
              }}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="dd-tabs">
          <button
            className={`dd-tab ${tab === "layers" ? "dd-tab-active" : ""}`}
            onClick={() => setTab("layers")}
          >
            <Layers size={11} />
            Layers
          </button>
          <button
            className={`dd-tab ${tab === "styles" ? "dd-tab-active" : ""}`}
            onClick={() => setTab("styles")}
          >
            <Palette size={11} />
            Styles
          </button>
          <button
            className={`dd-tab ${tab === "output" ? "dd-tab-active" : ""}`}
            onClick={() => setTab("output")}
          >
            <Zap size={11} />
            Agent
          </button>
        </div>

        {/* Content */}
        <div className="dd-content">
          {tab === "layers" && (
            <>
              {elements.length === 0 ? (
                <div className="dd-empty">
                  <Layers size={24} className="dd-empty-icon" />
                  <div className="dd-empty-text">No elements found</div>
                  <div className="dd-empty-hint">Click "Rescan" to refresh the DOM tree</div>
                </div>
              ) : (
                elements.map((node) => (
                  <LayerNode
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    onHover={handleHover}
                  />
                ))
              )}
            </>
          )}

          {tab === "styles" && (
            <>
              {selectedId ? (
                <StylesView
                  elementId={selectedId}
                  styles={selectedStyles}
                  onStyleChange={handleStyleChange}
                />
              ) : (
                <div className="dd-empty">
                  <MousePointer2 size={24} className="dd-empty-icon" />
                  <div className="dd-empty-text">No element selected</div>
                  <div className="dd-empty-hint">
                    Click an element in Layers or use the inspect tool
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "output" && (
            <>
              {selectedId ? (
                <div className="dd-style-group">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <div className="dd-style-group-title">
                      Structured Output
                    </div>
                    <button className="dd-btn dd-btn-primary" onClick={handleCopyOutput}>
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      {copied ? "Copied!" : "Copy for Agent"}
                    </button>
                  </div>
                  <pre
                    style={{
                      fontSize: 10,
                      fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                      color: "var(--dd-text-muted)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: 1.6,
                      padding: 8,
                      background: "var(--dd-bg-elevated)",
                      border: "1px solid var(--dd-border)",
                      borderRadius: 6,
                      maxHeight: 300,
                      overflow: "auto",
                      margin: 0,
                    }}
                  >
                    {generateAgentOutput(selectedId)}
                  </pre>
                </div>
              ) : (
                <div className="dd-empty">
                  <Zap size={24} className="dd-empty-icon" />
                  <div className="dd-empty-text">Select an element first</div>
                  <div className="dd-empty-hint">
                    The structured output helps AI agents find the exact code you're referring to
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Status bar */}
        <div className="dd-status">
          <span>
            {elements.length > 0
              ? `${countNodes(elements)} elements`
              : "Ready"}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {inspecting && <span className="dd-badge">Inspecting</span>}
            <span style={{ opacity: 0.5 }}>Ctrl+Shift+D</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function countNodes(nodes: ElementNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countNodes(node.children);
  }
  return count;
}

export default DesignDead;
