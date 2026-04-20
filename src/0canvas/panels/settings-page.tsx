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
  type LucideIcon,
} from "lucide-react";
import { useWorkspace, type AiSettings, type AiProvider } from "../store/store";
import { ScrollArea } from "../ui/scroll-area";
import { loadAiSettings, saveAiSettings, AVAILABLE_MODELS } from "../lib/openai";
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
  const [active, setActive] = useState<SectionId>("ai-models");
  const activeDef = SECTIONS.find((s) => s.id === active) ?? SECTIONS[1];
  const { Panel } = activeDef;

  return (
    <div className="oc-settings-page">
      <div className="oc-settings-nav">
        <div className="oc-settings-nav-header">Settings</div>
        <div className="oc-settings-nav-list">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`oc-settings-nav-item ${active === id ? "is-active" : ""}`}
              onClick={() => setActive(id)}
            >
              <span className="oc-settings-nav-icon"><Icon size={16} /></span>
              <span className="oc-settings-nav-label">{label}</span>
            </button>
          ))}
        </div>
      </div>

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

function AiSettingsPanel() {
  const { state, dispatch } = useWorkspace();
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [saved, setSaved] = useState(false);

  // Hydrate from store on mount (keychain already merged in by
  // HydrateAiApiKey at app boot).
  useEffect(() => {
    setSettings(state.aiSettings);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = useCallback(<K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    await saveAiSettings(settings);
    dispatch({ type: "SET_AI_SETTINGS", settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [settings, dispatch]);

  const isChatGPT = settings.provider === "chatgpt";
  const isOpenAI = settings.provider === "openai";

  return (
    <div className="oc-ai-settings" data-0canvas="ai-settings">
      <div className="oc-settings-section-title">AI Provider</div>

      <div className="oc-ai-provider-group">
        {([
          { value: "chatgpt" as AiProvider, label: "ChatGPT", desc: "Use your ChatGPT subscription via local proxy" },
          { value: "openai" as AiProvider, label: "OpenAI API", desc: "Direct API with your own key (BYOK)" },
          { value: "ide" as AiProvider, label: "IDE Agent", desc: "Send to your AI coding tool (Cursor, Claude Code, etc.)" },
        ]).map((opt) => (
          <button
            key={opt.value}
            className={`oc-ai-provider-btn${settings.provider === opt.value ? " is-active" : ""}`}
            onClick={() => updateField("provider", opt.value)}
          >
            <span className="oc-ai-provider-label">{opt.label}</span>
            <span className="oc-ai-provider-desc">{opt.desc}</span>
          </button>
        ))}
      </div>

      {isChatGPT && (
        <div className="oc-ai-config-section">
          <div className="oc-settings-section-title">ChatGPT Proxy</div>
          <p className="oc-ai-hint">
            Run <code>npx openai-oauth</code> to start the local proxy, then enter the URL below.
          </p>
          <label className="oc-ai-field">
            <span className="oc-ai-field-label">Proxy URL</span>
            <input
              className="oc-ai-field-input"
              value={settings.proxyUrl}
              onChange={(e) => updateField("proxyUrl", e.target.value)}
              placeholder="http://127.0.0.1:10531"
            />
          </label>
        </div>
      )}

      {isOpenAI && (
        <div className="oc-ai-config-section">
          <div className="oc-settings-section-title">OpenAI API Key</div>
          <p className="oc-ai-hint">
            Stored in the macOS keychain, not in <code>settings.json</code>.
          </p>
          <label className="oc-ai-field">
            <span className="oc-ai-field-label">API Key</span>
            <input
              className="oc-ai-field-input"
              type="password"
              value={settings.apiKey}
              onChange={(e) => updateField("apiKey", e.target.value)}
              placeholder="sk-..."
            />
          </label>
        </div>
      )}

      {(isChatGPT || isOpenAI) && (
        <div className="oc-ai-config-section">
          <div className="oc-settings-section-title">Model</div>
          <label className="oc-ai-field">
            <span className="oc-ai-field-label">Model</span>
            <select
              className="oc-ai-field-select"
              value={settings.model}
              onChange={(e) => updateField("model", e.target.value)}
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>

          <label className="oc-ai-field">
            <span className="oc-ai-field-label">
              Temperature <span className="oc-ai-field-value">{settings.temperature}</span>
            </span>
            <input
              type="range"
              className="oc-ai-field-range"
              min={0}
              max={1.5}
              step={0.1}
              value={settings.temperature}
              onChange={(e) => updateField("temperature", parseFloat(e.target.value))}
            />
          </label>
        </div>
      )}

      {settings.provider === "ide" && (
        <div className="oc-ai-config-section">
          <p className="oc-ai-hint">
            AI requests will be saved to <code>.0canvas/ai-request.md</code> for your AI coding tool to pick up.
          </p>
        </div>
      )}

      <button className="oc-ai-save-btn" onClick={handleSave}>
        {saved ? "Saved!" : "Save Settings"}
      </button>
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
