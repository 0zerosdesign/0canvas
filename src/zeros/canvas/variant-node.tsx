// ──────────────────────────────────────────────────────────
// Variant Node — Resizable variant card with breakpoint presets
// ──────────────────────────────────────────────────────────

import React, { useRef, useState, useCallback, useEffect } from "react";
import {
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
import { useWorkspace, VariantData } from "../store/store";
import { copyToClipboard } from "../utils/clipboard";
import {
  setInspectionTarget,
  rebuildElementMap,
  buildElementTree,
  startInspect,
  stopInspect,
  isInspecting,
  highlightElement,
} from "../inspector";
import { Input } from "../ui";

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
const MIN_H = 160;
const MAX_W = 1440;
const MAX_H = 4000;
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
  const FLOATING_HEADER_H = 42;
  const rawH = variant.sourceContentHeight || Math.round(initW * (420 / 560));
  const minH = variant.sourceType === "component" ? 200 : 420;
  const initH = Math.max(rawH, minH) + FLOATING_HEADER_H;
  const [dims, setDims] = useState({ w: initW, h: initH });
  const [isResizing, setIsResizing] = useState(false);

  const htmlContent = variant.modifiedHtml || variant.html;
  const cssContent = variant.modifiedCss || variant.css;

  // Split CSS into @import rules (must be first in <style>) and regular rules.
  // Filter out Zeros internal and ReactFlow rules at the rule boundary
  // instead of per-line, so multi-line rules aren't partially stripped.
  const importLines: string[] = [];
  const ruleLines: string[] = [];

  // Split on rule boundaries: each cssText rule from CSSOM is joined with \n,
  // but we need to handle both single-line (CSSOM) and multi-line (raw textContent) CSS.
  const rawCss = cssContent || "";

  // Quick regex split: each top-level rule ends with } (or is @import ending with ;)
  // For CSSOM-collected CSS (one rule per line), simple \n split works.
  // For raw CSS, we split on closing brace at the start of a line or use the raw blocks.
  const rules = rawCss.split(/\n(?=[@.#\[:*a-zA-Z])/);

  for (const rule of rules) {
    const trimmed = rule.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("@import ")) {
      importLines.push(trimmed);
    } else if (
      !trimmed.includes("[data-Zeros") &&
      !trimmed.includes(".react-flow") &&
      !trimmed.includes("--xy-") &&
      !trimmed.includes("--oc-")
    ) {
      ruleLines.push(trimmed);
    }
  }

  const srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${importLines.join("\n")}</style>
<style>*,*::before,*::after{box-sizing:border-box;}body{margin:0;overflow:auto;width:100%;min-height:100%;height:fit-content;}
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

    startInspect((elId, el) => {
      dispatch({ type: "SELECT_ELEMENT", id: elId, source: "inspect" });
      const win = el.ownerDocument.defaultView;
      if (!win) return;
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
      // Do NOT stop inspect here — keep inspect mode active
    });
    setInspectingState(true);
  }, [inspecting, variant.id, dispatch]);

  const applyPreset = useCallback((preset: typeof VARIANT_PRESETS[number]) => {
    setDims((d) => ({ ...d, w: preset.width }));
    updateNode(id, { style: { width: preset.width, height: dims.h } });
  }, [id, dims.h, updateNode]);

  const statusColor =
    variant.status === "pushed" ? "var(--primary)" :
    variant.status === "finalized" ? "var(--status-success)" :
    variant.status === "sent" ? "var(--text-primary-light)" : "var(--surface-2)";

  const statusLabel =
    variant.status === "pushed" ? "Pushed" :
    variant.status === "finalized" ? "Finalized" :
    variant.status === "sent" ? "Sent" : "Draft";

  const canPushToMain = variant.status === "finalized" && !!variant.sourceElementId;
  const hasActiveSelection = !!state.selectedElementId && state.selectionSource === "inspect" && state.activeVariantId === variant.id;
  const iframeInteractive = inspecting || hasActiveSelection;

  const borderColor = selected ? "var(--primary)" : variant.status === "finalized" ? "var(--status-success)" : undefined;

  return (
    <div
      data-Zeros="variant-node"
      data-variant-id={variant.id}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      {/* ── NodeResizer — invisible handles, edge-drag only ── */}
      <NodeResizer
        minWidth={MIN_W}
        minHeight={MIN_H}
        maxWidth={MAX_W}
        maxHeight={MAX_H}
        isVisible={true}
        lineStyle={{ borderWidth: 0, borderColor: "transparent" }}
        handleStyle={{ width: 0, height: 0, opacity: 0, background: "transparent", border: "none" }}
        onResizeStart={() => setIsResizing(true)}
        onResize={(_, p) => setDims({ w: Math.round(p.width), h: Math.round(p.height) })}
        onResizeEnd={() => setIsResizing(false)}
      />

      {/* ── Chrome bar — floats above the node bounds ── */}
      <div
        className="oc-variant-header"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "100%",
          marginBottom: 8,
          height: CHROME_H,
          ...(borderColor ? { borderColor } : {}),
        }}
      >
        {/* Left: name + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
          {editing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
          ) : (
            <span
              className="oc-variant-name"
              onDoubleClick={() => setEditing(true)}
              style={{ fontSize: "var(--text-10)", cursor: "text" }}
              title="Double-click to rename"
            >
              {variant.name}
            </span>
          )}
          <span
            className="oc-variant-status"
            style={{
              padding: "1px 5px",
              borderRadius: 4,
              background: `color-mix(in srgb, ${statusColor} 10%, transparent)`,
              color: statusColor,
              fontSize: 8,
              fontWeight: 500,
              width: "auto",
              height: "auto",
            }}
          >
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
                className={`oc-source-preset ${isActive ? "is-active" : ""}`}
                onClick={(e) => { e.stopPropagation(); applyPreset(p); }}
                title={`${p.label} (${p.width}px)`}
                style={{ width: 22, height: 22, padding: 0 }}
              >
                <Icon style={{ width: 11, height: 11 }} />
              </button>
            );
          })}
          <span
            style={{
              fontSize: 9,
              color: isResizing ? "var(--text-primary)" : "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              padding: "1px 4px",
              background: isResizing ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent",
              borderRadius: 3,
              transition: "all 0.15s",
            }}
          >
            {dims.w}&times;{dims.h}
          </span>
        </div>

        {/* Right: actions */}
        <div className="oc-variant-actions">
          <VBtn onClick={toggleVariantInspect} active={inspecting} title="Inspect">
            <Crosshair style={{ width: 10, height: 10 }} />
          </VBtn>
          <VBtn onClick={() => onFork(variant.id)} title="Fork">
            <GitFork style={{ width: 10, height: 10 }} />
          </VBtn>
          <VBtn onClick={handleCopyHtml} title="Copy HTML">
            {copied ? <Check style={{ width: 10, height: 10, color: "var(--status-success)" }} /> : <Copy style={{ width: 10, height: 10 }} />}
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
              <ArrowUpToLine style={{ width: 10, height: 10, color: "var(--text-primary)" }} />
            </VBtn>
          )}
          <VBtn onClick={() => onDelete(variant.id)} danger title="Delete">
            <Trash2 style={{ width: 10, height: 10 }} />
          </VBtn>
        </div>
      </div>

      {/* ── Preview — fills the entire node area ── */}
      <div
        className={`oc-variant-card ${selected ? "is-selected" : ""}`}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          background: "var(--surface-inverted)",
          borderRadius: 0,
          border: `${selected ? 2.5 : 1}px solid ${selected ? "var(--primary)" : "var(--border-subtle)"}`,
          boxShadow: selected
            ? "0 0 0 1px var(--primary), var(--shadow-md)"
            : "var(--shadow-md)",
        }}
      >
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
          <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", zIndex: "var(--z-panel)", pointerEvents: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-1) var(--space-4)",
              borderRadius: "var(--radius-sm)", background: "var(--primary)", color: "var(--primary-foreground)", fontSize: "var(--text-10)",
              boxShadow: "var(--shadow-md)",
            }}>
              <Crosshair style={{ width: 10, height: 10 }} />
              Click to inspect
            </div>
          </div>
        )}
        {isResizing && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: "var(--z-panel)", pointerEvents: "none",
            background: "var(--backdrop-weak)",
          }}>
            <div style={{
              padding: "var(--space-3) var(--space-6)", borderRadius: "var(--radius-sm)", background: "var(--surface-0)",
              border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-lg)",
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
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
  const cls = [
    "oc-variant-action-btn",
    active ? "is-active" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      className={cls}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        ...(active ? { background: "var(--primary)", color: "var(--text-on-primary)", border: "1px solid var(--primary)" } : {}),
        ...(danger && !active ? { color: "var(--status-critical)" } : {}),
        ...(accent && !active ? { color: "var(--status-success)" } : {}),
      }}
    >
      {children}
    </button>
  );
}
