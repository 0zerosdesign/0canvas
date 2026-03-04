// DesignDead — Visual feedback engine for AI-powered dev
//
// Usage:
//   import { DesignDead } from "designdead";
//   <DesignDead />

// Main component
export { DesignDead } from "./app/components/designdead-engine";
export type { DesignDeadProps } from "./app/components/designdead-engine";

// Default export for convenience
export { DesignDead as default } from "./app/components/designdead-engine";

// DOM Inspector utilities (for building custom UIs)
export {
  buildElementTree,
  rebuildElementMap,
  getElementById,
  highlightElement,
  applyStyle,
  startInspect,
  stopInspect,
  isInspecting,
  generateAgentOutput,
  cleanup,
  setInspectionTarget,
  resetInspectionTarget,
  capturePageSnapshot,
  captureComponentSnapshot,
  pushVariantToMain,
  getElementOuterHTML,
} from "./app/components/dom-inspector";

// Runtime CSS injection (for advanced consumers)
export { injectStyles, removeStyles } from "./app/components/designdead-styles";

// Store types (for TypeScript consumers)
export type {
  ElementNode,
  StyleChange,
  FeedbackItem,
  FeedbackIntent,
  FeedbackSeverity,
  VariantData,
  DDProject,
} from "./app/store";