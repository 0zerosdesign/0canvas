// ──────────────────────────────────────────────────────────
// DOM Walker — DOM traversal, element mapping, snapshots
// ──────────────────────────────────────────────────────────

import type { ElementNode, VariantData } from "../store/store";
import { identifyElement } from "./component-detection";
import { IGNORED_TAGS, OC_ATTR, STYLE_PROPS } from "./constants";
import { getTargetDoc } from "./target";

// ── Selector generation ────────────────────────────────────

let idCounter = 0;

function generateId(): string {
  return `oc-${++idCounter}`;
}

function resetIdCounter(): void {
  idCounter = 0;
}

function getSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .filter((c) => !c.startsWith("oc-"))
    .slice(0, 3)
    .map((c) => `.${CSS.escape(c)}`)
    .join("");

  if (classes) return `${tag}${classes}`;

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

function getComputedStyles(el: Element): Record<string, string> {
  const targetDoc = getTargetDoc();
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
  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent?.trim() || "";
    }
  }
  return text || undefined;
}

export function walkElement(el: Element, depth: number = 0): ElementNode | null {
  if (el.hasAttribute(OC_ATTR)) return null;
  if (el.closest(`[${OC_ATTR}]`)) return null;
  if (IGNORED_TAGS.has(el.tagName)) return null;

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && el.children.length === 0) {
    return null;
  }

  if (depth > 15) return null;

  const children: ElementNode[] = [];
  for (const child of el.children) {
    const node = walkElement(child, depth + 1);
    if (node) children.push(node);
  }

  return {
    id: generateId(),
    tag: el.tagName.toLowerCase(),
    classes: Array.from(el.classList).filter((c) => !c.startsWith("oc-")),
    children,
    text: getTextContent(el),
    styles: depth < 8 ? getComputedStyles(el) : {},
    selector: getSelector(el),
    visible: true,
    locked: false,
    componentName: (() => {
      const info = identifyElement(el);
      return info.source !== "tag" ? info.displayName : undefined;
    })(),
  };
}

/**
 * Build the full ElementNode tree from the TARGET document's DOM.
 */
export function buildElementTree(): ElementNode[] {
  const targetDoc = getTargetDoc();
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

// ── Element lookup (id -> DOM element) ─────────────────────

/** Exposed so other modules (overlay, feedback-pill, theme-pill) can look up element IDs */
export const elementMap = new WeakMap<Element, string>();
const idToElement = new Map<string, Element>();

function buildElementMap(el: Element, depth: number = 0): void {
  if (el.hasAttribute(OC_ATTR)) return;
  if (el.closest(`[${OC_ATTR}]`)) return;
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
 * Rebuild the id<->element mapping from the TARGET document.
 */
export function rebuildElementMap(): void {
  const targetDoc = getTargetDoc();
  idToElement.clear();
  resetIdCounter();
  const body = targetDoc.body;
  if (!body) return;
  for (const child of body.children) {
    buildElementMap(child, 0);
  }
}

/**
 * Get the DOM element for a given Zeros element ID.
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

// ── Flash / change visualization ────────────────────────────

/** Get document-absolute coordinates from a viewport rect */
export function toAbsolute(
  rect: DOMRect,
  doc: Document
): { top: number; left: number } {
  const win = doc.defaultView || window;
  return {
    top: rect.top + win.scrollY,
    left: rect.left + win.scrollX,
  };
}

/**
 * Briefly highlight an element with a green pulse to indicate
 * a successful style change. Auto-removes after 1.5s.
 */
export function flashElement(elementId: string): void {
  const targetDoc = getTargetDoc();
  const el = getElementById(elementId) as HTMLElement | null;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const abs = toAbsolute(rect, targetDoc);

  const flash = targetDoc.createElement("div");
  flash.setAttribute("data-Zeros", "flash-overlay");
  flash.style.cssText = [
    "position:absolute",
    "pointer-events:none",
    `top:${abs.top}px`,
    `left:${abs.left}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    "border:2px solid #22c55e",
    "border-radius:3px",
    "z-index:2147483639",
    "animation:oc-flash 1.5s ease-out forwards",
    "box-sizing:border-box",
  ].join(";");

  ensureFlashKeyframes();
  targetDoc.body.appendChild(flash);

  setTimeout(() => {
    if (flash.parentNode) flash.remove();
  }, 1500);
}

function ensureFlashKeyframes(): void {
  const targetDoc = getTargetDoc();
  const FLASH_STYLE_ID = "oc-flash-keyframes";
  if (targetDoc.getElementById(FLASH_STYLE_ID)) return;

  const style = targetDoc.createElement("style");
  style.id = FLASH_STYLE_ID;
  style.textContent = `
    @keyframes oc-flash {
      0% { box-shadow: 0 0 0 2px #22c55e; opacity: 1; }
      50% { box-shadow: 0 0 8px 2px #22c55e40; opacity: 0.8; }
      100% { box-shadow: 0 0 0 0 transparent; opacity: 0; border-color: transparent; }
    }
  `;
  targetDoc.head.appendChild(style);
}

// ── Structured output for AI agents ────────────────────────

/**
 * Generate structured markdown output for an element,
 * suitable for pasting into AI coding agent prompts.
 */
export function generateAgentOutput(elementId: string): string {
  const targetDoc = getTargetDoc();
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

  const text = el.textContent?.trim().slice(0, 100);
  if (text) {
    lines.push(
      `- **Text:** "${text}${text.length >= 100 ? "..." : ""}"`
    );
  }

  const styleEntries = Object.entries(styles).slice(0, 15);
  if (styleEntries.length > 0) {
    lines.push("", "### Computed Styles", "```css");
    for (const [prop, val] of styleEntries) {
      const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      lines.push(`${cssProp}: ${val};`);
    }
    lines.push("```");
  }

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

// ── Snapshot helpers ────────────────────────────────────────

function extractMockData(
  el: Element
): { images: string[]; texts: string[] } {
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

function absolutifyUrls(html: string, baseUrl: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  doc
    .querySelectorAll("img[src], video[src], source[src], audio[src]")
    .forEach((el) => {
      const src = el.getAttribute("src");
      if (src && !src.startsWith("data:") && !src.startsWith("http")) {
        try {
          el.setAttribute("src", new URL(src, baseUrl).href);
        } catch {}
      }
    });
  doc.querySelectorAll("img[srcset]").forEach((el) => {
    const srcset = el.getAttribute("srcset");
    if (srcset) {
      const fixed = srcset.replace(
        /(\S+)(\s+\S+)?/g,
        (_, url, descriptor) => {
          if (url.startsWith("data:") || url.startsWith("http")) return _;
          try {
            return new URL(url, baseUrl).href + (descriptor || "");
          } catch {
            return _;
          }
        }
      );
      el.setAttribute("srcset", fixed);
    }
  });
  doc.querySelectorAll("[style]").forEach((el) => {
    const style = el.getAttribute("style") || "";
    const fixed = style.replace(
      /url\(["']?([^"')]+)["']?\)/g,
      (match, url) => {
        if (url.startsWith("data:") || url.startsWith("http")) return match;
        try {
          return `url("${new URL(url, baseUrl).href}")`;
        } catch {
          return match;
        }
      }
    );
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
  doc.querySelectorAll(`[${OC_ATTR}]`).forEach((el) => el.remove());

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

  if (doc.adoptedStyleSheets && doc.adoptedStyleSheets.length > 0) {
    for (const sheet of doc.adoptedStyleSheets) {
      try {
        for (const rule of sheet.cssRules) cssRules.push(rule.cssText);
      } catch {
        /* skip */
      }
    }
  }

  if (cssRules.length === 0) {
    doc.querySelectorAll("style").forEach((styleEl) => {
      const text = styleEl.textContent;
      if (text && !styleEl.hasAttribute("data-Zeros-variant-css")) {
        cssRules.push(text);
      }
    });
  }

  return cssRules.join("\n");
}

function collectExternalStylesheetLinks(doc: Document): string[] {
  const links: string[] = [];
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
    const href = el.getAttribute("href");
    if (href) links.push(href);
  });
  return links;
}

/**
 * Capture a full-page HTML/CSS snapshot from the target document.
 */
export function capturePageSnapshot():
  | Omit<VariantData, "id" | "name" | "parentId" | "status" | "createdAt">
  | null {
  const targetDoc = getTargetDoc();
  const body = targetDoc.body;
  if (!body) return null;

  const clone = body.cloneNode(true) as HTMLElement;
  const mockData = extractMockData(body);
  const tempDiv = targetDoc.createElement("div");
  tempDiv.appendChild(clone);
  const rawHtml = sanitizeSnapshot(tempDiv.innerHTML);
  const baseUrl = (targetDoc.defaultView || window).location.href;
  const html = absolutifyUrls(rawHtml, baseUrl);
  const cssRules = collectCssRules(targetDoc);
  const externalLinks = collectExternalStylesheetLinks(targetDoc);
  const linkTags = externalLinks
    .map((href) => `@import url("${href}");`)
    .join("\n");
  const css = linkTags ? linkTags + "\n" + cssRules : cssRules;

  const contentHeight = body.scrollHeight || body.offsetHeight || 0;

  return {
    html,
    css,
    mockData,
    sourceType: "page",
    sourceContentHeight: contentHeight,
  };
}

/**
 * Capture an HTML/CSS snapshot of a specific element by its Zeros ID.
 */
export function captureComponentSnapshot(
  elementId: string
):
  | Omit<VariantData, "id" | "name" | "parentId" | "status" | "createdAt">
  | null {
  const targetDoc = getTargetDoc();
  const el = getElementById(elementId);
  if (!el) return null;

  const clone = el.cloneNode(true) as HTMLElement;
  const mockData = extractMockData(el);
  const tempDiv = targetDoc.createElement("div");
  tempDiv.appendChild(clone);
  const rawHtml = sanitizeSnapshot(tempDiv.innerHTML);
  const baseUrl = (targetDoc.defaultView || window).location.href;
  const html = absolutifyUrls(rawHtml, baseUrl);
  const cssRules = collectCssRules(targetDoc);
  const externalLinks = collectExternalStylesheetLinks(targetDoc);
  const linkTags = externalLinks
    .map((href) => `@import url("${href}");`)
    .join("\n");
  const css = linkTags ? linkTags + "\n" + cssRules : cssRules;
  const selector = getSelector(el);

  const contentHeight =
    (el as HTMLElement).offsetHeight || (el as HTMLElement).scrollHeight || 0;

  return {
    html,
    css,
    mockData,
    sourceType: "component",
    sourceSelector: selector,
    sourceContentHeight: contentHeight,
  };
}

/**
 * Get the outerHTML of an element by its Zeros ID.
 */
export function getElementOuterHTML(elementId: string): string | null {
  const el = getElementById(elementId);
  return el ? (el as HTMLElement).outerHTML : null;
}

/**
 * Push a variant's HTML back to the live DOM, replacing the original element.
 */
export function pushVariantToMain(
  sourceElementId: string,
  newHtml: string,
  newCss?: string
): boolean {
  const targetDoc = getTargetDoc();
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
    styleEl.setAttribute("data-Zeros-variant-css", "true");
    styleEl.textContent = newCss;
    targetDoc.head.appendChild(styleEl);
  }

  return true;
}

/** Cleanup: clear the id-to-element map */
export function cleanupWalker(): void {
  idToElement.clear();
}
