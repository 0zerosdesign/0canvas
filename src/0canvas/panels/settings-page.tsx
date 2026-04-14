import React, { useState, useCallback, useEffect } from "react";
import { Zap, Sparkles, ChevronRight } from "lucide-react";
import { useWorkspace, type AiSettings, type AiProvider } from "../store/store";
import { AgentPanel } from "./agent-panel";
import { ScrollArea } from "../ui/scroll-area";
import { loadAiSettings, saveAiSettings, AVAILABLE_MODELS } from "../lib/openai";

type SettingsSection = "ide-agents" | "ai-settings";

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: "ai-settings", label: "AI Settings", icon: <Sparkles size={16} /> },
  { id: "ide-agents", label: "IDE & Agents", icon: <Zap size={16} /> },
];

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("ai-settings");

  return (
    <div className="oc-settings-page">
      {/* Left: settings nav */}
      <div className="oc-settings-nav">
        <div className="oc-settings-nav-header">Settings</div>
        <div className="oc-settings-nav-list">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`oc-settings-nav-item ${activeSection === section.id ? "is-active" : ""}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="oc-settings-nav-icon">{section.icon}</span>
              <span className="oc-settings-nav-label">{section.label}</span>
              <ChevronRight size={14} className="oc-settings-nav-chevron" />
            </button>
          ))}
        </div>
      </div>

      {/* Right: settings content */}
      <div className="oc-settings-content">
        <ScrollArea className="oc-settings-scroll">
          {activeSection === "ai-settings" && <AiSettingsPanel />}
          {activeSection === "ide-agents" && <AgentPanel />}
        </ScrollArea>
      </div>
    </div>
  );
}

// ── AI Settings Panel ────────────────────────────────────

function AiSettingsPanel() {
  const { state, dispatch } = useWorkspace();
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [saved, setSaved] = useState(false);

  // Sync from store on mount
  useEffect(() => {
    if (state.aiSettings.provider !== "ide" || state.aiSettings.apiKey) {
      setSettings(state.aiSettings);
    }
  }, []);

  const updateField = useCallback(<K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    saveAiSettings(settings);
    dispatch({ type: "SET_AI_SETTINGS", settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [settings, dispatch]);

  const isChatGPT = settings.provider === "chatgpt";
  const isOpenAI = settings.provider === "openai";

  return (
    <div className="oc-ai-settings" data-0canvas="ai-settings">
      <div className="oc-settings-section-title">AI Provider</div>

      {/* Provider selector */}
      <div className="oc-ai-provider-group">
        {([
          { value: "chatgpt" as AiProvider, label: "ChatGPT", desc: "Use your ChatGPT subscription via local proxy" },
          { value: "openai" as AiProvider, label: "OpenAI API", desc: "Direct API with your own key (BYOK)" },
          { value: "ide" as AiProvider, label: "IDE Agent", desc: "Send to Cursor, Claude Code, or Copilot" },
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

      {/* ChatGPT config */}
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
              data-0canvas="ai-proxy-input"
            />
          </label>
        </div>
      )}

      {/* OpenAI API config */}
      {isOpenAI && (
        <div className="oc-ai-config-section">
          <div className="oc-settings-section-title">OpenAI API Key</div>
          <label className="oc-ai-field">
            <span className="oc-ai-field-label">API Key</span>
            <input
              className="oc-ai-field-input"
              type="password"
              value={settings.apiKey}
              onChange={(e) => updateField("apiKey", e.target.value)}
              placeholder="sk-..."
              data-0canvas="ai-key-input"
            />
          </label>
        </div>
      )}

      {/* Model + Temperature (for ChatGPT and OpenAI) */}
      {(isChatGPT || isOpenAI) && (
        <div className="oc-ai-config-section">
          <div className="oc-settings-section-title">Model</div>
          <label className="oc-ai-field">
            <span className="oc-ai-field-label">Model</span>
            <select
              className="oc-ai-field-select"
              value={settings.model}
              onChange={(e) => updateField("model", e.target.value)}
              data-0canvas="ai-model-select"
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
              data-0canvas="ai-temp-range"
            />
          </label>
        </div>
      )}

      {/* IDE Agent info */}
      {settings.provider === "ide" && (
        <div className="oc-ai-config-section">
          <p className="oc-ai-hint">
            AI requests will be sent to the connected IDE agent (Cursor, Claude Code, Copilot) via the WebSocket bridge.
          </p>
        </div>
      )}

      {/* Auto-send feedback toggle */}
      <div className="oc-ai-config-section">
        <div className="oc-settings-section-title">Feedback Pipeline</div>
        <label className="oc-ai-toggle-row" data-0canvas="auto-send-toggle">
          <div className="oc-ai-toggle-info">
            <span className="oc-ai-toggle-label">Auto-send feedback to agent</span>
            <span className="oc-ai-toggle-desc">
              Automatically dispatch new feedback items to the AI agent for processing.
            </span>
          </div>
          <button
            role="switch"
            aria-checked={settings.autoSendFeedback}
            className={`oc-toggle-switch${settings.autoSendFeedback ? " is-on" : ""}`}
            onClick={() => updateField("autoSendFeedback", !settings.autoSendFeedback)}
          >
            <span className="oc-toggle-thumb" />
          </button>
        </label>
      </div>

      {/* Save button */}
      <button className="oc-ai-save-btn" onClick={handleSave}>
        {saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}
