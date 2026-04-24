// ──────────────────────────────────────────────────────────
// AgentsPanel — ACP agent settings (universal, per-user)
// ──────────────────────────────────────────────────────────
//
// The single place where the user decides:
//   (1) Which agents show up in the chat-composer "new chat" picker
//       (toggle — enabled set persisted in localStorage, shared across
//       all projects).
//   (2) Whether an agent is logged in ("Active" / "Not active"),
//       with a Login button that opens Terminal running `<binary> login`.
//
// The panel no longer tracks "installed" vs "available" — npx/uvx
// fetch on first use, and binary-distributed agents download themselves
// from their launch adapter. From the user's perspective every agent
// in the registry is one toggle + one login away from running.
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Search,
  ExternalLink,
  Github,
  Globe,
  Scale,
  LogIn,
} from "lucide-react";
import { nativeInvoke } from "../../native/runtime";
import type { BridgeRegistryAgent } from "../bridge/messages";
import { Button, Input } from "../ui";
import { useEnabledAgents } from "./enabled-agents";
import {
  loadAgents,
  refreshAgents,
  useAgentsSnapshot,
} from "./agents-cache";
import { AgentIcon } from "./agent-icon";

type EnabledFilter = "all" | "enabled" | "disabled";

interface AgentsPanelProps {
  listAgents: (force?: boolean) => Promise<BridgeRegistryAgent[]>;
  onSelect: (agent: BridgeRegistryAgent) => void;
  activeAgentId?: string | null;
  /** Fire-and-forget pre-warm hook called when the user hovers a row.
   *  Spawning the agent subprocess in the background hides ~200-500ms
   *  of adapter boot when they actually click. Failures are silent. */
  onPreWarm?: (agentId: string) => void;
  /** Bumped by the parent to force a registry reload (e.g. when the
   *  user clicks the refresh icon in the panel heading). */
  refreshNonce?: number;
}

export function AgentsPanel({ listAgents, onSelect, activeAgentId, onPreWarm, refreshNonce }: AgentsPanelProps) {
  const agents = useAgentsSnapshot();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<EnabledFilter>("all");
  // agentId → true (authenticated) / false (not) / undefined (no binary / not probed yet).
  const [authState, setAuthState] = useState<Map<string, boolean>>(new Map());
  const { isEnabled, toggle } = useEnabledAgents();

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (force) await refreshAgents(listAgents);
      else await loadAgents(listAgents);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [listAgents]);

  useEffect(() => {
    void load(false);
  }, [load]);

  // External refresh signal — heading-bar icon increments the nonce.
  // Skip the initial 0 so we don't double-fire alongside the mount load.
  useEffect(() => {
    if (refreshNonce === undefined || refreshNonce === 0) return;
    void load(true);
  }, [refreshNonce, load]);

  // Probe auth state for every agent that has a known CLI binary.
  // Running in parallel keeps the round-trip short; failures fall
  // through to "not active" silently.
  const probeAuth = useCallback(async (list: BridgeRegistryAgent[]) => {
    const next = new Map<string, boolean>();
    await Promise.all(
      list.map(async (a) => {
        if (!a.authBinary) return;
        try {
          const ok = await nativeInvoke<boolean>("ai_cli_is_authenticated", {
            binary: a.authBinary,
          });
          next.set(a.id, !!ok);
        } catch {
          next.set(a.id, false);
        }
      }),
    );
    setAuthState(next);
  }, []);

  useEffect(() => {
    if (!agents) return;
    void probeAuth(agents);
  }, [agents, probeAuth]);

  // Re-probe when the window regains focus so that running `claude
  // login` in an external terminal flips the row to "Active" the
  // moment the user switches back to Zeros — no manual refresh click.
  // Also poll every 60s as a belt-and-suspenders fallback for the
  // case where the user never unfocuses the window (kiosk-style).
  useEffect(() => {
    const onFocus = () => {
      void load(true);
    };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      if (!document.hidden) void load(true);
    }, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [load]);

  // Sorted + search-filtered. Tab filter is applied afterwards so each
  // tab's count reflects the current search.
  const searched = useMemo(() => {
    if (!agents) return [];
    const q = query.trim().toLowerCase();
    const base = q
      ? agents.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.id.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q),
        )
      : agents;
    return [...base].sort((a, b) => {
      const aOn = isEnabled(a.id);
      const bOn = isEnabled(b.id);
      if (aOn !== bOn) return aOn ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [agents, query, isEnabled]);

  const counts = useMemo(() => {
    const enabledCount = searched.filter((a) => isEnabled(a.id)).length;
    return {
      all: searched.length,
      enabled: enabledCount,
      disabled: searched.length - enabledCount,
    };
  }, [searched, isEnabled]);

  const filtered = useMemo(() => {
    if (tab === "enabled") return searched.filter((a) => isEnabled(a.id));
    if (tab === "disabled") return searched.filter((a) => !isEnabled(a.id));
    return searched;
  }, [searched, tab, isEnabled]);

  const allIds = useMemo(() => (agents ?? []).map((a) => a.id), [agents]);

  return (
    <div className="oc-acp-surface">
      <div className="oc-acp-subheader">
        <div className="oc-acp-reg-search">
          <Search className="oc-acp-reg-search-icon w-3.5 h-3.5" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents..."
            className="oc-acp-reg-search-input"
          />
        </div>
      </div>

      <div className="oc-acp-reg-tabs">
        <TabButton active={tab === "all"} onClick={() => setTab("all")} label="All" count={counts.all} />
        <TabButton active={tab === "enabled"} onClick={() => setTab("enabled")} label="Enabled" count={counts.enabled} />
        <TabButton active={tab === "disabled"} onClick={() => setTab("disabled")} label="Disabled" count={counts.disabled} />
      </div>

      <div className="oc-acp-reg-list">
        {error && (
          <div className="oc-acp-error" style={{ margin: "var(--space-6)" }}>
            <div className="min-w-0">
              <div className="oc-acp-error-title">Failed to load registry</div>
              <div>{error}</div>
            </div>
          </div>
        )}
        {!error && !agents && (
          <div className="oc-acp-empty-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Fetching ACP registry...
          </div>
        )}
        {agents && filtered.length === 0 && (
          <div className="oc-acp-empty-muted">
            {tab === "enabled"
              ? "No agents enabled. Toggle one on to make it available in the chat picker."
              : tab === "disabled"
              ? "Every agent is enabled."
              : `No agents match "${query}".`}
          </div>
        )}
        {filtered.map((agent) => (
          <AgentRow
            key={agent.id}
            agent={agent}
            enabled={isEnabled(agent.id)}
            onToggle={() => toggle(agent.id, allIds)}
            authenticated={authState.get(agent.id)}
            onAuthChanged={() => void probeAuth(agents ?? [])}
            onSelect={onSelect}
            onPreWarm={onPreWarm}
            active={activeAgentId === agent.id}
          />
        ))}
      </div>

      {agents && (
        <div className="oc-acp-reg-footer">
          <span>
            {agents.length} agent{agents.length === 1 ? "" : "s"} · shared ACP registry
          </span>
          <a href="https://agentclientprotocol.com" target="_blank" rel="noreferrer">
            docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`oc-acp-reg-tab ${active ? "oc-acp-reg-tab-active" : ""}`}
    >
      {label}
      <span className="oc-acp-reg-tab-count">{count}</span>
    </button>
  );
}

function AgentRow({
  agent,
  enabled,
  onToggle,
  authenticated,
  onAuthChanged,
  onSelect,
  onPreWarm,
  active,
}: {
  agent: BridgeRegistryAgent;
  enabled: boolean;
  onToggle: () => void;
  /** undefined → agent has no known binary to probe; true/false → probed result. */
  authenticated: boolean | undefined;
  onAuthChanged: () => void;
  onSelect: (a: BridgeRegistryAgent) => void;
  onPreWarm?: (agentId: string) => void;
  active: boolean;
}) {
  // Warm the subprocess on hover, once per session. Debounce-via-flag to
  // avoid re-firing as the user hovers repeatedly across rows.
  const warmedRef = useRef(false);
  const handleMouseEnter = () => {
    if (warmedRef.current) return;
    if (!onPreWarm) return;
    if (!enabled) return;
    warmedRef.current = true;
    onPreWarm(agent.id);
  };

  const [loginState, setLoginState] = useState<"idle" | "opening" | "error">("idle");
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!agent.authBinary) return;
    setLoginState("opening");
    setLoginError(null);
    try {
      await nativeInvoke("ai_cli_run_login", { binary: agent.authBinary });
      setLoginState("idle");
      // Auth markers are only written once the user finishes the flow
      // in Terminal — the focus-refresh hook catches that, but give it
      // an extra poll a few seconds out for responsiveness.
      window.setTimeout(() => onAuthChanged(), 5000);
    } catch (err) {
      setLoginState("error");
      setLoginError(err instanceof Error ? err.message : String(err));
    }
  };

  const distKind =
    agent.launchKind && agent.launchKind !== "unavailable"
      ? agent.launchKind
      : agent.distribution.npx
      ? "npx"
      : agent.distribution.uvx
      ? "uvx"
      : agent.distribution.binary
      ? "binary"
      : "unknown";

  const canProbeAuth = !!agent.authBinary;
  const isActive = canProbeAuth && authenticated === true;
  const dotTitle = !canProbeAuth
    ? "No login required"
    : isActive
    ? "Signed in"
    : "Not signed in";

  const handleRowClick = () => {
    // Clicking the body selects the agent as the default for future
    // chats. Keeps the "click anywhere to activate" pattern users
    // already learned, independent of the enable toggle.
    onSelect(agent);
  };

  return (
    <div
      className={`oc-acp-reg-row ${active ? "oc-acp-reg-row-active" : ""}`}
      onClick={handleRowClick}
      onMouseEnter={handleMouseEnter}
    >
      <span
        className={`oc-acp-reg-status-dot ${isActive || !canProbeAuth ? "is-active" : "is-inactive"}`}
        title={dotTitle}
        aria-label={dotTitle}
      />
      <div className="oc-acp-reg-avatar oc-acp-reg-avatar--icon">
        <AgentIcon agentId={agent.id} iconUrl={agent.icon ?? null} size={20} />
      </div>
      <div className="oc-acp-reg-body">
        <div className="oc-acp-reg-title">
          <span className="oc-acp-reg-name">{agent.name}</span>
          <span className="oc-acp-reg-version">v{agent.version}</span>
          <span className="oc-acp-reg-dist">{distKind}</span>
        </div>
        <div className="oc-acp-reg-desc">{agent.description}</div>
        <div className="oc-acp-reg-id">{agent.id}</div>
        {(agent.repository || agent.website || agent.license) && (
          <div className="oc-acp-reg-meta">
            {agent.repository && (
              <a
                href={agent.repository}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Source repository"
              >
                <Github className="w-3 h-3" />
                repo
              </a>
            )}
            {agent.website && (
              <a
                href={agent.website}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Website"
              >
                <Globe className="w-3 h-3" />
                site
              </a>
            )}
            {agent.license && (
              <span className="oc-acp-reg-meta-license" title="License">
                <Scale className="w-3 h-3" />
                {agent.license}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="oc-acp-reg-actions">
        {canProbeAuth && (
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="oc-acp-reg-login"
            onClick={handleLogin}
            disabled={loginState === "opening"}
            title={
              loginState === "error"
                ? loginError ?? "Failed to open terminal"
                : isActive
                ? `Re-login ${agent.authBinary}`
                : `Login via \`${agent.authBinary} login\` in Terminal`
            }
          >
            {loginState === "opening" ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Opening…
              </>
            ) : (
              <>
                <LogIn className="w-3 h-3" />
                {isActive ? "Re-login" : "Login"}
              </>
            )}
          </Button>
        )}
        <Toggle
          on={enabled}
          onChange={onToggle}
          title={enabled ? "Enabled — shown in chat picker" : "Disabled — hidden from chat picker"}
        />
      </div>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  title,
}: {
  on: boolean;
  onChange: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      className={`oc-acp-reg-toggle ${on ? "is-on" : "is-off"}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      <span className="oc-acp-reg-toggle-knob" />
    </button>
  );
}
