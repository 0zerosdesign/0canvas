// ──────────────────────────────────────────────────────────
// Border & Radius Editor — Visual border controls
// ──────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import { Link, Unlink } from "lucide-react";
import { SegmentedControl, NumberInputWithUnit } from "./controls";
import { useStyleChange } from "../bridge/use-bridge";
import { useWorkspace } from "../store/store";
import { applyStyle } from "../inspector";
import { Input } from "../ui";

interface BorderEditorProps {
  elementId: string;
  selector: string;
  styles: Record<string, string>;
  onOpenColorEditor?: (property: string, value: string) => void;
}

function parseRadius(val: string | undefined): string {
  if (!val || val === "0px" || val === "0") return "0";
  const m = val.match(/^(-?\d+(?:\.\d+)?)/);
  return m ? m[1] : val || "0";
}

function parseShadow(val: string | undefined): {
  x: string; y: string; blur: string; spread: string; color: string;
} | null {
  if (!val || val === "none") return null;
  // Parse: "2px 4px 6px 0px rgba(0,0,0,0.1)" or "2px 4px 6px rgba(0,0,0,0.1)"
  const m = val.match(
    /(-?\d+(?:\.\d+)?px)\s+(-?\d+(?:\.\d+)?px)\s+(-?\d+(?:\.\d+)?px)\s*(-?\d+(?:\.\d+)?px)?\s*(.*)/
  );
  if (!m) return null;
  return {
    x: m[1] || "0px",
    y: m[2] || "0px",
    blur: m[3] || "0px",
    spread: m[4] || "0px",
    // Default shadow color emitted as a serialized CSS value — check:ui ignore-next
    color: m[5]?.trim() || "rgba(0,0,0,0.25)",
  };
}

export function BorderEditor({ elementId, selector, styles, onOpenColorEditor }: BorderEditorProps) {
  const { dispatch } = useWorkspace();
  const sendStyleChange = useStyleChange();
  const [radiusLinked, setRadiusLinked] = useState(true);

  const apply = useCallback(
    async (property: string, value: string) => {
      const kebab = property.replace(/([A-Z])/g, "-$1").toLowerCase();
      dispatch({ type: "UPDATE_STYLE", elementId, property, value });
      applyStyle(elementId, kebab, value);
      await sendStyleChange(selector, kebab, value);
    },
    [elementId, selector, dispatch, sendStyleChange]
  );

  // ── Border width/style/color ────────────────────────────

  const borderColor = styles.borderColor || styles.borderTopColor || "";
  const colorMatch = borderColor.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/);

  // ── Border radius ───────────────────────────────────────

  const radiusVal = styles.borderRadius || "0px";
  const corners = {
    tl: parseRadius(radiusVal),
    tr: parseRadius(radiusVal),
    br: parseRadius(radiusVal),
    bl: parseRadius(radiusVal),
  };

  const handleRadiusChange = (corner: "tl" | "tr" | "br" | "bl", value: string) => {
    const px = /^\d+(\.\d+)?$/.test(value) ? `${value}px` : value;
    if (radiusLinked) {
      apply("borderRadius", px);
    } else {
      const map = { tl: "borderTopLeftRadius", tr: "borderTopRightRadius", br: "borderBottomRightRadius", bl: "borderBottomLeftRadius" };
      apply(map[corner], px);
    }
  };

  // ── Box shadow ──────────────────────────────────────────

  const shadow = parseShadow(styles.boxShadow);

  const updateShadow = (field: string, value: string) => {
    // Default shadow emitted when the target has no box-shadow yet — check:ui ignore-next
    const s = shadow || { x: "0px", y: "0px", blur: "0px", spread: "0px", color: "rgba(0,0,0,0.25)" };
    const updated = { ...s, [field]: value };
    apply("boxShadow", `${updated.x} ${updated.y} ${updated.blur} ${updated.spread} ${updated.color}`);
  };

  return (
    <div className="oc-border-editor" data-Zeros="border-editor">
      {/* Border width */}
      {(styles.borderWidth || styles.border) && (
        <div className="oc-editor-row">
          <span className="oc-editor-label">Width</span>
          <NumberInputWithUnit
            label="border-width"
            value={styles.borderWidth || "0px"}
            onChange={(v) => apply("borderWidth", v)}
            units={["px"]}
            min={0}
          />
        </div>
      )}

      {/* Border style */}
      {(styles.borderStyle || styles.border) && (
        <div className="oc-editor-row">
          <span className="oc-editor-label">Style</span>
          <SegmentedControl
            options={[
              { value: "solid", label: "Solid", title: "border-style: solid" },
              { value: "dashed", label: "Dash", title: "border-style: dashed" },
              { value: "dotted", label: "Dot", title: "border-style: dotted" },
              { value: "none", label: "None", title: "border-style: none" },
            ]}
            value={styles.borderStyle || "solid"}
            onChange={(v) => apply("borderStyle", v)}
          />
        </div>
      )}

      {/* Border color */}
      {borderColor && (
        <div className="oc-editor-row" title="border-color">
          <span className="oc-editor-label">Color</span>
          <div className="oc-editor-inline">
            {colorMatch && (
              <span
                className="oc-style-swatch oc-style-swatch-clickable"
                style={{ background: colorMatch[0] }}
                onClick={() => onOpenColorEditor?.("borderColor", borderColor)}
                title="border-color"
              />
            )}
            <span className="oc-editor-value" title="border-color">{borderColor}</span>
          </div>
        </div>
      )}

      {/* Border radius — visual diagram */}
      {(styles.borderRadius !== undefined) && (
        <>
          <div className="oc-editor-row">
            <span className="oc-editor-label">Radius</span>
            <button
              className={`oc-toggle-btn-sm${radiusLinked ? " is-active" : ""}`}
              onClick={() => setRadiusLinked(!radiusLinked)}
              title={radiusLinked ? "Uniform corners" : "Per-corner"}
            >
              {radiusLinked ? <Link size={11} /> : <Unlink size={11} />}
            </button>
          </div>
          <div className="oc-radius-diagram">
            <div className="oc-radius-row">
              <RadiusInput value={corners.tl} onChange={(v) => handleRadiusChange("tl", v)} title="border-top-left-radius" />
              <div className="oc-radius-spacer" />
              <RadiusInput value={corners.tr} onChange={(v) => handleRadiusChange("tr", v)} title="border-top-right-radius" />
            </div>
            <div className="oc-radius-preview" style={{ borderRadius: radiusVal }}>
              <span className="oc-radius-preview-label">{radiusVal}</span>
            </div>
            <div className="oc-radius-row">
              <RadiusInput value={corners.bl} onChange={(v) => handleRadiusChange("bl", v)} title="border-bottom-left-radius" />
              <div className="oc-radius-spacer" />
              <RadiusInput value={corners.br} onChange={(v) => handleRadiusChange("br", v)} title="border-bottom-right-radius" />
            </div>
          </div>
        </>
      )}

      {/* Box shadow */}
      {styles.boxShadow && styles.boxShadow !== "none" && shadow && (
        <>
          <div className="oc-editor-row" style={{ marginTop: "var(--space-3)" }}>
            <span className="oc-editor-label">Shadow</span>
          </div>
          <div className="oc-shadow-grid" title="box-shadow">
            <NumberInputWithUnit label="X" value={shadow.x} onChange={(v) => updateShadow("x", v)} units={["px"]} />
            <NumberInputWithUnit label="Y" value={shadow.y} onChange={(v) => updateShadow("y", v)} units={["px"]} />
            <NumberInputWithUnit label="Blur" value={shadow.blur} onChange={(v) => updateShadow("blur", v)} units={["px"]} min={0} />
            <NumberInputWithUnit label="Spread" value={shadow.spread} onChange={(v) => updateShadow("spread", v)} units={["px"]} />
          </div>
          <div className="oc-editor-row" title="box-shadow">
            <span className="oc-editor-label">Color</span>
            <div className="oc-editor-inline">
              <span
                className="oc-style-swatch oc-style-swatch-clickable"
                style={{ background: shadow.color }}
                title="box-shadow color"
              />
              <span className="oc-editor-value" title="box-shadow color">{shadow.color}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RadiusInput({ value, onChange, title }: { value: string; onChange: (v: string) => void; title: string }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleCommit = () => {
    setEditing(false);
    if (editValue.trim() !== value) onChange(editValue.trim());
  };

  if (editing) {
    return (
      <Input
        autoFocus
        className="oc-radius-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCommit();
          if (e.key === "Escape") { setEditValue(value); setEditing(false); }
        }}
        title={title}
        data-Zeros="radius-input"
      />
    );
  }

  return (
    <span
      className="oc-radius-value"
      onClick={() => { setEditValue(value); setEditing(true); }}
      title={title}
    >
      {value}
    </span>
  );
}
