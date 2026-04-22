// ──────────────────────────────────────────────────────────
// Theme Color Resolver — Deep color inspection for elements
// ──────────────────────────────────────────────────────────
//
// Uses a HYBRID approach for maximum reliability:
//
// 1. getComputedStyle — always works, gives resolved values
// 2. Computed value walk — compares parent vs child to find
//    where a color was actually set (inheritance detection)
// 3. Class-based rule search — finds rules by matching
//    element classes against stylesheet text (avoids CSSOM
//    el.matches() failures with @layer, :where(), etc.)
// 4. var() chain resolution — traces token references
//
// ──────────────────────────────────────────────────────────

import type { DesignToken } from "../store/store";

// Key properties always shown (even if inherited)
export const KEY_COLOR_PROPERTIES = [
  "color",
  "background-color",
] as const;

// All color CSS properties
export const ALL_COLOR_CSS_PROPERTIES = [
  "color", "background-color",
  "border-color", "border-top-color", "border-right-color",
  "border-bottom-color", "border-left-color",
  "outline-color", "text-decoration-color", "column-rule-color",
  "fill", "stroke", "caret-color", "accent-color",
  "box-shadow", "text-shadow",
] as const;

export type ColorProperty = string;

// ── Types ────────────────────────────────────────────────

export type ColorPropertyInfo = {
  property: string;
  computedValue: string;
  specifiedValue: string;
  sourceSelector: string;
  sourceType: "rule" | "inline" | "inherited";
  inheritedFrom?: string;
  tokenChain: string[];
  isToken: boolean;
};

// ── Shorthand mapping ────────────────────────────────────

const SHORTHAND_MAP: Record<string, string[]> = {
  "background-color": ["background-color", "background"],
  "border-color": ["border-color", "border"],
  "border-top-color": ["border-top-color", "border-top", "border-color", "border"],
  "border-right-color": ["border-right-color", "border-right", "border-color", "border"],
  "border-bottom-color": ["border-bottom-color", "border-bottom", "border-color", "border"],
  "border-left-color": ["border-left-color", "border-left", "border-color", "border"],
  "outline-color": ["outline-color", "outline"],
  "text-decoration-color": ["text-decoration-color", "text-decoration"],
  "column-rule-color": ["column-rule-color", "column-rule"],
};

function getPropsToCheck(prop: string): string[] {
  return SHORTHAND_MAP[prop] || [prop];
}

// Maps a shorthand color property to its longhand sub-properties
export const SHORTHAND_EXPANSION: Record<string, string[]> = {
  "border-color": ["border-top-color", "border-right-color", "border-bottom-color", "border-left-color"],
};

// NON-INHERITABLE color properties — only show if a CSS rule explicitly sets them
// on THIS element. These either default to `currentColor`, `auto`, or `transparent`.
// They should NOT appear just because an ancestor has them.
const NON_INHERITABLE_COLOR_PROPS = new Set([
  "background-color",
  "border-color", "border-top-color", "border-right-color",
  "border-bottom-color", "border-left-color",
  "outline-color",
  "caret-color", "text-decoration-color", "column-rule-color",
  "accent-color",
  "box-shadow", "text-shadow",
]);

// CSS color properties that actually INHERIT from parent elements
// Only these should use ancestor-walking to find their source
const INHERITABLE_COLOR_PROPS = new Set([
  "color",  // the only commonly-used inheritable color property
  "fill",   // SVG inherits
  "stroke", // SVG inherits
]);

// ── Build readable selector for an element ───────────────

function buildElementSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `#${el.id}`;
  const cls = (el as HTMLElement).className;
  if (cls && typeof cls === "string") {
    const firstClass = cls.trim().split(/\s+/)[0];
    if (firstClass) return `${tag}.${firstClass}`;
  }
  return tag;
}

// ── Find CSS source using raw stylesheet text ────────────
// This approach bypasses all CSSOM API issues by searching
// the actual CSS text for class names and property values.

type RuleSource = {
  selector: string;
  value: string;   // the authored value (may include var())
  property: string; // the property that was found
};

/**
 * Search all stylesheets for rules that match an element's classes
 * and set a color property. Uses raw CSS text search as a fallback
 * when CSSOM APIs fail with @layer, :where(), etc.
 */
function findColorRuleForElement(
  el: Element,
  property: string,
  doc: Document
): RuleSource | null {
  const candidates = getPropsToCheck(property);

  // Strategy 1: CSSOM walk (with recursive @layer support)
  const cssomResult = findViaCSSOm(el, candidates, doc);
  if (cssomResult) return { ...cssomResult, property };

  // Strategy 2: Class-based text search
  const classes = Array.from(el.classList);
  if (classes.length > 0) {
    const textResult = findViaTextSearch(classes, candidates, doc);
    if (textResult) return { ...textResult, property };
  }

  // Strategy 3: Tag-based text search (for body, html, etc.)
  const tag = el.tagName.toLowerCase();
  if (tag === "body" || tag === "html") {
    const tagResult = findViaTagSearch(tag, candidates, doc);
    if (tagResult) return { ...tagResult, property };
  }

  return null;
}

/** Strategy 1: Walk CSSOM recursively */
function findViaCSSOm(
  el: Element,
  candidates: string[],
  doc: Document
): { selector: string; value: string } | null {
  let bestSelector = "";
  let bestValue = "";
  let bestSpec = -1;

  function walk(ruleList: CSSRuleList) {
    for (let r = 0; r < ruleList.length; r++) {
      const rule = ruleList[r];
      if (rule instanceof CSSStyleRule) {
        let matches = false;
        try { matches = el.matches(rule.selectorText); } catch { /* */ }
        if (!matches) continue;

        for (const c of candidates) {
          const val = rule.style.getPropertyValue(c);
          if (val && val.trim()) {
            const spec = roughSpecificity(rule.selectorText);
            if (spec >= bestSpec) {
              bestSelector = rule.selectorText;
              bestValue = val.trim();
              bestSpec = spec;
            }
            break;
          }
        }
      } else if ("cssRules" in rule) {
        try { walk((rule as CSSGroupingRule).cssRules); } catch { /* */ }
      }
    }
  }

  try {
    for (let s = 0; s < doc.styleSheets.length; s++) {
      try { walk(doc.styleSheets[s].cssRules); } catch { /* */ }
    }
  } catch { /* */ }

  return bestSpec >= 0 ? { selector: bestSelector, value: bestValue } : null;
}

function roughSpecificity(selector: string): number {
  let score = 0;
  score += (selector.match(/#/g) || []).length * 100;
  score += (selector.match(/\./g) || []).length * 10;
  score += (selector.match(/\[/g) || []).length * 10;
  return score;
}

/** Strategy 2: Search stylesheet text for class-based rules */
function findViaTextSearch(
  classes: string[],
  candidates: string[],
  doc: Document
): { selector: string; value: string } | null {
  // Filter out Tailwind utility classes with brackets — they're unreliable for text search
  // Keep only simple named classes (letters, digits, hyphens, underscores)
  const safeClasses = classes.filter((c) => /^[a-zA-Z_][\w-]*$/.test(c));
  if (safeClasses.length === 0) return null;

  for (const sheet of Array.from(doc.styleSheets)) {
    const text = getSheetText(sheet);
    if (!text) continue;

    for (const cls of safeClasses) {
      // Find rule blocks: .classname { ... }
      // Use a strict pattern that requires the class name to be followed by
      // whitespace, comma, colon, or { (not more class characters)
      const classPattern = new RegExp(
        `\\.${escapeRegex(cls)}(?=[\\s,:{>+~])([^{]*)\\{([^}]+)\\}`, "g"
      );
      let match: RegExpExecArray | null;
      while ((match = classPattern.exec(text)) !== null) {
        const blockText = match[2];
        const selector = `.${cls}${match[1]}`.trim();

        for (const c of candidates) {
          // Strict property match: must be at start of line or after ; or whitespace
          // and must NOT be part of a longer property name
          const propPattern = new RegExp(
            `(?:^|;|\\s)${escapeRegex(c)}\\s*:\\s*([^;]+)`, "m"
          );
          const propMatch = blockText.match(propPattern);
          if (propMatch) {
            return { selector: `.${cls}`, value: propMatch[1].trim() };
          }
        }
      }
    }
  }
  return null;
}

/** Strategy 3: Search for tag-based rules (body, html, :root) */
function findViaTagSearch(
  tag: string,
  candidates: string[],
  doc: Document
): { selector: string; value: string } | null {
  for (const sheet of Array.from(doc.styleSheets)) {
    const text = getSheetText(sheet);
    if (!text) continue;

    const patterns = tag === "html" ? [":root", "html"] : [tag];
    for (const pat of patterns) {
      const re = new RegExp(`(?:^|[\\s,;{}])${escapeRegex(pat)}\\s*\\{([^}]+)\\}`, "g");
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        const blockText = match[1];
        for (const c of candidates) {
          // Strict property match
          const propPattern = new RegExp(
            `(?:^|;|\\s)${escapeRegex(c)}\\s*:\\s*([^;]+)`, "m"
          );
          const propMatch = blockText.match(propPattern);
          if (propMatch) {
            return { selector: pat, value: propMatch[1].trim() };
          }
        }
      }
    }
  }
  return null;
}

/** Get the raw CSS text of a stylesheet */
function getSheetText(sheet: CSSStyleSheet): string | null {
  // For <style> tags, get textContent
  if (sheet.ownerNode && (sheet.ownerNode as HTMLElement).tagName === "STYLE") {
    return (sheet.ownerNode as HTMLElement).textContent;
  }
  // For linked stylesheets, try cssRules → cssText
  try {
    let text = "";
    for (let i = 0; i < sheet.cssRules.length; i++) {
      text += sheet.cssRules[i].cssText + "\n";
    }
    return text;
  } catch {
    return null; // cross-origin
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Inline style check ───────────────────────────────────

function getInlineStyleValue(el: Element, property: string): string | null {
  const htmlEl = el as HTMLElement;
  if (!htmlEl.style) return null;
  const candidates = getPropsToCheck(property);
  for (const c of candidates) {
    const val = htmlEl.style.getPropertyValue(c);
    if (val && val.trim()) return val.trim();
  }
  return null;
}

// ── Inheritance: find where a color was actually set ──────

function findColorSource(
  el: Element,
  property: string,
  doc: Document
): { sourceEl: Element; selector: string; value: string; type: "rule" | "inline" | "inherited" } | null {
  const win = doc.defaultView || window;

  // Check inline style first (highest priority)
  const inline = getInlineStyleValue(el, property);
  if (inline) {
    return { sourceEl: el, selector: buildElementSelector(el), value: inline, type: "inline" };
  }

  // Check CSSOM + text search for a direct rule on this element
  const directRule = findColorRuleForElement(el, property, doc);
  if (directRule) {
    return { sourceEl: el, selector: directRule.selector, value: directRule.value, type: "rule" };
  }

  // Walk up ancestors using computed value comparison
  const myValue = win.getComputedStyle(el).getPropertyValue(property).trim();
  let current = el.parentElement;

  while (current) {
    const currentValue = win.getComputedStyle(current).getPropertyValue(property).trim();

    // Check if this ancestor has a direct rule
    const ancestorInline = getInlineStyleValue(current, property);
    if (ancestorInline) {
      return { sourceEl: current, selector: buildElementSelector(current), value: ancestorInline, type: "inherited" };
    }

    const ancestorRule = findColorRuleForElement(current, property, doc);
    if (ancestorRule) {
      return { sourceEl: current, selector: ancestorRule.selector, value: ancestorRule.value, type: "inherited" };
    }

    // Computed value comparison: if parent has different value, we passed the source
    const parentEl = current.parentElement;
    if (parentEl) {
      const parentValue = win.getComputedStyle(parentEl).getPropertyValue(property).trim();
      if (currentValue !== parentValue) {
        return { sourceEl: current, selector: buildElementSelector(current), value: currentValue, type: "inherited" };
      }
    }

    current = current.parentElement;
  }

  return null;
}

// ── Resolve var() chain ──────────────────────────────────

export function resolveVarChain(el: Element, specifiedValue: string, doc: Document): string[] {
  const chain: string[] = [];
  let current = specifiedValue.trim();
  const win = doc.defaultView || window;
  const computed = win.getComputedStyle(el);

  for (let depth = 0; depth < 10; depth++) {
    const varMatch = current.match(/var\(\s*(--[\w-]+)/);
    if (!varMatch) break;

    const varName = varMatch[1];
    chain.push(varName);

    const resolved = computed.getPropertyValue(varName).trim();
    if (!resolved) break;

    if (resolved.startsWith("var(")) { current = resolved; continue; }

    // Check if the custom property itself is defined via another var()
    const specForVar = findCustomPropertySpec(varName, doc);
    if (specForVar && specForVar.includes("var(")) { current = specForVar; continue; }

    chain.push(resolved);
    break;
  }

  return chain;
}

/** Find the specified value of a custom property in stylesheets */
function findCustomPropertySpec(propName: string, doc: Document): string {
  let result = "";

  // Search raw CSS text — most reliable for custom properties
  for (const sheet of Array.from(doc.styleSheets)) {
    const text = getSheetText(sheet);
    if (!text) continue;
    const re = new RegExp(`${escapeRegex(propName)}\\s*:\\s*([^;]+);`, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      result = match[1].trim();
    }
  }

  return result;
}

// ── Extract color from shorthand values ──────────────────

/**
 * When a shorthand like "border: 1px solid var(--demo-border)" is found,
 * extract just the color part: "var(--demo-border)".
 */
function extractColorFromShorthand(value: string): string {
  const v = value.trim();
  // Already a color or var()
  if (v.startsWith("var(") || v.startsWith("#") || v.startsWith("rgb") || v.startsWith("hsl") || v.startsWith("oklab") || v.startsWith("oklch")) {
    return v;
  }
  // Look for var() anywhere
  const varMatch = v.match(/var\([^)]+\)/);
  if (varMatch) return varMatch[0];
  // Look for hex
  const hexMatch = v.match(/#[0-9a-fA-F]{3,8}/);
  if (hexMatch) return hexMatch[0];
  // Look for color functions
  const fnMatch = v.match(/(?:rgba?|hsla?|oklab|oklch)\([^)]+\)/);
  if (fnMatch) return fnMatch[0];
  // Named colors
  const namedColors = new Set(["transparent", "currentcolor", "inherit",
    "black", "white", "red", "blue", "green", "gray", "orange", "purple", "pink", "yellow",
    "aqua", "cyan", "magenta", "lime", "navy", "teal", "olive", "maroon", "silver", "fuchsia"]);
  for (const w of v.split(/\s+/)) {
    if (namedColors.has(w.toLowerCase())) return w;
  }
  return v;
}

// ── Main API ─────────────────────────────────────────────

export function getColorProperties(el: Element, doc: Document): ColorPropertyInfo[] {
  const win = doc.defaultView || window;
  const computed = win.getComputedStyle(el);
  const results: ColorPropertyInfo[] = [];
  const seen = new Set<string>();

  // Get the element's computed `color` — needed to detect currentColor defaults
  const computedColor = computed.getPropertyValue("color").trim();

  for (const prop of ALL_COLOR_CSS_PROPERTIES) {
    const computedValue = computed.getPropertyValue(prop).trim();
    if (!computedValue || computedValue === "none") continue;

    const isKey = (KEY_COLOR_PROPERTIES as readonly string[]).includes(prop);
    const inherits = INHERITABLE_COLOR_PROPS.has(prop);

    // Skip fully transparent
    if (computedValue === "rgba(0, 0, 0, 0)") continue;

    // ══════════════════════════════════════════════════════
    // CORE DECISION: Should this property appear in the popup?
    //
    // Instead of relying on CSSOM rule matching (which fails
    // with @layer, :where(), Tailwind, etc.), we use the
    // BROWSER'S OWN COMPUTATION to decide:
    //
    // For non-inheritable props (border-color, outline-color, etc.):
    //   Their CSS initial value is `currentColor` or `transparent`.
    //   If computed value === computed `color` → it's just the default.
    //   If computed value !== computed `color` → a rule must set it.
    //
    // For inheritable props (color, fill, stroke):
    //   Always show with ancestor source detection.
    // ══════════════════════════════════════════════════════

    // 1. Check for inline style first (theme mode changes)
    const inline = getInlineStyleValue(el, prop);
    if (inline) {
      const isToken = inline.includes("var(");
      const tokenChain = isToken ? resolveVarChain(el, inline, doc) : [];
      results.push({
        property: prop, computedValue, specifiedValue: inline,
        sourceSelector: "inline", sourceType: "inline",
        tokenChain, isToken,
      });
      seen.add(prop);
      continue;
    }

    // 2. For NON-INHERITABLE properties: use computed value comparison
    if (!inherits && !isKey) {
      // The initial value of border-color, outline-color, text-decoration-color,
      // caret-color, etc. is `currentColor` which resolves to the same as `color`.
      // If the computed value equals `color` → it's just the default → skip.
      // If it differs → a CSS rule explicitly set it → show.
      if (computedValue === computedColor) {
        continue; // Just defaulting to currentColor, skip
      }
      // Value differs from color → explicitly set by a rule. Find the source.
      const source = findColorSource(el, prop, doc);
      if (source) {
        let specifiedValue = extractColorFromShorthand(source.value);
        if (!specifiedValue.includes("var(")) {
          const ruleSearch = findColorRuleForElement(source.sourceEl, prop, doc);
          if (ruleSearch && ruleSearch.value.includes("var(")) {
            specifiedValue = extractColorFromShorthand(ruleSearch.value);
          }
        }
        const isToken = specifiedValue.includes("var(");
        const tokenChain = isToken ? resolveVarChain(source.sourceEl, specifiedValue, doc) : [];
        results.push({
          property: prop, computedValue, specifiedValue,
          sourceSelector: source.selector, sourceType: source.type,
          inheritedFrom: source.type === "inherited" ? source.selector : undefined,
          tokenChain, isToken,
        });
      } else {
        // Can't find the rule, but the value IS explicitly set (differs from color)
        results.push({
          property: prop, computedValue, specifiedValue: computedValue,
          sourceSelector: buildElementSelector(el), sourceType: "rule",
          tokenChain: [], isToken: false,
        });
      }
      seen.add(prop);
      continue;
    }

    // 3. For INHERITABLE properties (color, fill, stroke) — always find source
    if (inherits || isKey) {
      const source = findColorSource(el, prop, doc);
      if (source) {
        let specifiedValue = extractColorFromShorthand(source.value);
        if (!specifiedValue.includes("var(")) {
          const ruleSearch = findColorRuleForElement(source.sourceEl, prop, doc);
          if (ruleSearch && ruleSearch.value.includes("var(")) {
            specifiedValue = extractColorFromShorthand(ruleSearch.value);
          }
        }
        const isToken = specifiedValue.includes("var(");
        const tokenChain = isToken ? resolveVarChain(source.sourceEl, specifiedValue, doc) : [];
        results.push({
          property: prop, computedValue, specifiedValue,
          sourceSelector: source.selector, sourceType: source.type,
          inheritedFrom: source.type === "inherited" ? source.selector : undefined,
          tokenChain, isToken,
        });
        seen.add(prop);
      } else if (isKey) {
        results.push({
          property: prop, computedValue, specifiedValue: computedValue,
          sourceSelector: "browser default", sourceType: "inherited",
          tokenChain: [], isToken: false,
        });
        seen.add(prop);
      }
    }
  }

  // ── Deduplicate border sub-properties ──
  // If border-color is shown, hide border-top/right/bottom/left-color
  // unless they have DIFFERENT values (indicating individual overrides)
  const borderColorResult = results.find((r) => r.property === "border-color");
  if (borderColorResult) {
    const borderSubs = new Set(["border-top-color", "border-right-color", "border-bottom-color", "border-left-color"]);
    const filtered = results.filter((r) => {
      if (!borderSubs.has(r.property)) return true;
      return r.computedValue !== borderColorResult.computedValue;
    });
    results.length = 0;
    results.push(...filtered);
  }

  // ── Step 3: Sort ──
  const priority = ["color", "background-color"];
  results.sort((a, b) => {
    const ai = priority.indexOf(a.property);
    const bi = priority.indexOf(b.property);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.property.localeCompare(b.property);
  });

  return results;
}

// ── Utility exports ──────────────────────────────────────

function normalizeColor(value: string): string {
  const hexMatch = value.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hexMatch) {
    const h = hexMatch[1].toLowerCase();
    if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    if (h.length === 6) return `#${h}`;
    if (h.length === 8) return `#${h.slice(0, 6)}`;
    return `#${h}`;
  }
  const rgbMatch = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return `#${parseInt(rgbMatch[1]).toString(16).padStart(2, "0")}${parseInt(rgbMatch[2]).toString(16).padStart(2, "0")}${parseInt(rgbMatch[3]).toString(16).padStart(2, "0")}`;
  }
  return value.toLowerCase();
}

export function matchTokenToValue(value: string, tokens: DesignToken[]): DesignToken | null {
  const norm = normalizeColor(value);
  for (const token of tokens) {
    if (token.syntax !== "color") continue;
    for (const themeVal of Object.values(token.values)) {
      if (normalizeColor(themeVal) === norm) return token;
    }
  }
  return null;
}

export function getSpecifiedValue(el: Element, property: string, doc: Document): string {
  const rule = findColorRuleForElement(el, property, doc);
  if (rule) return rule.value;
  const inline = getInlineStyleValue(el, property);
  if (inline) return inline;
  return "";
}
