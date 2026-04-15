# AI Chat Panel

> `src/0canvas/panels/ai-chat-panel.tsx`
> Supporting module: `src/0canvas/lib/openai.ts`

The AI Chat Panel is a context-aware AI design agent embedded in the 0canvas sidebar. It connects to AI providers, sends structured design context, streams responses with live visual preview, and offers per-property accept/reject controls.

---

## Three AI Provider Modes

### 1. ChatGPT (Proxy) — `provider: "chatgpt"`

Uses a local proxy (`npx openai-oauth`, default `http://127.0.0.1:10531`) to access ChatGPT without an API key. The proxy handles OAuth, and 0canvas sends Chat Completions requests to `{proxyUrl}/v1/chat/completions`. No API key is needed; the proxy authenticates via the user's ChatGPT subscription.

### 2. OpenAI (BYOK) — `provider: "openai"`

Direct OpenAI API access. The user enters their own API key in Settings. Requests go to `https://api.openai.com/v1/chat/completions` with `Authorization: Bearer {apiKey}`. Supports all models from GPT-4o through GPT-5.4, including Codex and reasoning variants (o3, o4-mini).

### 3. IDE Agent — `provider: "ide"`

Delegates to the VS Code extension's agent dispatch system. The browser sends an `AI_CHAT_REQUEST` message over the WebSocket bridge. The extension builds a rich markdown context, writes it to `.0canvas/ai-request.md`, and opens the IDE's chat panel (Cursor Composer, Copilot Chat, or Claude Code terminal) with a direct prompt. A 10-second timeout falls back to "Sent to IDE agent." if no response arrives.

**Configuration check:** `isAiConfigured()` requires a proxy URL for ChatGPT, an API key for OpenAI, and always returns true for IDE mode.

---

## Context Modes

The panel detects what the designer is working on and sends the appropriate context to the AI.

### Variant-Aware Context (Full HTML Redesign)

**Trigger:** An active variant is selected (`state.activeVariantId` is set).

The system sends the full component HTML to the AI. If the HTML exceeds 3,000 characters, it is truncated with a `<!-- truncated -->` marker. The context includes:

- Variant name and source type
- Viewport width (default 560px)
- The complete current HTML (from `modifiedHtml` or original `html`)

Uses `VARIANT_SYSTEM_PROMPT` which instructs the AI to return redesigned HTML in an `html-apply` fenced code block with inline styles only. No framework CSS, no full-page wrappers.

### Element-Aware Context (CSS Property Edits)

**Trigger:** No active variant, but an element is selected (`state.selectedElementId`).

The system sends the element's selector, tag name, CSS classes, and up to 20 computed style declarations (converted from camelCase to kebab-case). Uses `ELEMENT_SYSTEM_PROMPT` which instructs the AI to return CSS changes in a `css-apply` fenced code block.

### No Context

When nothing is selected, the panel shows a prompt to select a variant or element, and uses the element system prompt with a "No element or variant selected" context.

---

## System Prompts

### `VARIANT_SYSTEM_PROMPT`

```
You are the AI design agent for 0canvas. You redesign UI components.
```

Key rules:
1. Return ONLY the component HTML in an `html-apply` block
2. Use INLINE STYLES (the variant renders in an isolated iframe)
3. Keep it short -- no full page, no `<html>/<head>/<body>/<style>/<script>` tags
4. No framework CSS (Tailwind, ReactFlow, etc.)
5. Use modern CSS: flexbox, grid, border-radius, box-shadow, gradients
6. Be creative, polished, professional
7. Cohesive color palette, subtle shadows, rounded corners, good spacing
8. Keep content/text, redesign the visual presentation
9. Brief description (1-2 sentences), then the `html-apply` block

### `ELEMENT_SYSTEM_PROMPT`

```
You are the AI design agent for 0canvas -- a visual design tool on production code.
The designer selects elements and asks you to make visual changes.
```

Instructs the AI to return CSS changes in a `css-apply` block. The system auto-applies these to the selected element.

---

## Streaming Responses with Live Display

For local AI modes (ChatGPT/OpenAI), responses stream via SSE (Server-Sent Events). The `streamChat()` async generator yields text chunks as they arrive. The panel accumulates chunks and updates the message content in real-time, providing a live typing effect.

The SSE parser (`parseSSEStream`) handles two formats:
- **Responses API** (ChatGPT proxy): `response.output_text.delta`
- **Chat Completions API** (direct OpenAI): `choices[0].delta.content`

An `AbortController` allows the user to stop streaming mid-response via the Stop button.

---

## Auto-Apply: Code Block Parsing

The AI's response is parsed for special fenced code blocks:

### `html-apply` Blocks (Variant Mode)

```
\`\`\`html-apply
<div class="component">...</div>
\`\`\`
```

Dispatches `UPDATE_VARIANT` with `modifiedHtml` (and optionally `modifiedCss` if a `css-apply` block is also present) to update the variant's iframe preview.

### `css-apply` Blocks (Element Mode)

```
\`\`\`css-apply
background-color: #3B82F6;
border-radius: 12px;
\`\`\`
```

Each property is parsed with regex `^([\w-]+)\s*:\s*(.+?)\s*;?\s*$`, converted from kebab-case to camelCase, and applied via `applyStyle()` (DOM manipulation) and `UPDATE_STYLE` dispatch (store update). Falls back to plain `css` blocks if no `css-apply` blocks are found (but only if the block contains no `{` characters, to avoid matching full CSS rules).

---

## Streaming Visual Preview (CSS Applies As AI Types)

For element-mode CSS changes, properties are applied incrementally as they stream in -- not after completion. The streaming loop:

1. Accumulates the full response text
2. Regex-matches the `css-apply` block so far (including incomplete blocks via `(?:\`\`\`|$)`)
3. Tracks already-applied lines via `streamApplied` array
4. For each new complete property line, calls `applyStyle()` immediately on the DOM
5. Records the `oldValue` returned by `applyStyle()` for potential rollback

This means the designer sees CSS changes appearing on the canvas in real-time as the AI types each property line.

---

## Visual Diff View: Per-Property Accept/Reject

After streaming completes, instead of auto-committing, the panel shows a diff view.

### CSS Changes (`DiffView` Component)

Displays each proposed property change as a row with:
- A **checkbox** (toggled via `handleToggleCssChange`)
- The **property name**
- The **old value** (or "(none)")
- An arrow
- The **new value**

Three action buttons:
- **Apply Selected** -- commits only checked properties, reverts unchecked ones to their `oldValue`
- **Apply All** -- commits all properties regardless of checkbox state
- **Reject** -- reverts ALL streamed preview changes back to original values

### Variant Rewrite (`VariantDiffView` Component)

Simpler binary choice:
- **Apply** -- saves the rewritten HTML/CSS to the variant (with undo history push)
- **Reject** -- discards the rewrite

### IDE Agent Responses

IDE agent responses also go through the diff view. When an `AI_CHAT_RESPONSE` bridge message arrives, the panel parses `html-apply`/`css-apply` blocks, applies CSS changes as preview, and shows the diff view for accept/reject.

---

## Variant Undo History

The panel maintains a stack of up to **10 previous states** in `variantHistory`. Before any variant rewrite (either direct or via diff apply), the current `modifiedHtml` and `modifiedCss` are pushed onto the stack (`slice(-9)` keeps the last 10).

The **Undo button** (shown in the header when history is non-empty):
1. Pops the last state from `variantHistory`
2. Dispatches `UPDATE_VARIANT` with the previous HTML/CSS
3. Adds a system message "Reverted to previous design."

---

## User Workflow

1. **Select an element** on the canvas (or fork a component into a variant)
2. **Switch to the AI tab** in the sidebar
3. The **context badge** shows what the AI will operate on: variant name + type, or element tag + selector
4. **Type a request** in the input field (e.g., "make it minimal and dark", "add more padding")
5. **See changes live** as the AI streams its response (CSS applies in real-time on the canvas)
6. **Review the diff** -- toggle individual property checkboxes
7. **Accept or reject** -- Apply Selected, Apply All, or Reject
8. For variants, use the **Undo button** to revert to any of the last 10 states

---

## Message Flow

### Local AI (ChatGPT / OpenAI)
```
User types query
  -> Build system prompt + context
  -> Build OpenAI messages array (system + history + user query)
  -> streamChat() async generator (SSE streaming)
  -> Chunks update message content live
  -> CSS properties apply to DOM as they stream
  -> On completion: show DiffView / VariantDiffView
```

### IDE Agent
```
User types query
  -> bridge.send(AI_CHAT_REQUEST { query, selector, styles, route })
  -> Extension receives AI_CHAT_REQUEST
  -> Extension builds context, opens agent chat, auto-submits
  -> Agent works on source files
  -> Extension sends AI_CHAT_RESPONSE back
  -> Panel parses response, shows DiffView
  -> 10-second timeout fallback
```

---

## Key Types

| Type | Purpose |
|------|---------|
| `PendingCssChange` | Per-property diff entry: property, oldValue, newValue, checked |
| `PendingVariantRewrite` | Pending HTML (+CSS) rewrite for variant |
| `StreamAppliedEntry` | Tracks streamed preview: property, camelProp, oldValue, newValue |
| `ChatMessage` | Chat history entry: id, role, content, timestamp, pending, applied, appliedChanges |
| `AiSettings` | Provider config: provider, proxyUrl, apiKey, model, temperature, autoSendFeedback |
| `OpenAIMessage` | OpenAI chat format: role (system/user/assistant), content |

---

## File Dependencies

| File | Role |
|------|------|
| `src/0canvas/panels/ai-chat-panel.tsx` | Main panel component |
| `src/0canvas/lib/openai.ts` | AI client: streaming, settings persistence, model list |
| `src/0canvas/bridge/use-bridge.tsx` | `useBridge`, `useBridgeStatus`, `useExtensionConnected` hooks |
| `src/0canvas/bridge/messages.ts` | `BridgeMessage` type, `AI_CHAT_REQUEST`/`AI_CHAT_RESPONSE` |
| `src/0canvas/store/store.tsx` | `useWorkspace`, `findElement`, `UPDATE_VARIANT`, `UPDATE_STYLE` |
| `src/0canvas/inspector/index.ts` | `applyStyle()`, `flashElement()` for DOM manipulation |
| `src/0canvas/ui/scroll-area.tsx` | `ScrollArea` component |
