// ──────────────────────────────────────────────────────────
// DOM Inspector — Barrel export (public API)
// ──────────────────────────────────────────────────────────
//
// This re-exports every public function from the split modules
// so that existing imports like:
//   import { buildElementTree } from "../inspector/dom-inspector"
// continue to work when redirected to:
//   import { buildElementTree } from "../inspector"

// ── Target management ──────────────────────────────────────

import { setTarget, resetTarget, getTargetDoc } from "./target";
import {
  cleanupOverlay,
  clearOverlayRefs,
  highlightElement,
} from "./overlay";
import { hideInspectorPill } from "./feedback-pill";
import {
  cleanupWalker,
  getElementById,
  rebuildElementMap,
  buildElementTree,
  walkElement,
  applyStyle,
  flashElement,
  generateAgentOutput,
  capturePageSnapshot,
  captureComponentSnapshot,
  getElementOuterHTML,
  pushVariantToMain,
  elementMap,
  toAbsolute,
} from "./dom-walker";
import {
  startInspect,
  stopInspect,
  isInspecting,
  setInspectMode,
  getInspectMode,
  dismissSelection,
  cleanupInspectMode,
} from "./inspect-mode";
import {
  showInspectorPill,
  hideInspectorPill as hideFeedbackPill,
  onForkElementRequest,
  onChangeRequest,
  onDeleteFeedbackRequest,
  setFeedbackLookup,
  onEditFeedbackRequest,
  renderFeedbackMarkers,
  clearFeedbackMarkers,
  cleanupFeedbackPill,
} from "./feedback-pill";
import {
  showThemeInspectorPill,
  setThemeTokensProvider,
  onThemeChangeRequest,
  setThemeChangesProvider,
  onThemeResetRequest,
  renderThemeChangeMarkers,
  clearThemeChangeMarkers,
  cleanupThemePill,
} from "./theme-pill";

// ── setInspectionTarget / resetInspectionTarget ────────────
// These orchestrate target + overlay cleanup, matching the
// original monolith's behavior.

export function setInspectionTarget(
  doc: Document,
  iframe: HTMLIFrameElement | null = null
): void {
  const currentDoc = getTargetDoc();
  if (currentDoc !== doc) {
    cleanupOverlay();
    hideInspectorPill();
  }
  setTarget(doc, iframe);
}

export function resetInspectionTarget(): void {
  const currentDoc = getTargetDoc();
  if (currentDoc !== document) {
    cleanupOverlay();
    hideInspectorPill();
  }
  resetTarget();
}

// ── Master cleanup ─────────────────────────────────────────

export function cleanup(): void {
  cleanupOverlay();
  cleanupFeedbackPill();
  cleanupThemePill();
  cleanupInspectMode();
  cleanupWalker();
  resetInspectionTarget();
}

// ── Re-exports ─────────────────────────────────────────────

export {
  // dom-walker
  buildElementTree,
  walkElement,
  rebuildElementMap,
  getElementById,
  applyStyle,
  flashElement,
  generateAgentOutput,
  capturePageSnapshot,
  captureComponentSnapshot,
  getElementOuterHTML,
  pushVariantToMain,
  elementMap,
  toAbsolute,
  // overlay
  highlightElement,
  // inspect-mode
  startInspect,
  stopInspect,
  isInspecting,
  setInspectMode,
  getInspectMode,
  dismissSelection,
  // feedback-pill
  showInspectorPill,
  onForkElementRequest,
  onChangeRequest,
  onDeleteFeedbackRequest,
  setFeedbackLookup,
  onEditFeedbackRequest,
  renderFeedbackMarkers,
  clearFeedbackMarkers,
  // theme-pill
  showThemeInspectorPill,
  setThemeTokensProvider,
  onThemeChangeRequest,
  setThemeChangesProvider,
  onThemeResetRequest,
  renderThemeChangeMarkers,
  clearThemeChangeMarkers,
};

// Re-export the hideInspectorPill under its original name
export { hideInspectorPill };
