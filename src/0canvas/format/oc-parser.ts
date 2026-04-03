// ──────────────────────────────────────────────────────────
// DD Parser — Convert between HTML/CSS and .0c JSON format
// ──────────────────────────────────────────────────────────
//
// Two directions:
//   1. htmlToOCTree()  — parse HTML string + computed styles into OCNode[]
//   2. ocTreeToHtml()  — render OCNode[] back to HTML + CSS strings
//
// ──────────────────────────────────────────────────────────

import {
  type OCNode,
  type OCDocument,
  type OCStyles,
  type OCVariable,
  OC_FORMAT_VERSION,
  DEFAULT_BREAKPOINTS,
} from "./oc-format";

// ── Ignored tags (same as dom-inspector) ───────────────────

const IGNORED_TAGS = new Set([
  "SCRIPT", "STYLE", "LINK", "META", "HEAD", "NOSCRIPT", "BR", "WBR",
]);

const STYLE_PROPS: (keyof OCStyles)[] = [
  "display", "flexDirection", "alignItems", "justifyContent", "gap",
  "gridTemplateColumns", "fontSize", "fontWeight", "fontFamily",
  "lineHeight", "letterSpacing", "textAlign", "textDecoration",
  "color", "backgroundColor", "borderRadius", "border", "borderColor",
  "borderWidth", "boxShadow", "opacity", "transform", "transition",
  "backdropFilter", "position", "top", "right", "bottom", "left",
  "zIndex", "overflow", "width", "height", "maxWidth", "minWidth",
  "maxHeight", "minHeight",
];

const SPACING_PROPS = ["padding", "margin"] as const;

// ── 1. HTML → DD Tree ──────────────────────────────────────

let _idCounter = 0;
function nextId(tag: string): string {
  return `${tag}-${++_idCounter}`;
}

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function parseElement(el: Element, win: Window): OCNode | null {
  const tag = el.tagName.toLowerCase();
  if (IGNORED_TAGS.has(el.tagName)) return null;

  const id = el.id || el.getAttribute("data-oc-id") || nextId(tag);
  const className = el.className && typeof el.className === "string" ? el.className : undefined;

  // Get computed styles
  const computed = win.getComputedStyle(el);
  const styles: OCStyles = {};

  for (const prop of STYLE_PROPS) {
    const cssProp = camelToKebab(prop as string);
    const val = computed.getPropertyValue(cssProp);
    if (val && val !== "none" && val !== "normal" && val !== "auto" && val !== "0px" && val !== "static" && val !== "visible") {
      (styles as any)[prop] = val;
    }
  }

  // Spacing (padding/margin) — parse to 4-value shorthand
  for (const prop of SPACING_PROPS) {
    const top = computed.getPropertyValue(`${prop}-top`);
    const right = computed.getPropertyValue(`${prop}-right`);
    const bottom = computed.getPropertyValue(`${prop}-bottom`);
    const left = computed.getPropertyValue(`${prop}-left`);
    if (top !== "0px" || right !== "0px" || bottom !== "0px" || left !== "0px") {
      if (top === right && right === bottom && bottom === left) {
        styles[prop] = top;
      } else {
        styles[prop] = [top, right, bottom, left] as any;
      }
    }
  }

  // Get text content (only for leaf text nodes)
  let text: string | undefined;
  const childNodes = Array.from(el.childNodes);
  const hasElementChildren = childNodes.some((n) => n.nodeType === Node.ELEMENT_NODE);
  if (!hasElementChildren) {
    const t = el.textContent?.trim();
    if (t) text = t;
  }

  // Recurse into children
  let children: OCNode[] | undefined;
  if (hasElementChildren) {
    children = [];
    for (const child of el.children) {
      const parsed = parseElement(child, win);
      if (parsed) children.push(parsed);
    }
    if (children.length === 0) children = undefined;
  }

  const node: OCNode = { id, tag };
  if (className) node.class = className;

  // Copy relevant attributes
  const href = el.getAttribute("href");
  if (href) node.href = href;
  const src = el.getAttribute("src");
  if (src) node.src = src;
  const alt = el.getAttribute("alt");
  if (alt) node.alt = alt;
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) node.placeholder = placeholder;

  if (text) node.text = text;

  // Only include styles that have meaningful values
  if (Object.keys(styles).length > 0) node.styles = styles;
  if (children) node.children = children;

  return node;
}

/**
 * Parse an HTML string + CSS into a OCDocument.
 * Uses a temporary detached document to parse.
 */
export function htmlToOCDocument(
  html: string,
  css: string,
  name: string,
  source: OCDocument["source"],
): OCDocument {
  _idCounter = 0;

  // Parse HTML in a temporary iframe to get computed styles
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1280px;height:800px;border:none;";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>${css}</style><style>body{margin:0;}</style></head><body>${html}</body></html>`);
    doc.close();

    const win = iframe.contentWindow!;
    const tree: OCNode[] = [];

    for (const child of doc.body.children) {
      const node = parseElement(child, win);
      if (node) tree.push(node);
    }

    // Extract variables from CSS custom properties
    const variables: Record<string, OCVariable> = {};
    const rootStyle = win.getComputedStyle(doc.documentElement);
    const cssText = css || "";
    const varRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+)/g;
    let match;
    while ((match = varRegex.exec(cssText)) !== null) {
      const varName = match[1].replace(/-/g, ".");
      const value = match[2].trim();
      const isColor = value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl");
      const isNumber = /^\d+(\.\d+)?(px|rem|em|%)?$/.test(value);
      variables[varName] = {
        type: isColor ? "color" : isNumber ? "number" : "string",
        value: isNumber ? parseFloat(value) : value,
      };
    }

    return {
      version: OC_FORMAT_VERSION,
      name,
      source,
      variables: Object.keys(variables).length > 0 ? variables : undefined,
      breakpoints: { ...DEFAULT_BREAKPOINTS },
      tree,
    };
  } finally {
    document.body.removeChild(iframe);
  }
}

// ── 2. DD Tree → HTML/CSS ──────────────────────────────────

function resolveValue(val: string | number, variables?: Record<string, OCVariable>): string {
  if (typeof val === "number") return `${val}px`;
  if (typeof val === "string" && val.startsWith("$") && variables) {
    const varName = val.slice(1);
    const v = variables[varName];
    if (v) return typeof v.value === "number" ? `${v.value}px` : String(v.value);
  }
  return String(val);
}

function stylesToCSSString(
  styles: OCStyles | undefined,
  variables?: Record<string, OCVariable>,
): string {
  if (!styles) return "";
  const parts: string[] = [];

  for (const [key, val] of Object.entries(styles)) {
    if (val === undefined) continue;
    const cssProp = camelToKebab(key);

    if (Array.isArray(val)) {
      // Spacing shorthand [top, right, bottom, left]
      parts.push(`${cssProp}: ${val.map((v) => resolveValue(v, variables)).join(" ")}`);
    } else {
      parts.push(`${cssProp}: ${resolveValue(val, variables)}`);
    }
  }

  return parts.join("; ");
}

function renderNode(node: OCNode, variables?: Record<string, OCVariable>): string {
  const tag = node.tag;
  const attrs: string[] = [];

  if (node.id) attrs.push(`data-oc-id="${node.id}"`);
  if (node.class) attrs.push(`class="${node.class}"`);
  if (node.href) attrs.push(`href="${node.href}"`);
  if (node.src) attrs.push(`src="${node.src}"`);
  if (node.alt) attrs.push(`alt="${node.alt}"`);
  if (node.placeholder) attrs.push(`placeholder="${node.placeholder}"`);
  if (node.type) attrs.push(`type="${node.type}"`);

  const inlineStyle = stylesToCSSString(node.styles, variables);
  if (inlineStyle) attrs.push(`style="${inlineStyle}"`);

  const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";

  const selfClosing = new Set(["img", "input", "br", "hr"]);
  if (selfClosing.has(tag)) {
    return `<${tag}${attrStr} />`;
  }

  const inner = node.text
    ? node.text
    : node.children
      ? node.children.map((c) => renderNode(c, variables)).join("\n")
      : "";

  return `<${tag}${attrStr}>${inner}</${tag}>`;
}

function generateResponsiveCSS(
  tree: OCNode[],
  breakpoints: OCDocument["breakpoints"],
  variables?: Record<string, OCVariable>,
): string {
  if (!breakpoints) return "";

  const mediaRules: Record<string, string[]> = {};

  function collectResponsive(nodes: OCNode[]) {
    for (const node of nodes) {
      if (node.responsive) {
        for (const [bp, overrides] of Object.entries(node.responsive)) {
          const bpDef = breakpoints![bp];
          if (!bpDef) continue;

          const conditions: string[] = [];
          if (bpDef.minWidth) conditions.push(`(min-width: ${bpDef.minWidth}px)`);
          if (bpDef.maxWidth) conditions.push(`(max-width: ${bpDef.maxWidth}px)`);
          const mq = conditions.join(" and ");
          if (!mq) continue;

          if (!mediaRules[mq]) mediaRules[mq] = [];
          const cssProps = stylesToCSSString(overrides as OCStyles, variables);
          if (cssProps) {
            mediaRules[mq].push(`[data-oc-id="${node.id}"] { ${cssProps}; }`);
          }
        }
      }
      if (node.children) collectResponsive(node.children);
    }
  }

  collectResponsive(tree);

  const parts: string[] = [];
  for (const [mq, rules] of Object.entries(mediaRules)) {
    parts.push(`@media ${mq} {\n  ${rules.join("\n  ")}\n}`);
  }
  return parts.join("\n\n");
}

/**
 * Render a OCDocument to { html, css } strings for preview.
 */
export function ocDocumentToHtml(doc: OCDocument): { html: string; css: string } {
  const html = doc.tree.map((n) => renderNode(n, doc.variables)).join("\n");

  // Generate CSS variables block
  let variablesCss = "";
  if (doc.variables && Object.keys(doc.variables).length > 0) {
    const vars = Object.entries(doc.variables).map(
      ([name, v]) => `  --${name.replace(/\./g, "-")}: ${typeof v.value === "number" ? v.value + "px" : v.value};`
    );
    variablesCss = `:root {\n${vars.join("\n")}\n}\n\n`;
  }

  // Generate responsive media queries
  const responsiveCss = generateResponsiveCSS(doc.tree, doc.breakpoints, doc.variables);

  const css = [variablesCss, responsiveCss].filter(Boolean).join("\n");
  return { html, css };
}
