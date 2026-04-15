# Shared Libraries

Supporting libraries used by the Style Panel and visual editors.

---

## CSS Property Value Autocomplete (`lib/css-properties.ts`)

> `src/0canvas/lib/css-properties.ts`

Provides a static lookup table of valid CSS keyword values for 40+ properties, and a fuzzy-matching function for autocomplete suggestions.

### Data Structure

```typescript
export const CSS_VALUE_MAP: Record<string, string[]>
```

A flat map from kebab-case CSS property names to arrays of valid keyword string values. Organized into logical groups:

| Group | Properties Covered |
|-------|--------------------|
| **Layout** | display, position, overflow, overflow-x, overflow-y, float, clear, visibility, box-sizing |
| **Flexbox** | flex-direction, flex-wrap, align-items, align-content, align-self, justify-content, justify-items, justify-self |
| **Typography** | text-align, text-decoration, text-transform, font-weight, font-style, white-space, word-break, overflow-wrap, vertical-align, list-style-type |
| **Background & Effects** | background-size, background-repeat, background-position, background-attachment, mix-blend-mode, background-blend-mode |
| **Border** | border-style, outline-style |
| **Interaction** | cursor (22 values), pointer-events, user-select, resize |
| **Transforms & Transitions** | transform-origin, transition-timing-function, animation-direction, animation-fill-mode, animation-play-state, animation-timing-function |
| **Object** | object-fit, object-position |
| **Aspect ratio** | aspect-ratio |

### API

```typescript
function getAutocompleteSuggestions(
  property: string,   // camelCase or kebab-case
  partial: string,    // user's current typed input
  limit?: number      // max results (default 6)
): string[]
```

**Algorithm**:
1. Converts `property` to kebab-case
2. Looks up valid values from `CSS_VALUE_MAP`
3. If no partial input, returns first `limit` values
4. Otherwise, splits matches into two tiers:
   - **Prefix matches**: value starts with the query (higher priority)
   - **Substring matches**: value contains the query anywhere
5. Returns `[...prefix, ...substring].slice(0, limit)`

### Usage

Called by the `AutocompleteInput` component in `style-panel.tsx` whenever the user types in a property value field. Provides real-time dropdown suggestions.

### Coverage Notes

- Only covers keyword values, not numeric values with units
- Does not include shorthand property values (e.g., `border: 1px solid red`)
- Does not include custom properties or CSS variables
- The `cursor` property has the most comprehensive coverage (22 values including resize variants)
- `display` covers 10 values including modern options like `contents` and `flow-root`

---

## Tailwind Detection & Classification (`lib/tailwind.ts`)

> `src/0canvas/lib/tailwind.ts`

Detects whether CSS classes are Tailwind utilities and maps them to CSS property categories. Used by the Style Panel to conditionally render the TailwindEditor and by the TailwindEditor itself for grouping and autocomplete.

### Detection

```typescript
function isTailwindClass(cls: string): boolean
```

Uses a single comprehensive regex `TW_PATTERNS` that matches Tailwind utility prefixes. Before matching, strips responsive/state prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`, `hover:`, `focus:`, `active:`, `group-hover:`, `dark:`, `motion-safe:`, `motion-reduce:`, `first:`, `last:`, `odd:`, `even:`, `disabled:`, `placeholder:`, `before:`, `after:`).

The regex covers these prefix families:
- Layout: `flex`, `grid`, `block`, `inline`, `hidden`, `relative`, `absolute`, `fixed`, `sticky`, `items-`, `justify-`, `overflow-`, `z-`, `float-`, `clear-`
- Spacing: `p-`, `px-`, `py-`, `pt-`, `pr-`, `pb-`, `pl-`, `m-`, `mx-`, `my-`, `mt-`, `mr-`, `mb-`, `ml-`, `gap-`, `space-`
- Sizing: `w-`, `h-`, `min-`, `max-`, `shrink`, `grow`, `basis-`
- Typography: `text-`, `font-`, `leading-`, `tracking-`, various text-decoration/transform keywords
- Visual: `bg-`, `border`, `rounded`, `shadow`, `opacity-`, `ring-`, `divide-`
- Effects: `cursor-`, `select-`, `transition`, `duration-`, `ease-`, `delay-`, `animate-`, `scale-`, `rotate-`, `translate-`, `skew-`, `origin-`, `backdrop-`
- Accessibility: `sr-only`, `not-sr-only`
- Other: `aspect-`, `break-`, `decoration-`, `isolate`

```typescript
function detectTailwindClasses(classes: string[]): {
  tailwind: string[];
  other: string[];
  isTailwind: boolean;
}
```

Splits an array of class names into Tailwind and non-Tailwind groups. The `isTailwind` flag is `true` if at least one Tailwind class is found.

### Classification

```typescript
type TailwindCategory = "layout" | "spacing" | "sizing" | "typography" | "color" | "border" | "effects" | "other"

function classifyTailwindClass(cls: string): TailwindClassInfo
```

Returns detailed metadata for a Tailwind class:

```typescript
interface TailwindClassInfo {
  class: string;        // original class name
  category: TailwindCategory;
  property: string;     // mapped CSS property
  description: string;  // human-readable description
}
```

Classification is done via a cascade of regex checks (most-specific first). Notable routing decisions:

- `text-{size}` (xs, sm, base, lg, xl, etc.) routes to **typography** / font-size
- `text-{alignment}` (left, center, right, justify) routes to **typography** / text-align
- `text-{anything else}` routes to **color** / color (assumes it's a color utility)
- `font-{weight keyword}` routes to **typography** / font-weight
- `font-{anything else}` routes to **typography** / font-family
- `border*` routes to **border** / border
- `rounded*` routes to **border** / border-radius
- `shadow*` routes to **effects** / box-shadow
- `ring-*` routes to **border** / box-shadow (since rings use box-shadow under the hood)

### Autocomplete Data

```typescript
export const COMMON_TAILWIND_CLASSES: string[]
```

A curated list of ~160 commonly used Tailwind utility classes, organized by category. Used by the TailwindEditor's add-class autocomplete. Includes:

- **Layout** (16): flex, inline-flex, grid, block, inline-block, hidden, relative, absolute, fixed, sticky, items-*, justify-*, flex-row, flex-col, flex-wrap, flex-nowrap, flex-1
- **Spacing** (26): p-0 through p-12, px/py variants, m-0 through m-auto, mx-auto, gap-1 through gap-8
- **Sizing** (13): w-full, w-auto, w-screen, w-1/2, w-1/3, w-1/4, h-full, h-auto, h-screen, min-h-screen, max-w-sm through max-w-xl
- **Typography** (16): text-xs through text-3xl, font-normal through font-bold, text-left/center/right, leading-*, uppercase, lowercase, capitalize, truncate
- **Color** (11): text-white, text-black, text-gray-500, text-gray-700, bg-white, bg-black, bg-gray-100, bg-gray-200, bg-gray-900, bg-transparent
- **Border** (9): border, border-0, border-2, rounded through rounded-full, rounded-none
- **Effects** (13): shadow-sm through shadow-xl, shadow-none, opacity-0/50/75/100, transition, duration-150/300, overflow-hidden/auto/scroll

---

## OpenAI Streaming Client (`lib/openai.ts`)

> `src/0canvas/lib/openai.ts`

A generic streaming chat client for OpenAI-compatible APIs. Used by the AI chat panel and potentially other AI-powered features. Not directly used by the style panel editors, but part of the shared library layer.

### Provider Modes

```typescript
type AiProvider = "chatgpt" | "openai" | "ide"
```

| Provider | Endpoint | Auth | Description |
|----------|----------|------|-------------|
| `chatgpt` | Local proxy (default `http://127.0.0.1:10531`) | None (proxy handles auth) | Uses ChatGPT subscription via `npx openai-oauth` proxy |
| `openai` | `https://api.openai.com/v1/chat/completions` | Bearer token (API key) | Direct BYOK (Bring Your Own Key) |
| `ide` | N/A | N/A | Delegates to the IDE/extension; always considered "configured" |

### Settings

```typescript
interface AiSettings {
  provider: AiProvider;
  proxyUrl: string;       // default "http://127.0.0.1:10531"
  apiKey: string;         // for direct OpenAI
  model: string;          // default "gpt-4o"
  temperature: number;    // default 0.7
  autoSendFeedback: boolean;  // default false
}
```

Settings are persisted to `localStorage` under key `"0canvas-ai-settings"`. Functions:
- `loadAiSettings()` -- loads and merges with defaults
- `saveAiSettings(settings)` -- writes to localStorage
- `isAiConfigured(settings)` -- checks if the selected provider has required config

### Available Models

The `AVAILABLE_MODELS` array lists 22 model options spanning the GPT-4o through GPT-5.4 family, plus reasoning models (o3, o4-mini). Each entry has a `value` (API model ID) and `label` (display name).

### Streaming API

```typescript
async function* streamChat(options: StreamOptions): AsyncGenerator<string>
```

An async generator that yields text chunks as they arrive. Dispatches to the appropriate endpoint based on provider:

1. **chatgpt provider**: Calls `streamChatCompletions()` against `{proxyUrl}/v1/chat/completions` with no API key
2. **openai provider**: Calls `streamChatCompletions()` against `https://api.openai.com/v1/chat/completions` with the API key
3. **ide provider**: Does not stream (handled elsewhere)

### Internal Functions

#### `streamChatCompletions(url, apiKey, model, messages, temperature, signal)`
Sends a POST request with `stream: true` and `max_tokens: 4096`. Parses the SSE response.

#### `streamResponses(url, model, messages, signal)`
Alternative streaming function for the Responses API format (used by the ChatGPT proxy). Converts messages to the Responses API input format via `toResponsesInput()`, which strips system messages and wraps content in `input_text` blocks.

#### `parseSSEStream(response)`
Shared SSE parser that handles both response formats:
- **Responses API**: Looks for `type: "response.output_text.delta"` events, yields `parsed.delta`
- **Chat Completions**: Looks for `choices[0].delta.content`, yields that content
- Handles `[DONE]` sentinel, malformed chunks, and incremental buffering

### Message Format

```typescript
interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
```

Standard OpenAI chat message format. System messages are extracted as `instructions` when using the Responses API format.

### Usage in 0canvas

The AI streaming client powers the AI chat panel for design assistance queries. It is not used by the style panel editors directly, but it shares the same localStorage persistence pattern and is part of the same library layer. The `autoSendFeedback` setting (currently defaulting to `false`) was part of a feedback system that has been removed but the setting remains.

---

## Cross-Library Dependencies

```
style-panel.tsx
  |-- imports getAutocompleteSuggestions() from lib/css-properties.ts
  |-- imports detectTailwindClasses() from lib/tailwind.ts
  |
  |-- editors/tailwind-editor.tsx
        |-- imports detectTailwindClasses, classifyTailwindClass,
        |   COMMON_TAILWIND_CLASSES from lib/tailwind.ts
  |
  |-- panels/ai-chat-panel.tsx (separate panel)
        |-- imports streamChat, loadAiSettings, etc. from lib/openai.ts
```

The css-properties and tailwind libraries are pure data + utility functions with no side effects or state. The openai library manages its own localStorage persistence but is otherwise stateless.
