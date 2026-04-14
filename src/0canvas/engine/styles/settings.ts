// ──────────────────────────────────────────────────────────
// Settings Page — navigation, content area
// ──────────────────────────────────────────────────────────

export const settingsCSS = (S: string) => `
/* ── Settings Page ────────────────────────────────────────── */
${S} .oc-settings-page {
  flex: 1; display: flex; height: 100%;
  background: var(--color--surface--0);
  overflow: hidden;
}
${S} .oc-settings-nav {
  width: 220px; flex-shrink: 0; height: 100%;
  border-right: 1px solid var(--color--border--on-surface-0);
  padding: 16px 0;
  overflow-y: auto;
}
${S} .oc-settings-nav-header {
  font-size: 18px; font-weight: 600;
  color: var(--color--text--on-surface);
  padding: 0 16px; margin-bottom: 16px;
}
${S} .oc-settings-nav-list {
  display: flex; flex-direction: column; gap: 2px;
  padding: 0 8px;
}
${S} .oc-settings-nav-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 8px 10px;
  border: none; background: transparent;
  border-radius: 8px; cursor: pointer;
  color: var(--color--text--muted);
  font-size: 13px; text-align: left;
  transition: all 0.15s ease;
}
${S} .oc-settings-nav-item:hover {
  background: var(--color--surface--1);
  color: var(--color--text--on-surface);
}
${S} .oc-settings-nav-item.is-active {
  background: var(--color--surface--2);
  color: var(--color--text--on-surface);
}
${S} .oc-settings-nav-icon {
  display: flex; align-items: center;
  color: inherit; flex-shrink: 0;
}
${S} .oc-settings-nav-label { flex: 1; }
${S} .oc-settings-nav-chevron {
  color: var(--color--text--disabled);
  flex-shrink: 0; opacity: 0;
  transition: opacity 0.15s ease;
}
${S} .oc-settings-nav-item:hover .oc-settings-nav-chevron,
${S} .oc-settings-nav-item.is-active .oc-settings-nav-chevron { opacity: 1; }
${S} .oc-settings-content {
  flex: 1; height: 100%; overflow: hidden;
}
${S} .oc-settings-scroll {
  height: 100%; max-width: 720px;
  margin: 0 auto; padding: 24px 32px;
}
`;
