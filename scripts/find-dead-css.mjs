#!/usr/bin/env node
/**
 * Find dead CSS classes — selectors defined in CSS that are
 * never referenced by className/class= in any TSX/JSX/TS/HTML.
 *
 * Heuristic and imperfect:
 *   - Treats any class selector like ".foo" or ".foo.bar" as defined.
 *   - Treats a class as "used" if any .ts/.tsx/.js/.jsx/.html/.css
 *     file in src/ mentions the bare identifier (word-boundary).
 *   - Ignores pseudo-only selectors (::scrollbar, :hover, etc).
 *   - Prints: unused list, sorted by file.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const CSS_FILES = [
  "shell/app-shell.css",
  "0canvas/ui/primitives.css",
  "styles/design-tokens.css",
].map((p) => path.join(ROOT, p));

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?|html|css|mdx?)$/.test(name)) out.push(p);
  }
  return out;
}

const ALL_FILES = walk(ROOT);
const HAY = new Map();
for (const f of ALL_FILES) HAY.set(f, fs.readFileSync(f, "utf8"));

function extractClasses(css) {
  const classes = new Set();
  const re = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
  let m;
  while ((m = re.exec(css)) !== null) classes.add(m[1]);
  return [...classes];
}

function isUsed(cls, ownFile) {
  const boundary = new RegExp(`(^|[^a-zA-Z0-9_-])${cls}([^a-zA-Z0-9_-]|$)`);
  // "used" = referenced from a TSX/TS/JSX/JS/HTML file (anywhere).
  for (const [file, content] of HAY) {
    if (/\.css$/.test(file)) continue;
    if (boundary.test(content)) return true;
  }
  // Also count same-sheet composition: the class is referenced by another
  // selector within the SAME file (indicates it's a compound/target selector
  // like `.parent .child`).
  const own = HAY.get(ownFile) || "";
  const matches = own.match(new RegExp(`(^|[^a-zA-Z0-9_-])${cls}([^a-zA-Z0-9_-]|$)`, "g"));
  if (matches && matches.length > 1) return true;
  return false;
}

let totalDead = 0;
for (const cssPath of CSS_FILES) {
  if (!fs.existsSync(cssPath)) continue;
  const rel = path.relative(process.cwd(), cssPath);
  const css = fs.readFileSync(cssPath, "utf8");
  const classes = extractClasses(css);
  const dead = [];
  for (const c of classes) {
    if (!isUsed(c, cssPath)) dead.push(c);
  }
  if (dead.length === 0) {
    console.log(`✓ ${rel} — no dead classes`);
    continue;
  }
  totalDead += dead.length;
  console.log(`\n✗ ${rel} — ${dead.length} unused class(es):`);
  for (const d of dead.sort()) console.log(`    .${d}`);
}

console.log(`\nTotal unused: ${totalDead}`);
process.exit(0);
