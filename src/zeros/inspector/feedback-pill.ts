// ──────────────────────────────────────────────────────────
// Feedback Pill — Floating card UI for feedback annotations
// ──────────────────────────────────────────────────────────

import { identifyElement } from "./component-detection";
import {
  OC_ATTR,
  OC_PRIMARY,
  OC_SUCCESS,
  OC_SURFACE_0,
  OC_SURFACE_1,
  OC_SURFACE_FLOOR,
  OC_TEXT_ON_SURFACE,
  OC_TEXT_MUTED,
  OC_BORDER_0,
  OC_BORDER_1,
  OC_FONT_SANS,
  OC_FONT_MONO,
} from "./constants";
import {
  elementMap,
  getElementById,
  generateAgentOutput,
} from "./dom-walker";
import { EventManager } from "./event-manager";
import {
  highlightElement,
  getSelectedEl,
  getLastClickPos,
} from "./overlay";
import { getTargetDoc } from "./target";

// ── EventManager for this module ───────────────────────────

const events = new EventManager();

// ── Mutable state ──────────────────────────────────────────

let inspectorPill: HTMLDivElement | null = null;
let _forkElementCallback: ((elementId: string) => void) | null = null;
let _changeCallback:
  | ((
      elementId: string,
      description: string,
      clickPos: { x: number; y: number }
    ) => void)
  | null = null;
let _deleteCallback: ((elementId: string) => void) | null = null;
let _feedbackLookup:
  | ((elementId: string) => { id: string; comment: string } | null)
  | null = null;
let _escHandler: ((e: KeyboardEvent) => void) | null = null;

// ── Callbacks registration ─────────────────────────────────

export function onForkElementRequest(
  cb: ((elementId: string) => void) | null
): void {
  _forkElementCallback = cb;
}

export function onChangeRequest(
  cb:
    | ((
        elementId: string,
        description: string,
        clickPos: { x: number; y: number }
      ) => void)
    | null
): void {
  _changeCallback = cb;
}

export function onDeleteFeedbackRequest(
  cb: ((elementId: string) => void) | null
): void {
  _deleteCallback = cb;
}

export function setFeedbackLookup(
  cb: ((elementId: string) => { id: string; comment: string } | null) | null
): void {
  _feedbackLookup = cb;
}

// ── Pill dismiss (needs forward reference from inspect-mode) ──

type DismissFn = () => void;
let _dismissSelection: DismissFn = () => {
  hideInspectorPill();
  highlightElement(null, "select");
};

export function setDismissSelection(fn: DismissFn): void {
  _dismissSelection = fn;
}

// ── Inspector pill ─────────────────────────────────────────

export function showInspectorPill(
  el: Element,
  clickX: number,
  clickY: number
): void {
  hideInspectorPill();

  const targetDoc = getTargetDoc();
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

  const viewW = win.innerWidth || 800;
  let vpX = clickX + 12;
  let vpY = clickY - 18;
  if (vpX + PILL_WIDTH > viewW - 16) vpX = clickX - PILL_WIDTH - 12;
  if (vpY < 8) vpY = 8;
  pill.style.left = `${vpX + win.scrollX}px`;
  pill.style.top = `${vpY + win.scrollY}px`;

  // ── Row 1: [icon] ComponentName [copy] [fork] ──
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

  // Copy button
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
  events.add(copyBtn, "mouseenter", () => {
    copyBtn.style.color = OC_TEXT_ON_SURFACE;
    copyBtn.style.background = OC_SURFACE_1;
  });
  events.add(copyBtn, "mouseleave", () => {
    copyBtn.style.color = OC_TEXT_MUTED;
    copyBtn.style.background = "transparent";
  });
  events.add(copyBtn, "click", (e) => {
    (e as MouseEvent).preventDefault();
    (e as MouseEvent).stopPropagation();
    const selectedEl = getSelectedEl();
    if (selectedEl) {
      const elId = elementMap.get(selectedEl);
      if (elId) {
        const output = generateAgentOutput(elId);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(output).catch(() => {});
        }
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

  // Fork button
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
  events.add(forkBtn, "mouseenter", () => {
    forkBtn.style.color = OC_TEXT_ON_SURFACE;
    forkBtn.style.background = OC_SURFACE_1;
  });
  events.add(forkBtn, "mouseleave", () => {
    forkBtn.style.color = OC_TEXT_MUTED;
    forkBtn.style.background = "transparent";
  });
  events.add(forkBtn, "click", (e) => {
    (e as MouseEvent).preventDefault();
    (e as MouseEvent).stopPropagation();
    const selectedEl = getSelectedEl();
    if (selectedEl && _forkElementCallback) {
      const elId = elementMap.get(selectedEl);
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
  textarea.setAttribute(
    "placeholder",
    "Describe the change or \u2318+L to add to chat"
  );
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
    textarea.style.overflowY =
      textarea.scrollHeight > 120 ? "auto" : "hidden";
  }
  events.add(textarea, "input", autoResize);

  events.add(textarea, "keydown", (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === "Enter" && !ke.shiftKey && textarea.value.trim()) {
      ke.preventDefault();
      ke.stopPropagation();
      const selectedEl = getSelectedEl();
      if (selectedEl && _changeCallback) {
        const elId = elementMap.get(selectedEl);
        if (elId)
          _changeCallback(elId, textarea.value.trim(), {
            ...getLastClickPos(),
          });
      }
      _dismissSelection();
      return;
    }
    if (ke.key === "Escape") {
      ke.preventDefault();
      ke.stopPropagation();
      _dismissSelection();
    }
  });
  events.add(textarea, "focus", () => {
    textarea.style.borderColor = OC_PRIMARY;
  });
  events.add(textarea, "blur", () => {
    textarea.style.borderColor = OC_BORDER_1;
  });
  events.add(textarea, "click", (e) => {
    (e as MouseEvent).stopPropagation();
  });
  events.add(textarea, "mousedown", (e) => {
    (e as MouseEvent).stopPropagation();
  });
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
  const selectedEl = getSelectedEl();
  const currentElId = selectedEl ? elementMap.get(selectedEl) : null;
  const existingFeedback =
    currentElId && _feedbackLookup ? _feedbackLookup(currentElId) : null;

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
    events.add(deleteBtn, "mouseenter", () => {
      deleteBtn.style.background = "rgba(239,68,68,0.15)";
      deleteBtn.style.color = "#EF4444";
    });
    events.add(deleteBtn, "mouseleave", () => {
      deleteBtn.style.background = "transparent";
      deleteBtn.style.color = OC_TEXT_MUTED;
    });
    events.add(deleteBtn, "click", (e) => {
      (e as MouseEvent).preventDefault();
      (e as MouseEvent).stopPropagation();
      if (currentElId && _deleteCallback) _deleteCallback(currentElId);
      _dismissSelection();
    });
    actionRow.appendChild(deleteBtn);
  }

  const spacerRow = targetDoc.createElement("div");
  spacerRow.style.cssText = "flex:1;";
  actionRow.appendChild(spacerRow);

  const cancelBtn = targetDoc.createElement("button");
  cancelBtn.setAttribute(OC_ATTR, "cancel-btn");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.cssText =
    btnBase +
    `
    background: ${OC_SURFACE_1}; color: ${OC_TEXT_MUTED};
  `;
  events.add(cancelBtn, "mouseenter", () => {
    cancelBtn.style.background = OC_BORDER_1;
  });
  events.add(cancelBtn, "mouseleave", () => {
    cancelBtn.style.background = OC_SURFACE_1;
  });
  events.add(cancelBtn, "click", (e) => {
    (e as MouseEvent).preventDefault();
    (e as MouseEvent).stopPropagation();
    _dismissSelection();
  });
  actionRow.appendChild(cancelBtn);

  const sendBtn = targetDoc.createElement("button");
  sendBtn.setAttribute(OC_ATTR, "send-btn");
  sendBtn.textContent = "Add";
  sendBtn.style.cssText =
    btnBase +
    `
    background: ${OC_TEXT_ON_SURFACE}; color: ${OC_SURFACE_FLOOR};
  `;
  events.add(sendBtn, "mouseenter", () => {
    sendBtn.style.background = "#fff";
  });
  events.add(sendBtn, "mouseleave", () => {
    sendBtn.style.background = OC_TEXT_ON_SURFACE;
  });
  events.add(sendBtn, "click", (e) => {
    (e as MouseEvent).preventDefault();
    (e as MouseEvent).stopPropagation();
    const sel = getSelectedEl();
    if (textarea.value.trim() && sel && _changeCallback) {
      const elId = elementMap.get(sel);
      if (elId)
        _changeCallback(elId, textarea.value.trim(), {
          ...getLastClickPos(),
        });
    }
    _dismissSelection();
  });
  actionRow.appendChild(sendBtn);
  pill.appendChild(actionRow);

  // If editing existing feedback, pre-fill textarea
  if (existingFeedback) {
    textarea.value = existingFeedback.comment;
    autoResize();
  }

  // Prevent pill interactions from bubbling
  events.add(pill, "mousedown", (e) => {
    (e as MouseEvent).stopPropagation();
  });
  events.add(pill, "click", (e) => {
    (e as MouseEvent).stopPropagation();
  });

  targetDoc.body?.appendChild(pill);
  inspectorPill = pill;

  // Document-level Esc listener
  if (_escHandler) {
    try {
      targetDoc.removeEventListener("keydown", _escHandler, true);
    } catch {
      /* noop */
    }
  }
  _escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      _dismissSelection();
    }
  };
  events.add(targetDoc, "keydown", _escHandler, true);

  requestAnimationFrame(() => textarea.focus());
}

export function hideInspectorPill(): void {
  const targetDoc = getTargetDoc();
  if (inspectorPill?.parentNode) {
    inspectorPill.remove();
  }
  inspectorPill = null;
  if (_escHandler) {
    try {
      targetDoc.removeEventListener("keydown", _escHandler, true);
    } catch {
      /* noop */
    }
    _escHandler = null;
  }
}

export function getInspectorPill(): HTMLDivElement | null {
  return inspectorPill;
}

// ── Feedback markers (numbered pins) ───────────────────────

type FeedbackMarkerData = {
  id: string;
  number: number;
  elementId: string;
  comment: string;
  boundingBox: { x: number; y: number; width: number; height: number };
};

const feedbackMarkers: Map<string, HTMLDivElement> = new Map();
let _editCallback: ((feedbackId: string) => void) | null = null;

export function onEditFeedbackRequest(
  cb: ((feedbackId: string) => void) | null
): void {
  _editCallback = cb;
}

export function renderFeedbackMarkers(items: FeedbackMarkerData[]): void {
  const targetDoc = getTargetDoc();

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
        e.preventDefault();
        e.stopPropagation();
        const el = getElementById(item.elementId);
        if (el) {
          const rect = el.getBoundingClientRect();
          highlightElement(
            item.elementId,
            "select",
            rect.x + rect.width / 2,
            rect.y + rect.height / 2
          );
          setTimeout(() => {
            const pill = targetDoc.querySelector(
              `[${OC_ATTR}="inspector-pill"]`
            );
            if (pill) {
              const textarea = pill.querySelector(
                "textarea"
              ) as HTMLTextAreaElement;
              if (textarea) {
                textarea.value = item.comment;
                textarea.focus();
              }
            }
          }, 50);
        }
        if (_editCallback) _editCallback(item.id);
      });

      targetDoc.body?.appendChild(marker);
      feedbackMarkers.set(item.id, marker);
    }

    const win = targetDoc.defaultView || window;
    marker.style.left = `${item.boundingBox.x + win.scrollX - 11}px`;
    marker.style.top = `${item.boundingBox.y + win.scrollY - 11}px`;
    marker.textContent = String(item.number);
  }
}

export function clearFeedbackMarkers(): void {
  for (const [, el] of feedbackMarkers) el.remove();
  feedbackMarkers.clear();
}

/** Cleanup: remove pill, markers, and all tracked event listeners */
export function cleanupFeedbackPill(): void {
  hideInspectorPill();
  clearFeedbackMarkers();
  events.cleanup();
}
