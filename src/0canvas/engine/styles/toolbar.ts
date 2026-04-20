// ──────────────────────────────────────────────────────────
// Toolbar — workspace toolbar and project dropdown
// ──────────────────────────────────────────────────────────

export const toolbarCSS = (S: string) => `
/* ── Toolbar ────────────────────────────────────────────────── */
${S} .oc-toolbar {
  height: 48px; display: flex; align-items: center;
  justify-content: space-between;
  padding: 0 16px; gap: 6px; flex-shrink: 0;
  background: var(--color--surface--floor); border-bottom: 1px solid var(--color--border--on-surface-0);
  font-family: var(--font-sans); font-size: 13px;
  color: var(--color--text--on-surface); user-select: none;
}
${S} .oc-toolbar-section { display: flex; align-items: center; gap: 12px; }
${S} .oc-toolbar-section-actions { display: flex; align-items: center; gap: 8px; }
${S} .oc-toolbar-group { display: flex; align-items: center; gap: 2px; }
${S} .oc-toolbar-group.is-pill {
  background: var(--color--surface--0); border-radius: 8px;
  padding: 3px; border: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-toolbar-group.is-pill-sm {
  background: var(--color--surface--0); border-radius: 6px;
  padding: 3px; border: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-toolbar-divider { width: 1px; height: 20px; background: var(--color--border--on-surface-0); }
${S} .oc-toolbar-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: 6px;
  font-size: 12px; font-weight: 450; color: var(--color--text--muted);
  background: transparent; border: none; cursor: pointer;
  transition: all 0.15s ease; white-space: nowrap;
}
${S} .oc-toolbar-btn:hover { background: rgba(255,255,255,0.04); color: var(--color--text--on-surface); }
${S} .oc-toolbar-btn.is-active { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-toolbar-badge {
  font-size: 10px; font-weight: 600;
  background: rgba(255,255,255,0.1); color: var(--color--text--on-surface);
  padding: 1px 5px; border-radius: 4px; line-height: 14px;
}
${S} .oc-toolbar-logo {
  display: flex; align-items: center; gap: 8px;
}
${S} .oc-toolbar-logo-icon {
  width: 26px; height: 26px; border-radius: 6px;
  background: var(--color--surface--inverted); display: flex;
  align-items: center; justify-content: center;
}
${S} .oc-toolbar-logo-text {
  font-size: 13px; font-weight: 500; letter-spacing: -0.01em;
}
${S} .oc-toolbar-mcp-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; padding: 2px 8px; border-radius: 4px;
}
${S} .oc-toolbar-mcp-badge.is-error {
  color: var(--color--status--error);
  background: rgba(239,68,68,0.1);
}
${S} .oc-toolbar-mcp-dot {
  width: 7px; height: 7px; border-radius: 50%;
}
${S} .oc-toolbar-mcp-dot.is-connected { background: var(--color--status--success); }
${S} .oc-toolbar-mcp-dot.is-disconnected { background: var(--color--text--disabled); }
${S} .oc-toolbar-conn-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--color--status--success);
}
${S} .oc-toolbar-dropdown {
  position: absolute; top: 100%; left: 0; margin-top: 6px;
  background: var(--color--surface--floor); border: 1px solid var(--color--border--on-surface-0);
  border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.5);
  z-index: 100; overflow: hidden;
}
${S} .oc-toolbar-dropdown-inputrow {
  padding: 8px 10px; border-bottom: 1px solid var(--color--border--on-surface-0);
  display: flex; gap: 6px;
}
${S} .oc-toolbar-dropdown-input {
  flex: 1; padding: 6px 10px;
  background: var(--color--surface--0);
  border: 1px solid var(--color--border--on-surface-0); border-radius: 6px;
  color: var(--color--text--on-surface); font-size: 12px;
  font-family: var(--font-mono); outline: none;
}
${S} .oc-toolbar-dropdown-input:focus { border-color: var(--color--outline--focus); }
${S} .oc-toolbar-dropdown-action {
  padding: 6px 14px; background: var(--color--base--primary);
  border: none; border-radius: 6px; color: var(--color--text--on-primary);
  font-size: 11px; font-weight: 500; cursor: pointer;
}
${S} .oc-toolbar-dropdown-action:hover { background: var(--color--base--primary-hover); }
${S} .oc-toolbar-dropdown-list { max-height: 180px; overflow-y: auto; }
${S} .oc-toolbar-dropdown-list.is-tall { max-height: 200px; }
${S} .oc-toolbar-dropdown-empty {
  padding: 16px; text-align: center; color: var(--color--text--disabled); font-size: 11px;
}
${S} .oc-toolbar-project-trigger {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 6px;
  background: var(--color--surface--0);
  border: 1px solid var(--color--border--on-surface-0); cursor: pointer;
}
${S} .oc-toolbar-project-trigger:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-toolbar-project-dot {
  width: 6px; height: 6px; border-radius: 50%;
}
${S} .oc-toolbar-project-dot.is-saved { background: var(--color--status--success); }
${S} .oc-toolbar-project-dot.is-unsaved { background: var(--color--status--warning); }
${S} .oc-toolbar-project-input {
  width: 100px; padding: 1px 4px;
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  border-radius: 3px; color: var(--color--text--on-surface);
  font-size: 12px; outline: none;
}
${S} .oc-toolbar-project-name {
  font-size: 12px; max-width: 120px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; color: var(--color--text--on-surface);
}
${S} .oc-toolbar-project-unsaved {
  font-size: 10px; color: var(--color--status--warning); font-style: italic;
}
${S} .oc-toolbar-project-save-btn {
  flex: 1; display: flex; align-items: center; justify-content: center;
  gap: 5px; padding: 6px 0; background: var(--color--base--primary);
  border: none; border-radius: 6px; color: var(--color--text--on-primary);
  font-size: 11px; font-weight: 500; cursor: pointer;
}
${S} .oc-toolbar-project-save-btn:hover { background: var(--color--base--primary-hover); }
${S} .oc-toolbar-project-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; background: transparent;
  border-left: 2px solid transparent;
  cursor: pointer; transition: all 0.1s ease;
}
${S} .oc-toolbar-project-item:hover { background: rgba(255,255,255,0.03); }
${S} .oc-toolbar-project-item.is-active {
  background: rgba(37,99,235,0.07);
  border-left-color: var(--color--outline--on-background);
}
${S} .oc-toolbar-project-item-name {
  font-size: 12px; color: var(--color--text--on-surface);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-toolbar-project-item.is-active .oc-toolbar-project-item-name {
  color: var(--color--text--primary);
}
${S} .oc-toolbar-project-item-meta {
  font-size: 10px; color: var(--color--text--disabled); margin-top: 2px;
}
${S} .oc-toolbar-project-delete {
  background: none; border: none; cursor: pointer;
  padding: 2px; color: var(--color--status--critical);
  display: none;
}
${S} .oc-toolbar-project-item:hover .oc-toolbar-project-delete {
  display: block;
}
`;
