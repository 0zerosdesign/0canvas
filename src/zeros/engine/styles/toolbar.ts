// ──────────────────────────────────────────────────────────
// Toolbar — workspace toolbar and project dropdown
// ──────────────────────────────────────────────────────────

export const toolbarCSS = (S: string) => `
/* ── Toolbar ────────────────────────────────────────────────── */
${S} .oc-toolbar {
  height: 48px; display: flex; align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4); gap: var(--space-3x); flex-shrink: 0;
  background: var(--surface-floor); border-bottom: 1px solid var(--border-subtle);
  font-family: var(--font-ui); font-size: var(--text-13);
  color: var(--text-primary); user-select: none;
}
${S} .oc-toolbar-section { display: flex; align-items: center; gap: var(--space-3); }
${S} .oc-toolbar-section-actions { display: flex; align-items: center; gap: var(--space-2); }
${S} .oc-toolbar-group { display: flex; align-items: center; gap: var(--space-hair); }
${S} .oc-toolbar-group.is-pill {
  background: var(--surface-0); border-radius: var(--radius-md);
  padding: var(--space-1); border: 1px solid var(--border-subtle);
}
${S} .oc-toolbar-group.is-pill-sm {
  background: var(--surface-0); border-radius: var(--radius-sm);
  padding: var(--space-1); border: 1px solid var(--border-subtle);
}
${S} .oc-toolbar-divider { width: 1px; height: 20px; background: var(--border-subtle); }
${S} .oc-toolbar-btn {
  display: inline-flex; align-items: center; gap: var(--space-3x);
  padding: var(--space-3x) var(--space-5x); border-radius: var(--radius-sm);
  font-size: var(--text-12); font-weight: var(--weight-control); color: var(--text-muted);
  background: transparent; border: none; cursor: pointer;
  transition: all var(--dur-fast) var(--ease-standard); white-space: nowrap;
}
${S} .oc-toolbar-btn:hover { background: var(--tint-hover); color: var(--text-primary); }
${S} .oc-toolbar-btn.is-active { background: var(--surface-1); color: var(--text-primary); }
${S} .oc-toolbar-badge {
  font-size: var(--text-10); font-weight: var(--weight-heading);
  background: var(--tint-active); color: var(--text-primary);
  padding: 1px var(--space-1); border-radius: var(--radius-xs); line-height: 14px;
}
${S} .oc-toolbar-logo {
  display: flex; align-items: center; gap: var(--space-2);
}
${S} .oc-toolbar-logo-icon {
  width: 26px; height: 26px; border-radius: var(--radius-sm);
  background: var(--surface-inverted); display: flex;
  align-items: center; justify-content: center;
}
${S} .oc-toolbar-logo-text {
  font-size: var(--text-13); font-weight: var(--weight-control); letter-spacing: -0.01em;
}
${S} .oc-toolbar-conn-dot {
  width: 5px; height: 5px; border-radius: var(--radius-circle);
  background: var(--text-success);
}
${S} .oc-toolbar-dropdown {
  position: absolute; top: 100%; left: 0; margin-top: var(--space-3x);
  background: var(--surface-floor); border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
  z-index: var(--z-modal); overflow: hidden;
}
${S} .oc-toolbar-dropdown-inputrow {
  padding: var(--space-2) var(--space-5x); border-bottom: 1px solid var(--border-subtle);
  display: flex; gap: var(--space-3x);
}
${S} .oc-toolbar-dropdown-list { max-height: 180px; overflow-y: auto; }
${S} .oc-toolbar-dropdown-list.is-tall { max-height: 200px; }
${S} .oc-toolbar-dropdown-empty {
  padding: var(--space-4); text-align: center; color: var(--text-disabled); font-size: var(--text-11);
}
${S} .oc-toolbar-project-trigger {
  display: flex; align-items: center; gap: var(--space-3x);
  padding: var(--space-1) var(--space-5x); border-radius: var(--radius-sm);
  background: var(--surface-0);
  border: 1px solid var(--border-subtle); cursor: pointer;
}
${S} .oc-toolbar-project-trigger:hover { border-color: var(--border-default); }
${S} .oc-toolbar-project-dot {
  width: 6px; height: 6px; border-radius: var(--radius-circle);
}
${S} .oc-toolbar-project-dot.is-saved { background: var(--text-success); }
${S} .oc-toolbar-project-dot.is-unsaved { background: var(--text-warning); }
${S} .oc-toolbar-project-input {
  width: 100px; padding: 1px var(--space-1);
  background: var(--surface-1); border: 1px solid var(--border-default);
  border-radius: var(--radius-xs); color: var(--text-primary);
  font-size: var(--text-12); outline: none;
}
${S} .oc-toolbar-project-name {
  font-size: var(--text-12); max-width: 120px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary);
}
${S} .oc-toolbar-project-unsaved {
  font-size: var(--text-10); color: var(--text-warning); font-style: italic;
}
${S} .oc-toolbar-project-save-btn {
  flex: 1; display: flex; align-items: center; justify-content: center;
  gap: 5px; padding: var(--space-3x) 0; background: var(--accent);
  border: none; border-radius: var(--radius-sm); color: var(--text-on-accent);
  font-size: var(--text-11); font-weight: var(--weight-control); cursor: pointer;
}
${S} .oc-toolbar-project-save-btn:hover { background: var(--accent-hover); }
${S} .oc-toolbar-project-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-2) var(--space-7x); background: transparent;
  border-left: 2px solid transparent;
  cursor: pointer; transition: all var(--dur-fast) var(--ease-standard);
}
${S} .oc-toolbar-project-item:hover { background: var(--tint-hover); }
${S} .oc-toolbar-project-item.is-active {
  background: var(--accent-soft-bg);
  border-left-color: var(--accent);
}
${S} .oc-toolbar-project-item-name {
  font-size: var(--text-12); color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-toolbar-project-item.is-active .oc-toolbar-project-item-name {
  color: var(--text-primary);
}
${S} .oc-toolbar-project-item-meta {
  font-size: var(--text-10); color: var(--text-disabled); margin-top: var(--space-hair);
}
${S} .oc-toolbar-project-delete {
  background: none; border: none; cursor: pointer;
  padding: var(--space-hair); color: var(--text-critical);
  display: none;
}
${S} .oc-toolbar-project-item:hover .oc-toolbar-project-delete {
  display: block;
}
`;
