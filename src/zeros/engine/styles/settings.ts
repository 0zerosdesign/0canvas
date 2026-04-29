// ──────────────────────────────────────────────────────────
// Settings Page — navigation, content area
// ──────────────────────────────────────────────────────────

export const settingsCSS = (S: string) => `
/* ── Settings Page (Cursor v3-style full-screen) ──────────── */
/* Takes over the whole app body. Left column = vertical section
 * nav + back button. Right column = the active panel, constrained
 * to a readable max-width. The 3-col shell is hidden while here;
 * Back returns to Design. */

/* Root wrapper (has data-Zeros-root so scoped tokens apply). */
${S}.oc-settings-root,
${S} .oc-settings-root {
  flex: 1; display: flex; min-width: 0; min-height: 0;
  background: var(--surface-0);
}

${S} .oc-settings-page {
  flex: 1; display: flex; flex-direction: row; height: 100%;
  min-width: 0; min-height: 0;
  overflow: hidden;
  background: var(--surface-0);
}

/* Left sidebar */
${S} .oc-settings-sidebar {
  flex: 0 0 220px;
  display: flex; flex-direction: column;
  background: var(--surface-floor);
  border-right: 1px solid var(--border-subtle);
  overflow: hidden;
}
${S} .oc-settings-sidebar__header {
  display: flex; align-items: center;
  padding: var(--space-5x) var(--space-5x) var(--space-3x);
  flex-shrink: 0;
}
${S} .oc-settings-sidebar__back {
  height: auto !important;
  display: inline-flex; align-items: center; gap: var(--space-3x);
  padding: var(--space-3x) var(--space-5x) !important;
  background: transparent; border: none; border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--text-12); font-weight: var(--weight-control); font-family: inherit;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
${S} .oc-settings-sidebar__back:hover {
  background: var(--tint-hover);
  color: var(--text-primary);
}
${S} .oc-settings-sidebar__nav {
  flex: 1; display: flex; flex-direction: column; gap: 1px;
  padding: var(--space-1) var(--space-2) var(--space-3);
  overflow-y: auto;
}
${S} .oc-settings-sidebar__item {
  display: flex; align-items: center; justify-content: flex-start;
  width: 100%; height: auto;
  gap: var(--space-5x);
  padding: var(--space-2) var(--space-5x);
  background: transparent; border: none; border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--text-13); font-weight: var(--weight-control); font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
${S} .oc-settings-sidebar__item > svg { flex-shrink: 0; color: var(--text-muted); }
${S} .oc-settings-sidebar__item:hover {
  background: var(--tint-hover);
  color: var(--text-primary);
}
${S} .oc-settings-sidebar__item.is-active {
  background: var(--tint-active);
  color: var(--text-primary);
}
${S} .oc-settings-sidebar__item.is-active > svg {
  color: var(--text-primary);
}

/* Content area */
${S} .oc-settings-content {
  flex: 1; min-width: 0; min-height: 0;
  background: var(--surface-0);
  overflow: hidden;
}
${S} .oc-settings-scroll {
  height: 100%;
}
${S} .oc-settings-scroll__inner {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-7) var(--space-7) var(--space-8);
  display: flex; flex-direction: column; gap: 18px;
}
${S} .oc-settings-heading {
  margin: 0 0 var(--space-3x);
  font-size: var(--text-18);
  font-weight: var(--weight-heading);
  letter-spacing: -0.01em;
  color: var(--text-primary);
}
${S} .oc-settings-heading-row {
  display: flex; align-items: center; gap: var(--space-2);
  margin: 0 0 var(--space-3x);
}
${S} .oc-settings-heading-row .oc-settings-heading {
  margin: 0;
}
${S} .oc-settings-heading-action {
  color: var(--text-muted);
  opacity: 0.7;
  transition: opacity 120ms ease, color 120ms ease;
}
${S} .oc-settings-heading-action:hover:not(:disabled) {
  opacity: 1;
  color: var(--text-primary);
}
${S} .oc-settings-heading-action:disabled {
  opacity: 0.45;
  cursor: default;
}
${S} .oc-settings-section-title--spaced {
  margin-top: var(--space-7);
}

/* Agents section embeds the live agent registry. Give it a bounded
   height so the internal list scrolls instead of pushing the page. */
${S} .oc-settings-agents {
  height: min(70vh, 620px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface-0);
}

/* New-chat picker (+) in the chat header — opens a dropdown of
   installed agents and creates a fresh chat bound to the pick. */
${S} .oc-new-chat-picker {
  position: relative;
  flex-shrink: 0;
}
${S} .oc-new-chat-picker__menu {
  position: absolute;
  top: calc(100% + var(--space-3x));
  right: 0;
  min-width: 220px;
  max-height: 320px;
  overflow-y: auto;
  padding: var(--space-1);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  gap: 1px;
}
${S} .oc-new-chat-picker__label {
  padding: var(--space-3x) var(--space-5x) var(--space-1);
  font-size: var(--text-10);
  font-weight: var(--weight-heading);
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-transform: uppercase;
}
${S} .oc-new-chat-picker__hint {
  padding: var(--space-2) var(--space-5x);
  font-size: var(--text-11);
  color: var(--text-muted);
  line-height: var(--leading-normal);
}
${S} .oc-new-chat-picker__item {
  display: flex !important;
  align-items: center;
  justify-content: flex-start !important;
  width: 100%;
  height: auto !important;
  gap: var(--space-2);
  padding: var(--space-3x) var(--space-5x) !important;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-12);
  font-weight: var(--weight-control);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}
${S} .oc-new-chat-picker__item:hover {
  background: var(--tint-hover);
}
${S} .oc-new-chat-picker__item.is-disabled,
${S} .oc-new-chat-picker__item[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
}
${S} .oc-new-chat-picker__item.is-disabled:hover,
${S} .oc-new-chat-picker__item[disabled]:hover {
  background: transparent;
}
/* Agent logo in the + menu. color:initial stops SVG currentColor
   fills from inheriting the row's muted colour, so branded marks
   render in their own ink. The Lucide fallback icon gets the
   muted colour via the more-specific selector below. */
${S} .oc-new-chat-picker__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  object-fit: contain;
  color: initial;
}
${S} .oc-new-chat-picker__item svg.oc-new-chat-picker__icon {
  color: var(--text-muted);
}
${S} .oc-new-chat-picker__sep {
  height: 1px;
  background: var(--border-subtle);
  margin: var(--space-1) var(--space-3x);
}

/* Chat tab empty state — shown when no chat is active. */
${S} .oc-chat-empty-state {
  flex: 1;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-7) var(--space-5);
  color: var(--text-muted);
  text-align: center;
}
${S} .oc-chat-empty-state p {
  margin: 0;
  font-size: var(--text-13);
  line-height: 1.55;
  max-width: 300px;
}

/* ── AI Models panel (Phase 4) ─────────────────────────── */

${S} .oc-ai-settings {
  display: flex; flex-direction: column; gap: 18px;
}

${S} .oc-ai-tiles {
  display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5x);
}
${S} .oc-ai-tile {
  display: flex; align-items: center; gap: var(--space-5x);
  padding: var(--space-7x) var(--space-4);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-13); font-weight: var(--weight-control);
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard);
}
${S} .oc-ai-tile:hover {
  border-color: var(--tint-border-hover);
}
${S} .oc-ai-tile.is-active {
  border-color: var(--surface-inverted);
  background: var(--surface-2);
}
${S} .oc-ai-tile-label { flex: 1; }
${S} .oc-ai-tile-glyph.is-claude { color: var(--brand-claude); }
${S} .oc-ai-tile-glyph.is-codex { color: var(--brand-codex); }

${S} .oc-ai-auth {
  display: flex; flex-direction: column; gap: var(--space-5x);
}
${S} .oc-ai-auth-head {
  display: flex; align-items: center; justify-content: space-between;
}
${S} .oc-ai-auth-tabs {
  display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);
  padding: var(--space-1);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}
${S} .oc-ai-auth-tab {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-3x); padding: var(--space-2) var(--space-5x);
  background: transparent; border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: var(--text-13); font-weight: var(--weight-control); font-family: inherit;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
${S} .oc-ai-auth-tab:hover {
  color: var(--text-primary);
}
${S} .oc-ai-auth-tab.is-active.is-info {
  color: var(--accent-hover);
  background: var(--accent-soft-bg);
  border-color: var(--tint-accent-border);
}
${S} .oc-ai-auth-tab.is-active.is-success {
  color: var(--text-success);
  background: var(--tint-success-soft);
  border-color: var(--tint-success-border);
}

${S} .oc-ai-auth-panel {
  display: flex; flex-direction: column; gap: var(--space-5x);
  padding: var(--space-7x) var(--space-4);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-1);
}
${S} .oc-ai-auth-panel.is-info {
  border-color: var(--tint-accent-border);
  background: var(--tint-accent-weak);
}
${S} .oc-ai-auth-panel.is-success {
  border-color: var(--tint-success-border);
  background: var(--tint-success-weak);
}
${S} .oc-ai-auth-panel-head {
  display: flex; align-items: center; gap: var(--space-2);
  color: var(--text-primary);
  font-size: var(--text-13);
}
${S} .oc-ai-auth-panel.is-info .oc-ai-auth-panel-head { color: var(--accent-hover); }
${S} .oc-ai-auth-panel.is-success .oc-ai-auth-panel-head { color: var(--text-success); }
${S} .oc-ai-auth-row {
  display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;
  color: var(--text-primary);
  font-size: var(--text-12);
}
${S} .oc-ai-auth-row input {
  flex: 1; min-width: 180px;
}
${S} .oc-ai-auth-icon {
  margin-left: auto;
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  background: transparent; border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
}
${S} .oc-ai-auth-icon:hover {
  background: var(--tint-hover-strong);
  color: var(--text-primary);
}

${S} .oc-ai-chip {
  display: inline-flex; align-items: center;
  padding: var(--space-hair) var(--space-2); border-radius: var(--radius-pill);
  font-size: var(--text-10); font-weight: var(--weight-heading); letter-spacing: var(--tracking-overline);
  text-transform: uppercase;
}
${S} .oc-ai-chip.is-info {
  background: var(--accent-soft-bg);
  color: var(--accent-hover);
}
${S} .oc-ai-chip.is-success {
  background: var(--tint-success-soft);
  color: var(--text-success);
}
${S} .oc-ai-chip.is-warn {
  background: var(--tint-warning-soft);
  color: var(--text-warning);
}

${S} .oc-ai-card {
  padding: var(--space-7x) var(--space-4);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  display: flex; flex-direction: column; gap: var(--space-3);
}
${S} .oc-ai-card-head {
  display: flex; flex-direction: column; gap: var(--space-1);
}
${S} .oc-ai-card-head--row {
  flex-direction: row; align-items: center; justify-content: space-between; gap: var(--space-4);
}
${S} .oc-ai-card-title {
  font-size: var(--text-13); font-weight: var(--weight-heading);
  color: var(--text-primary);
  display: flex; align-items: center; gap: var(--space-2);
}
${S} .oc-ai-card-hint {
  margin: 0;
  font-size: var(--text-11); color: var(--text-muted); line-height: var(--leading-normal);
}
${S} .oc-ai-card-hint code {
  padding: 1px 5px;
  background: var(--surface-0);
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: var(--text-10);
}

${S} .oc-ai-effort-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2);
}
${S} .oc-ai-effort {
  padding: var(--space-5x) var(--space-2);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  display: flex; flex-direction: column; gap: var(--space-hair); align-items: center;
  font-family: inherit;
  transition: border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard);
}
${S} .oc-ai-effort:hover {
  color: var(--text-primary);
}
${S} .oc-ai-effort.is-active {
  border-color: var(--surface-inverted);
  color: var(--text-primary);
  background: var(--tint-hover);
}
${S} .oc-ai-effort-label {
  font-size: var(--text-13); font-weight: var(--weight-heading);
}
${S} .oc-ai-effort-hint {
  font-size: var(--text-11); color: var(--text-muted);
}

${S} .oc-ai-toggle {
  position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0;
}
${S} .oc-ai-toggle input { opacity: 0; width: 0; height: 0; }
${S} .oc-ai-toggle-track {
  position: absolute; inset: 0;
  background: var(--surface-2);
  border-radius: var(--radius-pill);
  transition: background var(--dur-fast) var(--ease-standard);
  cursor: pointer;
}
${S} .oc-ai-toggle-track::before {
  content: "";
  position: absolute; left: 3px; top: 3px;
  width: 16px; height: 16px;
  background: var(--text-primary);
  border-radius: var(--radius-circle);
  transition: transform var(--dur-fast) var(--ease-emphasized);
}
${S} .oc-ai-toggle input:checked + .oc-ai-toggle-track {
  background: var(--text-warning);
}
${S} .oc-ai-toggle input:checked + .oc-ai-toggle-track::before {
  transform: translateX(16px);
  background: var(--surface-inverted);
}

${S} .oc-ai-auth-install {
  display: flex; flex-direction: column; gap: var(--space-2);
}
${S} .oc-ai-auth-cmd {
  display: block;
  padding: var(--space-2) var(--space-5x);
  background: var(--surface-0);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-11);
  color: var(--text-primary);
  white-space: nowrap; overflow-x: auto;
}

${S} .oc-ai-saved-toast {
  align-self: flex-end;
  padding: var(--space-2) var(--space-5);
  background: var(--tint-success-soft);
  color: var(--text-success);
  border-radius: var(--radius-md);
  font-size: var(--text-11);
}

/* ── Appearance panel — Cursor-style theme controls ────── */
${S} .oc-appearance-select {
  height: var(--h-control-md);
  min-width: 160px;
  padding: 0 var(--space-3);
  background: var(--surface-2);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-12);
  font-family: var(--font-ui);
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-standard);
}
${S} .oc-appearance-select:hover {
  border-color: var(--border-strong);
}
${S} .oc-appearance-select:focus-visible {
  outline: 2px solid var(--ring-focus);
  outline-offset: 1px;
  border-color: transparent;
}

${S} .oc-appearance-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-appearance-row:first-child { padding-top: 0; }
${S} .oc-appearance-row:last-child {
  padding-bottom: 0;
  border-bottom: none;
}
${S} .oc-appearance-row__label {
  display: flex; flex-direction: column; gap: var(--space-1);
  min-width: 0;
}
${S} .oc-appearance-row__control {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

/* Slider — webkit + firefox. The hue variant gets a full-spectrum
   gradient track so the user can see what each position will pick;
   the default variant uses surface-2 for intensity, transparency,
   etc. */
${S} .oc-appearance-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 180px;
  height: 6px;
  background: var(--surface-2);
  border-radius: var(--radius-pill);
  outline: none;
  cursor: pointer;
}
/* Hue track stops use the same OKLCH L+C as the swatch's tint color
 * (TINT_LIGHTNESS=0.55, TINT_CHROMA=0.22 in src/zeros/appearance/prefs.ts).
 * Keeping these in sync means the position-on-track perceptually matches
 * the swatch you'll see — pick yellow on the track, get yellow in the
 * swatch and the chrome. If those constants change, update here too. */
${S} .oc-appearance-slider--hue {
  background: linear-gradient(
    to right,
    oklch(0.55 0.22 0),
    oklch(0.55 0.22 60),
    oklch(0.55 0.22 120),
    oklch(0.55 0.22 180),
    oklch(0.55 0.22 240),
    oklch(0.55 0.22 300),
    oklch(0.55 0.22 360)
  );
}
${S} .oc-appearance-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-circle);
  background: var(--text-primary);
  border: 2px solid var(--surface-0);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: transform var(--dur-fast) var(--ease-emphasized);
}
${S} .oc-appearance-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}
${S} .oc-appearance-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-circle);
  background: var(--text-primary);
  border: 2px solid var(--surface-0);
  cursor: pointer;
}
${S} .oc-appearance-slider:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--ring-focus);
  outline-offset: 2px;
}

${S} .oc-appearance-swatch {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-circle);
  border: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
${S} .oc-appearance-value {
  min-width: 36px;
  text-align: right;
  font-size: var(--text-11);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

${S} .oc-appearance-reset {
  margin-top: var(--space-4);
  display: flex;
  justify-content: flex-end;
}
`;
