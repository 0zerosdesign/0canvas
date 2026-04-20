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

export type AiProvider = "chatgpt" | "openai" | "ide";

export interface AiSettings {
  provider: AiProvider;
  proxyUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  autoSendFeedback: boolean;
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamOptions {
  settings: AiSettings;
  messages: OpenAIMessage[];
  signal?: AbortSignal;
}

const STORAGE_KEY = "0canvas-ai-settings";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "ide",
  proxyUrl: "http://127.0.0.1:10531",
  apiKey: "",
  model: "gpt-4o",
  temperature: 0.7,
  autoSendFeedback: false,
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
export async function hydrateAiApiKey(settings: AiSettings): Promise<AiSettings> {
  const { getSecret, setSecret, SECRET_ACCOUNTS } = await import(
    "../../native/secrets"
  );
  let apiKey = (await getSecret(SECRET_ACCOUNTS.OPENAI_API_KEY)) ?? "";

  // One-shot migration from the old localStorage blob.
  if (!apiKey) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.apiKey === "string" && parsed.apiKey) {
          apiKey = parsed.apiKey;
          await setSecret(SECRET_ACCOUNTS.OPENAI_API_KEY, apiKey);
          // Rewrite localStorage without the key.
          const { apiKey: _, ...rest } = parsed as Partial<AiSettings>;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
        }
      }
    } catch {
      /* nothing to migrate */
    }
  }

  return { ...settings, apiKey };
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  // Persist non-secret fields to localStorage, secret to keychain.
  const { apiKey, ...rest } = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  const { setSecret, deleteSecret, SECRET_ACCOUNTS } = await import(
    "../../native/secrets"
  );
  if (apiKey) {
    await setSecret(SECRET_ACCOUNTS.OPENAI_API_KEY, apiKey);
  } else {
    await deleteSecret(SECRET_ACCOUNTS.OPENAI_API_KEY);
  }
}

export function isAiConfigured(settings: AiSettings): boolean {
  if (settings.provider === "chatgpt") return !!settings.proxyUrl;
  if (settings.provider === "openai") return !!settings.apiKey;
  return true; // IDE mode always "configured"
}

// ── Streaming dispatcher ─────────────────────────────────

export async function* streamChat(options: StreamOptions): AsyncGenerator<string> {
  const { settings, messages, signal } = options;

  if (settings.provider === "chatgpt") {
    // Use Chat Completions endpoint via proxy (more reliable than Responses API)
    const base = settings.proxyUrl.replace(/\/+$/, "");
    yield* streamChatCompletions(
      `${base}/v1/chat/completions`,
      "", // no API key needed for proxy
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
