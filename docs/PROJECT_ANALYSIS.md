# Zeros — Complete Project Analysis & Documentation

> **⚠️ PARTIAL STATUS (2026-04-20):** This document was written for the
> V1/V2 browser-overlay era. Sections 1-10 (module breakdown, engine
> architecture, state management, MCP integration, tech stack) **still
> accurately describe the engine code that now lives inside Column 3**
> of the Tauri Mac app (`src/zeros/**` + `src/engine/**`). Sections
> 11-13 (status / limitations / roadmap) are SUPERSEDED by V3.
> For the current product truth read:
> - [PRODUCT_VISION_V3.md](PRODUCT_VISION_V3.md) — the vision
> - [TAURI_MAC_APP_PLAN.md](TAURI_MAC_APP_PLAN.md) — the execution plan
> A rewrite that covers the full Mac-app surface (Col 1 + Col 2 +
> Rust backend + 3-column shell) is in the §TODO at the bottom.

---

> **Package:** `@Withso/zeros`
> **Version:** 0.0.5 (npm — legacy channel; see V3)
> **License:** MIT
> **Repository:** `Withso/Zeros`
> **Original Design:** [Figma Design File](https://www.figma.com/design/pHn0A8C25STCmSniuSFuQp/Design-Collaboration-Tool)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What This Project Does](#2-what-this-project-does)
3. [How It Works](#3-how-it-works)
4. [Project Architecture](#4-project-architecture)
5. [Module Breakdown](#5-module-breakdown)
6. [Feature Inventory](#6-feature-inventory)
7. [State Management](#7-state-management)
8. [Data Formats & Persistence](#8-data-formats--persistence)
9. [MCP Integration (AI Agent Bridge)](#9-mcp-integration-ai-agent-bridge)
10. [Technology Stack](#10-technology-stack)
11. [Project Status](#11-project-status)
12. [Known Limitations](#12-known-limitations)
13. [Future Roadmap](#13-future-roadmap)

---

## 1. Executive Summary

**Zeros** is a **visual feedback engine for AI-powered development**. It is a browser overlay tool that allows designers and developers to inspect live DOM elements, edit CSS styles in real-time, create design variants by "forking" pages or components, annotate designs, and send structured feedback/instructions to AI coding agents (like Claude Code, Cursor, Windsurf, VS Code Copilot, etc.) — all without leaving the browser.

**The goal:** Bridge the gap between visual design intent and AI-powered code generation. Instead of describing what you want in text, you visually inspect, edit, annotate, and fork your live UI, then send structured instructions directly to an AI agent via the Model Context Protocol (MCP).

---

## 2. What This Project Does

### Core Value Proposition
Zeros enables a workflow where:

1. **A developer runs their web app** (any framework: React, Vue, Svelte, Angular, etc.)
2. **They add `<Zeros />` to their app** — a single React component
3. **A floating overlay appears** with a full design workspace (toggle via `Ctrl+Shift+D`)
4. **They inspect elements** by clicking on them in the live page
5. **They edit CSS properties** live in a style panel
6. **They fork pages/components** into "variants" — snapshot copies on an infinite canvas
7. **They annotate designs** with rectangles, arrows, text, and freehand drawing
8. **They leave structured feedback** (fix/change/question/approve) on specific elements
9. **An AI coding agent receives this feedback** via MCP protocol and implements the changes
10. **The AI pushes changes back** to the variant preview for visual verification

### In Simple Terms
Think of it as **browser DevTools + Figma + AI agent communication** combined into one overlay. You see your live app, inspect it like DevTools, fork it into design variants like Figma, and communicate changes to AI like a structured prompt — but with full visual context, HTML/CSS snippets, and element selectors attached.

---

## 3. How It Works

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Consumer's Web App                        │   │
│  │         (loaded in iframe or directly)                │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ▲                                  │
│                          │ DOM Inspection                   │
│                          │                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Zeros Overlay (Portal)                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │   │
│  │  │  Toolbar  │ │  Layers  │ │  ReactFlow Canvas │    │   │
│  │  │  Panel    │ │  Panel   │ │  (Source+Variants) │    │   │
│  │  └──────────┘ └──────────┘ └──────────────────┘    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │   │
│  │  │  Style   │ │  Files   │ │  Annotations      │    │   │
│  │  │  Panel   │ │  Panel   │ │  Overlay           │    │   │
│  │  └──────────┘ └──────────┘ └──────────────────┘    │   │
│  │  ┌──────────┐ ┌──────────┐                          │   │
│  │  │ Feedback │ │ Waitlist │                          │   │
│  │  │ Chat     │ │ Drawer   │──── polls ───────────┐   │   │
│  │  └──────────┘ └──────────┘                      │   │   │
│  └─────────────────────────────────────────────────│───┘   │
│                                                    │        │
└────────────────────────────────────────────────────│────────┘
                                                     │
                                            HTTP (port 24192)
                                                     │
┌────────────────────────────────────────────────────│────────┐
│                     Node.js (Server)               │        │
│                                                    ▼        │
│  ┌──────────────────────┐    ┌──────────────────────┐      │
│  │   MCP Server          │    │   HTTP Bridge         │      │
│  │   (stdio transport)   │◄──►│   (REST API)          │      │
│  │                       │    │   port 24192          │      │
│  └──────────────────────┘    └──────────────────────┘      │
│           ▲                                                 │
│           │ MCP Protocol (stdio)                            │
│           ▼                                                 │
│  ┌──────────────────────────────────────────────────┐      │
│  │   AI Coding Agent                                 │      │
│  │   (Claude Code, Cursor, Windsurf, VS Code, etc.)  │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Step-by-Step Flow

1. **Portal Rendering:** The `<Zeros />` component creates a portal on `document.body` with an extremely high z-index (`2147483640`), ensuring it floats above everything in the consumer's app.

2. **Iframe Isolation:** The consumer's app is loaded inside an `<iframe name="Zeros-preview">`. The Zeros component detects when running inside this iframe and returns `null` (iframe guard), preventing recursive rendering.

3. **DOM Inspection:** The `dom-inspector.ts` module inspects the iframe's `contentDocument`. It walks the DOM tree, builds an element map, generates selectors, extracts computed styles, and provides hover/select overlays.

4. **ReactFlow Canvas:** All preview nodes (source page + forked variants) live on an infinite `@xyflow/react` canvas. Users can pan, zoom, drag, and resize nodes.

5. **Variant System:** Users can "fork" the entire page or individual components. Forks capture a snapshot of the HTML/CSS at that moment, rendered in isolated `srcdoc` iframes. Variants can be chained (fork of a fork).

6. **Feedback Loop:** Users leave structured feedback (intent: fix/change/question/approve + severity: blocking/important/suggestion) on specific elements. This goes into a "waitlist" queue.

7. **MCP Bridge:** A Node.js HTTP server (`bridge.ts`) + MCP server (`server.ts`) run as a CLI binary. The browser polls `http://127.0.0.1:24192/api/poll` every 2 seconds for sync. AI agents connect via MCP protocol (stdio) and can read feedback, push HTML/CSS changes back, and manage variants.

---

## 4. Project Architecture

### File Structure

```
Zeros/
├── index.html                    # Dev app HTML entry point
├── package.json                  # npm package config (@Withso/zeros)
├── package.publish.json          # Publish-specific package.json
├── tsup.config.ts                # Build config (dual CJS/ESM + MCP CLI binary)
├── vite.config.ts                # Vite dev server config (React + Tailwind)
├── tsconfig.build.json           # TypeScript build config
├── postcss.config.mjs            # PostCSS config
├── setup.mjs                     # Setup script
├── Zeros.deps.json          # Dependency metadata
├── DOCUMENTATION.md              # Existing detailed docs
├── ATTRIBUTIONS.md               # Third-party attributions
├── guidelines/
│   └── Guidelines.md             # AI design system guidelines template
│
├── src/
│   ├── index.ts                  # Public API — all exports
│   ├── main.tsx                  # Dev app entry point
│   ├── styles/
│   │   ├── index.css             # Main stylesheet
│   │   ├── tailwind.css          # Tailwind imports
│   │   ├── theme.css             # CSS theme variables
│   │   └── fonts.css             # Font imports
│   │
│   ├── app/
│   │   ├── App.tsx               # Dev app shell (RouterProvider)
│   │   ├── routes.ts             # Dev routes (/ = docs, /workspace = testing)
│   │   ├── store.tsx             # Global state (React Context + useReducer)
│   │   │
│   │   ├── pages/
│   │   │   ├── docs.tsx          # Documentation/landing page (678 lines)
│   │   │   └── workspace.tsx     # Dev testing workspace
│   │   │
│   │   └── components/
│   │       ├── zeros-engine.tsx      # Main <Zeros /> component
│   │       ├── dom-inspector.ts           # DOM tree walking, highlighting, snapshots
│   │       ├── source-node.tsx            # Main preview node (resizable iframe)
│   │       ├── variant-node.tsx           # Variant card node (srcdoc iframe)
│   │       ├── variant-canvas.tsx         # ReactFlow infinite canvas
│   │       ├── layers-panel.tsx           # Element tree sidebar
│   │       ├── style-panel.tsx            # CSS property editor
│   │       ├── file-map-panel.tsx         # Heuristic file mapper
│   │       ├── annotation-overlay.tsx     # Drawing tools overlay
│   │       ├── element-chat.tsx           # Per-element feedback form
│   │       ├── agent-waitlist.tsx          # Feedback queue drawer
│   │       ├── agent-panel.tsx            # IDE connections + MCP status
│   │       ├── version-manager.tsx        # Design version cards (legacy)
│   │       ├── command-palette.tsx         # Cmd+K command launcher
│   │       ├── workspace-toolbar.tsx      # Top toolbar
│   │       ├── brainstorm-panel.tsx        # Brainstorm/notes panel
│   │       ├── live-canvas.tsx            # Legacy canvas (pre-ReactFlow)
│   │       ├── oc-format.ts              # .0c variant format types + helpers
│   │       ├── oc-parser.ts              # HTML/CSS ↔ .0c bidirectional parser
│   │       ├── oc-project.ts             # .0c project file schema (Zod)
│   │       ├── oc-project-store.ts       # IndexedDB persistence + import/export
│   │       ├── variant-db.ts             # IndexedDB for variants + waitlist
│   │       ├── clipboard.ts              # Copy-to-clipboard utility
│   │       ├── zeros-styles.ts      # Runtime CSS injection
│   │       └── ui/                       # Radix-based UI primitives
│   │
│   └── mcp/
│       ├── server.ts                     # MCP server entry (Node.js CLI binary)
│       ├── bridge.ts                     # HTTP bridge + state holder
│       └── tools.ts                      # 17 MCP tool definitions
```

### Build System

The project uses **two build pipelines**:

1. **`tsup`** (for npm package + MCP CLI):
   - `src/index.ts` → `dist/index.js` (CJS) + `dist/index.mjs` (ESM) + `dist/index.d.ts` (types)
   - `src/mcp/server.ts` → `dist/mcp/server.mjs` (Node.js CLI with `#!/usr/bin/env node`)
   - External: `react`, `react-dom` (peer deps)
   - Bundles `@modelcontextprotocol/sdk` and `zod` into the MCP binary

2. **`vite`** (for dev server):
   - React plugin + Tailwind CSS
   - Path alias `@` → `src/`
   - Dev server for the documentation site + testing workspace

---

## 5. Module Breakdown

### 5.1 Zeros Engine (`zeros-engine.tsx`)
- **Role:** Main entry component that consumers import
- **What it does:** Creates a portal overlay, handles keyboard shortcut (`Ctrl+Shift+D`), manages open/close state, renders the full workspace, polls MCP bridge every 2 seconds, auto-saves `.0c` project file to IndexedDB (500ms debounce), loads existing project on mount
- **Key props:** `position`, `defaultOpen`, `theme`, `shortcut`, `devOnly`, `zIndex`, `onToggle`

### 5.2 DOM Inspector (`dom-inspector.ts`)
- **Role:** Core engine for reading and interacting with the consumer's DOM
- **What it does:** Walks the DOM tree, builds element maps (bidirectional WeakMap/Map), generates CSS selectors, extracts computed styles (35+ properties), creates hover/select overlays with tag labels and size badges, provides click-to-inspect mode, captures page/component snapshots (HTML + CSS without baking inline styles), generates markdown output for AI agents
- **Size:** 990 lines — the largest and most complex module

### 5.3 Layers Panel (`layers-panel.tsx`)
- **Role:** Element tree sidebar
- **What it does:** Displays the DOM tree as a collapsible tree view, color-coded tag icons by semantic role, search/filter, visibility/lock toggles, click to select, hover to highlight

### 5.4 Style Panel (`style-panel.tsx`)
- **Role:** CSS property inspector and editor
- **What it does:** Shows computed CSS organized into 5 categories (Layout, Spacing, Size, Typography, Fill & Border), inline editing, box model visualization, syntax-highlighted CSS code output, copy button

### 5.5 File Map Panel (`file-map-panel.tsx`)
- **Role:** Heuristic source file mapper
- **What it does:** Uses 50+ regex patterns to infer which source file an element comes from, framework-aware extensions (.tsx, .vue, .svelte, etc.), confidence scoring, "Open in VS Code" button, file tree view

### 5.6 Variant Canvas (`variant-canvas.tsx`)
- **Role:** ReactFlow infinite canvas controller
- **What it does:** Manages one Source Node + N Variant Nodes, auto-layout by depth, iframe pointer guard during interactions, fork page/component/variant, delete/finalize/send/push operations, auto-scan variant DOM into layers panel on click

### 5.7 Source Node (`source-node.tsx`)
- **Role:** Main preview viewport
- **What it does:** Framer-style resizable iframe showing the consumer's app, browser chrome bar with traffic lights/URL/breakpoints, breakpoint presets (1440/1280/768/375px), inspect/rescan/fork buttons

### 5.8 Variant Node (`variant-node.tsx`)
- **Role:** Individual variant card
- **What it does:** Resizable card with `srcdoc` iframe, status badges (Draft/Finalized/Sent/Pushed), breakpoint presets, rename on double-click, action buttons (inspect, fork, copy HTML, finalize, send to agent, push to main, delete)

### 5.9 Annotation Overlay (`annotation-overlay.tsx`)
- **Role:** Drawing tools
- **What it does:** Canvas-based overlay with tools (Select, Rectangle, Circle, Arrow, Text, Freehand), 8 color options, move/resize annotations, undo, copy summary, clear all

### 5.10 Element Chat (`element-chat.tsx`)
- **Role:** Per-element feedback form
- **What it does:** Floating panel for leaving structured feedback — intent picker (Fix/Change/Question/Approve), severity picker (Blocking/Important/Suggestion), comment textarea, submits to waitlist and IndexedDB

### 5.11 Agent Waitlist (`agent-waitlist.tsx`)
- **Role:** Feedback queue
- **What it does:** Bottom drawer showing all pending feedback grouped by element, select/copy/send operations, generates structured markdown with variant context (full HTML/CSS + MCP instructions), dual send (MCP bridge + clipboard fallback)

### 5.12 Agent/IDE Panel (`agent-panel.tsx`)
- **Role:** IDE connection manager
- **What it does:** Three tabs — IDE (cards for Claude Code, Cursor, Windsurf, VS Code, Antigravity with setup commands), MCP Server (bridge status, health check every 15s), Activity (sync event log)

### 5.13 Version Manager (`version-manager.tsx`)
- **Role:** Design version tracking (legacy)
- **What it does:** Version cards with name/status/timestamp/change count, set active, delete, duplicate, send to IDE. Note: largely replaced by the variant system.

### 5.14 Command Palette (`command-palette.tsx`)
- **Role:** Keyboard-driven command launcher
- **What it does:** Opens with `Cmd+K`/`Ctrl+K`, fuzzy search on commands, toggle panels/inspector/annotations

### 5.15 Workspace Toolbar (`workspace-toolbar.tsx`)
- **Role:** Top navigation bar
- **What it does:** Logo, project switcher, MCP status badge, route switcher, panel toggle buttons (with count badges), .0c file actions (download/import/sync), viewport presets, Cmd+K button

### 5.16 .0c Format System (`oc-format.ts`, `oc-parser.ts`)
- **Role:** Design-as-code variant format
- **What it does:** Structured JSON representation of UI variants (OCDocument, OCNode, OCStyles), responsive breakpoints per node, design variables (tokens), bidirectional HTML/CSS ↔ .0c parser, tree CRUD helpers (find, update, delete, insert, count)

### 5.17 .0c Project File (`oc-project.ts`, `oc-project-store.ts`)
- **Role:** Whole-project persistence format
- **What it does:** Single `.0c` JSON file containing all project data (metadata, workspace config, breakpoints, variables, pages, variants, annotations, feedback, history), Zod schema validation, SHA-256 integrity hashing, migration pipeline, state ↔ .0c bidirectional conversion, IndexedDB persistence, file export/import, auto-save (500ms debounce), push/pull to IDE via MCP bridge

### 5.18 Variant DB (`variant-db.ts`)
- **Role:** IndexedDB persistence for variants and waitlist
- **What it does:** CRUD operations for variants, feedback items, and projects using IndexedDB (`idb` library), auto-cleanup of variants older than 7 days

### 5.19 MCP Server + Bridge (`mcp/server.ts`, `mcp/bridge.ts`, `mcp/tools.ts`)
- **Role:** AI agent communication layer
- **What it does:** Node.js CLI binary that runs an HTTP server (port 24192) and MCP server (stdio transport), 17 registered MCP tools for reading feedback, getting/modifying variants, pushing changes, managing .0c trees, design variables, and project files

---

## 6. Feature Inventory

### Implemented Features (Complete)

| Category | Feature | Status |
|----------|---------|--------|
| **Core** | `<Zeros />` React component with portal overlay | Done |
| **Core** | Keyboard shortcut toggle (`Ctrl+Shift+D`) | Done |
| **Core** | FAB toggle button (configurable position) | Done |
| **Core** | Production guard (`devOnly` prop) | Done |
| **Core** | Iframe guard (prevents recursive rendering) | Done |
| **Inspector** | Click-to-inspect mode | Done |
| **Inspector** | DOM tree walking with element map | Done |
| **Inspector** | Hover/select overlays with tag + size labels | Done |
| **Inspector** | Computed style extraction (35+ properties) | Done |
| **Inspector** | CSS selector generation | Done |
| **Inspector** | Page snapshot capture (responsive, no inline baking) | Done |
| **Inspector** | Component snapshot capture | Done |
| **Inspector** | Fork button on selection overlay | Done |
| **Inspector** | Feedback button on selection overlay | Done |
| **Canvas** | ReactFlow infinite canvas (pan/zoom/drag) | Done |
| **Canvas** | Source Node (resizable, breakpoint presets) | Done |
| **Canvas** | Variant Nodes (resizable, srcdoc isolation) | Done |
| **Canvas** | Auto-layout variants by depth | Done |
| **Canvas** | Iframe pointer guard during interactions | Done |
| **Canvas** | MiniMap + Controls | Done |
| **Variants** | Fork page (full page snapshot) | Done |
| **Variants** | Fork component (element snapshot) | Done |
| **Variants** | Fork variant (variant chains) | Done |
| **Variants** | Rename, delete, finalize, send, push to main | Done |
| **Variants** | Status tracking (draft → finalized → sent → pushed) | Done |
| **Variants** | Responsive variants (CSS preserved) | Done |
| **Panels** | Layers panel (tree, search, visibility/lock) | Done |
| **Panels** | Style panel (categories, inline edit, box model, code) | Done |
| **Panels** | File map panel (50+ patterns, framework-aware) | Done |
| **Panels** | Agent/IDE panel (5 IDEs, MCP status, activity) | Done |
| **Panels** | Annotation overlay (6 tools, 8 colors) | Done |
| **Panels** | Version manager | Done |
| **Panels** | Command palette (`Cmd+K`) | Done |
| **Panels** | Panel mutual exclusion (Style ↔ Files) | Done |
| **Feedback** | Element Chat (intent/severity/comment) | Done |
| **Feedback** | Agent Waitlist (grouped, select, copy, send) | Done |
| **Feedback** | Structured markdown output for AI agents | Done |
| **Feedback** | Dual send (MCP bridge + clipboard) | Done |
| **.0c Format** | OCDocument/OCNode/OCStyles types | Done |
| **.0c Format** | Design variables (tokens) | Done |
| **.0c Format** | Responsive breakpoints per node | Done |
| **.0c Format** | Bidirectional HTML/CSS ↔ .0c parser | Done |
| **.0c Project** | Zod schema validation | Done |
| **.0c Project** | SHA-256 integrity hash | Done |
| **.0c Project** | Migration pipeline | Done |
| **.0c Project** | State ↔ .0c conversion | Done |
| **.0c Project** | IndexedDB persistence | Done |
| **.0c Project** | File export/import | Done |
| **.0c Project** | Auto-save (500ms debounce) | Done |
| **MCP** | 17 MCP tools registered | Done |
| **MCP** | HTTP bridge (12+ endpoints) | Done |
| **MCP** | Browser ↔ Bridge polling (2s) | Done |
| **MCP** | Push changes from agent → variant | Done |
| **MCP** | .0c project file endpoints | Done |

---

## 7. State Management

### Architecture
- **Pattern:** React Context + `useReducer`
- **File:** `src/app/store.tsx` (738 lines)
- **Hook:** `useWorkspace()` returns `{ state, dispatch }`

### State Shape (`WorkspaceState` — ~30 fields)

| Group | Fields |
|-------|--------|
| **App** | `currentView`, `project`, `isLoading` |
| **Elements** | `elements`, `selectedElementId`, `hoveredElementId`, `selectionSource` |
| **Versions** | `versions`, `activeVersionId`, `styleChanges` |
| **Variants** | `variants`, `activeVariantId` |
| **IDE** | `ides` (5 default IDE connections) |
| **Annotations** | `annotations`, `annotationMode`, `annotationTool`, `annotationColor` |
| **Files** | `fileMappings`, `fileMapPanelOpen` |
| **Feedback** | `feedbackItems`, `waitlistOpen`, `feedbackPanelOpen` |
| **MCP** | `wsStatus`, `wsLogs`, `wsPort` |
| **Project** | `ocProject`, `ocProjectFile` |
| **Routing** | `currentRoute`, `routeHistory` |
| **UI** | `inspectorMode`, `layersPanelOpen`, `stylePanelOpen`, `idePanelOpen`, `commandPaletteOpen` |

### Action Types (60+)

The reducer handles element selection, style updates, version management, IDE status, annotations, file mappings, feedback CRUD, variant CRUD, project management, route tracking, and WebSocket/MCP state updates.

### Key Data Types

- **`ElementNode`** — DOM tree node (id, tag, classes, children, text, styles, selector, visible, locked)
- **`VariantData`** — Forked variant (id, name, html, css, modifiedHtml/Css, sourceType, status, parentId, etc.)
- **`FeedbackItem`** — Feedback entry (id, variantId, elementId, selector, comment, intent, severity, status)
- **`Annotation`** — Drawing annotation (tool, position, dimensions, color, text, points)
- **`FileMapping`** — Element-to-file mapping (elementId, filePath, componentName, confidence)
- **`IDEConnection`** — IDE status (type, status, setupMethod, lastSync)

---

## 8. Data Formats & Persistence

### .0c Variant Format
A structured JSON representation of individual UI variants:
- **OCDocument:** version, name, source info, variables, breakpoints, node tree
- **OCNode:** tag, class, styles, responsive overrides, children, text content
- **OCStyles:** 40+ CSS properties with design token references (`$variable.name`)
- **Bidirectional parsing:** `htmlToOCDocument()` ↔ `ocDocumentToHtml()`

### .0c Project File
A single JSON file representing the entire Zeros project:
- Schema version 1, validated with Zod
- Contains: project metadata, workspace config, breakpoints, design variables, pages, variants, annotations, feedback, history checkpoints
- SHA-256 integrity hash
- Revision-based conflict detection

### IndexedDB Databases

| Database | Store | Key | Purpose |
|----------|-------|-----|---------|
| `Zeros-db` | `variants` | `id` | Individual VariantData objects |
| `Zeros-db` | `waitlist` | `id` | Individual FeedbackItem objects |
| `Zeros-db` | `projects` | `id` | StoredProject (project + variants + feedback) |
| `Zeros-projects` | `oc-projects` | `project.id` | Full OCProjectFile objects |
| `Zeros-projects` | `oc-sync-meta` | `projectId` | Sync tracking metadata |

Auto-cleanup: Variants older than 7 days are removed automatically.

---

## 9. MCP Integration (AI Agent Bridge)

### HTTP Bridge (`bridge.ts`)
- **Port:** 24192 (configurable via `ZEROS_PORT` env var)
- **Transport:** HTTP REST with CORS enabled

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

### MCP Tools (17 registered)

| Tool | Description |
|------|-------------|
| `Zeros_get_pending` | List pending feedback items |
| `Zeros_get_variant` | Get variant HTML/CSS/metadata |
| `Zeros_resolve_feedback` | Mark feedback as resolved |
| `Zeros_push_changes` | Push modified HTML/CSS to variant preview |
| `Zeros_list_variants` | List all variants |
| `Zeros_get_project` | Get project info |
| `Zeros_watch` | Long-poll for new feedback |
| `Zeros_get_variant_tree` | Get .0c JSON tree for variant |
| `Zeros_update_node` | Update node in .0c tree |
| `Zeros_add_node` | Insert node into .0c tree |
| `Zeros_delete_node` | Remove node from .0c tree |
| `Zeros_set_variable` | Set design variable/token |
| `Zeros_get_variables` | List design variables |
| `Zeros_get_project_file` | Get full .0c project file |
| `Zeros_save_project_file` | Save .0c project file (with revision conflict detection) |
| `Zeros_get_project_meta` | Get project summary metadata |
| `Zeros_write_project_to_workspace` | Write .0c file to workspace path |

### CLI Binary
```bash
npx @Withso/zeros mcp
# or
zeros-mcp
```

### IDE Setup Examples
- **Claude Code:** `claude mcp add Zeros -- npx @Withso/zeros mcp`
- **Cursor/Windsurf/VS Code:** Extension-based
- **Antigravity:** CLI-based

---

## 10. Technology Stack

| Layer | Technology |
|-------|-----------|
| **UI Framework** | React 18 |
| **Canvas** | @xyflow/react (ReactFlow) v12 |
| **Styling** | Tailwind CSS v4 + runtime CSS injection |
| **UI Primitives** | Radix UI (ScrollArea) |
| **Icons** | Lucide React |
| **State Management** | React Context + useReducer |
| **Persistence** | IndexedDB (via `idb` library) |
| **Validation** | Zod v4 |
| **MCP Protocol** | @modelcontextprotocol/sdk |
| **Build (package)** | tsup (CJS + ESM + types) |
| **Build (dev)** | Vite v7 |
| **Language** | TypeScript 5 |
| **CSS Utilities** | clsx, tailwind-merge |

---

## 11. Project Status

### Current State: **Pre-release / Active Development**

- **Version:** 0.0.5 (pre-release)
- **npm:** **NOT published yet** — the docs page explicitly warns about this
- **License:** MIT (open source)
- **Codebase:** ~15,000+ lines of TypeScript/TSX across 40+ files
- **Tests:** No automated tests (unit/integration/E2E) exist yet
- **CI/CD:** No CI/CD pipeline configured
- **Documentation:** Extensive internal DOCUMENTATION.md (940 lines)

### What Works
All core features listed in Section 6 are implemented and functional:
- Full browser overlay with inspector, panels, canvas, and toolbar
- Variant system (fork, edit, finalize, send, push)
- MCP bridge with 17 tools
- .0c format with bidirectional parsing
- .0c project file with IndexedDB persistence
- Feedback system with structured output

### What's Missing
- npm package is not published
- No automated tests of any kind
- No CI/CD pipeline
- No real-time collaboration (poll-based only)
- No undo/redo for style edits
- File mapping is heuristic-only (no source map integration)
- Variant previews are static (no JavaScript behavior preserved)

---

## 12. Known Limitations

1. **File mapping is heuristic-only** — No build tool integration. Patterns match class names and semantic tags but can produce false positives.

2. **No undo/redo for style edits** — `applyStyle()` returns old value but there's no undo stack.

3. **Variant preview is static** — Forked variants capture HTML/CSS snapshots. JavaScript behavior, event handlers, and dynamic content are not preserved.

4. **Single-page scope** — The inspector only sees the current page's DOM. Route changes in SPAs are tracked but don't trigger full re-inspection.

5. **No real-time collaboration** — Poll-based sync (2-second interval). Multiple simultaneous users may cause conflicts.

6. **Large variant HTML** — Variants >50KB may cause performance issues in srcdoc iframes and markdown output.

7. **No image/asset handling** — Variants don't capture or store referenced images/assets.

---

## 13. Future Roadmap

| Phase | Focus | Priority |
|-------|-------|----------|
| **A** | File Watcher Sync (IDE ↔ browser bidirectional .0c sync) | HIGH |
| **C** | Real-time MCP Sync (event streams, granular patches) | MEDIUM |
| **D** | Enhanced Variant System (AI-generated variants, diff viewer, merging) | MEDIUM |
| **E** | Source Map Integration (exact file:line resolution) | MEDIUM |
| **F** | Design Token System (extract/edit/propagate CSS variables) | MEDIUM |
| **G** | Multi-page Support (multiple routes in one project) | LOW |
| **H** | Collaboration Features (WebSocket sync, CRDTs, presence) | LOW |
| **I** | Export & Code Generation (React/Vue/Svelte components, Tailwind) | LOW |
| **J** | Testing & QA (unit tests, E2E, CI/CD) | LOW |

---

*Analysis completed on 2026-04-02*
*Source: `Withso/Zeros` repository — full codebase review*

---

## TODO — Rewrite / Extend for the Mac App Era

This document's module breakdown (§5), state management (§7), data
formats (§8), and MCP integration (§9) still accurately describe the
engine code that lives under [src/zeros/](src/zeros/) and
[src/engine/](src/engine/). What's missing, as of 2026-04-20:

### New surfaces to document

- [ ] **[src/shell/](src/shell/) — the Tauri shell (Col 1 + Col 2).**
      Includes `column1-nav.tsx`, `column2-workspace.tsx`, and the six
      Col-2 panel components (ai-chat, git, terminal, env, todo,
      mission). Should get its own §Shell Modules section parallel to
      the current §5.
- [ ] **[src-tauri/src/](src-tauri/src/) — the Rust backend.**
      3,062 LOC across 10 modules (`ai_cli`, `css_files`, `env_files`,
      `git`, `localhost`, `secrets`, `sidecar`, `skills`, `todo`,
      `lib`). Needs a §Rust Backend section with file-by-file
      responsibilities matching V3 §7.
- [ ] **[src/native/](src/native/) — the Tauri bridge.**
      `storage.ts`, `settings.ts`, `secrets.ts`, `tauri-events.ts`,
      `recent-projects.ts`. Parallel to the old `bridge/` section.
- [ ] **Sidecar lifecycle** — the Node engine launched by
      `sidecar.rs`, its `get_engine_port` command, and the
      `project-changed` event that webviews listen for. Not the same
      as V1's "bridge" WebSocket (still used, but now a grandchild of
      Tauri).

### Sections to update

- [ ] §2 "What This Project Does" — add the three-column shell
      description; the product is no longer "a browser overlay."
- [ ] §3 "How It Works" — the cold-start flow is now `Tauri window
      opens → sidecar.rs launches Node engine → webview loads React
      shell → Col 3 connects via WebSocket`. Not `Ctrl+Shift+D`.
- [ ] §4 "Project Architecture" — insert the 3-column diagram from
      V3 §2.
- [ ] §6 "Feature Inventory" — add: Git (13 ops), Terminal, Env,
      Todo, Mission, Skills, Deep Link, Keychain. Mark MCP Settings
      Page items as removed per V3 Decision 3.
- [ ] §7 "State Management" — document the Col-2 chats store
      (threads, activeChatId, provider/model/effort) that's new
      since the overlay.
- [ ] §9 "MCP Integration" — clarify that MCP is still exposed by
      the engine for *external* AI tools (Cursor, Claude Code), but
      Col 2's chat uses the direct `ai_cli` / `anthropic` paths, not
      MCP. These are two separate AI surfaces.
- [ ] §10 "Technology Stack" — add Tauri, `git2-rs`,
      `security-framework`, `tauri-plugin-pty`, `tauri-plugin-deep-link`,
      `tauri-plugin-notification`, xterm.js.
- [ ] §11 "Project Status" — SUPERSEDED. Replace with pointer to
      V3 §13 (the actual roadmap state).
- [ ] §12 "Known Limitations" — most of the V1 limitations
      (IndexedDB, Web APIs, MCP port conflict) are gone with the Mac
      app. Rewrite with the *current* limitations (no Windows/Linux
      build, no cloud sync, no multiplayer, no mobile preview in the
      iframe-based canvas).
- [ ] §13 "Future Roadmap" — SUPERSEDED. Point at V3 §13 +
      `TAURI_MAC_APP_PLAN.md` for the phased plan.

### Decision

The ~33KB of V1 content is *mostly still correct for the engine
layer*. Rather than duplicate it into a brand-new file, the plan is:

1. Keep this file as the *engine-layer reference*.
2. Let `PRODUCT_VISION_V3.md` own the app-wide vision.
3. Let `TAURI_MAC_APP_PLAN.md` own the phase plan.
4. Execute the bullets above as a single rewrite pass when Stream 1.5
   (per-module context docs) also needs updating — both audits
   overlap heavily.
