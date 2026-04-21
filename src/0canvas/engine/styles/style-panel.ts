// ──────────────────────────────────────────────────────────
// Style Panel — property rows, sections, tabs, computed view, code view
// ──────────────────────────────────────────────────────────

export const stylePanelCSS = (S: string) => `
/* ── Style Panel ───────────────────────────────────────────── */
${S} .oc-style-tabs {
  display: flex; border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-style-tab {
  flex: 1; padding: 8px 0; font-size: 11px; font-weight: 500;
  text-align: center; color: var(--text-muted);
  background: transparent; border: none; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all 0.15s ease;
}
${S} .oc-style-tab:hover { color: var(--text-on-surface); }
${S} .oc-style-tab.is-active {
  color: var(--text-on-surface); border-bottom-color: var(--primary);
}
${S} .oc-style-property {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 14px; font-size: 12px;
}
${S} .oc-style-property:hover { background: var(--tint-hover); }
${S} .oc-style-prop-name { color: var(--text-muted); min-width: 100px; }
${S} .oc-style-swatch {
  width: 14px; height: 14px; border-radius: 4px;
  border: 1px solid var(--border-default); display: inline-block;
  vertical-align: middle; margin-right: 6px;
}
${S} .oc-style-input {
  background: var(--surface-1); border: 1px solid var(--border-default);
  border-radius: 4px; padding: 4px 8px; color: var(--text-on-surface);
  font-size: 12px; font-family: var(--font-mono); outline: none;
  width: 100%;
}
${S} .oc-style-input:focus { border-color: var(--ring); }
${S} .oc-style-tag-badge {
  font-size: var(--text-12); color: var(--text-primary);
  background: var(--tint-primary-weak);
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-xs); font-family: var(--font-mono);
}
${S} .oc-style-class-badge {
  font-size: var(--text-10); color: var(--text-on-surface-variant);
  background: var(--surface-1); padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-xs); border: 1px solid var(--border-subtle);
  font-family: var(--font-mono);
}
${S} .oc-style-class-overflow { font-size: 10px; color: var(--text-muted); }
${S} .oc-style-prop-count { font-size: 11px; color: var(--text-on-surface-variant); }
${S} .oc-style-section-btn {
  display: flex; align-items: center; width: 100%;
  padding: 4px 0; background: transparent; border: none;
  cursor: pointer; color: var(--text-on-surface); font-size: 12px;
  transition: background 0.1s ease;
}
${S} .oc-style-section-btn:hover { background: var(--tint-hover); }
${S} .oc-style-section-icon { margin-right: 6px; display: inline-flex; }
${S} .oc-style-section-name { font-size: 12px; font-weight: 450; }
${S} .oc-style-section-count { margin-left: auto; font-size: 10px; color: var(--text-muted); }
${S} .oc-style-code-block {
  font-size: 11px; color: var(--text-on-surface); background: var(--surface-1);
  padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);
  overflow-x: auto; white-space: pre; font-family: var(--font-mono);
}
${S} .oc-style-syntax-comment { color: var(--syntax-comment); }
${S} .oc-style-syntax-selector { color: var(--syntax-selector); }
${S} .oc-style-syntax-property { color: var(--syntax-property); }
${S} .oc-style-syntax-value { color: var(--syntax-value); }
${S} .oc-style-empty-icon { margin: 0 auto 12px; display: block; }
${S} .oc-style-prop-value-wrap {
  flex: 1; display: flex; align-items: center; gap: 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-click-value {
  flex: 1; color: var(--text-on-surface); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; cursor: text;
}
${S} .oc-style-section-children { padding-bottom: 4px; }
${S} .oc-style-empty-centered {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 24px 14px; text-align: center; color: var(--text-muted); font-size: 12px;
}
${S} .oc-style-header-col {
  display: flex; flex-direction: column; align-items: stretch;
  padding: 10px 14px; border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-style-header-row {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
}
${S} .oc-style-header-meta {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
${S} .oc-style-class-list { display: flex; flex-wrap: wrap; gap: 4px; }
${S} .oc-style-tab-content { padding: 12px; }
${S} .oc-style-sub-hint { font-size: 11px; margin-top: 4px; }
${S} .oc-style-chevron { margin-right: 6px; }
`;
