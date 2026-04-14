// ──────────────────────────────────────────────────────────
// Canvas — source node, variant node, resize handles, variant canvas
// ──────────────────────────────────────────────────────────

export const canvasCSS = (S: string) => `
/* ── Canvas Nodes ──────────────────────────────────────────── */
${S} .oc-source-chrome {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: var(--color--surface--0);
  border-bottom: 1px solid var(--color--border--on-surface-0);
  border-radius: 10px 10px 0 0; user-select: none;
}
${S} .oc-source-traffic-dot { width: 10px; height: 10px; border-radius: 50%; }
${S} .oc-source-url {
  flex: 1; padding: 4px 10px; border-radius: 6px;
  background: var(--color--surface--1); color: var(--color--text--muted);
  font-size: 11px; font-family: var(--font-mono);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-source-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  background: transparent; border: none; cursor: pointer;
  color: var(--color--text--muted); transition: all 0.15s ease;
}
${S} .oc-source-btn:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-source-btn.is-active { background: var(--color--base--primary); color: var(--color--text--on-primary); }
${S} .oc-source-badge {
  position: absolute; top: -2px; right: -2px;
  display: flex; align-items: center; justify-content: center;
  min-width: 14px; height: 14px; padding: 0 3px;
  border-radius: 7px;
  background: var(--color--surface--floor); color: var(--color--text--on-surface);
  font-size: 6px; font-weight: 700; line-height: 1;
  pointer-events: none; box-sizing: border-box;
  transform-origin: center; transform: scale(0.85);
}
${S} .oc-source-btn-group {
  display: flex; align-items: center;
  border-radius: 6px;
}
${S} .oc-source-btn-group.has-items {
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-0);
  border-radius: 8px;
  gap: 0;
}
${S} .oc-source-btn-group.has-items .oc-source-btn {
  border-radius: 7px 0 0 7px;
}
${S} .oc-source-btn-group.has-items .oc-source-send-btn {
  border-radius: 0 7px 7px 0;
  border-left: 1px solid var(--color--border--on-surface-0);
  color: var(--color--text--muted);
}
${S} .oc-source-btn-group.has-items .oc-source-send-btn:hover {
  color: var(--color--text--on-surface);
  background: var(--color--surface--2);
}
${S} .oc-source-preset {
  padding: 3px 8px; border-radius: 4px; font-size: 10px;
  background: transparent; border: none; cursor: pointer;
  color: var(--color--text--muted); font-family: var(--font-mono);
  transition: all 0.15s ease;
}
${S} .oc-source-preset:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-source-preset.is-active { background: var(--color--base--primary); color: var(--color--text--on-primary); }

${S} .oc-variant-card {
  border-radius: 0; border: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--0); overflow: hidden;
  transition: border-color 0.2s ease;
}
${S} .oc-variant-card:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-variant-card.is-selected { border-color: var(--color--outline--on-background); border-width: 2.5px; }

/* ── Resize grab zones + visible handle bars (source node only) ── */

/* Grab zone — wide transparent area the user can grab */
${S} .oc-resize-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

/* Visible handle bar — thin bar inside the grab zone */
${S} .oc-resize-handle {
  border-radius: 3px;
  background: var(--color--border--on-surface-1);
  pointer-events: none;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}
${S} .oc-resize-handle-left,
${S} .oc-resize-handle-right {
  width: 4px;
  height: 48px;
}
${S} .oc-resize-handle-bottom {
  height: 4px;
  width: 48px;
}

/* Hover on the ZONE triggers the handle animation */
${S} .oc-resize-zone-left:hover .oc-resize-handle,
${S} .oc-resize-zone-right:hover .oc-resize-handle {
  background: var(--color--text--muted);
  transform: scaleY(1.4);
  box-shadow: 0 0 8px rgba(115,115,115,0.3);
}
${S} .oc-resize-zone-bottom:hover .oc-resize-handle {
  background: var(--color--text--muted);
  transform: scaleX(1.4);
  box-shadow: 0 0 8px rgba(115,115,115,0.3);
}

/* Active (dragging) */
${S} .oc-resize-zone.is-active .oc-resize-handle {
  background: var(--color--text--on-surface-variant) !important;
  box-shadow: 0 0 12px rgba(212,212,212,0.25) !important;
}
${S} .oc-resize-zone-left.is-active .oc-resize-handle,
${S} .oc-resize-zone-right.is-active .oc-resize-handle {
  transform: scaleY(1.6) !important;
}
${S} .oc-resize-zone-bottom.is-active .oc-resize-handle {
  transform: scaleX(1.6) !important;
}
${S} .oc-variant-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; background: var(--color--surface--0);
  border-bottom: 1px solid var(--color--border--on-surface-0);
  font-size: 12px; user-select: none;
}
${S} .oc-variant-status {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
${S} .oc-variant-name {
  flex: 1; color: var(--color--text--on-surface); font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-variant-actions {
  display: flex; align-items: center; gap: 2px;
}
${S} .oc-variant-action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 4px;
  background: transparent; border: none; cursor: pointer;
  color: var(--color--text--muted); transition: all 0.15s ease;
}
${S} .oc-variant-action-btn:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }

/* ── Variant Canvas ────────────────────────── */
${S} .oc-vc-root {
  width: 100%; height: 100%;
  background: var(--color--surface--1);
}
${S} .oc-vc-flow {
  background: var(--color--surface--1);
}
${S} .oc-vc-flow .react-flow__pane {
  background: var(--color--surface--1);
}
${S} .oc-vc-controls {
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-0);
  border-radius: 8px;
}
`;
