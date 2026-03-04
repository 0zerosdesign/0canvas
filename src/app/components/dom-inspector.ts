// ──────────────────────────────────────────────────────────
// DOM Inspector — Inspects consumer's app (via iframe preview)
// ──────────────────────────────────────────────────────────
//
// When DesignDead runs AS A PACKAGE, the consumer's app is
// loaded in an iframe inside the preview panel. This module
// inspects that iframe's DOM — reading elements, highlighting
// on hover, selecting on click, and applying live style edits.
//
// It also supports direct document inspection (no iframe) for
// local development.
//
// Key concept: "target document" — the document being inspected.
// This is either iframe.contentDocument (package mode) or
// window.document (dev mode).
// ──────────────────────────────────────────────────────────

import type { ElementNode, VariantData } from "../store";

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

// ── Target document (iframe or main page) ──────────────────

let targetDoc: Document = document;
let targetIframe: HTMLIFrameElement | null = null;

/**
 * Set the document to inspect. Call this when the preview iframe loads.
 * @param doc - The iframe's contentDocument (or window.document for direct mode)
 * @param iframe - The iframe element (for coordinate mapping). Null for direct mode.
 */
export function setInspectionTarget(
  doc: Document,
  iframe: HTMLIFrameElement | null = null
): void {
  targetDoc = doc;
  targetIframe = iframe;
}

/**
 * Reset inspection target to the main document.
 */
export function resetInspectionTarget(): void {
  targetDoc = document;
  targetIframe = null;
}

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
  const win = targetDoc.defaultView || window;
  const computed = win.getComputedStyle(el);
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
 * Build the full ElementNode tree from the TARGET document's DOM.
 * Uses the iframe's document if setInspectionTarget() was called.
 */
export function buildElementTree(): ElementNode[] {
  resetIdCounter();
  const body = targetDoc.body;
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
 * Rebuild the id↔element mapping from the TARGET document.
 */
export function rebuildElementMap(): void {
  idToElement.clear();
  resetIdCounter();
  const body = targetDoc.body;
  if (!body) return;
  for (const child of body.children) {
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
// Overlays are created in the MAIN document (parent of iframe),
// positioned using coordinate mapping from iframe space to parent space.

let highlightOverlay: HTMLDivElement | null = null;
let selectOverlay: HTMLDivElement | null = null;

function ensureOverlay(type: "hover" | "select"): HTMLDivElement {
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
 * Map an element's bounding rect from the target document
 * to the main document's coordinate space.
 * If inspecting via iframe, adds the iframe's offset.
 */
function getScreenRect(el: Element): DOMRect {
  const rect = el.getBoundingClientRect();
  if (targetIframe) {
    const iframeRect = targetIframe.getBoundingClientRect();
    return new DOMRect(
      rect.x + iframeRect.x,
      rect.y + iframeRect.y,
      rect.width,
      rect.height
    );
  }
  return rect;
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

  const rect = getScreenRect(el);
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
  if (highlightOverlay?.parentNode) highlightOverlay.remove();
  if (selectOverlay?.parentNode) selectOverlay.remove();
  highlightOverlay = null;
  selectOverlay = null;
  idToElement.clear();
  resetInspectionTarget();
}

// ── Click-to-inspect ───────────────────────────────────────

type InspectCallback = (elementId: string, element: Element) => void;

let inspectActive = false;
let inspectHandler: ((e: MouseEvent) => void) | null = null;
let inspectHoverHandler: ((e: MouseEvent) => void) | null = null;

/**
 * Start click-to-inspect mode.
 * Listens on the TARGET document (iframe or main page).
 */
export function startInspect(onSelect: InspectCallback): void {
  stopInspect();
  inspectActive = true;

  // Rebuild element map from target document
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

  // Listen on the TARGET document (iframe's document or main document)
  targetDoc.addEventListener("mousemove", inspectHoverHandler, true);
  targetDoc.addEventListener("click", inspectHandler, true);

  // Change cursor on the target document's body
  if (targetDoc.body) {
    targetDoc.body.style.cursor = "crosshair";
  }
}

/**
 * Stop click-to-inspect mode.
 */
export function stopInspect(): void {
  if (inspectHandler) {
    targetDoc.removeEventListener("click", inspectHandler, true);
    inspectHandler = null;
  }
  if (inspectHoverHandler) {
    targetDoc.removeEventListener("mousemove", inspectHoverHandler, true);
    inspectHoverHandler = null;
  }
  highlightElement(null, "hover");
  if (targetDoc.body) {
    targetDoc.body.style.cursor = "";
  }
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
  const bodyEl = targetDoc.body;
  while (current && current !== bodyEl) {
    path.unshift(getSelector(current));
    current = current.parentElement;
  }
  if (path.length > 0) {
    lines.push("", `### Selector Path`, `\`${path.join(" > ")}\``);
  }

  return lines.join("\n");
}

// ── Snapshot capture for variants ───────────────────────────

/**
 * Collect computed styles from the LIVE DOM tree into a flat array,
 * then apply them to the corresponding elements in a cloned tree.
 * This avoids calling getComputedStyle on detached nodes (which returns defaults).
 */
function collectAndApplyStyles(original: Element, clone: Element, doc: Document): void {
  const win = doc.defaultView || window;
  const origEls: Element[] = [];
  const cloneEls: Element[] = [];

  function walkOriginal(el: Element) {
    if (el.hasAttribute(DD_ATTR) || el.closest(`[${DD_ATTR}]`)) return;
    origEls.push(el);
    for (const child of el.children) walkOriginal(child);
  }

  function walkClone(el: Element) {
    cloneEls.push(el);
    for (const child of el.children) walkClone(child);
  }

  walkOriginal(original);
  walkClone(clone);

  const len = Math.min(origEls.length, cloneEls.length);
  for (let i = 0; i < len; i++) {
    const computed = win.getComputedStyle(origEls[i]);
    const htmlEl = cloneEls[i] as HTMLElement;
    for (const prop of STYLE_PROPS) {
      const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      const val = computed.getPropertyValue(cssProp);
      if (val && val !== "none" && val !== "normal" && val !== "auto" && val !== "0px") {
        htmlEl.style.setProperty(cssProp, val);
      }
    }
  }
}

function extractMockData(el: Element): { images: string[]; texts: string[] } {
  const images: string[] = [];
  const texts: string[] = [];
  const ownerDoc = el.ownerDocument || document;

  const imgs = el.querySelectorAll("img");
  imgs.forEach((img) => {
    if (img.src) images.push(img.src);
  });

  const walker = ownerDoc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim();
    if (text && text.length > 0) texts.push(text);
  }

  return { images: [...new Set(images)], texts: [...new Set(texts)] };
}

/** Convert relative image/link URLs to absolute so they work in sandboxed iframes. */
function absolutifyUrls(html: string, baseUrl: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  doc.querySelectorAll("img[src], video[src], source[src], audio[src]").forEach((el) => {
    const src = el.getAttribute("src");
    if (src && !src.startsWith("data:") && !src.startsWith("http")) {
      try { el.setAttribute("src", new URL(src, baseUrl).href); } catch {}
    }
  });
  doc.querySelectorAll("img[srcset]").forEach((el) => {
    const srcset = el.getAttribute("srcset");
    if (srcset) {
      const fixed = srcset.replace(/(\S+)(\s+\S+)?/g, (_, url, descriptor) => {
        if (url.startsWith("data:") || url.startsWith("http")) return _;
        try { return new URL(url, baseUrl).href + (descriptor || ""); } catch { return _; }
      });
      el.setAttribute("srcset", fixed);
    }
  });
  doc.querySelectorAll("[style]").forEach((el) => {
    const style = el.getAttribute("style") || "";
    const fixed = style.replace(/url\(["']?([^"')]+)["']?\)/g, (match, url) => {
      if (url.startsWith("data:") || url.startsWith("http")) return match;
      try { return `url("${new URL(url, baseUrl).href}")`; } catch { return match; }
    });
    el.setAttribute("style", fixed);
  });

  return doc.body.innerHTML;
}

function sanitizeSnapshot(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  doc.querySelectorAll("script").forEach((s) => s.remove());
  doc.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes)
      .filter((attr) => attr.name.startsWith("on"))
      .forEach((attr) => el.removeAttribute(attr.name));
  });
  doc.querySelectorAll(`[${DD_ATTR}]`).forEach((el) => el.remove());

  return doc.body.innerHTML;
}

function collectCssRules(doc: Document): string {
  const cssRules: string[] = [];
  for (const sheet of doc.styleSheets) {
    try {
      for (const rule of sheet.cssRules) cssRules.push(rule.cssText);
    } catch {
      // Cross-origin stylesheet — skip
    }
  }
  return cssRules.join("\n");
}

/**
 * Capture a full-page HTML/CSS snapshot from the target document.
 * Collects computed styles from the live DOM before cloning.
 */
export function capturePageSnapshot(): Omit<VariantData, "id" | "name" | "parentId" | "status" | "createdAt"> | null {
  const body = targetDoc.body;
  if (!body) return null;

  const clone = body.cloneNode(true) as HTMLElement;
  collectAndApplyStyles(body, clone, targetDoc);

  const mockData = extractMockData(body);
  const tempDiv = targetDoc.createElement("div");
  tempDiv.appendChild(clone);
  const rawHtml = sanitizeSnapshot(tempDiv.innerHTML);
  const baseUrl = (targetDoc.defaultView || window).location.href;
  const html = absolutifyUrls(rawHtml, baseUrl);
  const css = collectCssRules(targetDoc);

  return { html, css, mockData, sourceType: "page" };
}

/**
 * Capture an HTML/CSS snapshot of a specific element by its DesignDead ID.
 * Collects computed styles from the live DOM, plus relevant CSS rules.
 */
export function captureComponentSnapshot(
  elementId: string
): Omit<VariantData, "id" | "name" | "parentId" | "status" | "createdAt"> | null {
  const el = getElementById(elementId);
  if (!el) return null;

  const clone = el.cloneNode(true) as HTMLElement;
  collectAndApplyStyles(el, clone, targetDoc);

  const mockData = extractMockData(el);
  const tempDiv = targetDoc.createElement("div");
  tempDiv.appendChild(clone);
  const rawHtml = sanitizeSnapshot(tempDiv.innerHTML);
  const baseUrl = (targetDoc.defaultView || window).location.href;
  const html = absolutifyUrls(rawHtml, baseUrl);
  const css = collectCssRules(targetDoc);
  const selector = getSelector(el);

  return { html, css, mockData, sourceType: "component", sourceSelector: selector };
}

/**
 * Push a variant's HTML back to the live DOM, replacing the original element.
 * Returns true if the replacement succeeded.
 */
export function pushVariantToMain(
  sourceElementId: string,
  newHtml: string,
  newCss?: string
): boolean {
  const el = getElementById(sourceElementId);
  if (!el) return false;

  const parent = el.parentElement;
  if (!parent) return false;

  const temp = targetDoc.createElement("div");
  temp.innerHTML = newHtml;

  const newEl = temp.firstElementChild;
  if (newEl) {
    parent.replaceChild(newEl, el);
  } else {
    (el as HTMLElement).innerHTML = newHtml;
  }

  if (newCss) {
    const styleEl = targetDoc.createElement("style");
    styleEl.setAttribute("data-designdead-variant-css", "true");
    styleEl.textContent = newCss;
    targetDoc.head.appendChild(styleEl);
  }

  return true;
}

/**
 * Get the outerHTML of an element by its DesignDead ID.
 * Useful for storing the original state before push-to-main.
 */
export function getElementOuterHTML(elementId: string): string | null {
  const el = getElementById(elementId);
  return el ? (el as HTMLElement).outerHTML : null;
}
