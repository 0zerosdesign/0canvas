// ──────────────────────────────────────────────────────────
// Theme Pill — Color-specific inspector popup for theme tokens
// ──────────────────────────────────────────────────────────

import { identifyElement } from "./component-detection";
import {
  OC_ATTR,
  OC_PRIMARY,
  OC_PRIMARY_DIM,
  OC_SURFACE_1,
  OC_SURFACE_FLOOR,
  OC_TEXT_ON_SURFACE,
  OC_TEXT_MUTED,
  OC_BORDER_0,
  OC_BORDER_1,
  OC_FONT_SANS,
  OC_FONT_MONO,
} from "./constants";
import { elementMap, getElementById } from "./dom-walker";
import { EventManager } from "./event-manager";
import {
  getSelectedEl,
  setSelectedEl,
  getLastClickPos,
} from "./overlay";
import { hideInspectorPill, getInspectorPill } from "./feedback-pill";
import { getTargetDoc } from "./target";
import {
  getColorProperties,
  ALL_COLOR_CSS_PROPERTIES,
  SHORTHAND_EXPANSION,
} from "../themes/theme-color-resolver";

// ── EventManager for this module ───────────────────────────

const events = new EventManager();

// ── Types ──────────────────────────────────────────────────

export type ThemeToken = { name: string; value: string };

export type ThemeChangeData = {
  elementId: string;
  elementSelector: string;
  elementTag: string;
  elementClasses: string[];
  property: string;
  originalValue: string;
  originalTokenChain: string[];
  originalSourceSelector: string;
  originalSourceType: "rule" | "inline" | "inherited";
  newToken: string;
  newValue: string;
  boundingBox: { x: number; y: number; width: number; height: number };
};

type StoredChange = {
  id: string;
  elementId: string;
  property: string;
  originalValue: string;
  originalTokenChain: string[];
  originalSourceSelector: string;
  originalSourceType: "rule" | "inline" | "inherited";
  newToken: string;
  newValue: string;
};

// ── Mutable state ──────────────────────────────────────────

let _themeTokensProvider: (() => ThemeToken[]) | null = null;
let _themeChangeCallback: ((change: ThemeChangeData) => void) | null = null;
let _themeChangesProvider: (() => StoredChange[]) | null = null;
let _themeResetCallback:
  | ((elementId: string, property: string) => void)
  | null = null;

const ALL_COLOR_CSS_PROPS = ALL_COLOR_CSS_PROPERTIES as readonly string[];

// ── Callback registration ──────────────────────────────────

export function setThemeTokensProvider(
  cb: (() => ThemeToken[]) | null
): void {
  _themeTokensProvider = cb;
}

export function onThemeChangeRequest(
  cb: ((change: ThemeChangeData) => void) | null
): void {
  _themeChangeCallback = cb;
}

export function setThemeChangesProvider(
  cb: (() => StoredChange[]) | null
): void {
  _themeChangesProvider = cb;
}

export function onThemeResetRequest(
  cb: ((elementId: string, property: string) => void) | null
): void {
  _themeResetCallback = cb;
}

// ── Dismiss helper ─────────────────────────────────────────

type DismissFn = () => void;
let _dismissSelection: DismissFn = () => {};

export function setThemeDismissSelection(fn: DismissFn): void {
  _dismissSelection = fn;
}

// ── Pause inspection callback ──────────────────────────────

type PauseFn = () => void;
let _pauseInspection: PauseFn = () => {};

export function setThemePauseInspection(fn: PauseFn): void {
  _pauseInspection = fn;
}

// ── Theme Inspector Pill ───────────────────────────────────

let _themePill: HTMLDivElement | null = null;
let _escHandler: ((e: KeyboardEvent) => void) | null = null;

export function showThemeInspectorPill(
  el: Element,
  clickX: number,
  clickY: number
): void {
  // Hide any existing pill (feedback or theme)
  hideThemePill();
  hideInspectorPill();

  const targetDoc = getTargetDoc();
  const info = identifyElement(el);
  const displayLabel = info.displayName;
  const win = targetDoc.defaultView || window;
  const PILL_WIDTH = 300;

  const colorProps = getColorProperties(el, targetDoc);
  const tokens = _themeTokensProvider ? _themeTokensProvider() : [];

  const elId = elementMap.get(el);
  const storedChanges = _themeChangesProvider ? _themeChangesProvider() : [];
  const changesForEl = elId
    ? storedChanges.filter((c) => c.elementId === elId)
    : [];

  for (const cp of colorProps) {
    const stored = changesForEl.find((c) => c.property === cp.property);
    if (stored) {
      cp.sourceSelector = stored.originalSourceSelector;
      cp.sourceType = stored.originalSourceType;
      cp.specifiedValue = stored.originalValue;
      cp.tokenChain = stored.originalTokenChain;
    }
  }

  const changedProps = new Set(changesForEl.map((c) => c.property));
  const existingPropNames = new Set(colorProps.map((cp) => cp.property));

  const pill = targetDoc.createElement("div");
  pill.setAttribute(OC_ATTR, "inspector-pill");
  pill.setAttribute("data-oc-role", "inspector-pill");
  pill.style.cssText = `
    position: absolute; z-index: 2147483647;
    display: flex; flex-direction: column;
    width: ${PILL_WIDTH}px;
    background: ${OC_SURFACE_FLOOR}; border: 1px solid ${OC_BORDER_1};
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
    pointer-events: auto; box-sizing: border-box;
    font-family: ${OC_FONT_SANS};
    overflow: visible;
  `;

  const viewW = win.innerWidth || 800;
  const viewH = win.innerHeight || 600;
  let vpX = clickX + 12;
  let vpY = clickY - 18;
  if (vpX + PILL_WIDTH > viewW - 16) vpX = clickX - PILL_WIDTH - 12;
  if (vpX < 8) vpX = 8;
  if (vpY < 8) vpY = 8;
  const estimatedHeight = 80 + colorProps.length * 80;
  if (vpY + estimatedHeight > viewH - 20)
    vpY = Math.max(8, clickY - estimatedHeight);
  pill.style.left = `${vpX + win.scrollX}px`;
  pill.style.top = `${vpY + win.scrollY}px`;

  // ── Header ──
  const header = targetDoc.createElement("div");
  header.style.cssText = `
    display: flex; align-items: center; padding: 8px 10px 6px; gap: 6px;
    box-sizing: border-box; border-bottom: 1px solid ${OC_BORDER_0};
  `;

  const nameBadge = targetDoc.createElement("span");
  nameBadge.style.cssText = `
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; background: ${OC_PRIMARY}; color: #fff;
    font-size: 11px; font-weight: 500; border-radius: 6px;
    white-space: nowrap; max-width: 160px; overflow: hidden;
    text-overflow: ellipsis; line-height: 16px; box-sizing: border-box;
  `;
  nameBadge.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
  nameBadge.appendChild(targetDoc.createTextNode(` ${displayLabel}`));
  header.appendChild(nameBadge);

  const spacer = targetDoc.createElement("div");
  spacer.style.cssText = "flex:1;";
  header.appendChild(spacer);

  const closeBtn = targetDoc.createElement("button");
  closeBtn.setAttribute(OC_ATTR, "close-btn");
  closeBtn.style.cssText = `
    display: flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; padding: 0; background: transparent;
    border: none; cursor: pointer; color: ${OC_TEXT_MUTED}; border-radius: 4px;
    flex-shrink: 0;
  `;
  closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  events.add(closeBtn, "click", (e) => {
    (e as MouseEvent).preventDefault();
    (e as MouseEvent).stopPropagation();
    _dismissSelection();
  });
  header.appendChild(closeBtn);
  pill.appendChild(header);

  // ── Scrollable body ──
  const body = targetDoc.createElement("div");
  body.style.cssText = `
    padding: 2px 10px 6px;
    max-height: ${Math.min(viewH - 120, 360)}px;
    overflow-y: auto; overflow-x: hidden;
  `;

  for (const cp of colorProps) {
    const isChanged = changedProps.has(cp.property);
    body.appendChild(
      buildColorPropertyRow(
        cp.property,
        cp.computedValue,
        cp.tokenChain,
        isChanged,
        el,
        tokens,
        body,
        cp.sourceSelector,
        cp.sourceType
      )
    );
  }

  pill.appendChild(body);

  // ── Add property section ──
  const addSection = targetDoc.createElement("div");
  addSection.style.cssText = `
    padding: 6px 10px 8px;
    border-top: 1px solid ${OC_BORDER_0};
  `;

  const addBtn = targetDoc.createElement("button");
  addBtn.setAttribute(OC_ATTR, "add-prop-btn");
  addBtn.style.cssText = `
    display: flex; align-items: center; gap: 4px;
    width: 100%; padding: 5px 8px; background: transparent;
    border: 1px dashed ${OC_BORDER_0}; border-radius: 6px;
    color: ${OC_TEXT_MUTED}; font-size: 10px; cursor: pointer;
    font-family: ${OC_FONT_SANS}; text-align: left;
    transition: border-color 0.15s, color 0.15s;
  `;
  addBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add color property`;
  events.add(addBtn, "mouseenter", () => {
    addBtn.style.borderColor = OC_TEXT_MUTED;
    addBtn.style.color = OC_TEXT_ON_SURFACE;
  });
  events.add(addBtn, "mouseleave", () => {
    addBtn.style.borderColor = OC_BORDER_0;
    addBtn.style.color = OC_TEXT_MUTED;
  });

  const ddContainer = targetDoc.createElement("div");
  ddContainer.style.cssText = `display: none; margin-top: 4px;`;

  let addOpen = false;
  events.add(addBtn, "click", (e) => {
    (e as MouseEvent).preventDefault();
    (e as MouseEvent).stopPropagation();
    if (addOpen) {
      ddContainer.style.display = "none";
      ddContainer.innerHTML = "";
      addOpen = false;
      return;
    }
    addOpen = true;
    ddContainer.style.display = "block";
    buildInlineAddDropdown(ddContainer, el, tokens, existingPropNames, body);
  });

  addSection.appendChild(addBtn);
  addSection.appendChild(ddContainer);
  pill.appendChild(addSection);

  targetDoc.body?.appendChild(pill);
  _themePill = pill;
  // Use the same inspectorPill slot in feedback-pill for unified hide
  // We store it as _themePill so hideThemePill can remove it

  _pauseInspection();

  _escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      _dismissSelection();
    }
  };
  events.add(targetDoc, "keydown", _escHandler, true);
}

function hideThemePill(): void {
  const targetDoc = getTargetDoc();
  if (_themePill?.parentNode) {
    _themePill.remove();
  }
  _themePill = null;
  if (_escHandler) {
    try {
      targetDoc.removeEventListener("keydown", _escHandler, true);
    } catch {
      /* noop */
    }
    _escHandler = null;
  }
}

export function hideThemeInspectorPill(): void {
  hideThemePill();
}

// ── Inline add dropdown ────────────────────────────────────

function buildInlineAddDropdown(
  container: HTMLDivElement,
  el: Element,
  tokens: ThemeToken[],
  existingProps: Set<string>,
  bodyContainer: HTMLDivElement
) {
  const targetDoc = getTargetDoc();
  container.innerHTML = "";

  const searchInput = targetDoc.createElement("input");
  searchInput.setAttribute(OC_ATTR, "prop-search");
  searchInput.placeholder = "Search CSS property...";
  searchInput.style.cssText = `
    width: 100%; padding: 5px 8px; margin-bottom: 4px;
    background: ${OC_SURFACE_1}; border: 1px solid ${OC_BORDER_0};
    border-radius: 4px; color: ${OC_TEXT_ON_SURFACE};
    font-size: 11px; outline: none; box-sizing: border-box;
    font-family: ${OC_FONT_SANS};
  `;
  container.appendChild(searchInput);

  const list = targetDoc.createElement("div");
  list.style.cssText = `max-height: 160px; overflow-y: auto;`;

  function renderProps(filter: string) {
    list.innerHTML = "";
    const available = (ALL_COLOR_CSS_PROPS as readonly string[]).filter(
      (p) => !existingProps.has(p)
    );
    const filtered = filter
      ? available.filter((p) => p.includes(filter.toLowerCase()))
      : available;

    for (const prop of filtered) {
      const item = targetDoc.createElement("button");
      item.setAttribute(OC_ATTR, "prop-item");
      item.style.cssText = `
        display: block; width: 100%; padding: 4px 8px;
        background: transparent; border: none; border-radius: 4px;
        cursor: pointer; font-family: ${OC_FONT_MONO}; font-size: 10px;
        color: ${OC_TEXT_ON_SURFACE}; text-align: left;
      `;
      item.textContent = prop;
      item.addEventListener("mouseenter", () => {
        item.style.background = OC_SURFACE_1;
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
      });
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const win = targetDoc.defaultView || window;
        const computed =
          win.getComputedStyle(el).getPropertyValue(prop).trim() ||
          "transparent";
        const newRow = buildColorPropertyRow(
          prop,
          computed,
          [],
          false,
          el,
          tokens,
          bodyContainer,
          undefined,
          undefined
        );
        bodyContainer.appendChild(newRow);
        existingProps.add(prop);
        container.style.display = "none";
        container.innerHTML = "";
      });
      list.appendChild(item);
    }

    if (filtered.length === 0) {
      const nr = targetDoc.createElement("div");
      nr.style.cssText = `font-size: 10px; color: ${OC_TEXT_MUTED}; padding: 6px; text-align: center;`;
      nr.textContent = "No matching properties";
      list.appendChild(nr);
    }
  }

  searchInput.addEventListener("input", () =>
    renderProps(searchInput.value)
  );
  renderProps("");
  container.appendChild(list);
  requestAnimationFrame(() => searchInput.focus());
}

// ── Color property row ─────────────────────────────────────

function buildColorPropertyRow(
  property: string,
  computedValue: string,
  tokenChain: string[],
  isChanged: boolean,
  el: Element,
  tokens: ThemeToken[],
  bodyContainer: HTMLDivElement,
  sourceSelector?: string,
  sourceType?: string
): HTMLDivElement {
  const targetDoc = getTargetDoc();

  const row = targetDoc.createElement("div");
  row.style.cssText = `
    padding: 6px 0; border-top: 1px solid ${OC_BORDER_0};
    ${isChanged ? `background: ${OC_PRIMARY_DIM}; margin: 0 -10px; padding: 6px 10px; border-radius: 6px; border-top: none;` : ""}
  `;

  // Header: property name + reset button
  const propHeader = targetDoc.createElement("div");
  propHeader.style.cssText = `display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;`;

  const propLabelWrap = targetDoc.createElement("div");
  propLabelWrap.style.cssText = `display: flex; flex-direction: column; gap: 1px; min-width: 0;`;

  const propLabel = targetDoc.createElement("div");
  propLabel.style.cssText = `font-size: 10px; font-weight: 600; color: ${isChanged ? OC_PRIMARY : OC_TEXT_ON_SURFACE}; text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 3px;`;
  propLabel.textContent = property;
  if (isChanged) {
    const dot = targetDoc.createElement("span");
    dot.style.cssText = `display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: ${OC_PRIMARY}; flex-shrink: 0;`;
    propLabel.appendChild(dot);
  }
  propLabelWrap.appendChild(propLabel);

  if (
    sourceSelector &&
    sourceSelector !== "inline" &&
    sourceSelector !== "browser default"
  ) {
    const srcLabel = targetDoc.createElement("div");
    const prefix = sourceType === "inherited" ? "inherited \u00b7 " : "";
    srcLabel.style.cssText = `font-size: 9px; color: ${sourceType === "inherited" ? "#F59E0B" : OC_TEXT_MUTED}; font-family: ${OC_FONT_MONO}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
    srcLabel.textContent = `${prefix}${sourceSelector}`;
    srcLabel.title = sourceSelector;
    propLabelWrap.appendChild(srcLabel);
  } else if (sourceSelector === "inline") {
    const srcLabel = targetDoc.createElement("div");
    srcLabel.style.cssText = `font-size: 9px; color: ${OC_PRIMARY}; font-style: italic;`;
    srcLabel.textContent = "inline style";
    propLabelWrap.appendChild(srcLabel);
  } else if (sourceSelector === "browser default") {
    const srcLabel = targetDoc.createElement("div");
    srcLabel.style.cssText = `font-size: 9px; color: ${OC_TEXT_MUTED}; font-style: italic;`;
    srcLabel.textContent = "browser default";
    propLabelWrap.appendChild(srcLabel);
  }

  propHeader.appendChild(propLabelWrap);

  // Reset button
  const resetBtn = targetDoc.createElement("button");
  resetBtn.setAttribute(OC_ATTR, "reset-btn");
  resetBtn.style.cssText = `
    display: flex; align-items: center; gap: 2px; padding: 1px 6px;
    background: transparent; border: none; cursor: pointer;
    color: ${OC_TEXT_MUTED}; font-size: 9px; font-family: ${OC_FONT_SANS};
    border-radius: 3px; opacity: ${isChanged ? "1" : "0.4"};
  `;
  resetBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Reset`;
  resetBtn.addEventListener("mouseenter", () => {
    resetBtn.style.color = "#EF4444";
    resetBtn.style.background = "rgba(239,68,68,0.1)";
  });
  resetBtn.addEventListener("mouseleave", () => {
    resetBtn.style.color = OC_TEXT_MUTED;
    resetBtn.style.background = "transparent";
  });
  resetBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const htmlEl = el as HTMLElement;
    htmlEl.style.removeProperty(property);
    const subProps = SHORTHAND_EXPANSION[property] || [];
    for (const sub of subProps) {
      const storedChanges = _themeChangesProvider
        ? _themeChangesProvider()
        : [];
      const elIdForSub = elementMap.get(el);
      const hasIndividualChange = storedChanges.some(
        (c) => c.elementId === elIdForSub && c.property === sub
      );
      if (!hasIndividualChange) {
        htmlEl.style.removeProperty(sub);
      }
    }
    const elIdVal = elementMap.get(el);
    if (elIdVal && _themeResetCallback)
      _themeResetCallback(elIdVal, property);
    const freshProps = getColorProperties(el, targetDoc);
    const freshProp = freshProps.find((p) => p.property === property);
    const freshComputed =
      freshProp?.computedValue ||
      (targetDoc.defaultView || window)
        .getComputedStyle(el)
        .getPropertyValue(property)
        .trim();
    const freshChain = freshProp?.tokenChain || [];
    const freshSelector = freshProp?.sourceSelector || sourceSelector;
    const freshType = freshProp?.sourceType || sourceType;
    const newRow = buildColorPropertyRow(
      property,
      freshComputed,
      freshChain,
      false,
      el,
      tokens,
      bodyContainer,
      freshSelector,
      freshType
    );
    row.replaceWith(newRow);
  });
  propHeader.appendChild(resetBtn);
  row.appendChild(propHeader);

  // Value: swatch + computed value + token chain
  const valueRow = targetDoc.createElement("div");
  valueRow.style.cssText = `display: flex; align-items: center; gap: 6px; margin-bottom: 4px;`;

  const swatch = targetDoc.createElement("span");
  swatch.style.cssText = `
    width: 16px; height: 16px; flex-shrink: 0; border-radius: 3px;
    border: 1px solid ${OC_BORDER_1}; display: inline-block;
    background: ${computedValue};
  `;
  valueRow.appendChild(swatch);

  const valueText = targetDoc.createElement("span");
  valueText.style.cssText = `font-size: 10px; color: ${OC_TEXT_ON_SURFACE}; font-family: ${OC_FONT_MONO}; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
  valueText.textContent = computedValue;
  valueRow.appendChild(valueText);

  if (tokenChain.length > 0) {
    const chain = targetDoc.createElement("span");
    chain.style.cssText = `font-size: 9px; color: ${OC_PRIMARY}; flex-shrink: 0; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
    chain.textContent = tokenChain[0];
    chain.title = tokenChain.join(" \u2192 ");
    valueRow.appendChild(chain);
  }
  row.appendChild(valueRow);

  // Token picker
  const pickerWrap = targetDoc.createElement("div");

  const pickerBtn = targetDoc.createElement("button");
  pickerBtn.setAttribute(OC_ATTR, "token-picker-btn");
  pickerBtn.style.cssText = `
    display: flex; align-items: center; gap: 4px;
    width: 100%; padding: 4px 8px; background: ${OC_SURFACE_1};
    border: 1px solid ${OC_BORDER_0}; border-radius: 5px;
    color: ${OC_TEXT_MUTED}; font-size: 10px; cursor: pointer;
    font-family: ${OC_FONT_SANS}; text-align: left;
    transition: border-color 0.15s;
  `;
  pickerBtn.textContent =
    tokens.length > 0 ? "Pick a token..." : "No tokens loaded";
  pickerBtn.addEventListener("mouseenter", () => {
    if (tokens.length > 0) pickerBtn.style.borderColor = OC_TEXT_MUTED;
  });
  pickerBtn.addEventListener("mouseleave", () => {
    pickerBtn.style.borderColor = OC_BORDER_0;
  });

  const tokenListContainer = targetDoc.createElement("div");
  tokenListContainer.style.cssText = `display: none; margin-top: 4px;`;

  let pickerOpen = false;
  pickerBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (tokens.length === 0) return;
    if (pickerOpen) {
      tokenListContainer.style.display = "none";
      tokenListContainer.innerHTML = "";
      pickerOpen = false;
      pickerBtn.style.borderColor = OC_BORDER_0;
      return;
    }
    pickerOpen = true;
    pickerBtn.style.borderColor = OC_PRIMARY;
    tokenListContainer.style.display = "block";
    buildInlineTokenList(
      tokenListContainer,
      tokens,
      property,
      computedValue,
      tokenChain,
      el,
      bodyContainer,
      row,
      sourceSelector,
      sourceType
    );
  });

  pickerWrap.appendChild(pickerBtn);
  pickerWrap.appendChild(tokenListContainer);
  row.appendChild(pickerWrap);

  return row;
}

// ── Inline token list ──────────────────────────────────────

function buildInlineTokenList(
  container: HTMLDivElement,
  tokens: ThemeToken[],
  property: string,
  computedValue: string,
  tokenChain: string[],
  el: Element,
  bodyContainer: HTMLDivElement,
  row: HTMLDivElement,
  sourceSelector?: string,
  sourceType?: string
) {
  const targetDoc = getTargetDoc();
  container.innerHTML = "";

  const searchInput = targetDoc.createElement("input");
  searchInput.setAttribute(OC_ATTR, "token-search");
  searchInput.placeholder = "Search tokens...";
  searchInput.style.cssText = `
    width: 100%; padding: 5px 8px; margin-bottom: 4px;
    background: ${OC_SURFACE_1}; border: 1px solid ${OC_BORDER_0};
    border-radius: 4px; color: ${OC_TEXT_ON_SURFACE};
    font-size: 11px; outline: none; box-sizing: border-box;
    font-family: ${OC_FONT_SANS};
  `;
  container.appendChild(searchInput);

  const list = targetDoc.createElement("div");
  list.style.cssText = `max-height: 240px; overflow-y: auto;`;

  function renderTokens(filter: string) {
    list.innerHTML = "";
    const filtered = filter
      ? tokens.filter(
          (t) =>
            t.name.toLowerCase().includes(filter.toLowerCase()) ||
            t.value.toLowerCase().includes(filter.toLowerCase())
        )
      : tokens;

    for (const token of filtered.slice(0, 100)) {
      const item = targetDoc.createElement("button");
      item.setAttribute(OC_ATTR, "token-item");
      item.style.cssText = `
        display: flex; align-items: center; gap: 5px;
        width: 100%; padding: 3px 6px; background: transparent;
        border: none; border-radius: 3px; cursor: pointer;
        font-family: ${OC_FONT_MONO}; font-size: 10px;
        color: ${OC_TEXT_ON_SURFACE}; text-align: left;
        box-sizing: border-box;
      `;
      item.addEventListener("mouseenter", () => {
        item.style.background = OC_SURFACE_1;
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
      });

      const ts = targetDoc.createElement("span");
      ts.style.cssText = `width: 12px; height: 12px; flex-shrink: 0; border-radius: 2px; border: 1px solid ${OC_BORDER_1}; display: inline-block; background: ${token.value};`;
      item.appendChild(ts);

      const tn = targetDoc.createElement("span");
      tn.textContent = token.name;
      tn.style.cssText = `flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
      item.appendChild(tn);

      const tv = targetDoc.createElement("span");
      tv.style.cssText = `font-size: 8px; color: ${OC_TEXT_MUTED}; flex-shrink: 0;`;
      tv.textContent = token.value;
      item.appendChild(tv);

      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyTokenToElement(
          el,
          property,
          computedValue,
          tokenChain,
          token,
          sourceSelector,
          sourceType
        );
        const newRow = buildColorPropertyRow(
          property,
          token.value,
          [token.name],
          true,
          el,
          tokens,
          bodyContainer,
          sourceSelector,
          sourceType
        );
        row.replaceWith(newRow);
      });

      list.appendChild(item);
    }

    if (filtered.length === 0) {
      const nr = targetDoc.createElement("div");
      nr.style.cssText = `font-size: 10px; color: ${OC_TEXT_MUTED}; padding: 6px; text-align: center;`;
      nr.textContent = "No matching tokens";
      list.appendChild(nr);
    }
  }

  searchInput.addEventListener("input", () =>
    renderTokens(searchInput.value)
  );
  renderTokens("");
  container.appendChild(list);
  requestAnimationFrame(() => searchInput.focus());
}

// ── Apply token to element ─────────────────────────────────

function applyTokenToElement(
  el: Element,
  property: string,
  originalValue: string,
  originalTokenChain: string[],
  token: ThemeToken,
  sourceSelector?: string,
  sourceType?: string
) {
  const elId = elementMap.get(el);
  if (!elId) return;
  const htmlEl = el as HTMLElement;

  htmlEl.style.setProperty(property, `var(${token.name})`);

  const subProps = SHORTHAND_EXPANSION[property] || [];
  for (const sub of subProps) {
    htmlEl.style.setProperty(sub, `var(${token.name})`);
  }

  if (_themeChangeCallback) {
    const selector = el.id
      ? `#${el.id}`
      : el.tagName.toLowerCase() +
        (el.className
          ? `.${(el as HTMLElement).className.split(" ")[0]}`
          : "");

    _themeChangeCallback({
      elementId: elId,
      elementSelector: selector,
      elementTag: el.tagName.toLowerCase(),
      elementClasses: Array.from(el.classList),
      property,
      originalValue,
      originalTokenChain,
      originalSourceSelector: sourceSelector || selector,
      originalSourceType:
        (sourceType as "rule" | "inline" | "inherited") || "rule",
      newToken: token.name,
      newValue: token.value,
      boundingBox: {
        x: getLastClickPos().x,
        y: getLastClickPos().y,
        width: 0,
        height: 0,
      },
    });
  }
}

// ── Theme change markers ───────────────────────────────────

type ThemeMarkerData = {
  id: string;
  number: number;
  elementId: string;
  label: string;
  boundingBox: { x: number; y: number; width: number; height: number };
};

const themeMarkers: Map<string, HTMLDivElement> = new Map();

export function renderThemeChangeMarkers(items: ThemeMarkerData[]): void {
  const targetDoc = getTargetDoc();

  for (const [id, el] of themeMarkers) {
    if (!items.find((i) => i.id === id)) {
      el.remove();
      themeMarkers.delete(id);
    }
  }

  for (const item of items) {
    let marker = themeMarkers.get(item.id);

    if (!marker) {
      marker = targetDoc.createElement("div");
      marker.setAttribute(OC_ATTR, "theme-marker");
      marker.setAttribute("data-theme-change-id", item.id);
      marker.style.cssText = `
        position: absolute; z-index: 2147483645;
        width: 22px; height: 22px; border-radius: 50%;
        background: ${OC_PRIMARY}; color: #fff;
        border: 2px solid #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; font-weight: 700; font-family: ${OC_FONT_SANS};
        cursor: pointer; pointer-events: auto;
        box-shadow: 0 2px 10px rgba(20,184,166,0.4);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        user-select: none;
      `;

      const pencilSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
      const numberText = String(item.number);

      marker.title = item.label;
      marker.addEventListener("mouseenter", () => {
        if (marker) {
          marker.innerHTML = pencilSvg;
          marker.style.transform = "scale(1.15)";
          marker.style.boxShadow = "0 4px 16px rgba(20,184,166,0.5)";
        }
      });
      marker.addEventListener("mouseleave", () => {
        if (marker) {
          marker.textContent = numberText;
          marker.style.transform = "";
          marker.style.boxShadow = "0 2px 10px rgba(20,184,166,0.4)";
        }
      });

      marker.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const el = getElementById(item.elementId);
        if (el) {
          const rect = el.getBoundingClientRect();
          setSelectedEl(el);
          showThemeInspectorPill(el, rect.x + rect.width / 2, rect.y);
        }
      });

      targetDoc.body?.appendChild(marker);
      themeMarkers.set(item.id, marker);
    }

    const win = targetDoc.defaultView || window;
    marker.style.left = `${item.boundingBox.x + win.scrollX - 11}px`;
    marker.style.top = `${item.boundingBox.y + win.scrollY - 11}px`;
    marker.textContent = String(item.number);
  }
}

export function clearThemeChangeMarkers(): void {
  for (const [, el] of themeMarkers) el.remove();
  themeMarkers.clear();
}

/** Cleanup: remove theme pill, markers, and all tracked event listeners */
export function cleanupThemePill(): void {
  hideThemePill();
  clearThemeChangeMarkers();
  events.cleanup();
}
