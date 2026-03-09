// ──────────────────────────────────────────────────────────
// Canvas Types — Shared between browser and VS Code extension
// ──────────────────────────────────────────────────────────

// Variant data shape used by canvas components.
// Intentionally a superset that works for both runtime (VariantData from store)
// and .dd file (DDVariant from dd-project types).
export type CanvasVariantData = {
  id: string;
  name: string;
  html: string;
  css: string;
  sourceType: "page" | "component";
  sourceElementId?: string | null;
  sourcePageRoute?: string;
  sourceViewportWidth?: number;
  parentId: string | null;
  status: "draft" | "finalized" | "sent" | "pushed";
  createdAt: number | string;
  feedback?: CanvasFeedbackItem[];
  canvasPosition?: { x: number; y: number };
  canvasSize?: { width: number; height: number };
};

export type CanvasFeedbackItem = {
  id: string;
  text: string;
  severity?: string;
  elementId?: string;
  createdAt: string;
  resolved?: boolean;
};

export type CanvasPageData = {
  id: string;
  name: string;
  route: string;
};

export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

// Callbacks for variant actions — implemented differently in browser vs VS Code
export type VariantNodeCallbacks = {
  onRename: (variantId: string, newName: string) => void;
  onDelete: (variantId: string) => void;
  onFinalize: (variantId: string) => void;
  onResize?: (variantId: string, width: number, height: number) => void;
  // Browser-only (optional)
  onFork?: (variantId: string) => void;
  onSendToAgent?: (variantId: string) => void;
  onPushToMain?: (variantId: string) => void;
  onCopyHtml?: (html: string) => void;
  onInspect?: (variantId: string) => void;
  // Feedback actions
  onDeleteFeedback?: (variantId: string, feedbackId: string) => void;
  onResolveFeedback?: (variantId: string, feedbackId: string) => void;
};

export type CanvasCallbacks = {
  onNodePositionChange?: (nodeId: string, x: number, y: number) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
  variantCallbacks: VariantNodeCallbacks;
};

// Layout constants — shared between browser and extension
export const VARIANT_GAP_X = 80;
export const VARIANT_GAP_Y = 60;
export const DEFAULT_VARIANT_W = 560;
export const DEFAULT_VARIANT_H = 420;

export const STATUS_COLORS: Record<string, string> = {
  draft: "#444",
  finalized: "#50e3c2",
  sent: "#7928ca",
  pushed: "#0070f3",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  finalized: "Finalized",
  sent: "Sent",
  pushed: "Pushed",
};
