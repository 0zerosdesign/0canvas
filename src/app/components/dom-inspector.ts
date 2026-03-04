// ──────────────────────────────────────────────────────────
// DOM Inspector — Direct page inspection (no iframe/bridge)
// ──────────────────────────────────────────────────────────
//
// When DesignDead runs AS A PACKAGE inside the user's app,
// it inspects the current page DOM directly. No proxy, no
// iframe, no postMessage bridge, no PNA issues.
//
// This module provides the same ElementNode tree that the
// iframe bridge provides, but reads from `document` directly.
// ──────────────────────────────────────────────────────────

import type { ElementNode } from "../store";

// ── Configuration ──────────────────────────────────────────

const IGNORED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "LINK",
  "META",
  "HEAD",
  "NOSCRIPT",
  "BR",
  "WBR",
]);

/** DesignDead's own UI elements — skip during inspection */
const DD_ATTR = "data-designdead";

// ── Selector generation ────────────────────────────────────

let idCounter = 0;

function generateId(): string {
  return `dd-${++idCounter}`;
}

function resetIdCounter(): void {
  idCounter = 0;
}

function getSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .filter((c) => !c.startsWith("dd-")) // skip DesignDead classes
    .slice(0, 3)
    .map((c) => `.${CSS.escape(c)}`)
    .join("");

  if (classes) return `${tag}${classes}`;

  // nth-child fallback
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (s) => s.tagName === el.tagName
    );
    if (siblings.length > 1) {
      const idx = siblings.indexOf(el) + 1;
      return `${tag}:nth-child(${idx})`;
    }
  }

  return tag;
}

// ── Computed style extraction ──────────────────────────────

const STYLE_PROPS = [
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

function getComputedStyles(el: Element): Record<string, string> {
  const computed = window.getComputedStyle(el);
  const styles: Record<string, string> = {};

  for (const prop of STYLE_PROPS) {
    const value = computed.getPropertyValue(
      prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
    );
    if (value && value !== "none" && value !== "normal" && value !== "auto") {
      styles[prop] = value;
    }
  }

  return styles;
}

// ── DOM tree walker ────────────────────────────────────────

function getTextContent(el: Element): string | undefined {
  // Only get direct text (not from children)
  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent?.trim() || "";
    }
  }
  return text || undefined;
}

function walkElement(el: Element, depth: number = 0): ElementNode | null {
  // Skip DesignDead's own UI
  if (el.hasAttribute(DD_ATTR)) return null;
  if (el.closest(`[${DD_ATTR}]`)) return null;

  // Skip ignored tags
  if (IGNORED_TAGS.has(el.tagName)) return null;

  // Skip invisible elements (but include elements with visibility:hidden)
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && el.children.length === 0) {
    return null;
  }

  // Limit depth for performance
  if (depth > 15) return null;

  const children: ElementNode[] = [];
  for (const child of el.children) {
    const node = walkElement(child, depth + 1);
    if (node) children.push(node);
  }

  return {
    id: generateId(),
    tag: el.tagName.toLowerCase(),
    classes: Array.from(el.classList).filter((c) => !c.startsWith("dd-")),
    children,
    text: getTextContent(el),
    styles: depth < 8 ? getComputedStyles(el) : {}, // Only compute styles for top levels
    selector: getSelector(el),
    visible: true,
    locked: false,
  };
}

/**
 * Build the full ElementNode tree from the current page DOM.
 * Skips DesignDead's own overlay elements.
 */
export function buildElementTree(): ElementNode[] {
  resetIdCounter();
  const body = document.body;
  if (!body) return [];

  const nodes: ElementNode[] = [];
  for (const child of body.children) {
    const node = walkElement(child, 0);
    if (node) nodes.push(node);
  }
  return nodes;
}

// ── Element lookup (id → DOM element) ──────────────────────

const elementMap = new WeakMap<Element, string>();
const idToElement = new Map<string, Element>();

function buildElementMap(el: Element, depth: number = 0): void {
  if (el.hasAttribute(DD_ATTR)) return;
  if (el.closest(`[${DD_ATTR}]`)) return;
  if (IGNORED_TAGS.has(el.tagName)) return;
  if (depth > 15) return;

  const id = elementMap.get(el) || generateId();
  elementMap.set(el, id);
  idToElement.set(id, el);

  for (const child of el.children) {
    buildElementMap(child, depth + 1);
  }
}

/**
 * Rebuild the id↔element mapping.
 * Call after buildElementTree() to keep maps in sync.
 */
export function rebuildElementMap(): void {
  idToElement.clear();
  resetIdCounter();
  for (const child of document.body.children) {
    buildElementMap(child, 0);
  }
}

/**
 * Get the DOM element for a given DesignDead element ID.
 */
export function getElementById(id: string): Element | null {
  return idToElement.get(id) || null;
}

// ── Live style editing ─────────────────────────────────────

/**
 * Apply a CSS style change directly to a DOM element.
 * Returns the previous value for undo support.
 */
export function applyStyle(
  elementId: string,
  property: string,
  value: string
): string | null {
  const el = getElementById(elementId) as HTMLElement | null;
  if (!el) return null;

  const camelProp = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const oldValue = el.style.getPropertyValue(property) || "";
  (el.style as any)[camelProp] = value;
  return oldValue;
}

// ── Hover/select highlight ─────────────────────────────────

let highlightOverlay: HTMLDivElement | null = null;
let selectOverlay: HTMLDivElement | null = null;

function ensureOverlay(
  type: "hover" | "select"
): HTMLDivElement {
  const isHover = type === "hover";
  let overlay = isHover ? highlightOverlay : selectOverlay;

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.setAttribute(DD_ATTR, "overlay");
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483646;
      border: ${isHover ? "1.5px dashed rgba(0, 112, 243, 0.6)" : "2px solid rgba(0, 112, 243, 0.9)"};
      background: ${isHover ? "rgba(0, 112, 243, 0.04)" : "rgba(0, 112, 243, 0.06)"};
      border-radius: 2px;
      transition: all 0.1s ease;
      display: none;
    `;
    document.body.appendChild(overlay);

    if (isHover) highlightOverlay = overlay;
    else selectOverlay = overlay;
  }

  return overlay;
}

/**
 * Show a highlight overlay on a DOM element.
 */
export function highlightElement(
  elementId: string | null,
  type: "hover" | "select" = "hover"
): void {
  const overlay = ensureOverlay(type);

  if (!elementId) {
    overlay.style.display = "none";
    return;
  }

  const el = getElementById(elementId);
  if (!el) {
    overlay.style.display = "none";
    return;
  }

  const rect = el.getBoundingClientRect();
  overlay.style.display = "block";
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

/**
 * Remove all DesignDead overlays from the page.
 */
export function cleanup(): void {
  document.querySelectorAll(`[${DD_ATTR}]`).forEach((el) => el.remove());
  highlightOverlay = null;
  selectOverlay = null;
  idToElement.clear();
}

// ── Click-to-inspect ───────────────────────────────────────

type InspectCallback = (elementId: string, element: Element) => void;

let inspectActive = false;
let inspectHandler: ((e: MouseEvent) => void) | null = null;
let inspectHoverHandler: ((e: MouseEvent) => void) | null = null;

/**
 * Start click-to-inspect mode.
 * Click any element on the page to select it.
 */
export function startInspect(onSelect: InspectCallback): void {
  stopInspect();
  inspectActive = true;

  // Rebuild element map
  rebuildElementMap();

  inspectHoverHandler = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.hasAttribute(DD_ATTR) || target.closest(`[${DD_ATTR}]`)) return;

    // Find the element ID
    const id = elementMap.get(target);
    if (id) highlightElement(id, "hover");
  };

  inspectHandler = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as Element;
    if (target.hasAttribute(DD_ATTR) || target.closest(`[${DD_ATTR}]`)) return;

    const id = elementMap.get(target);
    if (id) {
      highlightElement(null, "hover"); // Clear hover
      highlightElement(id, "select");
      onSelect(id, target);
    }
  };

  document.addEventListener("mousemove", inspectHoverHandler, true);
  document.addEventListener("click", inspectHandler, true);

  // Change cursor
  document.body.style.cursor = "crosshair";
}

/**
 * Stop click-to-inspect mode.
 */
export function stopInspect(): void {
  if (inspectHandler) {
    document.removeEventListener("click", inspectHandler, true);
    inspectHandler = null;
  }
  if (inspectHoverHandler) {
    document.removeEventListener("mousemove", inspectHoverHandler, true);
    inspectHoverHandler = null;
  }
  highlightElement(null, "hover");
  document.body.style.cursor = "";
  inspectActive = false;
}

export function isInspecting(): boolean {
  return inspectActive;
}

// ── Structured output for AI agents ────────────────────────

/**
 * Generate structured markdown output for an element,
 * suitable for pasting into AI coding agent prompts.
 */
export function generateAgentOutput(elementId: string): string {
  const el = getElementById(elementId);
  if (!el) return "";

  const tag = el.tagName.toLowerCase();
  const selector = getSelector(el);
  const classes = Array.from(el.classList).join(" ");
  const rect = el.getBoundingClientRect();
  const styles = getComputedStyles(el);

  const lines: string[] = [
    `## Element: \`${selector}\``,
    "",
    `- **Tag:** \`<${tag}>\``,
    `- **Classes:** \`${classes || "(none)"}\``,
    `- **Position:** ${Math.round(rect.x)}x${Math.round(rect.y)}, ${Math.round(rect.width)}x${Math.round(rect.height)}`,
  ];

  // Add text content
  const text = el.textContent?.trim().slice(0, 100);
  if (text) {
    lines.push(`- **Text:** "${text}${text.length >= 100 ? "..." : ""}"`);
  }

  // Add key styles
  const styleEntries = Object.entries(styles).slice(0, 15);
  if (styleEntries.length > 0) {
    lines.push("", "### Computed Styles", "```css");
    for (const [prop, val] of styleEntries) {
      const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      lines.push(`${cssProp}: ${val};`);
    }
    lines.push("```");
  }

  // Add DOM path
  const path: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body) {
    path.unshift(getSelector(current));
    current = current.parentElement;
  }
  if (path.length > 0) {
    lines.push("", `### Selector Path`, `\`${path.join(" > ")}\``);
  }

  return lines.join("\n");
}
