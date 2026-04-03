// ──────────────────────────────────────────────────────────
// Element Chat — Floating feedback panel for inspected elements
// Appears as a fixed panel when "+ Feedback" is clicked on
// the selection overlay inside the iframe.
// ──────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquarePlus, Send, X, Bug, Pencil, HelpCircle, ThumbsUp } from "lucide-react";
import { useWorkspace, FeedbackIntent, FeedbackSeverity } from "../store/store";
import { getElementById } from "../inspector/dom-inspector";
import { saveFeedbackItem } from "../db/variant-db";

const INTENTS: { value: FeedbackIntent; label: string; icon: React.ReactNode }[] = [
  { value: "fix", label: "Fix", icon: <Bug size={12} /> },
  { value: "change", label: "Change", icon: <Pencil size={12} /> },
  { value: "question", label: "Question", icon: <HelpCircle size={12} /> },
  { value: "approve", label: "Approve", icon: <ThumbsUp size={12} /> },
];

const SEVERITIES: { value: FeedbackSeverity; label: string }[] = [
  { value: "blocking", label: "Blocking" },
  { value: "important", label: "Important" },
  { value: "suggestion", label: "Suggestion" },
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
      data-0canvas="element-chat"
      className="oc-chat-panel"
      style={{ bottom: 16, right: 16 }}
    >
      <div>
        {/* Header */}
        <div className="oc-chat-header">
          <div className="oc-chat-header-left">
            <MessageSquarePlus className="oc-chat-header-icon" />
            <span className="oc-chat-header-title">Add Feedback</span>
            {existingCount > 0 && (
              <span className="oc-chat-badge">{existingCount}</span>
            )}
          </div>
          <button onClick={handleClose} className="oc-panel-btn">
            <X size={14} />
          </button>
        </div>

        {/* Element context badge */}
        <div className="oc-chat-context-row">
          <div className="oc-chat-context">
            <span className="oc-chat-context-tag">&lt;{elTag}&gt;</span>
            {elClass && <span className="oc-chat-context-class">{elClass}</span>}
            {activeVariantId !== "main" && (
              <span className="oc-chat-context-variant">variant</span>
            )}
          </div>
        </div>

        {/* Intent picker */}
        <div className="oc-chat-row">
          {INTENTS.map((i) => (
            <button
              key={i.value}
              onClick={() => setIntent(i.value)}
              className={`oc-chat-intent-btn${intent === i.value ? ` is-active intent-${i.value}` : ""}`}
            >
              {i.icon}
              {i.label}
            </button>
          ))}
        </div>

        {/* Severity picker */}
        <div className="oc-chat-row-severity">
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSeverity(s.value)}
              className={`oc-chat-severity-btn${severity === s.value ? ` is-active severity-${s.value}` : ""}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Comment input */}
        <div className="oc-chat-body">
          <textarea
            ref={inputRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the change you want..."
            className="oc-chat-textarea"
          />
        </div>

        {/* Submit */}
        <div className="oc-chat-footer">
          <span className="oc-chat-hint">
            {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+Enter to add &middot; Esc to close
          </span>
          <button
            onClick={handleSubmit}
            disabled={!comment.trim()}
            className="oc-chat-submit"
          >
            <Send size={12} />
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
