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
  Download,
  Check,
  AlertCircle,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { BridgeRegistryAgent } from "../bridge/messages";
import { Button, Input } from "../ui";

type InstallFilter = "all" | "installed" | "available";

interface AgentsPanelProps {
  listAgents: (force?: boolean) => Promise<BridgeRegistryAgent[]>;
  onSelect: (agent: BridgeRegistryAgent) => void;
  activeAgentId?: string | null;
  /** Fire-and-forget pre-warm hook called when the user hovers a row.
   *  Spawning the agent subprocess in the background hides ~200-500ms
   *  of adapter boot when they actually click. Failures are silent. */
  onPreWarm?: (agentId: string) => void;
}

export function AgentsPanel({ listAgents, onSelect, activeAgentId, onPreWarm }: AgentsPanelProps) {
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

  // Re-probe when the window regains focus — if the user ran `npm install -g`
  // in their terminal while Zeros was backgrounded, we want the install-state
  // to reflect that without them hunting for a Refresh button.
  useEffect(() => {
    const onFocus = () => {
      // Silent refresh; we already have data, just update install flags.
      void load(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
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

/** Known install hints for binary-distributed agents where we can't
 *  just run `npm install -g`. Keyed by registry agent id. Value is a
 *  best-effort one-liner the user pastes into their terminal. */
const BINARY_INSTALL_HINTS: Record<string, string> = {
  "amp-acp": "curl -fsSL https://ampcode.com/install.sh | sh",
  "factory-droid": "curl -fsSL https://app.factory.ai/cli | sh",
  cursor: "curl https://cursor.com/install -fsS | bash",
};

/** Build the shell command a user would run to install this agent's CLI.
 *  Prefers npm → uv → known binary installer. Returns null only when we
 *  genuinely have no actionable install path (rare). */
function installCommandFor(agent: BridgeRegistryAgent): string | null {
  const npxPkg = agent.distribution.npx?.package;
  if (npxPkg) {
    // Strip a trailing "@version" pin so the user gets the latest by default.
    const unpinned = npxPkg.replace(/@[^@/]+$/, "");
    return `npm install -g ${unpinned}`;
  }
  const uvxPkg = agent.distribution.uvx?.package;
  if (uvxPkg) {
    const unpinned = uvxPkg.replace(/@[^@/]+$/, "");
    return `uv tool install ${unpinned}`;
  }
  const binaryHint = BINARY_INSTALL_HINTS[agent.id];
  if (binaryHint) return binaryHint;
  return null;
}

function AgentRow({
  agent,
  onSelect,
  onPreWarm,
  active,
}: {
  agent: BridgeRegistryAgent;
  onSelect: (a: BridgeRegistryAgent) => void;
  onPreWarm?: (agentId: string) => void;
  active: boolean;
}) {
  // Warm the subprocess on hover, once per session. Debounce-via-flag to
  // avoid re-firing as the user hovers repeatedly across installed rows.
  const warmedRef = React.useRef(false);
  const handleMouseEnter = () => {
    if (warmedRef.current) return;
    if (!onPreWarm) return;
    if (!agent.installed) return;
    warmedRef.current = true;
    onPreWarm(agent.id);
  };

  type InstallState = "idle" | "launching" | "running" | "error";
  const [installState, setInstallState] = useState<InstallState>("idle");
  const [installError, setInstallError] = useState<string | null>(null);
  const installCmd = installCommandFor(agent);
  const handleInstall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!installCmd) return;
    setInstallState("launching");
    setInstallError(null);
    try {
      await invoke("open_install_terminal", { command: installCmd });
      // Terminal opened with the install running. Flip to "running" so the
      // CTA reads "Installing…" — the focus-refresh hook at panel level
      // polls the registry when the user returns to Zeros and the button
      // will flip back to "Installed" once PATH detection picks it up.
      setInstallState("running");
    } catch (err) {
      setInstallState("error");
      setInstallError(err instanceof Error ? err.message : String(err));
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

  const { pillLabel, pillClass } = statePill(agent);

  return (
    <div
      className={`oc-acp-reg-row ${active ? "oc-acp-reg-row-active" : ""}`}
      onClick={() => onSelect(agent)}
      onMouseEnter={handleMouseEnter}
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
      {agent.installed ? (
        // Installed agents are always available in the chat picker. The only
        // per-agent affordance is "is this my default" — expressed as a star
        // on the row itself. No separate Start/Run/Active button needed.
        <div
          className={`oc-acp-reg-cta-installed ${active ? "is-default" : ""}`}
          title={active ? "Default agent for new chats" : "Set as default"}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(agent);
          }}
          role="button"
          tabIndex={0}
        >
          <Check className="w-3 h-3" />
          <span>{active ? "Default" : "Installed"}</span>
        </div>
      ) : installCmd ? (
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="oc-acp-reg-cta"
          onClick={handleInstall}
          disabled={installState === "launching"}
          title={
            installState === "error"
              ? installError ?? "Failed to open terminal"
              : installState === "running"
              ? "Installing — finish in the terminal window that opened"
              : `Run in Terminal: ${installCmd}`
          }
        >
          {installState === "launching" ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Opening…
            </>
          ) : installState === "running" ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Installing…
            </>
          ) : installState === "error" ? (
            <>
              <AlertCircle className="w-3 h-3" />
              Retry
            </>
          ) : (
            <>
              <Download className="w-3 h-3" />
              Install
            </>
          )}
        </Button>
      ) : (
        // No known install recipe — point the user at the agent's own docs.
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="oc-acp-reg-cta"
          onClick={(e) => {
            e.stopPropagation();
            if (agent.website) {
              window.open(agent.website, "_blank", "noopener,noreferrer");
            } else if (agent.repository) {
              window.open(agent.repository, "_blank", "noopener,noreferrer");
            }
          }}
          title="Open install instructions"
        >
          <ExternalLink className="w-3 h-3" />
          Install docs
        </Button>
      )}
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
