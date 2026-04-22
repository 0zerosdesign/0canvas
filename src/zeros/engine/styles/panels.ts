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
  position: fixed; width: 44px; height: 44px; border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle); background: var(--surface-floor);
  color: var(--text-primary); cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: all var(--dur-base) var(--ease-standard); box-shadow: var(--shadow-lg);
  font-size: 0; padding: 0; outline: none;
}
${S} .oc-toggle-btn:hover { background: var(--surface-1); transform: scale(1.05); }

/* ── App Shell (page tabs + page) ──────────────────────────── */
${S} .oc-app-shell {
  height: 100%; display: flex; flex-direction: column; overflow: hidden;
}

/* ── Page tabs (horizontal — Design / Themes) ─────────────── */
${S} .oc-page-tabs {
  display: flex; align-items: center; gap: var(--space-hair);
  padding: var(--space-5x) var(--space-5x) var(--space-1);
  flex-shrink: 0;
  background: var(--surface-floor);
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-page-tab {
  display: inline-flex; align-items: center; gap: var(--space-3x);
  padding: var(--space-3x) var(--space-5x);
  background: transparent; border: none; border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--text-12); font-weight: var(--weight-control);
  cursor: pointer; white-space: nowrap;
  font-family: inherit;
  transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
${S} .oc-page-tab:hover {
  color: var(--text-primary);
  background: var(--tint-hover);
}
${S} .oc-page-tab.is-active {
  color: var(--text-primary);
  background: var(--tint-active);
}
${S} .oc-page-tab--close { margin-right: var(--space-1); }

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
  cursor: ew-resize; z-index: var(--z-panel); display: flex;
  align-items: stretch; justify-content: center;
  background: transparent;
}
${S} .oc-resize-handle .oc-resize-line {
  width: 1px; height: 100%; background: var(--border-default);
  transition: width var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard);
  pointer-events: none;
}
${S} .oc-resize-handle:hover .oc-resize-line {
  width: 3px; background: var(--accent);
}

/* ── Panel (shared base) ───────────────────────────────────── */
${S} .oc-panel {
  height: 100%; display: flex; flex-direction: column;
  background: var(--surface-floor); font-family: var(--font-ui);
  overflow: hidden;
}
${S} .oc-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-5x) var(--space-7x); border-bottom: 1px solid var(--border-subtle);
  font-size: var(--text-12); font-weight: var(--weight-heading); color: var(--text-primary);
}
${S} .oc-panel-title {
  font-size: var(--text-11); font-weight: var(--weight-heading); text-transform: uppercase;
  letter-spacing: var(--tracking-overline); color: var(--text-muted);
}
${S} .oc-panel-body { flex: 1; overflow-y: auto; overflow-x: auto; }
${S} .oc-panel-section {
  padding: var(--space-5x) var(--space-7x); border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-panel-empty {
  padding: var(--space-6) var(--space-7x); text-align: center;
  color: var(--text-muted); font-size: var(--text-12);
}

/* ── Layers Panel ──────────────────────────────────────────── */
`;
