// ──────────────────────────────────────────────────────────
// Visual Diff — Before/After comparison overlay
// ──────────────────────────────────────────────────────────
//
// Shows two iframes side by side: the previous variant state
// (from variantHistory) and the current state. A draggable
// slider lets the designer wipe between them.
//
// ──────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "../ui";

interface VisualDiffProps {
  /** The previous variant HTML/CSS (before the AI change) */
  before: { html: string; css: string };
  /** The current variant HTML/CSS (after the AI change) */
  after: { html: string; css: string };
  /** Variant name for display */
  variantName: string;
  /** Viewport width to render both iframes */
  viewportWidth?: number;
  /** Close the overlay */
  onClose: () => void;
}

function buildSrcdoc(html: string, css: string): string {
  // Split CSS into @import rules and regular rules, filtering out internal rules
  const importLines: string[] = [];
  const ruleLines: string[] = [];

  const rules = css.split(/\n(?=[@.#\[:*a-zA-Z])/);
  for (const rule of rules) {
    const trimmed = rule.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("@import ")) {
      importLines.push(trimmed);
    } else if (
      !trimmed.includes("[data-Zeros") &&
      !trimmed.includes(".react-flow") &&
      !trimmed.includes("--xy-") &&
      !trimmed.includes("--oc-")
    ) {
      ruleLines.push(trimmed);
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${importLines.join("\n")}</style>
<style>*,*::before,*::after{box-sizing:border-box;}body{margin:0;overflow:auto;width:100%;min-height:100%;height:fit-content;}
${ruleLines.join("\n")}</style>
</head>
<body>${html}</body>
</html>`;
}

export function VisualDiff({
  before,
  after,
  variantName,
  viewportWidth = 560,
  onClose,
}: VisualDiffProps) {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0-100
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const beforeSrcdoc = buildSrcdoc(before.html, before.css);
  const afterSrcdoc = buildSrcdoc(after.html, after.css);

  // ── Slider drag handling ─────────────────────────────────

  const updateSlider = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    updateSlider(e.clientX);

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      updateSlider(ev.clientX);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, [updateSlider]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="oc-vdiff-overlay" onClick={onClose}>
      <div className="oc-vdiff-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="oc-vdiff-header">
          <div className="oc-vdiff-header-left">
            <span className="oc-vdiff-title">Visual Diff</span>
            <span className="oc-vdiff-variant-name">{variantName}</span>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </Button>
        </div>

        {/* Comparison area */}
        <div className="oc-vdiff-body" ref={containerRef}>
          {/* Before — full width, clipped by slider */}
          <div
            className="oc-vdiff-pane oc-vdiff-before"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            <div className="oc-vdiff-label oc-vdiff-label-before">Before</div>
            <iframe
              srcDoc={beforeSrcdoc}
              sandbox="allow-same-origin"
              title="Before"
              style={{ width: viewportWidth, maxWidth: "100%", height: "100%", border: "none" }}
            />
          </div>

          {/* After — full width, clipped by slider */}
          <div
            className="oc-vdiff-pane oc-vdiff-after"
            style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
          >
            <div className="oc-vdiff-label oc-vdiff-label-after">After</div>
            <iframe
              srcDoc={afterSrcdoc}
              sandbox="allow-same-origin"
              title="After"
              style={{ width: viewportWidth, maxWidth: "100%", height: "100%", border: "none" }}
            />
          </div>

          {/* Slider handle */}
          <div
            className="oc-vdiff-slider"
            style={{ left: `${sliderPos}%` }}
            onMouseDown={handleMouseDown}
          >
            <div className="oc-vdiff-slider-line" />
            <div className="oc-vdiff-slider-handle">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3L1 6L3 9" />
                <path d="M9 3L11 6L9 9" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
