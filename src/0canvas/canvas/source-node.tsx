// ──────────────────────────────────────────────────────────
// Source Node — Framer-style resizable viewport for main app
// ──────────────────────────────────────────────────────────

import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  Handle,
  Position,
  NodeResizer,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import {
  Crosshair,
  RefreshCw,
  GitFork,
  Copy,
  Check,
  Loader2,
  Monitor,
  Maximize2,
  Smartphone,
  Tablet,
  Laptop,
} from "lucide-react";
import { useWorkspace } from "../store/store";
import {
  buildElementTree,
  rebuildElementMap,
  setInspectionTarget,
  startInspect,
  stopInspect,
  isInspecting,
  capturePageSnapshot,
  captureComponentSnapshot,
  generateAgentOutput,
  highlightElement,
  onFeedbackRequest,
  onForkElementRequest,
} from "../inspector/dom-inspector";
import { copyToClipboard } from "../utils/clipboard";

export type SourceNodeData = {
  label: string;
  onForkPage: (viewportWidth: number) => void;
  onForkComponent: (elementId: string, viewportWidth: number) => void;
};

// ── Viewport presets ───────────────────────────────────────

const PRESETS = [
  { label: "Desktop", width: 1440, icon: Monitor },
  { label: "Laptop", width: 1280, icon: Laptop },
  { label: "Tablet", width: 768, icon: Tablet },
  { label: "Mobile", width: 375, icon: Smartphone },
];

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 300;
const MAX_WIDTH = 2560;
const MAX_HEIGHT = 1600;
const CHROME_HEIGHT = 40;

export function SourceNode({ id, data, selected }: NodeProps) {
  const { label, onForkPage, onForkComponent } = data as SourceNodeData;
  const { state, dispatch } = useWorkspace();
  const { updateNode } = useReactFlow();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [elementCount, setElementCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dims, setDims] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("Laptop");

  const iframeSrc = typeof window !== "undefined" ? window.location.href : "";

  // ── Iframe load ──────────────────────────────────────────

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const contentDoc = iframe.contentDocument;
      if (!contentDoc?.body) { setIframeError(true); return; }
      setInspectionTarget(contentDoc, iframe);
      setIframeLoaded(true);
      setIframeError(false);
      const tree = buildElementTree();
      rebuildElementMap();
      dispatch({ type: "SET_ELEMENTS", elements: tree });
      setElementCount(countNodes(tree));

      // Auto-rescan after a delay to catch React hydration / async rendering
      // The first scan often finds only the root div before components mount
      setTimeout(() => {
        try {
          const iframeEl = iframeRef.current;
          if (!iframeEl?.contentDocument?.body) return;
          setInspectionTarget(iframeEl.contentDocument, iframeEl);
          const fullTree = buildElementTree();
          rebuildElementMap();
          const fullCount = countNodes(fullTree);
          if (fullCount > countNodes(tree)) {
            dispatch({ type: "SET_ELEMENTS", elements: fullTree });
            setElementCount(fullCount);
          }
        } catch { /* noop */ }
      }, 800);
    } catch {
      setIframeError(true);
    }
  }, [dispatch]);

  const scanDOM = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    setInspectionTarget(iframe.contentDocument, iframe);
    const tree = buildElementTree();
    rebuildElementMap();
    dispatch({ type: "SET_ELEMENTS", elements: tree });
    setElementCount(countNodes(tree));
  }, [dispatch]);

  // ── Inspect ──────────────────────────────────────────────

  const toggleInspect = useCallback(() => {
    if (isInspecting()) {
      stopInspect();
      setInspecting(false);
      return;
    }
    const iframe = iframeRef.current;
    if (iframe?.contentDocument) {
      setInspectionTarget(iframe.contentDocument, iframe);
      rebuildElementMap();
    }

    dispatch({ type: "SET_ACTIVE_VARIANT", id: null });

    startInspect((elId, el) => {
      dispatch({ type: "SELECT_ELEMENT", id: elId, source: "inspect" });
      const doc = iframeRef.current?.contentDocument || document;
      const win = doc.defaultView || window;
      const computed = win.getComputedStyle(el);
      const styles: Record<string, string> = {};
      const props = [
        "color", "backgroundColor", "fontSize", "fontFamily", "fontWeight",
        "lineHeight", "padding", "margin", "width", "height", "display",
        "flexDirection", "alignItems", "justifyContent", "gap", "position",
        "borderRadius", "border", "boxShadow", "opacity", "transform",
      ];
      for (const prop of props) {
        const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        const val = computed.getPropertyValue(cssProp);
        if (val && val !== "none" && val !== "normal" && val !== "auto") styles[prop] = val;
      }
      dispatch({ type: "SET_ELEMENT_STYLES", id: elId, styles });
      stopInspect();
      setInspecting(false);
    });
    setInspecting(true);
  }, [dispatch]);

  const handleCopy = useCallback(() => {
    if (!state.selectedElementId) return;
    const output = generateAgentOutput(state.selectedElementId);
    copyToClipboard(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [state.selectedElementId]);

  // ── Viewport preset ──────────────────────────────────────

  const applyPreset = useCallback((preset: typeof PRESETS[number]) => {
    setActivePreset(preset.label);
    setDims((d) => ({ ...d, w: preset.width }));
    updateNode(id, { style: { width: preset.width, height: dims.h } });
  }, [id, dims.h, updateNode]);

  // ── Feedback & highlight sync ────────────────────────────

  useEffect(() => {
    onFeedbackRequest(() => {
      dispatch({ type: "SET_FEEDBACK_PANEL_OPEN", open: true });
    });
    onForkElementRequest((elementId: string) => {
      onForkComponent(elementId, dims.w);
    });
    return () => {
      onFeedbackRequest(null);
      onForkElementRequest(null);
    };
  }, [dispatch, onForkComponent, dims.w]);

  useEffect(() => {
    if (state.hoveredElementId) highlightElement(state.hoveredElementId, "hover");
    else highlightElement(null, "hover");
  }, [state.hoveredElementId]);

  useEffect(() => {
    if (state.selectedElementId) highlightElement(state.selectedElementId, "select");
    else highlightElement(null, "select");
  }, [state.selectedElementId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state.feedbackPanelOpen) {
          dispatch({ type: "SET_FEEDBACK_PANEL_OPEN", open: false });
        } else if (state.selectedElementId) {
          dispatch({ type: "SELECT_ELEMENT", id: null });
          highlightElement(null, "select");
        }
        if (isInspecting()) {
          stopInspect();
          setInspecting(false);
        }
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [state.feedbackPanelOpen, state.selectedElementId, dispatch]);

  useEffect(() => {
    return () => { stopInspect(); };
  }, []);

  // ── Resize callbacks ─────────────────────────────────────

  const onResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);

  const onResize = useCallback((_: unknown, params: { width: number; height: number }) => {
    const w = Math.round(params.width);
    const h = Math.round(params.height);
    setDims({ w, h });

    // Detect which preset matches
    const match = PRESETS.find((p) => Math.abs(p.width - w) < 20);
    setActivePreset(match ? match.label : "");
  }, []);

  const onResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  return (
    <div
      data-0canvas="source-node"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      {/* ── NodeResizer — wraps only the viewport area ── */}
      <NodeResizer
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        maxWidth={MAX_WIDTH}
        maxHeight={MAX_HEIGHT}
        isVisible={selected || false}
        lineStyle={{
          borderWidth: 1,
          borderColor: "var(--color--outline--on-background)",
        }}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--color--base--primary)",
          border: "2px solid var(--color--surface--0)",
        }}
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
      />

      {/* ── Chrome Bar — floats above the node bounds ── */}
      <div
        className="oc-source-chrome"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "100%",
          marginBottom: 8,
          height: CHROME_HEIGHT,
          justifyContent: "space-between",
          border: "1px solid var(--color--border--on-surface-0)",
          borderRadius: 10,
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        {/* Left: traffic dots + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {/* Traffic light dots */}
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <span className="oc-source-traffic-dot" style={{ background: "#ff5f57" }} />
            <span className="oc-source-traffic-dot" style={{ background: "#febc2e" }} />
            <span className="oc-source-traffic-dot" style={{ background: "#28c840" }} />
          </div>

          {/* URL / route pill */}
          <div className="oc-source-url">
            <span style={{ fontSize: 9, color: "var(--color--text--muted)", flexShrink: 0 }}>localhost</span>
            <span style={{ fontSize: 10 }}>
              {state.currentRoute || "/"}
            </span>
          </div>
        </div>

        {/* Center: Dimensions label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {/* Breakpoint presets */}
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isActive = activePreset === preset.label;
              return (
                <button
                  key={preset.label}
                  className={`oc-source-preset ${isActive ? "is-active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); applyPreset(preset); }}
                  title={`${preset.label} (${preset.width}px)`}
                >
                  <Icon style={{ width: 13, height: 13 }} />
                </button>
              );
            })}
          </div>

          {/* Dimension badge */}
          <div
            className="oc-source-url"
            style={{
              flex: "none",
              padding: "3px 10px",
              background: isResizing ? "rgba(37,99,235,0.08)" : undefined,
              borderColor: isResizing ? "rgba(37,99,235,0.25)" : undefined,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: isResizing ? "var(--color--text--primary)" : undefined,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.3px",
                transition: "color 0.15s",
              }}
            >
              {dims.w} &times; {dims.h}
            </span>
          </div>
        </div>

        {/* Right: tools */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            className={`oc-source-btn ${inspecting ? "is-active" : ""}`}
            onClick={(e) => { e.stopPropagation(); toggleInspect(); }}
            title="Inspect (I)"
          >
            <Crosshair style={{ width: 12, height: 12 }} />
          </button>
          <button
            className="oc-source-btn"
            onClick={(e) => { e.stopPropagation(); scanDOM(); }}
            title="Rescan"
          >
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
          {state.selectedElementId && (
            <button
              className="oc-source-btn"
              onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              title="Copy for Agent"
            >
              {copied ? <Check style={{ width: 12, height: 12, color: "var(--color--text--primary-light)" }} /> : <Copy style={{ width: 12, height: 12 }} />}
            </button>
          )}
          <div style={{ width: 1, height: 16, background: "var(--color--border--on-surface-0)" }} />
          <button
            className="oc-source-btn"
            onClick={(e) => { e.stopPropagation(); onForkPage(dims.w); }}
            title="Fork Page"
            style={{ color: "var(--color--text--primary)" }}
          >
            <GitFork style={{ width: 12, height: 12 }} />
          </button>
          {state.selectedElementId && (
            <button
              className="oc-source-btn"
              onClick={(e) => { e.stopPropagation(); onForkComponent(state.selectedElementId!, dims.w); }}
              title="Fork Element"
              style={{ color: "var(--color--text--primary)" }}
            >
              <Maximize2 style={{ width: 12, height: 12 }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Viewport / iframe — fills the entire node area ── */}
      <div
        className="oc-variant-card"
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          border: `1px solid ${selected ? "var(--color--outline--on-background)" : "var(--color--border--on-surface-0)"}`,
          boxShadow: selected
            ? "0 0 0 1px var(--color--outline--on-background), 0 8px 32px rgba(37,99,235,0.12)"
            : "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        {/* The iframe */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Loading */}
        {!iframeLoaded && !iframeError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color--surface--0)",
              zIndex: 2,
            }}
          >
            <Loader2
              style={{
                width: 28,
                height: 28,
                color: "var(--color--text--primary)",
                animation: "spin 1s linear infinite",
                marginBottom: 12,
              }}
            />
            <p style={{ color: "var(--color--text--muted)", fontSize: 12, margin: 0 }}>Loading preview...</p>
          </div>
        )}

        {/* Error */}
        {iframeError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color--surface--0)",
              zIndex: 2,
            }}
          >
            <Monitor style={{ width: 24, height: 24, color: "var(--color--status--critical)", marginBottom: 8 }} />
            <p style={{ color: "var(--color--text--muted)", fontSize: 11, margin: 0 }}>Preview unavailable</p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          name="0canvas-preview"
          src={iframeSrc}
          onLoad={handleIframeLoad}
          title="ZeroCanvas Preview"
          data-0canvas="preview-iframe"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
            background: "#fff",
            pointerEvents: isResizing ? "none" : "auto",
          }}
        />

        {/* Inspect overlay badge */}
        {inspecting && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                borderRadius: 8,
                background: "var(--color--base--primary)",
                color: "var(--color--text--on-primary)",
                fontSize: 11,
                fontWeight: 500,
                boxShadow: "0 2px 12px rgba(37,99,235,0.3)",
              }}
            >
              <Crosshair style={{ width: 12, height: 12 }} />
              Click to inspect
            </div>
          </div>
        )}

        {/* Resize dimension overlay (shows in center during resize) */}
        {isResizing && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 20,
              pointerEvents: "none",
              background: "rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "var(--color--surface--0)",
                border: "1px solid var(--color--border--on-surface-0)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color--text--primary)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {dims.w} &times; {dims.h}
              </span>
            </div>
          </div>
        )}
        </div>

        {/* ── Bottom status bar ── */}
        <div
          style={{
            height: 24,
            borderTop: "1px solid var(--color--border--on-surface-0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            background: "var(--color--surface--0)",
            flexShrink: 0,
            borderRadius: "0 0 10px 10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: iframeLoaded ? "var(--color--status--success)" : "var(--color--text--muted)",
              }}
            />
            <span style={{ fontSize: 9, color: "var(--color--text--muted)" }}>
              {iframeLoaded ? `${elementCount} elements` : "Loading..."}
            </span>
          </div>
          <span style={{ fontSize: 9, color: "var(--color--text--muted)" }}>
            {activePreset || "Custom"}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: "var(--color--base--primary)",
          width: 8,
          height: 8,
          border: "2px solid var(--color--surface--0)",
        }}
      />
    </div>
  );
}

function countNodes(nodes: any[]): number {
  let count = 0;
  for (const n of nodes) { count++; if (n.children) count += countNodes(n.children); }
  return count;
}
