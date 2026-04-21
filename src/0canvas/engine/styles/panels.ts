// ──────────────────────────────────────────────────────────
// Panel containers — shared panel base, headers, sections
// ──────────────────────────────────────────────────────────

export const panelsCSS = (S: string) => `
/* ── Engine ─────────────────────────────────────────────────── */
${S} .oc-engine-loading {
  height: 100%; display: flex; align-items: center; justify-content: center;
  background: var(--surface-0); color: var(--text-muted);
  font-size: var(--text-13); font-family: var(--font-ui);
}
${S} .oc-toggle-btn {
  position: fixed; width: 44px; height: 44px; border-radius: 12px;
  border: 1px solid var(--border-subtle); background: var(--surface-floor);
  color: var(--text-on-surface); cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: all 0.2s ease; box-shadow: var(--shadow-lg);
  font-size: 0; padding: 0; outline: none;
}
${S} .oc-toggle-btn:hover { background: var(--surface-1); transform: scale(1.05); }

/* ── App Shell (page tabs + page) ──────────────────────────── */
${S} .oc-app-shell {
  height: 100%; display: flex; flex-direction: column; overflow: hidden;
}

/* ── Page tabs (horizontal — Design / Themes) ─────────────── */
${S} .oc-page-tabs {
  display: flex; align-items: center; gap: 2px;
  padding: 10px 10px 4px;
  flex-shrink: 0;
  background: var(--surface-floor);
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-page-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: transparent; border: none; border-radius: 6px;
  color: var(--text-muted);
  font-size: 12px; font-weight: 500;
  cursor: pointer; white-space: nowrap;
  font-family: inherit;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-page-tab:hover {
  color: var(--text-on-surface);
  background: var(--tint-hover);
}
${S} .oc-page-tab.is-active {
  color: var(--text-on-surface);
  background: var(--tint-active);
}
${S} .oc-page-tab--close { margin-right: 4px; }

/* ── Workspace ───────────────────────────────────────────── */
${S} .oc-workspace {
  flex: 1; height: 100%; display: flex; flex-direction: column;
  background: var(--surface-0); overflow: hidden;
}
${S} .oc-workspace-main { flex: 1; display: flex; overflow: hidden; }
${S} .oc-workspace-center { flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden; }
${S} .oc-panel-slot { flex-shrink: 0; height: 100%; overflow: hidden; }

/* ── Resizable Panel ─────────────────────────────────────── */
${S} .oc-resize-handle {
  width: 5px; flex-shrink: 0; height: 100%;
  cursor: ew-resize; z-index: 10; display: flex;
  align-items: stretch; justify-content: center;
  background: transparent;
}
${S} .oc-resize-handle .oc-resize-line {
  width: 1px; height: 100%; background: var(--border-default);
  transition: width 0.12s ease, background 0.12s ease;
  pointer-events: none;
}
${S} .oc-resize-handle:hover .oc-resize-line {
  width: 3px; background: var(--primary);
}

/* ── Panel (shared base) ───────────────────────────────────── */
${S} .oc-panel {
  height: 100%; display: flex; flex-direction: column;
  background: var(--surface-floor); font-family: var(--font-ui);
  overflow: hidden;
}
${S} .oc-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--border-subtle);
  font-size: 12px; font-weight: 600; color: var(--text-on-surface);
}
${S} .oc-panel-title {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-on-surface-variant);
}
${S} .oc-panel-body { flex: 1; overflow-y: auto; overflow-x: auto; }
${S} .oc-panel-section {
  padding: 10px 14px; border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-panel-empty {
  padding: 24px 14px; text-align: center;
  color: var(--text-muted); font-size: 12px;
}

/* ── Layers Panel ──────────────────────────────────────────── */
`;
