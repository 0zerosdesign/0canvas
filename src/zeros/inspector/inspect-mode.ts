// ──────────────────────────────────────────────────────────
// Inspect Mode — Click-to-inspect interaction logic
// ──────────────────────────────────────────────────────────

import { OC_ATTR } from "./constants";
import { elementMap, rebuildElementMap } from "./dom-walker";
import { EventManager } from "./event-manager";
import {
  highlightElement,
  setLastClickPos,
  setOverlayPillCallbacks,
} from "./overlay";
import {
  showInspectorPill,
  hideInspectorPill,
  setDismissSelection,
} from "./feedback-pill";
import {
  showThemeInspectorPill,
  hideThemeInspectorPill,
  setThemeDismissSelection,
  setThemePauseInspection,
} from "./theme-pill";
import { getTargetDoc } from "./target";

// ── EventManager for inspect listeners ─────────────────────

const events = new EventManager();

// ── Mutable state ──────────────────────────────────────────

type InspectCallback = (elementId: string, element: Element) => void;

let inspectActive = false;
let inspectHandler: ((e: MouseEvent) => void) | null = null;
let inspectHoverHandler: ((e: MouseEvent) => void) | null = null;
let _inspectMode: "feedback" | "theme" | "style" = "style";

// ── Mode getters/setters ───────────────────────────────────

export function setInspectMode(
  mode: "feedback" | "theme" | "style"
): void {
  _inspectMode = mode;
}

export function getInspectMode(): "feedback" | "theme" | "style" {
  return _inspectMode;
}

// ── Pause / resume inspection ──────────────────────────────

function pauseInspection(): void {
  const targetDoc = getTargetDoc();
  if (inspectHoverHandler) {
    targetDoc.removeEventListener("mousemove", inspectHoverHandler, true);
  }
  if (inspectHandler) {
    targetDoc.removeEventListener("click", inspectHandler, true);
  }
  highlightElement(null, "hover");
  if (targetDoc.body) {
    targetDoc.body.style.cursor = "";
  }
}

function resumeInspection(): void {
  const targetDoc = getTargetDoc();
  if (!inspectActive) return;
  if (inspectHoverHandler) {
    targetDoc.addEventListener("mousemove", inspectHoverHandler, true);
  }
  if (inspectHandler) {
    targetDoc.addEventListener("click", inspectHandler, true);
  }
  if (targetDoc.body) {
    targetDoc.body.style.cursor = "crosshair";
  }
}

/**
 * Dismiss the current selection — hides pill + overlay then resumes
 * inspect mode.
 */
export function dismissSelection(): void {
  hideInspectorPill();
  hideThemeInspectorPill();
  highlightElement(null, "select");
  resumeInspection();
}

// ── Wire up cross-module callbacks ─────────────────────────
// These need to run at module load time so the pills can
// call back into inspect-mode for pause/resume/dismiss.

setDismissSelection(dismissSelection);
setThemeDismissSelection(dismissSelection);
setThemePauseInspection(pauseInspection);

// Wire the overlay to show the correct pill based on inspect mode
setOverlayPillCallbacks(
  (el: Element, clickX: number, clickY: number) => {
    if (_inspectMode === "theme") {
      showThemeInspectorPill(el, clickX, clickY);
    } else if (_inspectMode === "feedback") {
      showInspectorPill(el, clickX, clickY);
    } else {
      // "style" mode — no pill, just selection highlight
      hideInspectorPill();
      hideThemeInspectorPill();
    }
  },
  () => {
    hideInspectorPill();
    hideThemeInspectorPill();
  }
);

// ── Start / stop inspect ───────────────────────────────────

/**
 * Start click-to-inspect mode.
 * Listens on the TARGET document (iframe or main page).
 */
export function startInspect(onSelect: InspectCallback): void {
  stopInspect();
  inspectActive = true;

  const targetDoc = getTargetDoc();

  rebuildElementMap();

  inspectHoverHandler = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.hasAttribute(OC_ATTR) || target.closest(`[${OC_ATTR}]`))
      return;

    const id = elementMap.get(target);
    if (id) highlightElement(id, "hover");
  };

  inspectHandler = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.hasAttribute(OC_ATTR) || target.closest(`[${OC_ATTR}]`))
      return;

    e.preventDefault();
    e.stopPropagation();

    // Dismiss any existing selection before selecting new
    hideInspectorPill();
    hideThemeInspectorPill();
    highlightElement(null, "select");

    setLastClickPos({ x: e.clientX, y: e.clientY });

    const id = elementMap.get(target);
    if (id) {
      highlightElement(null, "hover");
      highlightElement(id, "select", e.clientX, e.clientY);
      onSelect(id, target);
    }
  };

  events.add(targetDoc, "mousemove", inspectHoverHandler, true);
  events.add(targetDoc, "click", inspectHandler, true);

  if (targetDoc.body) {
    targetDoc.body.style.cursor = "crosshair";
  }
}

/**
 * Stop click-to-inspect mode. Dismisses all overlays and pills.
 */
export function stopInspect(): void {
  const targetDoc = getTargetDoc();

  if (inspectHandler) {
    targetDoc.removeEventListener("click", inspectHandler, true);
    inspectHandler = null;
  }
  if (inspectHoverHandler) {
    targetDoc.removeEventListener("mousemove", inspectHoverHandler, true);
    inspectHoverHandler = null;
  }
  highlightElement(null, "hover");
  dismissSelection();
  if (targetDoc.body) {
    targetDoc.body.style.cursor = "";
  }
  inspectActive = false;
  events.cleanup();
}

export function isInspecting(): boolean {
  return inspectActive;
}

/** Cleanup inspect mode resources */
export function cleanupInspectMode(): void {
  stopInspect();
  events.cleanup();
}
