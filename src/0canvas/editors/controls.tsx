// ──────────────────────────────────────────────────────────
// Shared UI Controls — Reusable primitives for editors
// ──────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from "react";

// ── Segmented Control ────────────────────────────────────

interface SegmentedOption {
  value: string;
  label?: string;
  icon?: React.ReactNode;
  title?: string;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
}

export function SegmentedControl({ options, value, onChange, size = "sm" }: SegmentedControlProps) {
  return (
    <div className={`oc-segmented oc-segmented-${size}`} data-0canvas="segmented">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`oc-segmented-btn${value === opt.value ? " is-active" : ""}`}
          onClick={() => onChange(opt.value)}
          title={opt.title ?? opt.label ?? opt.value}
          data-0canvas="segmented-btn"
        >
          {opt.icon ?? opt.label ?? opt.value}
        </button>
      ))}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

/** Clamp + round to avoid floating-point dust */
function clampAndRound(val: number, min?: number, max?: number): number {
  let v = Math.round(val * 100) / 100;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return v;
}

// ── Number Input with Unit ───────────────────────────────

interface NumberInputWithUnitProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  units?: string[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export function NumberInputWithUnit({
  label,
  value,
  onChange,
  units = ["px", "rem", "em", "%", "vw", "vh"],
  min,
  max,
  step = 1,
  placeholder = "–",
}: NumberInputWithUnitProps) {
  // Parse value into number + unit
  const match = value.match(/^(-?[\d.]+)\s*([\w%]+)?$/);
  const numValue = match ? match[1] : "";
  const currentUnit = match?.[2] || "px";

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(numValue);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!editing) setEditValue(numValue);
  }, [numValue, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const applyDelta = useCallback(
    (delta: number, multiplier: number) => {
      const num = parseFloat(numValue || "0");
      const next = clampAndRound(num + delta * multiplier, min, max);
      onChange(`${next}${currentUnit}`);
    },
    [numValue, currentUnit, onChange, min, max],
  );

  const handleCommit = () => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed === "" || trimmed === numValue) return;
    // If bare number, add current unit
    const final = /^-?[\d.]+$/.test(trimmed) ? `${trimmed}${currentUnit}` : trimmed;
    onChange(final);
  };

  const handleUnitChange = (newUnit: string) => {
    if (numValue) {
      onChange(`${numValue}${newUnit}`);
    }
  };

  // ── Scroll-wheel scrub ──────────────────────────────────
  const handleScrub = (e: React.WheelEvent) => {
    e.preventDefault();
    const num = parseFloat(numValue || "0");
    const delta = e.deltaY < 0 ? step : -step;
    const next = clampAndRound(num + delta, min, max);
    onChange(`${next}${currentUnit}`);
  };

  // ── Arrow-key increment (when input is focused) ─────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCommit();
      return;
    }
    if (e.key === "Escape") {
      setEditValue(numValue);
      setEditing(false);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? 1 : -1;
      const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      const num = parseFloat(editValue || numValue || "0");
      const next = clampAndRound(num + delta * multiplier, min, max);
      setEditValue(String(next));
      onChange(`${next}${currentUnit}`);
    }
  };

  // ── Arrow-key increment on the display value ────────────
  const handleValueKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? 1 : -1;
      const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      applyDelta(delta, multiplier);
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setEditValue(numValue);
      setEditing(true);
    }
  };

  // ── Label-drag scrubbing ────────────────────────────────
  const handleLabelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startValue = parseFloat(numValue || "0");

      setIsScrubbing(true);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        const deltaX = ev.clientX - startX;
        const multiplier = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
        // 1 unit per 2 pixels of horizontal movement
        const sensitivity = 0.5;
        const next = clampAndRound(startValue + deltaX * sensitivity * multiplier, min, max);
        onChange(`${next}${currentUnit}`);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setIsScrubbing(false);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [numValue, currentUnit, onChange, min, max],
  );

  return (
    <div className="oc-num-field" data-0canvas="num-input">
      {label && (
        <span
          ref={labelRef}
          className={`oc-num-label${isScrubbing ? " is-scrubbing" : ""}`}
          onMouseDown={handleLabelMouseDown}
        >
          {label}
        </span>
      )}
      <div className="oc-num-row">
        {editing ? (
          <input
            ref={inputRef}
            className="oc-num-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            data-0canvas="num-input-field"
          />
        ) : (
          <span
            className="oc-num-value"
            tabIndex={0}
            onClick={() => { setEditValue(numValue); setEditing(true); }}
            onWheel={handleScrub}
            onKeyDown={handleValueKeyDown}
            title="Click to edit, scroll to scrub, drag label to adjust"
          >
            {numValue || placeholder}
          </span>
        )}
        {units.length > 1 ? (
          <select
            className="oc-num-unit"
            value={currentUnit}
            onChange={(e) => handleUnitChange(e.target.value)}
            data-0canvas="num-unit"
          >
            {units.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        ) : (
          <span className="oc-num-unit-label">{currentUnit}</span>
        )}
      </div>
    </div>
  );
}

// ── Slider Input ─────────────────────────────────────────

interface SliderInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export function SliderInput({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  suffix = "",
}: SliderInputProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const [isScrubbing, setIsScrubbing] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);

  // ── Arrow-key increment on the slider ───────────────────
  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? step : -step;
      const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      const next = clampAndRound(value + delta * multiplier, min, max);
      onChange(next);
    }
    // Let ArrowLeft/ArrowRight pass through for native slider behavior
  };

  // ── Label-drag scrubbing for slider ─────────────────────
  const handleLabelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startValue = value;
      const range = max - min;

      setIsScrubbing(true);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        const deltaX = ev.clientX - startX;
        const multiplier = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
        // Scale sensitivity relative to range: full range over ~200px
        const sensitivity = range / 200;
        const next = clampAndRound(startValue + deltaX * sensitivity * multiplier, min, max);
        onChange(next);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setIsScrubbing(false);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [value, onChange, min, max],
  );

  return (
    <div className="oc-slider-field" data-0canvas="slider">
      {label && (
        <span
          className={`oc-slider-label${isScrubbing ? " is-scrubbing" : ""}`}
          onMouseDown={handleLabelMouseDown}
        >
          {label}
        </span>
      )}
      <div className="oc-slider-row">
        <input
          ref={sliderRef}
          type="range"
          className="oc-slider-track"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onKeyDown={handleSliderKeyDown}
          style={{ background: `linear-gradient(to right, var(--color--base--primary) ${pct}%, var(--color--surface--2) ${pct}%)` }}
          data-0canvas="slider-range"
        />
        <span className="oc-slider-value">
          {Math.round(value * 100) / 100}{suffix}
        </span>
      </div>
    </div>
  );
}
