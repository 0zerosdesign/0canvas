// ──────────────────────────────────────────────────────────
// Typography Editor — Font, size, weight, height, alignment
// ──────────────────────────────────────────────────────────
//
// Visual controls for typography properties:
//   - Font family dropdown
//   - Font size + unit
//   - Font weight dropdown
//   - Line height
//   - Text align buttons
//   - Letter spacing
//
// ──────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import { useStyleChange } from "../bridge/use-bridge";
import { useWorkspace } from "../store/store";
import { applyStyle } from "../inspector";

interface TypographyEditorProps {
  elementId: string;
  selector: string;
  styles: Record<string, string>;
}

const FONT_WEIGHTS = [
  { value: "100", label: "Thin" },
  { value: "200", label: "Extra Light" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
];

const COMMON_FONTS = [
  "inherit",
  "system-ui",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Poppins",
  "Montserrat",
  "Source Sans 3",
  "Nunito",
  "Raleway",
  "DM Sans",
  "monospace",
  "serif",
  "sans-serif",
];

function NumberInput({
  value,
  unit,
  onChange,
  label,
  cssProperty,
  min,
  step,
}: {
  value: string;
  unit?: string;
  onChange: (value: string) => void;
  label: string;
  cssProperty?: string;
  min?: number;
  step?: number;
}) {
  const numMatch = value.match(/^(-?[\d.]+)(.*)?$/);
  const numValue = numMatch ? numMatch[1] : "";
  const numUnit = unit || (numMatch ? numMatch[2] || "px" : "px");

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(numValue);

  const handleCommit = () => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed === "") return;
    // Add unit if bare number
    const finalValue = /^-?[\d.]+$/.test(trimmed) ? `${trimmed}${numUnit}` : trimmed;
    onChange(finalValue);
  };

  const tooltip = cssProperty || label.toLowerCase();

  return (
    <div className="oc-typo-field" title={tooltip}>
      <span className="oc-typo-field-label">{label}</span>
      {editing ? (
        <input
          autoFocus
          className="oc-typo-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCommit();
            if (e.key === "Escape") { setEditValue(numValue); setEditing(false); }
          }}
          title={tooltip}
          data-0canvas="typo-input"
        />
      ) : (
        <span
          className="oc-typo-value"
          onClick={() => { setEditValue(numValue); setEditing(true); }}
          title={tooltip}
        >
          {value || "\u2013"}
        </span>
      )}
    </div>
  );
}

export function TypographyEditor({ elementId, selector, styles }: TypographyEditorProps) {
  const { dispatch } = useWorkspace();
  const sendStyleChange = useStyleChange();

  const applyChange = useCallback(
    async (property: string, value: string) => {
      const kebabProp = property.replace(/([A-Z])/g, "-$1").toLowerCase();
      dispatch({ type: "UPDATE_STYLE", elementId, property, value });
      applyStyle(elementId, kebabProp, value);
      await sendStyleChange(selector, kebabProp, value);
    },
    [elementId, selector, dispatch, sendStyleChange]
  );

  const currentAlign = styles.textAlign || "left";

  return (
    <div className="oc-typo-editor" data-0canvas="typography-editor">
      {/* Font Family */}
      <div className="oc-typo-field" title="font-family">
        <span className="oc-typo-field-label">Font</span>
        <select
          className="oc-typo-select"
          value={styles.fontFamily || "inherit"}
          onChange={(e) => applyChange("fontFamily", e.target.value)}
          title="font-family"
          data-0canvas="typo-select"
        >
          {COMMON_FONTS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size + Weight row */}
      <div className="oc-typo-row">
        <NumberInput
          label="Size"
          cssProperty="font-size"
          value={styles.fontSize || "16px"}
          onChange={(v) => applyChange("fontSize", v)}
        />
        <div className="oc-typo-field" title="font-weight">
          <span className="oc-typo-field-label">Weight</span>
          <select
            className="oc-typo-select"
            value={styles.fontWeight || "400"}
            onChange={(e) => applyChange("fontWeight", e.target.value)}
            title="font-weight"
            data-0canvas="typo-select"
          >
            {FONT_WEIGHTS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.value} {w.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Line Height + Letter Spacing row */}
      <div className="oc-typo-row">
        <NumberInput
          label="Height"
          cssProperty="line-height"
          value={styles.lineHeight || "normal"}
          onChange={(v) => applyChange("lineHeight", v)}
        />
        <NumberInput
          label="Spacing"
          cssProperty="letter-spacing"
          value={styles.letterSpacing || "normal"}
          onChange={(v) => applyChange("letterSpacing", v)}
        />
      </div>

      {/* Text Align */}
      <div className="oc-typo-field">
        <span className="oc-typo-field-label">Align</span>
        <div className="oc-typo-align-group">
          {([
            { value: "left", icon: AlignLeft },
            { value: "center", icon: AlignCenter },
            { value: "right", icon: AlignRight },
            { value: "justify", icon: AlignJustify },
          ] as const).map(({ value: alignVal, icon: Icon }) => (
            <button
              key={alignVal}
              className={`oc-typo-align-btn${currentAlign === alignVal ? " is-active" : ""}`}
              onClick={() => applyChange("textAlign", alignVal)}
              title={`text-align: ${alignVal}`}
              data-0canvas="typo-align"
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      {styles.color && (
        <div className="oc-typo-field">
          <span className="oc-typo-field-label">Color</span>
          <div className="oc-typo-color-row">
            <span
              className="oc-style-swatch"
              style={{ background: styles.color }}
            />
            <span className="oc-typo-value">{styles.color}</span>
          </div>
        </div>
      )}
    </div>
  );
}
