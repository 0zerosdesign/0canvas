// ──────────────────────────────────────────────────────────
// Canvas — source node, variant node, resize handles, variant canvas
// ──────────────────────────────────────────────────────────

export const canvasCSS = (S: string) => `
/* ── Canvas Nodes ──────────────────────────────────────────── */
${S} .oc-source-chrome {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3); background: var(--surface-0);
  border-bottom: 1px solid var(--border-subtle);
  border-radius: var(--radius-md) var(--space-5x) 0 0; user-select: none;
}
${S} .oc-source-url {
  flex: 1; padding: var(--space-1) var(--space-5x); border-radius: var(--radius-sm);
  background: var(--surface-1); color: var(--text-muted);
  font-size: var(--text-11); font-family: var(--font-mono);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-source-btn {
  display: flex; align-items: center; justify-content: center;
  width: var(--h-control-md); height: var(--h-control-md); border-radius: var(--radius-sm);
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); transition: all var(--dur-fast) var(--ease-standard);
}
${S} .oc-source-btn:hover { background: var(--surface-1); color: var(--text-primary); }
${S} .oc-source-btn.is-active { background: var(--accent); color: var(--text-on-accent); }
${S} .oc-source-badge {
  position: absolute; top: -2px; right: -2px;
  display: flex; align-items: center; justify-content: center;
  min-width: 14px; height: 14px; padding: 0 3px;
  border-radius: var(--radius-md);
  background: var(--surface-floor); color: var(--text-primary);
  font-size: 6px; font-weight: 700; line-height: 1;
  pointer-events: none; box-sizing: border-box;
  transform-origin: center; transform: scale(0.85);
}
${S} .oc-source-btn-group {
  display: flex; align-items: center;
  border-radius: var(--radius-sm);
}
${S} .oc-source-btn-group.has-items {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  gap: 0;
}
${S} .oc-source-btn-group.has-items .oc-source-btn {
  border-radius: var(--radius-md) 0 0 7px;
}
${S} .oc-source-btn-group.has-items .oc-source-send-btn {
  border-radius: 0 7px 7px 0;
  border-left: 1px solid var(--border-subtle);
  color: var(--text-muted);
}
${S} .oc-source-btn-group.has-items .oc-source-send-btn:hover {
  color: var(--text-primary);
  background: var(--surface-2);
}
${S} .oc-source-preset {
  padding: 3px var(--space-2); border-radius: var(--radius-xs); font-size: var(--text-10);
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); font-family: var(--font-mono);
  transition: all var(--dur-fast) var(--ease-standard);
}
${S} .oc-source-preset:hover { background: var(--surface-1); color: var(--text-primary); }
${S} .oc-source-preset.is-active { background: var(--accent); color: var(--text-on-accent); }

${S} .oc-variant-card {
  border-radius: 0; border: 1px solid var(--border-subtle);
  background: var(--surface-0); overflow: hidden;
  transition: border-color var(--dur-base) var(--ease-standard);
}
${S} .oc-variant-card:hover { border-color: var(--border-default); }
${S} .oc-variant-card.is-selected { border-color: var(--accent); border-width: 2.5px; }

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
  border-radius: var(--radius-xs);
  background: var(--border-default);
  pointer-events: none;
  transition: background var(--dur-base) var(--ease-standard), transform var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard);
}
${S} .oc-resize-handle-left,
${S} .oc-resize-handle-left,
${S} .oc-resize-handle-left,
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
${S} .oc-resize-zone-left:hover .oc-resize-handle,
${S} .oc-resize-zone-left:hover .oc-resize-handle,
${S} .oc-resize-zone-left:hover .oc-resize-handle,
${S} .oc-resize-zone-right:hover .oc-resize-handle {
  background: var(--text-muted);
  transform: scaleY(1.4);
  box-shadow: var(--shadow-sm);
}
${S} .oc-resize-zone-bottom:hover .oc-resize-handle {
  background: var(--text-muted);
  transform: scaleX(1.4);
  box-shadow: var(--shadow-sm);
}

/* Active (dragging) */
${S} .oc-resize-zone.is-active .oc-resize-handle {
  background: var(--text-muted) !important;
  box-shadow: var(--shadow-md) !important;
}
${S} .oc-resize-zone-left.is-active .oc-resize-handle,
${S} .oc-resize-zone-left.is-active .oc-resize-handle,
${S} .oc-resize-zone-left.is-active .oc-resize-handle,
${S} .oc-resize-zone-left.is-active .oc-resize-handle,
${S} .oc-resize-zone-right.is-active .oc-resize-handle {
  transform: scaleY(1.6) !important;
}
${S} .oc-resize-zone-bottom.is-active .oc-resize-handle {
  transform: scaleX(1.6) !important;
}
${S} .oc-variant-header {
  display: flex; align-items: center; gap: var(--space-3x);
  padding: var(--space-3x) var(--space-5x); background: var(--surface-0);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--text-12); user-select: none;
}
${S} .oc-variant-status {
  width: 8px; height: 8px; border-radius: var(--radius-circle); flex-shrink: 0;
}
${S} .oc-variant-name {
  flex: 1; color: var(--text-primary); font-weight: var(--weight-control);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-variant-actions {
  display: flex; align-items: center; gap: var(--space-hair);
}
${S} .oc-variant-action-btn {
  display: flex; align-items: center; justify-content: center;
  width: var(--h-control-sm); height: var(--h-control-sm); border-radius: var(--radius-xs);
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); transition: all var(--dur-fast) var(--ease-standard);
}
${S} .oc-variant-action-btn:hover { background: var(--surface-1); color: var(--text-primary); }

/* ── Variant Canvas ────────────────────────── */
${S} .oc-vc-root {
  width: 100%; height: 100%;
  background: var(--surface-1);
}
${S} .oc-vc-flow {
  background: var(--surface-1);
}
${S} .oc-vc-flow .react-flow__pane {
  background: var(--surface-1);
}
${S} .oc-vc-controls {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}
`;
