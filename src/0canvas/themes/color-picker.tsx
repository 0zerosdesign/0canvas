// ──────────────────────────────────────────────────────────
// Color Picker — HSL-based color picker for design tokens
// ──────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect } from "react";

// ── Color conversion helpers ─────────────────────────────

function hexToHsl(hex: string): [number, number, number, number] {
  let r = 0, g = 0, b = 0, a = 1;
  const h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) {
    r = parseInt(h[0] + h[0], 16) / 255;
    g = parseInt(h[1] + h[1], 16) / 255;
    b = parseInt(h[2] + h[2], 16) / 255;
    if (h.length === 4) a = parseInt(h[3] + h[3], 16) / 255;
  } else if (h.length === 6 || h.length === 8) {
    r = parseInt(h.substring(0, 2), 16) / 255;
    g = parseInt(h.substring(2, 4), 16) / 255;
    b = parseInt(h.substring(4, 6), 16) / 255;
    if (h.length === 8) a = parseInt(h.substring(6, 8), 16) / 255;
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const lum = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: hue = ((b - r) / d + 2) / 6; break;
      case b: hue = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(hue * 360), Math.round(sat * 100), Math.round(lum * 100 * 10) / 10, Math.round(a * 100) / 100];
}

function hslToHex(h: number, s: number, l: number, a: number = 1): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a < 1) {
    return hex + Math.round(a * 255).toString(16).padStart(2, "0");
  }
  return hex;
}

function parseColor(value: string): [number, number, number, number] {
  const v = value.trim();
  if (v.startsWith("#")) return hexToHsl(v);
  // rgba
  const rgbaMatch = v.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]) / 255;
    const g = parseInt(rgbaMatch[2]) / 255;
    const b = parseInt(rgbaMatch[3]) / 255;
    const a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
    const hex = `#${Math.round(r * 255).toString(16).padStart(2, "0")}${Math.round(g * 255).toString(16).padStart(2, "0")}${Math.round(b * 255).toString(16).padStart(2, "0")}`;
    const [h, s, l] = hexToHsl(hex);
    return [h, s, l, a];
  }
  // hsla
  const hslaMatch = v.match(/hsla?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*(?:,\s*([\d.]+))?\s*\)/);
  if (hslaMatch) {
    return [
      parseFloat(hslaMatch[1]),
      parseFloat(hslaMatch[2]),
      parseFloat(hslaMatch[3]),
      hslaMatch[4] ? parseFloat(hslaMatch[4]) : 1,
    ];
  }
  return [0, 0, 0, 1];
}

// ── Draggable area hook ──────────────────────────────────

function useDrag(onChange: (x: number, y: number) => void) {
  const dragging = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  const getPos = useCallback((clientX: number, clientY: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onChange(x, y);
  }, [onChange]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    getPos(e.clientX, e.clientY);
    const move = (ev: MouseEvent) => { if (dragging.current) getPos(ev.clientX, ev.clientY); };
    const up = () => { dragging.current = false; document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }, [getPos]);

  return { ref, onMouseDown };
}

// ── Color Picker Component ───────────────────────────────

interface ColorPickerProps {
  value: string;
  tokenName: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

export function ColorPicker({ value, tokenName, onChange, onClose }: ColorPickerProps) {
  const [h, s, l, a] = parseColor(value);
  const [hue, setHue] = useState(h);
  const [sat, setSat] = useState(s);
  const [light, setLight] = useState(l);
  const [alpha, setAlpha] = useState(a);
  const [hexInput, setHexInput] = useState(value.startsWith("#") ? value : hslToHex(h, s, l, a));

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  const emitChange = useCallback((h: number, s: number, l: number, a: number) => {
    const hex = hslToHex(h, s, l, a);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  // Saturation/Lightness area
  const slArea = useDrag(useCallback((x: number, y: number) => {
    const newSat = Math.round(x * 100);
    const newLight = Math.round((1 - y) * 100);
    setSat(newSat);
    setLight(newLight);
    emitChange(hue, newSat, newLight, alpha);
  }, [hue, alpha, emitChange]));

  // Hue slider
  const hueSlider = useDrag(useCallback((x: number) => {
    const newHue = Math.round(x * 360);
    setHue(newHue);
    emitChange(newHue, sat, light, alpha);
  }, [sat, light, alpha, emitChange]));

  // Alpha slider
  const alphaSlider = useDrag(useCallback((x: number) => {
    const newAlpha = Math.round(x * 100) / 100;
    setAlpha(newAlpha);
    emitChange(hue, sat, light, newAlpha);
  }, [hue, sat, light, emitChange]));

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setHexInput(v);
    if (/^#[0-9a-fA-F]{6,8}$/.test(v)) {
      const [nh, ns, nl, na] = hexToHsl(v);
      setHue(nh); setSat(ns); setLight(nl); setAlpha(na);
      onChange(v);
    }
  };

  const currentColor = hslToHex(hue, sat, light, alpha);
  const pureHueColor = hslToHex(hue, 100, 50);

  return (
    <div ref={containerRef} className="oc-color-picker" onClick={(e) => e.stopPropagation()}>
      <div className="oc-color-picker-header">
        <span className="oc-color-picker-name">{tokenName}</span>
        <button className="oc-color-picker-close" onClick={onClose}>&times;</button>
      </div>

      {/* Hex input */}
      <div className="oc-color-picker-hex-row">
        <div className="oc-color-picker-swatch" style={{ background: currentColor }} />
        <input
          className="oc-color-picker-hex-input"
          value={hexInput}
          onChange={handleHexChange}
          spellCheck={false}
        />
      </div>

      {/* SL area */}
      <div
        ref={slArea.ref}
        className="oc-color-picker-area"
        onMouseDown={slArea.onMouseDown}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHueColor})`,
        }}
      >
        <div
          className="oc-color-picker-thumb"
          style={{ left: `${sat}%`, top: `${100 - light}%` }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueSlider.ref}
        className="oc-color-picker-hue"
        onMouseDown={hueSlider.onMouseDown}
      >
        <div
          className="oc-color-picker-slider-thumb"
          style={{ left: `${(hue / 360) * 100}%` }}
        />
      </div>

      {/* Alpha slider */}
      <div
        ref={alphaSlider.ref}
        className="oc-color-picker-alpha"
        onMouseDown={alphaSlider.onMouseDown}
        style={{
          background: `linear-gradient(to right, transparent, ${hslToHex(hue, sat, light)})`,
        }}
      >
        <div
          className="oc-color-picker-slider-thumb"
          style={{ left: `${alpha * 100}%` }}
        />
      </div>

      {/* HSL values */}
      <div className="oc-color-picker-values">
        <div className="oc-color-picker-value-group">
          <label>Hue</label>
          <input
            type="number" min="0" max="360"
            value={hue}
            onChange={(e) => { const v = parseInt(e.target.value) || 0; setHue(v); emitChange(v, sat, light, alpha); }}
          />
        </div>
        <div className="oc-color-picker-value-group">
          <label>Saturation</label>
          <input
            type="number" min="0" max="100"
            value={sat}
            onChange={(e) => { const v = parseInt(e.target.value) || 0; setSat(v); emitChange(hue, v, light, alpha); }}
          />
        </div>
        <div className="oc-color-picker-value-group">
          <label>Lightness</label>
          <input
            type="number" min="0" max="100" step="0.1"
            value={light}
            onChange={(e) => { const v = parseFloat(e.target.value) || 0; setLight(v); emitChange(hue, sat, v, alpha); }}
          />
        </div>
        <div className="oc-color-picker-value-group">
          <label>Alpha</label>
          <input
            type="number" min="0" max="1" step="0.01"
            value={alpha}
            onChange={(e) => { const v = parseFloat(e.target.value) || 0; setAlpha(v); emitChange(hue, sat, light, v); }}
          />
        </div>
      </div>
    </div>
  );
}
