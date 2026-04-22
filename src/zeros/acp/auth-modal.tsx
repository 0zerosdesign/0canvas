// ──────────────────────────────────────────────────────────
// AuthModal — spec-honest auth method chooser for an ACP agent
// ──────────────────────────────────────────────────────────
//
// Phase 4 rewrite: we now read `initialize.authMethods` advertised by the
// agent and render each one faithfully. Env-var methods get a password
// input per secret var (persisted to the OS keychain under `acp::<agentId>::<var>`).
// Terminal methods show the "uses your installed CLI" disclaimer. Agent-kind
// methods render a "the agent handles auth itself" hint and start directly.
//
// Vendor enrichment: agents listed in AGENT_AUTH_CONFIG get per-vendor
// copy — "Anthropic API key (Recommended)", console URL link, friendly
// subscription disclaimer — but the base flow is spec-driven.
//
// Claude-specific: we synthesise a "Gateway (advanced)" option at the end
// so users can point `claude-agent-acp` at a LiteLLM / Anthropic-compatible
// proxy without shelling out to edit env.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from "react";
import {
  Key,
  Terminal,
  Info,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Bot,
  Radio,
} from "lucide-react";
import type { BridgeRegistryAgent } from "../bridge/messages";
import type { AuthMethod, InitializeResponse } from "@agentclientprotocol/sdk";
import { getSecret, setSecret, SECRET_ACCOUNTS } from "../../native/secrets";
import { Button, Input } from "../ui";

export type AuthMethodKind = "env_var" | "terminal" | "agent";

export interface AuthChoice {
  /** Method id the user picked (or a synthetic id when the modal injected one). */
  methodId: string;
  /** ACP-spec method type, used by the engine to decide how to proceed. */
  kind: AuthMethodKind;
  /** Env vars to inject at subprocess spawn. Empty for non-env methods. */
  env: Record<string, string>;
}

export interface AgentAuthConfig {
  /** Keychain slot for a primary API key (if this vendor has a well-known one). */
  secretAccount?: string;
  /** Env var the agent's primary API key goes into. */
  envVar?: string;
  /** Where the user gets the key (shown as a helpful link). */
  consoleUrl?: string;
  /** Short friendly vendor name, e.g. "Anthropic". */
  vendor: string;
  /** Allow injecting the synthetic Gateway option (base URL + custom headers). */
  supportsGateway?: boolean;
  /** Env vars the gateway option writes. */
  gatewayVars?: { baseUrl: string; customHeaders?: string };
}

/**
 * Per-agent vendor enrichment. Purely cosmetic + keychain routing —
 * the actual auth methods always come from the agent's `initialize`
 * response. Agents not listed here still work, just without vendor copy.
 */
export const AGENT_AUTH_CONFIG: Record<string, AgentAuthConfig> = {
  "claude-acp": {
    secretAccount: SECRET_ACCOUNTS.ANTHROPIC_API_KEY,
    envVar: "ANTHROPIC_API_KEY",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    vendor: "Anthropic",
    supportsGateway: true,
    gatewayVars: {
      baseUrl: "ANTHROPIC_BASE_URL",
      customHeaders: "ANTHROPIC_CUSTOM_HEADERS",
    },
  },
  "codex-acp": {
    secretAccount: SECRET_ACCOUNTS.OPENAI_API_KEY,
    envVar: "OPENAI_API_KEY",
    consoleUrl: "https://platform.openai.com/api-keys",
    vendor: "OpenAI",
  },
  gemini: {
    secretAccount: "gemini-api-key",
    envVar: "GEMINI_API_KEY",
    consoleUrl: "https://aistudio.google.com/apikey",
    vendor: "Google",
  },
};

interface AuthModalProps {
  agent: BridgeRegistryAgent;
  /** Initialize response from the agent. null while still loading. */
  initialize: InitializeResponse | null;
  onConfirm: (choice: AuthChoice) => void;
  onBack: () => void;
}

// ── Internal model: each option the modal may render. ──────

type OptionId = string;

interface OptionBase {
  id: OptionId;
  title: string;
  description: string;
  icon: React.ReactNode;
  /** The ACP-spec method id to echo back. "" for pure env-only synthetic options. */
  methodId: string;
  kind: AuthMethodKind;
}

interface OptionEnvVars extends OptionBase {
  kind: "env_var";
  /** Optional getting-started link shown below the fields (per ACP spec). */
  link?: string | null;
  /** Inputs to render — one per var the user needs to provide. */
  vars: Array<{
    name: string;
    label: string;
    secret: boolean;
    optional: boolean;
    /** Keychain account (present only when the var is a known secret slot). */
    keychain?: string;
  }>;
}

interface OptionTerminal extends OptionBase {
  kind: "terminal";
}

interface OptionAgentKind extends OptionBase {
  kind: "agent";
}

type Option = OptionEnvVars | OptionTerminal | OptionAgentKind;

// ───────────────────────────────────────────────────────────

export function AuthModal({ agent, initialize, onConfirm, onBack }: AuthModalProps) {
  const config = AGENT_AUTH_CONFIG[agent.id];

  const options = useMemo(
    () => buildOptions(agent.id, initialize, config),
    [agent.id, initialize, config],
  );

  // Auto-start if nothing interactive to do. E.g. an agent-kind method with no
  // advertised interactive methods — the agent handles its own auth internally.
  useEffect(() => {
    if (!initialize) return;
    const interactive = options.some(
      (o) => o.kind === "env_var" || o.kind === "terminal",
    );
    if (!interactive) {
      const first = options[0];
      onConfirm({
        methodId: first?.methodId ?? "",
        kind: first?.kind ?? "agent",
        env: {},
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialize]);

  const [selectedId, setSelectedId] = useState<OptionId | null>(null);
  useEffect(() => {
    if (!selectedId && options.length > 0) setSelectedId(options[0].id);
  }, [options, selectedId]);

  const selected = options.find((o) => o.id === selectedId) ?? null;

  // Per-option collected values (method id → var name → value).
  const [varValues, setVarValues] = useState<Record<OptionId, Record<string, string>>>({});
  const [keychainLoaded, setKeychainLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill env-var options from the keychain (per-var).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<OptionId, Record<string, string>> = {};
      for (const opt of options) {
        if (opt.kind !== "env_var") continue;
        const values: Record<string, string> = {};
        for (const v of opt.vars) {
          if (!v.keychain) continue;
          try {
            const val = await getSecret(v.keychain);
            if (val) values[v.name] = val;
          } catch {
            /* keychain miss — leave blank */
          }
        }
        if (Object.keys(values).length > 0) next[opt.id] = values;
      }
      if (!cancelled) {
        setVarValues((prev) => ({ ...prev, ...next }));
        setKeychainLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  if (!initialize) {
    return (
      <div className="oc-acp-loading">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Initializing {agent.name}...
      </div>
    );
  }

  const setVar = (optId: OptionId, name: string, value: string) => {
    setVarValues((prev) => ({
      ...prev,
      [optId]: { ...(prev[optId] ?? {}), [name]: value },
    }));
  };

  const handleConfirm = async () => {
    setError(null);
    if (!selected) return;

    if (selected.kind === "terminal") {
      onConfirm({ methodId: selected.methodId, kind: "terminal", env: {} });
      return;
    }

    if (selected.kind === "agent") {
      onConfirm({ methodId: selected.methodId, kind: "agent", env: {} });
      return;
    }

    // env_var — collect + validate + persist.
    const collected = varValues[selected.id] ?? {};
    const missing = selected.vars.filter(
      (v) => !v.optional && !String(collected[v.name] ?? "").trim(),
    );
    if (missing.length > 0) {
      setError(
        `Missing: ${missing.map((v) => v.label).join(", ")}. Provide a value or switch options.`,
      );
      return;
    }

    setSaving(true);
    try {
      const env: Record<string, string> = {};
      for (const v of selected.vars) {
        const raw = String(collected[v.name] ?? "").trim();
        if (!raw) continue;
        env[v.name] = raw;
        if (v.secret && v.keychain) {
          try {
            await setSecret(v.keychain, raw);
          } catch {
            /* non-fatal — keychain write can fail on dev web harness */
          }
        }
      }
      onConfirm({ methodId: selected.methodId, kind: "env_var", env });
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
            {options.length === 0
              ? "Agent didn't advertise any auth methods"
              : "How should this agent authenticate?"}
          </div>
        </div>
      </header>

      <div
        className="oc-acp-auth-body"
        style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
      >
        {options.map((opt) => (
          <MethodCard
            key={opt.id}
            active={selected?.id === opt.id}
            onClick={() => setSelectedId(opt.id)}
            icon={opt.icon}
            title={opt.title}
            description={opt.description}
          />
        ))}

        {selected?.kind === "env_var" && (
          <div className="oc-acp-auth-field">
            {selected.vars.map((v) => {
              const val = varValues[selected.id]?.[v.name] ?? "";
              return (
                <div key={v.name} style={{ marginBottom: "var(--space-3)" }}>
                  <div className="oc-acp-auth-label">
                    {v.label}
                    {v.optional && (
                      <span style={{ color: "var(--text-hint)", marginLeft: 4 }}>
                        (optional)
                      </span>
                    )}
                  </div>
                  <Input
                    type={v.secret ? "password" : "text"}
                    value={val}
                    onChange={(e) => setVar(selected.id, v.name, e.target.value)}
                    placeholder={
                      keychainLoaded
                        ? v.secret
                          ? "sk-..."
                          : ""
                        : "Loading..."
                    }
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              );
            })}
            <div className="oc-acp-auth-field-meta">
              {(selected.link || resolveLink(selected, config)) && (
                <a
                  href={selected.link || resolveLink(selected, config) || "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get your credentials →
                </a>
              )}
              {selected.vars.some((v) => v.secret && v.keychain) && (
                <span className="oc-acp-auth-field-meta-badge">
                  <ShieldCheck className="w-3 h-3" /> keychain
                </span>
              )}
            </div>
          </div>
        )}

        {selected?.kind === "terminal" && (
          <div className="oc-acp-auth-disclaimer">
            <Info
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ marginTop: "var(--space-1)" }}
            />
            <div>
              <div className="oc-acp-auth-disclaimer-title">
                Uses your locally-installed CLI
              </div>
              <div>
                Run the CLI's own login command in your terminal before starting a
                session. Zeros spawns the CLI and the CLI handles its own auth
                — we never see, store, or proxy the token.
                {config?.vendor
                  ? ` Subject to ${config.vendor}'s terms of service, which you may revoke at any time.`
                  : ""}
              </div>
            </div>
          </div>
        )}

        {selected?.kind === "agent" && (
          <div className="oc-acp-auth-disclaimer">
            <Info
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ marginTop: "var(--space-1)" }}
            />
            <div>
              <div className="oc-acp-auth-disclaimer-title">
                Agent handles its own auth
              </div>
              <div>
                This method runs entirely inside {agent.name}. Zeros just spawns
                the subprocess — no credentials pass through us.
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
          disabled={saving || !selected}
          loading={saving}
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  );
}

// ── Option construction ────────────────────────────────────

/**
 * Translate the agent's advertised authMethods (plus any known-vendor
 * synthetic options like Claude's Gateway) into the concrete list of
 * cards the modal renders. Keeps the render logic purely data-driven.
 */
function buildOptions(
  agentId: string,
  initialize: InitializeResponse | null,
  config: AgentAuthConfig | undefined,
): Option[] {
  const out: Option[] = [];
  const advertised = initialize?.authMethods ?? [];

  // 1. Every method the agent told us about, in advertised order.
  for (const m of advertised) {
    out.push(methodToOption(agentId, m, config));
  }

  // 2. Synthetic fallbacks if the agent advertised nothing interactive.
  const interactive = out.some(
    (o) => o.kind === "env_var" || o.kind === "terminal",
  );
  if (!interactive && config?.secretAccount && config?.envVar) {
    out.push(defaultEnvVarOption(agentId, config));
    out.push(defaultTerminalOption(config));
  }

  // 3. Claude-specific Gateway option, always offered for claude-acp.
  if (agentId === "claude-acp" && config?.supportsGateway && config.gatewayVars) {
    out.push(buildGatewayOption(config));
  }

  return out;
}

function methodToOption(
  agentId: string,
  method: AuthMethod,
  config: AgentAuthConfig | undefined,
): Option {
  const base = {
    id: method.id || `m-${Math.random().toString(36).slice(2, 8)}`,
    methodId: method.id ?? "",
    title: method.name || method.id || "Authenticate",
    description: method.description ?? "",
  };

  // AuthMethod is a discriminated union on `type`.
  if ("type" in method && method.type === "env_var") {
    const vars = method.vars ?? [];
    return {
      ...base,
      kind: "env_var",
      icon: <Key className="w-3.5 h-3.5" />,
      link: method.link ?? null,
      vars: vars.map((v) => ({
        name: v.name,
        label: v.label ?? v.name,
        secret: v.secret ?? true,
        optional: v.optional ?? false,
        keychain: keychainFor(agentId, v.name, config),
      })),
    };
  }

  if ("type" in method && method.type === "terminal") {
    return {
      ...base,
      kind: "terminal",
      icon: <Terminal className="w-3.5 h-3.5" />,
      description: base.description || "Authenticate via an interactive CLI flow.",
    };
  }

  // Default / AuthMethodAgent
  return {
    ...base,
    kind: "agent",
    icon: <Bot className="w-3.5 h-3.5" />,
    description:
      base.description || "The agent handles authentication itself.",
  };
}

/**
 * Pick a keychain slot for this env var. Well-known vendor vars use the
 * centralised SECRET_ACCOUNTS slots; everything else gets a namespaced
 * fallback keyed by agent id + var name so two agents can share a slot name
 * without collision.
 */
function keychainFor(
  agentId: string,
  varName: string,
  config: AgentAuthConfig | undefined,
): string {
  if (config?.envVar && config?.secretAccount && varName === config.envVar) {
    return config.secretAccount;
  }
  return `acp::${agentId}::${varName}`;
}

function defaultEnvVarOption(
  agentId: string,
  config: AgentAuthConfig,
): OptionEnvVars {
  return {
    id: "default-api-key",
    methodId: "",
    kind: "env_var",
    title: `${config.vendor} API key (Recommended)`,
    description: `Stored in your OS keychain. Injected as ${config.envVar} when the agent starts. Only this session sees it.`,
    icon: <Key className="w-3.5 h-3.5" />,
    link: config.consoleUrl ?? null,
    vars: [
      {
        name: config.envVar!,
        label: `${config.vendor} API key`,
        secret: true,
        optional: false,
        keychain: keychainFor(agentId, config.envVar!, config),
      },
    ],
  };
}

function defaultTerminalOption(config: AgentAuthConfig): OptionTerminal {
  return {
    id: "default-subscription",
    methodId: "",
    kind: "terminal",
    title: `Use my installed ${config.vendor} CLI`,
    description: `Relies on your existing login in the ${config.vendor} CLI. Your credentials never leave your machine; Zeros never sees them. Subject to ${config.vendor}'s terms of service.`,
    icon: <Terminal className="w-3.5 h-3.5" />,
  };
}

function buildGatewayOption(config: AgentAuthConfig): OptionEnvVars {
  const gw = config.gatewayVars!;
  return {
    id: "gateway",
    methodId: "",
    kind: "env_var",
    title: `Gateway (advanced)`,
    description: `Point ${config.vendor}'s CLI at a compatible proxy (e.g. LiteLLM, corporate gateway) by overriding the base URL and, optionally, custom headers.`,
    icon: <Radio className="w-3.5 h-3.5" />,
    link: null,
    vars: [
      {
        name: gw.baseUrl,
        label: "Base URL",
        secret: false,
        optional: false,
        keychain: `acp::claude-acp::${gw.baseUrl}`,
      },
      ...(gw.customHeaders
        ? [
            {
              name: gw.customHeaders,
              label: "Custom headers (JSON or Header: Value pairs)",
              secret: true,
              optional: true,
              keychain: `acp::claude-acp::${gw.customHeaders}`,
            },
          ]
        : []),
    ],
  };
}

/** Fall back to the vendor's console URL if the advertised method didn't supply a link. */
function resolveLink(
  opt: OptionEnvVars,
  config: AgentAuthConfig | undefined,
): string | null {
  if (opt.link) return opt.link;
  if (!config?.consoleUrl) return null;
  // Only show the vendor console link when the selected option is plausibly
  // about a primary API key (not, say, the gateway card).
  const hasPrimaryVar = opt.vars.some(
    (v) => config.envVar && v.name === config.envVar,
  );
  return hasPrimaryVar ? config.consoleUrl : null;
}

// ── Card ────────────────────────────────────────────────────

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
