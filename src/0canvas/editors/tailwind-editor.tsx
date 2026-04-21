// ──────────────────────────────────────────────────────────
// Tailwind Class Editor — Add/remove Tailwind utility classes
// ──────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from "react";
import { X, Plus, Search } from "lucide-react";
import { detectTailwindClasses, classifyTailwindClass, COMMON_TAILWIND_CLASSES, type TailwindCategory } from "../lib/tailwind";
import { useWorkspace } from "../store/store";
import { useBridge } from "../bridge/use-bridge";
import { Button, Input } from "../ui";

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

// CATEGORY_COLORS — distinct hues for the 8 Tailwind category chips
// in the editor. These are intentionally hex literals (not tokens)
// because we concatenate an alpha suffix like `CATEGORY_COLORS[c] + "40"`
// to compute a 25%-opacity border in string form — impossible with
// CSS custom properties. The hex values deliberately mirror the
// primitive scales in design-tokens.css (blue-500, green-500,
// purple-500, yellow-500, red-500, cyan-500, purple-500, grey-500).
const CATEGORY_COLORS: Record<TailwindCategory, string> = {
  layout:     "#3B82F6", // --blue-500
  spacing:    "#10B981", // --green-500 / --status-success
  sizing:     "#8B5CF6", // --purple-500
  typography: "#F59E0B", // --yellow-500 / --status-warning
  color:      "#EF4444", // --red-500 / --status-critical
  border:     "#06B6D4", // --cyan-500
  effects:    "#8B5CF6", // --purple-500
  other:      "#737373", // --grey-500 / --text-muted
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
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="oc-tw-chip-remove"
                  onClick={() => removeClass(cls)}
                  title={`Remove ${cls}`}
                >
                  <X size={9} />
                </Button>
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* Non-Tailwind classes (display only) */}
      {other.length > 0 && (
        <div className="oc-tw-group">
          <span className="oc-tw-group-label" style={{ color: "var(--text-muted)" }}>Custom</span>
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
            <Input
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
                  <Button
                    key={s}
                    variant="ghost"
                    className="oc-tw-suggestion"
                    onClick={() => addClass(s)}
                  >
                    <span className="oc-tw-suggestion-dot" style={{ background: CATEGORY_COLORS[info.category] }} />
                    <span>{s}</span>
                    <span className="oc-tw-suggestion-prop">{info.property}</span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={11} /> Add class
        </Button>
      )}
    </div>
  );
}
