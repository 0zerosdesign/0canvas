// ──────────────────────────────────────────────────────────
// Layout Editor — Flex/Grid controls with 9-dot alignment
// ──────────────────────────────────────────────────────────

import React, { useCallback } from "react";
import {
  ArrowRight, ArrowDown, ArrowLeft, ArrowUp,
  WrapText,
} from "lucide-react";
import { SegmentedControl, NumberInputWithUnit } from "./controls";
import { useStyleChange, useBridgeStatus } from "../bridge/use-bridge";
import { useWorkspace } from "../store/store";
import { applyStyle } from "../inspector";

interface LayoutEditorProps {
  elementId: string;
  selector: string;
  styles: Record<string, string>;
}

// ── 9-dot alignment grid ─────────────────────────────────

const JUSTIFY_MAP = ["flex-start", "center", "flex-end"] as const;
const ALIGN_MAP = ["flex-start", "center", "flex-end"] as const;

function AlignmentGrid({
  justifyContent,
  alignItems,
  onChange,
}: {
  justifyContent: string;
  alignItems: string;
  onChange: (justify: string, align: string) => void;
}) {
  const getJIdx = () => JUSTIFY_MAP.indexOf(justifyContent as typeof JUSTIFY_MAP[number]);
  const getAIdx = () => ALIGN_MAP.indexOf(alignItems as typeof ALIGN_MAP[number]);

  return (
    <div className="oc-align-grid" data-0canvas="align-grid">
      {ALIGN_MAP.map((align, row) => (
        <div key={align} className="oc-align-grid-row">
          {JUSTIFY_MAP.map((justify, col) => {
            const active = getJIdx() === col && getAIdx() === row;
            return (
              <button
                key={`${row}-${col}`}
                className={`oc-align-dot${active ? " is-active" : ""}`}
                onClick={() => onChange(justify, align)}
                title={`justify-content: ${justify}; align-items: ${align}`}
                data-0canvas="align-dot"
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Main Layout Editor ───────────────────────────────────

export function LayoutEditor({ elementId, selector, styles }: LayoutEditorProps) {
  const { dispatch } = useWorkspace();
  const sendStyleChange = useStyleChange();
  const bridgeStatus = useBridgeStatus();

  const apply = useCallback(
    async (property: string, value: string) => {
      const kebab = property.replace(/([A-Z])/g, "-$1").toLowerCase();
      dispatch({ type: "UPDATE_STYLE", elementId, property, value });
      applyStyle(elementId, kebab, value);
      if (bridgeStatus === "connected") {
        await sendStyleChange(selector, kebab, value);
      }
    },
    [elementId, selector, dispatch, sendStyleChange, bridgeStatus]
  );

  const display = styles.display || "block";
  const isFlex = display === "flex" || display === "inline-flex";

  return (
    <div className="oc-layout-editor" data-0canvas="layout-editor">
      {/* Display */}
      <div className="oc-editor-row">
        <span className="oc-editor-label">Display</span>
        <SegmentedControl
          options={[
            { value: "flex", label: "Flex", title: "display: flex" },
            { value: "block", label: "Block", title: "display: block" },
            { value: "inline", label: "Inline", title: "display: inline" },
            { value: "grid", label: "Grid", title: "display: grid" },
            { value: "none", label: "None", title: "display: none" },
          ]}
          value={display}
          onChange={(v) => apply("display", v)}
        />
      </div>

      {/* Flex-specific controls */}
      {isFlex && (
        <>
          {/* Direction + Wrap */}
          <div className="oc-editor-row">
            <span className="oc-editor-label">Direction</span>
            <div className="oc-editor-inline">
              <SegmentedControl
                options={[
                  { value: "row", icon: <ArrowRight size={12} />, title: "flex-direction: row" },
                  { value: "column", icon: <ArrowDown size={12} />, title: "flex-direction: column" },
                  { value: "row-reverse", icon: <ArrowLeft size={12} />, title: "flex-direction: row-reverse" },
                  { value: "column-reverse", icon: <ArrowUp size={12} />, title: "flex-direction: column-reverse" },
                ]}
                value={styles.flexDirection || "row"}
                onChange={(v) => apply("flexDirection", v)}
              />
              <button
                className={`oc-toggle-btn-sm${styles.flexWrap === "wrap" ? " is-active" : ""}`}
                onClick={() => apply("flexWrap", styles.flexWrap === "wrap" ? "nowrap" : "wrap")}
                title="flex-wrap"
                data-0canvas="wrap-toggle"
              >
                <WrapText size={12} />
              </button>
            </div>
          </div>

          {/* 9-dot Alignment Grid */}
          <div className="oc-editor-row">
            <span className="oc-editor-label">Align</span>
            <AlignmentGrid
              justifyContent={styles.justifyContent || "flex-start"}
              alignItems={styles.alignItems || "stretch"}
              onChange={(j, a) => {
                apply("justifyContent", j);
                apply("alignItems", a);
              }}
            />
          </div>

          {/* Gap */}
          <div className="oc-editor-row">
            <span className="oc-editor-label">Gap</span>
            <NumberInputWithUnit
              label="gap"
              value={styles.gap || "0px"}
              onChange={(v) => apply("gap", v)}
              units={["px", "rem"]}
              min={0}
            />
          </div>
        </>
      )}

      {/* Overflow */}
      {styles.overflow && (
        <div className="oc-editor-row">
          <span className="oc-editor-label">Overflow</span>
          <SegmentedControl
            options={[
              { value: "visible", label: "Vis", title: "overflow: visible" },
              { value: "hidden", label: "Hide", title: "overflow: hidden" },
              { value: "scroll", label: "Scroll", title: "overflow: scroll" },
              { value: "auto", label: "Auto", title: "overflow: auto" },
            ]}
            value={styles.overflow || "visible"}
            onChange={(v) => apply("overflow", v)}
          />
        </div>
      )}

      {/* Z-index */}
      {styles.zIndex && (
        <div className="oc-editor-row">
          <span className="oc-editor-label">Z-index</span>
          <NumberInputWithUnit
            label="z-index"
            value={styles.zIndex || "0"}
            onChange={(v) => apply("zIndex", v)}
            units={[""]}
          />
        </div>
      )}
    </div>
  );
}
