// ──────────────────────────────────────────────────────────
// Shared Variant Node — Used by both browser and VS Code
// ──────────────────────────────────────────────────────────
//
// Pure presentational variant card with:
//   - Resizable iframe preview (srcDoc)
//   - Chrome bar (name editing, status badge, dimensions)
//   - Action buttons (fork, finalize, send, delete, etc.)
//   - Expandable feedback panel
//   - Expandable code view
//   - NodeResizer + Handles for ReactFlow
//
// NO store/context, NO dom-inspector. All behavior via props.

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Handle,
  Position,
  NodeResizer,
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
  Laptop,
  Tablet,
  Smartphone,
} from "lucide-react";
import {
  type CanvasVariantData,
  type VariantNodeCallbacks,
  STATUS_COLORS,
  STATUS_LABELS,
} from "./canvas-types";
import { buildSrcDoc } from "./build-srcdoc";
import { SharedFeedbackList } from "./SharedFeedbackList";

export type SharedVariantNodeData = {
  variant: CanvasVariantData;
  callbacks: VariantNodeCallbacks;
  // Browser-only: whether this variant is the active one and whether inspect mode is on
  isActive?: boolean;
  isInspecting?: boolean;
  hasActiveSelection?: boolean;
  // Extra info
  routeLabel?: string;
};

const VARIANT_PRESETS = [
  { label: "Wide", width: 768, Icon: Laptop },
  { label: "Tablet", width: 560, Icon: Tablet },
  { label: "Mobile", width: 375, Icon: Smartphone },
];

const MIN_W = 280;
const MIN_H = 240;
const MAX_W = 1440;
const MAX_H = 1200;

export function SharedVariantNode({ id, data, selected }: NodeProps) {
  const {
    variant, callbacks, isActive, isInspecting, hasActiveSelection, routeLabel,
  } = data as SharedVariantNodeData;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(variant.name);
  const [copied, setCopied] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const initW = variant.canvasSize?.width || variant.sourceViewportWidth || 560;
  const initH = variant.canvasSize?.height || Math.round(initW * (420 / 560));
  const [dims, setDims] = useState({ w: initW, h: initH });
  const [isResizing, setIsResizing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setName(variant.name), [variant.name]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const srcDoc = useMemo(
    () => buildSrcDoc(variant.html, variant.css),
    [variant.html, variant.css]
  );

  const commitName = useCallback(() => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== variant.name) {
      callbacks.onRename(variant.id, trimmed);
    } else {
      setName(variant.name);
    }
  }, [name, variant.name, variant.id, callbacks]);

  const handleCopyHtml = useCallback(() => {
    if (callbacks.onCopyHtml) {
      callbacks.onCopyHtml(variant.html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [variant.html, callbacks]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    callbacks.onResize?.(variant.id, dims.w, dims.h);
  }, [variant.id, dims, callbacks]);

  const status = variant.status || "draft";
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.draft;
  const statusLabel = STATUS_LABELS[status] || "Draft";
  const feedbackItems = variant.feedback || [];
  const feedbackCount = feedbackItems.length;
  const pendingFeedback = feedbackItems.filter((f) => !f.resolved).length;
  const canPushToMain = status === "finalized" && !!variant.sourceElementId;
  const iframeInteractive = (isInspecting || hasActiveSelection) && !isResizing;

  return (
    <div
      data-variant-id={variant.id}
      style={{
        width: "100%",
        height: "100%",
        background: "#0a0a0a",
        border: `1px solid ${selected ? "#0070f3" : status === "finalized" ? "#50e3c240" : "#1a1a1a"}`,
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', -apple-system, sans-serif",
        boxShadow: selected
          ? "0 0 0 1px #0070f3, 0 4px 20px rgba(0,112,243,0.1)"
          : "0 4px 20px rgba(0,0,0,0.25)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <NodeResizer
        minWidth={MIN_W} minHeight={MIN_H}
        maxWidth={MAX_W} maxHeight={MAX_H}
        isVisible={selected || false}
        lineStyle={{ borderWidth: 1, borderColor: "#0070f3" }}
        handleStyle={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#0070f3", border: "2px solid #0a0a0a",
        }}
        onResizeStart={() => setIsResizing(true)}
        onResize={(_: unknown, p: { width: number; height: number }) =>
          setDims({ w: Math.round(p.width), h: Math.round(p.height) })
        }
        onResizeEnd={handleResizeEnd}
      />

      <Handle type="target" position={Position.Left} style={{ background: "#0070f3", width: 8, height: 8, border: "2px solid #0a0a0a" }} />
      <Handle type="source" position={Position.Right} style={{ background: "#0070f3", width: 8, height: 8, border: "2px solid #0a0a0a" }} />

      {/* Chrome bar */}
      <div style={{
        height: 34, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 8px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a",
        flexShrink: 0, gap: 4,
      }}>
        {/* Left: name + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") { setName(variant.name); setEditing(false); }
              }}
              style={{
                flex: 1, padding: "2px 6px", background: "#111",
                border: "1px solid #333", borderRadius: 4, color: "#ededed",
                fontSize: 10, fontFamily: "inherit", outline: "none",
              }}
            />
          ) : (
            <span
              onDoubleClick={() => setEditing(true)}
              style={{
                fontSize: 10, color: "#ededed", cursor: "text",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
              title="Double-click to rename"
            >
              {variant.name}
            </span>
          )}
          <span style={{
            padding: "1px 5px", borderRadius: 4,
            background: statusColor + "18", color: statusColor,
            fontSize: 8, fontWeight: 500, flexShrink: 0,
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Center: breakpoint presets + dims */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {VARIANT_PRESETS.map((p) => {
            const isPresetActive = Math.abs(dims.w - p.width) < 20;
            return (
              <button
                key={p.label}
                onClick={(e) => {
                  e.stopPropagation();
                  setDims((d) => ({ ...d, w: p.width }));
                  callbacks.onResize?.(variant.id, p.width, dims.h);
                }}
                title={`${p.label} (${p.width}px)`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: 5,
                  border: `1px solid ${isPresetActive ? "#0070f360" : "transparent"}`,
                  background: isPresetActive ? "#0070f315" : "transparent",
                  color: isPresetActive ? "#0070f3" : "#555",
                  cursor: "pointer", padding: 0, fontFamily: "inherit",
                }}
              >
                <p.Icon style={{ width: 11, height: 11 }} />
              </button>
            );
          })}
          <span style={{
            fontSize: 9, color: isResizing ? "#0070f3" : "#555",
            fontFamily: "monospace", fontVariantNumeric: "tabular-nums",
            padding: "1px 4px", background: isResizing ? "#0070f315" : "transparent",
            borderRadius: 3,
          }}>
            {dims.w}×{dims.h}
          </span>
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {callbacks.onInspect && (
            <VBtn onClick={() => callbacks.onInspect!(variant.id)} active={isInspecting} title="Inspect">
              <Crosshair style={{ width: 10, height: 10 }} />
            </VBtn>
          )}
          {callbacks.onFork && (
            <VBtn onClick={() => callbacks.onFork!(variant.id)} title="Fork">
              <GitFork style={{ width: 10, height: 10 }} />
            </VBtn>
          )}
          {callbacks.onCopyHtml && (
            <VBtn onClick={handleCopyHtml} title="Copy HTML">
              {copied ? <Check style={{ width: 10, height: 10, color: "#50e3c2" }} /> : <Copy style={{ width: 10, height: 10 }} />}
            </VBtn>
          )}
          {feedbackCount > 0 && (
            <VBtn onClick={() => setShowFeedback(!showFeedback)} active={showFeedback} title="Feedback">
              <span style={{ fontSize: 9 }}>💬 {pendingFeedback || feedbackCount}</span>
            </VBtn>
          )}
          <VBtn onClick={() => setShowCode(!showCode)} active={showCode} title="Code">
            <span style={{ fontSize: 9 }}>{"</>"}</span>
          </VBtn>
          {status === "draft" && (
            <VBtn onClick={() => callbacks.onFinalize(variant.id)} accent title="Finalize">
              <CheckCircle2 style={{ width: 10, height: 10 }} />
            </VBtn>
          )}
          {status === "finalized" && callbacks.onSendToAgent && (
            <VBtn onClick={() => callbacks.onSendToAgent!(variant.id)} accent title="Send to Agent">
              <Send style={{ width: 10, height: 10 }} />
            </VBtn>
          )}
          {canPushToMain && callbacks.onPushToMain && (
            <VBtn onClick={() => callbacks.onPushToMain!(variant.id)} title="Push to Main">
              <ArrowUpToLine style={{ width: 10, height: 10, color: "#0070f3" }} />
            </VBtn>
          )}
          <VBtn onClick={() => callbacks.onDelete(variant.id)} danger title="Delete">
            <Trash2 style={{ width: 10, height: 10 }} />
          </VBtn>
        </div>
      </div>

      {/* Preview */}
      <div style={{
        flex: 1, position: "relative", overflow: "hidden", background: "#fff",
        minHeight: showFeedback || showCode ? 120 : undefined,
      }}>
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          sandbox="allow-same-origin"
          title={`Variant: ${variant.name}`}
          style={{
            width: "100%", height: "100%", border: "none", display: "block",
            pointerEvents: iframeInteractive ? "auto" : "none",
          }}
        />
        {isInspecting && (
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
                {dims.w} × {dims.h}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom info */}
      <div style={{
        height: 22, borderTop: "1px solid #1a1a1a", display: "flex",
        alignItems: "center", justifyContent: "space-between", padding: "0 8px",
        background: "#0a0a0a", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {routeLabel && <span style={{ fontSize: 9, color: "#555" }}>{routeLabel}</span>}
          {variant.sourceElementId && (
            <span style={{
              fontSize: 8, color: "#50e3c2", background: "#50e3c215",
              padding: "0 4px", borderRadius: 2,
            }}>
              component
            </span>
          )}
        </div>
        <span style={{ fontSize: 8, color: "#444" }}>
          {new Date(variant.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Expandable feedback */}
      {showFeedback && feedbackCount > 0 && (
        <div style={{
          borderTop: "1px solid #1a1a1a", maxHeight: 180, overflowY: "auto",
          background: "#0a0a0a",
        }}>
          <SharedFeedbackList
            feedback={feedbackItems}
            variantId={variant.id}
            onResolve={callbacks.onResolveFeedback}
            onDelete={callbacks.onDeleteFeedback}
          />
        </div>
      )}

      {/* Expandable code */}
      {showCode && (
        <div style={{
          borderTop: "1px solid #1a1a1a", maxHeight: 200, overflowY: "auto",
          padding: "6px 8px", background: "#111",
        }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: "#555", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>HTML</span>
          </div>
          <pre style={{
            fontSize: 10, lineHeight: 1.4, color: "#ccc", fontFamily: "monospace",
            whiteSpace: "pre-wrap", wordBreak: "break-all" as const, margin: 0,
          }}>
            {variant.html.slice(0, 2000)}{variant.html.length > 2000 ? "\n..." : ""}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Variant action button ─────────────────────────────────

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
        display: "flex", alignItems: "center", gap: 2,
        padding: "2px 4px", borderRadius: 4,
        border: active ? "1px solid #0070f3" : "1px solid transparent",
        background: active ? "#0070f3" : "transparent",
        color: active ? "#fff" : danger ? "#ff4444" : accent ? "#50e3c2" : "#666",
        cursor: "pointer", fontSize: 9, fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
