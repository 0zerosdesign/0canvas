import { useState } from "react";
import type { AiSettings, AiProvider } from "./types";
import { STYLE_GUIDE } from "./agent";

export { STYLE_GUIDE };

const MODELS = [
  { id: "gpt-5.4", name: "GPT-5.4", group: "GPT-5.4" },
  { id: "gpt-5.4-mini", name: "GPT-5.4 Mini", group: "GPT-5.4" },
  { id: "gpt-5.4-nano", name: "GPT-5.4 Nano", group: "GPT-5.4" },
  { id: "gpt-5", name: "GPT-5", group: "GPT-5" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", group: "GPT-5" },
  { id: "gpt-5-nano", name: "GPT-5 Nano", group: "GPT-5" },
  { id: "gpt-4.1", name: "GPT-4.1", group: "GPT-4.1" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", group: "GPT-4.1" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", group: "GPT-4.1" },
  { id: "o3", name: "o3", group: "Reasoning" },
  { id: "o4-mini", name: "o4 Mini", group: "Reasoning" },
  { id: "gpt-4o", name: "GPT-4o", group: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", group: "GPT-4o" },
];

export const DEFAULT_SYSTEM_PROMPT = STYLE_GUIDE;

interface Props {
  settings: AiSettings;
  onUpdate: (settings: AiSettings) => void;
  isOpen: boolean;
  onClose: () => void;
}

function ModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="oai-model-select"
      style={{ width: "100%" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {Object.entries(
        MODELS.reduce<Record<string, typeof MODELS>>((acc, m) => {
          (acc[m.group] ??= []).push(m);
          return acc;
        }, {}),
      ).map(([group, models]) => (
        <optgroup key={group} label={group}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function Settings({ settings, onUpdate, isOpen, onClose }: Props) {
  const [showKey, setShowKey] = useState(false);

  const isChatGPT = settings.provider === "chatgpt";

  const handleProviderChange = (provider: AiProvider) => {
    onUpdate({ ...settings, provider });
  };

  return (
    <>
      <div
        className={`oai-settings-overlay ${isOpen ? "oai-settings-overlay--open" : ""}`}
        onClick={onClose}
      />
      <div className={`oai-settings ${isOpen ? "oai-settings--open" : ""}`}>
        <div className="oai-settings__header">
          <div className="oai-settings__title">Settings</div>
          <button className="oai-icon-btn" onClick={onClose} type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="oai-settings__body">
          {/* Provider Toggle */}
          <div className="oai-field">
            <label className="oai-field__label">Provider</label>
            <div className="oai-provider-toggle">
              <button
                className={`oai-provider-btn ${isChatGPT ? "oai-provider-btn--active" : ""}`}
                onClick={() => handleProviderChange("chatgpt")}
                type="button"
              >
                ChatGPT Subscription
              </button>
              <button
                className={`oai-provider-btn ${!isChatGPT ? "oai-provider-btn--active" : ""}`}
                onClick={() => handleProviderChange("openai")}
                type="button"
              >
                OpenAI API
              </button>
            </div>
            <div className="oai-field__hint">
              {isChatGPT
                ? "Uses your ChatGPT Plus/Pro subscription. No extra API cost."
                : "Direct API access. Pay-per-token."}
            </div>
          </div>

          {/* ChatGPT Subscription config */}
          {isChatGPT && (
            <>
              <div className="oai-field">
                <label className="oai-field__label">Local Proxy URL</label>
                <input
                  className="oai-text-input"
                  type="text"
                  value={settings.proxyUrl}
                  onChange={(e) =>
                    onUpdate({ ...settings, proxyUrl: e.target.value })
                  }
                  placeholder="http://127.0.0.1:10531"
                  spellCheck={false}
                />
                <div className="oai-field__hint">
                  Default port: 10531 (openai-oauth) or 18789 (OpenClaw).
                </div>
              </div>
              <div className="oai-setup-guide">
                <div className="oai-field__label" style={{ marginBottom: "var(--space-2)" }}>
                  One-time Setup
                </div>
                <ol className="oai-setup-steps">
                  <li>
                    Login to your ChatGPT account:
                    <code className="oai-inline-code">
                      npx @openai/codex login
                    </code>
                  </li>
                  <li>
                    Start the local proxy:
                    <code className="oai-inline-code">
                      npx openai-oauth
                    </code>
                  </li>
                  <li>
                    Done — 0internal connects to the proxy automatically.
                  </li>
                </ol>
                <div
                  className="oai-field__hint"
                  style={{ marginTop: "var(--space-2)" }}
                >
                  The proxy routes requests through your ChatGPT subscription
                  via OpenAI's Codex OAuth. Your tokens stay on your machine.
                </div>
              </div>
            </>
          )}

          {/* OpenAI API config */}
          {!isChatGPT && (
            <div className="oai-field">
              <label className="oai-field__label">API Key</label>
              <div className="oai-field__input-row">
                <input
                  className="oai-text-input"
                  type={showKey ? "text" : "password"}
                  value={settings.apiKey}
                  onChange={(e) =>
                    onUpdate({ ...settings, apiKey: e.target.value })
                  }
                  placeholder="sk-..."
                  spellCheck={false}
                />
                <button
                  className="oai-icon-btn"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? "Hide" : "Show"}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showKey ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
              <div className="oai-field__hint">
                Stored locally. Never sent anywhere except OpenAI.
              </div>
            </div>
          )}

          {/* Model */}
          <div className="oai-field">
            <label className="oai-field__label">Model</label>
            <ModelSelect
              value={settings.model}
              onChange={(model) => onUpdate({ ...settings, model })}
            />
          </div>

          {/* Temperature */}
          <div className="oai-field">
            <label className="oai-field__label">Temperature</label>
            <div className="oai-range-row">
              <input
                className="oai-range"
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={settings.temperature}
                onChange={(e) =>
                  onUpdate({
                    ...settings,
                    temperature: parseFloat(e.target.value),
                  })
                }
              />
              <span className="oai-range-value">
                {settings.temperature.toFixed(1)}
              </span>
            </div>
          </div>

          {/* System Prompt */}
          <div className="oai-field">
            <label className="oai-field__label">System Prompt</label>
            <textarea
              className="oai-textarea-field"
              value={settings.systemPrompt}
              onChange={(e) =>
                onUpdate({ ...settings, systemPrompt: e.target.value })
              }
              rows={8}
            />
            <div className="oai-field__hint">
              Style guide for the AI. The agent automatically adds relevant
              reference examples from the knowledge base on every request.
            </div>
          </div>

          {/* Reset */}
          <button
            className="oai-reset-btn"
            onClick={() =>
              onUpdate({
                ...settings,
                systemPrompt: STYLE_GUIDE,
                temperature: 0.7,
              })
            }
            type="button"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </>
  );
}
