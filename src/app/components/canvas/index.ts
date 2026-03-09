// ──────────────────────────────────────────────────────────
// Canvas Module — Shared between browser and VS Code extension
// ──────────────────────────────────────────────────────────

export { SharedVariantNode } from "./SharedVariantNode";
export type { SharedVariantNodeData } from "./SharedVariantNode";

export { PageNode } from "./PageNode";
export type { PageNodeData } from "./PageNode";

export { SharedFeedbackList } from "./SharedFeedbackList";
export { buildSrcDoc } from "./build-srcdoc";

export type {
  CanvasVariantData,
  CanvasFeedbackItem,
  CanvasPageData,
  CanvasViewport,
  VariantNodeCallbacks,
  CanvasCallbacks,
} from "./canvas-types";

export {
  VARIANT_GAP_X,
  VARIANT_GAP_Y,
  DEFAULT_VARIANT_W,
  DEFAULT_VARIANT_H,
  STATUS_COLORS,
  STATUS_LABELS,
} from "./canvas-types";
