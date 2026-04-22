// ──────────────────────────────────────────────────────────
// Composer pills — model, effort, permissions, context
// ──────────────────────────────────────────────────────────
//
// Reusable dropdown/pill primitives for the ACP chat composer.
// Uses the same visual language as the legacy AIChatPanel so the
// two surfaces feel part of one product, not two.
//
// All state is per-chat and dispatched via UPDATE_CHAT_SETTINGS
// in the workspace store — no local component state.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import {
  Brain,
  ChevronDown,
  Check,
  Eye,
  Cpu,
  GitBranch as GitBranchIcon,
  Gauge,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type {
  ChatEffort,
  ChatPermissionMode,
  ChatThread,
} from "../store/store";
import type { InitializeResponse, SessionMode } from "@agentclientprotocol/sdk";
import type { AcpUsage } from "./use-acp-session";
import {
  modelsForAgent as catalogModelsForAgent,
  envForChatSettings,
  loadCatalog,
  refreshCatalog,
  catalogUpdatedAt,
  type ModelOption,
} from "./model-catalog";

/** Shim around the canonical catalog module so existing call sites
 *  continue to import from here. */
export function envForChat(
  chat: ChatThread,
  initialize: InitializeResponse | null = null,
): Record<string, string> {
  return envForChatSettings({
    agentId: chat.agentId,
    initialize,
    model: chat.model,
    effort: chat.effort,
  });
}

// ── useClickAway hook ────────────────────────────────────

function useClickAway(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

// ── ModelPill ────────────────────────────────────────────

export function ModelPill({
  agentId,
  initialize,
  value,
  onChange,
}: {
  agentId: string | null;
  /** When provided, the pill prefers the agent's advertised model
   *  catalog (initialize._meta.models) over the curated fallback. */
  initialize: InitializeResponse | null;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // `tick` forces re-reads of the module-scoped activeCatalog after
  // loadCatalog / refreshCatalog mutate it. Bumping this triggers a
  // re-render that picks up new families/envVars without prop drilling.
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickAway(rootRef, open, () => setOpen(false));

  // Warm the remote catalog on first open. loadCatalog is idempotent
  // (24h cache) so spamming the dropdown is free.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadCatalog().then(() => {
      if (!cancelled) setTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const models = catalogModelsForAgent(agentId, initialize);
  void tick; // consume so the linter sees tick is wired to re-renders
  const current = models.find((m) => m.value === value) ?? null;
  // Default label reflects the agent's default when no override is set.
  const displayLabel = current?.label ?? (models[0]?.label ?? "Model");

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCatalog();
      setTick((t) => t + 1);
    } finally {
      setRefreshing(false);
    }
  };

  // If the agent family has no catalog (unknown wrapper) AND the agent
  // didn't advertise its own models either, hide the pill — a dropdown
  // with no choices is confusing.
  if (models.length === 0) return null;

  return (
    <div ref={rootRef} className="oc-chat-dropdown-root">
      <button
        type="button"
        className="oc-chat-toolbar-pill"
        title={`Model — ${displayLabel}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Cpu size={11} />
        <span>{displayLabel}</span>
        <ChevronDown size={10} className="oc-chat-toolbar-caret" />
      </button>
      {open && (
        <div className="oc-chat-dropdown-menu">
          <div className="oc-chat-dropdown-section-label">Model</div>
          {models.map((m) => {
            const isActive = (value ?? models[0].value) === m.value;
            return (
              <button
                key={m.value}
                type="button"
                className={`oc-chat-dropdown-item ${isActive ? "is-active" : ""}`}
                onClick={() => {
                  onChange(m.value);
                  setOpen(false);
                }}
              >
                <span className="oc-chat-dropdown-item-row">
                  <span className="oc-chat-dropdown-item-label">{m.label}</span>
                  {m.badge && (
                    <span className="oc-chat-dropdown-badge">{m.badge}</span>
                  )}
                </span>
                {isActive && (
                  <Check size={12} className="oc-chat-dropdown-item-check" />
                )}
              </button>
            );
          })}
          <div className="oc-chat-dropdown-separator" />
          <button
            type="button"
            className="oc-chat-dropdown-item oc-chat-dropdown-item--meta"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            title="Fetch the latest model list from the remote catalog"
          >
            {refreshing ? (
              <Loader2 size={11} className="oc-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            <span className="oc-chat-dropdown-item-label">
              {refreshing ? "Refreshing…" : "Refresh catalog"}
            </span>
            <span className="oc-chat-dropdown-item-hint">
              updated {catalogUpdatedAt()}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── EffortPill ───────────────────────────────────────────

const EFFORT_ITEMS: Array<{ value: ChatEffort; label: string; hint: string }> = [
  { value: "low", label: "Low", hint: "Quick answers" },
  { value: "medium", label: "Medium", hint: "Balanced" },
  { value: "high", label: "High", hint: "Thorough" },
  { value: "xhigh", label: "xHigh", hint: "Long-horizon" },
];

function effortLabel(v: ChatEffort): string {
  return EFFORT_ITEMS.find((i) => i.value === v)?.label ?? v;
}

export function EffortPill({
  value,
  onChange,
}: {
  value: ChatEffort;
  onChange: (v: ChatEffort) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickAway(rootRef, open, () => setOpen(false));

  return (
    <div ref={rootRef} className="oc-chat-dropdown-root">
      <button
        type="button"
        className="oc-chat-toolbar-pill"
        title="Thinking effort"
        onClick={() => setOpen((v) => !v)}
      >
        <Brain size={11} />
        <span>{effortLabel(value)}</span>
        <ChevronDown size={10} className="oc-chat-toolbar-caret" />
      </button>
      {open && (
        <div className="oc-chat-dropdown-menu">
          {EFFORT_ITEMS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`oc-chat-dropdown-item ${
                item.value === value ? "is-active" : ""
              }`}
              onClick={() => {
                onChange(item.value);
                setOpen(false);
              }}
            >
              <span className="oc-chat-dropdown-item-label">{item.label}</span>
              <span className="oc-chat-dropdown-item-hint">{item.hint}</span>
              {item.value === value && (
                <Check size={12} className="oc-chat-dropdown-item-check" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PermissionsPill ──────────────────────────────────────
//
// Two-mode behavior:
//
// 1. When the agent advertises `availableModes` (Claude Code ACP does:
//    "default" / "acceptEdits" / "bypassPermissions" / "plan"), the pill
//    shows those and calls ACP `session/set_mode` on change. This is the
//    real wire — the agent sees the new mode immediately.
//
// 2. When the agent advertises no modes (most non-Claude wrappers), the
//    pill falls back to our local 4-option list and persists to the chat
//    thread only. New sessions respect the setting via env if the agent
//    reads it; otherwise this is a UX affordance without teeth.
//
// Either way the user sees a consistent pill.

const LOCAL_PERMISSION_ITEMS: Array<{
  value: ChatPermissionMode;
  label: string;
  hint: string;
}> = [
  { value: "full", label: "Full Access", hint: "Auto-approve everything" },
  {
    value: "auto-edit",
    label: "Auto Edit",
    hint: "Auto-approve reads + edits",
  },
  { value: "ask", label: "Ask First", hint: "Prompt before writes" },
  { value: "plan-only", label: "Plan Only", hint: "No execution" },
];

function localPermissionLabel(v: ChatPermissionMode): string {
  return LOCAL_PERMISSION_ITEMS.find((i) => i.value === v)?.label ?? v;
}

export function PermissionsPill({
  // Agent-advertised
  availableModes,
  currentModeId,
  onAgentModeChange,
  // Local fallback
  value,
  onChange,
}: {
  availableModes: SessionMode[];
  currentModeId: string | null;
  onAgentModeChange: (modeId: string) => void;
  value: ChatPermissionMode;
  onChange: (v: ChatPermissionMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickAway(rootRef, open, () => setOpen(false));

  const useAgentModes = availableModes.length > 0;

  const displayLabel = useAgentModes
    ? availableModes.find((m) => m.id === currentModeId)?.name ??
      availableModes[0]?.name ??
      "Mode"
    : localPermissionLabel(value);

  return (
    <div ref={rootRef} className="oc-chat-dropdown-root is-footer">
      <button
        type="button"
        className="oc-chat-toolbar-pill"
        title="Permission mode"
        onClick={() => setOpen((v) => !v)}
      >
        <Eye size={11} />
        <span>{displayLabel}</span>
        <ChevronDown size={10} className="oc-chat-toolbar-caret" />
      </button>
      {open && (
        <div className="oc-chat-dropdown-menu">
          {useAgentModes
            ? availableModes.map((m) => {
                const isActive = (currentModeId ?? availableModes[0]?.id) === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`oc-chat-dropdown-item ${isActive ? "is-active" : ""}`}
                    onClick={() => {
                      onAgentModeChange(m.id);
                      setOpen(false);
                    }}
                  >
                    <span className="oc-chat-dropdown-item-label">{m.name}</span>
                    {m.description && (
                      <span className="oc-chat-dropdown-item-hint">
                        {m.description}
                      </span>
                    )}
                    {isActive && (
                      <Check size={12} className="oc-chat-dropdown-item-check" />
                    )}
                  </button>
                );
              })
            : LOCAL_PERMISSION_ITEMS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`oc-chat-dropdown-item ${
                    item.value === value ? "is-active" : ""
                  }`}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <span className="oc-chat-dropdown-item-label">{item.label}</span>
                  <span className="oc-chat-dropdown-item-hint">{item.hint}</span>
                  {item.value === value && (
                    <Check size={12} className="oc-chat-dropdown-item-check" />
                  )}
                </button>
              ))}
        </div>
      )}
    </div>
  );
}

// ── BranchPill — live git branch switcher ────────────────
//
// Reads from the active chat's folder (passed as `cwd`). Shows
// the current branch and ahead/behind counters; click opens a
// list of local branches; click a row to switch.

export function BranchPill({
  branch,
  ahead,
  behind,
  cwd,
  onSwitched,
}: {
  branch: string | null;
  ahead: number;
  behind: number;
  cwd?: string;
  onSwitched?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<
    Array<{ name: string; isHead: boolean }> | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickAway(rootRef, open, () => setOpen(false));

  // Lazy-load the branch list on first open so we don't hammer git
  // for every chat render.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const { git } = await import("../../native/native");
        const list = await git.branchList(cwd);
        if (!cancelled) {
          setBranches(
            list.map((b) => ({ name: b.name, isHead: !!b.isHead })),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, cwd]);

  const handleSwitch = async (name: string) => {
    if (name === branch) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { git } = await import("../../native/native");
      await git.branchSwitch(name, cwd);
      onSwitched?.(name);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className="oc-chat-dropdown-root is-footer">
      <button
        type="button"
        className="oc-chat-toolbar-pill is-footer"
        onClick={() => branch && setOpen((v) => !v)}
        title={
          branch
            ? `Branch: ${branch}${
                ahead || behind
                  ? ` (${ahead} ahead${behind ? `, ${behind} behind` : ""})`
                  : ""
              }`
            : "No git repo"
        }
        disabled={!branch}
      >
        <GitBranchIcon size={11} />
        <span>{branch ?? "no git"}</span>
        {branch && (ahead > 0 || behind > 0) && (
          <span className="oc-chat-branch-pill-counters">
            {ahead > 0 && (
              <span title={`${ahead} unpushed commit${ahead === 1 ? "" : "s"}`}>
                ↑{ahead}
              </span>
            )}
            {behind > 0 && (
              <span title={`${behind} commit${behind === 1 ? "" : "s"} behind`}>
                ↓{behind}
              </span>
            )}
          </span>
        )}
        {branch && <ChevronDown size={10} className="oc-chat-toolbar-caret" />}
      </button>
      {open && branch && (
        <div className="oc-chat-dropdown-menu">
          <div className="oc-chat-dropdown-section-label">Switch branch</div>
          {error && (
            <div className="oc-chat-dropdown-item-hint oc-chat-dropdown-item-hint--padded">
              {error}
            </div>
          )}
          {!branches && !error && (
            <div className="oc-chat-dropdown-item-hint oc-chat-dropdown-item-hint--padded">
              Loading…
            </div>
          )}
          {branches?.map((b) => (
            <button
              key={b.name}
              type="button"
              className={`oc-chat-dropdown-item ${b.isHead ? "is-active" : ""}`}
              onClick={() => void handleSwitch(b.name)}
              disabled={busy}
            >
              <GitBranchIcon size={11} />
              <span className="oc-chat-dropdown-item-label">{b.name}</span>
              {b.isHead && (
                <Check size={12} className="oc-chat-dropdown-item-check" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ContextPill (real usage via ACP usage_update + prompt usage) ──

function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) return `${(n / 1000).toFixed(2)}k`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function ContextPill({ usage }: { usage: AcpUsage }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickAway(rootRef, open, () => setOpen(false));

  // Prefer the running usage_update size (what the agent actually reports),
  // else back off to the cumulative input+output as a proxy.
  const size = usage.size;
  const used = usage.used || usage.inputTokens + usage.outputTokens;
  const pct =
    size > 0
      ? Math.min(100, Math.round((used / size) * 100))
      : null;

  const rows: Array<[string, number]> = (
    [
      ["Input", usage.inputTokens],
      ["Output", usage.outputTokens],
      ["Cache read", usage.cachedReadTokens],
      ["Cache write", usage.cachedWriteTokens],
      ["Reasoning", usage.thoughtTokens],
    ] as Array<[string, number]>
  ).filter(([, n]) => n > 0);

  return (
    <div ref={rootRef} className="oc-chat-dropdown-root is-footer is-right">
      <button
        type="button"
        className="oc-chat-toolbar-pill is-context"
        onClick={() => setOpen((v) => !v)}
        title={
          pct == null
            ? `${formatTokens(used)} tokens used`
            : `${pct}% of context window`
        }
      >
        <Gauge size={11} />
        <span>{pct == null ? formatTokens(used) : `${pct}%`}</span>
      </button>
      {open && (
        <div className="oc-chat-dropdown-menu oc-chat-usage-popover">
          <div className="oc-chat-dropdown-section-label">Context usage</div>
          {size > 0 && (
            <div className="oc-chat-usage-row is-primary">
              <span>Window</span>
              <span>
                {formatTokens(used)} / {formatTokens(size)}
                {pct != null && <> · {pct}%</>}
              </span>
            </div>
          )}
          {rows.length === 0 ? (
            <div className="oc-chat-dropdown-item-hint oc-chat-dropdown-item-hint--padded">
              No tokens billed yet.
            </div>
          ) : (
            rows.map(([label, n]) => (
              <div key={label} className="oc-chat-usage-row">
                <span>{label}</span>
                <span>{formatTokens(n)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
