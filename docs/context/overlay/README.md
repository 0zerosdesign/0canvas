# Overlay Engine

> **Doc label (PR 4):** Partial — engine and Col 3 behavior described here is largely still accurate. Mentions of the **VS Code extension**, **Tauri**, or **live ACP runtime** in the prose below are **historical** unless stated otherwise. Current stack: **Electron** + local engine — see [`03-Mac-App-Architecture.md`](../../Zeros-Structure/03-Mac-App-Architecture.md). Full index: [`12-Doc-Index-And-Labels.md`](../../Zeros-Structure/12-Doc-Index-And-Labels.md).
>
> **🚧 Partially stale (2026-04-20).** In the Mac app, "overlay" means
> **Column 3** — the engine workspace lives inside a native column,
> not as a portal on `document.body`. No FAB toggle button, no
> `data-Zeros=portal` injected div. The `<Zeros />` component
> described below is still shipped for the npm distribution channel
> (V2); the Mac app instead mounts `<EngineWorkspace />` directly
> inside `<div className="oc-column-3">`. Command palette (Cmd+/) and
> inline edit (Cmd+K) still work identically.
>
> See [../README.md](../README.md).

---

The Overlay Engine is the root component and runtime that mounts the entire Zeros design workspace as a floating overlay on top of any web page. It is the primary consumer-facing API of the package.

## Source Files

| File | Purpose |
|------|---------|
| `src/zeros/engine/zeros-engine.tsx` | Main `<Zeros />` component, `EngineWorkspace` layout, `useResizable` hook |
| `src/zeros/engine/zeros-styles.ts` | Runtime CSS injection (`injectStyles` / `removeStyles`) — legacy monolith, still the active entry point |
| `src/zeros/engine/styles/index.ts` | Barrel file for the split CSS module system |
| `src/zeros/engine/styles/tokens.ts` | Design tokens (CSS custom properties) |
| `src/zeros/engine/styles/layout.ts` | Tailwind-style utility classes |
| `src/zeros/engine/styles/panels.ts` | Panel containers, sidebar, layers panel |
| `src/zeros/engine/styles/toolbar.ts` | Workspace toolbar and project dropdown |
| `src/zeros/engine/styles/canvas.ts` | Source node, variant node, resize handles, variant canvas |
| `src/zeros/engine/styles/style-panel.ts` | Style panel property rows, sections, tabs, computed view |
| `src/zeros/engine/styles/agent-panel.ts` | Agent panel IDE cards, status badges, MCP setup |
| `src/zeros/engine/styles/command-palette.ts` | Command palette overlay, input, item list |
| `src/zeros/engine/styles/settings.ts` | Settings page navigation and content area |
| `src/index.ts` | Public barrel exports for the npm package |

---

## How the Overlay Mounts on the Page

The `<Zeros />` component uses a **React portal** to mount its UI directly onto `document.body`, completely separate from the host application's React tree.

### Mount sequence:

1. On mount, a `<div id="Zeros-portal">` container is created and appended to `document.body`. This container has `pointer-events: none` so it doesn't interfere with the host page.
2. `injectStyles()` is called to inject a `<style id="Zeros-injected-styles">` element into `document.head` containing all Zeros CSS.
3. `ReactDOM.createPortal()` renders Zeros UI into the portal container.
4. On unmount, `cleanup()` removes all inspector overlays, the portal container is removed from the DOM, and `removeStyles()` removes the injected `<style>` tag.

### Portal container attributes:

```html
<div id="Zeros-portal"
     data-Zeros="portal"
     style="position:relative;z-index:2147483640;pointer-events:none;">
```

### Iframe guard:

A constant `IFRAME_GUARD` checks `window.name === "Zeros-preview"` to prevent Zeros from mounting inside its own preview iframes.

---

## Component Tree

When the overlay is open, the full component hierarchy is:

```
ReactDOM.createPortal(
  <div data-Zeros-root data-Zeros="root">       // Fixed overlay container
    <WorkspaceProvider>                               // Zustand-like store context
      <BridgeProvider>                                // WebSocket bridge to VS Code
        <AutoConnect>                                 // Auto-connects project on mount
          <EngineWorkspace onClose={toggle} />        // Full workspace layout
        </AutoConnect>
      </BridgeProvider>
    </WorkspaceProvider>
  </div>,
  portalRef.current                                   // #Zeros-portal on document.body
)
```

### AutoConnect

The `AutoConnect` wrapper checks if `state.project` exists. If not, it dispatches a `CONNECT_PROJECT` action using the current page's `document.title` and `window.location.origin`. This means the engine mode requires no manual onboarding — it auto-connects to the current page.

---

## Toggle Behavior

### Keyboard shortcut: `Ctrl+Shift+D` (default)

The shortcut key is configurable via the `shortcut` prop (e.g., `shortcut="e"` would use `Ctrl+Shift+E`). Both `ctrlKey` and `metaKey` (Cmd on Mac) are supported.

### FAB button

When closed, a floating action button (FAB) is rendered at the configured `position` corner (default: `bottom-right`). The FAB shows a layered-diamond SVG icon and tooltip with the shortcut key.

### State flow:

```
Closed state:  Portal renders <ToggleButton />
Open state:    Portal renders <div data-Zeros-root> → full workspace
Toggle:        setIsOpen(!prev) + onToggle?.(next)
```

---

## Panel Layout (EngineWorkspace)

The `EngineWorkspace` component renders the three-zone layout:

```
+-------------+-------------------------------------------+
| App Sidebar | Toolbar (top)                              |
| (48px)      |--------------------------------------------+
|             | Canvas (center)    | Right Panel (resizable)|
|             |                    | (280px default)        |
|             |                    | [StylePanel]           |
|             |                    | [AIChatPanel]          |
|             |                    | [Feedback panel]       |
|             |                    | [ThemeModePanel]       |
+-------------+-------------------------------------------+
```

### CSS class structure:

- `.oc-app-shell` — root flex container (`height: 100%; display: flex`)
- `.oc-sidebar` — far-left 48px icon sidebar
- `.oc-workspace` — everything right of the sidebar (`flex: 1; flex-direction: column`)
- `.oc-toolbar` — 48px top toolbar
- `.oc-workspace-main` — horizontal flex container below toolbar
- `.oc-workspace-center` — `flex: 1` canvas area
- `.oc-resize-handle` — 5px drag zone between canvas and right panel
- `.oc-panel-slot` — right panel container with dynamic width

### Page routing (no React Router):

The `state.activePage` drives which page is shown:

| `activePage` | Component shown |
|-------------|----------------|
| `"design"` | Toolbar + Canvas + Right Panel |
| `"themes"` | `<ThemesPage />` |
| `"settings"` | `<SettingsPage />` |

---

## Design Mode Switching

The right panel content switches based on `state.designMode`:

| `designMode` | Right panel content |
|-------------|---------------------|
| `"style"` | `<StylePanel />` — computed styles, box model, code view |
| `"ai"` | `<AIChatPanel />` — AI chat interface |
| `"feedback"` | Inline feedback list with pending count badge |

When `state.themeMode` is active, it **overrides all modes** and shows `<ThemeModePanel />` instead.

---

## Resizable Panel System

The `useResizable(initial, min, max)` hook provides drag-to-resize functionality:

- **Default width:** 280px
- **Min width:** 200px
- **Max width:** 500px
- **Direction:** `-1` (dragging left increases width, dragging right decreases)

### Implementation:

1. `onMouseDown` captures the starting X position and current width.
2. During `mousemove`, delta is calculated: `(ev.clientX - startX) * direction`.
3. New width is clamped to `[min, max]`.
4. On `mouseup`, listeners are cleaned up and cursor is restored.

The resize handle renders as a `.oc-resize-line` (1px line) that becomes a 3px blue bar on hover.

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `"bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | `"bottom-right"` | FAB button position |
| `defaultOpen` | `boolean` | `false` | Start with panel open |
| `theme` | `"dark" \| "light" \| "auto"` | `"dark"` | Color theme (only dark implemented) |
| `shortcut` | `string` | `"d"` | Keyboard shortcut key (Ctrl+Shift+{key}) |
| `devOnly` | `boolean` | `true` | Only render in non-production environments |
| `zIndex` | `number` | `2147483640` | CSS z-index for the overlay |
| `onToggle` | `(isOpen: boolean) => void` | — | Callback when overlay opens/closes |

### devOnly behavior:

When `devOnly` is `true` (default), Zeros checks `process.env.NODE_ENV`. If it equals `"production"`, the component returns `null`. The check is done carefully to handle environments where `process` may not exist.

---

## Runtime CSS Injection

### How it works

All Zeros styles are defined as JavaScript template literal strings and injected into the page at runtime as a single `<style>` tag.

```typescript
export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;   // idempotent
  const style = document.createElement("style");
  style.id = "Zeros-injected-styles";
  style.textContent = ZEROS_CSS;               // ~3300 lines of CSS
  document.head.appendChild(style);
}
```

### Scoping

All CSS rules are scoped under `[data-Zeros-root]`. This is achieved by passing the scope selector `S = "[data-Zeros-root]"` to each CSS module function:

```typescript
const S = "[data-Zeros-root]";
// Every rule becomes:
// [data-Zeros-root] .oc-toolbar { ... }
```

This ensures Zeros styles never leak into the host application.

### Targeted reset

The tokens module includes a targeted CSS reset under `[data-Zeros-root]` that overrides any inherited styles from the host page, including `font-family`, `font-size`, `line-height`, `color`, `box-sizing`, and more. All overrides use `!important` to ensure isolation.

---

## Styles Architecture (After A2 Split)

The CSS was split from a single ~3300-line monolith (`zeros-styles.ts`) into 9 focused module files in `src/zeros/engine/styles/`:

| Module | Lines (approx) | Responsibility |
|--------|----------------|----------------|
| `tokens.ts` | 180 | Design tokens (CSS custom properties), targeted reset, scrollbar styling |
| `layout.ts` | 400 | Tailwind-style utility classes (flex, gap, padding, margin, borders, backgrounds, text, effects, hover/focus states) |
| `panels.ts` | 190 | Panel containers (`.oc-panel`), sidebar (`.oc-sidebar`), workspace layout, resize handle, layers panel |
| `toolbar.ts` | 160 | Workspace toolbar (`.oc-toolbar`), project dropdown, MCP badges |
| `canvas.ts` | 170 | Source node chrome, variant cards, resize handles, variant canvas |
| `style-panel.ts` | 145 | Style panel tabs, property rows, box model, code blocks, computed view |
| `agent-panel.ts` | 125 | Agent IDE cards, status badges, MCP setup cards, log entries |
| `command-palette.ts` | 40 | Command palette overlay, input, item list |
| `settings.ts` | 65 | Settings page nav and content area |

The barrel file `styles/index.ts` combines all modules:

```typescript
export const ZEROS_CSS = `
${[
  tokensCSS(S),
  layoutCSS(S),
  panelsCSS(S),
  toolbarCSS(S),
  stylePanelCSS(S),
  canvasCSS(S),
  agentPanelCSS(S),
  commandPaletteCSS(S),
  settingsCSS(S),
].join("\n")}
`;
```

Note: The legacy `zeros-styles.ts` monolith still exists and is the active entry point used by `injectStyles()`. The split modules in `styles/` are the newer architecture but both contain the same CSS.

---

## Design Token System

Zeros uses a two-tier token system:

### Tier 1: Primitive scales

Raw color values organized by hue: `--grey-50` through `--grey-950`, `--blue-50` through `--blue-900`, plus red, green, yellow, orange, purple, pink, teal, cyan, indigo.

### Tier 2: Semantic tokens

Purpose-driven aliases that reference primitives:

- **Surface:** `--color--surface--floor`, `--color--surface--0`, `--color--surface--1`, `--color--surface--2`, `--color--surface--absolute`, `--color--surface--inverted`
- **Text:** `--color--text--on-surface`, `--color--text--on-surface-variant`, `--color--text--muted`, `--color--text--disabled`, `--color--text--hint`, `--color--text--on-primary`, `--color--text--primary`, `--color--text--link`, status variants
- **Border:** `--color--border--on-surface-0`, `--color--border--on-surface-1`, `--color--border--on-surface-2`
- **Base:** `--color--base--primary`, `--color--base--primary-hover`, `--color--base--primary-light`
- **Status:** `--color--status--info`, `--color--status--success`, `--color--status--warning`, `--color--status--critical`, `--color--status--connecting`
- **Outline:** `--color--outline--focus`, `--color--outline--on-background`
- **Shadow:** `--color--shadow--surface`, `--color--shadow--overlay`
- **Syntax highlighting:** `--color--syntax--comment`, `--color--syntax--selector`, `--color--syntax--property`, `--color--syntax--value`
- **Typography:** `--font-sans`, `--font-mono`, size scale (`--font-size-xxs` to `--font-size-xl`), weight scale
- **Shadows:** `--shadow-sm` through `--shadow-xl`

---

## Project Persistence

The `EngineWorkspace` manages .0c project file persistence:

1. **Load on mount:** Reads from IndexedDB via `loadProjectFile()` and dispatches `LOAD_FROM_OC_FILE`.
2. **Auto-save on changes:** Calls `scheduleAutoSave()` whenever `ocProject`, `variants`, `feedbackItems`, `currentRoute`, or `ocProjectFile` change.
3. **Bridge sync:** When a `BridgeProvider` connection exists, `setBridgeSender()` wires up filesystem sync to the VS Code extension.
4. **Export:** `handleExportDD()` builds and downloads a `.0c` file.
5. **Import:** `handleImportDD()` reads a `.0c` file with a confirmation dialog if data would be overwritten.

---

## Auto-Send Feedback

When `state.aiSettings.autoSendFeedback` is enabled, newly added feedback items are automatically sent to the AI agent via the bridge:

1. A `useRef` tracks the previous feedback count.
2. When new items appear, each pending item is formatted as an `AI_CHAT_REQUEST` message.
3. A notification banner appears for 3 seconds: "Feedback sent to agent: ..."

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` (default) | Toggle overlay open/close |

Additional shortcuts are handled by child components (Cmd+K for inline edit, Escape for dismiss, etc.).

---

## Public API (src/index.ts)

The package exports:

- **Component:** `Zeros` (default and named export), `ZerosProps` type
- **Inspector utilities:** `buildElementTree`, `rebuildElementMap`, `getElementById`, `highlightElement`, `applyStyle`, `startInspect`, `stopInspect`, `isInspecting`, `generateAgentOutput`, `cleanup`, `setInspectionTarget`, `resetInspectionTarget`, `capturePageSnapshot`, `captureComponentSnapshot`, `pushVariantToMain`, `getElementOuterHTML`, `onForkElementRequest`, `onChangeRequest`, `renderFeedbackMarkers`, `clearFeedbackMarkers`, `onEditFeedbackRequest`
- **Component detection:** `identifyElement`, `ComponentInfo`
- **CSS injection:** `injectStyles`, `removeStyles`
- **Store types:** `ElementNode`, `FeedbackItem`, `FeedbackIntent`, `FeedbackSeverity`, `VariantData`, `OCProject`
- **.0c format:** Document CRUD, parser, project file schema, validation, migration
- **Bridge:** `BridgeProvider`, `useBridge`, `useBridgeStatus`, `CanvasBridgeClient`, message types
- **Project store:** IndexedDB persistence, import/export, auto-save

---

## Pending Improvements

- **Full-screen mode:** The overlay currently fills the viewport but has no true full-screen (F11-style) mode.
- **Responsive breakpoint in canvas:** The canvas shows the source page at a fixed or user-resized width, but there is no breakpoint ruler or preset breakpoint snapping for responsive design testing.
- **Light theme:** The `theme` prop accepts `"light"` and `"auto"` but only the dark theme is implemented in the token system.
- **Styles consolidation:** The legacy `zeros-styles.ts` monolith and the split `styles/` modules contain duplicate CSS. These should be unified so only the split modules are the source of truth.
