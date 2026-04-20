// ──────────────────────────────────────────────────────────
// Inline AI Quick-Edit — Cmd+K floating panel
// ──────────────────────────────────────────────────────────
//
// Anchored to the selected element, the user types a
// natural-language instruction and presses Enter. The request is
// forwarded to Column 2's AI chat (Phase 2-B) — the chat panel
// owns streaming, diff preview, and accept/reject UI. The overlay
// just harvests the prompt and closes.
// ──────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useWorkspace, findElement } from "../store/store";
import { getElementById } from "../inspector";

export function InlineEdit() {
  const { state, dispatch } = useWorkspace();
  const [inputValue, setInputValue] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const elementId = state.selectedElementId;

  // ── Position the panel near the selected element ──────────
  useEffect(() => {
    if (!elementId) return;
    const el = getElementById(elementId) as HTMLElement | null;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const panelWidth = 360;
    const panelHeight = 52;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.bottom + gap;
    if (top + panelHeight > vh - 20) {
      top = rect.top - panelHeight - gap;
    }
    top = Math.max(12, Math.min(vh - panelHeight - 12, top));

    let left = rect.left + rect.width / 2 - panelWidth / 2;
    left = Math.max(12, Math.min(vw - panelWidth - 12, left));

    setPosition({ top, left });
  }, [elementId]);

  // ── Auto-focus input ──────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const close = useCallback(() => {
    dispatch({ type: "SHOW_INLINE_EDIT", show: false });
  }, [dispatch]);

  // ── Click outside ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handler, true);
    }, 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler, true);
    };
  }, [close]);

  // ── Keyboard ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [close]);

  // ── Submit: enqueue into Column 2 chat + close ─────────────
  const handleSubmit = useCallback(() => {
    const instruction = inputValue.trim();
    if (!instruction || !elementId) return;

    const elementNode = findElement(state.elements, elementId);
    if (!elementNode) return;

    const elementDesc = `<${elementNode.tag}>${
      elementNode.classes.length ? `.${elementNode.classes.join(".")}` : ""
    }`;
    const text = `${instruction}\n\n(applied to selected ${elementDesc})`;

    dispatch({
      type: "ENQUEUE_CHAT_SUBMISSION",
      submission: {
        id: `inline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        source: "inline-edit",
      },
    });
    close();
  }, [inputValue, elementId, state.elements, dispatch, close]);

  if (!elementId) return null;

  return (
    <div
      ref={panelRef}
      className="oc-inline-edit"
      data-0canvas="inline-edit"
      style={{ position: "fixed", top: position.top, left: position.left }}
    >
      <div className="oc-inline-edit-input-row">
        <div className="oc-inline-edit-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a4 4 0 0 0-4 4c0 1.2.5 2.3 1.4 3.1L5 14.5 9.5 19l5.4-4.4c.8.9 1.9 1.4 3.1 1.4a4 4 0 0 0 0-8" />
            <path d="m15 5 3 3" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          className="oc-inline-edit-input"
          placeholder="Ask AI to change this element..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
            e.stopPropagation();
          }}
        />
        <kbd className="oc-inline-edit-kbd">Return</kbd>
      </div>
    </div>
  );
}
