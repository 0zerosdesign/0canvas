// ──────────────────────────────────────────────────────────
// OpenAI Streaming Client — ChatGPT proxy + direct API
// ──────────────────────────────────────────────────────────
//
// Two modes:
//   1. ChatGPT subscription via local proxy (npx openai-oauth)
//   2. Direct OpenAI API key (BYOK)
//
// Reuses patterns from 0research project.
//
// ──────────────────────────────────────────────────────────

// The full provider + settings types now live in store.tsx (Phase 4
// added auth method + thinking effort + agent teams). Re-exported
// here so the rest of this module reads as before.
export type {
  AiProvider,
  AiSettings,
  AiAuthMethod,
  AiThinkingEffort,
} from "../store/store";
import type { AiSettings } from "../store/store";

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamOptions {
  settings: AiSettings;
  messages: OpenAIMessage[];
  signal?: AbortSignal;
}

const STORAGE_KEY = "Zeros-ai-settings";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  // Phase 4 default: Claude via subprocess (the user's own `claude login`).
  // If the CLI isn't installed the settings UI surfaces the fallback.
  provider: "claude",
  authMethod: "subscription",
  proxyUrl: "http://127.0.0.1:10531",
  apiKey: "",
  model: "gpt-4o",
  temperature: 0.7,
  autoSendFeedback: false,
  thinkingEffort: "high",
  permissionMode: "plan",
  agentTeams: false,
};

export const AVAILABLE_MODELS = [
  // GPT-5.4
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  // GPT-5.3
  { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
  // GPT-5.2
  { value: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
  { value: "gpt-5.2", label: "GPT-5.2" },
  // GPT-5.1
  { value: "gpt-5.1-codex-max", label: "GPT-5.1 Codex Max" },
  { value: "gpt-5.1-codex", label: "GPT-5.1 Codex" },
  { value: "gpt-5.1", label: "GPT-5.1" },
  // GPT-5
  { value: "gpt-5-codex", label: "GPT-5 Codex" },
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-5.1-codex-mini", label: "GPT-5.1 Codex Mini" },
  { value: "gpt-5-codex-mini", label: "GPT-5 Codex Mini" },
  // GPT-4.1
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  // GPT-4o
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  // Reasoning
  { value: "o3", label: "o3 (Reasoning)" },
  { value: "o4-mini", label: "o4 Mini (Reasoning)" },
];

// ── Settings persistence ─────────────────────────────────
//
// Phase 2-C split: non-secret fields (provider, model, temperature,
// proxyUrl, autoSendFeedback) live in localStorage for synchronous
// access during initial render. The apiKey lives in the macOS
// keychain via src/native/secrets.ts and is hydrated asynchronously
// after mount via hydrateAiApiKey().

export function loadAiSettings(): AiSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Strip any legacy apiKey that might be sitting in localStorage
      // from pre-Phase-2-C builds — it's about to be migrated to the
      // keychain on the next save and we don't want it leaking back.
      const { apiKey: _legacy, ...rest } = parsed as Partial<AiSettings>;
      return { ...DEFAULT_AI_SETTINGS, ...rest };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_AI_SETTINGS };
}

/**
 * Read the api key from the keychain and merge it into an existing
 * AiSettings snapshot. If the legacy value is still sitting in
 * localStorage from an old build, migrate it to keychain before
 * returning — one-time cleanup so no secret stays in plaintext.
 */
/** Map the active provider to the keychain slot holding its key. */
async function keySlotFor(provider: AiSettings["provider"]) {
  const { SECRET_ACCOUNTS } = await import("../../native/secrets");
  return provider === "claude"
    ? SECRET_ACCOUNTS.ANTHROPIC_API_KEY
    : SECRET_ACCOUNTS.OPENAI_API_KEY;
}

export async function hydrateAiApiKey(settings: AiSettings): Promise<AiSettings> {
  const { getSecret, setSecret, SECRET_ACCOUNTS } = await import(
    "../../native/secrets"
  );
  const slot = await keySlotFor(settings.provider);
  let apiKey = (await getSecret(slot)) ?? "";

  // One-shot migration from the old localStorage blob. The legacy
  // path only ever stored an OpenAI key, so move it into that slot
  // regardless of the current provider.
  if (!apiKey) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.apiKey === "string" && parsed.apiKey) {
          await setSecret(SECRET_ACCOUNTS.OPENAI_API_KEY, parsed.apiKey);
          const { apiKey: _, ...rest } = parsed as Partial<AiSettings>;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
          // Re-read the slot for the current provider — the migrated
          // key only matches when provider is codex / openai.
          apiKey = (await getSecret(slot)) ?? "";
        }
      }
    } catch {
      /* nothing to migrate */
    }
  }

  return { ...settings, apiKey };
}

/**
 * Persist the non-secret settings to localStorage. API keys are
 * managed directly by the Settings → AI Models UI (per-provider
 * slot in the macOS keychain) so we deliberately strip `apiKey`
 * here — otherwise switching provider would clobber the other
 * provider's key with whatever is currently in the field.
 */
export async function saveAiSettings(settings: AiSettings): Promise<void> {
  const { apiKey: _ignored, ...rest } = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
}

export function isAiConfigured(settings: AiSettings): boolean {
  // Phase 4: claude / codex via subscription rely on the user's own
  // `claude login` / `codex login`, so we can't verify until we try
  // to spawn them — optimistically return true and let the subprocess
  // report ENOENT if the CLI is missing.
  if (settings.provider === "claude" || settings.provider === "codex") {
    if (settings.authMethod === "subscription") return true;
    return !!settings.apiKey;
  }
  // Legacy paths kept for rollback safety.
  if (settings.provider === "chatgpt") return !!settings.proxyUrl;
  if (settings.provider === "openai") return !!settings.apiKey;
  return true;
}

// ── Streaming dispatcher ─────────────────────────────────

export async function* streamChat(options: StreamOptions): AsyncGenerator<string> {
  const { settings, messages, signal } = options;

  // Phase 4 CLI-subprocess backends. The CLIs own their own chat state,
  // so we flatten the message list into a single prompt: the most
  // recent user message, with prior turns prepended as context. Proper
  // multi-turn resume lands alongside the Mission Control tab.
  if (settings.provider === "claude" || settings.provider === "codex") {
    if (settings.authMethod === "subscription") {
      const { streamCli } = await import("./ai-cli");
      const prompt = flattenMessages(messages);
      yield* streamCli(settings.provider, prompt, settings, signal);
      return;
    }
    // API-key mode for codex → OpenAI Chat Completions (same backend).
    if (settings.provider === "codex") {
      yield* streamChatCompletions(
        "https://api.openai.com/v1/chat/completions",
        settings.apiKey,
        settings.model,
        messages,
        settings.temperature,
        signal,
      );
      return;
    }
    // API-key mode for claude → Anthropic Messages API (streaming).
    if (settings.provider === "claude") {
      const { streamAnthropic } = await import("./anthropic");
      yield* streamAnthropic(settings, messages, signal);
      return;
    }
  }

  // Legacy providers (kept so pre-Phase-4 settings still work).
  if (settings.provider === "chatgpt") {
    const base = settings.proxyUrl.replace(/\/+$/, "");
    yield* streamChatCompletions(
      `${base}/v1/chat/completions`,
      "",
      settings.model,
      messages,
      settings.temperature,
      signal,
    );
  } else if (settings.provider === "openai") {
    yield* streamChatCompletions(
      "https://api.openai.com/v1/chat/completions",
      settings.apiKey,
      settings.model,
      messages,
      settings.temperature,
      signal,
    );
  }
}

function flattenMessages(messages: OpenAIMessage[]): string {
  // For CLI providers the agent maintains its own conversation; we
  // only feed forward the latest user message plus any system prompt.
  const system = messages.find((m) => m.role === "system");
  const latest = [...messages].reverse().find((m) => m.role === "user");
  if (!latest) return "";
  if (system) return `${system.content}\n\n${latest.content}`;
  return latest.content;
}

// ── ChatGPT Proxy (Responses API) ────────────────────────

function toResponsesInput(messages: OpenAIMessage[]): unknown[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role,
      content: [{ type: "input_text", text: m.content }],
    }));
}

async function* streamResponses(
  url: string,
  model: string,
  messages: OpenAIMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const systemMsg = messages.find((m) => m.role === "system");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: systemMsg?.content || "",
      input: toResponsesInput(messages),
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    let errMsg = `API error: ${response.status}`;
    try {
      const errBody = await response.json();
      errMsg = errBody.error?.message || errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  yield* parseSSEStream(response);
}

// ── Direct OpenAI (Chat Completions) ─────────────────────

async function* streamChatCompletions(
  url: string,
  apiKey: string,
  model: string,
  messages: OpenAIMessage[],
  temperature: number,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true,
      max_tokens: 4096,
    }),
    signal,
  });

  if (!response.ok) {
    let errMsg = `API error: ${response.status}`;
    try {
      const errBody = await response.json();
      errMsg = errBody.error?.message || errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  yield* parseSSEStream(response);
}

// ── SSE Parser ───────────────────────────────────────────

async function* parseSSEStream(response: Response): AsyncGenerator<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);

        // Responses API format (ChatGPT proxy)
        if (parsed.type === "response.output_text.delta" && parsed.delta) {
          yield parsed.delta;
          continue;
        }

        // Chat Completions format (direct OpenAI)
        if (parsed.choices?.[0]?.delta?.content) {
          yield parsed.choices[0].delta.content;
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }
}
