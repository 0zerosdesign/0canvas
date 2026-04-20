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
  background: var(--color--surface--floor);
  border-bottom: 1px solid var(--color--border--on-surface-0);
  overflow-x: auto;
}
${S} .oc-settings-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: transparent; border: none; border-radius: 6px;
  color: var(--color--text--muted);
  font-size: 12px; font-weight: 500;
  cursor: pointer; white-space: nowrap;
  font-family: inherit;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-settings-tab:hover {
  color: var(--color--text--on-surface);
  background: rgba(255, 255, 255, 0.03);
}
${S} .oc-settings-tab.is-active {
  color: var(--color--text--on-surface);
  background: rgba(255, 255, 255, 0.06);
}
${S} .oc-settings-tab--back {
  margin-right: 6px;
  padding-right: 12px;
  border-right: 1px solid var(--color--border--on-surface-0);
  border-radius: 6px 0 0 6px;
}
${S} .oc-settings-content {
  flex: 1; min-height: 0;
  background: var(--color--surface--0);
  overflow: hidden;
}
/* Comfortable reading column that still gives the cards room to
 * breathe on larger displays. The section title acts as the left
 * edge. */
${S} .oc-settings-scroll {
  height: 100%; max-width: 960px;
  margin: 0 auto; padding: 24px 32px 32px;
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
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 8px;
  color: var(--color--text--on-surface);
  font-size: 13px; font-weight: 500;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease;
}
${S} .oc-ai-tile:hover {
  border-color: rgba(255, 255, 255, 0.25);
}
${S} .oc-ai-tile.is-active {
  border-color: #ffffff;
  background: var(--color--surface--2);
}
${S} .oc-ai-tile-label { flex: 1; }
${S} .oc-ai-tile-glyph.is-claude { color: #c86b3f; }
${S} .oc-ai-tile-glyph.is-codex { color: #b4b4b4; }

${S} .oc-ai-auth {
  display: flex; flex-direction: column; gap: 10px;
}
${S} .oc-ai-auth-head {
  display: flex; align-items: center; justify-content: space-between;
}
${S} .oc-ai-auth-tabs {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  padding: 4px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 8px;
}
${S} .oc-ai-auth-tab {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; padding: 8px 10px;
  background: transparent; border: 1px solid transparent;
  border-radius: 8px;
  color: var(--color--text--muted);
  font-size: 13px; font-weight: 500; font-family: inherit;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
}
${S} .oc-ai-auth-tab:hover {
  color: var(--color--text--on-surface);
}
${S} .oc-ai-auth-tab.is-active.is-info {
  color: var(--color--text--primary-light);
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.35);
}
${S} .oc-ai-auth-tab.is-active.is-success {
  color: var(--color--text--success);
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.35);
}

${S} .oc-ai-auth-panel {
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 8px;
  background: var(--color--surface--1);
}
${S} .oc-ai-auth-panel.is-info {
  border-color: rgba(37, 99, 235, 0.3);
  background: rgba(37, 99, 235, 0.06);
}
${S} .oc-ai-auth-panel.is-success {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.05);
}
${S} .oc-ai-auth-panel-head {
  display: flex; align-items: center; gap: 8px;
  color: var(--color--text--on-surface);
  font-size: 13px;
}
${S} .oc-ai-auth-panel.is-info .oc-ai-auth-panel-head { color: var(--color--text--primary-light); }
${S} .oc-ai-auth-panel.is-success .oc-ai-auth-panel-head { color: var(--color--text--success); }
${S} .oc-ai-auth-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  color: var(--color--text--on-surface);
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
  color: var(--color--text--muted);
  cursor: pointer;
}
${S} .oc-ai-auth-icon:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color--text--on-surface);
}

${S} .oc-ai-chip {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 9999px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase;
}
${S} .oc-ai-chip.is-info {
  background: rgba(37, 99, 235, 0.14);
  color: var(--color--text--primary-light);
}
${S} .oc-ai-chip.is-success {
  background: rgba(16, 185, 129, 0.14);
  color: var(--color--text--success);
}
${S} .oc-ai-chip.is-warn {
  background: rgba(245, 158, 11, 0.14);
  color: var(--color--text--warning);
}

${S} .oc-ai-card {
  padding: 14px 16px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
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
  color: var(--color--text--on-surface);
  display: flex; align-items: center; gap: 8px;
}
${S} .oc-ai-card-hint {
  margin: 0;
  font-size: 11px; color: var(--color--text--muted); line-height: 1.5;
}
${S} .oc-ai-card-hint code {
  padding: 1px 5px;
  background: var(--color--surface--0);
  border-radius: 4px;
  font-family: var(--font-firacode);
  font-size: 10px;
}

${S} .oc-ai-effort-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
}
${S} .oc-ai-effort {
  padding: 10px 8px;
  background: transparent;
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 8px;
  color: var(--color--text--muted);
  cursor: pointer;
  display: flex; flex-direction: column; gap: 2px; align-items: center;
  font-family: inherit;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}
${S} .oc-ai-effort:hover {
  color: var(--color--text--on-surface);
}
${S} .oc-ai-effort.is-active {
  border-color: #ffffff;
  color: var(--color--text--on-surface);
  background: rgba(255, 255, 255, 0.03);
}
${S} .oc-ai-effort-label {
  font-size: 13px; font-weight: 600;
}
${S} .oc-ai-effort-hint {
  font-size: 11px; color: var(--color--text--muted);
}

${S} .oc-ai-toggle {
  position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0;
}
${S} .oc-ai-toggle input { opacity: 0; width: 0; height: 0; }
${S} .oc-ai-toggle-track {
  position: absolute; inset: 0;
  background: var(--color--surface--2);
  border-radius: 9999px;
  transition: background 120ms ease;
  cursor: pointer;
}
${S} .oc-ai-toggle-track::before {
  content: "";
  position: absolute; left: 3px; top: 3px;
  width: 16px; height: 16px;
  background: var(--color--text--on-surface);
  border-radius: 50%;
  transition: transform 140ms ease;
}
${S} .oc-ai-toggle input:checked + .oc-ai-toggle-track {
  background: #f59e0b;
}
${S} .oc-ai-toggle input:checked + .oc-ai-toggle-track::before {
  transform: translateX(16px);
  background: #ffffff;
}

${S} .oc-ai-auth-install {
  display: flex; flex-direction: column; gap: 8px;
}
${S} .oc-ai-auth-cmd {
  display: block;
  padding: 8px 10px;
  background: var(--color--surface--0);
  border: 1px solid var(--color--border--on-surface-0);
  border-radius: 6px;
  font-family: var(--font-firacode);
  font-size: 11px;
  color: var(--color--text--on-surface);
  white-space: nowrap; overflow-x: auto;
}
${S} .oc-ai-save-btn.is-ghost {
  background: transparent;
  border: 1px solid var(--color--border--on-surface-1);
  color: var(--color--text--muted);
}
${S} .oc-ai-save-btn.is-ghost:hover {
  color: var(--color--text--on-surface);
  background: rgba(255, 255, 255, 0.03);
}

${S} .oc-ai-saved-toast {
  align-self: flex-end;
  padding: 4px 10px;
  background: rgba(16, 185, 129, 0.14);
  color: var(--color--text--success);
  border-radius: 8px;
  font-size: 11px;
}
`;
