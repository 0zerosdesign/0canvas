// ──────────────────────────────────────────────────────────
// Tailwind CSS Detector + Class ↔ CSS Mapping
// ──────────────────────────────────────────────────────────
//
// Detects Tailwind utility classes and maps them to CSS properties.
// Uses a built-in lookup table (no config parsing needed).
//
// ──────────────────────────────────────────────────────────

// ── Detection ────────────────────────────────────────────

const TW_PATTERNS = /^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|items-|justify-|gap-|p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|w-|h-|min-|max-|text-|font-|leading-|tracking-|bg-|border|rounded|shadow|opacity-|overflow-|z-|top-|right-|bottom-|left-|space-|shrink|grow|basis-|self-|order-|col-|row-|place-|content-|float-|clear-|cursor-|select-|transition|duration-|ease-|delay-|animate-|scale-|rotate-|translate-|skew-|origin-|backdrop-|ring-|divide-|sr-only|not-sr-only|aspect-|break-|decoration-|underline|overline|line-through|no-underline|uppercase|lowercase|capitalize|normal-case|truncate|whitespace-|align-|isolate)/;

export function isTailwindClass(cls: string): boolean {
  // Strip responsive/state prefixes: sm:, md:, lg:, xl:, hover:, focus:, dark:, etc.
  const base = cls.replace(/^(sm|md|lg|xl|2xl|hover|focus|active|group-hover|dark|motion-safe|motion-reduce|first|last|odd|even|disabled|placeholder|before|after):/, "");
  return TW_PATTERNS.test(base);
}

export function detectTailwindClasses(classes: string[]): {
  tailwind: string[];
  other: string[];
  isTailwind: boolean;
} {
  const tailwind: string[] = [];
  const other: string[] = [];
  for (const cls of classes) {
    if (isTailwindClass(cls)) {
      tailwind.push(cls);
    } else {
      other.push(cls);
    }
  }
  return { tailwind, other, isTailwind: tailwind.length > 0 };
}

// ── Class → CSS Property Mapping ─────────────────────────

export type TailwindCategory = "layout" | "spacing" | "sizing" | "typography" | "color" | "border" | "effects" | "other";

export interface TailwindClassInfo {
  class: string;
  category: TailwindCategory;
  property: string;
  description: string;
}

export function classifyTailwindClass(cls: string): TailwindClassInfo {
  const base = cls.replace(/^(sm|md|lg|xl|2xl|hover|focus|active|dark):/, "");

  // Layout
  if (/^(flex|inline-flex|grid|inline-grid|block|inline-block|inline|hidden|contents|flow-root)$/.test(base)) return { class: cls, category: "layout", property: "display", description: base };
  if (/^(relative|absolute|fixed|sticky|static)$/.test(base)) return { class: cls, category: "layout", property: "position", description: base };
  if (/^items-/.test(base)) return { class: cls, category: "layout", property: "align-items", description: base.replace("items-", "") };
  if (/^justify-/.test(base)) return { class: cls, category: "layout", property: "justify-content", description: base.replace("justify-", "") };
  if (/^flex-/.test(base)) return { class: cls, category: "layout", property: "flex", description: base };
  if (/^gap-/.test(base)) return { class: cls, category: "spacing", property: "gap", description: base };
  if (/^overflow-/.test(base)) return { class: cls, category: "layout", property: "overflow", description: base.replace("overflow-", "") };
  if (/^z-/.test(base)) return { class: cls, category: "layout", property: "z-index", description: base };
  if (/^order-/.test(base)) return { class: cls, category: "layout", property: "order", description: base };
  if (/^isolate/.test(base)) return { class: cls, category: "layout", property: "isolation", description: "isolate" };

  // Spacing
  if (/^p-/.test(base)) return { class: cls, category: "spacing", property: "padding", description: base };
  if (/^px-/.test(base)) return { class: cls, category: "spacing", property: "padding-inline", description: base };
  if (/^py-/.test(base)) return { class: cls, category: "spacing", property: "padding-block", description: base };
  if (/^pt-/.test(base)) return { class: cls, category: "spacing", property: "padding-top", description: base };
  if (/^pr-/.test(base)) return { class: cls, category: "spacing", property: "padding-right", description: base };
  if (/^pb-/.test(base)) return { class: cls, category: "spacing", property: "padding-bottom", description: base };
  if (/^pl-/.test(base)) return { class: cls, category: "spacing", property: "padding-left", description: base };
  if (/^m-/.test(base)) return { class: cls, category: "spacing", property: "margin", description: base };
  if (/^mx-/.test(base)) return { class: cls, category: "spacing", property: "margin-inline", description: base };
  if (/^my-/.test(base)) return { class: cls, category: "spacing", property: "margin-block", description: base };
  if (/^mt-/.test(base)) return { class: cls, category: "spacing", property: "margin-top", description: base };
  if (/^mr-/.test(base)) return { class: cls, category: "spacing", property: "margin-right", description: base };
  if (/^mb-/.test(base)) return { class: cls, category: "spacing", property: "margin-bottom", description: base };
  if (/^ml-/.test(base)) return { class: cls, category: "spacing", property: "margin-left", description: base };
  if (/^space-/.test(base)) return { class: cls, category: "spacing", property: "gap", description: base };

  // Sizing
  if (/^w-/.test(base)) return { class: cls, category: "sizing", property: "width", description: base };
  if (/^h-/.test(base)) return { class: cls, category: "sizing", property: "height", description: base };
  if (/^min-w-/.test(base)) return { class: cls, category: "sizing", property: "min-width", description: base };
  if (/^min-h-/.test(base)) return { class: cls, category: "sizing", property: "min-height", description: base };
  if (/^max-w-/.test(base)) return { class: cls, category: "sizing", property: "max-width", description: base };
  if (/^max-h-/.test(base)) return { class: cls, category: "sizing", property: "max-height", description: base };
  if (/^shrink/.test(base)) return { class: cls, category: "sizing", property: "flex-shrink", description: base };
  if (/^grow/.test(base)) return { class: cls, category: "sizing", property: "flex-grow", description: base };
  if (/^basis-/.test(base)) return { class: cls, category: "sizing", property: "flex-basis", description: base };
  if (/^aspect-/.test(base)) return { class: cls, category: "sizing", property: "aspect-ratio", description: base };

  // Typography
  if (/^text-\[/.test(base) || /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(base)) return { class: cls, category: "typography", property: "font-size", description: base };
  if (/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(base)) return { class: cls, category: "typography", property: "font-weight", description: base };
  if (/^font-/.test(base) && !/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(base)) return { class: cls, category: "typography", property: "font-family", description: base };
  if (/^leading-/.test(base)) return { class: cls, category: "typography", property: "line-height", description: base };
  if (/^tracking-/.test(base)) return { class: cls, category: "typography", property: "letter-spacing", description: base };
  if (/^(uppercase|lowercase|capitalize|normal-case)$/.test(base)) return { class: cls, category: "typography", property: "text-transform", description: base };
  if (/^(underline|overline|line-through|no-underline)$/.test(base)) return { class: cls, category: "typography", property: "text-decoration", description: base };
  if (/^(truncate|whitespace-)/.test(base)) return { class: cls, category: "typography", property: "white-space", description: base };
  if (/^text-(left|center|right|justify|start|end)$/.test(base)) return { class: cls, category: "typography", property: "text-align", description: base.replace("text-", "") };

  // Color (text-* that isn't sizing or alignment)
  if (/^text-/.test(base)) return { class: cls, category: "color", property: "color", description: base };
  if (/^bg-/.test(base)) return { class: cls, category: "color", property: "background", description: base };

  // Border
  if (/^border/.test(base)) return { class: cls, category: "border", property: "border", description: base };
  if (/^rounded/.test(base)) return { class: cls, category: "border", property: "border-radius", description: base };
  if (/^ring-/.test(base)) return { class: cls, category: "border", property: "box-shadow", description: base };
  if (/^divide-/.test(base)) return { class: cls, category: "border", property: "border", description: base };

  // Effects
  if (/^shadow/.test(base)) return { class: cls, category: "effects", property: "box-shadow", description: base };
  if (/^opacity-/.test(base)) return { class: cls, category: "effects", property: "opacity", description: base };
  if (/^(transition|duration-|ease-|delay-)/.test(base)) return { class: cls, category: "effects", property: "transition", description: base };
  if (/^(scale-|rotate-|translate-|skew-|origin-)/.test(base)) return { class: cls, category: "effects", property: "transform", description: base };
  if (/^backdrop-/.test(base)) return { class: cls, category: "effects", property: "backdrop-filter", description: base };
  if (/^cursor-/.test(base)) return { class: cls, category: "effects", property: "cursor", description: base };

  return { class: cls, category: "other", property: "unknown", description: base };
}

// ── Common Tailwind classes for autocomplete ─────────────

export const COMMON_TAILWIND_CLASSES: string[] = [
  // Layout
  "flex", "inline-flex", "grid", "block", "inline-block", "hidden",
  "relative", "absolute", "fixed", "sticky",
  "items-start", "items-center", "items-end", "items-stretch",
  "justify-start", "justify-center", "justify-end", "justify-between", "justify-around", "justify-evenly",
  "flex-row", "flex-col", "flex-wrap", "flex-nowrap", "flex-1",
  // Spacing
  "p-0", "p-1", "p-2", "p-3", "p-4", "p-5", "p-6", "p-8", "p-10", "p-12",
  "px-2", "px-3", "px-4", "px-6", "px-8", "py-2", "py-3", "py-4", "py-6", "py-8",
  "m-0", "m-1", "m-2", "m-4", "m-auto", "mx-auto",
  "gap-1", "gap-2", "gap-3", "gap-4", "gap-6", "gap-8",
  // Sizing
  "w-full", "w-auto", "w-screen", "w-1/2", "w-1/3", "w-1/4",
  "h-full", "h-auto", "h-screen",
  "min-h-screen", "max-w-sm", "max-w-md", "max-w-lg", "max-w-xl",
  // Typography
  "text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-3xl",
  "font-normal", "font-medium", "font-semibold", "font-bold",
  "text-left", "text-center", "text-right",
  "leading-none", "leading-tight", "leading-normal", "leading-relaxed",
  "uppercase", "lowercase", "capitalize", "truncate",
  // Color
  "text-white", "text-black", "text-gray-500", "text-gray-700",
  "bg-white", "bg-black", "bg-gray-100", "bg-gray-200", "bg-gray-900",
  "bg-transparent",
  // Border
  "border", "border-0", "border-2",
  "rounded", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-full", "rounded-none",
  // Effects
  "shadow", "shadow-sm", "shadow-md", "shadow-lg", "shadow-xl", "shadow-none",
  "opacity-0", "opacity-50", "opacity-75", "opacity-100",
  "transition", "duration-150", "duration-300",
  "overflow-hidden", "overflow-auto", "overflow-scroll",
];
