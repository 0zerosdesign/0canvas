// ──────────────────────────────────────────────────────────
// Page Node — Source page widget for the canvas
// ──────────────────────────────────────────────────────────
// Used in VS Code extension canvas. In the browser, the
// SourceNode (source-node.tsx) is used instead, which has
// a live iframe preview.

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CanvasPageData } from "./canvas-types";

export type PageNodeData = {
  page: CanvasPageData;
  framework?: string;
  variantCount: number;
};

export function PageNode({ data, selected }: NodeProps) {
  const { page, framework, variantCount } = data as PageNodeData;

  return (
    <div
      style={{
        width: 220,
        background: "#0a0a0a",
        border: `1px solid ${selected ? "#0070f3" : "#1a1a1a"}`,
        borderRadius: 10,
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, sans-serif",
        boxShadow: selected
          ? "0 0 0 1px #0070f3, 0 4px 20px rgba(0,112,243,0.15)"
          : "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "10px 12px 8px", borderBottom: "1px solid #1a1a1a",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0070f3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#ededed" }}>{page.name}</span>
      </div>

      {/* Info */}
      <div style={{ padding: "8px 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#555" }}>Route:</span>
          <span style={{
            fontSize: 10, color: "#0070f3", fontFamily: "monospace",
            background: "#0070f315", padding: "1px 6px", borderRadius: 3,
          }}>
            {page.route}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {framework && framework !== "unknown" && (
            <span style={{
              fontSize: 9, color: "#7928ca", textTransform: "capitalize",
              background: "#7928ca15", padding: "1px 6px", borderRadius: 3, fontWeight: 500,
            }}>
              {framework}
            </span>
          )}
          <span style={{
            fontSize: 9, color: "#50e3c2",
            background: "#50e3c215", padding: "1px 6px", borderRadius: 3,
            fontWeight: 500, marginLeft: "auto",
          }}>
            {variantCount} variant{variantCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{
        background: "#0070f3", width: 8, height: 8, border: "2px solid #0a0a0a",
      }} />
    </div>
  );
}
