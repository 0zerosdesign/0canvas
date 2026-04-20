// ──────────────────────────────────────────────────────────
// Style Panel — property rows, sections, tabs, computed view, code view
// ──────────────────────────────────────────────────────────

export const stylePanelCSS = (S: string) => `
/* ── Style Panel ───────────────────────────────────────────── */
${S} .oc-style-tabs {
  display: flex; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-style-tab {
  flex: 1; padding: 8px 0; font-size: 11px; font-weight: 500;
  text-align: center; color: var(--color--text--muted);
  background: transparent; border: none; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all 0.15s ease;
}
${S} .oc-style-tab:hover { color: var(--color--text--on-surface); }
${S} .oc-style-tab.is-active {
  color: var(--color--text--on-surface); border-bottom-color: var(--color--outline--on-background);
}
${S} .oc-style-property {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 14px; font-size: 12px;
}
${S} .oc-style-property:hover { background: rgba(255,255,255,0.02); }
${S} .oc-style-prop-name { color: var(--color--text--muted); min-width: 100px; }
${S} .oc-style-prop-value {
  color: var(--color--text--on-surface); text-align: right; flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-swatch {
  width: 14px; height: 14px; border-radius: 3px;
  border: 1px solid var(--color--border--on-surface-1); display: inline-block;
  vertical-align: middle; margin-right: 6px;
}
${S} .oc-style-input {
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  border-radius: 4px; padding: 4px 8px; color: var(--color--text--on-surface);
  font-size: 12px; font-family: var(--font-mono); outline: none;
  width: 100%;
}
${S} .oc-style-input:focus { border-color: var(--color--outline--focus); }
${S} .oc-style-boxmodel {
  margin: 12px 14px; padding: 20px; border-radius: 8px;
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  font-family: var(--font-mono); font-size: 11px;
  color: var(--color--text--on-surface-variant); text-align: center;
}
${S} .oc-style-boxmodel-margin {
  background: rgba(255,152,0,0.13); border: 1px solid rgba(255,152,0,0.25);
  border-radius: 8px; padding: 12px; text-align: center;
}
${S} .oc-style-boxmodel-margin-label { font-size: 10px; color: #ff9800; margin-bottom: 4px; }
${S} .oc-style-boxmodel-padding {
  background: rgba(76,175,80,0.13); border: 1px solid rgba(76,175,80,0.25);
  border-radius: 6px; padding: 12px;
}
${S} .oc-style-boxmodel-padding-label { font-size: 10px; color: #4caf50; margin-bottom: 4px; }
${S} .oc-style-boxmodel-content {
  background: rgba(33,150,243,0.13); border: 1px solid rgba(33,150,243,0.25);
  border-radius: 4px; padding: 8px;
}
${S} .oc-style-boxmodel-content-label { font-size: 11px; color: #2196f3; }
${S} .oc-style-boxmodel-dim { font-size: 10px; opacity: 0.6; margin-left: 4px; }
${S} .oc-style-tag-badge {
  font-size: 12px; color: var(--color--text--primary);
  background: rgba(37,99,235,0.09); padding: 2px 8px;
  border-radius: 4px; font-family: var(--font-mono);
}
${S} .oc-style-class-badge {
  font-size: 10px; color: var(--color--text--on-surface-variant);
  background: var(--color--surface--1); padding: 2px 6px;
  border-radius: 3px; border: 1px solid var(--color--border--on-surface-0);
  font-family: var(--font-mono);
}
${S} .oc-style-class-overflow { font-size: 10px; color: var(--color--text--muted); }
${S} .oc-style-prop-count { font-size: 11px; color: var(--color--text--on-surface-variant); }
${S} .oc-style-section-btn {
  display: flex; align-items: center; width: 100%;
  padding: 4px 0; background: transparent; border: none;
  cursor: pointer; color: var(--color--text--on-surface); font-size: 12px;
  transition: background 0.1s ease;
}
${S} .oc-style-section-btn:hover { background: rgba(255,255,255,0.02); }
${S} .oc-style-section-icon { margin-right: 6px; display: inline-flex; }
${S} .oc-style-section-name { font-size: 12px; font-weight: 450; }
${S} .oc-style-section-count { margin-left: auto; font-size: 10px; color: var(--color--text--muted); }
${S} .oc-style-label {
  display: block; font-size: 11px; color: var(--color--text--muted); margin-bottom: 6px;
}
${S} .oc-style-code-block {
  font-size: 11px; color: var(--color--text--on-surface); background: var(--color--surface--1);
  padding: 12px; border-radius: 8px; border: 1px solid var(--color--border--on-surface-0);
  overflow-x: auto; white-space: pre; font-family: var(--font-mono);
}
${S} .oc-style-selector-code {
  font-size: 11px; color: var(--color--status--success); background: var(--color--surface--1);
  padding: 6px 10px; border-radius: 6px; display: block;
  border: 1px solid var(--color--border--on-surface-0); word-break: break-all;
  font-family: var(--font-mono);
}
${S} .oc-style-computed-row {
  display: flex; align-items: center; padding: 3px 0;
  font-size: 10px; border-bottom: 1px solid var(--color--border--on-surface-0);
  font-family: var(--font-mono);
}
${S} .oc-style-computed-name {
  color: var(--color--text--muted); width: 110px; flex-shrink: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-syntax-comment { color: var(--color--syntax--comment); }
${S} .oc-style-syntax-selector { color: var(--color--syntax--selector); }
${S} .oc-style-syntax-property { color: var(--color--syntax--property); }
${S} .oc-style-syntax-value { color: var(--color--syntax--value); }
${S} .oc-style-empty-icon { margin: 0 auto 12px; display: block; }
${S} .oc-style-prop-value-wrap {
  flex: 1; display: flex; align-items: center; gap: 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-click-value {
  flex: 1; color: var(--color--text--on-surface); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; cursor: text;
}
${S} .oc-style-section-children { padding-bottom: 4px; }
${S} .oc-style-empty-centered {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 24px 14px; text-align: center; color: var(--color--text--muted); font-size: 12px;
}
${S} .oc-style-header-col {
  display: flex; flex-direction: column; align-items: stretch;
  padding: 10px 14px; border-bottom: 1px solid var(--color--border--on-surface-0);
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
${S} .oc-style-selector-block { margin-bottom: 12px; }
${S} .oc-style-chevron { margin-right: 6px; }
`;
