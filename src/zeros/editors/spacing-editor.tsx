// ──────────────────────────────────────────────────────────
// Spacing Editor — Visual margin/padding box-model editor
// ──────────────────────────────────────────────────────────
//
// Interactive box-model diagram:
//   - Click ANYWHERE in a segment area to inline-edit (Fitts's Law)
//   - Hover shows tinted background per segment
//   - Linked/unlinked toggle for uniform margin & padding
//   - CSS property tooltips on every segment
//   - Sends STYLE_CHANGE through bridge on edit
//
// ──────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link, Unlink } from "lucide-react";
import { useStyleChange } from "../bridge/use-bridge";
import { useWorkspace } from "../store/store";
import { applyStyle } from "../inspector";
import { Input } from "../ui";

interface SpacingEditorProps {
  elementId: string;
  selector: string;
  styles: Record<string, string>;
}

type SpacingSide = "Top" | "Right" | "Bottom" | "Left";
type SpacingType = "margin" | "padding";

function parseValue(val: string | undefined): string {
  if (!val || val === "0px" || val === "0") return "0";
  // Strip "px" for display, keep other units
  const match = val.match(/^(-?\d+(?:\.\d+)?)(px)?$/);
  if (match) return match[1];
  return val || "0";
}

function SpacingInput({
  type,
  side,
  value,
  onCommit,
  editing,
  onStartEdit,
}: {
  type: SpacingType;
  side: SpacingSide;
  value: string;
  onCommit: (type: SpacingType, side: SpacingSide, value: string) => void;
  editing: boolean;
  onStartEdit: () => void;
}) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setEditValue(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const handleCommit = () => {
    const trimmed = editValue.trim();
    if (trimmed !== value) {
      // Add "px" if it's a bare number
      const finalValue = /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}px` : trimmed;
      onCommit(type, side, finalValue);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        className="oc-spacing-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCommit();
          if (e.key === "Escape") setEditValue(value);
        }}
        onClick={(e) => e.stopPropagation()}
        title={`${type}-${side.toLowerCase()}`}
        data-Zeros="spacing-input"
      />
    );
  }

  return (
    <span
      className={`oc-spacing-value oc-spacing-${type}`}
      onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
    >
      {parseValue(value)}
    </span>
  );
}

export function SpacingEditor({ elementId, selector, styles }: SpacingEditorProps) {
  const { dispatch } = useWorkspace();
  const sendStyleChange = useStyleChange();
  const [marginLinked, setMarginLinked] = useState(true);
  const [paddingLinked, setPaddingLinked] = useState(true);
  const [editingCell, setEditingCell] = useState<string | null>(null);

  const getValue = (type: SpacingType, side: SpacingSide): string => {
    // Try specific side first, then shorthand
    const specific = styles[`${type}${side}`];
    if (specific) return specific;
    const shorthand = styles[type];
    if (shorthand) return shorthand;
    return "0px";
  };

  const handleCommit = useCallback(
    async (type: SpacingType, side: SpacingSide, value: string) => {
      const isLinked = type === "margin" ? marginLinked : paddingLinked;

      if (isLinked) {
        const sides: SpacingSide[] = ["Top", "Right", "Bottom", "Left"];
        for (const s of sides) {
          const property = `${type}${s}`;
          const kebabProp = `${type}-${s.toLowerCase()}`;
          dispatch({ type: "UPDATE_STYLE", elementId, property, value });
          applyStyle(elementId, kebabProp, value);
          await sendStyleChange(selector, kebabProp, value);
        }
      } else {
        const property = `${type}${side}`;
        const kebabProp = `${type}-${side.toLowerCase()}`;
        dispatch({ type: "UPDATE_STYLE", elementId, property, value });
        applyStyle(elementId, kebabProp, value);
        await sendStyleChange(selector, kebabProp, value);
      }

      setEditingCell(null);
    },
    [elementId, selector, dispatch, sendStyleChange, marginLinked, paddingLinked]
  );

  const cellKey = (type: SpacingType, side: SpacingSide) => `${type}-${side}`;

  const startEdit = (type: SpacingType, side: SpacingSide) => {
    setEditingCell(cellKey(type, side));
  };

  const renderCell = (type: SpacingType, side: SpacingSide, position: string) => {
    const key = cellKey(type, side);
    const kebab = `${type}-${side.toLowerCase()}`;
    return (
      <div
        className={`oc-spacing-cell oc-spacing-${position} oc-spacing-cell-${type}`}
        onClick={() => startEdit(type, side)}
        title={kebab}
      >
        <SpacingInput
          type={type}
          side={side}
          value={getValue(type, side)}
          onCommit={handleCommit}
          editing={editingCell === key}
          onStartEdit={() => startEdit(type, side)}
        />
      </div>
    );
  };

  return (
    <div className="oc-spacing-editor" data-Zeros="spacing-editor">
      {/* Linked toggles */}
      <div className="oc-spacing-link-row">
        <button
          className={`oc-spacing-link-btn${marginLinked ? " is-active" : ""}`}
          onClick={() => setMarginLinked(!marginLinked)}
          title={marginLinked ? "Uniform margin (click to unlink)" : "Per-side margin (click to link)"}
          data-Zeros="margin-link-toggle"
        >
          {marginLinked ? <Link size={10} /> : <Unlink size={10} />}
          <span className="oc-spacing-link-label">Margin</span>
        </button>
        <button
          className={`oc-spacing-link-btn${paddingLinked ? " is-active" : ""}`}
          onClick={() => setPaddingLinked(!paddingLinked)}
          title={paddingLinked ? "Uniform padding (click to unlink)" : "Per-side padding (click to link)"}
          data-Zeros="padding-link-toggle"
        >
          {paddingLinked ? <Link size={10} /> : <Unlink size={10} />}
          <span className="oc-spacing-link-label">Padding</span>
        </button>
      </div>

      {/* Margin box */}
      <div className="oc-spacing-box oc-spacing-margin-box">
        <span className="oc-spacing-box-label">margin</span>

        {/* Top */}
        {renderCell("margin", "Top", "top")}

        {/* Middle row: Left — Padding Box — Right */}
        <div className="oc-spacing-middle">
          {renderCell("margin", "Left", "left")}

          {/* Padding box */}
          <div className="oc-spacing-box oc-spacing-padding-box">
            <span className="oc-spacing-box-label">padding</span>

            {renderCell("padding", "Top", "top")}

            <div className="oc-spacing-middle">
              {renderCell("padding", "Left", "left")}

              {/* Content */}
              <div className="oc-spacing-content">
                <span className="oc-spacing-content-label">
                  {styles.width || "auto"} &times; {styles.height || "auto"}
                </span>
              </div>

              {renderCell("padding", "Right", "right")}
            </div>

            {renderCell("padding", "Bottom", "bottom")}
          </div>

          {renderCell("margin", "Right", "right")}
        </div>

        {/* Bottom */}
        {renderCell("margin", "Bottom", "bottom")}
      </div>
    </div>
  );
}
