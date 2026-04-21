// ──────────────────────────────────────────────────────────
// AI Stream — Lightweight OpenAI chat streaming for inline edit
// ──────────────────────────────────────────────────────────
//
// Streams CSS property changes from ChatGPT for real-time
// style application. No SDK dependency — uses fetch + ReadableStream.
//
// The API key is read from localStorage ("0canvas-openai-key").
// ──────────────────────────────────────────────────────────

const DEFAULT_MODEL = "gpt-4o-mini";

// ── System prompt for CSS-only edits ────────────────────────

function buildSystemPrompt(): string {
  return `You are a CSS expert inside a visual design tool called 0canvas.
The user will describe a visual change they want on a selected HTML element.
You MUST respond ONLY with a CSS code block containing property: value pairs.
Do NOT include selectors or curly braces — just the properties.
Do NOT explain or add any text outside the code block.

Example user request: "make it rounded with a blue background"
Example response:
\`\`\`css
border-radius: 12px;
background-color: #3B82F6; /* check:ui ignore-line — LLM prompt example */
\`\`\`

Example user request: "add more padding and make text bigger"
Example response:
\`\`\`css
padding: 24px;
font-size: 18px;
\`\`\`

Rules:
- Only output CSS properties that directly address the user's request
- Use standard CSS property names (kebab-case)
- Use concrete values (px, rem, hex colors, etc.)
- Keep it minimal — only the properties needed for the change
- Always wrap in a css code block`;
}

function buildUserPrompt(
  instruction: string,
  elementTag: string,
  elementClasses: string[],
  currentStyles: Record<string, string>,
): string {
  const styleLines = Object.entries(currentStyles)
    .map(([k, v]) => `  ${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
    .join("\n");

  return `Element: <${elementTag}> with classes [${elementClasses.join(", ")}]
Current computed styles:
${styleLines}

Change requested: "${instruction}"`;
}

// ── Types ──────────────────────────────────────────────────

export type StreamCallbacks = {
  onProperty: (property: string, value: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
};

// ── Streaming fetch ────────────────────────────────────────

export async function streamCSSChanges(
  instruction: string,
  elementTag: string,
  elementClasses: string[],
  currentStyles: Record<string, string>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  options?: { apiKey?: string; model?: string },
): Promise<void> {
  const apiKey = options?.apiKey;
  if (!apiKey) {
    callbacks.onError("No API key configured. Set it in Settings → AI Settings.");
    return;
  }

  const model = options?.model || DEFAULT_MODEL;
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(instruction, elementTag, elementClasses, currentStyles);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
        temperature: 0.3,
        max_tokens: 512,
      }),
      signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      if (res.status === 401) {
        callbacks.onError("Invalid API key. Check your OpenAI key in Settings.");
      } else {
        callbacks.onError(`OpenAI error ${res.status}: ${errBody.slice(0, 200)}`);
      }
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      callbacks.onError("No response stream available.");
      return;
    }

    const decoder = new TextDecoder();
    let accumulated = "";
    let lastParsedIndex = 0;
    let insideCodeBlock = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (typeof delta === "string") {
            accumulated += delta;

            // Parse CSS properties as they stream in
            const result = extractNewProperties(accumulated, lastParsedIndex, insideCodeBlock);
            lastParsedIndex = result.lastIndex;
            insideCodeBlock = result.insideCodeBlock;

            for (const { property, value: val } of result.properties) {
              callbacks.onProperty(property, val);
            }
          }
        } catch {
          // skip malformed JSON chunks
        }
      }
    }

    // Final pass — catch any trailing properties
    const finalResult = extractNewProperties(accumulated, lastParsedIndex, insideCodeBlock);
    for (const { property, value: val } of finalResult.properties) {
      callbacks.onProperty(property, val);
    }

    callbacks.onComplete();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      // User cancelled — not an error
      callbacks.onComplete();
      return;
    }
    callbacks.onError(err instanceof Error ? err.message : "Unknown streaming error");
  }
}

// ── Property extraction from streaming text ────────────────

type ExtractResult = {
  properties: { property: string; value: string }[];
  lastIndex: number;
  insideCodeBlock: boolean;
};

function extractNewProperties(
  text: string,
  startIndex: number,
  wasInsideCodeBlock: boolean,
): ExtractResult {
  const properties: { property: string; value: string }[] = [];
  let insideCodeBlock = wasInsideCodeBlock;
  let searchFrom = startIndex;

  // Process character by character from startIndex looking for complete lines
  while (searchFrom < text.length) {
    const nextNewline = text.indexOf("\n", searchFrom);
    if (nextNewline === -1) break; // No complete line yet

    const line = text.slice(searchFrom, nextNewline).trim();
    searchFrom = nextNewline + 1;

    // Track code block boundaries
    if (line.startsWith("```")) {
      insideCodeBlock = !insideCodeBlock;
      continue;
    }

    // Only parse lines inside code blocks
    if (!insideCodeBlock) continue;

    // Match "property: value;" pattern
    const match = line.match(/^([a-z][a-z-]*)\s*:\s*(.+?)\s*;?\s*$/i);
    if (match) {
      const property = match[1].toLowerCase();
      const value = match[2].trim().replace(/;$/, "");
      if (property && value) {
        properties.push({ property, value });
      }
    }
  }

  return { properties, lastIndex: searchFrom, insideCodeBlock };
}
