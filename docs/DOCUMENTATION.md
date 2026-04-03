# ZeroCanvas — Complete Project Documentation

> Visual feedback engine for AI-powered development. Inspect elements, edit styles, fork variants, annotate designs, and send structured instructions to AI coding agents — all from a browser overlay.

**Package:** `@zerosdesign/0canvas`  
**Version:** 0.0.5  
**License:** MIT  

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Reference](#2-module-reference)
   - [ZeroCanvas Engine](#21-0canvas-engine)
   - [DOM Inspector](#22-dom-inspector)
   - [Layers Panel](#23-layers-panel)
   - [Style Panel](#24-style-panel)
   - [File Map Panel](#25-file-map-panel)
   - [Variant Canvas (ReactFlow)](#26-variant-canvas)
   - [Source Node](#27-source-node)
   - [Variant Node](#28-variant-node)
   - [Annotation Overlay](#29-annotation-overlay)
   - [Element Chat (Feedback)](#210-element-chat-feedback-panel)
   - [Agent Waitlist](#211-agent-waitlist)
   - [Agent/IDE Panel](#212-agentide-panel)
   - [Version Manager](#213-version-manager)
   - [Command Palette](#214-command-palette)
   - [Workspace Toolbar](#215-workspace-toolbar)
3. [State Management (Store)](#3-state-management)
4. [.0c Format System](#4-oc-format-system)
   - [Variant .0c Format](#41-variant-oc-format)
   - [Project .0c File](#42-project-oc-file)
5. [MCP Server & Bridge](#5-mcp-server--bridge)
6. [IndexedDB Persistence](#6-indexeddb-persistence)
7. [Testing Setup](#7-testing-setup)
8. [What Has Been Implemented](#8-what-has-been-implemented)
9. [Known Limitations](#9-known-limitations)
10. [Future Phases & Roadmap](#10-future-phases--roadmap)

---

## 1. Architecture Overview

ZeroCanvas is a **zero-dependency browser overlay** that wraps around any web application. It works by:

1. **Portal rendering** — The `<ZeroCanvas />` React component creates a portal on `document.body` with z-index `2147483640`, placing its entire UI above the consumer's app.

2. **Iframe isolation** — The consumer's app is loaded inside an `<iframe name="0canvas-preview">` within the Source Node. The `<ZeroCanvas />` component detects when it's running inside this iframe and returns `null` (via the `IFRAME_GUARD`), preventing recursive rendering.

3. **DOM inspection via target document** — The `dom-inspector.ts` module inspects the iframe's `contentDocument` (not the parent). Functions like `setInspectionTarget()`, `buildElementTree()`, and `rebuildElementMap()` operate on this target document.

4. **ReactFlow canvas** — All preview nodes (source + variants) live on an infinite canvas powered by `@xyflow/react`. Users can pan, zoom, drag, and resize nodes.

5. **MCP bridge** — A Node.js HTTP server (`bridge.ts`) + MCP server (`server.ts`) run as a CLI binary. AI agents connect via MCP protocol; the browser polls `http://127.0.0.1:24192/api/poll` for sync.

### File Structure

```
src/
  index.ts                          # Public API exports
  main.tsx                          # Dev app entry
  app/
    store.tsx                       # React Context + useReducer state management
    App.tsx                         # Dev app shell
    routes.ts                       # Dev app routes
    pages/
      workspace.tsx                 # Dev workspace page
      docs.tsx                      # Dev docs page
    components/
      0canvas-engine.tsx         # Main <ZeroCanvas /> component
      dom-inspector.ts              # DOM tree walker, highlight, inspect, snapshot
      source-node.tsx               # Framer-style resizable main preview
      variant-node.tsx              # Resizable variant card with breakpoints
      variant-canvas.tsx            # ReactFlow canvas controller
      layers-panel.tsx              # Element tree sidebar
      style-panel.tsx               # CSS property inspector/editor
      file-map-panel.tsx            # Heuristic component-to-file mapper
      annotation-overlay.tsx        # Drawing tools (rect, arrow, text, freehand)
      element-chat.tsx              # Per-element feedback input form
      agent-waitlist.tsx            # Bottom drawer with queued feedback
      agent-panel.tsx               # IDE connections + MCP server status
      version-manager.tsx           # Design version cards
      command-palette.tsx           # Cmd+K command launcher
      workspace-toolbar.tsx         # Top toolbar with all controls
      variant-db.ts                 # IndexedDB for variants + waitlist
      oc-format.ts                  # .0c variant format (OCDocument, OCNode)
      oc-parser.ts                  # HTML/CSS <-> .0c bidirectional parser
      oc-project.ts                 # .0c project file schema, validator, migrator
      oc-project-store.ts           # IndexedDB persistence for .0c project files
      clipboard.ts                  # Copy-to-clipboard utility
      0canvas-styles.ts          # Runtime CSS injection
      live-canvas.tsx               # Legacy canvas (replaced by variant-canvas)
      ui/                           # Radix-based UI primitives
  mcp/
    server.ts                       # MCP server entry point (Node.js CLI)
    bridge.ts                       # HTTP bridge + state holder
    tools.ts                        # MCP tool definitions
```

---

## 2. Module Reference

### 2.1 ZeroCanvas Engine

**File:** `0canvas-engine.tsx`  
**Export:** `<ZeroCanvas />` component  

**How it works:**
- Creates a portal container `#0canvas-portal` on `document.body`
- When closed: renders a floating FAB button (layers icon, bottom-right by default)
- When open: renders the full workspace overlay (toolbar, panels, canvas)
- Keyboard shortcut: `Ctrl+Shift+D` (configurable via `shortcut` prop)
- Guards: returns `null` if inside the preview iframe or in production mode (when `devOnly=true`)

**Props:**
| Prop | Default | Description |
|------|---------|-------------|
| `position` | `"bottom-right"` | FAB button position |
| `defaultOpen` | `false` | Start with panel open |
| `theme` | `"dark"` | Color theme |
| `shortcut` | `"d"` | Keyboard shortcut key |
| `devOnly` | `true` | Only show in development |
| `zIndex` | `2147483640` | CSS z-index |
| `onToggle` | — | Callback when toggled |

**Internal behavior:**
- `AutoConnect` wrapper auto-connects the project on mount (sets `ProjectConnection` with `window.location.origin`)
- `EngineWorkspace` layout: Toolbar (top) → Layers (left) → Canvas (center) → Style/Files/IDE/Versions (right)
- Polls MCP bridge every 2 seconds for pushed changes and resolved feedback
- Auto-saves `.0c` project file to IndexedDB on state changes (debounced 500ms)
- Loads existing `.0c` project file from IndexedDB on mount

---

### 2.2 DOM Inspector

**File:** `dom-inspector.ts`  
**Role:** Core engine for reading and interacting with the consumer's DOM  

**Key concepts:**
- **Target document** — Either `iframe.contentDocument` (package mode) or `window.document` (dev mode). Set via `setInspectionTarget(doc, iframe)`.
- **Element map** — A bidirectional map (`WeakMap<Element, string>` + `Map<string, Element>`) linking DOM elements to ZeroCanvas IDs.
- **Overlays** — Highlight (hover) and select overlays are created inside the target document so they move naturally with the ReactFlow canvas.

**Exported functions:**

| Function | Description |
|----------|-------------|
| `setInspectionTarget(doc, iframe)` | Set the document to inspect |
| `resetInspectionTarget()` | Reset to main document |
| `buildElementTree()` | Walk DOM, return `ElementNode[]` tree |
| `rebuildElementMap()` | Rebuild id-to-element mapping |
| `getElementById(id)` | Get DOM element by ZeroCanvas ID |
| `applyStyle(elementId, property, value)` | Live CSS edit, returns old value |
| `highlightElement(id, type)` | Show hover/select overlay on element |
| `startInspect(callback)` | Enter click-to-inspect mode |
| `stopInspect()` | Exit inspect mode |
| `isInspecting()` | Check if in inspect mode |
| `capturePageSnapshot()` | Capture full page HTML + CSS (no inline computed styles) |
| `captureComponentSnapshot(elementId)` | Capture single component HTML + CSS |
| `pushVariantToMain(elementId, html, css)` | Replace element's outerHTML in main page |
| `getElementOuterHTML(elementId)` | Get raw outerHTML |
| `generateAgentOutput(elementId)` | Generate markdown output for AI agents |
| `onFeedbackRequest(cb)` | Register callback for "+ Feedback" button |
| `onForkElementRequest(cb)` | Register callback for "Fork" button on overlay |
| `cleanup()` | Remove all overlays, reset state |

**Snapshot behavior (critical fix):**
- `capturePageSnapshot()` and `captureComponentSnapshot()` do NOT bake computed styles as inline overrides. They preserve the HTML structure with class names intact and collect CSS from `<style>` tags and `@import` rules from `<link>` stylesheets.
- This ensures variants remain **responsive** — CSS media queries still apply because they're not overridden by inline pixel values.
- External font imports are collected via `collectExternalStylesheetLinks()` and injected as `@import` rules.

**Selection overlay features:**
- Tag label (e.g., `section.hero`) positioned above the selected element
- Size label (e.g., `1280 x 400`) positioned below
- **Fork button** (green) — calls `onForkElementRequest` with the element's ZeroCanvas ID
- **+ Feedback button** (blue) — opens the Element Chat panel

---

### 2.3 Layers Panel

**File:** `layers-panel.tsx`  

**How it works:**
- Displays the `state.elements` tree as a collapsible sidebar
- Each row shows: expand arrow, tag icon (color-coded by semantic role), tag name, class preview, visibility/lock controls
- **Click** → selects element (`SELECT_ELEMENT` action, source: `"panel"`)
- **Hover** → highlights element in preview (`HOVER_ELEMENT` action)
- **Search** — filters tree by tag, text, class, or selector
- **Visibility toggle** — marks element as hidden (visual only, doesn't affect DOM)
- **Lock toggle** — prevents accidental editing
- Auto-expands first 2 levels; deeper levels collapsed by default
- Shows element count badge in header
- Empty states: "Loading page..." (with spinner) or "No page loaded"

**Tag icon colors:** `body/html/main` = blue, `nav/header/footer` = purple, `section/article` = green, `span/strong/em` = orange, headings = yellow, `a/button` = blue, inputs = cyan, `img/svg` = pink

---

### 2.4 Style Panel

**File:** `style-panel.tsx`  

**How it works:**
- Shows computed CSS properties for the selected element (`state.selectedElementId`)
- Organized into 5 collapsible categories:
  - **Layout** — display, position, flex, grid, overflow, zIndex
  - **Spacing** — padding (all sides), margin (all sides)
  - **Size** — width, height, min/max variants
  - **Typography** — fontSize, fontWeight, lineHeight, textAlign, color, fontFamily, textDecoration
  - **Fill & Border** — background, backgroundColor, border, borderRadius, opacity, boxShadow

**Three tabs:**
1. **Styles** — Category-grouped property editor. Click any value to edit inline. Changes dispatch `UPDATE_STYLE` which applies to DOM via `applyStyle()`.
2. **Computed** — Box model visualization (margin → padding → content), full alphabetical property list, CSS selector display.
3. **Code** — Syntax-highlighted CSS output (`selector { property: value; }`) with copy button.

**Features:**
- Color swatch preview for color properties
- Copy button copies full CSS rule to clipboard
- Class badges (up to 6 shown, overflow count)
- Empty states: "Connect a project" or "Select an element"

---

### 2.5 File Map Panel

**File:** `file-map-panel.tsx`  

**How it works:**
- Maps DOM elements to likely source files using **heuristic inference** (no build tool integration)
- 50+ component patterns (regex-based): Navbar, Header, Footer, Sidebar, Hero, Card, Button, Modal, Form, Input, Avatar, Badge, Dropdown, Table, Tabs, Accordion, Carousel, SearchBar, Pricing, Features, Testimonials, CTA, Banner, CodeBlock, Stats, Grid, Logo, Menu, Toast, Skeleton, Profile, Gallery, Timeline, Chat, Map, VideoPlayer, Social, etc.
- Also infers from: semantic HTML tags (`nav`→Navigation, `header`→Header, etc.), `data-component`/`data-testid` attributes, ARIA roles

**Inference sources (priority order):**
1. `data-component` / `data-testid` attributes → **high confidence**
2. Class name matching → **high confidence** (if class directly matches pattern)
3. CSS selector matching → **medium confidence**
4. Semantic HTML tag → **medium confidence**
5. ARIA role → **medium confidence**

**Framework-aware file extensions:**
- React/Next/Solid → `.tsx`
- Vue/Nuxt → `.vue`
- Svelte/SvelteKit → `.svelte`
- Angular → `.component.ts`
- Astro → `.astro`

**Two tabs:**
1. **File Tree** — Hierarchical folder/file view built from inferred paths. Each file expands to show its mapped elements. Clicking a mapping selects that element.
2. **Selected** — Shows the currently selected element's info card (tag, classes, selector, text), mapped file with confidence badge, "Open in VS Code" button (uses `vscode://file/` protocol), and child component list.

**Stats bar:** File count, component count, confidence breakdown (high/medium/low dot indicators)

---

### 2.6 Variant Canvas

**File:** `variant-canvas.tsx`  

**How it works:**
- Wraps `@xyflow/react` (`ReactFlow`) as an infinite canvas
- Contains one **Source Node** (always at position 0,0) and N **Variant Nodes** laid out in columns
- Canvas features: pan on scroll (free mode), zoom on scroll/pinch, node dragging (5px threshold), minimap, controls, dot background

**Node layout algorithm:**
- Source node at `(0, 0)` with size `1280 x 800`
- Root variants (no parent) start at x = `VARIANT_COL_OFFSET` (1400px from source)
- Child variants offset by `depth * (nodeWidth + 80px)` horizontally
- Vertical stacking with 60px gap between variants
- Variant dimensions default to `sourceViewportWidth` or 560px wide

**Iframe pointer guard:**
- During pan/zoom/drag, a global `<style>` is injected: `[data-0canvas] iframe { pointer-events: none !important; }`
- Removed when interaction ends
- Prevents iframes from stealing mouse events

**Fork flow:**
1. `handleForkPage(viewportWidth)` → calls `capturePageSnapshot()`, creates `VariantData`, dispatches `AOC_VARIANT`, saves to IndexedDB
2. `handleForkComponent(elementId, viewportWidth)` → calls `captureComponentSnapshot(elementId)`, same flow
3. `handleForkVariant(sourceVariantId)` → copies existing variant's HTML/CSS, sets `parentId`

**Variant actions:**
- **Fork** → creates a child variant
- **Delete** → removes variant and persists
- **Finalize** → marks status as `"finalized"`
- **Send to Agent** → copies markdown to clipboard, marks `"sent"`
- **Push to Main** → calls `pushVariantToMain()` to replace source element's DOM

**Click behavior:**
- Clicking a variant node: sets it as active, scans its iframe DOM into layers panel via `setInspectionTarget()` + `buildElementTree()`

---

### 2.7 Source Node

**File:** `source-node.tsx`  

**How it works:**
- Framer/Flow-style resizable viewport displaying the consumer's app in an iframe
- Chrome bar with: traffic light dots (red/yellow/green), URL pill (`localhost` + current route), breakpoint preset buttons, dimension badge

**Breakpoint presets:**
| Preset | Width | Icon |
|--------|-------|------|
| Desktop | 1440px | Monitor |
| Laptop | 1280px | Laptop |
| Tablet | 768px | Tablet |
| Mobile | 375px | Smartphone |

**NodeResizer:**
- Min: 320 x 300, Max: 2560 x 1600
- Blue handles (8px circles) visible when selected
- During resize: iframe gets `pointer-events: none`, dimension overlay shown in center
- Preset detection: if width is within 20px of a preset, that preset highlights

**Tool buttons (chrome bar right):**
- **Inspect** (crosshair) — toggles click-to-inspect mode
- **Rescan** (refresh) — rebuilds element tree
- **Copy for Agent** — generates markdown output for selected element
- **Fork Page** (git fork, blue accent) — creates full page variant
- **Fork Element** (maximize, blue accent) — creates component variant from selected element

**Iframe load behavior:**
1. On load: `setInspectionTarget()`, `buildElementTree()`, `rebuildElementMap()`, dispatch `SET_ELEMENTS`
2. After 800ms: re-scan to catch React hydration (components that mount after initial render)
3. If re-scan finds more elements, updates the tree

**Status bar (bottom):** Green dot + element count when loaded, active preset label

---

### 2.8 Variant Node

**File:** `variant-node.tsx`  

**How it works:**
- Resizable variant card with `<iframe srcDoc>` rendering the variant's HTML/CSS
- Chrome bar: name (double-click to rename), status badge, breakpoint presets, dimension label, action buttons

**Breakpoint presets:**
| Preset | Width | Icon |
|--------|-------|------|
| Wide | 768px | Laptop |
| Tablet | 560px | Tablet |
| Mobile | 375px | Smartphone |

**NodeResizer:** Min 280x240, Max 1440x1200

**srcdoc construction:**
- Viewport meta tag: `<meta name="viewport" content="width=device-width,initial-scale=1">`
- CSS split: `@import` rules go in first `<style>` block (must be first per CSS spec)
- ZeroCanvas/ReactFlow CSS filtered out (rules containing `[data-0canvas`, `.react-flow`, `--xy-`, `--oc-`)
- Reset: `*{box-sizing:border-box;}body{margin:0;overflow:auto;width:100%;min-height:100%;}`

**Status colors:** Draft=#444, Finalized=#50e3c2, Sent=#7928ca, Pushed=#0070f3

**Action buttons:**
- Inspect (crosshair) — enters inspect mode on the variant's iframe
- Fork (git fork) — creates a child variant
- Copy HTML — copies raw HTML to clipboard
- Finalize (check-circle, green accent) — marks as finalized (only shown for drafts)
- Send to Agent (send, green accent) — copies markdown + marks sent (only shown for finalized)
- Push to Main (arrow-up, blue) — replaces source element in main app (only for finalized component variants)
- Delete (trash, red)

**iframe pointer events:**
- Interactive when: inspecting or has active selection (and not resizing)
- Otherwise: `pointer-events: none` (allows canvas drag-through)

**Auto-scan on active:**
- When variant becomes `activeVariantId`, scans its iframe DOM → sets inspection target → builds element tree → dispatches to layers panel

---

### 2.9 Annotation Overlay

**File:** `annotation-overlay.tsx`  

**How it works:**
- Canvas-based drawing overlay that appears when annotation mode is toggled
- Tools: Select, Rectangle, Circle, Arrow, Text, Freehand
- 8 color options: red, orange, yellow, teal, blue, purple, pink, white
- Annotations stored in `state.annotations` with position, dimensions, color, tool type
- Select tool allows moving/resizing existing annotations
- Freehand tool captures mouse path as point arrays
- Text tool creates editable text labels
- Copy annotation summary to clipboard
- Delete individual annotations or clear all
- Undo last annotation

---

### 2.10 Element Chat (Feedback Panel)

**File:** `element-chat.tsx`  

**How it works:**
- Floating panel (bottom-right, 340px wide) that appears when "+ Feedback" is clicked on the selection overlay
- Only shows when: `feedbackPanelOpen` is true AND an element is selected via inspect (not panel)

**Input form:**
1. **Element context badge** — shows `<tag>.class` and "variant" label if on a variant
2. **Intent picker** — Fix (bug icon, red), Change (pencil, orange), Question (help-circle, blue), Approve (thumbs-up, green)
3. **Severity picker** — Blocking (red), Important (orange), Suggestion (blue)
4. **Comment textarea** — free-form text
5. **Submit** — Cmd+Enter or click "Add to Waitlist"

**On submit:**
- Creates a `FeedbackItem` with: id, variantId, elementId, selector, tag, classes, comment, intent, severity, status="pending", timestamp, boundingBox
- Dispatches `AOC_FEEDBACK` to store
- Saves to IndexedDB via `saveFeedbackItem()`
- Shows existing feedback count badge for the selected element

---

### 2.11 Agent Waitlist

**File:** `agent-waitlist.tsx`  

**How it works:**
- Bottom drawer (collapsible, max 340px) showing all pending feedback items
- Scoped to active variant (or "main" if no variant active)
- Items grouped by element selector

**Features:**
- Select/deselect individual items or select all
- Copy selected items as structured markdown (for pasting into AI chat)
- **Send** button: pushes to MCP bridge AND copies to clipboard simultaneously

**Markdown output format:**
- Variant context: includes variant name, ID, source type, full HTML + CSS
- Critical instruction: "Do NOT modify the main app source code"
- Per-item: selector, tag, classes, computed styles (up to 8), feedback comment
- MCP flow instruction: "Call `0canvas_push_changes` with exact variantId"

**Send status toasts:**
- "Sent to MCP bridge & copied to clipboard" (green, if bridge online)
- "Copied to clipboard! Paste in Cursor chat" (orange, if bridge offline)

---

### 2.12 Agent/IDE Panel

**File:** `agent-panel.tsx`  

**How it works:**
- Right panel for managing IDE connections and MCP server

**Three tabs:**

1. **IDE** — Cards for each supported IDE:
   - Claude Code (MCP setup: `claude mcp add 0canvas -- npx @zerosdesign/0canvas mcp`)
   - Cursor (extension-based)
   - Windsurf (extension-based)
   - VS Code (extension-based)
   - Antigravity (CLI-based)
   - Each card shows: icon, name, description, status (connected/disconnected), last sync time, setup command (copy-able), connect/disconnect button

2. **MCP Server** — Shows bridge status (online/offline/checking), URL (`http://127.0.0.1:24192`), refresh button, sync now button, quick setup command, JSON config snippet

3. **Activity** — Chronological log of sync events (feedback sent, variants synced, etc.)

**Health check:** Polls `http://127.0.0.1:{port}/api/health` every 15 seconds

---

### 2.13 Version Manager

**File:** `version-manager.tsx`  

**How it works:**
- Right panel showing design version cards (when no other right panel is open)
- Each version has: name, status (Draft/Active/Sent/Applied), timestamp, change count, description
- Status colors: Draft=#888, Active=#0070f3, Sent=#7928ca, Applied=#50e3c2
- Actions: set active, delete, duplicate, send to IDE

**Note:** This is a legacy feature from before the variant system. Variants have largely replaced versions for managing design iterations.

---

### 2.14 Command Palette

**File:** `command-palette.tsx`  

**How it works:**
- Opens with `Cmd+K` (or `Ctrl+K`)
- Search-based command launcher
- Available commands: Toggle Layers, Toggle Styles, Toggle IDE, Toggle Inspector, Toggle Files, Toggle Annotations, plus more
- Each command has: icon, label, description, keyboard shortcut, action
- Fuzzy search on label and description
- Escape to close

---

### 2.15 Workspace Toolbar

**File:** `workspace-toolbar.tsx`  

**How it works:**
- Fixed 48px height bar at the top of the workspace

**Left section:**
- ZeroCanvas logo + "0canvas" label
- Project switcher (dropdown): rename (double-click), save, load from saved projects, delete
- MCP status badge (green "MCP" pill when connected)
- Route switcher (dropdown): shows current route, route history, custom route input

**Center section (panel toggles):**
- Layers, Inspect, Style, Files, Annotate (with annotation count badge), IDE (with connected dot), Waitlist (with pending count badge)

**Right section:**
- **.0c file actions:** Download .0c (export), Import (upload), Sync to IDE (refresh)
- Viewport presets: Desktop, Tablet, Mobile
- Cmd+K button

---

## 3. State Management

**File:** `store.tsx`  

Uses React Context + `useReducer`. Single `WorkspaceState` object with ~30 fields.

### Key state fields:

| Field | Type | Description |
|-------|------|-------------|
| `currentView` | `"onboarding" \| "workspace"` | App view |
| `project` | `ProjectConnection \| null` | Connected project info |
| `elements` | `ElementNode[]` | DOM tree from inspected page |
| `selectedElementId` | `string \| null` | Currently selected element |
| `hoveredElementId` | `string \| null` | Currently hovered element |
| `selectionSource` | `"inspect" \| "panel" \| null` | How element was selected |
| `variants` | `VariantData[]` | All forked variants |
| `activeVariantId` | `string \| null` | Currently active variant |
| `feedbackItems` | `FeedbackItem[]` | All feedback items |
| `fileMappings` | `FileMapping[]` | Element-to-file mappings |
| `annotations` | `Annotation[]` | Drawing annotations |
| `ocProject` | `OCProject` | Project metadata |
| `ocProjectFile` | `OCProjectFile \| null` | Full .0c project file |
| `versions` | `DesignVersion[]` | Legacy design versions |
| `ides` | `IDEConnection[]` | IDE connections |
| `wsStatus` | `WSStatus` | MCP bridge connection status |
| `wsPort` | `number` | MCP bridge port |
| `currentRoute` | `string` | Current page route |
| `routeHistory` | `string[]` | Visited routes |
| `inspectorMode` | `boolean` | Inspector active |
| `layersPanelOpen` | `boolean` | Layers panel visible |
| `stylePanelOpen` | `boolean` | Style panel visible |
| `fileMapPanelOpen` | `boolean` | File map panel visible |
| `idePanelOpen` | `boolean` | IDE panel visible |
| `feedbackPanelOpen` | `boolean` | Feedback chat visible |
| `waitlistOpen` | `boolean` | Waitlist drawer visible |
| `annotationMode` | `boolean` | Annotation tools active |
| `commandPaletteOpen` | `boolean` | Command palette visible |

### Panel mutual exclusion:
- `TOGGLE_STYLE_PANEL`: if opening, closes `fileMapPanelOpen`
- `TOGGLE_FILE_MAP_PANEL`: if opening, closes `stylePanelOpen`

### VariantData type:
```typescript
{
  id: string;
  name: string;
  html: string;              // Original captured HTML
  css: string;               // Original captured CSS
  modifiedHtml?: string;     // AI-modified HTML
  modifiedCss?: string;      // AI-modified CSS
  mockData: { images: string[]; texts: string[] };
  sourceType: "page" | "component";
  sourceSelector?: string;
  sourceElementId?: string | null;
  sourcePageRoute?: string;
  sourceOuterHTML?: string;
  sourceViewportWidth?: number;  // Width at time of fork
  parentId: string | null;       // For variant chains
  status: "draft" | "finalized" | "sent" | "pushed";
  createdAt: number;
}
```

---

## 4. .0c Format System

### 4.1 Variant .0c Format

**Files:** `oc-format.ts`, `oc-parser.ts`

A structured JSON representation of individual UI variants, inspired by Pencil.dev's `.pen` format.

**OCDocument structure:**
```typescript
{
  version: "0.1.0",
  name: string,
  source: { type: "page" | "component", selector?, route?, elementId? },
  variables?: Record<string, OCVariable>,    // Design tokens
  breakpoints?: OCBreakpoints,               // desktop/tablet/mobile
  tree: OCNode[]                             // Node tree
}
```

**OCNode structure:**
```typescript
{
  id: string,
  tag: string,
  name?: string,
  class?: string,
  href?: string, src?: string, alt?: string,
  text?: string,                             // Leaf text content
  styles?: OCStyles,                         // Base CSS properties
  responsive?: { [breakpoint]: Partial<OCStyles> },  // Responsive overrides
  children?: OCNode[]
}
```

**Bidirectional parsers:**
- `htmlToOCDocument(html, css, name, source)` → parses HTML/CSS into OCDocument (uses temporary iframe for computed styles)
- `ocDocumentToHtml(doc)` → renders OCDocument to `{ html, css }` strings (generates `@media` queries from responsive overrides)

**Helper functions:** `findNodeById`, `updateNodeById`, `deleteNodeById`, `insertNode`, `countOCNodes`, `createOCDocument`

### 4.2 Project .0c File

**Files:** `oc-project.ts`, `oc-project-store.ts`

A single JSON file representing the **entire ZeroCanvas project** — all variants, feedback, annotations, breakpoints, variables, pages, and history.

**Schema version:** 1  
**File extension:** `.0c`  
**Validation:** Zod schema with strict types  
**Integrity:** SHA-256 hash of content (excluding integrity field itself)

**OCProjectFile structure:**
```json
{
  "$schema": "https://zeros.design/schemas/oc-project-v1.json",
  "schemaVersion": 1,
  "project": { "id", "name", "createdAt", "updatedAt", "revision" },
  "workspace": { "root", "entryFiles", "framework", "pathAliases" },
  "breakpoints": { "desktop": 1280, "laptop": 1024, "tablet": 768, "mobile": 390 },
  "variables": { "token.name": "value" },
  "pages": [{ "id", "name", "route", "source", "layers", "fileMap" }],
  "variants": [{ "id", "pageId", "name", "sourceElementId", "viewport", "content", "annotations", "feedback", ... }],
  "history": { "checkpoints": [], "lastCheckpointAt": null },
  "integrity": { "hash": "sha256-...", "generator": "0canvas@0.0.5" }
}
```

**Key functions:**
| Function | Description |
|----------|-------------|
| `validateOCProjectFile(input)` | Zod validation, returns `{valid, data}` or `{valid, errors}` |
| `migrateProjectFile(raw)` | Sequential migration pipeline (v1→v2→...) |
| `computeProjectHash(doc)` | SHA-256 integrity hash |
| `createEmptyProjectFile(project, framework)` | Creates blank project file |
| `stateToProjectFile(project, variants, feedback, fileMappings, route, existing?)` | Converts runtime state → .0c |
| `projectFileToState(file)` | Converts .0c → runtime state |
| `serializeProjectFile(file)` | JSON.stringify with 2-space indent |
| `parseProjectFile(json)` | Parse + validate + migrate |

**IndexedDB persistence:**
- Database: `0canvas-projects` (separate from variant DB)
- Stores: `oc-projects` (keyed by `project.id`), `oc-sync-meta` (sync tracking)
- Sync metadata: `lastSyncedRevision`, `lastSyncedAt`, `dirty` flag, `filePath`

**Import/Export:**
- `downloadProjectFile(file)` — triggers browser download as `{name}.0c`
- `importProjectFile()` — opens file picker, validates, saves to IndexedDB
- `scheduleAutoSave(...)` — debounced 500ms auto-save on state changes
- `pushProjectToIDE(file, port)` — POST to `http://127.0.0.1:{port}/api/oc-project`
- `pullProjectFromIDE(projectId, port)` — GET from bridge

---

## 5. MCP Server & Bridge

### Bridge (HTTP Server)

**File:** `bridge.ts`  
**Default port:** 24192  
**Transport:** HTTP REST with CORS

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health check |
| POST | `/api/feedback` | Push feedback items |
| GET | `/api/feedback` | Get feedback (filter by variant/status) |
| POST | `/api/variants` | Sync all variants |
| GET | `/api/variants` | Get variants (filter by id) |
| POST | `/api/resolve` | Mark feedback as resolved |
| POST | `/api/push-changes` | Push modified HTML/CSS to variant |
| POST | `/api/project` | Sync project metadata |
| GET | `/api/poll` | Long-poll for changes since timestamp |
| POST | `/api/oc-project` | Save .0c project file |
| GET | `/api/oc-project` | Get .0c project file |
| POST | `/api/oc-project/write` | Write .0c file to workspace filesystem |
| GET | `/api/oc-project/read` | Read .0c file from workspace filesystem |

### MCP Tools

**File:** `tools.ts`  
**13 registered tools:**

| Tool | Description |
|------|-------------|
| `0canvas_get_pending` | List pending feedback items |
| `0canvas_get_variant` | Get variant HTML/CSS/metadata |
| `0canvas_resolve_feedback` | Mark feedback as resolved |
| `0canvas_push_changes` | Push modified HTML/CSS to variant preview |
| `0canvas_list_variants` | List all variants |
| `0canvas_get_project` | Get project info |
| `0canvas_watch` | Long-poll for new feedback |
| `0canvas_get_variant_tree` | Get .0c JSON tree for variant |
| `0canvas_update_node` | Update node in variant's .0c tree |
| `0canvas_add_node` | Insert node into variant's .0c tree |
| `0canvas_delete_node` | Remove node from variant's .0c tree |
| `0canvas_set_variable` | Set design variable/token |
| `0canvas_get_variables` | List design variables |
| `0canvas_get_project_file` | Get full .0c project file as JSON |
| `0canvas_save_project_file` | Save .0c project file (with revision conflict detection) |
| `0canvas_get_project_meta` | Get project summary metadata |
| `0canvas_write_project_to_workspace` | Write .0c file to workspace path |

---

## 6. IndexedDB Persistence

### Database 1: `0canvas-db` (variant-db.ts)
| Store | Key | Contents |
|-------|-----|----------|
| `variants` | `id` | Individual `VariantData` objects |
| `waitlist` | `id` | Individual `FeedbackItem` objects |
| `projects` | `id` | `StoredProject` (project + variants + feedback) |

### Database 2: `0canvas-projects` (oc-project-store.ts)
| Store | Key | Contents |
|-------|-----|----------|
| `oc-projects` | `project.id` | Full `OCProjectFile` objects |
| `oc-sync-meta` | `projectId` | Sync tracking metadata |

**Auto-cleanup:** Variants older than 7 days removed via `cleanupOldVariants()`

---

## 7. Testing Setup

**Directory:** `testing/` (gitignored)  
**Command:** `pnpm test:ui`  

- `testing/vite.config.ts` — Vite config that aliases `@zerosdesign/0canvas` → `../src/index.ts`
- `testing/index.html` — HTML entry point
- `testing/main.tsx` — Renders `HomePage` + `<ZeroCanvas defaultOpen />`
- `testing/HomePage.tsx` — Full SaaS landing page (hero, features, pricing, testimonials, footer) for testing all inspection scenarios
- `testing/styles.css` — Responsive CSS with media queries for testing breakpoints

---

## 8. What Has Been Implemented

### Core Infrastructure
- [x] `<ZeroCanvas />` component with portal, keyboard shortcut, FAB toggle
- [x] DOM inspector (target document, element map, overlays, inspect mode)
- [x] React Context state management with 60+ action types
- [x] Runtime CSS injection/removal
- [x] Clipboard utility

### Canvas & Viewport
- [x] ReactFlow infinite canvas with pan/zoom/drag
- [x] Framer-style resizable Source Node (1440/1280/768/375 presets)
- [x] Resizable Variant Nodes (768/560/375 presets)
- [x] NodeResizer with dimension badges and resize overlays
- [x] Iframe pointer guard during canvas interactions
- [x] Auto-layout variants in columns by depth
- [x] MiniMap + Controls

### Variant System
- [x] Fork page (full page snapshot)
- [x] Fork component (single element snapshot)
- [x] Fork variant (variant-to-variant chains)
- [x] Fork button on element selection overlay
- [x] Responsive variants (CSS preserved, no inline computed styles baked)
- [x] `sourceViewportWidth` inheritance on fork
- [x] Variant rename (double-click)
- [x] Variant delete
- [x] Variant finalize → send to agent → push to main
- [x] Click variant → auto-scan DOM into layers/styles
- [x] srcdoc with viewport meta, import rule separation, ZeroCanvas CSS filtering

### Panels
- [x] Layers panel (tree view, search, visibility/lock, tag icons)
- [x] Style panel (category groups, inline edit, box model, code tab, copy)
- [x] File map panel (50+ patterns, framework-aware, stats bar, file tree, selected tab, Open in VS Code)
- [x] Panel mutual exclusion (Style ↔ Files)
- [x] Agent/IDE panel (5 IDEs, MCP server status, activity log)
- [x] Annotation overlay (rect, circle, arrow, text, freehand, 8 colors)
- [x] Version manager
- [x] Command palette (Cmd+K)

### Feedback System
- [x] Element Chat (floating panel, intent/severity pickers, comment input)
- [x] Agent Waitlist (bottom drawer, grouped by selector, select/copy/send)
- [x] Variant-scoped feedback (main app vs variant context)
- [x] Structured markdown output with variant HTML/CSS and MCP instructions
- [x] Dual send: MCP bridge + clipboard fallback

### .0c Format
- [x] OCDocument/OCNode/OCStyles types with responsive breakpoints
- [x] Variables (design tokens) support
- [x] Bidirectional HTML/CSS ↔ .0c parser
- [x] .0c project file schema (Zod validated, SHA-256 integrity)
- [x] Revision-based conflict detection
- [x] Migration pipeline (v1 → v2 → ...)
- [x] State ↔ .0c project file bidirectional converter
- [x] IndexedDB persistence for project files
- [x] Export (download .0c) / Import (file picker)
- [x] Auto-save (500ms debounce)
- [x] Push/pull to IDE via bridge

### MCP Integration
- [x] 17 MCP tools registered
- [x] HTTP bridge with 12+ endpoints
- [x] Browser ↔ Bridge polling (2-second interval)
- [x] Feedback sync, variant sync, project sync
- [x] Push changes from agent → variant preview
- [x] .0c project file endpoints (read/write/save)
- [x] Workspace file write capability

### Testing
- [x] Gitignored `testing/` folder with Vite dev server
- [x] Full SaaS landing page for testing
- [x] `pnpm test:ui` script

---

## 9. Known Limitations

1. **File mapping is heuristic-only** — No build tool integration. Patterns match class names and semantic tags but can produce false positives. No source maps or compiler metadata used.

2. **No undo/redo for style edits** — `applyStyle()` returns old value but there's no undo stack implementation.

3. **Variant preview is static** — Forked variants capture a snapshot of HTML/CSS. JavaScript behavior, event handlers, and dynamic content are not preserved in variants.

4. **Single-page scope** — The inspector only sees the current page's DOM. Route changes within SPAs are tracked but don't trigger full re-inspection.

5. **No real-time collaboration** — The sync model is poll-based (2-second interval). Multiple users editing the same project simultaneously may cause conflicts.

6. **Large variant HTML** — Variants with very large HTML (>50KB) may cause performance issues in the srcdoc iframe and in the markdown output.

7. **.0c file is raw JSON in IDE** — Without a VS Code extension, opening `.0c` files shows raw JSON instead of a visual canvas.

8. **No image/asset handling** — Variants don't capture or store referenced images/assets. External URLs may break if the original server is unavailable.

---

## 10. Future Phases & Roadmap

### Phase A: VS Code Extension (HIGH PRIORITY)
- Custom `TextEditorProvider` for `*.0c` files
- Webview canvas renderer (reuse ZeroCanvas React components)
- File-based sync: extension watches `.0c` file changes → webview updates
- Bidirectional: webview edits write back to `.0c` file
- "Open as Text" fallback
- Extension marketplace publishing
- Cursor/Windsurf compatibility (VS Code extension model)

### Phase B: File Watcher Sync
- IDE extension watches workspace `.0c` file for external changes
- Browser detects when IDE updates the `.0c` file (via bridge polling)
- Revision-based reconciliation on reconnect
- Conflict resolution UI (keep local / keep incoming / merge)

### Phase C: Real-time MCP Sync
- `dd.subscribeProject` → event stream for live updates
- `dd.patchProject(ops, expectedRevision)` → granular patches instead of full file
- Optimistic locking with revision numbers
- Structured merge for variants (by ID), annotations (append), feedback (append)

### Phase D: Enhanced Variant System
- **AI-generated variants** — Agent creates design alternatives autonomously
- **Variant diff viewer** — Side-by-side comparison with highlighted changes
- **Variant merging** — Merge multiple variants into one
- **Variant branching history** — Visual lineage tree with timestamps
- **Variant comments/threads** — Per-variant discussion threads
- **Snapshot versioning** — Save/restore variant checkpoints

### Phase E: Source Map Integration
- Parse source maps to resolve exact file:line for elements
- Webpack/Vite plugin to inject `data-component` attributes at build time
- Replace heuristic file mapping with precise resolution
- Deep link to specific line in IDE

### Phase F: Design Token System
- Extract CSS custom properties as design tokens
- Token editor in the Style panel
- Token propagation across variants
- Export as CSS variables, Tailwind config, or design system JSON
- Variable reference resolution (`$token.name` → value)

### Phase G: Multi-page Support
- Track multiple pages/routes in a single project
- Per-page element trees, file maps, and variants
- Page-level navigation in the canvas
- Route-based variant organization

### Phase H: Collaboration Features
- WebSocket-based real-time sync (replace polling)
- Multi-cursor presence indicators
- Conflict-free replicated data types (CRDTs) for concurrent edits
- User identity + permissions

### Phase I: Export & Code Generation
- Export variants as React/Vue/Svelte component code
- Export CSS changes as Tailwind classes
- Generate PR descriptions from variant diffs
- Export to Figma/Sketch format

### Phase J: Testing & QA
- Unit tests for store reducers
- Unit tests for DOM inspector functions
- Unit tests for .0c parser roundtrip
- Unit tests for Zod schema validation
- Integration tests for MCP tools
- E2E tests with Playwright/Cypress
- CI/CD pipeline

---

*Last updated: 2026-03-09*  
*Generator: 0canvas documentation*
