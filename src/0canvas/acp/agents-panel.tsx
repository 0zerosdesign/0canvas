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
// ──────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, ExternalLink } from "lucide-react";
import type { BridgeRegistryAgent } from "../bridge/messages";
import { Button, Input } from "../ui";

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

  const filtered = useMemo(() => {
    if (!agents) return [];
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );
  }, [agents, query]);

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
          <div className="oc-acp-empty-muted">No agents match "{query}".</div>
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

function AgentRow({
  agent,
  onSelect,
  active,
}: {
  agent: BridgeRegistryAgent;
  onSelect: (a: BridgeRegistryAgent) => void;
  active: boolean;
}) {
  const distKind = agent.distribution.npx
    ? "npx"
    : agent.distribution.uvx
    ? "uvx"
    : agent.distribution.binary
    ? "binary"
    : "unknown";

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
        </div>
        <div className="oc-acp-reg-desc">{agent.description}</div>
        <div className="oc-acp-reg-id">{agent.id}</div>
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
        {active ? "Active" : "Start"}
      </Button>
    </div>
  );
}
