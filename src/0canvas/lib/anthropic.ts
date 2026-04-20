// ──────────────────────────────────────────────────────────
// Phase 4 — Anthropic HTTP streaming (API-key mode)
// ──────────────────────────────────────────────────────────
//
// Direct Messages API streaming client. Used when the user picks
// Claude SDK → API Key in Settings. The subscription path uses a
// separate subprocess bridge (ai-cli.ts) so neither code path
// needs to know about the other.
//
// Docs: https://docs.claude.com/en/api/messages-streaming
// ──────────────────────────────────────────────────────────

import type { OpenAIMessage } from "./openai";
import type { AiSettings } from "../store/store";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Anthropic's default models as of Phase 4. The Settings UI still
// uses OpenAI model ids when the provider is "codex"; we only read
// `settings.model` when it looks like an Anthropic id, otherwise we
// fall back to the current Sonnet.
const DEFAULT_MODEL = "claude-sonnet-4-6";

function pickModel(settings: AiSettings): string {
  const m = settings.model?.trim();
  if (m && m.toLowerCase().startsWith("claude-")) return m;
  return DEFAULT_MODEL;
}

/**
 * Call the Messages API with streaming enabled and yield text chunks.
 * Mirrors the shape of openai.ts `streamChatCompletions` so the
 * dispatcher in `streamChat()` can use it interchangeably.
 */
export async function* streamAnthropic(
  settings: AiSettings,
  messages: OpenAIMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (!settings.apiKey) {
    throw new Error(
      "Anthropic API key is not set — add it in Settings → AI Models → API Key.",
    );
  }

  const systemMsg = messages.find((m) => m.role === "system");
  const convo = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      // Required for browser-origin requests per Anthropic docs.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: pickModel(settings),
      max_tokens: 4096,
      stream: true,
      temperature: settings.temperature ?? 0.7,
      system: systemMsg?.content,
      messages: convo,
    }),
    signal,
  });

  if (!response.ok) {
    let errMsg = `Anthropic API error: ${response.status}`;
    try {
      const errBody = await response.json();
      errMsg = errBody?.error?.message || errMsg;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(errMsg);
  }

  // Anthropic uses SSE with `event: ...` and `data: {...}` lines.
  // We only care about `content_block_delta` frames for text output.
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";

    for (const frame of frames) {
      for (const raw of frame.split("\n")) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (
            parsed.type === "content_block_delta" &&
            parsed.delta?.type === "text_delta" &&
            typeof parsed.delta.text === "string"
          ) {
            yield parsed.delta.text;
          } else if (parsed.type === "message_stop") {
            return;
          }
        } catch {
          // Ignore malformed frames; Anthropic sometimes sends pings.
        }
      }
    }
  }
}
