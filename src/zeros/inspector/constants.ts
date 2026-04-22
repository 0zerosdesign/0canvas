// ──────────────────────────────────────────────────────────
// Constants — Shared configuration for the DOM inspector
// ──────────────────────────────────────────────────────────

/** Tags to skip during DOM inspection */
export const IGNORED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "LINK",
  "META",
  "HEAD",
  "NOSCRIPT",
  "BR",
  "WBR",
]);

/** Zeros's own UI elements — skip during inspection */
export const OC_ATTR = "data-Zeros";

/** CSS properties extracted during computed style inspection */
export const STYLE_PROPS = [
  "color",
  "backgroundColor",
  "fontSize",
  "fontFamily",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "width",
  "height",
  "maxWidth",
  "maxHeight",
  "minWidth",
  "minHeight",
  "display",
  "flexDirection",
  "alignItems",
  "justifyContent",
  "gap",
  "gridTemplateColumns",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "overflow",
  "opacity",
  "borderRadius",
  "border",
  "borderColor",
  "borderWidth",
  "boxShadow",
  "transform",
  "transition",
];

// ── Zeros design tokens (hardcoded for iframe context) ──
// Overlays live inside the iframe which does NOT have
// [data-Zeros-root] scope, so we use literal values.

export const OC_SURFACE_0 = "#171717";
export const OC_SURFACE_1 = "#262626";
export const OC_SURFACE_FLOOR = "#0a0a0a";
export const OC_TEXT_ON_SURFACE = "#E5E5E5";
export const OC_TEXT_MUTED = "#737373";
export const OC_BORDER_0 = "#262626";
export const OC_BORDER_1 = "#404040";
export const OC_PRIMARY = "#2563EB";
export const OC_SUCCESS = "#10B981";
export const OC_PRIMARY_DIM = "rgba(37,99,235,0.15)";
export const OC_FONT_SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const OC_FONT_MONO =
  "'Fira Code', 'JetBrains Mono', 'Geist Mono', monospace";
