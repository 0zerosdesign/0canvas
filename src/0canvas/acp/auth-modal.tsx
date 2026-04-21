// ──────────────────────────────────────────────────────────
// AuthModal — method chooser + API key entry for an ACP agent
// ──────────────────────────────────────────────────────────
//
// Shown between the agents picker and the live chat when an agent is
// known to require auth. Offers two paths, per the locked design
// decision (docs/ACP_INTEGRATION.md § "Decisions locked"):
//
//   (a) API key  — recommended, stores in OS keychain via secrets.ts,
//                  injects as env var when we spawn the subprocess
//   (b) Locally-installed CLI — relies on the user's existing `/login`
//                  session; 0canvas never sees credentials
//
// The agent subprocess isn't spawned until the user confirms here, so
// the chosen env is baked in at fork time. That's the "structural
// compliance" Zed relies on — 0canvas never touches an OAuth token.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { Key, Terminal, Info, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import type { BridgeRegistryAgent } from "../bridge/messages";
import { getSecret, setSecret, SECRET_ACCOUNTS } from "../../native/secrets";
import { Button, Input } from "../ui";

export type AuthMethod = "api-key" | "subscription";

export interface AuthChoice {
  method: AuthMethod;
  /** Env vars to inject at subprocess spawn. Empty for subscription. */
  env: Record<string, string>;
}

export interface AgentAuthConfig {
  /** Which keychain slot to read/write, if any. */
  secretAccount?: string;
  /** Env var the agent expects, e.g. ANTHROPIC_API_KEY. */
  envVar?: string;
  /** Where the user gets the key (shown as a helpful link). */
  consoleUrl?: string;
  /** Short friendly vendor name, e.g. "Anthropic". */
  vendor: string;
}

/**
 * Per-agent auth metadata. This is the ONE place we hardcode vendor specifics —
 * keeps the rest of the ACP integration registry-driven. Agents not listed here
 * fall through to the "no auth required / use CLI's own login" path.
 */
export const AGENT_AUTH_CONFIG: Record<string, AgentAuthConfig> = {
  "claude-acp": {
    secretAccount: SECRET_ACCOUNTS.ANTHROPIC_API_KEY,
    envVar: "ANTHROPIC_API_KEY",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    vendor: "Anthropic",
  },
  "codex-acp": {
    secretAccount: SECRET_ACCOUNTS.OPENAI_API_KEY,
    envVar: "OPENAI_API_KEY",
    consoleUrl: "https://platform.openai.com/api-keys",
    vendor: "OpenAI",
  },
  gemini: {
    // Google's Gemini CLI reads GEMINI_API_KEY per its docs. Slot in a generic
    // account name since we don't yet have a dedicated SECRET_ACCOUNTS entry.
    secretAccount: "gemini-api-key",
    envVar: "GEMINI_API_KEY",
    consoleUrl: "https://aistudio.google.com/apikey",
    vendor: "Google",
  },
};

interface AuthModalProps {
  agent: BridgeRegistryAgent;
  onConfirm: (choice: AuthChoice) => void;
  onBack: () => void;
}

export function AuthModal({ agent, onConfirm, onBack }: AuthModalProps) {
  const config = AGENT_AUTH_CONFIG[agent.id];

  // If we don't have vendor config for this agent we can't help with auth —
  // just start the session and let the agent's own flow (or error) surface.
  useEffect(() => {
    if (!config) onConfirm({ method: "subscription", env: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  const [method, setMethod] = useState<AuthMethod>("api-key");
  const [apiKey, setApiKey] = useState("");
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from the keychain if the user has saved a key before.
  useEffect(() => {
    if (!config?.secretAccount) return;
    let cancelled = false;
    getSecret(config.secretAccount)
      .then((v) => {
        if (cancelled) return;
        if (v) setApiKey(v);
        setKeyLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setKeyLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [config?.secretAccount]);

  if (!config) {
    return (
      <div className="oc-acp-loading">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Starting {agent.name}...
      </div>
    );
  }

  const handleConfirm = async () => {
    setError(null);
    if (method === "subscription") {
      onConfirm({ method: "subscription", env: {} });
      return;
    }

    const key = apiKey.trim();
    if (!key) {
      setError(`Enter your ${config.vendor} API key, or switch to the CLI path.`);
      return;
    }

    setSaving(true);
    try {
      if (config.secretAccount) {
        await setSecret(config.secretAccount, key);
      }
      onConfirm({
        method: "api-key",
        env: config.envVar ? { [config.envVar]: key } : {},
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="oc-acp-surface">
      <header className="oc-acp-subheader">
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          onClick={onBack}
          title="Back to agents"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="oc-acp-subheader-title">Connect {agent.name}</div>
          <div className="oc-acp-subheader-sub">
            How should this agent authenticate?
          </div>
        </div>
      </header>

      <div className="oc-acp-auth-body" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <MethodCard
          active={method === "api-key"}
          onClick={() => setMethod("api-key")}
          icon={<Key className="w-3.5 h-3.5" />}
          title={`${config.vendor} API key (Recommended)`}
          description={`Stored in your OS keychain. Injected as ${config.envVar} when the agent starts. Only this session sees it.`}
        />
        <MethodCard
          active={method === "subscription"}
          onClick={() => setMethod("subscription")}
          icon={<Terminal className="w-3.5 h-3.5" />}
          title={`Use my installed ${config.vendor} CLI`}
          description={`Relies on your existing login in the ${config.vendor} CLI. Your credentials never leave your machine; 0canvas never sees them. Subject to ${config.vendor}'s terms of service.`}
        />

        {method === "api-key" && (
          <div className="oc-acp-auth-field">
            <div className="oc-acp-auth-label">{config.vendor} API key</div>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={keyLoaded ? "sk-..." : "Loading from keychain..."}
              spellCheck={false}
              autoComplete="off"
            />
            <div className="oc-acp-auth-field-meta">
              <a href={config.consoleUrl} target="_blank" rel="noreferrer">
                Get a key from {config.vendor} →
              </a>
              <span className="oc-acp-auth-field-meta-badge">
                <ShieldCheck className="w-3 h-3" /> keychain
              </span>
            </div>
          </div>
        )}

        {method === "subscription" && (
          <div className="oc-acp-auth-disclaimer">
            <Info className="w-3.5 h-3.5 flex-shrink-0" style={{ marginTop: "var(--space-1)" }} />
            <div>
              <div className="oc-acp-auth-disclaimer-title">
                Uses your locally-installed {config.vendor} CLI
              </div>
              <div>
                Make sure you've run the CLI's own login command in your
                terminal before starting a session. 0canvas spawns the CLI and
                the CLI handles its own auth &mdash; we never see, store, or
                proxy the token. Subject to {config.vendor}'s terms of service,
                which you may revoke at any time.
              </div>
            </div>
          </div>
        )}

        {error && <div className="oc-acp-auth-error">{error}</div>}
      </div>

      <div className="oc-acp-auth-actions">
        <Button variant="ghost" type="button" onClick={onBack}>
          Cancel
        </Button>
        <div className="oc-acp-auth-actions-spacer" />
        <Button
          variant="primary"
          type="button"
          onClick={handleConfirm}
          disabled={saving}
          loading={saving}
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  );
}

function MethodCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      className={`oc-acp-auth-card ${active ? "oc-acp-auth-card-active" : ""}`}
    >
      <div className="oc-acp-auth-icon">{icon}</div>
      <div className="oc-acp-auth-body-text">
        <div className="oc-acp-auth-title">{title}</div>
        <div className="oc-acp-auth-desc">{description}</div>
      </div>
      <div className="oc-acp-auth-radio" />
    </Button>
  );
}
