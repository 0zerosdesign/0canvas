// ──────────────────────────────────────────────────────────
// Variant Node — ReactFlow custom node for a forked variant
// Supports inspection and feedback inside the variant iframe.
// ──────────────────────────────────────────────────────────

import React, { useRef, useState, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  GitFork,
  Check,
  Send,
  Trash2,
  CheckCircle2,
  Copy,
  ArrowUpToLine,
  Crosshair,
} from "lucide-react";
import { useWorkspace, VariantData } from "../store";
import { copyToClipboard } from "./clipboard";
import {
  setInspectionTarget,
  rebuildElementMap,
  startInspect,
  stopInspect,
  isInspecting,
  highlightElement,
  onFeedbackRequest,
} from "./dom-inspector";

export type VariantNodeData = {
  variant: VariantData;
  onFork: (variantId: string) => void;
  onDelete: (variantId: string) => void;
  onFinalize: (variantId: string) => void;
  onSendToAgent: (variantId: string) => void;
  onPushToMain: (variantId: string) => void;
};

export function VariantNode({ data }: NodeProps) {
  const { variant, onFork, onDelete, onFinalize, onSendToAgent, onPushToMain } = data as VariantNodeData;
  const { state, dispatch } = useWorkspace();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(variant.name);
  const [copied, setCopied] = useState(false);
  const [inspecting, setInspectingState] = useState(false);

  const htmlContent = variant.modifiedHtml || variant.html;
  const cssContent = variant.modifiedCss || variant.css;

  const srcdoc = `<!DOCTYPE html>
<html>
<head><style>${cssContent}</style><style>body{margin:0;overflow:auto;}</style></head>
<body>${htmlContent}</body>
</html>`;

  const handleRename = () => {
    if (name.trim() && name !== variant.name) {
      dispatch({ type: "UPDATE_VARIANT", id: variant.id, updates: { name: name.trim() } });
    }
    setEditing(false);
  };

  const handleCopyHtml = useCallback(() => {
    copyToClipboard(htmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [htmlContent]);

  const toggleVariantInspect = useCallback(() => {
    if (inspecting) {
      stopInspect();
      setInspectingState(false);
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    setInspectionTarget(iframe.contentDocument, iframe);
    rebuildElementMap();
    dispatch({ type: "SET_ACTIVE_VARIANT", id: variant.id });

    onFeedbackRequest(() => {
      dispatch({ type: "SET_FEEDBACK_PANEL_OPEN", open: true });
    });

    startInspect((id, el) => {
      dispatch({ type: "SELECT_ELEMENT", id, source: "inspect" });
      const doc = iframe.contentDocument || document;
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
      setInspectingState(false);
    });
    setInspectingState(true);
  }, [inspecting, variant.id, dispatch]);

  const statusColor =
    variant.status === "pushed" ? "#0070f3" :
    variant.status === "finalized" ? "#50e3c2" :
    variant.status === "sent" ? "#7928ca" : "#444";

  const statusLabel =
    variant.status === "pushed" ? "Pushed" :
    variant.status === "finalized" ? "Finalized" :
    variant.status === "sent" ? "Sent" : "Draft";

  const canPushToMain = variant.status === "finalized" && !!variant.sourceElementId;
  const hasActiveSelection = !!state.selectedElementId && state.selectionSource === "inspect" && state.activeVariantId === variant.id;
  const iframeInteractive = inspecting || hasActiveSelection;

  return (
    <div
      data-designdead="variant-node"
      style={{
        width: 480,
        background: "#0a0a0a",
        border: `1px solid ${variant.status === "finalized" ? "#50e3c2" + "40" : "#1a1a1a"}`,
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Geist Sans', 'Inter', system-ui, sans-serif",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#0070f3", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: "#0070f3", width: 8, height: 8 }} />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: "1px solid #1a1a1a",
          background: "#0a0a0a",
          minHeight: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
              style={{
                flex: 1,
                padding: "2px 6px",
                background: "#111",
                border: "1px solid #333",
                borderRadius: 4,
                color: "#ededed",
                fontSize: 11,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          ) : (
            <span
              onDoubleClick={() => setEditing(true)}
              style={{ fontSize: 11, color: "#ededed", cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title="Double-click to rename"
            >
              {variant.name}
            </span>
          )}
          <span style={{
            padding: "1px 6px",
            borderRadius: 4,
            background: statusColor + "18",
            color: statusColor,
            fontSize: 9,
            fontWeight: 500,
            flexShrink: 0,
          }}>
            {statusLabel}
          </span>
          {variant.sourceType === "component" && (
            <span style={{ fontSize: 8, color: "#555", background: "#111", padding: "1px 4px", borderRadius: 3, flexShrink: 0 }}>
              {variant.sourceSelector}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: 8 }}>
          <NodeBtn onClick={toggleVariantInspect} active={inspecting} title="Inspect variant">
            <Crosshair style={{ width: 11, height: 11 }} />
          </NodeBtn>
          <NodeBtn onClick={() => onFork(variant.id)} title="Fork variant">
            <GitFork style={{ width: 11, height: 11 }} />
          </NodeBtn>
          <NodeBtn onClick={handleCopyHtml} title="Copy HTML">
            {copied ? <Check style={{ width: 11, height: 11, color: "#50e3c2" }} /> : <Copy style={{ width: 11, height: 11 }} />}
          </NodeBtn>
          {variant.status === "draft" && (
            <NodeBtn onClick={() => onFinalize(variant.id)} accent title="Finalize">
              <CheckCircle2 style={{ width: 11, height: 11 }} />
            </NodeBtn>
          )}
          {variant.status === "finalized" && (
            <NodeBtn onClick={() => onSendToAgent(variant.id)} accent title="Send to Agent">
              <Send style={{ width: 11, height: 11 }} />
            </NodeBtn>
          )}
          {canPushToMain && (
            <NodeBtn onClick={() => onPushToMain(variant.id)} title="Push to Main App">
              <ArrowUpToLine style={{ width: 11, height: 11, color: "#0070f3" }} />
            </NodeBtn>
          )}
          <NodeBtn onClick={() => onDelete(variant.id)} danger title="Delete">
            <Trash2 style={{ width: 11, height: 11 }} />
          </NodeBtn>
        </div>
      </div>

      {/* Sandboxed preview */}
      <div style={{ height: 320, position: "relative", overflow: "hidden", background: "#fff" }}>
        <iframe
          ref={iframeRef}
          srcDoc={srcdoc}
          sandbox="allow-same-origin"
          title={`Variant: ${variant.name}`}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
            pointerEvents: iframeInteractive ? "auto" : "none",
          }}
        />
        {inspecting && (
          <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 5,
              background: "#0070f3",
              color: "#fff",
              fontSize: 9,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}>
              <Crosshair style={{ width: 10, height: 10 }} />
              Click to inspect
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NodeBtn({ children, onClick, active, accent, danger, title }: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  accent?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        padding: 3,
        borderRadius: 4,
        border: active ? "1px solid #0070f3" : "none",
        background: active ? "#0070f3" : "transparent",
        color: active ? "#fff" : danger ? "#ff4444" : accent ? "#50e3c2" : "#666",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
