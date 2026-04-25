# DOM Inspector

> **Doc label (PR 4):** Partial — engine and Col 3 behavior described here is largely still accurate. Mentions of the **VS Code extension**, **Tauri**, or **live ACP runtime** in the prose below are **historical** unless stated otherwise. Current stack: **Electron** + local engine — see [`03-Mac-App-Architecture.md`](../../Zeros-Structure/03-Mac-App-Architecture.md). Full index: [`12-Doc-Index-And-Labels.md`](../../Zeros-Structure/12-Doc-Index-And-Labels.md).

The DOM Inspector is the core click-to-inspect system that lets users hover, select, and interact with elements in the target document. It was originally a single 2177-line monolith (`dom-inspector.ts`) and was split into 9 focused modules during the A1 refactor.

## Source Files

| File | Lines (approx) | Purpose |
|------|----------------|---------|
| `src/zeros/inspector/index.ts` | 150 | Barrel exports, `setInspectionTarget`, `resetInspectionTarget`, master `cleanup()` |
| `src/zeros/inspector/constants.ts` | 85 | `IGNORED_TAGS`, `OC_ATTR`, `STYLE_PROPS`, hardcoded design tokens for iframe context |
| `src/zeros/inspector/target.ts` | 32 | Shared mutable state for the inspection target document and iframe |
| `src/zeros/inspector/dom-walker.ts` | 570 | DOM traversal, element mapping, style extraction, snapshots, agent output |
| `src/zeros/inspector/overlay.ts` | 273 | Hover and select highlight overlays |
| `src/zeros/inspector/inspect-mode.ts` | 205 | Click-to-inspect interaction logic, mode switching, pause/resume |
| `src/zeros/inspector/event-manager.ts` | 61 | Listener tracking utility to prevent memory leaks |
| `src/zeros/inspector/feedback-pill.ts` | 587 | Floating feedback annotation card and feedback markers |
| `src/zeros/inspector/theme-pill.ts` | ~900 | Theme-specific color inspector popup with token picker |
| `src/zeros/inspector/component-detection.ts` | 253 | Framework-aware component name detection (React, Vue, Angular, Svelte) |

---

## How DOM Inspection Works

### Click-to-select flow

1. **Start inspection:** `startInspect(onSelect)` is called. This rebuilds the element map, attaches `mousemove` and `click` listeners to the target document (with `capture: true`), and sets `cursor: crosshair` on the body.

2. **Hover:** As the user moves the mouse, `inspectHoverHandler` fires. It checks if the target element has `data-Zeros` (skip own UI), then looks up the element's ID in `elementMap` and calls `highlightElement(id, "hover")` to show a dashed blue overlay.

3. **Click:** When the user clicks, `inspectHandler` fires. It:
   - Prevents default behavior and stops propagation
   - Hides any existing feedback/theme pill
   - Records the click position via `setLastClickPos()`
   - Hides the hover overlay
   - Shows the select overlay with `highlightElement(id, "select", clickX, clickY)`
   - Calls the `onSelect(id, element)` callback

4. **Pill display:** The select overlay triggers `_showPillForMode()`, which shows the appropriate pill based on the current inspect mode.

5. **Dismiss:** Pressing Escape or clicking Cancel calls `dismissSelection()`, which hides all pills and overlays, then resumes inspection.

### Target document

The inspector can target either `window.document` (engine/dev mode) or an `iframe.contentDocument` (package mode with preview iframe). The target is managed by `target.ts`:

```typescript
let targetDoc: Document = document;
let targetIframe: HTMLIFrameElement | null = null;
```

`setInspectionTarget(doc, iframe)` switches the target, cleaning up overlays when the document changes.

---

## The 3 Inspect Modes

The inspector supports three modes, controlled by `setInspectMode()`:

| Mode | Pill shown | Purpose |
|------|-----------|---------|
| `"style"` | None (selection highlight only) | Select elements to view computed styles in the Style Panel |
| `"feedback"` | Feedback pill (textarea + actions) | Add/edit design feedback annotations |
| `"theme"` | Theme pill (color properties + token picker) | Inspect and override color tokens |

Mode routing is handled in `inspect-mode.ts` via `setOverlayPillCallbacks()`:

```typescript
setOverlayPillCallbacks(
  (el, clickX, clickY) => {
    if (_inspectMode === "theme")    showThemeInspectorPill(el, clickX, clickY);
    else if (_inspectMode === "feedback") showInspectorPill(el, clickX, clickY);
    else { /* style mode — no pill */ }
  },
  () => { hideInspectorPill(); hideThemeInspectorPill(); }
);
```

---

## Element Identification and Mapping

### Element map

Two parallel data structures track elements:

- `elementMap: WeakMap<Element, string>` — DOM element to Zeros ID (e.g., `"oc-42"`)
- `idToElement: Map<string, Element>` — Zeros ID back to DOM element

Both are built by `rebuildElementMap()`, which walks the target document's body recursively up to depth 15.

### ID generation

Each element gets a sequential ID: `oc-1`, `oc-2`, etc. The counter resets when the map is rebuilt.

### Selector generation

`getSelector(el)` produces a CSS-like selector string for display purposes:

1. If the element has an `id`, return `#escaped-id`
2. If it has non-`oc-` classes, return `tag.class1.class2.class3` (max 3 classes)
3. If there are sibling elements with the same tag, return `tag:nth-child(n)`
4. Fallback: just the tag name

### Element filtering

These elements are skipped during DOM walking:

- Elements with `data-Zeros` attribute or inside a `[data-Zeros]` ancestor
- Tags in `IGNORED_TAGS`: `SCRIPT`, `STYLE`, `LINK`, `META`, `HEAD`, `NOSCRIPT`, `BR`, `WBR`
- Zero-dimension elements with no children
- Elements deeper than 15 levels

---

## Computed Style Capture

The `STYLE_PROPS` array in `constants.ts` defines 40 CSS properties that are captured for each inspected element:

**Typography:** `color`, `fontSize`, `fontFamily`, `fontWeight`, `lineHeight`, `letterSpacing`, `textAlign`

**Spacing:** `padding` (and all 4 sides), `margin` (and all 4 sides)

**Sizing:** `width`, `height`, `maxWidth`, `maxHeight`, `minWidth`, `minHeight`

**Layout:** `display`, `flexDirection`, `alignItems`, `justifyContent`, `gap`, `gridTemplateColumns`

**Position:** `position`, `top`, `right`, `bottom`, `left`, `zIndex`

**Visual:** `overflow`, `opacity`, `borderRadius`, `border`, `borderColor`, `borderWidth`, `boxShadow`, `transform`, `transition`

`getComputedStyles(el)` uses `window.getComputedStyle()` (or the target document's `defaultView`) and filters out default/empty values (`none`, `normal`, `auto`).

Computed styles are only captured for elements at depth < 8 to avoid performance issues on deep trees.

---

## EventManager Pattern

The `EventManager` class solves the memory leak problem that occurred in the original monolith where event listeners were added but never properly cleaned up.

```typescript
class EventManager {
  private listeners: ListenerEntry[] = [];

  add(element, type, handler, capture = false): void;   // addEventListener + track
  remove(element, type, handler, capture = false): void; // removeEventListener + untrack
  cleanup(): void;                                        // remove ALL tracked listeners
}
```

Each module that attaches DOM event listeners creates its own `EventManager` instance:

- `inspect-mode.ts` — for mousemove/click handlers on the target document
- `feedback-pill.ts` — for pill button clicks, textarea events, keyboard handlers
- `theme-pill.ts` — for color picker interactions, token search, button events

On cleanup, calling `events.cleanup()` removes every listener that was registered through that manager, even if the DOM element has been removed.

---

## Overlay Rendering

The overlay module creates two absolutely-positioned `<div>` elements in the target document:

### Hover overlay

- Dashed blue border (`1.5px dashed ${OC_PRIMARY}99`)
- Semi-transparent blue background (`${OC_PRIMARY}0A`)
- A label above the element showing the component/tag name (from `identifyElement()`)
- `pointer-events: none`

### Select overlay

- Solid blue border (`2px solid ${OC_PRIMARY}`)
- Slightly more opaque background (`${OC_PRIMARY}0F`)
- **Tag label** (top-left): Component name on a blue background pill
- **Size label** (bottom-left): `width x height` in pixels, monospace font on dark background
- `pointer-events: none`

Both overlays are positioned using `position: absolute` with coordinates calculated from `getBoundingClientRect()` plus scroll offsets (`toAbsolute()`). They use `z-index: 2147483646` to sit above everything except the inspector pills.

### Document switching safety

`ensureOverlay()` checks if the existing overlay belongs to the current target document. If the document has changed (e.g., iframe navigation), it destroys the old overlay and creates a new one.

---

## Feedback Pill UI

The feedback pill is a floating card that appears at the click position when an element is selected in feedback mode.

### Layout

```
+-------------------------------------------+
| [icon] ComponentName  [copy] [fork]       |  <- Row 1: Header
|-------------------------------------------|
| [textarea: "Describe the change..."]      |  <- Row 2: Input
|-------------------------------------------|
| [delete?]        [Cancel] [Add]           |  <- Row 3: Actions
+-------------------------------------------+
```

### Features

- **Width:** 320px fixed
- **Position:** 12px to the right of the click position, adjusted to stay within the viewport
- **Background:** `OC_SURFACE_FLOOR` with `OC_BORDER_1` border, 12px border-radius, heavy box-shadow
- **Textarea:** Auto-resizing (max 120px), focus ring on `OC_PRIMARY`
- **Keyboard:** Enter submits, Escape dismisses, Shift+Enter for newline

### Header buttons

| Button | Action |
|--------|--------|
| Copy | Copies `generateAgentOutput()` markdown to clipboard (element tag, classes, position, computed styles, selector path) |
| Fork | Triggers `_forkElementCallback(elementId)` to create a variant snapshot |

### Action buttons

| Button | Action |
|--------|--------|
| Delete | Only shown in edit mode (when element has existing feedback). Calls `_deleteCallback(elementId)` |
| Cancel | Calls `_dismissSelection()` to close pill and resume inspection |
| Add | Calls `_changeCallback(elementId, description, clickPos)` to submit feedback |

### Edit mode

If the selected element already has feedback (detected via `_feedbackLookup`), the textarea is pre-filled with the existing comment and the Delete button appears.

### Feedback markers

Numbered pins are rendered at each annotated element's position:

- 22x22px blue circles with white border
- Number displayed in center
- On hover: morphs to pencil icon, scales to 1.15x
- On click: selects the element and opens the pill for editing
- Positioned using absolute coordinates relative to the target document body

---

## Theme Pill UI

The theme pill is a color-focused inspector popup that appears when clicking elements in theme mode.

### Layout

```
+-------------------------------------------+
| [droplet] ComponentName        [X]        |  <- Header
|-------------------------------------------|
| BACKGROUND-COLOR                  [Reset] |  <- Property row
| [swatch] #171717    --grey-900            |  <- Value display
| [Pick a token...]                          |  <- Token picker button
|   [Search tokens...]                       |  <- Inline search (when open)
|   [swatch] --grey-50   #FAFAFA           |  <- Token options
|   [swatch] --grey-100  #F5F5F5           |
|   ...                                      |
|-------------------------------------------|
| COLOR                             [Reset] |  <- Next property
| ...                                        |
|-------------------------------------------|
| [+ Add color property]                     |  <- Add section
+-------------------------------------------+
```

### Features

- **Width:** 300px
- **Scrollable body:** Max height adapts to viewport (up to 360px)
- **Token provider:** Calls `_themeTokensProvider()` to get available design tokens
- **Change tracking:** Calls `_themeChangesProvider()` to show which properties have been modified (highlighted in blue)

### Color property row

Each color property row shows:

1. **Property name** (uppercase, with blue dot if changed)
2. **Source info** (CSS selector where the rule comes from, or "inline style", or "browser default"; inherited properties shown in yellow)
3. **Value:** Color swatch + computed hex value + token chain (if value comes from a CSS variable)
4. **Reset button:** Removes inline style override, clears shorthand sub-properties, and calls `_themeResetCallback`
5. **Token picker:** Inline searchable dropdown of all available tokens

### Token application

When a token is selected:

1. `el.style.setProperty(property, "var(--token-name)")` applies the token
2. Shorthand sub-properties (e.g., `border-color` expands to `border-top-color`, etc.) are also set
3. `_themeChangeCallback` fires with full context: element ID, selector, tag, classes, property, original value, original token chain, source selector, source type, new token, new value, and bounding box

### Add property

The "Add color property" button opens an inline searchable dropdown listing all CSS color properties not already displayed. Selecting one computes the current value and adds a new property row.

### Theme change markers

Similar to feedback markers: 22x22px circles with number, positioned at the changed element. On hover shows pencil icon, on click selects the element and opens the theme pill.

---

## Component Detection

The `identifyElement(el)` function walks through multiple detection strategies in priority order to find the best human-readable name for a DOM element:

### Detection priority

| Priority | Source | Strategy |
|----------|--------|----------|
| 1 | `react` | Walk React fiber tree upward (max 15 levels), skip framework internals |
| 2 | `vue` | Check `__vue__` or `__vueParentComponent` for Vue 2/3 instance |
| 3 | `angular` | Use `ng.getComponent()` API or parse custom element tag names |
| 4 | `svelte` | Read `__svelte_meta.loc.file` for component filename |
| 5 | `data-attr` | Check `data-testid`, `data-test-id`, `data-component`, `data-component-name`, `data-cy` |
| 6 | `css-module` | Match class names against CSS Module pattern (`Component_class_hash`) or styled-component pattern |
| 7 | `aria` | Read `aria-label`, `aria-labelledby`, or associated `<label>` |
| 8 | `role` | Map WAI-ARIA roles to names (e.g., `role="navigation"` -> "Navigation") |
| 9 | `semantic` | Map semantic HTML tags (e.g., `<nav>` -> "Navigation", `<header>` -> "Header") |
| 10 | `tag` | Fallback: `tag.firstClass` or just `tag` |

### React fiber walking

The React detection is the most complex. It:

1. Finds the fiber key (`__reactFiber$` or `__reactInternalInstance$`) on the DOM element
2. Walks up the fiber tree via `.return`
3. Extracts component name from `type.displayName`, `type.name`, or unwraps `ForwardRef`/`Memo`/`Context`/`Lazy` wrappers
4. Skips framework internals via `REACT_SKIP_PATTERNS` (58 patterns including Provider, Consumer, Fragment, Suspense, Next.js internals, Router components, etc.)

### Return type

```typescript
type ComponentInfo = {
  displayName: string;      // e.g., "Header", "Button", "nav.main-nav"
  source: "react" | "vue" | "angular" | "svelte" | "css-module" | "semantic" | "role" | "aria" | "data-attr" | "tag";
  tag: string;              // e.g., "div", "button"
  classes: string[];         // First 3 non-oc- classes
};
```

---

## flashElement() — Live Change Visualization

When a style change is applied, `flashElement(elementId)` creates a temporary green-bordered overlay that fades out:

1. Creates an absolutely-positioned `<div>` with `data-Zeros="flash-overlay"`
2. Styled with `border: 2px solid #22c55e` (green)
3. Animated with `@keyframes oc-flash`: green box-shadow pulse fading to transparent over 1.5s
4. Auto-removed after 1500ms

The keyframes are injected as a separate `<style id="oc-flash-keyframes">` element in the target document (injected only once).

---

## Architecture: The A1 Split

The original `dom-inspector.ts` was a 2177-line monolith containing all inspection logic. The A1 refactor split it into 9 modules with clear responsibilities:

```
dom-inspector.ts (2177 lines, deleted)
    |
    +-- constants.ts       (shared config)
    +-- target.ts          (mutable target document)
    +-- dom-walker.ts      (DOM traversal, mapping, snapshots)
    +-- overlay.ts         (hover/select highlight divs)
    +-- inspect-mode.ts    (start/stop/pause inspection, mode routing)
    +-- event-manager.ts   (listener lifecycle management)
    +-- feedback-pill.ts   (feedback annotation card + markers)
    +-- theme-pill.ts      (color inspector popup + token picker)
    +-- component-detection.ts (framework component name resolution)
```

The barrel file `index.ts` re-exports all public functions and provides orchestration functions like `setInspectionTarget()`, `resetInspectionTarget()`, and `cleanup()`.

### Cross-module communication

Modules communicate via callback registration functions (dependency injection pattern):

- `setOverlayPillCallbacks(show, hide)` — overlay calls into inspect-mode to show the right pill
- `setDismissSelection(fn)` — feedback-pill calls back into inspect-mode
- `setThemeDismissSelection(fn)` — theme-pill calls back into inspect-mode
- `setThemePauseInspection(fn)` — theme-pill can pause inspection while its UI is active

---

## Snapshot System

The inspector can capture full HTML/CSS snapshots of elements or entire pages:

### `capturePageSnapshot()`

1. Deep-clones `targetDoc.body`
2. Sanitizes: removes `<script>` tags, `on*` event handlers, `[data-Zeros]` elements
3. Absolutifies relative URLs (images, srcset, CSS `url()`)
4. Collects all CSS rules from stylesheets (including adopted stylesheets) and inline `<style>` tags
5. Collects external stylesheet `<link>` tags as `@import` rules
6. Extracts mock data (image URLs, text content)
7. Returns `{ html, css, mockData, sourceType: "page", sourceContentHeight }`

### `captureComponentSnapshot(elementId)`

Same as page snapshot but scoped to a single element by Zeros ID.

### `pushVariantToMain(sourceElementId, newHtml, newCss?)`

Replaces a live DOM element with new HTML (and optionally injects new CSS). Used when "pushing" a variant back to the main page.

---

## Pending Improvements

- **Canvas-based rendering:** The current overlay system uses absolutely-positioned HTML `<div>` elements. The planned improvement is to switch to a `<canvas>` element for overlay rendering, following the Chrome DevTools pattern. This would improve performance for large pages and enable smoother animations.
- **Cross-origin iframe support:** The inspector cannot access cross-origin iframe content due to browser security restrictions.
- **Performance on deep DOMs:** The depth-15 limit and depth-8 style extraction limit are pragmatic but could be made configurable.
- **Pointer Lock for smoother element navigation:** During inspection, element jumping on hover could be smoother with the Pointer Lock API.
