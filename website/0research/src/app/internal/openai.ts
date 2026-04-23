import type { AiSettings, OpenAIMessage, OpenAIContentPart } from "./types";

interface StreamOptions {
  settings: AiSettings;
  messages: OpenAIMessage[];
  signal?: AbortSignal;
}

// ── Responses API format (for ChatGPT subscription proxy) ────────────
// The proxy's /v1/responses endpoint passes through to the Codex endpoint
// natively — no translation layer, so base64 images work.

interface ResponsesInput {
  role: string;
  content: string | ResponsesContentPart[];
}

interface ResponsesContentPart {
  type: "input_text" | "input_image";
  text?: string;
  image_url?: string;
}

function toResponsesInput(messages: OpenAIMessage[]): ResponsesInput[] {
  return messages.map((msg) => {
    if (typeof msg.content === "string") {
      return { role: msg.role, content: msg.content };
    }
    // Convert Chat Completions content parts → Responses API parts
    const parts: ResponsesContentPart[] = msg.content.map(
      (part: OpenAIContentPart) => {
        if (part.type === "image_url" && part.image_url) {
          return {
            type: "input_image" as const,
            image_url: part.image_url.url,
          };
        }
        return {
          type: "input_text" as const,
          text: part.text || "",
        };
      },
    );
    return { role: msg.role, content: parts };
  });
}

// ── Stream: Responses API (SSE events with response.output_text.delta) ──

async function* streamResponses(
  url: string,
  model: string,
  messages: OpenAIMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: toResponsesInput(messages),
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: { message: response.statusText } }));
    throw new Error(
      error.error?.message || `API error: ${response.status}`,
    );
  }

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
        // Responses API: delta text comes in response.output_text.delta events
        if (parsed.type === "response.output_text.delta" && parsed.delta) {
          yield parsed.delta;
        }
        // Also handle Chat Completions format as fallback
        // (some proxies translate to this format)
        if (parsed.choices?.[0]?.delta?.content) {
          yield parsed.choices[0].delta.content;
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}

// ── Stream: Chat Completions API (standard OpenAI format) ──────────────

async function* streamChatCompletions(
  url: string,
  apiKey: string,
  model: string,
  messages: OpenAIMessage[],
  temperature: number,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
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
    const error = await response
      .json()
      .catch(() => ({ error: { message: response.statusText } }));
    throw new Error(
      error.error?.message || `API error: ${response.status}`,
    );
  }

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
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // skip malformed chunks
      }
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────

export async function* streamChat(
  options: StreamOptions,
): AsyncGenerator<string> {
  const { settings, messages, signal } = options;

  if (settings.provider === "chatgpt") {
    // Use Responses API directly — bypasses translation layer, images work
    const base = settings.proxyUrl.replace(/\/+$/, "");
    yield* streamResponses(
      `${base}/v1/responses`,
      settings.model,
      messages,
      signal,
    );
  } else {
    // Direct OpenAI Chat Completions API
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
