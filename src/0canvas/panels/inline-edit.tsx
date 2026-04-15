// ──────────────────────────────────────────────────────────
// Inline AI Quick-Edit — Cmd+K floating panel
// ──────────────────────────────────────────────────────────
//
// Appears next to the selected element. The user types a
// natural-language style instruction, AI streams CSS changes,
// and each property is applied LIVE as it arrives.
//
// Accept (Enter) = keep changes. Reject (Escape) = revert.
// ──────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useWorkspace, findElement } from "../store/store";
import { getElementById, applyStyle } from "../inspector";
import { streamChat, isAiConfigured, type OpenAIMessage } from "../lib/openai";

type Phase = "input" | "streaming" | "done" | "error";

type AppliedChange = {
  property: string;
  oldValue: string;
  newValue: string;
};

export function InlineEdit() {
  const { state, dispatch } = useWorkspace();
  const [phase, setPhase] = useState<Phase>("input");
  const [inputValue, setInputValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [appliedChanges, setAppliedChanges] = useState<AppliedChange[]>([]);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const changesRef = useRef<AppliedChange[]>([]);

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

    // Prefer below the element, fall back to above
    let top = rect.bottom + gap;
    if (top + panelHeight > vh - 20) {
      top = rect.top - panelHeight - gap;
    }
    // Clamp to viewport
    top = Math.max(12, Math.min(vh - panelHeight - 12, top));

    // Center horizontally on the element, clamped to viewport
    let left = rect.left + rect.width / 2 - panelWidth / 2;
    left = Math.max(12, Math.min(vw - panelWidth - 12, left));

    setPosition({ top, left });
  }, [elementId]);

  // ── Auto-focus input ──────────────────────────────────────
  useEffect(() => {
    if (phase === "input") {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // ── Close handler ─────────────────────────────────────────
  const close = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "SHOW_INLINE_EDIT", show: false });
  }, [dispatch]);

  // ── Accept changes (keep applied styles) ──────────────────
  const accept = useCallback(() => {
    // Sync applied styles back to the store
    for (const change of changesRef.current) {
      if (elementId) {
        dispatch({
          type: "UPDATE_STYLE",
          elementId,
          property: change.property,
          value: change.newValue,
        });
      }
    }
    close();
  }, [elementId, dispatch, close]);

  // ── Reject changes (revert to originals) ──────────────────
  const reject = useCallback(() => {
    if (elementId) {
      // Revert in reverse order to handle any dependencies
      for (let i = changesRef.current.length - 1; i >= 0; i--) {
        const change = changesRef.current[i];
        applyStyle(elementId, change.property, change.oldValue);
      }
    }
    close();
  }, [elementId, close]);

  // ── Click outside ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        if (phase === "done") {
          accept();
        } else if (phase === "input" || phase === "error") {
          close();
        }
        // During streaming, ignore outside clicks
      }
    };
    // Delay attaching to avoid immediate trigger from the Cmd+K click
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handler, true);
    }, 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler, true);
    };
  }, [phase, accept, close]);

  // ── Keyboard handler ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (phase === "done" || phase === "streaming") {
          reject();
        } else {
          close();
        }
      }
      if (e.key === "Enter" && phase === "done") {
        e.preventDefault();
        accept();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [phase, accept, reject, close]);

  // ── Submit handler ────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const instruction = inputValue.trim();
    if (!instruction || !elementId) return;

    const aiSettings = state.aiSettings;
    if (!isAiConfigured(aiSettings)) {
      setErrorMessage("AI not configured. Set it in Settings → AI Settings.");
      setPhase("error");
      return;
    }

    const elementNode = findElement(state.elements, elementId);
    if (!elementNode) return;

    setPhase("streaming");
    setAppliedChanges([]);
    changesRef.current = [];

    const abort = new AbortController();
    abortRef.current = abort;

    const styleLines = Object.entries(elementNode.styles)
      .map(([k, v]) => `  ${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
      .join("\n");

    const messages: OpenAIMessage[] = [
      {
        role: "system",
        content: `You are a CSS expert inside a visual design tool called 0canvas.
The user will describe a visual change they want on a selected HTML element.
You MUST respond ONLY with a CSS code block containing property: value pairs.
Do NOT include selectors or curly braces — just the properties.
Do NOT explain or add any text outside the code block.

Example response:
\`\`\`css
border-radius: 12px;
background-color: #3B82F6;
\`\`\`

Rules:
- Only output CSS properties that directly address the user's request
- Use standard CSS property names (kebab-case)
- Use concrete values (px, rem, hex colors, etc.)
- Keep it minimal — only the properties needed for the change
- Always wrap in a css code block`,
      },
      {
        role: "user",
        content: `Element: <${elementNode.tag}> with classes [${elementNode.classes.join(", ")}]
Current computed styles:
${styleLines}

Change requested: "${instruction}"`,
      },
    ];

    try {
      let accumulated = "";
      let lastParsedIndex = 0;
      let insideCodeBlock = false;

      for await (const chunk of streamChat({ settings: aiSettings, messages, signal: abort.signal })) {
        accumulated += chunk;

        // Parse CSS properties as they stream in
        let searchFrom = lastParsedIndex;
        while (searchFrom < accumulated.length) {
          const nextNewline = accumulated.indexOf("\n", searchFrom);
          if (nextNewline === -1) break;

          const line = accumulated.slice(searchFrom, nextNewline).trim();
          searchFrom = nextNewline + 1;

          if (line.startsWith("```")) {
            insideCodeBlock = !insideCodeBlock;
            continue;
          }

          if (!insideCodeBlock) continue;

          const match = line.match(/^([a-z][a-z-]*)\s*:\s*(.+?)\s*;?\s*$/i);
          if (match) {
            const property = match[1].toLowerCase();
            const value = match[2].trim().replace(/;$/, "");
            if (property && value) {
              const oldValue = applyStyle(elementId, property, value) || "";
              const change: AppliedChange = { property, oldValue, newValue: value };
              changesRef.current = [...changesRef.current, change];
              setAppliedChanges((prev) => [...prev, change]);
            }
          }
        }
        lastParsedIndex = searchFrom;
      }

      setPhase("done");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setPhase("done");
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : "Streaming failed");
      setPhase("error");
    }
  }, [inputValue, elementId, state.elements, state.aiSettings]);

  // ── Don't render if no element selected ───────────────────
  if (!elementId) return null;

  return (
    <div
      ref={panelRef}
      className="oc-inline-edit"
      data-0canvas="inline-edit"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
      }}
    >
      {/* Main input phase */}
      {phase === "input" && (
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
              // Escape handled globally above
              e.stopPropagation();
            }}
          />
          <kbd className="oc-inline-edit-kbd">Return</kbd>
        </div>
      )}

      {/* Streaming phase */}
      {phase === "streaming" && (
        <div className="oc-inline-edit-status">
          <div className="oc-inline-edit-spinner" />
          <span className="oc-inline-edit-status-text">
            Applying changes{appliedChanges.length > 0 ? ` (${appliedChanges.length})` : "..."}
          </span>
        </div>
      )}

      {/* Done phase */}
      {phase === "done" && (
        <div className="oc-inline-edit-result">
          <div className="oc-inline-edit-result-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color--status--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Applied {appliedChanges.length} change{appliedChanges.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="oc-inline-edit-actions">
            <button className="oc-inline-edit-accept" onClick={accept}>
              Accept
              <kbd className="oc-inline-edit-action-kbd">Enter</kbd>
            </button>
            <button className="oc-inline-edit-reject" onClick={reject}>
              Reject
              <kbd className="oc-inline-edit-action-kbd">Esc</kbd>
            </button>
          </div>
        </div>
      )}

      {/* Error phase */}
      {phase === "error" && (
        <div className="oc-inline-edit-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color--status--critical)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span className="oc-inline-edit-error-text">{errorMessage}</span>
          <button className="oc-inline-edit-retry" onClick={() => { setPhase("input"); setErrorMessage(""); }}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
