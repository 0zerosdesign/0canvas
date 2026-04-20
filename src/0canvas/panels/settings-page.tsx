// ──────────────────────────────────────────────────────────
// Settings page (Phase 2-E revamp)
// ──────────────────────────────────────────────────────────
//
// Sidebar + detail pane. Each section is a self-contained panel
// so adding/removing one is a single line change. Sections that
// need real backend work (MCP servers, Accounts/Auth) ship as
// stubs with a "coming later" line rather than as phantom UI —
// that way nothing pretends to be wired when it isn't.
// ──────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect, type ComponentType } from "react";
import {
  Sparkles,
  KeyRound,
  Palette,
  Plug,
  Wrench,
  User,
  ArrowLeft,
  Key,
  CheckCircle,
  LogOut as LogOutIcon,
  type LucideIcon,
} from "lucide-react";
import {
  useWorkspace,
  type AiSettings,
  type AiProvider,
  type AiAuthMethod,
  type AiThinkingEffort,
} from "../store/store";
import { ScrollArea } from "../ui/scroll-area";
import {
  loadAiSettings,
  saveAiSettings,
  hydrateAiApiKey,
  AVAILABLE_MODELS,
} from "../lib/openai";
import { checkCli, isCliAuthenticated, runCliLogin } from "../lib/ai-cli";
import { shellOpenUrl } from "../../native/tauri-events";
import {
  getSecret,
  setSecret,
  deleteSecret,
  SECRET_ACCOUNTS,
} from "../../native/secrets";

type SectionId =
  | "general"
  | "ai-models"
  | "api-keys"
  | "appearance"
  | "mcp"
  | "debug";

type SectionDef = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  Panel: ComponentType;
};

const SECTIONS: SectionDef[] = [
  { id: "general", label: "General", icon: User, Panel: GeneralPanel },
  { id: "ai-models", label: "AI Models", icon: Sparkles, Panel: AiSettingsPanel },
  { id: "api-keys", label: "API Keys", icon: KeyRound, Panel: ApiKeysPanel },
  { id: "appearance", label: "Appearance", icon: Palette, Panel: AppearancePanel },
  { id: "mcp", label: "MCP Servers", icon: Plug, Panel: McpPanel },
  { id: "debug", label: "Debug", icon: Wrench, Panel: DebugPanel },
];

export function SettingsPage() {
  const { dispatch } = useWorkspace();
  const [active, setActive] = useState<SectionId>("general");
  const activeDef = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];
  const { Panel } = activeDef;

  const handleBack = () => {
    dispatch({ type: "SET_ACTIVE_PAGE", page: "design" });
  };

  return (
    <div className="oc-settings-page">
      <nav className="oc-settings-tabs" role="tablist" data-tauri-drag-region>
        <button
          className="oc-settings-tab oc-settings-tab--back"
          onClick={handleBack}
          title="Back to app"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={isActive}
              className={`oc-settings-tab ${isActive ? "is-active" : ""}`}
              onClick={() => setActive(id)}
              title={label}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="oc-settings-content">
        <ScrollArea className="oc-settings-scroll">
          <Panel />
        </ScrollArea>
      </div>
    </div>
  );
}

// ── General ─────────────────────────────────────────────

function GeneralPanel() {
  return (
    <div className="oc-settings-panel">
      <div className="oc-settings-section-title">Account</div>
      <p className="oc-ai-hint">
        Accounts and plan management arrive in Phase 5 (signed
        distribution). Until then 0canvas runs in free/BYO-key mode —
        configure your provider in <strong>AI Models</strong>.
      </p>
    </div>
  );
}

// ── AI Settings (migrated from old settings page) ──────

// ── Provider tiles (matches Clonk-style screenshot) ──
//
// Two tiles: Claude (via Claude Agent SDK / CLI) and OpenAI Codex.
// These are the only two providers Phase 4 supports — the legacy
// "chatgpt / openai / ide" strings remain on `AiProvider` so old
// saved settings round-trip on load, but the UI never exposes them.

const PROVIDER_TILES: Array<{
  value: "claude" | "codex";
  label: string;
  glyph: React.ReactNode;
}> = [
  {
    value: "claude",
    label: "Claude SDK",
    glyph: <Sparkles size={16} className="oc-ai-tile-glyph is-claude" />,
  },
  {
    value: "codex",
    label: "OpenAI Codex",
    glyph: <Sparkles size={16} className="oc-ai-tile-glyph is-codex" />,
  },
];

const EFFORT_OPTIONS: Array<{
  value: AiThinkingEffort;
  label: string;
  hint: string;
}> = [
  { value: "low", label: "Low", hint: "Quick answers" },
  { value: "medium", label: "Medium", hint: "Balanced" },
  { value: "high", label: "High", hint: "Thorough" },
  { value: "xhigh", label: "xHigh", hint: "Long-horizon" },
];

function AiSettingsPanel() {
  const { state, dispatch } = useWorkspace();
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [saved, setSaved] = useState(false);
  const [cliStatus, setCliStatus] = useState<Record<string, string | null>>({});

  // Hydrate from store on mount (keychain already merged in by
  // HydrateAiApiKey at app boot).
  useEffect(() => {
    setSettings(state.aiSettings);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Probe whether `claude` / `codex` are on PATH so we can show a
  // "Signed in" vs "Install the CLI first" hint.
  const refreshCliStatus = useCallback(async () => {
    const c = await checkCli("claude").catch(() => null);
    const o = await checkCli("codex").catch(() => null);
    setCliStatus({ claude: c, codex: o });
  }, []);
  useEffect(() => {
    void refreshCliStatus();
  }, [refreshCliStatus]);

  // Auto-save on any field change so the new settings flow behaves
  // like the rest of the Mac app — no "Save" button needed for these
  // low-stakes preferences. When the provider changes we re-hydrate
  // the apiKey from the correct keychain slot so the next chat call
  // doesn't send the wrong provider's token.
  const updateField = useCallback(
    async <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
      let next = { ...settings, [key]: value } as AiSettings;
      if (key === "provider") {
        next = await hydrateAiApiKey(next);
      }
      setSettings(next);
      setSaved(false);
      await saveAiSettings(next);
      dispatch({ type: "SET_AI_SETTINGS", settings: next });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    },
    [settings, dispatch],
  );

  // Map the legacy saved values onto the new "claude/codex" tiles so
  // users whose settings.json predates Phase 4 land somewhere sensible.
  const activeProvider: "claude" | "codex" =
    settings.provider === "claude" || settings.provider === "codex"
      ? settings.provider
      : "claude";

  return (
    <div className="oc-ai-settings" data-0canvas="ai-settings">
      <div className="oc-settings-section-title">Connect a provider</div>

      <div className="oc-ai-tiles">
        {PROVIDER_TILES.map(({ value, label, glyph }) => (
          <button
            key={value}
            className={`oc-ai-tile ${activeProvider === value ? "is-active" : ""}`}
            onClick={() => updateField("provider", value)}
          >
            {glyph}
            <span className="oc-ai-tile-label">{label}</span>
          </button>
        ))}
      </div>

      <AuthMethodBlock
        provider={activeProvider}
        settings={settings}
        cliStatus={cliStatus}
        refreshCliStatus={refreshCliStatus}
        onChange={updateField}
      />

      <div className="oc-ai-card">
        <div className="oc-ai-card-head">
          <div>
            <div className="oc-ai-card-title">Adaptive Thinking Effort</div>
            <p className="oc-ai-card-hint">
              Controls how much reasoning the model does before responding
              (via <code>--effort</code> flag).
            </p>
          </div>
        </div>
        <div className="oc-ai-effort-row">
          {EFFORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`oc-ai-effort ${settings.thinkingEffort === opt.value ? "is-active" : ""}`}
              onClick={() => updateField("thinkingEffort", opt.value)}
            >
              <span className="oc-ai-effort-label">{opt.label}</span>
              <span className="oc-ai-effort-hint">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="oc-ai-card">
        <div className="oc-ai-card-head oc-ai-card-head--row">
          <div>
            <div className="oc-ai-card-title">
              Agent Teams{" "}
              <span className="oc-ai-chip is-warn">EXPERIMENTAL</span>
            </div>
            <p className="oc-ai-card-hint">
              Coordinate teams of Claude instances working in parallel on
              complex tasks. Uses significantly more tokens.
            </p>
          </div>
          <label className="oc-ai-toggle">
            <input
              type="checkbox"
              checked={settings.agentTeams}
              onChange={(e) => updateField("agentTeams", e.target.checked)}
            />
            <span className="oc-ai-toggle-track" />
          </label>
        </div>
      </div>

      {saved && <div className="oc-ai-saved-toast">Saved</div>}
    </div>
  );
}

function AuthMethodBlock({
  provider,
  settings,
  cliStatus,
  refreshCliStatus,
  onChange,
}: {
  provider: "claude" | "codex";
  settings: AiSettings;
  cliStatus: Record<string, string | null>;
  refreshCliStatus: () => Promise<void>;
  onChange: <K extends keyof AiSettings>(
    k: K,
    v: AiSettings[K],
  ) => Promise<void>;
}) {
  const cliInstalled = !!cliStatus[provider];
  const subscriptionLabel = provider === "claude" ? "Claude Pro" : "ChatGPT Pro";
  const cliName = provider === "claude" ? "claude" : "codex";

  // Token-file probe — presence of ~/.claude/.credentials.json or
  // ~/.codex/auth.json. The login modal polls it, the header chip
  // reads the latest value.
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    isCliAuthenticated(cliName)
      .then((v) => {
        if (!cancelled) setAuthed(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cliName]);

  const [loginOpen, setLoginOpen] = useState(false);
  const handleOpenLogin = async () => {
    setLoginOpen(true);
    try {
      await runCliLogin(cliName);
    } catch {
      /* Terminal failed to open — modal still informs the user. */
    }
  };

  const [apiKeyDraft, setApiKeyDraft] = useState<string>("");
  const [apiKeyStored, setApiKeyStored] = useState<boolean | null>(null);

  const apiSlot =
    provider === "claude"
      ? SECRET_ACCOUNTS.ANTHROPIC_API_KEY
      : SECRET_ACCOUNTS.OPENAI_API_KEY;

  useEffect(() => {
    (async () => {
      try {
        const v = await getSecret(apiSlot);
        setApiKeyStored(!!v);
        setApiKeyDraft(v ?? "");
      } catch {
        setApiKeyStored(false);
      }
    })();
  }, [apiSlot]);

  const handleSaveKey = async () => {
    if (apiKeyDraft.trim()) {
      await setSecret(apiSlot, apiKeyDraft.trim());
      setApiKeyStored(true);
    } else {
      await deleteSecret(apiSlot);
      setApiKeyStored(false);
    }
    await onChange("apiKey", apiKeyDraft.trim());
  };

  return (
    <div className="oc-ai-auth">
      <div className="oc-ai-auth-head">
        <span className="oc-settings-section-title">Authentication Method</span>
        <span
          className={`oc-ai-chip ${
            settings.authMethod === "subscription" ? "is-info" : "is-success"
          }`}
        >
          {settings.authMethod === "subscription"
            ? `${subscriptionLabel} Mode`
            : "API Key Mode"}
        </span>
      </div>

      <div className="oc-ai-auth-tabs">
        <button
          className={`oc-ai-auth-tab ${
            settings.authMethod === "subscription" ? "is-active is-info" : ""
          }`}
          onClick={() => onChange("authMethod", "subscription")}
        >
          <Sparkles size={13} />
          <span>{subscriptionLabel}</span>
        </button>
        <button
          className={`oc-ai-auth-tab ${
            settings.authMethod === "api-key" ? "is-active is-success" : ""
          }`}
          onClick={() => onChange("authMethod", "api-key")}
        >
          <Key size={13} />
          <span>API Key</span>
        </button>
      </div>

      {settings.authMethod === "subscription" && (
        <div className="oc-ai-auth-panel is-info">
          <div className="oc-ai-auth-panel-head">
            <Sparkles size={14} />
            <strong>{subscriptionLabel} Subscription</strong>
            <span
              className={`oc-ai-chip ${
                cliInstalled && authed
                  ? "is-success"
                  : cliInstalled
                    ? "is-info"
                    : "is-warn"
              }`}
            >
              {cliInstalled && authed
                ? "ACTIVE"
                : cliInstalled
                  ? "NOT SIGNED IN"
                  : "CLI MISSING"}
            </span>
          </div>
          {cliInstalled && authed ? (
            <div className="oc-ai-auth-row">
              <CheckCircle size={13} />
              <span>
                Signed in via <code>{cliName}</code> login
              </span>
              <button
                className="oc-ai-auth-icon"
                title={`Sign in again (runs \`${cliName} login\` in Terminal)`}
                onClick={handleOpenLogin}
              >
                <LogOutIcon size={13} />
              </button>
            </div>
          ) : cliInstalled && !authed ? (
            <div className="oc-ai-auth-row">
              <span>
                <code>{cliName}</code> is installed but not signed in yet.
              </span>
              <button
                className="oc-ai-save-btn is-compact"
                onClick={handleOpenLogin}
              >
                Sign in with {subscriptionLabel}
              </button>
            </div>
          ) : (
            <div className="oc-ai-auth-install">
              <code className="oc-ai-auth-cmd">
                npm install -g{" "}
                {cliName === "claude"
                  ? "@anthropic-ai/claude-code"
                  : "@openai/codex"}
              </code>
              <p className="oc-ai-card-hint">
                After install, run <code>{cliName} login</code> once. You can
                copy the command above or open the install docs:
              </p>
              <div className="oc-ai-auth-row">
                <button
                  className="oc-ai-save-btn is-compact"
                  onClick={() =>
                    shellOpenUrl(
                      cliName === "claude"
                        ? "https://docs.claude.com/en/docs/claude-code/setup"
                        : "https://developers.openai.com/codex/cli",
                    ).catch(() => {})
                  }
                >
                  Open install docs
                </button>
                <button
                  className="oc-ai-save-btn is-compact is-ghost"
                  onClick={handleOpenLogin}
                  title="Runs the login command in Terminal — only works after the CLI is installed"
                >
                  Try login anyway
                </button>
              </div>
            </div>
          )}
          <p className="oc-ai-card-hint">
            Use your {subscriptionLabel} subscription for unlimited usage.
            0canvas never touches the OAuth tokens directly —
            the {cliName} CLI owns your login.
          </p>
        </div>
      )}

      {settings.authMethod === "api-key" && (
        <div className="oc-ai-auth-panel is-success">
          <div className="oc-ai-auth-panel-head">
            <Key size={14} />
            <strong>
              {provider === "claude" ? "Anthropic" : "OpenAI"} API Key
            </strong>
            {apiKeyStored && (
              <span className="oc-ai-chip is-success">ACTIVE</span>
            )}
          </div>
          <div className="oc-ai-auth-row">
            <input
              type="password"
              className="oc-ai-field-input"
              placeholder="sk-…"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              autoComplete="off"
            />
            <button
              className="oc-ai-save-btn is-compact"
              onClick={handleSaveKey}
            >
              Save
            </button>
          </div>
          <p className="oc-ai-card-hint">
            Pay-per-use with API credits. Get your key from{" "}
            {provider === "claude" ? (
              <code>console.anthropic.com</code>
            ) : (
              <code>platform.openai.com</code>
            )}
            . Stored in the macOS keychain.
          </p>
        </div>
      )}
      {loginOpen && (
        <LoginModal
          cliName={cliName}
          subscriptionLabel={subscriptionLabel}
          onClose={() => setLoginOpen(false)}
          onDone={async () => {
            setAuthed(true);
            setLoginOpen(false);
            await refreshCliStatus();
          }}
          onAuthDetected={async () => {
            setAuthed(true);
            await refreshCliStatus();
          }}
          initialCliInstalled={cliInstalled}
        />
      )}
    </div>
  );
}

// ── Login modal (Phase 4 polish) ─────────────────────────
//
// Opens after the user clicks "Sign in" / "Open login in Terminal".
// Polls both the CLI-on-PATH probe and the token-file probe every 2s.
// When both come back true, auto-flips to "Signed in" and the user
// can click Done (or wait for auto-close after 1.5s).

function LoginModal({
  cliName,
  subscriptionLabel,
  initialCliInstalled,
  onClose,
  onDone,
  onAuthDetected,
}: {
  cliName: "claude" | "codex";
  subscriptionLabel: string;
  initialCliInstalled: boolean;
  onClose: () => void;
  onDone: () => Promise<void> | void;
  onAuthDetected: () => Promise<void> | void;
}) {
  const [cliInstalled, setCliInstalled] = useState(initialCliInstalled);
  const [authed, setAuthed] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const success = cliInstalled && authed;

  // Poll every 2s for up to 5 minutes so the user has room to finish
  // install-then-login. Stops immediately when both probes succeed.
  useEffect(() => {
    let cancelled = false;
    const maxPolls = 150;
    const tick = async () => {
      if (cancelled) return;
      const [installed, ok] = await Promise.all([
        checkCli(cliName),
        isCliAuthenticated(cliName),
      ]);
      if (cancelled) return;
      setCliInstalled(!!installed);
      if (ok && !authed) {
        setAuthed(true);
        await Promise.resolve(onAuthDetected());
      } else {
        setAuthed(ok);
      }
    };
    void tick();
    const id = window.setInterval(() => {
      setPollCount((c) => {
        if (c + 1 >= maxPolls) {
          window.clearInterval(id);
          return c;
        }
        void tick();
        return c + 1;
      });
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [cliName, authed, onAuthDetected]);

  // Esc to close, same contract as other modals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Auto-close a moment after both probes succeed so the user doesn't
  // have to reach for Done on the happy path.
  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => {
      void Promise.resolve(onDone());
    }, 1500);
    return () => window.clearTimeout(id);
  }, [success, onDone]);

  return (
    <div className="oc-login-modal-backdrop" onClick={onClose}>
      <div
        className="oc-login-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="oc-login-modal__head">
          <Sparkles size={14} />
          <strong>Sign in with {subscriptionLabel}</strong>
          <button
            className="oc-ai-auth-icon"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>
        <p className="oc-login-modal__lead">
          Terminal opened and is running <code>{cliName} login</code>.
          Complete the sign-in there — we&rsquo;ll detect it automatically.
        </p>
        <ul className="oc-login-modal__steps">
          <li className={cliInstalled ? "is-done" : "is-pending"}>
            <span className="oc-login-modal__dot" />
            <span>
              <code>{cliName}</code> CLI installed
            </span>
            {cliInstalled ? (
              <CheckCircle size={12} />
            ) : (
              <span className="oc-login-modal__muted">waiting…</span>
            )}
          </li>
          <li className={authed ? "is-done" : "is-pending"}>
            <span className="oc-login-modal__dot" />
            <span>Signed in (token cached by CLI)</span>
            {authed ? (
              <CheckCircle size={12} />
            ) : (
              <span className="oc-login-modal__muted">waiting…</span>
            )}
          </li>
        </ul>
        {success ? (
          <div className="oc-login-modal__success">
            <CheckCircle size={14} />
            <span>You&rsquo;re signed in. Closing…</span>
          </div>
        ) : (
          <p className="oc-login-modal__hint">
            This window polls every 2 seconds. If nothing happens after the
            OAuth flow finishes, click <strong>I&rsquo;m signed in</strong>.
          </p>
        )}
        <div className="oc-login-modal__actions">
          <button
            className="oc-ai-save-btn is-compact is-ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="oc-ai-save-btn is-compact"
            onClick={() => void Promise.resolve(onDone())}
          >
            {success ? "Done" : "I'm signed in"}
          </button>
        </div>
        <div className="oc-login-modal__footer">
          Poll {pollCount}
          {pollCount > 0 && <span> · checked {pollCount * 2}s ago max</span>}
        </div>
      </div>
    </div>
  );
}

// ── API Keys (keychain-backed) ──────────────────────────

type KeySlot = {
  account: string;
  label: string;
  hint: string;
  placeholder: string;
};

const KEY_SLOTS: KeySlot[] = [
  {
    account: SECRET_ACCOUNTS.OPENAI_API_KEY,
    label: "OpenAI API Key",
    hint: "Used when AI Models → OpenAI API is selected.",
    placeholder: "sk-...",
  },
  {
    account: SECRET_ACCOUNTS.ANTHROPIC_API_KEY,
    label: "Anthropic API Key",
    hint: "Reserved for Phase 4 when Claude is wired into the chat.",
    placeholder: "sk-ant-...",
  },
  {
    account: SECRET_ACCOUNTS.GITHUB_PAT,
    label: "GitHub Personal Access Token",
    hint: "Optional — only needed when cloning private repos in-app.",
    placeholder: "ghp_...",
  },
];

function ApiKeysPanel() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [savingAccount, setSavingAccount] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ account: string; text: string } | null>(null);

  // Load each key once on mount. Reveal == show as "••••••" until the
  // user clicks "Show" on the input.
  useEffect(() => {
    (async () => {
      for (const slot of KEY_SLOTS) {
        try {
          const v = await getSecret(slot.account);
          setValues((prev) => ({ ...prev, [slot.account]: v ?? "" }));
        } catch {
          setValues((prev) => ({ ...prev, [slot.account]: "" }));
        } finally {
          setLoaded((prev) => ({ ...prev, [slot.account]: true }));
        }
      }
    })();
  }, []);

  const handleSave = async (account: string) => {
    const value = values[account] ?? "";
    setSavingAccount(account);
    try {
      if (value.trim()) {
        await setSecret(account, value.trim());
        setNotice({ account, text: "Saved to keychain." });
      } else {
        await deleteSecret(account);
        setNotice({ account, text: "Removed from keychain." });
      }
      setTimeout(() => setNotice(null), 2000);
    } catch (err) {
      setNotice({ account, text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSavingAccount(null);
    }
  };

  return (
    <div className="oc-settings-panel">
      <div className="oc-settings-section-title">API Keys</div>
      <p className="oc-ai-hint">
        Secrets live in the macOS keychain under service
        <code> 0canvas</code>. They're never written to
        <code> settings.json</code> or transmitted outside your machine.
      </p>

      {KEY_SLOTS.map((slot) => (
        <div key={slot.account} className="oc-api-keys__row">
          <label className="oc-ai-field">
            <span className="oc-ai-field-label">{slot.label}</span>
            <input
              className="oc-ai-field-input"
              type="password"
              autoComplete="off"
              placeholder={loaded[slot.account] ? slot.placeholder : "Loading…"}
              value={values[slot.account] ?? ""}
              disabled={!loaded[slot.account]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [slot.account]: e.target.value }))
              }
            />
            <span className="oc-ai-field-hint">{slot.hint}</span>
          </label>
          <div className="oc-api-keys__row-actions">
            <button
              className="oc-ai-save-btn is-compact"
              disabled={savingAccount === slot.account}
              onClick={() => handleSave(slot.account)}
            >
              {savingAccount === slot.account ? "Saving…" : "Save"}
            </button>
            {notice?.account === slot.account && (
              <span className="oc-api-keys__notice">{notice.text}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Appearance (stub — theming lives in engine styles for now) ──

function AppearancePanel() {
  return (
    <div className="oc-settings-panel">
      <div className="oc-settings-section-title">Appearance</div>
      <p className="oc-ai-hint">
        Theme, accent color, and font size controls arrive in a
        follow-up pass. The current surface uses the dark palette
        defined in the injected engine stylesheet.
      </p>
    </div>
  );
}

// ── MCP Servers (stub — wired in Phase 4) ────────────────

function McpPanel() {
  return (
    <div className="oc-settings-panel">
      <div className="oc-settings-section-title">MCP Servers</div>
      <p className="oc-ai-hint">
        The built-in engine exposes its own MCP server on the engine
        port. User-installed servers (Context7, Figma, Supabase, etc.)
        arrive in Phase 4 alongside the Claude CLI integration.
      </p>
    </div>
  );
}

// ── Debug ───────────────────────────────────────────────

function DebugPanel() {
  const { state } = useWorkspace();
  const [root, setRoot] = useState<string>("");
  const [port, setPort] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (!("__TAURI_INTERNALS__" in window)) return;
      const { invoke } = await import("@tauri-apps/api/core");
      try {
        const r = await invoke<string | null>("get_engine_root");
        setRoot(r ?? "");
      } catch {
        /* ignore */
      }
      try {
        const p = await invoke<number | null>("get_engine_port");
        setPort(p ?? null);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const rows: Array<[string, React.ReactNode]> = [
    ["Engine root", root || "(unknown)"],
    ["Engine port", port ?? "(unknown)"],
    ["Project", state.project?.name ?? "(none)"],
    ["Framework", state.project?.framework ?? "(unknown)"],
    ["Active chat", state.activeChatId ?? "(none)"],
    ["Chat count", state.chats.length],
    ["Variant count", state.variants.length],
    ["Feedback count", state.feedbackItems.length],
  ];

  return (
    <div className="oc-settings-panel">
      <div className="oc-settings-section-title">Debug</div>
      <p className="oc-ai-hint">
        Runtime values for quick sanity checks. Not meant for day-to-day
        use — when something's off, these are the first things to
        inspect.
      </p>
      <table className="oc-debug-table">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td><code>{String(v)}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
