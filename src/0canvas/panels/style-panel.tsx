import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Palette,
  Ruler,
  Type,
  Box,
  Grid3x3,
  Square,
  Sparkles,
  Globe,
  MousePointer2,
  Search,
  Move,
  Focus,
} from "lucide-react";
import { useWorkspace, findElement, BREAKPOINT_WIDTHS, type DesignToken } from "../store/store";
import { copyToClipboard } from "../utils/clipboard";
import { ScrollArea } from "../ui/scroll-area";
import { ColorEditor } from "../editors/color-editor";
import { SpacingEditor } from "../editors/spacing-editor";
import { TypographyEditor } from "../editors/typography-editor";
import { LayoutEditor } from "../editors/layout-editor";
import { BorderEditor } from "../editors/border-editor";
import { TailwindEditor } from "../editors/tailwind-editor";
import { detectTailwindClasses } from "../lib/tailwind";
import { SliderInput } from "../editors/controls";
import { useStyleChange } from "../bridge/use-bridge";
import { applyStyle, flashElement } from "../inspector";
import { getAutocompleteSuggestions } from "../lib/css-properties";

// ── Section definitions ──────────────────────────────────

type StyleCategory = {
  name: string;
  icon: React.ReactNode;
  properties: string[];
  editorType?: "spacing" | "typography" | "layout" | "border" | "effects";
};

const STYLE_CATEGORIES: StyleCategory[] = [
  {
    name: "Size",
    icon: <Ruler size={13} />,
    properties: ["width", "height", "maxWidth", "maxHeight", "minWidth", "minHeight"],
  },
  {
    name: "Layout",
    icon: <Grid3x3 size={13} />,
    properties: [
      "display", "position", "flexDirection", "alignItems", "justifyContent",
      "flexWrap", "gap", "gridTemplateColumns", "gridTemplateRows",
      "overflow", "float", "clear", "zIndex",
      "top", "right", "bottom", "left",
    ],
    editorType: "layout",
  },
  {
    name: "Spacing",
    icon: <Box size={13} />,
    properties: [
      "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
    ],
    editorType: "spacing",
  },
  {
    name: "Typography",
    icon: <Type size={13} />,
    properties: [
      "fontSize", "fontWeight", "lineHeight", "textAlign", "color",
      "letterSpacing", "fontFamily", "textDecoration", "textTransform",
      "whiteSpace", "verticalAlign", "listStyleType",
    ],
    editorType: "typography",
  },
  {
    name: "Background",
    icon: <Palette size={13} />,
    properties: [
      "background", "backgroundColor", "backgroundImage",
      "backgroundSize", "backgroundPosition", "backgroundRepeat",
    ],
  },
  {
    name: "Borders",
    icon: <Square size={13} />,
    properties: [
      "border", "borderTop", "borderBottom", "borderLeft", "borderRight",
      "borderRadius", "borderColor", "borderWidth", "borderStyle",
      "boxShadow", "outline",
    ],
    editorType: "border",
  },
  {
    name: "Effects",
    icon: <Sparkles size={13} />,
    properties: [
      "opacity", "mixBlendMode",
      "cursor", "pointerEvents", "transform", "transformOrigin",
      "transition", "animation", "filter", "backdropFilter",
    ],
    editorType: "effects",
  },
];

// ── Color detection ──────────────────────────────────────

const COLOR_PROPERTIES = new Set([
  "color", "backgroundColor", "background", "borderColor",
  "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
  "outlineColor",
]);

function isColorValue(value: string): boolean {
  return value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl");
}

// ── Blend mode options ──────────────────────────────────

const BLEND_MODES = [
  "normal", "multiply", "screen", "overlay",
  "darken", "lighten", "color-dodge", "color-burn",
  "hard-light", "soft-light", "difference", "exclusion",
  "hue", "saturation", "color", "luminosity",
];

// ── Token Suggestions Dropdown ──────────────────────────

function TokenSuggestions({
  property,
  currentValue,
  onSelect,
}: {
  property: string;
  currentValue: string;
  onSelect: (tokenValue: string) => void;
}) {
  const { state } = useWorkspace();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Collect all color tokens from all theme files
  const colorTokens: DesignToken[] = [];
  for (const file of state.themes.files) {
    for (const token of file.tokens) {
      if (token.syntax === "color") {
        colorTokens.push(token);
      }
    }
  }

  // No tokens available — don't render
  if (colorTokens.length === 0) return null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Get resolved color value for display
  const resolvedColor = (token: DesignToken): string => {
    return token.values["default"] || Object.values(token.values)[0] || "#000";
  };

  // Format token name for display: --blue-500 → blue-500
  const displayName = (name: string) => name.replace(/^--/, "");

  return (
    <div className="oc-token-suggest" ref={dropdownRef}>
      <button
        className="oc-token-suggest-trigger"
        onClick={() => setOpen(!open)}
        title="Design token suggestions"
      >
        <Palette size={9} />
      </button>
      {open && (
        <div className="oc-token-suggest-dropdown">
          <div className="oc-token-suggest-header">Tokens</div>
          <div className="oc-token-suggest-list">
            {colorTokens.slice(0, 6).map((token) => (
              <button
                key={token.name}
                className="oc-token-suggest-item"
                onClick={() => {
                  onSelect(`var(${token.name})`);
                  setOpen(false);
                }}
              >
                <span
                  className="oc-token-suggest-swatch"
                  style={{ background: resolvedColor(token) }}
                />
                <span className="oc-token-suggest-name">{displayName(token.name)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CSS Value Autocomplete ──────────────────────────────

function AutocompleteInput({
  property,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  property: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const suggestions = getAutocompleteSuggestions(property, value, 6);
  const showSuggestions = suggestions.length > 0;

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightIndex(-1);
  }, [value]);

  const selectSuggestion = (s: string) => {
    onChange(s);
    // Defer commit so state updates
    setTimeout(() => onCommit(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === "Enter") onCommit();
      if (e.key === "Escape") onCancel();
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
          selectSuggestion(suggestions[highlightIndex]);
        } else {
          onCommit();
        }
        break;
      case "Escape":
        onCancel();
        break;
      case "Tab":
        if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
          e.preventDefault();
          selectSuggestion(suggestions[highlightIndex]);
        }
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightIndex]) {
        (items[highlightIndex] as HTMLElement).scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightIndex]);

  return (
    <div className="oc-autocomplete-wrap">
      <input
        ref={inputRef}
        autoFocus
        className="oc-style-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          // Small delay so click on suggestion works
          setTimeout(() => {
            if (!listRef.current?.contains(document.activeElement)) {
              onCommit();
            }
          }, 150);
        }}
        onKeyDown={handleKeyDown}
      />
      {showSuggestions && (
        <div className="oc-autocomplete-dropdown" ref={listRef}>
          {suggestions.map((s, i) => (
            <button
              key={s}
              className={`oc-autocomplete-item${i === highlightIndex ? " is-highlighted" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(s);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Effects Editor ──────────────────────────────────────

function EffectsEditor({
  elementId,
  selector,
  styles,
}: {
  elementId: string;
  selector: string;
  styles: Record<string, string>;
}) {
  const { dispatch } = useWorkspace();
  const sendStyleChange = useStyleChange();

  // Parse opacity
  const rawOpacity = styles.opacity;
  const opacityNum = rawOpacity !== undefined && rawOpacity !== "" ? parseFloat(rawOpacity) : 1;
  const currentOpacity = isNaN(opacityNum) ? 1 : Math.max(0, Math.min(1, opacityNum));

  // Parse blend mode
  const currentBlend = styles.mixBlendMode || "normal";

  const applyEffect = useCallback(
    async (property: string, value: string) => {
      const kebab = property.replace(/([A-Z])/g, "-$1").toLowerCase();
      dispatch({ type: "UPDATE_STYLE", elementId, property, value });
      applyStyle(elementId, kebab, value);
      await sendStyleChange(selector, kebab, value, styles[property] || "");
    },
    [elementId, selector, styles, dispatch, sendStyleChange]
  );

  return (
    <div className="oc-effects-editor">
      {/* Opacity */}
      <div className="oc-effects-row">
        <SliderInput
          label="Opacity"
          value={Math.round(currentOpacity * 100)}
          onChange={(v) => applyEffect("opacity", String(Math.round(v) / 100))}
          min={0}
          max={100}
          step={1}
          suffix="%"
        />
      </div>

      {/* Mix Blend Mode */}
      <div className="oc-effects-row">
        <span className="oc-effects-label">Blend</span>
        <select
          className="oc-effects-select"
          value={currentBlend}
          onChange={(e) => applyEffect("mixBlendMode", e.target.value)}
        >
          {BLEND_MODES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Style Property Row ───────────────────────────────────

function StylePropertyRow({
  property,
  value,
  elementId,
  selector,
  onOpenColorEditor,
  isDisabled,
  onToggleDisabled,
}: {
  property: string;
  value: string;
  elementId: string;
  selector: string;
  onOpenColorEditor?: (property: string, value: string) => void;
  isDisabled?: boolean;
  onToggleDisabled?: (property: string, value: string) => void;
}) {
  const { dispatch } = useWorkspace();
  const sendStyleChange = useStyleChange();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const isColor = COLOR_PROPERTIES.has(property) || isColorValue(value);

  const handleSave = useCallback(async () => {
    const kebabProp = formatProperty(property);
    dispatch({ type: "UPDATE_STYLE", elementId, property, value: editValue });
    applyStyle(elementId, kebabProp, editValue);
    flashElement(elementId);
    await sendStyleChange(selector, kebabProp, editValue, value);
    setEditing(false);
  }, [elementId, selector, property, value, editValue, dispatch, sendStyleChange]);

  const handleTokenSelect = useCallback(async (tokenValue: string) => {
    const kebabProp = formatProperty(property);
    dispatch({ type: "UPDATE_STYLE", elementId, property, value: tokenValue });
    applyStyle(elementId, kebabProp, tokenValue);
    await sendStyleChange(selector, kebabProp, tokenValue, value);
  }, [elementId, selector, property, value, dispatch, sendStyleChange]);

  const colorMatch = typeof value === "string"
    ? value.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/)
    : null;
  const swatchColor = isColor && colorMatch ? colorMatch[0] : null;

  return (
    <div className={`oc-style-property${isDisabled ? " is-disabled" : ""}`}>
      <span
        className="oc-style-prop-check"
        onClick={(e) => { e.stopPropagation(); onToggleDisabled?.(property, value); }}
      >
        <input
          type="checkbox"
          checked={!isDisabled}
          readOnly
          tabIndex={-1}
        />
      </span>
      <span className="oc-style-prop-name">{formatProperty(property)}</span>
      <div className="oc-style-prop-value-wrap">
        {swatchColor && (
          <>
            <span
              className="oc-style-swatch oc-style-swatch-clickable"
              style={{ background: swatchColor }}
              onClick={() => onOpenColorEditor?.(property, value)}
              title="Open color picker"
            />
            <TokenSuggestions
              property={property}
              currentValue={value}
              onSelect={handleTokenSelect}
            />
          </>
        )}
        {editing ? (
          <AutocompleteInput
            property={property}
            value={editValue}
            onChange={setEditValue}
            onCommit={handleSave}
            onCancel={() => { setEditValue(value); setEditing(false); }}
          />
        ) : (
          <span
            onClick={() => { if (!isDisabled) { setEditValue(value); setEditing(true); } }}
            className="oc-style-click-value"
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Style Section ────────────────────────────────────────

function StyleSection({
  category,
  elementStyles,
  elementId,
  selector,
  onOpenColorEditor,
  expanded,
  onToggle,
  disabledProps,
  onToggleDisabled,
}: {
  category: StyleCategory;
  elementStyles: Record<string, string>;
  elementId: string;
  selector: string;
  onOpenColorEditor: (property: string, value: string) => void;
  expanded: boolean;
  onToggle: () => void;
  disabledProps: Set<string>;
  onToggleDisabled: (property: string, value: string) => void;
}) {
  const activeProperties = category.properties.filter(
    (p) => elementStyles[p] !== undefined && elementStyles[p] !== ""
  );

  if (activeProperties.length === 0) return null;

  return (
    <div className="oc-panel-section">
      <button
        onClick={onToggle}
        className="oc-style-section-btn"
      >
        {expanded ? (
          <ChevronDown size={11} color="#666" className="oc-style-chevron" />
        ) : (
          <ChevronRight size={11} color="#666" className="oc-style-chevron" />
        )}
        <span className="oc-style-section-icon">{category.icon}</span>
        <span className="oc-style-section-name">{category.name}</span>
        <span className="oc-style-section-count">{activeProperties.length}</span>
      </button>
      {expanded && (
        <div className="oc-style-section-children">
          {/* Visual editors for special sections */}
          {category.editorType === "spacing" && (
            <SpacingEditor elementId={elementId} selector={selector} styles={elementStyles} />
          )}
          {category.editorType === "typography" && (
            <TypographyEditor elementId={elementId} selector={selector} styles={elementStyles} />
          )}
          {category.editorType === "layout" && (
            <LayoutEditor elementId={elementId} selector={selector} styles={elementStyles} />
          )}
          {category.editorType === "border" && (
            <BorderEditor elementId={elementId} selector={selector} styles={elementStyles} onOpenColorEditor={onOpenColorEditor} />
          )}
          {category.editorType === "effects" && (
            <EffectsEditor elementId={elementId} selector={selector} styles={elementStyles} />
          )}

          {/* Property rows (skip for sections with visual editors) */}
          {!category.editorType && activeProperties.map((prop) => (
            <StylePropertyRow
              key={prop}
              property={prop}
              value={elementStyles[prop]}
              elementId={elementId}
              selector={selector}
              onOpenColorEditor={onOpenColorEditor}
              isDisabled={disabledProps.has(prop)}
              onToggleDisabled={onToggleDisabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Style Panel ─────────────────────────────────────

export function StylePanel() {
  const { state, dispatch } = useWorkspace();
  const sendStyleChange = useStyleChange();
  const [tab, setTab] = useState<"editor" | "code">("editor");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Focus Mode ──
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("oc-style-focus-mode");
      return saved !== null ? saved === "true" : true;
    } catch { return true; }
  });
  // In focus mode: only one section open at a time (null = all collapsed)
  // In free mode: track each section independently
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    return new Set(STYLE_CATEGORIES.map((c) => c.name));
  });

  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      try { localStorage.setItem("oc-style-focus-mode", String(next)); } catch {}
      // When switching to focus mode, pick the first expanded section (or null)
      if (next) {
        setExpandedSection((currentFocus) => {
          // Try to keep current focus, or pick first from free-mode set
          if (currentFocus) return currentFocus;
          const first = STYLE_CATEGORIES.find((c) => expandedSections.has(c.name));
          return first ? first.name : null;
        });
      } else {
        // When switching to free mode, expand the currently focused section
        setExpandedSections((prev) => {
          const next = new Set(prev);
          // Keep all that were open, plus the focused one
          if (expandedSection) next.add(expandedSection);
          return next;
        });
      }
      return next;
    });
  }, [expandedSection, expandedSections]);

  const handleSectionToggle = useCallback((sectionName: string) => {
    if (focusMode) {
      setExpandedSection((prev) => prev === sectionName ? null : sectionName);
    } else {
      setExpandedSections((prev) => {
        const next = new Set(prev);
        if (next.has(sectionName)) next.delete(sectionName);
        else next.add(sectionName);
        return next;
      });
    }
  }, [focusMode]);

  const isSectionExpanded = useCallback((sectionName: string): boolean => {
    if (focusMode) return expandedSection === sectionName;
    return expandedSections.has(sectionName);
  }, [focusMode, expandedSection, expandedSections]);

  // ── Disabled Properties (B3) ──
  // Map of property name -> original value (so we can restore)
  const [disabledProps, setDisabledProps] = useState<Map<string, string>>(new Map());
  const disabledSet = useMemo(() => new Set(disabledProps.keys()), [disabledProps]);

  const handleToggleDisabled = useCallback((property: string, currentValue: string) => {
    const selectedEl = state.selectedElementId
      ? findElement(state.elements, state.selectedElementId)
      : null;
    if (!selectedEl) return;
    const kebabProp = formatProperty(property);

    setDisabledProps((prev) => {
      const next = new Map(prev);
      if (next.has(property)) {
        // Re-enable: restore the original value
        const originalValue = next.get(property)!;
        next.delete(property);
        dispatch({ type: "UPDATE_STYLE", elementId: selectedEl.id, property, value: originalValue });
        applyStyle(selectedEl.id, kebabProp, originalValue);
        sendStyleChange(selectedEl.selector, kebabProp, originalValue, "");
      } else {
        // Disable: store original value, remove inline style
        next.set(property, currentValue);
        applyStyle(selectedEl.id, kebabProp, "");
      }
      return next;
    });
  }, [state.selectedElementId, state.elements, dispatch, sendStyleChange]);

  // Clear disabled props when selection changes
  const prevElementId = useRef(state.selectedElementId);
  useEffect(() => {
    if (state.selectedElementId !== prevElementId.current) {
      setDisabledProps(new Map());
      prevElementId.current = state.selectedElementId;
    }
  }, [state.selectedElementId]);

  const [colorEditor, setColorEditor] = useState<{
    property: string;
    value: string;
  } | null>(null);

  const selectedElement = state.selectedElementId
    ? findElement(state.elements, state.selectedElementId)
    : null;

  const handleOpenColorEditor = useCallback((property: string, value: string) => {
    setColorEditor({ property, value });
  }, []);

  if (!selectedElement) {
    return (
      <div className="oc-panel">
        <div className="oc-panel-header">
          <span className="oc-panel-title">Style</span>
        </div>
        <div className="oc-style-empty-centered">
          <div>
            {state.elements.length === 0 ? (
              <>
                <Globe size={24} color="#404040" className="oc-style-empty-icon" />
                <p>Connect a project to inspect styles</p>
              </>
            ) : (
              <>
                <MousePointer2 size={24} color="#404040" className="oc-style-empty-icon" />
                <p>Select an element to inspect its styles</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const styleCount = Object.keys(selectedElement.styles).length;
  const cssOutput = Object.entries(selectedElement.styles)
    .map(([k, v]) => `  ${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
    .join("\n");

  // Filter categories by search
  const filteredCategories = searchQuery
    ? STYLE_CATEGORIES.map((cat) => ({
        ...cat,
        properties: cat.properties.filter((p) =>
          formatProperty(p).includes(searchQuery.toLowerCase())
        ),
      })).filter((cat) => cat.properties.length > 0)
    : STYLE_CATEGORIES;

  return (
    <div className="oc-panel">
      {/* Color editor popover */}
      {colorEditor && (
        <ColorEditor
          elementId={selectedElement.id}
          selector={selectedElement.selector}
          property={colorEditor.property}
          value={colorEditor.value}
          onClose={() => setColorEditor(null)}
        />
      )}

      {/* Header */}
      <div className="oc-style-header-col">
        <div className="oc-style-header-row">
          <span className="oc-panel-title">Style</span>
          <div className="oc-style-header-actions">
              <button
              className={`oc-panel-btn oc-focus-toggle${focusMode ? " is-active" : ""}`}
              onClick={toggleFocusMode}
              title={focusMode ? "Focus mode ON — one section at a time" : "Focus mode OFF — expand freely"}
            >
              <Focus size={13} />
            </button>
            <CopyBtn onClick={() => copyToClipboard(`${selectedElement.selector} {\n${cssOutput}\n}`)} />
          </div>
        </div>

        <div className="oc-style-header-meta">
          {state.activeBreakpoint !== "desktop" && (
            <span className="oc-breakpoint-badge">
              {state.activeBreakpoint} {BREAKPOINT_WIDTHS[state.activeBreakpoint]}px
            </span>
          )}
          <span className="oc-style-tag-badge">
            {"<"}{selectedElement.tag}{">"}
          </span>
          {styleCount > 0 && (
            <span className="oc-style-prop-count">{styleCount} props</span>
          )}
        </div>

        {selectedElement.classes.length > 0 && (
          <div className="oc-style-class-list">
            {selectedElement.classes.slice(0, 5).map((cls) => (
              <span key={cls} className="oc-style-class-badge">.{cls}</span>
            ))}
            {selectedElement.classes.length > 5 && (
              <span className="oc-style-class-overflow">+{selectedElement.classes.length - 5}</span>
            )}
          </div>
        )}
      </div>

      {/* Tabs: Editor + Code */}
      <div className="oc-style-tabs">
        <TabBtn label="Editor" active={tab === "editor"} onClick={() => setTab("editor")} />
        <TabBtn label="Code" active={tab === "code"} onClick={() => setTab("code")} />
      </div>

      {/* Content */}
      <ScrollArea className="oc-panel-body">
        {tab === "editor" && (
          <div>
            {/* Search bar */}
            <div className="oc-style-search">
              <Search size={12} className="oc-style-search-icon" />
              <input
                className="oc-style-search-input"
                placeholder="Search property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Tailwind classes (if detected) */}
            {selectedElement.classes.length > 0 && detectTailwindClasses(selectedElement.classes).isTailwind && (
              <div className="oc-panel-section">
                <div className="oc-style-section-btn" style={{ cursor: "default" }}>
                  <span className="oc-style-section-name">Tailwind Classes</span>
                  <span className="oc-style-section-count">
                    {detectTailwindClasses(selectedElement.classes).tailwind.length}
                  </span>
                </div>
                <div className="oc-style-section-children">
                  <TailwindEditor
                    elementId={selectedElement.id}
                    selector={selectedElement.selector}
                    classes={selectedElement.classes}
                  />
                </div>
              </div>
            )}

            {/* CSS Sections */}
            {filteredCategories.map((cat) => (
              <StyleSection
                key={cat.name}
                category={cat}
                elementStyles={selectedElement.styles}
                elementId={selectedElement.id}
                selector={selectedElement.selector}
                onOpenColorEditor={handleOpenColorEditor}
                expanded={isSectionExpanded(cat.name)}
                onToggle={() => handleSectionToggle(cat.name)}
                disabledProps={disabledSet}
                onToggleDisabled={handleToggleDisabled}
              />
            ))}
            {styleCount === 0 && (
              <div className="oc-panel-empty">
                <p>No styles detected yet.</p>
                <p className="oc-style-sub-hint">Click this element in the preview to load styles.</p>
              </div>
            )}
          </div>
        )}

        {tab === "code" && (
          <div className="oc-style-tab-content">
            <pre className="oc-style-code-block">
              <span className="oc-style-syntax-selector">{selectedElement.selector}</span>
              <span className="oc-style-syntax-comment">{" {\n"}</span>
              {Object.entries(selectedElement.styles).map(([k, v]) => (
                <span key={k}>
                  <span className="oc-style-syntax-property">{"  "}{k.replace(/([A-Z])/g, "-$1").toLowerCase()}</span>
                  <span className="oc-style-syntax-comment">{": "}</span>
                  <span className="oc-style-syntax-value">{v}</span>
                  <span className="oc-style-syntax-comment">{";\n"}</span>
                </span>
              ))}
              <span className="oc-style-syntax-comment">{"}"}</span>
            </pre>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function formatProperty(prop: string): string {
  return prop.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`oc-style-tab${active ? " is-active" : ""}`}>
      {label}
    </button>
  );
}

function CopyBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="oc-panel-btn" title="Copy CSS">
      <Copy size={13} />
    </button>
  );
}
