// ──────────────────────────────────────────────────────────
// Tailwind Class Editor — Add/remove Tailwind utility classes
// ──────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from "react";
import { X, Plus, Search } from "lucide-react";
import { detectTailwindClasses, classifyTailwindClass, COMMON_TAILWIND_CLASSES, type TailwindCategory } from "../lib/tailwind";
import { useWorkspace } from "../store/store";
import { useBridge } from "../bridge/use-bridge";

interface TailwindEditorProps {
  elementId: string;
  selector: string;
  classes: string[];
}

const CATEGORY_LABELS: Record<TailwindCategory, string> = {
  layout: "Layout",
  spacing: "Spacing",
  sizing: "Sizing",
  typography: "Type",
  color: "Color",
  border: "Border",
  effects: "Effects",
  other: "Other",
};

const CATEGORY_COLORS: Record<TailwindCategory, string> = {
  layout: "#3b82f6",
  spacing: "#22c55e",
  sizing: "#a855f7",
  typography: "#f59e0b",
  color: "#ef4444",
  border: "#06b6d4",
  effects: "#8b5cf6",
  other: "#6b7280",
};

export function TailwindEditor({ elementId, selector, classes }: TailwindEditorProps) {
  const { dispatch } = useWorkspace();
  const bridge = useBridge();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { tailwind, other } = detectTailwindClasses(classes);

  // Group by category
  const grouped = new Map<TailwindCategory, string[]>();
  for (const cls of tailwind) {
    const info = classifyTailwindClass(cls);
    const list = grouped.get(info.category) || [];
    list.push(cls);
    grouped.set(info.category, list);
  }

  useEffect(() => {
    if (showAdd) inputRef.current?.focus();
  }, [showAdd]);

  const removeClass = useCallback((cls: string) => {
    // Apply in DOM
    const el = document.querySelector(`[data-0canvas-id="${elementId}"]`) as HTMLElement;
    if (el) el.classList.remove(cls);

    // Send to engine for source file write
    if (bridge) {
      bridge.send({
        type: "TAILWIND_CLASS_CHANGE",
        source: "browser",
        selector,
        action: "remove",
        className: cls,
      } as any);
    }

    // Update store classes
    const newClasses = classes.filter((c) => c !== cls);
    dispatch({ type: "SET_ELEMENT_STYLES", id: elementId, styles: {} }); // trigger re-render
  }, [elementId, selector, classes, bridge, dispatch]);

  const addClass = useCallback((cls: string) => {
    if (classes.includes(cls)) return;
    setSearch("");
    setShowAdd(false);

    // Apply in DOM
    const el = document.querySelector(`[data-0canvas-id="${elementId}"]`) as HTMLElement;
    if (el) el.classList.add(cls);

    // Send to engine for source file write
    if (bridge) {
      bridge.send({
        type: "TAILWIND_CLASS_CHANGE",
        source: "browser",
        selector,
        action: "add",
        className: cls,
      } as any);
    }
  }, [elementId, selector, classes, bridge]);

  // Autocomplete suggestions
  const suggestions = search.trim()
    ? COMMON_TAILWIND_CLASSES.filter(
        (c) => c.includes(search.toLowerCase()) && !classes.includes(c)
      ).slice(0, 8)
    : [];

  return (
    <div className="oc-tw-editor" data-0canvas="tailwind-editor">
      {/* Grouped classes */}
      {Array.from(grouped.entries()).map(([category, classList]) => (
        <div key={category} className="oc-tw-group">
          <span className="oc-tw-group-label" style={{ color: CATEGORY_COLORS[category] }}>
            {CATEGORY_LABELS[category]}
          </span>
          <div className="oc-tw-chips">
            {classList.map((cls) => (
              <span key={cls} className="oc-tw-chip" style={{ borderColor: CATEGORY_COLORS[category] + "40" }}>
                <span className="oc-tw-chip-text">{cls}</span>
                <button
                  className="oc-tw-chip-remove"
                  onClick={() => removeClass(cls)}
                  title={`Remove ${cls}`}
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* Non-Tailwind classes (display only) */}
      {other.length > 0 && (
        <div className="oc-tw-group">
          <span className="oc-tw-group-label" style={{ color: "#6b7280" }}>Custom</span>
          <div className="oc-tw-chips">
            {other.map((cls) => (
              <span key={cls} className="oc-tw-chip oc-tw-chip-custom">
                <span className="oc-tw-chip-text">{cls}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add class */}
      {showAdd ? (
        <div className="oc-tw-add-area">
          <div className="oc-tw-search-row">
            <Search size={11} className="oc-tw-search-icon" />
            <input
              ref={inputRef}
              className="oc-tw-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions.length > 0) {
                  addClass(suggestions[0]);
                } else if (e.key === "Enter" && search.trim()) {
                  addClass(search.trim());
                } else if (e.key === "Escape") {
                  setShowAdd(false);
                  setSearch("");
                }
              }}
              placeholder="Type a class..."
              data-0canvas="tw-search"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="oc-tw-suggestions">
              {suggestions.map((s) => {
                const info = classifyTailwindClass(s);
                return (
                  <button
                    key={s}
                    className="oc-tw-suggestion"
                    onClick={() => addClass(s)}
                  >
                    <span className="oc-tw-suggestion-dot" style={{ background: CATEGORY_COLORS[info.category] }} />
                    <span>{s}</span>
                    <span className="oc-tw-suggestion-prop">{info.property}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <button className="oc-tw-add-btn" onClick={() => setShowAdd(true)}>
          <Plus size={11} /> Add class
        </button>
      )}
    </div>
  );
}
