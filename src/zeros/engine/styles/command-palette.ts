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
  width: 520px; max-height: 420px; border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle); background: var(--surface-floor);
  box-shadow: var(--shadow-xl); overflow: hidden;
  display: flex; flex-direction: column;
}
${S} .oc-cmd-input {
  width: 100%; padding: var(--space-7x) var(--space-4); border: none;
  background: transparent; color: var(--text-primary);
  font-size: var(--text-15); font-family: var(--font-ui); outline: none;
  flex-shrink: 0;
}
${S} .oc-cmd-input::placeholder { color: var(--text-disabled); }
${S} .oc-cmd-divider {
  height: 1px; background: var(--border-subtle); flex-shrink: 0;
}
${S} .oc-cmd-list {
  overflow-y: auto; padding: var(--space-3x) 0; flex: 1; min-height: 0;
}
${S} .oc-cmd-category {
  padding: var(--space-2) var(--space-4) var(--space-1); font-size: var(--text-10); font-weight: var(--weight-heading);
  text-transform: uppercase; letter-spacing: var(--tracking-overline);
  color: var(--text-muted);
}
${S} .oc-cmd-item {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--space-5x); padding: var(--space-5x) var(--space-4); cursor: pointer;
  color: var(--text-muted); font-size: var(--text-13);
  transition: background var(--dur-fast) var(--ease-standard);
}
${S} .oc-cmd-item:hover { background: var(--surface-1); color: var(--text-primary); }
${S} .oc-cmd-item.is-active { background: var(--surface-1); color: var(--text-primary); }
${S} .oc-cmd-label { flex: 1; }
${S} .oc-cmd-kbd {
  padding: var(--space-hair) var(--space-3x); border-radius: var(--radius-xs); font-size: var(--text-10);
  background: var(--surface-1); color: var(--text-muted);
  font-family: var(--font-mono);
}
${S} .oc-cmd-empty {
  padding: var(--space-6) var(--space-4); text-align: center;
  color: var(--text-disabled); font-size: var(--text-13);
}

/* ── Inline Edit (Cmd+K) ──────────────────────────────────── */
${S} .oc-inline-edit {
  width: 360px; border-radius: var(--radius-lg); z-index: 110;
  border: 1px solid var(--border-subtle);
  background: var(--surface-floor);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  animation: oc-inline-edit-in var(--dur-fast) var(--ease-standard);
}
@keyframes oc-inline-edit-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
${S} .oc-inline-edit-input-row {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-5x) var(--space-7x);
}
${S} .oc-inline-edit-icon {
  flex-shrink: 0; color: var(--text-muted);
}
${S} .oc-inline-edit-input {
  flex: 1; border: none; background: transparent;
  color: var(--text-primary); font-size: var(--text-13);
  font-family: var(--font-ui); outline: none;
}
${S} .oc-inline-edit-input::placeholder { color: var(--text-disabled); }
${S} .oc-inline-edit-kbd {
  flex-shrink: 0; padding: var(--space-hair) var(--space-3x); border-radius: var(--radius-xs);
  font-size: var(--text-10); background: var(--surface-1);
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
  border-radius: var(--radius-lg); overflow: hidden;
  border: 1px solid var(--border-subtle);
  background: var(--surface-floor);
  box-shadow: var(--shadow-xl);
  display: flex; flex-direction: column;
}
${S} .oc-vdiff-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
${S} .oc-vdiff-header-left { display: flex; align-items: center; gap: var(--space-5x); }
${S} .oc-vdiff-title {
  font-size: var(--text-15); font-weight: var(--weight-heading); color: var(--text-primary);
}
${S} .oc-vdiff-variant-name {
  font-size: var(--text-12); color: var(--text-muted);
  padding: var(--space-hair) var(--space-2); border-radius: var(--radius-xs); background: var(--surface-1);
}
${S} .oc-vdiff-body {
  flex: 1; position: relative; overflow: hidden;
  background: var(--surface-1);
}
${S} .oc-vdiff-pane {
  position: absolute; inset: 0;
}
${S} .oc-vdiff-label {
  position: absolute; top: var(--space-3); z-index: 2;
  padding: var(--space-1) var(--space-5x); border-radius: var(--radius-sm); font-size: var(--text-11); font-weight: var(--weight-heading);
}
${S} .oc-vdiff-label-before {
  left: var(--space-3); background: var(--tint-critical-soft); color: var(--text-critical);
}
${S} .oc-vdiff-label-after {
  right: var(--space-3); background: var(--tint-success-soft); color: var(--text-success);
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
  width: var(--h-control-md); height: var(--h-control-md); border-radius: var(--radius-circle);
  background: var(--surface-inverted); color: var(--text-on-inverted);
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-md);
}
`;
