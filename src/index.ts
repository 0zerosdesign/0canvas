// ZeroCanvas — Visual feedback engine for AI-powered dev
//
// Usage:
//   import { ZeroCanvas } from "0canvas";
//   <ZeroCanvas />

// Main component
export { ZeroCanvas } from "./0canvas/engine/0canvas-engine";
export type { ZeroCanvasProps } from "./0canvas/engine/0canvas-engine";

// Default export for convenience
export { ZeroCanvas as default } from "./0canvas/engine/0canvas-engine";

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
  onForkElementRequest,
  onChangeRequest,
  renderFeedbackMarkers,
  clearFeedbackMarkers,
  onEditFeedbackRequest,
} from "./0canvas/inspector";

// Component detection (for building custom UIs)
export { identifyElement } from "./0canvas/inspector/component-detection";
export type { ComponentInfo } from "./0canvas/inspector/component-detection";

// Runtime CSS injection (for advanced consumers)
export { injectStyles, removeStyles } from "./0canvas/engine/0canvas-styles";

// Store types (for TypeScript consumers)
export type {
  ElementNode,
  FeedbackItem,
  FeedbackIntent,
  FeedbackSeverity,
  VariantData,
  OCProject,
} from "./0canvas/store/store";

// .0c format — design-as-code variant format
export {
  OC_FORMAT_VERSION,
  DEFAULT_BREAKPOINTS,
  createOCDocument,
  findNodeById,
  updateNodeById,
  deleteNodeById,
  insertNode,
  countOCNodes,
} from "./0canvas/format/oc-format";
export type {
  OCDocument,
  OCNode,
  OCStyles,
  OCVariable,
  OCBreakpoints,
  OCBreakpoint,
  OCResponsive,
} from "./0canvas/format/oc-format";
export { htmlToOCDocument, ocDocumentToHtml } from "./0canvas/format/oc-parser";

// .0c project file — whole-project format
export {
  OC_PROJECT_SCHEMA_VERSION,
  OCProjectFileSchema,
  DEFAULT_PROJECT_BREAKPOINTS,
  validateOCProjectFile,
  migrateProjectFile,
  computeProjectHash,
  createEmptyProjectFile,
  stateToProjectFile,
  projectFileToState,
  serializeProjectFile,
  parseProjectFile,
} from "./0canvas/format/oc-project";
export type {
  OCProjectFile,
  OCProjectMeta,
  OCWorkspaceMeta,
  OCBreakpointsConfig,
  OCPage,
  OCVariant,
  OCAnnotation,
  OCFeedback,
  OCCheckpoint,
  OCIntegrity,
  OCLayerNode,
  OCValidationResult,
} from "./0canvas/format/oc-project";

// Bridge — WebSocket communication with 0canvas engine
export { BridgeProvider, useBridge, useBridgeStatus, useExtensionConnected, useStyleChange } from "./0canvas/bridge/use-bridge";
export { CanvasBridgeClient } from "./0canvas/bridge/ws-client";
export type { ConnectionStatus } from "./0canvas/bridge/ws-client";
export type { BridgeMessage, StyleChangeMessage, StyleChangeAckMessage } from "./0canvas/bridge/messages";

// .0c project store — IndexedDB persistence + import/export
export {
  saveProjectFile,
  loadProjectFile,
  listProjectFiles,
  deleteProjectFile,
  downloadProjectFile,
  importProjectFile,
  scheduleAutoSave,
  buildCurrentProjectFile,
  setBridgeSender,
} from "./0canvas/format/oc-project-store";
export type { OCSyncMeta } from "./0canvas/format/oc-project-store";