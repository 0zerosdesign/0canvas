// ──────────────────────────────────────────────────────────
// CSS Property Value Autocomplete — Valid values per property
// ──────────────────────────────────────────────────────────
//
// Covers the top 30+ most-edited CSS properties with their
// valid keyword values. Used by StylePropertyRow for inline
// autocomplete suggestions.
//
// ──────────────────────────────────────────────────────────

export const CSS_VALUE_MAP: Record<string, string[]> = {
  // Layout
  display: [
    "flex", "block", "inline", "grid", "none",
    "inline-flex", "inline-block", "inline-grid",
    "contents", "flow-root",
  ],
  position: ["static", "relative", "absolute", "fixed", "sticky"],
  overflow: ["visible", "hidden", "scroll", "auto", "clip"],
  "overflow-x": ["visible", "hidden", "scroll", "auto", "clip"],
  "overflow-y": ["visible", "hidden", "scroll", "auto", "clip"],
  float: ["none", "left", "right", "inline-start", "inline-end"],
  clear: ["none", "left", "right", "both", "inline-start", "inline-end"],
  visibility: ["visible", "hidden", "collapse"],
  "box-sizing": ["content-box", "border-box"],

  // Flexbox
  "flex-direction": ["row", "row-reverse", "column", "column-reverse"],
  "flex-wrap": ["nowrap", "wrap", "wrap-reverse"],
  "align-items": ["stretch", "flex-start", "flex-end", "center", "baseline", "start", "end"],
  "align-content": ["stretch", "flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"],
  "align-self": ["auto", "stretch", "flex-start", "flex-end", "center", "baseline"],
  "justify-content": [
    "flex-start", "flex-end", "center", "space-between",
    "space-around", "space-evenly", "start", "end",
  ],
  "justify-items": ["stretch", "start", "end", "center", "baseline"],
  "justify-self": ["auto", "stretch", "start", "end", "center", "baseline"],

  // Typography
  "text-align": ["left", "center", "right", "justify", "start", "end"],
  "text-decoration": ["none", "underline", "overline", "line-through"],
  "text-transform": ["none", "capitalize", "uppercase", "lowercase"],
  "font-weight": [
    "100", "200", "300", "400", "500",
    "600", "700", "800", "900", "normal", "bold", "lighter", "bolder",
  ],
  "font-style": ["normal", "italic", "oblique"],
  "white-space": ["normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"],
  "word-break": ["normal", "break-all", "keep-all", "break-word"],
  "overflow-wrap": ["normal", "break-word", "anywhere"],
  "vertical-align": ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super"],
  "list-style-type": [
    "none", "disc", "circle", "square",
    "decimal", "decimal-leading-zero",
    "lower-alpha", "upper-alpha", "lower-roman", "upper-roman",
  ],

  // Background & Effects
  "background-size": ["auto", "cover", "contain"],
  "background-repeat": ["repeat", "no-repeat", "repeat-x", "repeat-y", "round", "space"],
  "background-position": ["center", "top", "bottom", "left", "right", "top left", "top right", "bottom left", "bottom right"],
  "background-attachment": ["scroll", "fixed", "local"],
  "mix-blend-mode": [
    "normal", "multiply", "screen", "overlay",
    "darken", "lighten", "color-dodge", "color-burn",
    "hard-light", "soft-light", "difference", "exclusion",
    "hue", "saturation", "color", "luminosity",
  ],
  "background-blend-mode": [
    "normal", "multiply", "screen", "overlay",
    "darken", "lighten", "color-dodge", "color-burn",
  ],

  // Border
  "border-style": ["none", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"],
  "outline-style": ["none", "solid", "dashed", "dotted", "double"],

  // Interaction
  cursor: [
    "auto", "default", "pointer", "grab", "grabbing",
    "text", "move", "not-allowed", "wait", "progress",
    "crosshair", "help", "zoom-in", "zoom-out",
    "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize",
    "nesw-resize", "nwse-resize",
  ],
  "pointer-events": ["auto", "none"],
  "user-select": ["auto", "text", "none", "contain", "all"],
  resize: ["none", "both", "horizontal", "vertical", "block", "inline"],

  // Transforms & Transitions
  "transform-origin": [
    "center", "top", "bottom", "left", "right",
    "top left", "top right", "bottom left", "bottom right",
  ],
  "transition-timing-function": [
    "ease", "linear", "ease-in", "ease-out", "ease-in-out",
    "step-start", "step-end",
  ],
  "animation-direction": ["normal", "reverse", "alternate", "alternate-reverse"],
  "animation-fill-mode": ["none", "forwards", "backwards", "both"],
  "animation-play-state": ["running", "paused"],
  "animation-timing-function": [
    "ease", "linear", "ease-in", "ease-out", "ease-in-out",
  ],

  // Object
  "object-fit": ["fill", "contain", "cover", "none", "scale-down"],
  "object-position": ["center", "top", "bottom", "left", "right"],

  // Aspect ratio
  "aspect-ratio": ["auto", "1 / 1", "16 / 9", "4 / 3", "3 / 2", "2 / 1"],
};

/**
 * Get autocomplete suggestions for a CSS property + partial value.
 * Returns up to `limit` matching values, prioritizing prefix matches.
 */
export function getAutocompleteSuggestions(
  property: string,
  partial: string,
  limit = 6
): string[] {
  const kebab = property.replace(/([A-Z])/g, "-$1").toLowerCase();
  const values = CSS_VALUE_MAP[kebab];
  if (!values) return [];

  const q = partial.trim().toLowerCase();
  if (!q) return values.slice(0, limit);

  // Prefix matches first, then substring matches
  const prefix: string[] = [];
  const substring: string[] = [];

  for (const v of values) {
    if (v.toLowerCase().startsWith(q)) prefix.push(v);
    else if (v.toLowerCase().includes(q)) substring.push(v);
  }

  return [...prefix, ...substring].slice(0, limit);
}
