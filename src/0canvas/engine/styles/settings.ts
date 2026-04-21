// ──────────────────────────────────────────────────────────
// Settings Page — navigation, content area
// ──────────────────────────────────────────────────────────

export const settingsCSS = (S: string) => `
/* ── Settings Page ────────────────────────────────────────── */
/* Settings renders inside Column 3 alongside Design / Themes.
 * Layout: horizontal section tabs on top (matching .oc-page-tabs)
 * + scrollable content below. No vertical sidebar, no fullscreen
 * takeover — Col 1 and Col 2 stay reachable. */
${S} .oc-settings-page {
  flex: 1; display: flex; flex-direction: column; height: 100%;
  overflow: hidden;
}
${S} .oc-settings-tabs {
  display: flex; align-items: center; gap: 2px;
  padding: 10px 10px 4px;
  flex-shrink: 0;
  background: var(--surface-floor);
  border-bottom: 1px solid var(--border-subtle);
  overflow-x: auto;
}
${S} .oc-settings-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: transparent; border: none; border-radius: 6px;
  color: var(--text-muted);
  font-size: 12px; font-weight: 500;
  cursor: pointer; white-space: nowrap;
  font-family: inherit;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-settings-tab:hover {
  color: var(--text-on-surface);
  background: var(--tint-hover);
}
${S} .oc-settings-tab.is-active {
  color: var(--text-on-surface);
  background: var(--tint-active);
}
${S} .oc-settings-tab--back {
  margin-right: 6px;
  padding-right: 12px;
  border-right: 1px solid var(--border-subtle);
  border-radius: 6px 0 0 6px;
}
${S} .oc-settings-content {
  flex: 1; min-height: 0;
  background: var(--surface-0);
  overflow: hidden;
}
/* Left-aligned reading column with a comfortable max width.
 * When Col 3 is wider than ~720px the content stops at that
 * width so lines stay readable; the left edge anchors to the
 * tab bar's left padding so headings sit under the tab row. */
${S} .oc-settings-scroll {
  height: 100%; max-width: 720px;
  margin: 0; padding: 24px 20px 32px;
}

/* ── AI Models panel (Phase 4) ─────────────────────────── */

${S} .oc-ai-settings {
  display: flex; flex-direction: column; gap: 18px;
}

${S} .oc-ai-tiles {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
${S} .oc-ai-tile {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-on-surface);
  font-size: 13px; font-weight: 500;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease;
}
${S} .oc-ai-tile:hover {
  border-color: var(--tint-border-hover);
}
${S} .oc-ai-tile.is-active {
  border-color: var(--surface-inverted);
  background: var(--surface-2);
}
${S} .oc-ai-tile-label { flex: 1; }
/* Product-brand glyph tints — Claude orange + Codex grey. These are
   intentionally sourced from primitive scales because they represent
   the brand's literal color, not a semantic UI role. */
/* check:ui ignore-next */
${S} .oc-ai-tile-glyph.is-claude { color: var(--orange-500); }
/* check:ui ignore-next */
${S} .oc-ai-tile-glyph.is-codex { color: var(--grey-400); }

${S} .oc-ai-auth {
  display: flex; flex-direction: column; gap: 10px;
}
${S} .oc-ai-auth-head {
  display: flex; align-items: center; justify-content: space-between;
}
${S} .oc-ai-auth-tabs {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  padding: 4px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
${S} .oc-ai-auth-tab {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; padding: 8px 10px;
  background: transparent; border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 13px; font-weight: 500; font-family: inherit;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
}
${S} .oc-ai-auth-tab:hover {
  color: var(--text-on-surface);
}
${S} .oc-ai-auth-tab.is-active.is-info {
  color: var(--text-primary-light);
  background: var(--tint-primary-soft);
  border-color: var(--tint-primary-border);
}
${S} .oc-ai-auth-tab.is-active.is-success {
  color: var(--text-success);
  background: var(--tint-success-soft);
  border-color: var(--tint-success-border);
}

${S} .oc-ai-auth-panel {
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--surface-1);
}
${S} .oc-ai-auth-panel.is-info {
  border-color: var(--tint-primary-border);
  background: var(--tint-primary-weak);
}
${S} .oc-ai-auth-panel.is-success {
  border-color: var(--tint-success-border);
  background: var(--tint-success-weak);
}
${S} .oc-ai-auth-panel-head {
  display: flex; align-items: center; gap: 8px;
  color: var(--text-on-surface);
  font-size: 13px;
}
${S} .oc-ai-auth-panel.is-info .oc-ai-auth-panel-head { color: var(--text-primary-light); }
${S} .oc-ai-auth-panel.is-success .oc-ai-auth-panel-head { color: var(--text-success); }
${S} .oc-ai-auth-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  color: var(--text-on-surface);
  font-size: 12px;
}
${S} .oc-ai-auth-row input {
  flex: 1; min-width: 180px;
}
${S} .oc-ai-auth-icon {
  margin-left: auto;
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  background: transparent; border: none;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
}
${S} .oc-ai-auth-icon:hover {
  background: var(--tint-hover-strong);
  color: var(--text-on-surface);
}

${S} .oc-ai-chip {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 9999px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase;
}
${S} .oc-ai-chip.is-info {
  background: var(--tint-primary-soft);
  color: var(--text-primary-light);
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
  padding: 14px 16px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  display: flex; flex-direction: column; gap: 12px;
}
${S} .oc-ai-card-head {
  display: flex; flex-direction: column; gap: 4px;
}
${S} .oc-ai-card-head--row {
  flex-direction: row; align-items: center; justify-content: space-between; gap: 16px;
}
${S} .oc-ai-card-title {
  font-size: 13px; font-weight: 600;
  color: var(--text-on-surface);
  display: flex; align-items: center; gap: 8px;
}
${S} .oc-ai-card-hint {
  margin: 0;
  font-size: 11px; color: var(--text-muted); line-height: 1.5;
}
${S} .oc-ai-card-hint code {
  padding: 1px 5px;
  background: var(--surface-0);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
}

${S} .oc-ai-effort-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
}
${S} .oc-ai-effort {
  padding: 10px 8px;
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex; flex-direction: column; gap: 2px; align-items: center;
  font-family: inherit;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}
${S} .oc-ai-effort:hover {
  color: var(--text-on-surface);
}
${S} .oc-ai-effort.is-active {
  border-color: var(--surface-inverted);
  color: var(--text-on-surface);
  background: var(--tint-hover);
}
${S} .oc-ai-effort-label {
  font-size: 13px; font-weight: 600;
}
${S} .oc-ai-effort-hint {
  font-size: 11px; color: var(--text-muted);
}

${S} .oc-ai-toggle {
  position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0;
}
${S} .oc-ai-toggle input { opacity: 0; width: 0; height: 0; }
${S} .oc-ai-toggle-track {
  position: absolute; inset: 0;
  background: var(--surface-2);
  border-radius: 9999px;
  transition: background 120ms ease;
  cursor: pointer;
}
${S} .oc-ai-toggle-track::before {
  content: "";
  position: absolute; left: 3px; top: 3px;
  width: 16px; height: 16px;
  background: var(--text-on-surface);
  border-radius: 50%;
  transition: transform 140ms ease;
}
${S} .oc-ai-toggle input:checked + .oc-ai-toggle-track {
  background: var(--status-warning);
}
${S} .oc-ai-toggle input:checked + .oc-ai-toggle-track::before {
  transform: translateX(16px);
  background: var(--surface-inverted);
}

${S} .oc-ai-auth-install {
  display: flex; flex-direction: column; gap: 8px;
}
${S} .oc-ai-auth-cmd {
  display: block;
  padding: 8px 10px;
  background: var(--surface-0);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-on-surface);
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
`;
