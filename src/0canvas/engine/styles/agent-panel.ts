// ──────────────────────────────────────────────────────────
// Agent Panel — IDE cards, status badges, MCP setup, logs
// ──────────────────────────────────────────────────────────

export const agentPanelCSS = (S: string) => `
/* ── Agent Panel ───────────────────────────────────────────── */
${S} .oc-agent-ide-card {
  padding: 12px; border-radius: 10px;
  border: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--0); margin-bottom: 8px;
  transition: border-color 0.15s ease;
}
${S} .oc-agent-ide-card:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-agent-card-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
${S} .oc-agent-card-info {
  display: flex; align-items: center; gap: 10px;
}
${S} .oc-agent-card-icon {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; color: var(--color--text--on-primary);
}
${S} .oc-agent-card-name { font-size: 13px; color: var(--color--text--on-surface); }
${S} .oc-agent-card-desc { font-size: 10px; color: var(--color--text--muted); }
${S} .oc-agent-status-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; padding: 2px 8px; border-radius: 4px;
}
${S} .oc-agent-status-badge.is-connected {
  color: var(--color--status--success); background: rgba(16,185,129,0.08);
}
${S} .oc-agent-status-badge.is-connecting {
  color: var(--color--status--connecting); background: rgba(249,115,22,0.08);
}
${S} .oc-agent-status-badge.is-disconnected {
  color: var(--color--text--disabled); background: rgba(82,82,82,0.08);
}
${S} .oc-agent-status-dot {
  width: 6px; height: 6px; border-radius: 50%;
}
${S} .oc-agent-status-dot.is-connected { background: var(--color--status--success); }
${S} .oc-agent-status-dot.is-connecting { background: var(--color--status--connecting); }
${S} .oc-agent-status-dot.is-disconnected { background: var(--color--text--disabled); }
${S} .oc-agent-last-sync {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; color: var(--color--text--muted); margin-bottom: 10px;
}
${S} .oc-agent-code-block {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-radius: 8px;
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  cursor: pointer; transition: border-color 0.15s ease; margin-bottom: 10px;
}
${S} .oc-agent-code-block:hover { border-color: var(--color--border--on-surface-2); }
${S} .oc-agent-code-block code {
  font-family: var(--font-mono); font-size: 10px; color: var(--color--status--success);
}
${S} .oc-agent-btn-row { display: flex; gap: 8px; }
${S} .oc-agent-btn-secondary {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 6px 0; border: 1px solid var(--color--border--on-surface-0); border-radius: 8px;
  background: transparent; color: var(--color--text--muted);
  font-size: 11px; font-family: var(--font-sans); cursor: pointer;
  transition: all 0.15s ease;
}
${S} .oc-agent-btn-secondary:hover { border-color: var(--color--border--on-surface-1); color: var(--color--text--on-surface-variant); }
${S} .oc-agent-btn-primary {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 6px 0; border: none; border-radius: 8px;
  background: var(--color--base--primary); color: var(--color--text--on-primary);
  font-size: 11px; font-weight: 500; font-family: var(--font-sans); cursor: pointer;
  transition: all 0.15s ease;
}
${S} .oc-agent-btn-primary:hover { background: var(--color--base--primary-light); }
${S} .oc-agent-btn-primary.is-accent {
  background: var(--color--base--primary); color: var(--color--text--on-primary);
}
${S} .oc-agent-btn-primary.is-accent:hover { background: var(--color--base--primary-light); }
${S} .oc-agent-btn-primary.is-disabled {
  background: var(--color--surface--1); color: var(--color--text--disabled); cursor: default;
}
${S} .oc-agent-mcp-card {
  padding: 16px; border: 1px solid var(--color--border--on-surface-0); border-radius: 10px;
  background: var(--color--surface--0); margin-bottom: 12px;
}
${S} .oc-agent-mcp-url {
  font-size: 11px; color: var(--color--text--muted); margin-bottom: 8px;
}
${S} .oc-agent-mcp-url code { font-family: var(--font-mono); color: var(--color--text--on-surface); }
${S} .oc-agent-mcp-desc {
  font-size: 11px; color: var(--color--text--muted); margin-bottom: 12px;
}
${S} .oc-agent-setup-card {
  padding: 12px; border: 1px solid var(--color--border--on-surface-0); border-radius: 10px;
  background: var(--color--surface--0);
}
${S} .oc-agent-setup-title { font-size: 11px; color: var(--color--text--muted); margin-bottom: 8px; }
${S} .oc-agent-setup-hint { font-size: 10px; color: var(--color--text--disabled); margin-bottom: 8px; }
${S} .oc-agent-setup-pre {
  font-size: 10px; font-family: var(--font-mono); color: var(--color--text--on-surface);
  background: var(--color--surface--1); padding: 10px; border-radius: 8px;
  border: 1px solid var(--color--border--on-surface-1); margin-top: 6px;
  white-space: pre-wrap; word-break: break-all;
}
${S} .oc-agent-active-badge {
  font-size: 10px; color: var(--color--status--success);
  background: rgba(16,185,129,0.08); padding: 2px 8px; border-radius: 4px;
}
${S} .oc-agent-log-entry {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 6px 0; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-agent-log-time {
  font-size: 10px; color: var(--color--text--disabled); font-family: var(--font-mono);
  flex-shrink: 0; margin-top: 1px;
}
${S} .oc-agent-log-summary { font-size: 11px; }
${S} .oc-agent-log-summary.is-sent { color: var(--color--text--primary); }
${S} .oc-agent-log-summary.is-received { color: var(--color--status--success); }
${S} .oc-agent-log-summary.is-default { color: var(--color--text--muted); }
${S} .oc-agent-log-method { font-size: 10px; color: var(--color--text--disabled); }
`;
