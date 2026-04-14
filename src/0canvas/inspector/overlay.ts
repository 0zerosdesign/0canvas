// ──────────────────────────────────────────────────────────
// Overlay — Hover/select highlight overlays
// ──────────────────────────────────────────────────────────

import { identifyElement } from "./component-detection";
import {
  OC_ATTR,
  OC_PRIMARY,
  OC_SURFACE_FLOOR,
  OC_TEXT_MUTED,
  OC_BORDER_0,
  OC_FONT_SANS,
  OC_FONT_MONO,
} from "./constants";
import { getElementById, toAbsolute } from "./dom-walker";
import { getTargetDoc } from "./target";

// ── Mutable state ──────────────────────────────────────────

let highlightOverlay: HTMLDivElement | null = null;
let selectOverlay: HTMLDivElement | null = null;
let _selectedEl: Element | null = null;

export function getSelectedEl(): Element | null {
  return _selectedEl;
}

export function setSelectedEl(el: Element | null): void {
  _selectedEl = el;
}

export function getHighlightOverlay(): HTMLDivElement | null {
  return highlightOverlay;
}

export function getSelectOverlay(): HTMLDivElement | null {
  return selectOverlay;
}

export function clearOverlayRefs(): void {
  highlightOverlay = null;
  selectOverlay = null;
  _selectedEl = null;
}

// ── Overlay creation ───────────────────────────────────────

function ensureOverlay(type: "hover" | "select"): HTMLDivElement {
  const targetDoc = getTargetDoc();
  const isHover = type === "hover";
  let overlay = isHover ? highlightOverlay : selectOverlay;

  if (overlay) {
    try {
      if (overlay.ownerDocument !== targetDoc) {
        if (overlay.parentNode) overlay.remove();
        overlay = null;
        if (isHover) highlightOverlay = null;
        else selectOverlay = null;
      }
    } catch {
      overlay = null;
      if (isHover) highlightOverlay = null;
      else selectOverlay = null;
    }
  }

  if (!overlay) {
    overlay = targetDoc.createElement("div");
    overlay.setAttribute(OC_ATTR, "overlay");

    if (isHover) {
      overlay.style.cssText = `
        position: absolute;
        pointer-events: none;
        z-index: 2147483646;
        border: 1.5px dashed ${OC_PRIMARY}99;
        background: ${OC_PRIMARY}0A;
        border-radius: 2px;
        display: none;
        box-sizing: border-box;
      `;

      const hoverLabel = targetDoc.createElement("div");
      hoverLabel.setAttribute("data-oc-role", "hover-label");
      hoverLabel.style.cssText = `
        position: absolute;
        top: -26px;
        left: -1.5px;
        padding: 2px 8px;
        border-radius: 4px 4px 0 0;
        background: ${OC_PRIMARY};
        color: #fff;
        font-size: 10px;
        font-family: ${OC_FONT_SANS};
        font-weight: 500;
        white-space: nowrap;
        line-height: 18px;
        pointer-events: none;
        box-sizing: border-box;
      `;
      overlay.appendChild(hoverLabel);
    } else {
      overlay.style.cssText = `
        position: absolute;
        pointer-events: none;
        z-index: 2147483646;
        border: 2px solid ${OC_PRIMARY};
        background: ${OC_PRIMARY}0F;
        border-radius: 2px;
        display: none;
        box-sizing: border-box;
      `;

      const tagLabel = targetDoc.createElement("div");
      tagLabel.setAttribute("data-oc-role", "tag-label");
      tagLabel.style.cssText = `
        position: absolute;
        top: -26px;
        left: -2px;
        padding: 2px 10px;
        border-radius: 4px 4px 0 0;
        background: ${OC_PRIMARY};
        color: #fff;
        font-size: 11px;
        font-family: ${OC_FONT_SANS};
        font-weight: 500;
        white-space: nowrap;
        line-height: 18px;
        pointer-events: none;
        box-sizing: border-box;
      `;
      overlay.appendChild(tagLabel);

      const sizeLabel = targetDoc.createElement("div");
      sizeLabel.setAttribute("data-oc-role", "size-label");
      sizeLabel.style.cssText = `
        position: absolute;
        bottom: -20px;
        left: -2px;
        padding: 1px 6px;
        border-radius: 0 0 4px 4px;
        background: ${OC_SURFACE_FLOOR};
        color: ${OC_TEXT_MUTED};
        font-size: 9px;
        font-family: ${OC_FONT_MONO};
        white-space: nowrap;
        line-height: 14px;
        pointer-events: none;
        border: 1px solid ${OC_BORDER_0};
        border-top: none;
        box-sizing: border-box;
      `;
      overlay.appendChild(sizeLabel);
    }

    targetDoc.body?.appendChild(overlay);
    if (isHover) highlightOverlay = overlay;
    else selectOverlay = overlay;
  }

  return overlay;
}

// ── Pill show callback (set by inspect-mode) ──────────────

type PillShowFn = (el: Element, clickX: number, clickY: number) => void;
type PillHideFn = () => void;

let _showPillForMode: PillShowFn | null = null;
let _hidePill: PillHideFn | null = null;

/**
 * Register the pill-show function so the overlay can trigger it on selection.
 * Called once by inspect-mode during initialization.
 */
export function setOverlayPillCallbacks(show: PillShowFn, hide: PillHideFn): void {
  _showPillForMode = show;
  _hidePill = hide;
}

// ── Exported highlight function ────────────────────────────

let _lastClickPos: { x: number; y: number } = { x: 0, y: 0 };

export function getLastClickPos(): { x: number; y: number } {
  return _lastClickPos;
}

export function setLastClickPos(pos: { x: number; y: number }): void {
  _lastClickPos = pos;
}

/**
 * Show a highlight overlay on a DOM element.
 * For "select" type, also shows the inspector pill at the cursor position.
 */
export function highlightElement(
  elementId: string | null,
  type: "hover" | "select" = "hover",
  clickX?: number,
  clickY?: number
): void {
  const targetDoc = getTargetDoc();
  const overlay = ensureOverlay(type);

  if (!elementId) {
    overlay.style.display = "none";
    if (type === "select") {
      _selectedEl = null;
      if (_hidePill) _hidePill();
    }
    return;
  }

  const el = getElementById(elementId);
  if (!el) {
    overlay.style.display = "none";
    return;
  }

  const rect = el.getBoundingClientRect();
  const abs = toAbsolute(rect, targetDoc);
  overlay.style.display = "block";
  overlay.style.top = `${abs.top}px`;
  overlay.style.left = `${abs.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  if (type === "hover") {
    const hoverLabel = overlay.querySelector(
      "[data-oc-role='hover-label']"
    ) as HTMLElement;
    if (hoverLabel) {
      hoverLabel.textContent = identifyElement(el).displayName;
    }
  }

  if (type === "select") {
    _selectedEl = el;

    const tagLabel = overlay.querySelector(
      "[data-oc-role='tag-label']"
    ) as HTMLElement;
    if (tagLabel) {
      tagLabel.textContent = identifyElement(el).displayName;
    }

    const sizeLabel = overlay.querySelector(
      "[data-oc-role='size-label']"
    ) as HTMLElement;
    if (sizeLabel) {
      sizeLabel.textContent = `${Math.round(rect.width)} \u00d7 ${Math.round(rect.height)}`;
    }

    const cx = clickX ?? _lastClickPos.x;
    const cy = clickY ?? _lastClickPos.y;

    if (_showPillForMode) {
      _showPillForMode(el, cx, cy);
    }
  }
}

/** Cleanup overlays */
export function cleanupOverlay(): void {
  if (highlightOverlay?.parentNode) highlightOverlay.remove();
  if (selectOverlay?.parentNode) selectOverlay.remove();
  highlightOverlay = null;
  selectOverlay = null;
  _selectedEl = null;
}
