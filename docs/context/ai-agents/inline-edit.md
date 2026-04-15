# Inline AI Quick-Edit (Cmd+K)

The Inline AI Quick-Edit is a floating input panel that lets users describe a visual change in natural language. The AI streams CSS property changes in real-time, applying each property live as it arrives. The user can then accept or reject the entire batch.

## Source Files

| File | Purpose |
|------|---------|
| `src/0canvas/panels/inline-edit.tsx` | React component: floating panel, phases, accept/reject, position calculation |
| `src/0canvas/lib/ai-stream.ts` | Lightweight OpenAI streaming module: fetch + ReadableStream, no SDK dependency |

---

## Cmd+K Trigger Flow

The inline edit is activated via `Cmd+K` (or `Ctrl+K`), handled by the parent workspace. The workspace dispatches `{ type: "SHOW_INLINE_EDIT", show: true }` to the store, which causes the `<InlineEdit />` component to mount.

### Prerequisites

- An element must be selected (`state.selectedElementId` must be set)
- If no OpenAI API key is configured, the component shows the API key input phase first

---

## Floating Input Positioning

The panel positions itself relative to the selected DOM element:

```typescript
const rect = el.getBoundingClientRect();
const panelWidth = 360;
const panelHeight = 52;
const gap = 8;

// Prefer below the element
let top = rect.bottom + gap;
// Fall back to above if not enough space
if (top + panelHeight > vh - 20) {
  top = rect.top - panelHeight - gap;
}
// Clamp to viewport edges
top = Math.max(12, Math.min(vh - panelHeight - 12, top));

// Center horizontally on the element
let left = rect.left + rect.width / 2 - panelWidth / 2;
left = Math.max(12, Math.min(vw - panelWidth - 12, left));
```

The panel uses `position: fixed` with the calculated `top` and `left` values. It has a 360px width.

---

## Phase State Machine

The component operates as a state machine with 5 phases:

```
api-key  -->  input  -->  streaming  -->  done  -->  [closed]
                |              |            |
                v              v            v
              [closed]       [closed]    [closed] (via reject)
                              |
                              v
                           error  -->  input (retry)
```

### Phase: `api-key`

Shown when no OpenAI API key is stored in localStorage.

- Password input with `sk-...` placeholder
- "Save" button stores the key via `setApiKey()` (writes to `localStorage["0canvas-openai-key"]`)
- On save, transitions to `input` phase
- Escape closes the panel

### Phase: `input`

The main input state. Shows:

- AI wand icon (SVG)
- Text input: "Ask AI to change this element..."
- `Return` kbd hint

**Actions:**
- Enter (without Shift): triggers `handleSubmit()`, transitions to `streaming`
- Escape: closes the panel
- Click outside: closes the panel

### Phase: `streaming`

Shows a spinner and "Applying changes (N)" counter. CSS properties are being applied live.

**Actions:**
- Escape: rejects all changes (reverts) and closes
- Click outside: ignored (prevents accidental dismissal during streaming)

### Phase: `done`

Shows a success checkmark with "Applied N changes" and two action buttons:

- **Accept** (Enter): keeps all applied styles, syncs to store via `UPDATE_STYLE` dispatch, closes
- **Reject** (Escape): reverts all changes in reverse order, closes
- Click outside: triggers accept

### Phase: `error`

Shows an error icon with the error message and a "Retry" button that returns to `input`.

---

## Streaming CSS Application

The key architectural innovation is **property-by-property live application**. As the AI streams its response, each CSS property is applied to the DOM element immediately, creating a real-time visual preview.

### Submit flow

```
1. User types instruction (e.g., "make it rounded with a blue background")
2. handleSubmit() finds the ElementNode from the store
3. streamCSSChanges() is called with:
   - instruction text
   - element tag, classes, current computed styles
   - callbacks: onProperty, onComplete, onError
   - AbortController signal
4. As each property arrives:
   - onProperty(property, value) fires
   - applyStyle(elementId, property, value) applies it to the live DOM
   - The old value is captured for undo
   - The change is pushed to appliedChanges state
5. When streaming completes:
   - onComplete() fires
   - Phase transitions to "done"
```

### The ai-stream.ts module

This is a lightweight, zero-dependency streaming module that calls the OpenAI Chat Completions API directly using `fetch` + `ReadableStream`.

#### API Configuration

- **Model:** `gpt-4o-mini`
- **Temperature:** 0.3 (low for predictable CSS output)
- **Max tokens:** 512
- **API key source:** `localStorage["0canvas-openai-key"]`

#### System prompt

The AI is prompted to act as a CSS expert. It must respond ONLY with a CSS code block containing `property: value;` pairs -- no selectors, no curly braces, no explanations.

```
You are a CSS expert inside a visual design tool called 0canvas.
The user will describe a visual change they want on a selected HTML element.
You MUST respond ONLY with a CSS code block containing property: value pairs.
Do NOT include selectors or curly braces -- just the properties.
...
```

#### User prompt

The user prompt includes the element context:

```
Element: <div> with classes [hero-section, dark]
Current computed styles:
  color: rgb(229, 229, 229);
  background-color: rgb(23, 23, 23);
  font-size: 14px;
  ...

Change requested: "make it rounded with a blue background"
```

#### Streaming parser

The `extractNewProperties()` function parses CSS properties as they stream in, character by character:

1. Tracks code block boundaries (``` markers toggle `insideCodeBlock`)
2. Only parses lines inside code blocks
3. Matches `property: value;` patterns using regex: `/^([a-z][a-z-]*)\s*:\s*(.+?)\s*;?\s*$/i`
4. Each matched property is immediately emitted via `onProperty` callback

This means properties are applied to the DOM as soon as each line of the AI response is received, not after the full response completes.

#### Error handling

- **401:** "Invalid API key. Check your OpenAI key in Settings."
- **Other HTTP errors:** Shows status code and first 200 chars of response body
- **AbortError:** Treated as intentional cancellation, calls `onComplete()` instead of `onError()`
- **Network/unknown errors:** Shows error message

---

## Accept/Reject Mechanism

### Accept

```typescript
const accept = useCallback(() => {
  for (const change of changesRef.current) {
    dispatch({
      type: "UPDATE_STYLE",
      elementId,
      property: change.property,
      value: change.newValue,
    });
  }
  close();
}, [elementId, dispatch, close]);
```

Each applied change is synced to the workspace store as an `UPDATE_STYLE` action. This persists the changes beyond the inline edit session.

### Reject (revert)

```typescript
const reject = useCallback(() => {
  // Revert in REVERSE order to handle dependencies
  for (let i = changesRef.current.length - 1; i >= 0; i--) {
    const change = changesRef.current[i];
    applyStyle(elementId, change.property, change.oldValue);
  }
  close();
}, [elementId, close]);
```

Changes are reverted in reverse order using the captured `oldValue` for each property. This handles cases where later properties might depend on earlier ones (e.g., shorthand properties).

### Change tracking

Two parallel structures track changes:

- `changesRef: useRef<AppliedChange[]>` — mutable ref for callbacks (avoids stale closures)
- `appliedChanges: useState<AppliedChange[]>` — state for rendering the change count

Each `AppliedChange` records:

```typescript
type AppliedChange = {
  property: string;   // CSS property name (kebab-case)
  oldValue: string;   // Previous inline style value (empty string if none)
  newValue: string;   // AI-suggested value
};
```

---

## Keyboard Shortcuts

| Shortcut | Phase | Action |
|----------|-------|--------|
| `Cmd+K` / `Ctrl+K` | (any) | Opens inline edit (handled by parent) |
| `Enter` | `input` | Submit instruction to AI |
| `Enter` | `done` | Accept changes |
| `Escape` | `input`, `error`, `api-key` | Close panel |
| `Escape` | `streaming`, `done` | Reject changes and close |

### Click outside behavior

| Phase | Click outside action |
|-------|---------------------|
| `input`, `error`, `api-key` | Close panel |
| `streaming` | Ignored |
| `done` | Accept changes |

The click-outside handler is attached with a 100ms delay to prevent the initial Cmd+K click from triggering it.

---

## CSS Classes

The component uses these CSS classes (defined in the overlay engine's styles):

- `.oc-inline-edit` — root container
- `.oc-inline-edit-apikey` — API key input phase
- `.oc-inline-edit-apikey-label` — API key helper text
- `.oc-inline-edit-input-row` — horizontal input + button row
- `.oc-inline-edit-input` — text input field
- `.oc-inline-edit-icon` — AI wand icon container
- `.oc-inline-edit-kbd` — keyboard hint badge
- `.oc-inline-edit-send` — API key save button
- `.oc-inline-edit-status` — streaming phase container
- `.oc-inline-edit-spinner` — loading spinner
- `.oc-inline-edit-status-text` — "Applying changes..." text
- `.oc-inline-edit-result` — done phase container
- `.oc-inline-edit-result-info` — checkmark + count
- `.oc-inline-edit-actions` — accept/reject button row
- `.oc-inline-edit-accept` — accept button
- `.oc-inline-edit-reject` — reject button
- `.oc-inline-edit-action-kbd` — inline kbd hints on buttons
- `.oc-inline-edit-error` — error phase container
- `.oc-inline-edit-error-text` — error message
- `.oc-inline-edit-retry` — retry button

---

## Architecture Notes

### No SDK dependency

The AI streaming module (`ai-stream.ts`) uses raw `fetch` with the OpenAI REST API and parses SSE (Server-Sent Events) manually. This avoids adding `openai` as a dependency to the package.

### Abort support

An `AbortController` is created for each streaming request. If the user closes or rejects during streaming, `abortRef.current.abort()` is called, which terminates the fetch request cleanly.

### Store integration

The `InlineEdit` component reads from the workspace store:

- `state.selectedElementId` — which element to edit
- `state.elements` — to find the `ElementNode` (tag, classes, styles)
- `findElement(state.elements, elementId)` — tree search utility

It writes back via dispatch:

- `UPDATE_STYLE` — on accept, to persist changes
- `SHOW_INLINE_EDIT` — on close, to hide the panel

---

## Pending Improvements

- **Pointer Lock for smoother drag:** During accept/reject, the cursor state could use Pointer Lock for smoother interaction, especially when the panel overlaps other interactive elements.
- **Multi-element batch edit:** Currently only a single selected element can be edited. A future improvement would support selecting multiple elements and applying the same instruction to all of them.
- **Token-aware AI responses:** The AI currently outputs raw CSS values. A future version could make the AI aware of the project's design tokens and output `var(--token-name)` references instead of hardcoded values.
- **Provider-agnostic AI:** The module currently hardcodes OpenAI. Future versions could support other providers (Anthropic, local models) or route through the VS Code extension's AI capabilities.
- **Undo history:** Changes are currently all-or-nothing (accept all / reject all). Granular per-property undo would improve the workflow.
- **Streaming preview optimization:** Each `applyStyle()` call triggers a DOM reflow. Batching could improve performance when many properties are applied in quick succession.
