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
import { identifyElement } from "./component-detection";

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
    hideInspectorPill();
    highlightOverlay = null;
    selectOverlay = null;
    _selectedEl = null;
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
    hideInspectorPill();
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
    styles: depth < 8 ? getComputedStyles(el) : {},
    selector: getSelector(el),
    visible: true,
    locked: false,
    componentName: (() => { const info = identifyElement(el); return info.source !== "tag" ? info.displayName : undefined; })(),
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
//
// Design: overlays use hardcoded 0canvas design token colors
// (not CSS variables) because they live inside the iframe which
// does NOT have [data-0canvas-root] scope.

// 0canvas design tokens (hardcoded for iframe context)
const OC_SURFACE_0 = "#171717";
const OC_SURFACE_1 = "#262626";
const OC_SURFACE_FLOOR = "#0a0a0a";
const OC_TEXT_ON_SURFACE = "#E5E5E5";
const OC_TEXT_MUTED = "#737373";
const OC_BORDER_0 = "#262626";
const OC_BORDER_1 = "#404040";
const OC_PRIMARY = "#2563EB";
const OC_SUCCESS = "#10B981";
const OC_FONT_SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const OC_FONT_MONO = "'Fira Code', 'JetBrains Mono', 'Geist Mono', monospace";

let highlightOverlay: HTMLDivElement | null = null;
let selectOverlay: HTMLDivElement | null = null;
let inspectorPill: HTMLDivElement | null = null;
let _selectedEl: Element | null = null;
let _forkElementCallback: ((elementId: string) => void) | null = null;
let _changeCallback: ((elementId: string, description: string, clickPos: { x: number; y: number }) => void) | null = null;
let _deleteCallback: ((elementId: string) => void) | null = null;
let _feedbackLookup: ((elementId: string) => { id: string; comment: string } | null) | null = null;
let _lastClickPos: { x: number; y: number } = { x: 0, y: 0 };
let _escHandler: ((e: KeyboardEvent) => void) | null = null;

/**
 * Register a callback for the "Fork" button on the inspector pill.
 * When clicked, it passes the selected element's ZeroCanvas ID.
 */
export function onForkElementRequest(cb: ((elementId: string) => void) | null): void {
  _forkElementCallback = cb;
}

/**
 * Register a callback for when the user submits a change description.
 * Fires with the element ID and the text the user typed.
 */
export function onChangeRequest(cb: ((elementId: string, description: string, clickPos: { x: number; y: number }) => void) | null): void {
  _changeCallback = cb;
}

export function onDeleteFeedbackRequest(cb: ((elementId: string) => void) | null): void {
  _deleteCallback = cb;
}

/** Register a lookup so the pill can check if an element already has feedback */
export function setFeedbackLookup(cb: ((elementId: string) => { id: string; comment: string } | null) | null): void {
  _feedbackLookup = cb;
}

/** Get document-absolute coordinates from a viewport rect */
function toAbsolute(rect: DOMRect, doc: Document): { top: number; left: number } {
  const win = doc.defaultView || window;
  return {
    top: rect.top + win.scrollY,
    left: rect.left + win.scrollX,
  };
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

    // position: absolute — anchored to the document, scrolls with the page
    if (isHover) {
      overlay.style.cssText = `
        position: absolute;
        pointer-events: none;
        z-index: 2147483646;
        border: 1.5px dashed ${OC_PRIMARY}99;
        background: ${OC_PRIMARY}0A;
        border-radius: 2px;
        display: none;
        box-sizing: border-box;
      `;

      const hoverLabel = targetDoc.createElement("div");
      hoverLabel.setAttribute("data-oc-role", "hover-label");
      hoverLabel.style.cssText = `
        position: absolute;
        top: -26px;
        left: -1.5px;
        padding: 2px 8px;
        border-radius: 4px 4px 0 0;
        background: ${OC_PRIMARY};
        color: #fff;
        font-size: 10px;
        font-family: ${OC_FONT_SANS};
        font-weight: 500;
        white-space: nowrap;
        line-height: 18px;
        pointer-events: none;
        box-sizing: border-box;
      `;
      overlay.appendChild(hoverLabel);
    } else {
      overlay.style.cssText = `
        position: absolute;
        pointer-events: none;
        z-index: 2147483646;
        border: 2px solid ${OC_PRIMARY};
        background: ${OC_PRIMARY}0F;
        border-radius: 2px;
        display: none;
        box-sizing: border-box;
      `;

      const tagLabel = targetDoc.createElement("div");
      tagLabel.setAttribute("data-oc-role", "tag-label");
      tagLabel.style.cssText = `
        position: absolute;
        top: -26px;
        left: -2px;
        padding: 2px 10px;
        border-radius: 4px 4px 0 0;
        background: ${OC_PRIMARY};
        color: #fff;
        font-size: 11px;
        font-family: ${OC_FONT_SANS};
        font-weight: 500;
        white-space: nowrap;
        line-height: 18px;
        pointer-events: none;
        box-sizing: border-box;
      `;
      overlay.appendChild(tagLabel);

      const sizeLabel = targetDoc.createElement("div");
      sizeLabel.setAttribute("data-oc-role", "size-label");
      sizeLabel.style.cssText = `
        position: absolute;
        bottom: -20px;
        left: -2px;
        padding: 1px 6px;
        border-radius: 0 0 4px 4px;
        background: ${OC_SURFACE_FLOOR};
        color: ${OC_TEXT_MUTED};
        font-size: 9px;
        font-family: ${OC_FONT_MONO};
        white-space: nowrap;
        line-height: 14px;
        pointer-events: none;
        border: 1px solid ${OC_BORDER_0};
        border-top: none;
        box-sizing: border-box;
      `;
      overlay.appendChild(sizeLabel);
    }

    targetDoc.body?.appendChild(overlay);
    if (isHover) highlightOverlay = overlay;
    else selectOverlay = overlay;
  }

  return overlay;
}

/**
 * Create the inspector pill — a floating card at the click position.
 * Uses position:absolute so it stays at its document position and
 * scrolls away naturally with the page (like Agentation).
 *
 * Layout (3 rows):
 *   ┌──────────────────────────────┐
 *   │ [icon] ComponentName    [fork]│  ← row 1: label + fork
 *   ├──────────────────────────────┤
 *   │ Describe the change...       │  ← row 2: textarea
 *   ├──────────────────────────────┤
 *   │ [Cancel]               [Add] │  ← row 3: actions
 *   └──────────────────────────────┘
 */
function showInspectorPill(el: Element, clickX: number, clickY: number): void {
  hideInspectorPill();

  const info = identifyElement(el);
  const displayLabel = info.displayName;
  const win = targetDoc.defaultView || window;
  const PILL_WIDTH = 320;

  const pill = targetDoc.createElement("div");
  pill.setAttribute(OC_ATTR, "inspector-pill");
  pill.setAttribute("data-oc-role", "inspector-pill");
  pill.style.cssText = `
    position: absolute;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    width: ${PILL_WIDTH}px;
    background: ${OC_SURFACE_FLOOR};
    border: 1px solid ${OC_BORDER_1};
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
    pointer-events: auto;
    overflow: hidden;
    box-sizing: border-box;
  `;

  // Convert viewport click position to absolute document position
  const viewW = win.innerWidth || 800;
  let vpX = clickX + 12;
  let vpY = clickY - 18;
  if (vpX + PILL_WIDTH > viewW - 16) vpX = clickX - PILL_WIDTH - 12;
  if (vpY < 8) vpY = 8;
  pill.style.left = `${vpX + win.scrollX}px`;
  pill.style.top = `${vpY + win.scrollY}px`;

  // ── Row 1: [icon] ComponentName [fork] ──
  const header = targetDoc.createElement("div");
  header.style.cssText = `
    display: flex; align-items: center;
    padding: 8px 6px 6px 10px; gap: 6px; box-sizing: border-box;
  `;

  const nameBadge = targetDoc.createElement("span");
  nameBadge.style.cssText = `
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; background: ${OC_PRIMARY}; color: #fff;
    font-size: 12px; font-family: ${OC_FONT_SANS}; font-weight: 500;
    border-radius: 6px; white-space: nowrap; max-width: 200px;
    overflow: hidden; text-overflow: ellipsis; line-height: 18px;
    box-sizing: border-box;
  `;
  nameBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
  nameBadge.appendChild(targetDoc.createTextNode(` ${displayLabel}`));
  header.appendChild(nameBadge);

  const spacer = targetDoc.createElement("div");
  spacer.style.cssText = "flex:1;";
  header.appendChild(spacer);

  // Copy button — copies element info for AI agent
  const copyBtn = targetDoc.createElement("button");
  copyBtn.setAttribute(OC_ATTR, "copy-btn");
  copyBtn.setAttribute("title", "Copy for agent");
  copyBtn.style.cssText = `
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; padding: 0; background: transparent;
    border: none; cursor: pointer; color: ${OC_TEXT_MUTED}; flex-shrink: 0;
    transition: color 0.15s ease, background 0.15s ease;
    border-radius: 6px; box-sizing: border-box;
  `;
  copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  copyBtn.addEventListener("mouseenter", () => { copyBtn.style.color = OC_TEXT_ON_SURFACE; copyBtn.style.background = OC_SURFACE_1; });
  copyBtn.addEventListener("mouseleave", () => { copyBtn.style.color = OC_TEXT_MUTED; copyBtn.style.background = "transparent"; });
  copyBtn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (_selectedEl) {
      const elId = elementMap.get(_selectedEl);
      if (elId) {
        const output = generateAgentOutput(elId);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(output).catch(() => {});
        }
        // Brief visual feedback
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        copyBtn.style.color = OC_SUCCESS;
        setTimeout(() => {
          copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
          copyBtn.style.color = OC_TEXT_MUTED;
        }, 1500);
      }
    }
  });
  header.appendChild(copyBtn);

  const forkBtn = targetDoc.createElement("button");
  forkBtn.setAttribute(OC_ATTR, "fork-btn");
  forkBtn.setAttribute("title", "Fork this element");
  forkBtn.style.cssText = `
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; padding: 0; background: transparent;
    border: none; cursor: pointer; color: ${OC_TEXT_MUTED}; flex-shrink: 0;
    transition: color 0.15s ease, background 0.15s ease;
    border-radius: 6px; box-sizing: border-box;
  `;
  forkBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/></svg>`;
  forkBtn.addEventListener("mouseenter", () => { forkBtn.style.color = OC_TEXT_ON_SURFACE; forkBtn.style.background = OC_SURFACE_1; });
  forkBtn.addEventListener("mouseleave", () => { forkBtn.style.color = OC_TEXT_MUTED; forkBtn.style.background = "transparent"; });
  forkBtn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (_selectedEl && _forkElementCallback) {
      const elId = elementMap.get(_selectedEl);
      if (elId) _forkElementCallback(elId);
    }
  });
  header.appendChild(forkBtn);
  pill.appendChild(header);

  // ── Row 2: Textarea ──
  const textareaWrap = targetDoc.createElement("div");
  textareaWrap.style.cssText = `
    padding: 0 10px 6px 10px; box-sizing: border-box;
  `;

  const textarea = targetDoc.createElement("textarea");
  textarea.setAttribute("placeholder", "Describe the change or \u2318+L to add to chat");
  textarea.setAttribute("rows", "1");
  textarea.setAttribute(OC_ATTR, "inspector-input");
  textarea.style.cssText = `
    width: 100%; min-height: 32px; max-height: 120px;
    padding: 6px 10px; background: ${OC_SURFACE_1};
    border: 1px solid ${OC_BORDER_1}; border-radius: 8px;
    outline: none; color: ${OC_TEXT_ON_SURFACE};
    font-size: 12px; font-family: ${OC_FONT_SANS}; font-weight: 400;
    line-height: 1.4; resize: none; overflow-y: hidden;
    box-sizing: border-box;
  `;

  function autoResize() {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    textarea.style.overflowY = textarea.scrollHeight > 120 ? "auto" : "hidden";
  }
  textarea.addEventListener("input", autoResize);

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && textarea.value.trim()) {
      e.preventDefault(); e.stopPropagation();
      if (_selectedEl && _changeCallback) {
        const elId = elementMap.get(_selectedEl);
        if (elId) _changeCallback(elId, textarea.value.trim(), { ..._lastClickPos });
      }
      dismissSelection();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      dismissSelection();
    }
  });
  textarea.addEventListener("focus", () => { textarea.style.borderColor = OC_PRIMARY; });
  textarea.addEventListener("blur", () => { textarea.style.borderColor = OC_BORDER_1; });
  textarea.addEventListener("click", (e) => { e.stopPropagation(); });
  textarea.addEventListener("mousedown", (e) => { e.stopPropagation(); });
  textareaWrap.appendChild(textarea);
  pill.appendChild(textareaWrap);

  // ── Row 3: [Delete] ... [Cancel] [Add] ──
  const actionRow = targetDoc.createElement("div");
  actionRow.style.cssText = `
    display: flex; align-items: center;
    padding: 0 10px 8px 10px; gap: 8px; box-sizing: border-box;
  `;

  const btnBase = `
    padding: 5px 14px; border-radius: 6px; border: none; cursor: pointer;
    font-size: 12px; font-family: ${OC_FONT_SANS}; font-weight: 500;
    line-height: 16px; transition: background 0.15s ease; box-sizing: border-box;
  `;

  // Check if this element already has feedback (edit mode)
  const currentElId = _selectedEl ? elementMap.get(_selectedEl) : null;
  const existingFeedback = currentElId && _feedbackLookup ? _feedbackLookup(currentElId) : null;

  // Delete button (only in edit mode)
  if (existingFeedback) {
    const deleteBtn = targetDoc.createElement("button");
    deleteBtn.setAttribute(OC_ATTR, "delete-btn");
    deleteBtn.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; padding: 0; border-radius: 6px;
      border: none; cursor: pointer; background: transparent;
      color: ${OC_TEXT_MUTED}; transition: all 0.15s ease; box-sizing: border-box;
    `;
    deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    deleteBtn.title = "Delete feedback";
    deleteBtn.addEventListener("mouseenter", () => { deleteBtn.style.background = "rgba(239,68,68,0.15)"; deleteBtn.style.color = "#EF4444"; });
    deleteBtn.addEventListener("mouseleave", () => { deleteBtn.style.background = "transparent"; deleteBtn.style.color = OC_TEXT_MUTED; });
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (currentElId && _deleteCallback) _deleteCallback(currentElId);
      dismissSelection();
    });
    actionRow.appendChild(deleteBtn);
  }

  // Spacer
  const spacerRow = targetDoc.createElement("div");
  spacerRow.style.cssText = "flex:1;";
  actionRow.appendChild(spacerRow);

  const cancelBtn = targetDoc.createElement("button");
  cancelBtn.setAttribute(OC_ATTR, "cancel-btn");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.cssText = btnBase + `
    background: ${OC_SURFACE_1}; color: ${OC_TEXT_MUTED};
  `;
  cancelBtn.addEventListener("mouseenter", () => { cancelBtn.style.background = OC_BORDER_1; });
  cancelBtn.addEventListener("mouseleave", () => { cancelBtn.style.background = OC_SURFACE_1; });
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    dismissSelection();
  });
  actionRow.appendChild(cancelBtn);

  const sendBtn = targetDoc.createElement("button");
  sendBtn.setAttribute(OC_ATTR, "send-btn");
  sendBtn.textContent = "Add";
  sendBtn.style.cssText = btnBase + `
    background: ${OC_TEXT_ON_SURFACE}; color: ${OC_SURFACE_FLOOR};
  `;
  sendBtn.addEventListener("mouseenter", () => { sendBtn.style.background = "#fff"; });
  sendBtn.addEventListener("mouseleave", () => { sendBtn.style.background = OC_TEXT_ON_SURFACE; });
  sendBtn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (textarea.value.trim() && _selectedEl && _changeCallback) {
      const elId = elementMap.get(_selectedEl);
      if (elId) _changeCallback(elId, textarea.value.trim(), { ..._lastClickPos });
    }
    dismissSelection();
  });
  actionRow.appendChild(sendBtn);
  pill.appendChild(actionRow);

  // If editing existing feedback, pre-fill textarea
  if (existingFeedback) {
    textarea.value = existingFeedback.comment;
    autoResize();
  }

  // Prevent pill interactions from bubbling
  pill.addEventListener("mousedown", (e) => { e.stopPropagation(); });
  pill.addEventListener("click", (e) => { e.stopPropagation(); });

  targetDoc.body?.appendChild(pill);
  inspectorPill = pill;

  // Pause inspection — remove hover/click handlers while pill is open
  pauseInspection();

  // Document-level Esc listener
  if (_escHandler) {
    try { targetDoc.removeEventListener("keydown", _escHandler, true); } catch { /* noop */ }
  }
  _escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      dismissSelection();
    }
  };
  targetDoc.addEventListener("keydown", _escHandler, true);

  requestAnimationFrame(() => textarea.focus());
}

function hideInspectorPill(): void {
  if (inspectorPill?.parentNode) {
    inspectorPill.remove();
  }
  inspectorPill = null;
  // Remove document-level Esc listener
  if (_escHandler) {
    try { targetDoc.removeEventListener("keydown", _escHandler, true); } catch { /* noop */ }
    _escHandler = null;
  }
}

/**
 * Temporarily remove hover/click handlers so the user can interact
 * with the pill without triggering new inspections. The handlers
 * are restored when the selection is dismissed.
 */
function pauseInspection(): void {
  if (inspectHoverHandler) {
    targetDoc.removeEventListener("mousemove", inspectHoverHandler, true);
  }
  if (inspectHandler) {
    targetDoc.removeEventListener("click", inspectHandler, true);
  }
  highlightElement(null, "hover");
  if (targetDoc.body) {
    targetDoc.body.style.cursor = "";
  }
}

/**
 * Re-attach hover/click handlers after the pill is dismissed.
 */
function resumeInspection(): void {
  if (!inspectActive) return;
  if (inspectHoverHandler) {
    targetDoc.addEventListener("mousemove", inspectHoverHandler, true);
  }
  if (inspectHandler) {
    targetDoc.addEventListener("click", inspectHandler, true);
  }
  if (targetDoc.body) {
    targetDoc.body.style.cursor = "crosshair";
  }
}

/**
 * Dismiss the current selection — hides pill + overlay then resumes
 * inspect mode. The user can immediately click another element.
 * Only toggling off inspect in the toolbar actually stops inspect mode.
 */
function dismissSelection(): void {
  hideInspectorPill();
  highlightElement(null, "select");
  resumeInspection();
}

/** Export so external callers (e.g. source-node) can dismiss selection */
export { dismissSelection };

/**
 * Show a highlight overlay on a DOM element.
 * Overlays are rendered inside the target document so they move
 * with the iframe when the ReactFlow canvas pans/zooms.
 *
 * For "select" type, also shows the inspector pill at the cursor
 * position (pass clickX/clickY for cursor positioning).
 */
export function highlightElement(
  elementId: string | null,
  type: "hover" | "select" = "hover",
  clickX?: number,
  clickY?: number
): void {
  const overlay = ensureOverlay(type);

  if (!elementId) {
    overlay.style.display = "none";
    if (type === "select") {
      _selectedEl = null;
      hideInspectorPill();
    }
    return;
  }

  const el = getElementById(elementId);
  if (!el) {
    overlay.style.display = "none";
    return;
  }

  // Use absolute document coordinates — overlay stays at its position
  // and scrolls away naturally with the page content.
  const rect = el.getBoundingClientRect();
  const abs = toAbsolute(rect, targetDoc);
  overlay.style.display = "block";
  overlay.style.top = `${abs.top}px`;
  overlay.style.left = `${abs.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  if (type === "hover") {
    const hoverLabel = overlay.querySelector("[data-oc-role='hover-label']") as HTMLElement;
    if (hoverLabel) {
      hoverLabel.textContent = identifyElement(el).displayName;
    }
  }

  if (type === "select") {
    _selectedEl = el;

    const tagLabel = overlay.querySelector("[data-oc-role='tag-label']") as HTMLElement;
    if (tagLabel) {
      tagLabel.textContent = identifyElement(el).displayName;
    }

    const sizeLabel = overlay.querySelector("[data-oc-role='size-label']") as HTMLElement;
    if (sizeLabel) {
      sizeLabel.textContent = `${Math.round(rect.width)} \u00d7 ${Math.round(rect.height)}`;
    }

    // Show the inspector pill at the cursor position
    const cx = clickX ?? _lastClickPos.x;
    const cy = clickY ?? _lastClickPos.y;
    showInspectorPill(el, cx, cy);

    // No scroll handler needed — position:absolute handles it naturally
  }
}

/**
 * Remove all ZeroCanvas overlays from the page.
 */
export function cleanup(): void {
  if (highlightOverlay?.parentNode) highlightOverlay.remove();
  if (selectOverlay?.parentNode) selectOverlay.remove();
  hideInspectorPill();
  highlightOverlay = null;
  selectOverlay = null;
  _selectedEl = null;
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

    // Dismiss any existing selection (pill + overlay) before selecting new
    hideInspectorPill();
    highlightElement(null, "select");

    // Store click position for the inspector pill
    _lastClickPos = { x: e.clientX, y: e.clientY };

    const id = elementMap.get(target);
    if (id) {
      highlightElement(null, "hover");
      highlightElement(id, "select", e.clientX, e.clientY);
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
 * Stop click-to-inspect mode. Dismisses all overlays and pills.
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
  dismissSelection();
  if (targetDoc.body) {
    targetDoc.body.style.cursor = "";
  }
  inspectActive = false;
}

export function isInspecting(): boolean {
  return inspectActive;
}

// ── Feedback markers (numbered pins on inspected page) ─────

type FeedbackMarkerData = {
  id: string;
  number: number;
  elementId: string;
  comment: string;
  boundingBox: { x: number; y: number; width: number; height: number };
};

const feedbackMarkers: Map<string, HTMLDivElement> = new Map();
let _editCallback: ((feedbackId: string) => void) | null = null;

export function onEditFeedbackRequest(cb: ((feedbackId: string) => void) | null): void {
  _editCallback = cb;
}

/** Render or update all feedback markers on the inspected page */
export function renderFeedbackMarkers(items: FeedbackMarkerData[]): void {
  // Remove stale markers
  for (const [id, el] of feedbackMarkers) {
    if (!items.find((i) => i.id === id)) {
      el.remove();
      feedbackMarkers.delete(id);
    }
  }

  for (const item of items) {
    let marker = feedbackMarkers.get(item.id);

    if (!marker) {
      marker = targetDoc.createElement("div");
      marker.setAttribute(OC_ATTR, "feedback-marker");
      marker.setAttribute("data-feedback-id", item.id);
      marker.style.cssText = `
        position: absolute; z-index: 2147483645;
        width: 22px; height: 22px; border-radius: 50%;
        background: ${OC_PRIMARY}; color: #fff;
        border: 2px solid #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; font-weight: 700; font-family: ${OC_FONT_SANS};
        cursor: pointer; pointer-events: auto;
        box-shadow: 0 2px 10px rgba(37,99,235,0.4);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        user-select: none;
      `;

      const pencilSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
      const numberText = String(item.number);

      // Hover: swap number for pencil icon
      marker.addEventListener("mouseenter", () => {
        if (marker) {
          marker.innerHTML = pencilSvg;
          marker.style.transform = "scale(1.15)";
          marker.style.boxShadow = "0 4px 16px rgba(0,0,0,0.4)";
          marker.title = item.comment;
        }
      });
      marker.addEventListener("mouseleave", () => {
        if (marker) {
          marker.textContent = numberText;
          marker.style.transform = "";
          marker.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
        }
      });

      // Click: open inspector pill at the element to edit feedback
      marker.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const el = getElementById(item.elementId);
        if (el) {
          const rect = el.getBoundingClientRect();
          highlightElement(item.elementId, "select", rect.x + rect.width / 2, rect.y + rect.height / 2);
          // Pre-fill the pill textarea with existing comment
          setTimeout(() => {
            const pill = targetDoc.querySelector(`[${OC_ATTR}="inspector-pill"]`);
            if (pill) {
              const textarea = pill.querySelector("textarea") as HTMLTextAreaElement;
              if (textarea) { textarea.value = item.comment; textarea.focus(); }
            }
          }, 50);
        }
        if (_editCallback) _editCallback(item.id);
      });

      targetDoc.body?.appendChild(marker);
      feedbackMarkers.set(item.id, marker);
    }

    // Position marker at the click position (center of where pill was)
    const win = targetDoc.defaultView || window;
    marker.style.left = `${item.boundingBox.x + win.scrollX - 11}px`;
    marker.style.top = `${item.boundingBox.y + win.scrollY - 11}px`;
    marker.textContent = String(item.number);
  }
}

/** Remove all feedback markers from the page */
export function clearFeedbackMarkers(): void {
  for (const [, el] of feedbackMarkers) el.remove();
  feedbackMarkers.clear();
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
