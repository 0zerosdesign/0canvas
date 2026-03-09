// ──────────────────────────────────────────────────────────
// Shared Feedback List — Used by both browser and VS Code
// ──────────────────────────────────────────────────────────

import React from "react";
import type { CanvasFeedbackItem } from "./canvas-types";

interface Props {
  feedback: CanvasFeedbackItem[];
  variantId: string;
  onResolve?: (variantId: string, feedbackId: string) => void;
  onDelete?: (variantId: string, feedbackId: string) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ff4444",
  high: "#ff9800",
  medium: "#f5a623",
  low: "#0070f3",
  info: "#888",
  blocking: "#ff4444",
  important: "#ff9800",
  suggestion: "#0070f3",
};

export function SharedFeedbackList({ feedback, variantId, onResolve, onDelete }: Props) {
  if (feedback.length === 0) return null;

  return (
    <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
      {feedback.map((item) => {
        const severityColor = SEVERITY_COLORS[item.severity || "info"] || SEVERITY_COLORS.info;

        return (
          <div
            key={item.id}
            style={{
              padding: "6px 8px",
              background: "#111",
              borderRadius: 4,
              borderLeft: `3px solid ${item.resolved ? "#333" : severityColor}`,
              opacity: item.resolved ? 0.5 : 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
              {item.severity && (
                <span style={{
                  padding: "0 4px", borderRadius: 2, fontSize: 8, fontWeight: 500,
                  color: severityColor, background: severityColor + "18",
                }}>
                  {item.severity}
                </span>
              )}
              {item.elementId && (
                <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>
                  {item.elementId}
                </span>
              )}
              <span style={{ fontSize: 9, color: "#444", marginLeft: "auto" }}>
                {new Date(item.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p style={{
              fontSize: 11, color: "#ccc", lineHeight: 1.4, margin: 0,
              textDecoration: item.resolved ? "line-through" : "none",
            }}>
              {item.text}
            </p>
            {(onResolve || onDelete) && (
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {onResolve && !item.resolved && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onResolve(variantId, item.id); }}
                    style={{
                      fontSize: 9, padding: "1px 6px", borderRadius: 3, border: "none",
                      background: "transparent", color: "#50e3c2", cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    ✓ Resolve
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(variantId, item.id); }}
                    style={{
                      fontSize: 9, padding: "1px 6px", borderRadius: 3, border: "none",
                      background: "transparent", color: "#ff4444", cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
