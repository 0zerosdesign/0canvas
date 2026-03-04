// ──────────────────────────────────────────────────────────
// Element Chat — Floating feedback panel for inspected elements
// Appears as a fixed panel when "+ Feedback" is clicked on
// the selection overlay inside the iframe.
// ──────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquarePlus, Send, X, Bug, Pencil, HelpCircle, ThumbsUp } from "lucide-react";
import { useWorkspace, FeedbackIntent, FeedbackSeverity } from "../store";
import { getElementById } from "./dom-inspector";
import { saveFeedbackItem } from "./variant-db";

const INTENTS: { value: FeedbackIntent; label: string; icon: React.ReactNode }[] = [
  { value: "fix", label: "Fix", icon: <Bug style={{ width: 12, height: 12 }} /> },
  { value: "change", label: "Change", icon: <Pencil style={{ width: 12, height: 12 }} /> },
  { value: "question", label: "Question", icon: <HelpCircle style={{ width: 12, height: 12 }} /> },
  { value: "approve", label: "Approve", icon: <ThumbsUp style={{ width: 12, height: 12 }} /> },
];

const SEVERITIES: { value: FeedbackSeverity; label: string; color: string }[] = [
  { value: "blocking", label: "Blocking", color: "#ff4444" },
  { value: "important", label: "Important", color: "#ff9500" },
  { value: "suggestion", label: "Suggestion", color: "#0070f3" },
];

export function ElementChat() {
  const { state, dispatch } = useWorkspace();
  const [comment, setComment] = useState("");
  const [intent, setIntent] = useState<FeedbackIntent>("fix");
  const [severity, setSeverity] = useState<FeedbackSeverity>("important");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedId = state.selectedElementId;
  const isInspectSelection = state.selectionSource === "inspect";
  const activeVariantId = state.activeVariantId || "main";
  const isOpen = state.feedbackPanelOpen && !!selectedId && isInspectSelection;

  const existingCount = selectedId
    ? state.feedbackItems.filter((f) => f.elementId === selectedId && f.variantId === activeVariantId && f.status === "pending").length
    : 0;

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    dispatch({ type: "SET_FEEDBACK_PANEL_OPEN", open: false });
  }, [dispatch]);

  const handleSubmit = useCallback(() => {
    if (!comment.trim() || !selectedId) return;

    const el = getElementById(selectedId);
    const rect = el?.getBoundingClientRect();

    const feedbackItem = {
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      variantId: activeVariantId,
      elementId: selectedId,
      elementSelector: el ? buildSelectorPath(el) : selectedId,
      elementTag: el?.tagName.toLowerCase() || "unknown",
      elementClasses: el ? Array.from(el.classList) : [],
      comment: comment.trim(),
      intent,
      severity,
      status: "pending" as const,
      timestamp: Date.now(),
      boundingBox: rect
        ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
        : undefined,
    };

    dispatch({ type: "ADD_FEEDBACK", item: feedbackItem });
    saveFeedbackItem(feedbackItem).catch(console.warn);

    setComment("");
  }, [comment, selectedId, intent, severity, activeVariantId, dispatch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      handleClose();
    }
  };

  if (!isOpen) return null;

  const el = getElementById(selectedId!);
  const elTag = el?.tagName.toLowerCase() || "element";
  const elClass = el ? Array.from(el.classList).slice(0, 2).map(c => `.${c}`).join("") : "";

  return (
    <div
      data-designdead="element-chat"
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        width: 340,
        zIndex: 2147483647,
        fontFamily: "'Geist Sans', 'Inter', system-ui, sans-serif",
        fontSize: 12,
        animation: "dd-slide-up 0.2s ease-out",
      }}
    >
      <style>{`
        @keyframes dd-slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          background: "#0a0a0a",
          border: "1px solid #1a1a1a",
          borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid #1a1a1a",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageSquarePlus style={{ width: 14, height: 14, color: "#0070f3" }} />
            <span style={{ color: "#ededed", fontSize: 12, fontWeight: 500 }}>Add Feedback</span>
            {existingCount > 0 && (
              <span
                style={{
                  background: "#0070f3",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "1px 7px",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {existingCount}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              borderRadius: 4,
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Element context badge */}
        <div style={{ padding: "8px 14px 4px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 4,
              background: "#111",
              border: "1px solid #1e1e1e",
              fontSize: 10,
              color: "#888",
              fontFamily: "'SF Mono', 'Fira Code', monospace",
            }}
          >
            <span style={{ color: "#0070f3" }}>&lt;{elTag}&gt;</span>
            {elClass && <span style={{ color: "#555" }}>{elClass}</span>}
            {activeVariantId !== "main" && (
              <span style={{ color: "#7928ca", marginLeft: 4 }}>variant</span>
            )}
          </div>
        </div>

        {/* Intent picker */}
        <div style={{ display: "flex", gap: 4, padding: "8px 14px 4px" }}>
          {INTENTS.map((i) => (
            <button
              key={i.value}
              onClick={() => setIntent(i.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 6,
                border: `1px solid ${intent === i.value ? "#0070f3" : "#1a1a1a"}`,
                background: intent === i.value ? "rgba(0,112,243,0.1)" : "transparent",
                color: intent === i.value ? "#0070f3" : "#888",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "inherit",
                transition: "all 0.1s ease",
              }}
            >
              {i.icon}
              {i.label}
            </button>
          ))}
        </div>

        {/* Severity picker */}
        <div style={{ display: "flex", gap: 4, padding: "4px 14px 8px" }}>
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSeverity(s.value)}
              style={{
                padding: "3px 10px",
                borderRadius: 6,
                border: `1px solid ${severity === s.value ? s.color : "#1a1a1a"}`,
                background: severity === s.value ? s.color + "18" : "transparent",
                color: severity === s.value ? s.color : "#666",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "inherit",
                transition: "all 0.1s ease",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Comment input */}
        <div style={{ padding: "0 14px 10px" }}>
          <textarea
            ref={inputRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the change you want..."
            style={{
              width: "100%",
              minHeight: 64,
              maxHeight: 140,
              padding: "10px 12px",
              background: "#111111",
              border: "1px solid #1e1e1e",
              borderRadius: 8,
              color: "#ededed",
              fontSize: 12,
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
              lineHeight: "1.5",
              boxSizing: "border-box",
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "#333"; }}
            onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "#1e1e1e"; }}
          />
        </div>

        {/* Submit */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px 12px",
          }}
        >
          <span style={{ fontSize: 10, color: "#444" }}>
            {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+Enter to add \u00b7 Esc to close
          </span>
          <button
            onClick={handleSubmit}
            disabled={!comment.trim()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: comment.trim() ? "#0070f3" : "#222",
              color: comment.trim() ? "#fff" : "#555",
              cursor: comment.trim() ? "pointer" : "default",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}
          >
            <Send style={{ width: 12, height: 12 }} />
            Add to Waitlist
          </button>
        </div>
      </div>
    </div>
  );
}

function buildSelectorPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;
  while (current && current !== document.body && depth < 5) {
    const tag = current.tagName.toLowerCase();
    const cls = Array.from(current.classList).slice(0, 2).map((c) => `.${c}`).join("");
    parts.unshift(cls ? `${tag}${cls}` : tag);
    current = current.parentElement;
    depth++;
  }
  return parts.join(" > ");
}
