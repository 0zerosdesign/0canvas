// ──────────────────────────────────────────────────────────
// Element Chat — Floating feedback popup per inspected element
// ──────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquarePlus, Send, X, Bug, Pencil, HelpCircle, ThumbsUp } from "lucide-react";
import { useWorkspace, FeedbackIntent, FeedbackSeverity } from "../store";
import { getElementById } from "./dom-inspector";

const INTENTS: { value: FeedbackIntent; label: string; icon: React.ReactNode }[] = [
  { value: "fix", label: "Fix", icon: <Bug style={{ width: 11, height: 11 }} /> },
  { value: "change", label: "Change", icon: <Pencil style={{ width: 11, height: 11 }} /> },
  { value: "question", label: "Question", icon: <HelpCircle style={{ width: 11, height: 11 }} /> },
  { value: "approve", label: "Approve", icon: <ThumbsUp style={{ width: 11, height: 11 }} /> },
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
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedId = state.selectedElementId;

  const existingCount = selectedId
    ? state.feedbackItems.filter((f) => f.elementId === selectedId && f.status === "pending").length
    : 0;

  // Position the chat near the selected element's highlight
  useEffect(() => {
    if (!selectedId) {
      setPosition(null);
      return;
    }

    const el = getElementById(selectedId);
    if (!el) {
      setPosition(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const panelW = 320;
    const panelH = 260;

    let top = rect.bottom + 8;
    let left = rect.left;

    if (top + panelH > viewH) top = Math.max(8, rect.top - panelH - 8);
    if (left + panelW > viewW) left = Math.max(8, viewW - panelW - 8);
    if (left < 8) left = 8;

    setPosition({ top, left });
  }, [selectedId]);

  useEffect(() => {
    if (position && inputRef.current) {
      inputRef.current.focus();
    }
  }, [position]);

  const handleSubmit = useCallback(() => {
    if (!comment.trim() || !selectedId) return;

    const el = getElementById(selectedId);
    const rect = el?.getBoundingClientRect();

    dispatch({
      type: "ADD_FEEDBACK",
      item: {
        id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        elementId: selectedId,
        elementSelector: el ? buildSelectorPath(el) : selectedId,
        elementTag: el?.tagName.toLowerCase() || "unknown",
        elementClasses: el ? Array.from(el.classList) : [],
        comment: comment.trim(),
        intent,
        severity,
        status: "pending",
        timestamp: Date.now(),
        boundingBox: rect
          ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
          : undefined,
      },
    });

    setComment("");
  }, [comment, selectedId, intent, severity, dispatch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!selectedId || !position) return null;

  return (
    <div
      ref={panelRef}
      data-designdead="element-chat"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: 320,
        zIndex: 2147483647,
        fontFamily: "'Geist Sans', 'Inter', system-ui, sans-serif",
        fontSize: 12,
      }}
    >
      <div
        style={{
          background: "#0a0a0a",
          border: "1px solid #1a1a1a",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: "1px solid #1a1a1a",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ededed", fontSize: 11 }}>
            <MessageSquarePlus style={{ width: 13, height: 13, color: "#0070f3" }} />
            <span>Add Feedback</span>
            {existingCount > 0 && (
              <span
                style={{
                  background: "#0070f3",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "0 5px",
                  fontSize: 9,
                  fontWeight: 600,
                }}
              >
                {existingCount}
              </span>
            )}
          </div>
          <button
            onClick={() => dispatch({ type: "SELECT_ELEMENT", id: null })}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              cursor: "pointer",
              padding: 2,
              display: "flex",
            }}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* Intent picker */}
        <div style={{ display: "flex", gap: 4, padding: "8px 12px 4px" }}>
          {INTENTS.map((i) => (
            <button
              key={i.value}
              onClick={() => setIntent(i.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                padding: "3px 8px",
                borderRadius: 5,
                border: `1px solid ${intent === i.value ? "#0070f3" : "#1a1a1a"}`,
                background: intent === i.value ? "#0070f3" + "18" : "transparent",
                color: intent === i.value ? "#0070f3" : "#888",
                cursor: "pointer",
                fontSize: 10,
                fontFamily: "inherit",
              }}
            >
              {i.icon}
              {i.label}
            </button>
          ))}
        </div>

        {/* Severity picker */}
        <div style={{ display: "flex", gap: 4, padding: "4px 12px 8px" }}>
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSeverity(s.value)}
              style={{
                padding: "2px 8px",
                borderRadius: 5,
                border: `1px solid ${severity === s.value ? s.color : "#1a1a1a"}`,
                background: severity === s.value ? s.color + "18" : "transparent",
                color: severity === s.value ? s.color : "#666",
                cursor: "pointer",
                fontSize: 10,
                fontFamily: "inherit",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Comment input */}
        <div style={{ padding: "0 12px 8px" }}>
          <textarea
            ref={inputRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the change you want..."
            style={{
              width: "100%",
              minHeight: 56,
              maxHeight: 120,
              padding: "8px 10px",
              background: "#111111",
              border: "1px solid #1a1a1a",
              borderRadius: 6,
              color: "#ededed",
              fontSize: 11,
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
              lineHeight: "1.5",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Submit */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px 10px",
          }}
        >
          <span style={{ fontSize: 9, color: "#444" }}>
            {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to add
          </span>
          <button
            onClick={handleSubmit}
            disabled={!comment.trim()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 12px",
              borderRadius: 6,
              border: "none",
              background: comment.trim() ? "#0070f3" : "#222",
              color: comment.trim() ? "#fff" : "#555",
              cursor: comment.trim() ? "pointer" : "default",
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "inherit",
            }}
          >
            <Send style={{ width: 11, height: 11 }} />
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
