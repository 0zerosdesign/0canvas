// ──────────────────────────────────────────────────────────
// Command Palette — overlay, input, item list
// ──────────────────────────────────────────────────────────

export const commandPaletteCSS = (S: string) => `
/* ── Command Palette ───────────────────────────────────────── */
${S} .oc-cmd-overlay {
  position: fixed; inset: 0; z-index: var(--z-modal);
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 20vh; background: var(--backdrop-weak);
  backdrop-filter: blur(4px);
}
${S} .oc-cmd-panel {
  width: 520px; max-height: 420px; border-radius: 12px;
  border: 1px solid var(--border-subtle); background: var(--surface-floor);
  box-shadow: var(--shadow-xl); overflow: hidden;
  display: flex; flex-direction: column;
}
${S} .oc-cmd-input {
  width: 100%; padding: 14px 16px; border: none;
  background: transparent; color: var(--text-on-surface);
  font-size: 15px; font-family: var(--font-ui); outline: none;
  flex-shrink: 0;
}
${S} .oc-cmd-input::placeholder { color: var(--text-disabled); }
${S} .oc-cmd-divider {
  height: 1px; background: var(--border-subtle); flex-shrink: 0;
}
${S} .oc-cmd-list {
  overflow-y: auto; padding: 6px 0; flex: 1; min-height: 0;
}
${S} .oc-cmd-category {
  padding: 8px 16px 4px; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-muted);
}
${S} .oc-cmd-item {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 10px 16px; cursor: pointer;
  color: var(--text-on-surface-variant); font-size: 13px;
  transition: background 0.1s ease;
}
${S} .oc-cmd-item:hover { background: var(--surface-1); color: var(--text-on-surface); }
${S} .oc-cmd-item.is-active { background: var(--surface-1); color: var(--text-on-surface); }
${S} .oc-cmd-label { flex: 1; }
${S} .oc-cmd-kbd {
  padding: 2px 6px; border-radius: 4px; font-size: 10px;
  background: var(--surface-1); color: var(--text-muted);
  font-family: var(--font-mono);
}
${S} .oc-cmd-empty {
  padding: 24px 16px; text-align: center;
  color: var(--text-disabled); font-size: 13px;
}

/* ── Inline Edit (Cmd+K) ──────────────────────────────────── */
${S} .oc-inline-edit {
  width: 360px; border-radius: 12px; z-index: 110;
  border: 1px solid var(--border-subtle);
  background: var(--surface-floor);
  box-shadow: var(--shadow-xl);
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
  flex-shrink: 0; color: var(--text-muted);
}
${S} .oc-inline-edit-input {
  flex: 1; border: none; background: transparent;
  color: var(--text-on-surface); font-size: 13px;
  font-family: var(--font-ui); outline: none;
}
${S} .oc-inline-edit-input::placeholder { color: var(--text-disabled); }
${S} .oc-inline-edit-kbd {
  flex-shrink: 0; padding: 2px 6px; border-radius: 4px;
  font-size: 10px; background: var(--surface-1);
  color: var(--text-muted); font-family: var(--font-mono);
}
@keyframes oc-spin { to { transform: rotate(360deg); } }

/* ── Visual Diff ──────────────────────────────────────────── */
${S} .oc-vdiff-overlay {
  position: fixed; inset: 0; z-index: var(--z-modal);
  display: flex; align-items: center; justify-content: center;
  background: var(--backdrop-strong); backdrop-filter: blur(4px);
}
${S} .oc-vdiff-modal {
  width: 90vw; max-width: 1100px; height: 80vh;
  border-radius: 12px; overflow: hidden;
  border: 1px solid var(--border-subtle);
  background: var(--surface-floor);
  box-shadow: var(--shadow-xl);
  display: flex; flex-direction: column;
}
${S} .oc-vdiff-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
${S} .oc-vdiff-header-left { display: flex; align-items: center; gap: 10px; }
${S} .oc-vdiff-title {
  font-size: 15px; font-weight: 600; color: var(--text-on-surface);
}
${S} .oc-vdiff-variant-name {
  font-size: 12px; color: var(--text-muted);
  padding: 2px 8px; border-radius: 4px; background: var(--surface-1);
}
${S} .oc-vdiff-body {
  flex: 1; position: relative; overflow: hidden;
  background: var(--surface-1);
}
${S} .oc-vdiff-pane {
  position: absolute; inset: 0;
}
${S} .oc-vdiff-label {
  position: absolute; top: 12px; z-index: 2;
  padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
}
${S} .oc-vdiff-label-before {
  left: 12px; background: var(--status-critical); color: var(--text-on-primary);
}
${S} .oc-vdiff-label-after {
  right: 12px; background: var(--status-success); color: var(--text-on-primary);
}
${S} .oc-vdiff-slider {
  position: absolute; top: 0; bottom: 0; width: 3px; z-index: 3;
  transform: translateX(-50%); cursor: ew-resize;
}
${S} .oc-vdiff-slider-line {
  position: absolute; inset: 0; background: var(--surface-inverted);
  box-shadow: var(--shadow-sm);
}
${S} .oc-vdiff-slider-handle {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 28px; height: 28px; border-radius: var(--radius-circle);
  background: var(--surface-inverted); color: var(--text-on-inverted);
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-md);
}
`;
