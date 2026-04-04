// ──────────────────────────────────────────────────────────
// DOM Inspector — Inspects consumer's app (via iframe preview)
// ──────────────────────────────────────────────────────────
//
// When ZeroCanvas runs AS A PACKAGE, the consumer's app is
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

import type { ElementNode, VariantData } from "../store/store";

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

/** ZeroCanvas's own UI elements — skip during inspection */
const OC_ATTR = "data-0canvas";

// ── Target document (iframe or main page) ──────────────────

let targetDoc: Document = document;
let targetIframe: HTMLIFrameElement | null = null;

/**
 * Set the document to inspect. Call this when the preview iframe loads.
 * Cleans up overlays from the previous document if the target changes.
 */
export function setInspectionTarget(
  doc: Document,
  iframe: HTMLIFrameElement | null = null
): void {
  if (targetDoc !== doc) {
    if (highlightOverlay?.parentNode) highlightOverlay.remove();
    if (selectOverlay?.parentNode) selectOverlay.remove();
    highlightOverlay = null;
    selectOverlay = null;
    _selectedEl = null;
    if (_scrollHandler) {
      try { targetDoc.removeEventListener("scroll", _scrollHandler, true); } catch { /* noop */ }
      _scrollHandler = null;
    }
  }
  targetDoc = doc;
  targetIframe = iframe;
}

/**
 * Reset inspection target to the main document.
 */
export function resetInspectionTarget(): void {
  if (targetDoc !== document) {
    if (highlightOverlay?.parentNode) highlightOverlay.remove();
    if (selectOverlay?.parentNode) selectOverlay.remove();
    highlightOverlay = null;
    selectOverlay = null;
    _selectedEl = null;
  }
  targetDoc = document;
  targetIframe = null;
}

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
    .filter((c) => !c.startsWith("oc-")) // skip ZeroCanvas classes
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
  // Skip ZeroCanvas's own UI
  if (el.hasAttribute(OC_ATTR)) return null;
  if (el.closest(`[${OC_ATTR}]`)) return null;

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
    classes: Array.from(el.classList).filter((c) => !c.startsWith("oc-")),
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
 * Get the DOM element for a given ZeroCanvas element ID.
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
// Overlays are created in the TARGET document (inside the iframe),
// so they naturally move with the canvas when ReactFlow pans/zooms.

let highlightOverlay: HTMLDivElement | null = null;
let selectOverlay: HTMLDivElement | null = null;
let _selectedEl: Element | null = null;
let _scrollHandler: (() => void) | null = null;
let _rafId: number | null = null;
let _feedbackCallback: (() => void) | null = null;
let _forkElementCallback: ((elementId: string) => void) | null = null;

/**
 * Register a callback that fires when the user clicks the "+ Feedback"
 * button on the selection overlay inside the iframe.
 */
export function onFeedbackRequest(cb: (() => void) | null): void {
  _feedbackCallback = cb;
}

/**
 * Register a callback for the "Fork" button on the selection overlay.
 * When clicked, it passes the selected element's ZeroCanvas ID.
 */
export function onForkElementRequest(cb: ((elementId: string) => void) | null): void {
  _forkElementCallback = cb;
}

function ensureOverlay(type: "hover" | "select"): HTMLDivElement {
  const isHover = type === "hover";
  let overlay = isHover ? highlightOverlay : selectOverlay;

  if (overlay) {
    try {
      if (overlay.ownerDocument !== targetDoc) {
        if (overlay.parentNode) overlay.remove();
        overlay = null;
        if (isHover) highlightOverlay = null;
        else selectOverlay = null;
      }
    } catch {
      overlay = null;
      if (isHover) highlightOverlay = null;
      else selectOverlay = null;
    }
  }

  if (!overlay) {
    overlay = targetDoc.createElement("div");
    overlay.setAttribute(OC_ATTR, "overlay");

    if (isHover) {
      overlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483646;
        border: 1.5px dashed rgba(0, 112, 243, 0.6);
        background: rgba(0, 112, 243, 0.04);
        border-radius: 2px;
        display: none;
      `;
    } else {
      overlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483646;
        border: 2px solid rgba(0, 112, 243, 0.9);
        background: rgba(0, 112, 243, 0.06);
        border-radius: 2px;
        display: none;
      `;

      const tagLabel = targetDoc.createElement("div");
      tagLabel.setAttribute("data-oc-role", "tag-label");
      tagLabel.style.cssText = `
        position: absolute;
        top: -24px;
        left: -2px;
        padding: 2px 8px;
        border-radius: 4px 4px 0 0;
        background: var(--color--base--primary);
        color: #fff;
        font-size: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 500;
        white-space: nowrap;
        line-height: 16px;
        pointer-events: none;
      `;
      overlay.appendChild(tagLabel);

      const sizeLabel = targetDoc.createElement("div");
      sizeLabel.setAttribute("data-oc-role", "size-label");
      sizeLabel.style.cssText = `
        position: absolute;
        bottom: -20px;
        left: -2px;
        padding: 1px 6px;
        border-radius: 3px;
        background: var(--color--base--primary);
        color: rgba(255,255,255,0.85);
        font-size: 9px;
        font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        white-space: nowrap;
        line-height: 14px;
        pointer-events: none;
      `;
      overlay.appendChild(sizeLabel);

      // Button bar container (holds Fork + Feedback)
      const btnBar = targetDoc.createElement("div");
      btnBar.setAttribute("data-oc-role", "btn-bar");
      btnBar.setAttribute(OC_ATTR, "btn-bar");
      btnBar.style.cssText = `
        position: absolute;
        bottom: -32px;
        right: -2px;
        display: flex;
        align-items: center;
        gap: 4px;
        pointer-events: auto;
      `;

      const overlayBtnStyle = `
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 6px;
        border: none;
        color: #fff;
        font-size: 11px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        cursor: pointer;
        pointer-events: auto;
        white-space: nowrap;
        transition: all 0.15s ease;
        line-height: 16px;
      `;

      // Fork button
      const forkBtn = targetDoc.createElement("button");
      forkBtn.setAttribute("data-oc-role", "fork-btn");
      forkBtn.setAttribute(OC_ATTR, "fork-btn");
      forkBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/></svg> Fork`;
      forkBtn.style.cssText = overlayBtnStyle + `
        background: var(--color--status--success);
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
      `;
      forkBtn.addEventListener("mouseenter", () => {
        forkBtn.style.background = "var(--green-600)";
        forkBtn.style.transform = "scale(1.03)";
      });
      forkBtn.addEventListener("mouseleave", () => {
        forkBtn.style.background = "var(--color--status--success)";
        forkBtn.style.transform = "scale(1)";
      });
      forkBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (_selectedEl && _forkElementCallback) {
          const elId = elementMap.get(_selectedEl);
          if (elId) _forkElementCallback(elId);
        }
      });
      btnBar.appendChild(forkBtn);

      // Feedback button
      const feedbackBtn = targetDoc.createElement("button");
      feedbackBtn.setAttribute("data-oc-role", "feedback-btn");
      feedbackBtn.setAttribute(OC_ATTR, "feedback-btn");
      feedbackBtn.textContent = "+ Feedback";
      feedbackBtn.style.cssText = overlayBtnStyle + `
        background: var(--color--base--primary);
        box-shadow: 0 2px 8px rgba(0, 112, 243, 0.4);
      `;
      feedbackBtn.addEventListener("mouseenter", () => {
        feedbackBtn.style.background = "var(--color--base--primary-hover)";
        feedbackBtn.style.transform = "scale(1.03)";
      });
      feedbackBtn.addEventListener("mouseleave", () => {
        feedbackBtn.style.background = "var(--color--base--primary)";
        feedbackBtn.style.transform = "scale(1)";
      });
      feedbackBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        _feedbackCallback?.();
      });
      btnBar.appendChild(feedbackBtn);

      overlay.appendChild(btnBar);
    }

    targetDoc.body?.appendChild(overlay);
    if (isHover) highlightOverlay = overlay;
    else selectOverlay = overlay;
  }

  return overlay;
}

/**
 * Show a highlight overlay on a DOM element.
 * Overlays are rendered inside the target document so they move
 * with the iframe when the ReactFlow canvas pans/zooms.
 */
export function highlightElement(
  elementId: string | null,
  type: "hover" | "select" = "hover"
): void {
  const overlay = ensureOverlay(type);

  if (!elementId) {
    overlay.style.display = "none";
    if (type === "select") {
      _selectedEl = null;
      if (_scrollHandler) {
        try { targetDoc.removeEventListener("scroll", _scrollHandler, true); } catch { /* noop */ }
        _scrollHandler = null;
      }
      if (_rafId) {
        cancelAnimationFrame(_rafId);
        _rafId = null;
      }
    }
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

  if (type === "select") {
    _selectedEl = el;

    const tagLabel = overlay.querySelector("[data-oc-role='tag-label']") as HTMLElement;
    if (tagLabel) {
      const tag = el.tagName.toLowerCase();
      const cls = Array.from(el.classList).slice(0, 2).map(c => `.${c}`).join("");
      tagLabel.textContent = `${tag}${cls}`;
    }

    const sizeLabel = overlay.querySelector("[data-oc-role='size-label']") as HTMLElement;
    if (sizeLabel) {
      sizeLabel.textContent = `${Math.round(rect.width)} \u00d7 ${Math.round(rect.height)}`;
    }

    if (_scrollHandler) {
      try { targetDoc.removeEventListener("scroll", _scrollHandler, true); } catch { /* noop */ }
    }
    if (_rafId) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
    _scrollHandler = () => {
      if (_rafId) return;
      _rafId = requestAnimationFrame(() => {
        _rafId = null;
        if (!_selectedEl || !selectOverlay) return;
        const r = _selectedEl.getBoundingClientRect();
        selectOverlay.style.top = `${r.top}px`;
        selectOverlay.style.left = `${r.left}px`;
        selectOverlay.style.width = `${r.width}px`;
        selectOverlay.style.height = `${r.height}px`;
        const sl = selectOverlay.querySelector("[data-oc-role='size-label']") as HTMLElement;
        if (sl) sl.textContent = `${Math.round(r.width)} \u00d7 ${Math.round(r.height)}`;
      });
    };
    targetDoc.addEventListener("scroll", _scrollHandler, true);

    // Also observe window resize in target doc to keep overlay in sync
    const targetWin = targetDoc.defaultView;
    if (targetWin) {
      const resizeHandler = () => {
        if (!_selectedEl || !selectOverlay) return;
        const r = _selectedEl.getBoundingClientRect();
        selectOverlay.style.top = `${r.top}px`;
        selectOverlay.style.left = `${r.left}px`;
        selectOverlay.style.width = `${r.width}px`;
        selectOverlay.style.height = `${r.height}px`;
      };
      targetWin.addEventListener("resize", resizeHandler);
    }
  }
}

/**
 * Remove all ZeroCanvas overlays from the page.
 */
export function cleanup(): void {
  if (highlightOverlay?.parentNode) highlightOverlay.remove();
  if (selectOverlay?.parentNode) selectOverlay.remove();
  highlightOverlay = null;
  selectOverlay = null;
  _selectedEl = null;
  if (_scrollHandler) {
    try { targetDoc.removeEventListener("scroll", _scrollHandler, true); } catch { /* noop */ }
    _scrollHandler = null;
  }
  if (_rafId) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
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
    if (target.hasAttribute(OC_ATTR) || target.closest(`[${OC_ATTR}]`)) return;

    // Find the element ID
    const id = elementMap.get(target);
    if (id) highlightElement(id, "hover");
  };

  inspectHandler = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.hasAttribute(OC_ATTR) || target.closest(`[${OC_ATTR}]`)) return;

    e.preventDefault();
    e.stopPropagation();

    const id = elementMap.get(target);
    if (id) {
      highlightElement(null, "hover");
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
    if (el.hasAttribute(OC_ATTR) || el.closest(`[${OC_ATTR}]`)) return;
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
  doc.querySelectorAll(`[${OC_ATTR}]`).forEach((el) => el.remove());

  return doc.body.innerHTML;
}

function collectCssRules(doc: Document): string {
  const cssRules: string[] = [];

  // 1. Traditional <style> and <link> stylesheets via CSSOM
  for (const sheet of doc.styleSheets) {
    try {
      for (const rule of sheet.cssRules) cssRules.push(rule.cssText);
    } catch {
      // Cross-origin stylesheet — skip (handled by collectExternalStylesheetLinks)
    }
  }

  // 2. Adopted stylesheets (used by Vite HMR, web components, etc.)
  if (doc.adoptedStyleSheets && doc.adoptedStyleSheets.length > 0) {
    for (const sheet of doc.adoptedStyleSheets) {
      try {
        for (const rule of sheet.cssRules) cssRules.push(rule.cssText);
      } catch { /* skip */ }
    }
  }

  // 3. Fallback: if CSSOM yielded nothing, scrape <style> textContent directly.
  //    This handles edge cases where stylesheets are not yet parsed by the CSSOM
  //    (e.g., Vite dev HMR injecting styles after DOMContentLoaded).
  if (cssRules.length === 0) {
    doc.querySelectorAll("style").forEach((styleEl) => {
      const text = styleEl.textContent;
      if (text && !styleEl.hasAttribute("data-0canvas-variant-css")) {
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
 * Preserves original HTML structure and class names without baking computed
 * styles as inline overrides — CSS rules (including media queries) handle
 * responsiveness in the variant iframe.
 */
export function capturePageSnapshot(): Omit<VariantData, "id" | "name" | "parentId" | "status" | "createdAt"> | null {
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
  const linkTags = externalLinks.map((href) => `@import url("${href}");`).join("\n");
  const css = linkTags ? linkTags + "\n" + cssRules : cssRules;

  const contentHeight = body.scrollHeight || body.offsetHeight || 0;

  return { html, css, mockData, sourceType: "page", sourceContentHeight: contentHeight };
}

/**
 * Capture an HTML/CSS snapshot of a specific element by its ZeroCanvas ID.
 * Preserves original HTML structure without baking computed styles inline.
 */
export function captureComponentSnapshot(
  elementId: string
): Omit<VariantData, "id" | "name" | "parentId" | "status" | "createdAt"> | null {
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
  const linkTags = externalLinks.map((href) => `@import url("${href}");`).join("\n");
  const css = linkTags ? linkTags + "\n" + cssRules : cssRules;
  const selector = getSelector(el);

  const contentHeight = (el as HTMLElement).offsetHeight || (el as HTMLElement).scrollHeight || 0;

  return { html, css, mockData, sourceType: "component", sourceSelector: selector, sourceContentHeight: contentHeight };
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
    styleEl.setAttribute("data-0canvas-variant-css", "true");
    styleEl.textContent = newCss;
    targetDoc.head.appendChild(styleEl);
  }

  return true;
}

/**
 * Get the outerHTML of an element by its ZeroCanvas ID.
 * Useful for storing the original state before push-to-main.
 */
export function getElementOuterHTML(elementId: string): string | null {
  const el = getElementById(elementId);
  return el ? (el as HTMLElement).outerHTML : null;
}
