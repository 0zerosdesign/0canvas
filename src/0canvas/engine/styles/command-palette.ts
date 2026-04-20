// ──────────────────────────────────────────────────────────
// Command Palette — overlay, input, item list
// ──────────────────────────────────────────────────────────

export const commandPaletteCSS = (S: string) => `
/* ── Command Palette ───────────────────────────────────────── */
${S} .oc-cmd-overlay {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 20vh; background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
}
${S} .oc-cmd-panel {
  width: 520px; max-height: 420px; border-radius: 12px;
  border: 1px solid var(--color--border--on-surface-0); background: var(--color--surface--floor);
  box-shadow: var(--shadow-2xl); overflow: hidden;
  display: flex; flex-direction: column;
}
${S} .oc-cmd-input {
  width: 100%; padding: 14px 16px; border: none;
  background: transparent; color: var(--color--text--on-surface);
  font-size: 15px; font-family: var(--font-sans); outline: none;
  flex-shrink: 0;
}
${S} .oc-cmd-input::placeholder { color: var(--color--text--disabled); }
${S} .oc-cmd-divider {
  height: 1px; background: var(--color--border--on-surface-0); flex-shrink: 0;
}
${S} .oc-cmd-list {
  overflow-y: auto; padding: 6px 0; flex: 1; min-height: 0;
}
${S} .oc-cmd-category {
  padding: 8px 16px 4px; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--color--text--muted);
}
${S} .oc-cmd-item {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 10px 16px; cursor: pointer;
  color: var(--color--text--on-surface-variant); font-size: 13px;
  transition: background 0.1s ease;
}
${S} .oc-cmd-item:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-cmd-item.is-active { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-cmd-label { flex: 1; }
${S} .oc-cmd-kbd {
  padding: 2px 6px; border-radius: 4px; font-size: 10px;
  background: var(--color--surface--1); color: var(--color--text--muted);
  font-family: var(--font-mono);
}
${S} .oc-cmd-empty {
  padding: 24px 16px; text-align: center;
  color: var(--color--text--disabled); font-size: 13px;
}

/* ── Inline Edit (Cmd+K) ──────────────────────────────────── */
${S} .oc-inline-edit {
  width: 360px; border-radius: 12px; z-index: 110;
  border: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--floor);
  box-shadow: var(--shadow-2xl);
  overflow: hidden;
  animation: oc-inline-edit-in 0.15s ease-out;
}
@keyframes oc-inline-edit-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
${S} .oc-inline-edit-input-row {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
}
${S} .oc-inline-edit-icon {
  flex-shrink: 0; color: var(--color--text--muted);
}
${S} .oc-inline-edit-input {
  flex: 1; border: none; background: transparent;
  color: var(--color--text--on-surface); font-size: 13px;
  font-family: var(--font-sans); outline: none;
}
${S} .oc-inline-edit-input::placeholder { color: var(--color--text--disabled); }
${S} .oc-inline-edit-kbd {
  flex-shrink: 0; padding: 2px 6px; border-radius: 4px;
  font-size: 10px; background: var(--color--surface--1);
  color: var(--color--text--muted); font-family: var(--font-mono);
}
${S} .oc-inline-edit-status {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; color: var(--color--text--on-surface-variant);
  font-size: 13px;
}
${S} .oc-inline-edit-spinner {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid var(--color--border--on-surface-0);
  border-top-color: var(--color--text--on-surface);
  animation: oc-spin 0.6s linear infinite;
}
@keyframes oc-spin { to { transform: rotate(360deg); } }
${S} .oc-inline-edit-result {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; gap: 10px;
}
${S} .oc-inline-edit-result-info {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--color--text--on-surface);
}
${S} .oc-inline-edit-actions {
  display: flex; gap: 6px;
}
${S} .oc-inline-edit-accept,
${S} .oc-inline-edit-reject {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 10px; border-radius: 6px; border: none;
  font-size: 12px; cursor: pointer; font-family: var(--font-sans);
}
${S} .oc-inline-edit-accept {
  background: var(--color--status--success); color: #fff;
}
${S} .oc-inline-edit-reject {
  background: var(--color--surface--1); color: var(--color--text--on-surface-variant);
}
${S} .oc-inline-edit-action-kbd {
  font-size: 10px; opacity: 0.7; font-family: var(--font-mono);
}
${S} .oc-inline-edit-error {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; font-size: 13px;
}
${S} .oc-inline-edit-error-text {
  flex: 1; color: var(--color--status--critical);
}
${S} .oc-inline-edit-retry {
  padding: 4px 10px; border-radius: 6px; border: none;
  background: var(--color--surface--1); color: var(--color--text--on-surface);
  font-size: 12px; cursor: pointer; font-family: var(--font-sans);
}
${S} .oc-inline-edit-apikey {
  padding: 12px 14px;
}
${S} .oc-inline-edit-apikey-label {
  font-size: 12px; color: var(--color--text--muted); margin-bottom: 8px;
}
${S} .oc-inline-edit-send {
  padding: 6px 12px; border-radius: 6px; border: none;
  background: var(--color--surface--1); color: var(--color--text--on-surface);
  font-size: 12px; cursor: pointer; font-family: var(--font-sans);
}
${S} .oc-inline-edit-send:disabled { opacity: 0.4; cursor: default; }

/* ── Visual Diff ──────────────────────────────────────────── */
${S} .oc-vdiff-overlay {
  position: fixed; inset: 0; z-index: 105;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
}
${S} .oc-vdiff-modal {
  width: 90vw; max-width: 1100px; height: 80vh;
  border-radius: 12px; overflow: hidden;
  border: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--floor);
  box-shadow: var(--shadow-2xl);
  display: flex; flex-direction: column;
}
${S} .oc-vdiff-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--color--border--on-surface-0);
  flex-shrink: 0;
}
${S} .oc-vdiff-header-left { display: flex; align-items: center; gap: 10px; }
${S} .oc-vdiff-title {
  font-size: 15px; font-weight: 600; color: var(--color--text--on-surface);
}
${S} .oc-vdiff-variant-name {
  font-size: 12px; color: var(--color--text--muted);
  padding: 2px 8px; border-radius: 4px; background: var(--color--surface--1);
}
${S} .oc-vdiff-close {
  padding: 4px; border-radius: 6px; border: none; background: none;
  color: var(--color--text--muted); cursor: pointer;
}
${S} .oc-vdiff-close:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-vdiff-body {
  flex: 1; position: relative; overflow: hidden;
  background: var(--color--surface--1);
}
${S} .oc-vdiff-pane {
  position: absolute; inset: 0;
}
${S} .oc-vdiff-label {
  position: absolute; top: 12px; z-index: 2;
  padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
}
${S} .oc-vdiff-label-before {
  left: 12px; background: var(--color--status--critical); color: #fff;
}
${S} .oc-vdiff-label-after {
  right: 12px; background: var(--color--status--success); color: #fff;
}
${S} .oc-vdiff-slider {
  position: absolute; top: 0; bottom: 0; width: 3px; z-index: 3;
  transform: translateX(-50%); cursor: ew-resize;
}
${S} .oc-vdiff-slider-line {
  position: absolute; inset: 0; background: #fff;
  box-shadow: 0 0 6px rgba(0,0,0,0.4);
}
${S} .oc-vdiff-slider-handle {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 28px; height: 28px; border-radius: 50%;
  background: #fff; color: #333;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
`;
