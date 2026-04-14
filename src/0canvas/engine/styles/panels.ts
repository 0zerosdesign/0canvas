// ──────────────────────────────────────────────────────────
// Panel containers — shared panel base, headers, sections
// ──────────────────────────────────────────────────────────

export const panelsCSS = (S: string) => `
/* ── Engine ─────────────────────────────────────────────────── */
${S} .oc-engine-loading {
  height: 100%; display: flex; align-items: center; justify-content: center;
  background: var(--color--surface--0); color: var(--color--text--muted);
  font-size: var(--font-size-sm); font-family: var(--font-sans);
}
${S} .oc-toggle-btn {
  position: fixed; width: 44px; height: 44px; border-radius: 12px;
  border: 1px solid var(--color--border--on-surface-0); background: var(--color--surface--floor);
  color: var(--color--text--on-surface); cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: all 0.2s ease; box-shadow: var(--shadow-lg);
  font-size: 0; padding: 0; outline: none;
}
${S} .oc-toggle-btn:hover { background: var(--color--surface--1); transform: scale(1.05); }
${S} .oc-close-btn {
  position: absolute; top: 14px; right: 14px; width: 28px; height: 28px;
  border-radius: 8px; border: 1px solid var(--color--border--on-surface-1);
  background: var(--color--surface--1); color: var(--color--text--muted);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: var(--font-size-sm); transition: all 0.15s ease;
  padding: 0; outline: none;
}
${S} .oc-close-btn:hover { color: var(--color--text--on-surface); border-color: var(--color--border--on-surface-2); }

/* ── App Shell (sidebar + page) ────────────────────────────── */
${S} .oc-app-shell {
  height: 100%; display: flex; overflow: hidden;
}

/* ── Sidebar ──────────────────────────────────────────────── */
${S} .oc-sidebar {
  width: 48px; flex-shrink: 0; height: 100%;
  display: flex; flex-direction: column;
  align-items: center;
  background: var(--color--surface--floor);
  border-right: 1px solid var(--color--border--on-surface-0);
  padding: 8px 0;
  box-sizing: border-box;
}
${S} .oc-sidebar-top {
  display: flex; flex-direction: column;
  align-items: center; gap: 2px;
}
${S} .oc-sidebar-bottom {
  margin-top: auto;
  display: flex; flex-direction: column;
  align-items: center; gap: 4px;
  padding-bottom: 4px;
}
${S} .oc-sidebar-btn {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent;
  color: var(--color--text--muted);
  border-radius: 8px; cursor: pointer;
  transition: all 0.15s ease;
}
${S} .oc-sidebar-btn:hover {
  color: var(--color--text--on-surface);
  background: var(--color--surface--1);
}
${S} .oc-sidebar-btn.is-active {
  color: var(--color--text--on-surface);
  background: var(--color--surface--2);
}
${S} .oc-sidebar-divider {
  width: 24px; height: 1px;
  background: var(--color--border--on-surface-0);
  margin: 4px 0;
}
${S} .oc-sidebar-logo {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  color: var(--color--text--disabled);
  opacity: 0.5;
}

/* ── Workspace ───────────────────────────────────────────── */
${S} .oc-workspace {
  flex: 1; height: 100%; display: flex; flex-direction: column;
  background: var(--color--surface--0); overflow: hidden;
}
${S} .oc-workspace-main { flex: 1; display: flex; overflow: hidden; }
${S} .oc-workspace-center { flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden; }
${S} .oc-panel-slot { flex-shrink: 0; height: 100%; overflow: hidden; }
${S} .oc-panel-slot-bordered { flex-shrink: 0; border-left: 1px solid var(--color--border--on-surface-0); }

/* ── Resizable Panel ─────────────────────────────────────── */
${S} .oc-resize-handle {
  width: 5px; flex-shrink: 0; height: 100%;
  cursor: ew-resize; z-index: 10; display: flex;
  align-items: stretch; justify-content: center;
  background: transparent;
}
${S} .oc-resize-handle .oc-resize-line {
  width: 1px; height: 100%; background: var(--color--border--on-surface-1);
  transition: width 0.12s ease, background 0.12s ease;
  pointer-events: none;
}
${S} .oc-resize-handle:hover .oc-resize-line {
  width: 3px; background: var(--color--base--primary);
}

/* ── Panel (shared base) ───────────────────────────────────── */
${S} .oc-panel {
  height: 100%; display: flex; flex-direction: column;
  background: var(--color--surface--floor); font-family: var(--font-sans);
  overflow: hidden;
}
${S} .oc-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--color--border--on-surface-0);
  font-size: 12px; font-weight: 600; color: var(--color--text--on-surface);
}
${S} .oc-panel-title {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--color--text--on-surface-variant);
}
${S} .oc-panel-body { flex: 1; overflow-y: auto; overflow-x: auto; }
${S} .oc-panel-section {
  padding: 10px 14px; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-panel-empty {
  padding: 24px 14px; text-align: center;
  color: var(--color--text--muted); font-size: 12px;
}
${S} .oc-panel-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-radius: 4px;
  font-size: 11px; color: var(--color--text--muted);
  background: transparent; border: none; cursor: pointer;
  transition: all 0.15s ease;
}
${S} .oc-panel-btn:hover { background: rgba(255,255,255,0.04); color: var(--color--text--on-surface); }

/* ── Layers Panel ──────────────────────────────────────────── */
${S} .oc-layers-search {
  margin: 8px 10px; padding: 6px 10px;
  border-radius: 6px; border: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--0); color: var(--color--text--on-surface);
  font-size: 12px; width: calc(100% - 20px); outline: none;
}
${S} .oc-layers-search:focus { border-color: var(--color--outline--focus); }
${S} .oc-layers-search::placeholder { color: var(--color--text--disabled); }
${S} .oc-layers-row {
  display: flex; align-items: center; gap: 4px;
  height: 26px; padding: 0 10px; cursor: pointer;
  font-size: 12px; color: var(--color--text--on-surface-variant);
  transition: background 0.1s ease;
  min-width: max-content;
}
${S} .oc-layers-row:hover { background: rgba(255,255,255,0.03); }
${S} .oc-layers-row.is-selected {
  background: rgba(37,99,235,0.08);
  color: var(--color--text--on-surface);
}
${S} .oc-layers-row.is-hovered-element {
  background: rgba(37,99,235,0.05);
}
${S} .oc-layers-tag-icon {
  width: 14px; height: 14px; display: flex;
  align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; border-radius: 3px;
  flex-shrink: 0;
}
${S} .oc-layers-toggle {
  width: 14px; height: 14px; display: flex;
  align-items: center; justify-content: center;
  cursor: pointer; color: var(--color--text--disabled); flex-shrink: 0;
}
${S} .oc-layers-toggle:hover { color: var(--color--text--on-surface-variant); }
${S} .oc-layers-name { flex: 1; white-space: nowrap; }
${S} .oc-layers-actions {
  display: none; align-items: center; gap: 2px;
}
${S} .oc-layers-row:hover .oc-layers-actions { display: flex; }
${S} .oc-layers-action-btn {
  width: 18px; height: 18px; display: flex;
  align-items: center; justify-content: center;
  border-radius: 3px; cursor: pointer; color: var(--color--text--disabled);
  background: transparent; border: none;
}
${S} .oc-layers-action-btn:hover { background: rgba(255,255,255,0.06); color: var(--color--text--on-surface-variant); }
`;
