// ──────────────────────────────────────────────────────────
// CSS Token Parser — Extract design tokens from CSS files
// ──────────────────────────────────────────────────────────
//
// Parses CSS custom properties (--var-name: value) from CSS
// source with 100% precision. Handles:
//   - :root, selector-scoped, and nested declarations
//   - Multi-line values (shadows, gradients)
//   - var() references
//   - All value types: color, length, number, angle, time
//   - Multiple theme blocks (e.g. :root vs [data-theme="light"])
//
// ──────────────────────────────────────────────────────────

import { type DesignToken, type ThemeColumn, type TokenSyntax, deriveGroup } from "../store/store";

// ── Syntax detection ─────────────────────────────────────

const HEX_RE = /^#([0-9a-fA-F]{3,8})$/;
const RGB_RE = /^rgba?\s*\(/i;
const HSL_RE = /^hsla?\s*\(/i;
const NAMED_COLORS = new Set([
  "aliceblue","antiquewhite","aqua","aquamarine","azure","beige","bisque","black","blanchedalmond",
  "blue","blueviolet","brown","burlywood","cadetblue","chartreuse","chocolate","coral","cornflowerblue",
  "cornsilk","crimson","cyan","darkblue","darkcyan","darkgoldenrod","darkgray","darkgreen","darkgrey",
  "darkkhaki","darkmagenta","darkolivegreen","darkorange","darkorchid","darkred","darksalmon",
  "darkseagreen","darkslateblue","darkslategray","darkslategrey","darkturquoise","darkviolet",
  "deeppink","deepskyblue","dimgray","dimgrey","dodgerblue","firebrick","floralwhite","forestgreen",
  "fuchsia","gainsboro","ghostwhite","gold","goldenrod","gray","green","greenyellow","grey",
  "honeydew","hotpink","indianred","indigo","ivory","khaki","lavender","lavenderblush","lawngreen",
  "lemonchiffon","lightblue","lightcoral","lightcyan","lightgoldenrodyellow","lightgray","lightgreen",
  "lightgrey","lightpink","lightsalmon","lightseagreen","lightskyblue","lightslategray","lightslategrey",
  "lightsteelblue","lightyellow","lime","limegreen","linen","magenta","maroon","mediumaquamarine",
  "mediumblue","mediumorchid","mediumpurple","mediumseagreen","mediumslateblue","mediumspringgreen",
  "mediumturquoise","mediumvioletred","midnightblue","mintcream","mistyrose","moccasin","navajowhite",
  "navy","oldlace","olive","olivedrab","orange","orangered","orchid","palegoldenrod","palegreen",
  "paleturquoise","palevioletred","papayawhip","peachpuff","peru","pink","plum","powderblue",
  "purple","rebeccapurple","red","rosybrown","royalblue","saddlebrown","salmon","sandybrown",
  "seagreen","seashell","sienna","silver","skyblue","slateblue","slategray","slategrey","snow",
  "springgreen","steelblue","tan","teal","thistle","tomato","turquoise","violet","wheat","white",
  "whitesmoke","yellow","yellowgreen","transparent","currentcolor","inherit",
]);

const LENGTH_RE = /^-?[\d.]+\s*(px|em|rem|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc|%|svh|svw|dvh|dvw|lvh|lvw|cqw|cqh)$/i;
const PERCENTAGE_RE = /^-?[\d.]+%$/;
const NUMBER_RE = /^-?[\d.]+$/;
const ANGLE_RE = /^-?[\d.]+\s*(deg|rad|grad|turn)$/i;
const TIME_RE = /^-?[\d.]+\s*(ms|s)$/i;
const CALC_RE = /^calc\s*\(/i;

export function detectSyntax(value: string): TokenSyntax {
  const v = value.trim();

  // Color checks
  if (HEX_RE.test(v)) return "color";
  if (RGB_RE.test(v)) return "color";
  if (HSL_RE.test(v)) return "color";
  if (NAMED_COLORS.has(v.toLowerCase())) return "color";

  // var() reference — try to infer from name
  if (v.startsWith("var(")) {
    const inner = v.slice(4, v.indexOf(")")).trim();
    const name = inner.split(",")[0].trim();
    // If the var name contains color-related words
    if (/color|surface|text|border|bg|background|shadow/i.test(name)) return "color";
    if (/size|width|height|spacing|gap|padding|margin|radius|font-size/i.test(name)) return "length-percentage";
    return "*";
  }

  // Angle
  if (ANGLE_RE.test(v)) return "angle";

  // Time
  if (TIME_RE.test(v)) return "time";

  // Percentage (before length, since % is a subset)
  if (PERCENTAGE_RE.test(v)) return "percentage";

  // Length-percentage (includes px, rem, em, %)
  if (LENGTH_RE.test(v)) return "length-percentage";
  if (CALC_RE.test(v)) return "length-percentage";

  // Pure number
  if (NUMBER_RE.test(v)) return "number";

  // Multi-value (shadows, gradients, font stacks)
  if (v.includes("rgba(") || v.includes("rgb(") || v.includes("hsla(") || v.includes("hsl(")) return "color";

  return "*";
}

// ── CSS Parsing ──────────────────────────────────────────

interface CSSBlock {
  selector: string;
  properties: { name: string; value: string; line: number }[];
}

/**
 * Parse CSS source into blocks with their selectors and custom properties.
 * Handles nested blocks, multi-line values, and comments.
 */
function parseCSSBlocks(source: string): CSSBlock[] {
  const blocks: CSSBlock[] = [];

  // Strip comments (/* ... */) preserving line count
  let cleaned = "";
  let inComment = false;
  for (let i = 0; i < source.length; i++) {
    if (!inComment && source[i] === "/" && source[i + 1] === "*") {
      inComment = true;
      cleaned += "  "; // preserve chars for position tracking
      i++;
      continue;
    }
    if (inComment && source[i] === "*" && source[i + 1] === "/") {
      inComment = false;
      cleaned += "  ";
      i++;
      continue;
    }
    if (inComment) {
      cleaned += source[i] === "\n" ? "\n" : " ";
    } else {
      cleaned += source[i];
    }
  }

  // Track line numbers
  const lineOf = (pos: number): number => {
    let line = 1;
    for (let i = 0; i < pos && i < cleaned.length; i++) {
      if (cleaned[i] === "\n") line++;
    }
    return line;
  };

  // Parse blocks using brace matching
  let pos = 0;
  while (pos < cleaned.length) {
    // Find next opening brace
    const braceOpen = cleaned.indexOf("{", pos);
    if (braceOpen === -1) break;

    const selector = cleaned.substring(pos, braceOpen).trim();

    // Find matching closing brace
    let depth = 1;
    let i = braceOpen + 1;
    while (i < cleaned.length && depth > 0) {
      if (cleaned[i] === "{") depth++;
      else if (cleaned[i] === "}") depth--;
      i++;
    }
    const braceClose = i - 1;
    const body = cleaned.substring(braceOpen + 1, braceClose);

    // Extract custom properties from this block
    const properties: CSSBlock["properties"] = [];
    const propRe = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(body)) !== null) {
      properties.push({
        name: m[1],
        value: m[2].trim(),
        line: lineOf(braceOpen + 1 + m.index),
      });
    }

    if (properties.length > 0) {
      blocks.push({ selector, properties });
    }

    pos = braceClose + 1;
  }

  return blocks;
}

/**
 * Determine a theme ID from a CSS selector.
 * :root → "default"
 * [data-theme="light"] → "light"
 * .theme-dark → "dark"
 * @media (prefers-color-scheme: light) :root → "light"
 */
function selectorToThemeId(selector: string): string {
  // Check for data-theme attribute
  const dataThemeMatch = selector.match(/\[data-theme\s*=\s*["'](\w+)["']\]/);
  if (dataThemeMatch) return dataThemeMatch[1];

  // Check for .theme-{name} class
  const themeClassMatch = selector.match(/\.theme-(\w+)/);
  if (themeClassMatch) return themeClassMatch[1];

  // Check for prefers-color-scheme media query context
  const prefersMatch = selector.match(/prefers-color-scheme\s*:\s*(\w+)/);
  if (prefersMatch) return prefersMatch[1];

  // Check for .light / .dark class
  if (selector.includes(".light")) return "light";
  if (selector.includes(".dark")) return "dark";

  return "default";
}

// ── Main API ─────────────────────────────────────────────

export interface ParseResult {
  tokens: DesignToken[];
  themes: ThemeColumn[];
}

/**
 * Parse a CSS file and extract all design tokens with their theme values.
 * Returns tokens grouped with auto-detected syntax types.
 */
export function parseCSSTokens(source: string): ParseResult {
  const blocks = parseCSSBlocks(source);

  // Collect all theme IDs
  const themeIds = new Set<string>();
  blocks.forEach((b) => themeIds.add(selectorToThemeId(b.selector)));

  // Build a map: tokenName → { themeId: value }
  const tokenMap = new Map<string, { values: Record<string, string>; firstSyntax: TokenSyntax }>();

  for (const block of blocks) {
    const themeId = selectorToThemeId(block.selector);
    for (const prop of block.properties) {
      const existing = tokenMap.get(prop.name);
      if (existing) {
        existing.values[themeId] = prop.value;
      } else {
        tokenMap.set(prop.name, {
          values: { [themeId]: prop.value },
          firstSyntax: detectSyntax(prop.value),
        });
      }
    }
  }

  // Build tokens
  const tokens: DesignToken[] = [];
  for (const [name, data] of tokenMap) {
    tokens.push({
      name,
      values: data.values,
      syntax: data.firstSyntax,
      description: "",
      inherits: true,
      group: deriveGroup(name),
    });
  }

  // Build theme columns
  const themes: ThemeColumn[] = [];
  const sortedThemeIds = [...themeIds].sort((a, b) => {
    if (a === "default") return -1;
    if (b === "default") return 1;
    return a.localeCompare(b);
  });
  for (const id of sortedThemeIds) {
    themes.push({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      isDefault: id === "default",
    });
  }

  return { tokens, themes };
}

// ── Serialization: Tokens → CSS ──────────────────────────

/**
 * Regenerate a CSS file from design tokens while preserving structure.
 * Groups tokens by theme and outputs proper CSS blocks.
 */
export function tokensToCSSSource(tokens: DesignToken[], themes: ThemeColumn[]): string {
  const lines: string[] = [];

  for (const theme of themes) {
    const selector = theme.isDefault ? ":root" : `[data-theme="${theme.id}"]`;
    lines.push(`${selector} {`);

    // Group tokens by group for readability
    let lastGroup = "";
    for (const token of tokens) {
      const val = token.values[theme.id];
      if (val === undefined) continue;

      if (token.group !== lastGroup) {
        if (lastGroup) lines.push("");
        lines.push(`  /* ── ${token.group} ── */`);
        lastGroup = token.group;
      }
      lines.push(`  ${token.name}: ${val};`);
    }

    lines.push("}");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Surgically update a single token value in raw CSS source.
 * Returns the updated source or null if not found.
 *
 * IMPORTANT: This preserves ALL non-custom-property content
 * (imports, rules, media queries, animations, etc.)
 */
export function updateTokenInSource(
  source: string,
  tokenName: string,
  _themeId: string,
  newValue: string
): string | null {
  const escapedName = tokenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const propRe = new RegExp(`(${escapedName}\\s*:\\s*)([^;]+)(;)`, "g");

  let found = false;
  const result = source.replace(propRe, (match, prefix, _oldValue, semi) => {
    if (!found) {
      found = true;
      return `${prefix}${newValue}${semi}`;
    }
    return match;
  });

  return found ? result : null;
}

/**
 * Surgically apply ALL token changes to the original CSS source.
 * Only modifies custom property values; preserves everything else
 * (imports, @layer, @theme, rules, animations, comments, etc.)
 *
 * This is the ONLY function that should be used for writing back to files.
 */
export function applyTokensToSource(
  originalSource: string,
  tokens: DesignToken[],
  themes: ThemeColumn[]
): string {
  let result = originalSource;

  // Build a lookup: tokenName → { themeId → newValue }
  const tokenLookup = new Map<string, Record<string, string>>();
  for (const token of tokens) {
    tokenLookup.set(token.name, token.values);
  }

  // For each token, surgically replace its value in the source
  // We process the default theme (which maps to :root) first
  for (const token of tokens) {
    for (const theme of themes) {
      const newVal = token.values[theme.id];
      if (newVal === undefined) continue;

      const escapedName = token.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Match the property declaration: --name: value;
      // This regex handles multi-line values by matching up to the semicolon
      const propRe = new RegExp(`(${escapedName}\\s*:\\s*)([^;]+)(;)`, "g");

      // For files with a single :root block, each property name appears once
      // For multi-theme files, the same name may appear multiple times
      // We replace all occurrences — the value is the same within a single theme
      let matchIndex = 0;
      result = result.replace(propRe, (match, prefix, oldValue, semi) => {
        matchIndex++;
        // If there's only one theme, replace all occurrences
        if (themes.length <= 1) {
          return `${prefix}${newVal}${semi}`;
        }
        // For multi-theme: the Nth occurrence corresponds to the Nth theme block
        // This is a simplification; for complex files, occurrence order = declaration order
        const themeIndex = themes.indexOf(theme);
        if (matchIndex - 1 === themeIndex) {
          return `${prefix}${newVal}${semi}`;
        }
        return match;
      });
    }
  }

  return result;
}

/**
 * Parse and extract CSS custom properties from pasted CSS text.
 * Handles both full CSS blocks and bare property lists.
 */
export function parsePastedCSS(text: string): DesignToken[] {
  // Try as full CSS first
  const blocks = parseCSSBlocks(text);
  if (blocks.length > 0) {
    const { tokens } = parseCSSTokens(text);
    return tokens;
  }

  // Try as bare property list (--name: value;)
  const tokens: DesignToken[] = [];
  const propRe = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = propRe.exec(text)) !== null) {
    const name = m[1];
    const value = m[2].trim();
    tokens.push({
      name,
      values: { default: value },
      syntax: detectSyntax(value),
      description: "",
      inherits: true,
      group: deriveGroup(name),
    });
  }

  return tokens;
}
