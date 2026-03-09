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

// .dd format — design-as-code variant format
export {
  DD_FORMAT_VERSION,
  DEFAULT_BREAKPOINTS,
  createDDDocument,
  findNodeById,
  updateNodeById,
  deleteNodeById,
  insertNode,
  countDDNodes,
} from "./app/components/dd-format";
export type {
  DDDocument,
  DDNode,
  DDStyles,
  DDVariable,
  DDBreakpoints,
  DDBreakpoint,
  DDResponsive,
} from "./app/components/dd-format";
export { htmlToDDDocument, ddDocumentToHtml } from "./app/components/dd-parser";

// .dd project file — whole-project format
export {
  DD_PROJECT_SCHEMA_VERSION,
  DDProjectFileSchema,
  DEFAULT_PROJECT_BREAKPOINTS,
  validateDDProjectFile,
  migrateProjectFile,
  computeProjectHash,
  createEmptyProjectFile,
  stateToProjectFile,
  projectFileToState,
  serializeProjectFile,
  parseProjectFile,
} from "./app/components/dd-project";
export type {
  DDProjectFile,
  DDProjectMeta,
  DDWorkspaceMeta,
  DDBreakpointsConfig,
  DDPage,
  DDVariant,
  DDAnnotation,
  DDFeedback,
  DDCheckpoint,
  DDIntegrity,
  DDFileMapEntry,
  DDLayerNode,
  DDValidationResult,
} from "./app/components/dd-project";

// .dd project store — IndexedDB persistence + import/export
export {
  saveProjectFile,
  loadProjectFile,
  listProjectFiles,
  deleteProjectFile,
  downloadProjectFile,
  importProjectFile,
  scheduleAutoSave,
  buildCurrentProjectFile,
  pushProjectToIDE,
  pullProjectFromIDE,
} from "./app/components/dd-project-store";
export type { DDSyncMeta } from "./app/components/dd-project-store";