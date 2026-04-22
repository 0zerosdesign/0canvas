// ──────────────────────────────────────────────────────────
// AgentsPanel — Zed/Fabriqa-style ACP registry picker
// ──────────────────────────────────────────────────────────
//
// Renders the live agent list from cdn.agentclientprotocol.com. The user
// selects an agent, which starts a new session via the useAcpSession hook.
// We don't "install" agents explicitly — npx fetches the package on first
// spawn, binary distributions download on first use, and uvx handles
// Python packages similarly. From the UI's perspective every agent in the
// registry is "one click from running".
//
// Phase 3 additions: install-state badge (Installed / Available / Unavailable)
// from the engine's PATH probe, All / Installed / Not installed tabs,
// and a per-row resource strip (repository / website / license).
// ──────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
  Github,
  Globe,
  Scale,
} from "lucide-react";
import type { BridgeRegistryAgent } from "../bridge/messages";
import { Button, Input } from "../ui";

type InstallFilter = "all" | "installed" | "available";

interface AgentsPanelProps {
  listAgents: (force?: boolean) => Promise<BridgeRegistryAgent[]>;
  onSelect: (agent: BridgeRegistryAgent) => void;
  activeAgentId?: string | null;
}

export function AgentsPanel({ listAgents, onSelect, activeAgentId }: AgentsPanelProps) {
  const [agents, setAgents] = useState<BridgeRegistryAgent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<InstallFilter>("all");

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const list = await listAgents(force);
      setAgents(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sorted + search-filtered. Tab filter is applied afterwards so each tab's
  // count reflects the current search.
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
    // Installed agents float to the top within whatever list we return.
    return [...base].sort((a, b) => {
      if (!!a.installed !== !!b.installed) return a.installed ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [agents, query]);

  const counts = useMemo(() => {
    const installed = searched.filter((a) => a.installed).length;
    return {
      all: searched.length,
      installed,
      available: searched.length - installed,
    };
  }, [searched]);

  const filtered = useMemo(() => {
    if (tab === "installed") return searched.filter((a) => a.installed);
    if (tab === "available") return searched.filter((a) => !a.installed);
    return searched;
  }, [searched, tab]);

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
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          title="Refresh from CDN"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      <div className="oc-acp-reg-tabs">
        <TabButton
          active={tab === "all"}
          onClick={() => setTab("all")}
          label="All"
          count={counts.all}
        />
        <TabButton
          active={tab === "installed"}
          onClick={() => setTab("installed")}
          label="Installed"
          count={counts.installed}
        />
        <TabButton
          active={tab === "available"}
          onClick={() => setTab("available")}
          label="Not installed"
          count={counts.available}
        />
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
            {tab === "installed"
              ? "No installed agents detected on PATH. Install Claude Code, Codex, or Gemini and refresh."
              : tab === "available"
              ? `No agents match "${query}".`
              : `No agents match "${query}".`}
          </div>
        )}
        {filtered.map((agent) => (
          <AgentRow
            key={agent.id}
            agent={agent}
            onSelect={onSelect}
            active={activeAgentId === agent.id}
          />
        ))}
      </div>

      {agents && (
        <div className="oc-acp-reg-footer">
          <span>
            {agents.length} agent{agents.length === 1 ? "" : "s"} · shared ACP registry
          </span>
          <a
            href="https://agentclientprotocol.com"
            target="_blank"
            rel="noreferrer"
          >
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
  onSelect,
  active,
}: {
  agent: BridgeRegistryAgent;
  onSelect: (a: BridgeRegistryAgent) => void;
  active: boolean;
}) {
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

  const { pillLabel, pillClass } = statePill(agent);

  return (
    <div
      className={`oc-acp-reg-row ${active ? "oc-acp-reg-row-active" : ""}`}
      onClick={() => onSelect(agent)}
    >
      {agent.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agent.icon}
          alt=""
          className="oc-acp-reg-avatar"
          style={{ objectFit: "contain", padding: "var(--space-1)" }}
          loading="lazy"
        />
      ) : (
        <div className="oc-acp-reg-avatar">
          {agent.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="oc-acp-reg-body">
        <div className="oc-acp-reg-title">
          <span className="oc-acp-reg-name">{agent.name}</span>
          <span className="oc-acp-reg-version">v{agent.version}</span>
          <span className="oc-acp-reg-dist">{distKind}</span>
          <span className={`oc-acp-reg-pill ${pillClass}`}>{pillLabel}</span>
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
      <Button
        variant={active ? "outline" : "primary"}
        size="sm"
        type="button"
        className={`oc-acp-reg-cta ${active ? "oc-acp-reg-cta-active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(agent);
        }}
      >
        {active ? "Active" : agent.installed ? "Start" : "Run"}
      </Button>
    </div>
  );
}

function statePill(agent: BridgeRegistryAgent): {
  pillLabel: string;
  pillClass: string;
} {
  if (agent.launchKind === "unavailable") {
    return { pillLabel: "Unavailable", pillClass: "oc-acp-reg-pill-unavailable" };
  }
  if (agent.installed) {
    return { pillLabel: "Installed", pillClass: "oc-acp-reg-pill-installed" };
  }
  return { pillLabel: "Available", pillClass: "oc-acp-reg-pill-available" };
}
