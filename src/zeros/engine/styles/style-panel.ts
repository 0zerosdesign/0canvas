// ──────────────────────────────────────────────────────────
// Style Panel — property rows, sections, tabs, computed view, code view
// ──────────────────────────────────────────────────────────

export const stylePanelCSS = (S: string) => `
/* ── Style Panel ───────────────────────────────────────────── */
${S} .oc-style-tabs {
  display: flex; border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-style-tab {
  flex: 1; padding: var(--space-2) 0; font-size: var(--text-11); font-weight: var(--weight-control);
  text-align: center; color: var(--text-muted);
  background: transparent; border: none; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all var(--dur-fast) var(--ease-standard);
}
${S} .oc-style-tab:hover { color: var(--text-primary); }
${S} .oc-style-tab.is-active {
  color: var(--text-primary); border-bottom-color: var(--accent);
}
${S} .oc-style-property {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-1) var(--space-7x); font-size: var(--text-12);
}
${S} .oc-style-property:hover { background: var(--tint-hover); }
${S} .oc-style-prop-name { color: var(--text-muted); min-width: 100px; }
${S} .oc-style-swatch {
  width: 14px; height: 14px; border-radius: var(--radius-xs);
  border: 1px solid var(--border-default); display: inline-block;
  vertical-align: middle; margin-right: var(--space-3x);
}
${S} .oc-style-input {
  background: var(--surface-1); border: 1px solid var(--border-default);
  border-radius: var(--radius-xs); padding: var(--space-1) var(--space-2); color: var(--text-primary);
  font-size: var(--text-12); font-family: var(--font-mono); outline: none;
  width: 100%;
}
${S} .oc-style-input:focus { border-color: var(--ring-focus); }
${S} .oc-style-tag-badge {
  font-size: var(--text-12); color: var(--text-primary);
  background: var(--tint-accent-weak);
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-xs); font-family: var(--font-mono);
}
${S} .oc-style-class-badge {
  font-size: var(--text-10); color: var(--text-muted);
  background: var(--surface-1); padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-xs); border: 1px solid var(--border-subtle);
  font-family: var(--font-mono);
}
${S} .oc-style-class-overflow { font-size: var(--text-10); color: var(--text-muted); }
${S} .oc-style-prop-count { font-size: var(--text-11); color: var(--text-muted); }
${S} .oc-style-section-btn {
  display: flex; align-items: center; width: 100%;
  padding: var(--space-1) 0; background: transparent; border: none;
  cursor: pointer; color: var(--text-primary); font-size: var(--text-12);
  transition: background var(--dur-fast) var(--ease-standard);
}
${S} .oc-style-section-btn:hover { background: var(--tint-hover); }
${S} .oc-style-section-icon { margin-right: var(--space-3x); display: inline-flex; }
${S} .oc-style-section-name { font-size: var(--text-12); font-weight: 450; }
${S} .oc-style-section-count { margin-left: auto; font-size: var(--text-10); color: var(--text-muted); }
${S} .oc-style-code-block {
  font-size: var(--text-11); color: var(--text-primary); background: var(--surface-1);
  padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);
  overflow-x: auto; white-space: pre; font-family: var(--font-mono);
}
${S} .oc-style-syntax-comment { color: var(--syntax-comment); }
${S} .oc-style-syntax-selector { color: var(--syntax-selector); }
${S} .oc-style-syntax-property { color: var(--syntax-property); }
${S} .oc-style-syntax-value { color: var(--syntax-value); }
${S} .oc-style-empty-icon { margin: 0 auto var(--space-3); display: block; }
${S} .oc-style-prop-value-wrap {
  flex: 1; display: flex; align-items: center; gap: var(--space-3x);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-click-value {
  flex: 1; color: var(--text-primary); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; cursor: text;
}
${S} .oc-style-section-children { padding-bottom: var(--space-1); }
${S} .oc-style-empty-centered {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: var(--space-6) var(--space-7x); text-align: center; color: var(--text-muted); font-size: var(--text-12);
}
${S} .oc-style-header-col {
  display: flex; flex-direction: column; align-items: stretch;
  padding: var(--space-5x) var(--space-7x); border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-style-header-row {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);
}
${S} .oc-style-header-meta {
  display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);
}
${S} .oc-style-class-list { display: flex; flex-wrap: wrap; gap: var(--space-1); }
${S} .oc-style-tab-content { padding: var(--space-3); }
${S} .oc-style-sub-hint { font-size: var(--text-11); margin-top: var(--space-1); }
${S} .oc-style-chevron { margin-right: var(--space-3x); }
`;
