#!/usr/bin/env node
// ============================================================
// check-ui-consistency.mjs
// ------------------------------------------------------------
// Lint guardrail for RULES.md Rule 4, 11, 12, 14, 15.
//
// Scans src/**/*.{ts,tsx,css,mjs,js,jsx} and reports:
//   • Hex colors outside tokens.css
//   • rgba() literals outside tokens.css / primitives.css
//   • Off-scale font-size: Npx (N not in {10,11,12,13,15,18})
//   • Off-scale border-radius: Npx (N not in {4,6,8,12})
//   • Odd space values (3,5,7,9,11,13,15) in CSS padding/gap/margin
//   • Numeric z-index in component files (not in tokens/primitives)
//   • Tailwind color classes: bg|text|border-(red|blue|...)-\d+
//   • Primitive tokens referenced outside tokens.css
//   • Inline style with static visual properties
//   • `Inter` or other web font names
//
// Zero dependencies. Run: `node scripts/check-ui-consistency.mjs`
// Exit code is 0 (clean) or 1 (violations).
// ============================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

// Files that ARE allowed to contain raw values (token definitions, etc.)
const ALLOWLIST = new Set([
  "styles/tokens.css",
  "styles/variables.css", // legacy re-export
  "src/zeros/ui/primitives.css",
  // Parsers / lookup tables that describe CSS/Tailwind values — these
  // contain raw strings that describe what Tailwind classes MEAN but
  // are not themselves applied to the UI.
  "src/zeros/lib/tailwind.ts",
  "src/zeros/lib/css-properties.ts",
  "src/zeros/inspector/component-detection.ts",
  "src/zeros/themes/css-token-parser.ts",
  "src/zeros/themes/theme-color-resolver.ts",
  // Category palette — hex colors because alpha is concatenated
  // onto the string at runtime (impossible with CSS variables).
  // Values mirror the primitive token scale exactly.
  "src/zeros/editors/tailwind-editor.tsx",
  // xterm.js theme object — the terminal emulator takes raw hex
  // strings in a JS object, cannot consume CSS custom properties.
  "src/shell/terminal-panel.tsx",
  // DOM inspector overlay color constants — injected into a user's
  // running app via inline styles, cannot rely on the shell token
  // scope.
  "src/zeros/inspector/constants.ts",
  "src/zeros/inspector/dom-walker.ts",
  // Demo-only assets, not production code.
  "src/demo/style/variables.css",
  "src/demo/pages/docs.tsx",
  // Engine injected stylesheet — partial migration in progress.
  // Files on this list still contain legacy drift; remove as they
  // are migrated one-by-one.
  "src/zeros/engine/zeros-styles.ts",
  "src/zeros/engine/styles/tokens.ts",       // token definitions (primitives live here)
  "src/zeros/engine/styles/layout.ts",       // tailwind arbitrary-value compat layer
  "src/zeros/engine/styles/agent-panel.ts",
  "src/zeros/engine/styles/canvas.ts",
  "src/zeros/engine/styles/panels.ts",
  "src/zeros/engine/styles/toolbar.ts",
  "src/zeros/engine/styles/index.ts",
  // Inspector overlays with hand-rolled DOM strings — next wave.
  "src/zeros/inspector/feedback-pill.ts",
  "src/zeros/inspector/theme-pill.ts",
  "src/zeros/inspector/overlay.ts",
]);

// Skip entire directories
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "dist-engine",
  ".git",
  "target",
]);

const ALLOWED_FONT_SIZES_PX = new Set([10, 11, 12, 13, 15, 18]);
const ALLOWED_RADII_PX = new Set([0, 4, 6, 8, 12]);
// Spacing scale — matches --space-1..--space-12 in tokens.css.
// 1px is also allowed for column seams / dividers (Rule 13: "1px
// seams, not tone steps"). Everything else must snap to scale.
const ALLOWED_SPACE_PX = new Set([0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48]);

const TAILWIND_COLOR_RE =
  /\b(bg|text|border|ring|divide|from|to|via|shadow|fill|stroke|outline|accent|caret|placeholder|decoration)-(red|blue|green|yellow|orange|purple|pink|gray|grey|zinc|slate|neutral|stone|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose|amber|lime)-\d{2,3}\b/;

// Match hex colors like #fff, #ffffff, #ffff80 — but avoid URL fragments
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

// Primitive tokens (from the palette sections of tokens.css)
const PRIMITIVE_TOKEN_RE =
  /var\(--(grey|blue|green|red|yellow|orange|purple|pink|teal|cyan|indigo|fuchsia|lime|sky)-\d{2,3}\b/;

// Inline style with static visual property. We only flag when we can
// see a literal value (string or number). var(--…) and dynamic identifiers
// are allowed.
// Two-stage check: find each `style={{ ... }}` body, then for each
// visual property in the body, verify its value either starts with
// `var(` or is a runtime identifier (not a literal).
const STYLE_BODY_RE = /\bstyle=\{\{([^}]+)\}\}/g;
const VISUAL_PROPS = new Set([
  "color",
  "background",
  "backgroundColor",
  "padding",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "border",
  "borderRadius",
  "borderTop",
  "borderBottom",
  "borderLeft",
  "borderRight",
  "borderColor",
  "borderStyle",
  "borderWidth",
  "boxShadow",
  "zIndex",
]);

// Within a style body, split into property: value pairs and test each.
// A value is "OK" if it starts with `var(` (token), or is a pure
// identifier/expression (no string / hex / number literal).
function findInlineVisualViolations(body) {
  // Strip nested braces / parens for split safety.
  const props = body.split(",").map((p) => p.trim()).filter(Boolean);
  const bad = [];
  for (const p of props) {
    const colon = p.indexOf(":");
    if (colon === -1) continue;
    const key = p.slice(0, colon).trim().replace(/^["']|["']$/g, "");
    const raw = p.slice(colon + 1).trim();
    if (!VISUAL_PROPS.has(key)) continue;
    // Strip surrounding quotes/backticks if any.
    let value = raw;
    if (/^["'`]/.test(value)) value = value.slice(1);
    if (/["'`]$/.test(value)) value = value.slice(0, -1);
    value = value.trim();
    // Allowed values:
    //   - `var(--…)` token reference
    //   - `0`, `"0"`, `"none"`, `"auto"`, `"inherit"`, `"initial"`, `"unset"`
    //   - `calc(…)` expressions (runtime layout)
    //   - pure JS identifiers (rect.y, dims.w, foo?.bar, a ? b : c)
    if (/^var\s*\(/.test(value)) continue;
    if (/^0+$/.test(value)) continue;
    if (/^(none|auto|inherit|initial|unset|currentColor|transparent)$/i.test(value)) continue;
    if (/^calc\s*\(/.test(value)) continue;
    // Runtime identifier / ternary expression: starts with identifier,
    // may include method calls, ternaries, string literals (for
    // `.startsWith("var(")` style checks). Must NOT start with a digit,
    // quote, or `#`.
    if (
      /^[A-Za-z_$]/.test(value) &&
      !/^(true|false)$/.test(value) &&
      /^[A-Za-z_$][A-Za-z0-9_$.?!()[\]\s"'`:|&+\-*/,<>=]*$/.test(value)
    )
      continue;
    // Flag anything else — it's a literal value.
    bad.push({ key, value });
  }
  return bad;
}

const WEB_FONT_RE = /font-family\s*:\s*[^;]*\b(Inter|Roboto|Lato|Montserrat|Open Sans|Source Sans|IBM Plex|Poppins|Nunito)\b/i;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function shouldScan(file) {
  const ext = extname(file).toLowerCase();
  if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".css"].includes(ext)) return false;
  if (file.includes("/scripts/")) return false;
  return true;
}

function toRel(abs) {
  return relative(ROOT, abs).split(sep).join("/");
}

const violations = [];

function push(file, line, message) {
  violations.push({ file, line, message });
}

function scanFile(absPath) {
  const rel = toRel(absPath);
  const src = readFileSync(absPath, "utf8");
  const lines = src.split(/\r?\n/);
  const isAllowlisted = ALLOWLIST.has(rel);
  const isCss = absPath.endsWith(".css");
  const isPrimitivesCss = rel === "src/zeros/ui/primitives.css";

  lines.forEach((line, idx) => {
    const ln = idx + 1;
    // Per-line suppression directive. Either:
    //   • place `check:ui ignore-line` on the SAME line as the
    //     violation (in a trailing comment), OR
    //   • place `check:ui ignore-next` on the line immediately
    //     ABOVE the violation (useful for long string literals).
    // Use sparingly, always with a reason in the same comment.
    if (/check:ui\s+ignore-line/.test(line)) return;
    if (idx > 0 && /check:ui\s+ignore-next/.test(lines[idx - 1])) return;

    // --- HEX colors ---
    // Allow in allowlisted files and in comments in any file.
    if (!isAllowlisted) {
      const hexMatches = [...line.matchAll(HEX_RE)];
      // Ignore comment lines (CSS `/*`, JS `//` or `*`)
      const trimmed = line.trim();
      const isComment =
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*");
      if (!isComment) {
        for (const m of hexMatches) {
          // Skip URL-looking contexts (anchor links, href="#…")
          const before = line.slice(Math.max(0, m.index - 5), m.index);
          if (before.includes("#")) continue;
          push(rel, ln, `Hex color "${m[0]}" — use a token from tokens.css (see skills/tokens-decision.md).`);
        }
      }
    }

    // --- rgba literals ---
    if (!isAllowlisted && /\brgba?\(/.test(line)) {
      const trimmed = line.trim();
      const isComment =
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*");
      if (!isComment) {
        push(rel, ln, "rgba() literal — use --tint-hover / --tint-active / --tint-primary-soft or add to tokens.css.");
      }
    }

    // --- Primitive token leaks ---
    if (!isAllowlisted && PRIMITIVE_TOKEN_RE.test(line)) {
      push(rel, ln, "Primitive token referenced outside tokens.css — use a SEMANTIC token (e.g. --surface-0, --text-muted, --primary).");
    }

    // --- Tailwind color utility ---
    if (!isAllowlisted && !isCss && TAILWIND_COLOR_RE.test(line)) {
      push(rel, ln, "Tailwind color class — use a semantic token or a primitive component (see RULES.md Rule 12).");
    }

    // --- Web font ---
    if (!isAllowlisted && WEB_FONT_RE.test(line)) {
      push(rel, ln, "Web font referenced directly — use var(--font-ui) or var(--font-mono).");
    }

    // --- font-size: Npx off-scale (CSS only, skip tokens file) ---
    if (isCss && !isAllowlisted && !isPrimitivesCss) {
      const fs = line.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px\b/);
      if (fs) {
        const n = Number(fs[1]);
        if (!ALLOWED_FONT_SIZES_PX.has(n)) {
          push(rel, ln, `Off-scale font-size: ${n}px — snap to {10,11,12,13,15,18} via --text-N.`);
        }
      }
      // --- border-radius: Npx off-scale ---
      const br = line.match(/border-radius\s*:\s*(\d+(?:\.\d+)?)px\b/);
      if (br) {
        const n = Number(br[1]);
        if (!ALLOWED_RADII_PX.has(n) && n !== 9999 && n !== 50) {
          push(rel, ln, `Off-scale border-radius: ${n}px — use --radius-xs|sm|md|lg|pill|circle.`);
        }
      }
      // --- numeric z-index in CSS outside tokens + primitives ---
      const zi = line.match(/z-index\s*:\s*(\d+)/);
      if (zi) {
        push(rel, ln, `Numeric z-index: ${zi[1]} — use --z-chrome|panel|dropdown|modal|toast.`);
      }
      // --- odd space values in padding / gap / margin ---
      // Only flag solitary odd pixel values (e.g. `padding: 13px`).
      const spaceMatch = line.match(/\b(padding|margin|gap)\b\s*:\s*([^;]+)/);
      if (spaceMatch) {
        const values = spaceMatch[2].match(/\b(\d+(?:\.\d+)?)px\b/g) || [];
        for (const v of values) {
          const n = Number(v.replace("px", ""));
          if (!ALLOWED_SPACE_PX.has(n) && n > 0) {
            push(rel, ln, `Off-scale ${spaceMatch[1]} value: ${n}px — snap to even step via --space-N.`);
          }
        }
      }
    }

    // --- inline visual style (two-stage) ---
    if (/\.tsx?$/.test(absPath)) {
      const matches = [...line.matchAll(STYLE_BODY_RE)];
      for (const m of matches) {
        const bad = findInlineVisualViolations(m[1]);
        for (const b of bad) {
          push(rel, ln, `Inline style "${b.key}: ${b.value}" — use a class or primitive with a token (RULES.md Rule 14).`);
        }
      }
    }
  });
}

// Run
const files = walk(SRC).filter(shouldScan);
for (const f of files) scanFile(f);

if (violations.length === 0) {
  console.log("check:ui — clean");
  process.exit(0);
}

// Group by file for readable output
const byFile = new Map();
for (const v of violations) {
  if (!byFile.has(v.file)) byFile.set(v.file, []);
  byFile.get(v.file).push(v);
}

console.log(`check:ui — ${violations.length} violation(s) across ${byFile.size} file(s)`);
console.log("");
for (const [file, vs] of [...byFile.entries()].sort()) {
  console.log(`  ${file}`);
  for (const v of vs) console.log(`    ${String(v.line).padStart(4)}: ${v.message}`);
  console.log("");
}
console.log("Fix violations above. See skills/tokens-decision.md to pick the right token.");
process.exit(1);
