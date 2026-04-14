// ──────────────────────────────────────────────────────────
// Command Palette — overlay, input, item list
// ──────────────────────────────────────────────────────────

export const commandPaletteCSS = (S: string) => `
/* ── Command Palette ───────────────────────────────────────── */
${S} .oc-cmd-overlay {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 20vh; background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
}
${S} .oc-cmd-panel {
  width: 520px; border-radius: 12px;
  border: 1px solid var(--color--border--on-surface-0); background: var(--color--surface--floor);
  box-shadow: var(--shadow-2xl); overflow: hidden;
}
${S} .oc-cmd-input {
  width: 100%; padding: 14px 16px; border: none;
  background: transparent; color: var(--color--text--on-surface);
  font-size: 15px; font-family: var(--font-sans); outline: none;
}
${S} .oc-cmd-input::placeholder { color: var(--color--text--disabled); }
${S} .oc-cmd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; cursor: pointer;
  color: var(--color--text--on-surface-variant); font-size: 13px;
  transition: background 0.1s ease;
}
${S} .oc-cmd-item:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-cmd-item.is-active { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-cmd-kbd {
  padding: 2px 6px; border-radius: 4px; font-size: 10px;
  background: var(--color--surface--1); color: var(--color--text--muted);
  font-family: var(--font-mono);
}
`;
