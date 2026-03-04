// ──────────────────────────────────────────────────────────
// Source Node — ReactFlow custom node for the main app preview
// ──────────────────────────────────────────────────────────

import React, { useCallback, useRef, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Crosshair,
  RefreshCw,
  GitFork,
  Copy,
  Check,
  Loader2,
  Monitor,
  Maximize2,
} from "lucide-react";
import { useWorkspace } from "../store";
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
} from "./dom-inspector";
import { copyToClipboard } from "./clipboard";

export type SourceNodeData = {
  label: string;
  onForkPage: () => void;
  onForkComponent: (elementId: string) => void;
};

export function SourceNode({ data }: NodeProps) {
  const { label, onForkPage, onForkComponent } = data as SourceNodeData;
  const { state, dispatch } = useWorkspace();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [elementCount, setElementCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const iframeSrc = typeof window !== "undefined" ? window.location.href : "";

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
    startInspect((id, el) => {
      dispatch({ type: "SELECT_ELEMENT", id });
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
      dispatch({ type: "SET_ELEMENT_STYLES", id, styles });
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

  useEffect(() => {
    if (state.hoveredElementId) highlightElement(state.hoveredElementId, "hover");
    else highlightElement(null, "hover");
  }, [state.hoveredElementId]);

  useEffect(() => {
    if (state.selectedElementId) highlightElement(state.selectedElementId, "select");
    else highlightElement(null, "select");
  }, [state.selectedElementId]);

  useEffect(() => {
    return () => { stopInspect(); };
  }, []);

  return (
    <div
      data-designdead="source-node"
      style={{
        width: 800,
        height: 520,
        background: "#0a0a0a",
        border: "1px solid #1a1a1a",
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Geist Sans', 'Inter', system-ui, sans-serif",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          height: 36,
          borderBottom: "1px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          background: "#0a0a0a",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 6px", borderRadius: 4, background: "#50e3c2" + "15", border: "1px solid #50e3c2" + "30" }}>
            <Monitor style={{ width: 11, height: 11, color: "#50e3c2" }} />
            <span style={{ fontSize: 9, color: "#50e3c2", fontWeight: 500 }}>MAIN</span>
          </div>
          <span style={{ fontSize: 10, color: "#888" }}>{state.currentRoute}</span>
          {elementCount > 0 && <span style={{ fontSize: 9, color: "#444" }}>{elementCount} el</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ToolBtn onClick={toggleInspect} active={inspecting} title="Inspect (I)">
            <Crosshair style={{ width: 12, height: 12 }} />
          </ToolBtn>
          <ToolBtn onClick={scanDOM} title="Rescan">
            <RefreshCw style={{ width: 12, height: 12 }} />
          </ToolBtn>
          {state.selectedElementId && (
            <ToolBtn onClick={handleCopy} title="Copy for Agent">
              {copied ? <Check style={{ width: 12, height: 12, color: "#50e3c2" }} /> : <Copy style={{ width: 12, height: 12 }} />}
            </ToolBtn>
          )}
          <div style={{ width: 1, height: 16, background: "#1a1a1a" }} />
          <ToolBtn onClick={onForkPage} accent title="Fork Page">
            <GitFork style={{ width: 12, height: 12 }} />
            <span style={{ fontSize: 10 }}>Fork</span>
          </ToolBtn>
          {state.selectedElementId && (
            <ToolBtn onClick={() => onForkComponent(state.selectedElementId!)} accent title="Fork Component">
              <Maximize2 style={{ width: 12, height: 12 }} />
              <span style={{ fontSize: 10 }}>Fork Element</span>
            </ToolBtn>
          )}
        </div>
      </div>

      {/* Preview iframe */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {!iframeLoaded && !iframeError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", zIndex: 2 }}>
            <Loader2 style={{ width: 24, height: 24, color: "#0070f3", animation: "spin 1s linear infinite" }} />
          </div>
        )}
        {iframeError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", zIndex: 2 }}>
            <Monitor style={{ width: 24, height: 24, color: "#ff4444", marginBottom: 8 }} />
            <p style={{ color: "#888", fontSize: 11, margin: 0 }}>Preview unavailable</p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          name="designdead-preview"
          src={iframeSrc}
          onLoad={handleIframeLoad}
          title="DesignDead Preview"
          data-designdead="preview-iframe"
          style={{ width: "100%", height: "100%", border: "none", display: "block", background: "#fff" }}
        />
        {inspecting && (
          <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, background: "#0070f3", color: "#fff", fontSize: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
              <Crosshair style={{ width: 11, height: 11 }} />
              Click to inspect
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: "#0070f3", width: 8, height: 8 }} />
    </div>
  );
}

function ToolBtn({ children, onClick, active, accent, title }: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  accent?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        padding: "3px 7px",
        borderRadius: 5,
        border: `1px solid ${active ? "#0070f3" : accent ? "#0070f3" + "40" : "#1a1a1a"}`,
        background: active ? "#0070f3" : accent ? "#0070f3" + "12" : "#111",
        color: active ? "#fff" : accent ? "#0070f3" : "#888",
        cursor: "pointer",
        fontSize: 10,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function countNodes(nodes: any[]): number {
  let count = 0;
  for (const n of nodes) { count++; if (n.children) count += countNodes(n.children); }
  return count;
}
