// ──────────────────────────────────────────────────────────
// Variant Node — Resizable variant card with breakpoint presets
// ──────────────────────────────────────────────────────────

import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  Handle,
  Position,
  NodeResizer,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import {
  GitFork,
  Check,
  Send,
  Trash2,
  CheckCircle2,
  Copy,
  ArrowUpToLine,
  Crosshair,
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
} from "lucide-react";
import { useWorkspace, VariantData } from "../store";
import { copyToClipboard } from "./clipboard";
import {
  setInspectionTarget,
  rebuildElementMap,
  buildElementTree,
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

const VARIANT_PRESETS = [
  { label: "Wide", width: 768, icon: Laptop },
  { label: "Tablet", width: 560, icon: Tablet },
  { label: "Mobile", width: 375, icon: Smartphone },
];

const MIN_W = 280;
const MIN_H = 240;
const MAX_W = 1440;
const MAX_H = 1200;
const CHROME_H = 34;

export function VariantNode({ id, data, selected }: NodeProps) {
  const { variant, onFork, onDelete, onFinalize, onSendToAgent, onPushToMain } = data as VariantNodeData;
  const { state, dispatch } = useWorkspace();
  const { updateNode } = useReactFlow();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(variant.name);
  const [copied, setCopied] = useState(false);
  const [inspecting, setInspectingState] = useState(false);
  const initW = variant.sourceViewportWidth || 560;
  const initH = Math.round(initW * (420 / 560));
  const [dims, setDims] = useState({ w: initW, h: initH });
  const [isResizing, setIsResizing] = useState(false);

  const htmlContent = variant.modifiedHtml || variant.html;
  const cssContent = variant.modifiedCss || variant.css;

  // Split @import rules (must be first in <style>) from regular CSS rules
  // Also filter out DesignDead internal and ReactFlow styles
  const cssLines = (cssContent || "").split("\n");
  const importLines: string[] = [];
  const ruleLines: string[] = [];
  for (const line of cssLines) {
    if (line.startsWith("@import ")) {
      importLines.push(line);
    } else if (
      !line.includes("[data-designdead") &&
      !line.includes(".react-flow") &&
      !line.includes("--xy-") &&
      !line.includes("--dd-")
    ) {
      ruleLines.push(line);
    }
  }

  const srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${importLines.join("\n")}</style>
<style>*,*::before,*::after{box-sizing:border-box;}body{margin:0;overflow:auto;width:100%;min-height:100%;}
${ruleLines.join("\n")}</style>
</head>
<body>${htmlContent}</body>
</html>`;

  const contentHash = (htmlContent + (cssContent || "")).length;
  const isActiveVariant = state.activeVariantId === variant.id;

  // Auto-scan this variant's DOM into layers/styles when it becomes the active variant
  useEffect(() => {
    if (!isActiveVariant) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;

    setInspectionTarget(iframe.contentDocument, iframe);
    const tree = buildElementTree();
    rebuildElementMap();
    dispatch({ type: "SET_ELEMENTS", elements: tree });
  }, [isActiveVariant, dispatch, contentHash]);

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

    startInspect((elId, el) => {
      dispatch({ type: "SELECT_ELEMENT", id: elId, source: "inspect" });
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
      dispatch({ type: "SET_ELEMENT_STYLES", id: elId, styles });
      stopInspect();
      setInspectingState(false);
    });
    setInspectingState(true);
  }, [inspecting, variant.id, dispatch]);

  const applyPreset = useCallback((preset: typeof VARIANT_PRESETS[number]) => {
    setDims((d) => ({ ...d, w: preset.width }));
    updateNode(id, { style: { width: preset.width, height: dims.h } });
  }, [id, dims.h, updateNode]);

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
      data-variant-id={variant.id}
      style={{
        width: "100%",
        height: "100%",
        background: "#0a0a0a",
        border: `1px solid ${selected ? "#0070f3" : variant.status === "finalized" ? "#50e3c2" + "40" : "#1a1a1a"}`,
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Geist Sans', 'Inter', system-ui, sans-serif",
        boxShadow: selected
          ? "0 0 0 1px #0070f3, 0 4px 20px rgba(0,112,243,0.1)"
          : "0 4px 20px rgba(0,0,0,0.25)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      {/* ── NodeResizer ── */}
      <NodeResizer
        minWidth={MIN_W}
        minHeight={MIN_H}
        maxWidth={MAX_W}
        maxHeight={MAX_H}
        isVisible={selected || false}
        lineStyle={{ borderWidth: 1, borderColor: "#0070f3" }}
        handleStyle={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "#0070f3",
          border: "2px solid #0a0a0a",
        }}
        onResizeStart={() => setIsResizing(true)}
        onResize={(_, p) => setDims({ w: Math.round(p.width), h: Math.round(p.height) })}
        onResizeEnd={() => setIsResizing(false)}
      />

      <Handle type="target" position={Position.Left} style={{ background: "#0070f3", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: "#0070f3", width: 8, height: 8 }} />

      {/* ── Chrome bar ── */}
      <div
        style={{
          height: CHROME_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px",
          borderBottom: "1px solid #1a1a1a",
          background: "#0a0a0a",
          flexShrink: 0,
          gap: 4,
        }}
      >
        {/* Left: name + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
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
                fontSize: 10,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          ) : (
            <span
              onDoubleClick={() => setEditing(true)}
              style={{ fontSize: 10, color: "#ededed", cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title="Double-click to rename"
            >
              {variant.name}
            </span>
          )}
          <span style={{
            padding: "1px 5px",
            borderRadius: 4,
            background: statusColor + "18",
            color: statusColor,
            fontSize: 8,
            fontWeight: 500,
            flexShrink: 0,
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Center: breakpoint presets + dims */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {VARIANT_PRESETS.map((p) => {
            const Icon = p.icon;
            const isActive = Math.abs(dims.w - p.width) < 20;
            return (
              <button
                key={p.label}
                onClick={(e) => { e.stopPropagation(); applyPreset(p); }}
                title={`${p.label} (${p.width}px)`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  border: `1px solid ${isActive ? "#0070f3" + "60" : "transparent"}`,
                  background: isActive ? "#0070f3" + "15" : "transparent",
                  color: isActive ? "#0070f3" : "#555",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "inherit",
                }}
              >
                <Icon style={{ width: 11, height: 11 }} />
              </button>
            );
          })}
          <span
            style={{
              fontSize: 9,
              color: isResizing ? "#0070f3" : "#555",
              fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
              fontVariantNumeric: "tabular-nums",
              padding: "1px 4px",
              background: isResizing ? "#0070f3" + "15" : "transparent",
              borderRadius: 3,
              transition: "all 0.15s",
            }}
          >
            {dims.w}&times;{dims.h}
          </span>
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <VBtn onClick={toggleVariantInspect} active={inspecting} title="Inspect">
            <Crosshair style={{ width: 10, height: 10 }} />
          </VBtn>
          <VBtn onClick={() => onFork(variant.id)} title="Fork">
            <GitFork style={{ width: 10, height: 10 }} />
          </VBtn>
          <VBtn onClick={handleCopyHtml} title="Copy HTML">
            {copied ? <Check style={{ width: 10, height: 10, color: "#50e3c2" }} /> : <Copy style={{ width: 10, height: 10 }} />}
          </VBtn>
          {variant.status === "draft" && (
            <VBtn onClick={() => onFinalize(variant.id)} accent title="Finalize">
              <CheckCircle2 style={{ width: 10, height: 10 }} />
            </VBtn>
          )}
          {variant.status === "finalized" && (
            <VBtn onClick={() => onSendToAgent(variant.id)} accent title="Send to Agent">
              <Send style={{ width: 10, height: 10 }} />
            </VBtn>
          )}
          {canPushToMain && (
            <VBtn onClick={() => onPushToMain(variant.id)} title="Push to Main">
              <ArrowUpToLine style={{ width: 10, height: 10, color: "#0070f3" }} />
            </VBtn>
          )}
          <VBtn onClick={() => onDelete(variant.id)} danger title="Delete">
            <Trash2 style={{ width: 10, height: 10 }} />
          </VBtn>
        </div>
      </div>

      {/* ── Preview ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#fff" }}>
        <iframe
          key={`${variant.id}-${contentHash}`}
          ref={iframeRef}
          srcDoc={srcdoc}
          sandbox="allow-same-origin"
          title={`Variant: ${variant.name}`}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
            pointerEvents: iframeInteractive && !isResizing ? "auto" : "none",
          }}
        />
        {inspecting && (
          <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
              borderRadius: 5, background: "#0070f3", color: "#fff", fontSize: 9,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}>
              <Crosshair style={{ width: 10, height: 10 }} />
              Click to inspect
            </div>
          </div>
        )}
        {isResizing && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 20, pointerEvents: "none",
            background: "rgba(0,0,0,0.15)",
          }}>
            <div style={{
              padding: "6px 12px", borderRadius: 6, background: "#0a0a0a",
              border: "1px solid #222", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: "#0070f3",
                fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
                fontVariantNumeric: "tabular-nums",
              }}>
                {dims.w} &times; {dims.h}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VBtn({ children, onClick, active, accent, danger, title }: {
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
