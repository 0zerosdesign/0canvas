# Zeros Product Vision & Architecture Plan

> **⚠️ SUPERSEDED — kept for historical reference only.**
> This document describes the V1 vision (VS Code extension + browser
> overlay). It was replaced by V2 (npm engine, 2026-04-15) and then
> by V3 ([PRODUCT_VISION_V3.md](PRODUCT_VISION_V3.md), 2026-04-20 —
> native Tauri Mac app). Read V3 for the current product vision. This
> file remains in the repo because some of the CSS-resolution and
> selector-indexing architecture described here still holds.

---

> **An agentic design tool that lets designers work visually on production code.**
> Pull, design, push — no coding required.

**Version:** 1.1 (SUPERSEDED)
**Date:** 2026-04-12
**Updated:** 2026-04-12
**Superseded by:** PRODUCT_VISION_V2.md (2026-04-15), then V3 (2026-04-20)
**Author:** Zeros Design

---

## Table of Contents

 

---

## 1. Vision & Problem Statement

### The Problem

Designers and developers work in two separate worlds. Designers create pixel-perfect mockups in Figma. Developers interpret those mockups into code. This handoff creates a permanent gap — the production UI never exactly matches the design, edge cases are missed, and every design iteration requires another round of communication.

The tools that attempt to bridge this gap (Figma-to-code generators, design token sync, visual editors) all share the same fundamental flaw: **they generate artifacts that are separate from the production codebase.** The generated code still needs to be manually integrated, reviewed, and maintained by developers.

### The Vision

Zeros eliminates the handoff entirely. It is a design tool that operates **directly on production code**:

- A designer opens VS Code or Cursor
- Pulls the latest code from git
- Opens the `.0c` design file — the visual canvas appears
- Makes design changes visually: colors, spacing, typography, alignment, layout
- Every change writes directly to the actual CSS/component files
- Saves their work, commits, and pushes
- The developer reviews the PR — it contains real, production-ready code changes

**The designer never writes a line of code. The developer never interprets a design file.**

### Core Principles

1. **The browser is the canvas.** The real app, running in a real browser, is the design surface. No simulated rendering. What the designer sees is exactly what ships.

2. **The .0c file is the design document.** A single JSON file in the git repo that stores the designer's workspace state — variants, annotations, feedback, tokens. It's the "Figma file" that lives alongside code.

3. **VS Code is the shell, not the editor.** VS Code provides git, file system, terminal, and AI agents. The actual design work happens in the browser overlay. The VS Code extension is a thin orchestrator.

4. **Git is invisible.** Designers use "Save checkpoint" and "Share changes" — they never think about commits, branches, or merges.

5. **AI agents are collaborators.** The designer describes what they want; the AI agent makes structural changes the visual editor can't. The `.0c` file gives AI agents rich visual context.

### Target Users

| User | Experience |
|------|-----------|
| **Visual Designer** | Opens VS Code, sees a Figma-like canvas, makes visual changes, pushes. Never sees code. |
| **Design Engineer** | Uses the overlay for rapid prototyping, switches to code view for structural changes. Both stay in sync. |
| **Developer** | Reviews PRs that contain visual changes with full context from the .0c file. |
| **AI Agent** | Reads the .0c file to understand design intent, makes code changes, designer reviews visually. |

---

## 2. Current State Analysis

### What Zeros Is Today

Zeros is a **React overlay library** (npm: `@Withso/zeros` v0.0.5) that embeds into any web app as a floating inspector. It's activated with `Ctrl+Shift+D` and provides:

```
Consumer App (React/Vue/Svelte/any framework)
    └── <Zeros /> component (portal on document.body)
         ├── FAB toggle button (Ctrl+Shift+D)
         └── Full workspace overlay (when open)
              ├── AppSidebar (design/themes/settings navigation)
              ├── WorkspaceToolbar (top bar)
              ├── LayersPanel (DOM tree, resizable)
              ├── VariantCanvas (ReactFlow infinite canvas)
              │    └── SourceNode (resizable iframe viewport)
              ├── StylePanel (CSS properties, resizable)
              └── ThemesPage / SettingsPage (alternative views)
```

### Current Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 + TypeScript 5.0 |
| Styling | Tailwind CSS 4.0 + CSS custom properties (runtime injection) |
| Canvas | @xyflow/react 12.10.1 (ReactFlow) |
| State | React Context + useReducer (50+ action types) |
| Storage | IndexedDB (via idb 8.0.3) |
| Validation | Zod 4.3.6 (.0c schema validation) |
| Build | tsup 8.0 (library) + Vite 7.3.1 (dev server) |
| Icons | Lucide React 0.400.0 |
| UI Components | Radix UI (scroll area), clsx, tailwind-merge |

### Current Capabilities

| Capability | Status | Notes |
|-----------|--------|-------|
| DOM element inspection | Working | Inspects live DOM via iframe, builds element tree |
| Element selection/hover | Working | Click-to-select, hover highlight, computed styles |
| ~~Layers panel~~ | **Removed** | DOM tree layers don't map to design layers — inspect-first model is better (see Decision 6) |
| Style panel | Working | View/edit CSS properties for selected elements |
| Variant creation | Working | Fork page or component into variant cards on canvas |
| Feedback annotations | Working | Add comments with intent/severity per element |
| Themes — Token editor | Working | Full table editor with multi-theme support, file sync, token CRUD |
| Themes — Inspector integration | Working | Theme Mode for inspecting/changing color tokens on live elements |
| Themes — CSS parsing | Working | Precision parser handles @layer, @theme, nested blocks, var() chains |
| Themes — Bidirectional sync | Working | File System Access API with 1s polling + manual write-back |
| Themes — Change tracking | Working | ThemeChangeItem list with "Copy Prompt" for AI agents |
| .0c project format | Working | Zod-validated JSON with migration pipeline, integrity hash |
| IndexedDB persistence | Working | Auto-save with debounce, import/export as .0c files |
| AI agent integration | Partial | Copy-paste markdown to clipboard, no direct agent connection |
| Responsive presets | Working | Desktop/Laptop/Tablet/Mobile viewport presets |
| Framework detection | Stub | Placeholder in project format |
| Vite plugin | Stub | `apply: "serve"` only, no functionality |

### Existing VS Code Extension

Location: `extensions/vscode/`

The extension currently handles **feedback dispatch** only:

```
extensions/vscode/
├── src/
│   ├── extension.ts      — Activation, status bar, commands
│   ├── bridge-client.ts  — HTTP polling on port 24192 for feedback
│   ├── agent-dispatch.ts — Write feedback.md, trigger Cursor/Copilot/Claude
│   └── format-feedback.ts — Convert feedback items to markdown
├── package.json           — 3 commands: sendToAgent, copyFeedback, showFeedback
└── tsconfig.json
```

Key facts about the existing extension:
- Activates on startup (`onStartupFinished`)
- Polls an HTTP bridge server on port 24192 (this bridge server was removed from the main codebase)
- Detects agent type: Cursor, Copilot, Claude Code, Codex
- Auto-dispatches feedback markdown to the detected agent
- Writes to `.zeros/feedback.md` in workspace

### What's Missing (Gap Analysis)

| Missing Capability | Priority | Why It Matters |
|-------------------|----------|---------------|
| **Visual property editors** | Critical | Designers need color pickers, spacing sliders, alignment buttons — not raw CSS text |
| **Write-back to source files** | Critical | Changes must modify actual CSS/component files, not just in-memory state |
| **Source map resolution** | Critical | Must map DOM elements back to source file + line number |
| **VS Code ↔ Browser bridge** | Critical | Real-time communication between overlay and extension |
| **Custom editor for .0c files** | High | Double-click .0c → launch design experience |
| **Dev server auto-management** | High | Extension should detect and start the dev server |
| **Git abstraction layer** | High | "Save checkpoint" / "Share changes" instead of git commands |
| **Component boundary detection** | Medium | Know where one component ends and another begins |
| **Responsive editing** | Medium | Edit styles per breakpoint visually |
| **Typography controls** | Medium | Font family/size/weight/line-height editors |
| **Layout controls** | Medium | Flexbox/Grid visual editors |
| **Undo/redo across files** | Medium | Track and reverse multi-file changes |
| **MCP server for AI context** | Medium | AI agents read .0c for visual understanding |
| **Visual diff** | Low | Before/after comparison of visual changes |
| **Conflict resolution UI** | Low | Visual merge for .0c files |

---

## 3. Target Architecture

### High-Level System Design

```
┌──────────────────────────────────────────────────────────────────┐
│                      VS Code / Cursor                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Zeros Extension (thin orchestrator)                     │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐  │  │
│  │  │ Custom Editor │ │ Dev Server   │ │ MCP Server        │  │  │
│  │  │ Provider      │ │ Manager      │ │ (AI agent bridge) │  │  │
│  │  │ (.0c files)   │ │ (detect +    │ │                   │  │  │
│  │  │               │ │  auto-start) │ │                   │  │  │
│  │  └──────┬───────┘ └──────┬───────┘ └───────────────────┘  │  │
│  │         │                │                                  │  │
│  │         │         ┌──────┴───────┐                         │  │
│  │         │         │ WebSocket    │                         │  │
│  │         │         │ Bridge       │                         │  │
│  │         │         │ (port 24193) │                         │  │
│  │         │         └──────┬───────┘                         │  │
│  └─────────┼────────────────┼────────────────────────────────┘  │
│            │                │                                    │
│  ┌─────────┴────────────────┴────────────────────────────────┐  │
│  │  Built-in Git UI          Built-in Terminal                │  │
│  │  (pull/commit/push)       (npm run dev)                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                    WebSocket (port 24193)
                              │
┌──────────────────────────────────────────────────────────────────┐
│                      Browser (Chrome/Safari/Firefox)              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Consumer App (real DOM, real CSS, real everything)         │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  Zeros Overlay (Ctrl+Shift+D)                      │  │  │
│  │  │                                                      │  │  │
│  │  │  ┌────────┐ ┌──────────────────┐ ┌──────────────┐   │  │  │
│  │  │  │ Layers │ │ Visual Canvas    │ │ Property     │   │  │  │
│  │  │  │ Panel  │ │ (live app view)  │ │ Editors      │   │  │  │
│  │  │  │        │ │                  │ │              │   │  │  │
│  │  │  │ DOM    │ │  Click element → │ │ Color picker │   │  │  │
│  │  │  │ tree   │ │  edit visually   │ │ Spacing      │   │  │  │
│  │  │  │        │ │                  │ │ Typography   │   │  │  │
│  │  │  │        │ │                  │ │ Layout       │   │  │  │
│  │  │  │        │ │                  │ │ Borders      │   │  │  │
│  │  │  │        │ │                  │ │ Effects      │   │  │  │
│  │  │  └────────┘ └──────────────────┘ └──────────────┘   │  │  │
│  │  │                                                      │  │  │
│  │  │  ┌────────────────────────────────────────────────┐  │  │  │
│  │  │  │ Toolbar: Tokens | Variants | Feedback | AI     │  │  │  │
│  │  │  └────────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Designer clicks element in browser
        │
        ▼
Overlay captures: element, computed styles, bounding box
        │
        ▼
Property editor panel opens with visual controls
        │
        ▼
Designer changes color via picker: #3B82F6 → #EF4444
        │
        ├──→ In-memory: update element style (instant visual feedback)
        │
        └──→ WebSocket message to VS Code extension:
             {
               type: "STYLE_CHANGE",
               elementSelector: "button.primary",
               property: "background-color",
               value: "#EF4444",
               sourceFile: "src/components/Button.tsx",  // from source map
               sourceLine: 42
             }
                    │
                    ▼
             Extension writes to actual file
                    │
                    ▼
             Vite HMR detects change → hot reloads browser
                    │
                    ▼
             Designer sees change reflected in real app
                    │
                    ▼
             .0c file auto-saves new state to IndexedDB + file system
```

### Architecture Principles

1. **Browser owns the rendering.** The overlay runs in the real browser on the real app. No WebView approximation. What you see is production-accurate.

2. **Extension owns the file system.** Only the VS Code extension reads/writes source files. The browser overlay never touches the file system directly.

3. **WebSocket is the bridge.** Real-time bidirectional communication between overlay and extension. No HTTP polling.

4. **.0c file is the shared state.** Both the overlay and the extension can read the .0c file. It lives in the git repo as the canonical design document.

5. **Vite HMR closes the loop.** After the extension writes a file change, Vite's hot module replacement pushes the update to the browser. The overlay doesn't need to manually refresh.

---

## 4. The .0c File Format — Design Document Standard

### Purpose

The `.0c` file is a JSON document that stores the complete design workspace state. It lives in the git repo alongside source code. It is the designer's "Figma file" — but version-controlled, diffable, and readable by AI agents.

### Current Schema (v1)

```typescript
{
  $schema: "https://zeros.design/schemas/oc-project-v1.json",
  schemaVersion: 1,

  // Project identity
  project: {
    id: string,            // unique ID
    name: string,          // human-readable name
    createdAt: ISO8601,
    updatedAt: ISO8601,
    revision: number       // increments on every save
  },

  // Codebase context
  workspace: {
    root: string,          // project root (usually ".")
    entryFiles: string[],  // e.g. ["src/main.tsx"]
    framework: enum,       // react | next | vue | nuxt | svelte | solid | angular | astro | unknown
    pathAliases: Record    // e.g. { "@": "src" }
  },

  // Responsive breakpoints
  breakpoints: {
    desktop: 1280,
    laptop: 1024,
    tablet: 768,
    mobile: 390
  },

  // Design variables (arbitrary key-value)
  variables: Record<string, string | number | boolean | null>,

  // Pages
  pages: [{
    id: string,
    name: string,
    route: string,         // e.g. "/"
    source: {
      html: string,
      styles: string,
      assets: string[]
    },
    layers: [{             // recursive DOM tree
      id: string,
      tag: string,
      selector?: string,
      textPreview?: string,
      classes?: string[],
      attrs?: Record<string, string>,
      children: [...]
    }]
  }],

  // Variants (design iterations)
  variants: [{
    id: string,
    pageId: string,
    name: string,
    sourceElementId: string | null,
    sourceViewportWidth: number,
    viewport: { width, height },
    content: { html, styles },
    annotations: [{        // designer notes
      id, elementId, author, text, createdAt, resolved
    }],
    feedback: [{           // structured feedback
      id, text, severity, elementId, createdAt
    }],
    parentId: string | null,
    status: "draft" | "finalized" | "sent" | "pushed",
    createdAt, updatedAt
  }],

  // History
  history: {
    checkpoints: [{
      id, createdAt, revision, label, note
    }],
    lastCheckpointAt: ISO8601 | null
  },

  // Integrity
  integrity: {
    hash: string,          // SHA-256 or FNV-1a
    generator: string      // e.g. "Zeros@0.0.5"
  }
}
```

### Current Persistence Gap

| Data | Saved to .0c? | Survives rebuild? | Problem |
|------|:------------:|:-----------------:|---------|
| Project metadata | Yes | Yes | — |
| Variants (html, css, status) | Yes | Yes | — |
| Feedback items | Yes | Yes (inside variant.feedback[]) | — |
| Breakpoints | Yes | Yes | — |
| Pages / routes | Yes | Yes | — |
| History checkpoints | Yes | Yes | — |
| **Theme changes (ThemeChangeItem[])** | **No** | **No** | All color changes lost |
| **Imported CSS files (paths, handles)** | **No** | **No** | Must re-import every time |
| **Parsed tokens + theme columns** | **No** | **No** | Token table disappears |
| **Theme mode on/off state** | **No** | **No** | Minor — UI state |

**This is the critical v1 gap.** A designer imports `tokens.css`, spends 30 minutes making theme changes, dev server restarts → everything is gone.

### Planned Schema Extensions (v2) — Themes Persistence

The v2 schema adds three new top-level fields for full theme persistence:

```typescript
{
  // ... existing v1 fields (project, workspace, breakpoints, etc.) ...

  // NEW: Imported theme CSS files
  // Stores which CSS files the designer imported so they can be
  // automatically re-loaded on startup without the file picker
  themeFiles: [{
    id: string,                    // unique ID for this file entry
    path: string,                  // relative path, e.g. "src/styles/tokens.css"
    name: string,                  // filename, e.g. "tokens.css"
    lastSynced: ISO8601,           // when file was last read/written
    themes: [{                     // theme columns discovered in the file
      id: string,                  // e.g. "default", "light", "dark"
      name: string,
      isDefault: boolean
    }],
    tokenSnapshot: [{              // snapshot of tokens at last sync
      name: string,                // e.g. "--color-primary"
      group: string,               // e.g. "color"
      syntax: string,              // "color" | "length-percentage" | etc.
      values: Record<string, string>  // themeId → value
    }]
  }],

  // NEW: Theme changes — designer's visual color changes
  // These are the inline style overrides made in Theme Mode that
  // haven't been applied to source files yet
  themeChanges: [{
    id: string,
    elementSelector: string,       // CSS selector for the element
    elementTag: string,
    elementClasses: string[],
    property: string,              // "color", "background-color", etc.
    originalValue: string,         // computed value before change
    originalTokenChain: string[],  // var() resolution chain
    originalSourceSelector: string,// CSS rule that set the original value
    originalSourceType: string,    // "rule" | "inline" | "inherited"
    newToken: string,              // token name applied, e.g. "--green-500"
    newValue: string,              // resolved value of the new token
    appliedAt: ISO8601,
    committed: boolean             // true = written to source file
  }],

  // NEW: Feedback items (top-level, not nested in variants)
  // Variants already have feedback[], but standalone page-level
  // feedback should also persist
  feedback: [{
    id: string,
    variantId: string,
    elementId: string,
    elementSelector: string,
    elementTag: string,
    elementClasses: string[],
    comment: string,
    intent: string,                // "fix" | "change" | "question" | "approve"
    severity: string,              // "blocking" | "important" | "suggestion"
    status: string,                // "pending" | "sent" | "resolved"
    createdAt: ISO8601
  }],

  // FUTURE: Source mappings, component registry, AI agent context
  // (deferred to v3 — not needed for v1 feedback + theming focus)
}
```

### Dual Persistence Strategy (The Real Fix)

Two persistence layers work together so **nothing is ever lost**:

```
┌─────────────────────────────────────────────────────────────┐
│                    .0c File (in git repo)                    │
│                                                             │
│  The BACKUP + PORTABLE layer                                │
│                                                             │
│  Stores:                                                    │
│  - Theme file PATHS (not content — content is in the CSS)   │
│  - Token snapshots (for viewing when CSS file unavailable)  │
│  - Theme columns (default, light, dark)                     │
│  - All theme changes (ThemeChangeItem[])                    │
│  - All feedback items                                       │
│  - All variants                                             │
│  - Project metadata, breakpoints, history                   │
│                                                             │
│  Lives in git → survives everything → shared across team    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                          Syncs both ways
                               │
┌──────────────────────────────┴──────────────────────────────┐
│                  IndexedDB (in browser)                      │
│                                                             │
│  The FAST + LIVE layer                                      │
│                                                             │
│  Stores:                                                    │
│  - Everything in .0c (mirrored)                             │
│  - FileSystemFileHandle references (for instant re-access   │
│    without file picker on same origin)                      │
│  - UI state (which panel is open, scroll position, etc.)    │
│                                                             │
│  Survives page refresh on same origin                       │
│  Lost only if browser data cleared or origin changes        │
└─────────────────────────────────────────────────────────────┘
```

### Reload Recovery Flow

```
Dev server restarts / page refreshes / browser reopened
                    │
                    ▼
        ┌── IndexedDB available? ──┐
        │                          │
       YES                        NO
        │                          │
        ▼                          ▼
  Load full state              Read .0c file from
  from IndexedDB               file system (via
  (instant, includes           extension or import)
   FileSystemHandles)                │
        │                          │
        ▼                          ▼
  Try each saved              For each themeFile
  FileSystemHandle             entry in .0c:
        │                          │
   ┌────┴────┐                     ▼
   │         │               Prompt file picker
  OK      Permission          (one time only —
   │      expired             user re-selects
   │         │                the CSS file)
   │         ▼                     │
   │   Prompt file picker          │
   │   for just that file          │
   │         │                     │
   ▼         ▼                     ▼
  Re-parse tokens from CSS file content
        │
        ▼
  Restore theme changes from .0c / IndexedDB
  (re-apply inline styles to matching elements)
        │
        ▼
  ✅ Full state restored — designer continues where they left off
```

### What Persists Through What

| Scenario | .0c file | IndexedDB | FileSystemHandle | Result |
|----------|:--------:|:---------:|:----------------:|--------|
| Page refresh (same port) | Yes | Yes | Yes | **Instant restore**, no prompts |
| Dev server restart (same port) | Yes | Yes | Yes | **Instant restore**, no prompts |
| Dev server restart (different port) | Yes | Maybe | Maybe | Restore from .0c, may need one file picker prompt |
| Clone repo on new machine | Yes | No | No | .0c has token snapshots for viewing, file picker prompt to reconnect CSS files |
| Clear browser data | Yes | No | No | Same as new machine |
| Delete .0c file | No | Yes | Yes | IndexedDB still has everything, can re-export .0c |

**The key insight:** The .0c file stores paths + snapshots (portable). IndexedDB stores handles (fast). Together, there's no scenario where data is lost unless both are wiped simultaneously.

### File Lifecycle

```
1. Developer scaffolds project:
   $ npx Zeros init
   → Creates project.0c in repo root with detected framework and entry files

2. Designer opens project.0c in VS Code:
   → Extension activates, starts dev server, opens browser

3. Designer makes visual changes:
   → .0c file updates in real-time (auto-save to IndexedDB + file system)
   → Source files are also modified (the actual code changes)

4. Designer saves checkpoint:
   → .0c revision increments
   → Integrity hash recalculated
   → Git commit created with both .0c and source file changes

5. Designer shares:
   → Git push → PR created with .0c + source changes
   → Reviewer sees both the design context and the actual code diff

6. On next pull:
   → .0c file updates from upstream
   → Extension detects changes, reloads design state
```

### .0c File in Git

The `.0c` file should be committed to the repo. It is:

- **Small** — JSON, typically under 50KB even for large projects
- **Diffable** — JSON diffs are human-readable in PR reviews
- **Mergeable** — standard JSON merge strategies work (with custom merge driver for conflicts)
- **Meaningful** — provides design context that pure code diffs lack

Recommended `.gitattributes`:
```
*.0c merge=Zeros diff=json
```

---

## 5. VS Code Extension Plan

### Extension Architecture

The extension evolves from its current feedback-dispatch role into a **design workspace orchestrator**:

```
extensions/vscode/
├── src/
│   ├── extension.ts              — Activation, lifecycle, command registration
│   ├── custom-editor-provider.ts — NEW: Custom editor for .0c files
│   ├── dev-server-manager.ts     — NEW: Detect, start, stop dev server
│   ├── websocket-bridge.ts       — NEW: WebSocket server (replaces HTTP polling)
│   ├── file-writer.ts            — NEW: Receives style changes, writes to source files
│   ├── source-map-resolver.ts    — NEW: Maps DOM selectors → source file + line
│   ├── git-abstraction.ts        — NEW: "Save checkpoint" / "Share changes"
│   ├── mcp-server.ts             — NEW: MCP server for AI agent integration
│   ├── agent-dispatch.ts         — EXISTING: Trigger AI agents
│   ├── bridge-client.ts          — DEPRECATED: Replace with WebSocket
│   └── format-feedback.ts        — EXISTING: Markdown formatting
├── package.json
└── tsconfig.json
```

### Custom Editor Provider

The centerpiece of the extension. When a user opens a `.0c` file, instead of showing raw JSON, it triggers the design experience:

```typescript
// custom-editor-provider.ts (conceptual)

class ZerosEditorProvider implements vscode.CustomTextEditorProvider {

  resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
    // Option A: Show a "Launch Canvas" UI in the webview
    // with a big button that opens the browser + starts dev server
    //
    // Option B: Show a project dashboard with:
    //   - Project name, framework, status
    //   - "Open in Browser" button → launches browser with overlay
    //   - Recent checkpoints list
    //   - Pending changes summary
    //   - Connected AI agents
    //
    // The actual design editing happens in the BROWSER, not in this webview.
    // This panel is the control center / dashboard.
  }
}
```

Registration in `package.json`:
```json
{
  "contributes": {
    "customEditors": [{
      "viewType": "Zeros.designEditor",
      "displayName": "Zeros Design Editor",
      "selector": [{ "filenamePattern": "*.0c" }],
      "priority": "default"
    }]
  }
}
```

### Dev Server Manager

```typescript
// dev-server-manager.ts (conceptual)

class DevServerManager {
  // Detect the project's dev command by reading package.json scripts
  detectDevCommand(): string | null {
    // Check for: dev, start, serve, test:ui
    // Return the npm/pnpm/yarn command
  }

  // Start the dev server and return the URL
  async start(): Promise<string> {
    // 1. Find available port
    // 2. Start terminal with dev command
    // 3. Wait for server to be ready (poll localhost)
    // 4. Return URL (e.g. http://localhost:5173)
  }

  // Open the browser with Zeros overlay active
  async openBrowser(url: string) {
    // Open default browser to: url + ?Zeros=active
    // The Zeros library detects the query param and auto-opens
  }
}
```

### WebSocket Bridge

Replaces the old HTTP polling bridge with real-time bidirectional communication:

```typescript
// websocket-bridge.ts (conceptual)

// Messages from Browser → Extension:
type BrowserMessage =
  | { type: "STYLE_CHANGE"; selector: string; property: string; value: string; sourceHint?: string }
  | { type: "TOKEN_CHANGE"; tokenName: string; themeId: string; value: string }
  | { type: "FEEDBACK_ADD"; item: FeedbackItem }
  | { type: "VARIANT_CREATE"; variant: VariantData }
  | { type: "REQUEST_SOURCE_MAP"; selector: string }
  | { type: "SAVE_CHECKPOINT"; label: string }
  | { type: "PROJECT_STATE_SYNC"; state: OCProjectFile }

// Messages from Extension → Browser:
type ExtensionMessage =
  | { type: "SOURCE_MAP_RESULT"; selector: string; file: string; line: number }
  | { type: "FILE_CHANGED"; file: string; content: string }
  | { type: "CHECKPOINT_SAVED"; revision: number }
  | { type: "AGENT_ACTION"; action: string; result: string }
  | { type: "PROJECT_STATE_LOADED"; state: OCProjectFile }
```

### File Writer

The critical component that translates visual changes into source code edits:

```typescript
// file-writer.ts (conceptual)

class FileWriter {
  // Strategy 1: CSS variable changes
  // Designer changes --color-primary → update the CSS file where it's defined
  async writeTokenChange(tokenName: string, value: string, sourceFile: string) {
    // Find the line with the token declaration
    // Replace the value
    // Save the file (triggers Vite HMR)
  }

  // Strategy 2: Inline style changes
  // Designer changes an element's margin → update the component file
  async writeStyleChange(selector: string, property: string, value: string, sourceFile: string) {
    // Depends on the styling approach:
    // - Tailwind: update className with new utility class
    // - CSS Modules: update the .module.css file
    // - Styled Components: update the template literal
    // - Plain CSS: update the stylesheet
    // - Inline styles: update the style prop
  }

  // Strategy 3: Tailwind class changes
  // Designer changes from flex-row to flex-col → update className
  async writeTailwindChange(selector: string, oldClass: string, newClass: string, sourceFile: string) {
    // Find the JSX element by selector
    // Update the className string
  }
}
```

### Git Abstraction

Makes git invisible to designers:

```typescript
// git-abstraction.ts (conceptual)

class GitAbstraction {
  // "Save Checkpoint" — designer-friendly commit
  async saveCheckpoint(label: string) {
    // 1. Stage all modified files (source files + .0c)
    // 2. Generate commit message: "design: {label}"
    // 3. Commit
    // 4. Update .0c revision and integrity hash
  }

  // "Share Changes" — designer-friendly push
  async shareChanges() {
    // 1. Check if branch exists on remote
    // 2. Push
    // 3. Optionally create PR with design context from .0c
  }

  // "Get Latest" — designer-friendly pull
  async getLatest() {
    // 1. Stash any uncommitted changes
    // 2. Pull
    // 3. If conflicts in .0c, use visual merge resolution
    // 4. Apply stashed changes
    // 5. Reload design state
  }
}
```

### Extension Commands (Updated)

```json
{
  "contributes": {
    "commands": [
      { "command": "Zeros.openDesign",      "title": "Zeros: Open Design Canvas" },
      { "command": "Zeros.saveCheckpoint",   "title": "Zeros: Save Checkpoint" },
      { "command": "Zeros.shareChanges",     "title": "Zeros: Share Changes" },
      { "command": "Zeros.getLatest",        "title": "Zeros: Get Latest" },
      { "command": "Zeros.sendToAgent",      "title": "Zeros: Send to AI Agent" },
      { "command": "Zeros.init",             "title": "Zeros: Initialize Project" }
    ]
  }
}
```

---

## 6. Browser Overlay — The Visual Design Engine

### Philosophy

The browser overlay is where designers spend 95% of their time. It must feel like a **design tool** — not a developer tool, not an inspector, not a debugger. Every interaction should feel like Figma, not Chrome DevTools.

### Current Overlay (What Exists)

```
┌─────────────────────────────────────────────────────────┐
│ AppSidebar │ WorkspaceToolbar                           │
│            ├────────────────────────────────────────────┤
│ [Design]   │ VariantCanvas (ReactFlow)  │ StylePanel   │
│ [Themes]   │                            │ (CSS props)  │
│ [Settings] │ SourceNode (iframe)        │              │
│            │                            │ Theme Mode   │
│ [Close]    │                            │ (color       │
│            │                            │  tokens)     │
└────────────┴────────────────────────────┴──────────────┘
```

### Target Overlay (What to Build)

```
┌──────────────────────────────────────────────────────────────────┐
│ Sidebar │ Toolbar: [Select] [Inspect] [Responsive] [AI] [Save]  │
│         ├───────────────────────────────────────────────────────┤
│ [Design]│ Live App Preview (full width)       │ Property Panel  │
│ [Tokens]│ (real browser rendering)            │ (resizable)     │
│ [Pages] │                                     │ ┌─────────────┐│
│ [AI]    │  Click any element →                │ │ Fill        ││
│         │  selection outline +                │ │ [■] #3B82F6 ││
│ ────────│  handles appear                     │ │  ↺ reset    ││
│ [Save   │                                     │ │             ││
│  Check- │  Drag handles →                     │ │ Stroke      ││
│  point] │  resize element                     │ │ [□] none    ││
│         │                                     │ │  ↺ reset    ││
│ [Share  │  Double-click →                     │ │             ││
│  Changes│  edit text inline                   │ │ + Add prop  ││
│  ]      │                                     │ │ (search all ││
│         │  Hover →                            │ │  CSS color  ││
│         │  measurement guides                 │ │  properties)││
│         │                                     │ │             ││
│         │  Alt+hover →                        │ │ ── Changes ─││
│         │  distance measurements              │ │ ① bg: ■→■ ✕││
│         │                                     │ │ ② color: →■ ││
│         │                                     │ │ (click # to ││
│         │                                     │ │  edit inline)││
│         │                                     │ │             ││
│         │                                     │ │ [Copy Prompt]││
│         │                                     │ │ [Clear All] ││
│         │                                     │ └─────────────┘│
└─────────┴─────────────────────────────────────┴────────────────┘
```

**Key changes from v1 layout:**
- **No layers panel** — removed in favor of inspect-first model (see Decision 6)
- **Live preview takes full center width** — more canvas space for designers
- **Property panel includes Changes list** — inline with the editing workflow
- **Reset button per property** — individual undo for each CSS change
- **"+ Add prop" search** — search and apply any CSS property, not just what's already there
- **Clickable change numbers** — click ① to edit that change inline
- **Clear All** — removes all changes and resets design to original state

### Style Panel — Two Tabs: Editor + Code

The right panel has exactly two tabs:

```
┌──────────────────────────────────────┐
│  [ Editor ]  [ Code ]                │
├──────────────────────────────────────┤
│                                      │
│  (Editor = visual design editor)     │
│  (Code   = current raw CSS view)     │
│                                      │
└──────────────────────────────────────┘
```

- **Editor tab**: Full visual design editor (Nordcraft-style) with collapsible sections for every CSS property category. This is where designers work.
- **Code tab**: Raw computed CSS for the selected element (what exists today). This is for developers who want to see/copy the actual CSS.

### Full Visual Editor — Property Sections

Reference: [nordcraftengine/nordcraft](https://github.com/nordcraftengine/nordcraft) + [Nordcraft Style Panel docs](https://docs.nordcraft.com/styling/styles-and-layout)

The Editor tab contains collapsible sections. Each section only shows properties that are **applied** (have non-default values) by default. The `+` button on each section header lets the designer add properties from that category.

```
┌──────────────────────────────────────┐
│  [ Editor ]  [ Code ]                │
├──────────────────────────────────────┤
│                                      │
│  ◉ button.primary           ✕        │  ← Selected element + close
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Search property...        ▼  │    │  ← Search any CSS property
│  └──────────────────────────────┘    │
│                                      │
│  CSS Variables                   +   │  ← Token overrides for this element
│  ─────────────────────────────────   │
│                                      │
│  ▾ Size                          +   │
│    Width  100%      Height  auto     │
│    ┌── margin ──────────────────┐    │
│    │      ┌──16──┐              │    │
│    │   8  │      │  8           │    │
│    │      └──16──┘              │    │
│    └────────────────────────────┘    │
│    ┌── padding ─────────────────┐    │
│    │      ┌──12──┐              │    │
│    │  16  │      │  16          │    │
│    │      └──12──┘              │    │
│    └────────────────────────────┘    │
│  ─────────────────────────────────   │
│                                      │
│  ▾ Layout                        +   │
│    Display  [Flex] [Inline] [None]▼  │
│    ↓  →│  (direction + wrap)         │
│    ┌─────────────────┐               │
│    │  ≡  alignment   │  (9-dot grid) │
│    │  ·  ·  ·        │               │
│    │  ·  ·  ·        │               │
│    └─────────────────┘               │
│    |00  0|0  0|0  (justify presets)  │
│    |0|  -  🔗  (align + link)        │
│    Gap  8                            │
│  ─────────────────────────────────   │
│                                      │
│  ▾ Position                      +   │
│    [Absolute] [Static] [Sti...]  ▼   │
│    z-index  0                        │
│    Overflow  hidden                  │
│  ─────────────────────────────────   │
│                                      │
│  ▾ Text                          +   │
│    Font  -                           │
│    𝔄  -  (weight + style)            │
│    Size  -    Height  -              │
│    Align  [L] [C] [R] [J]           │
│    Spacing  -                        │
│    Transform  [Aa] [AA] [aa]         │
│    Decoration  -                     │
│    Overflow  -                       │
│  ─────────────────────────────────   │
│                                      │
│  ▾ Background                    +   │
│    ┌──┐  #000                   −    │
│    └──┘                              │
│    (+ add gradient / image)          │
│  ─────────────────────────────────   │
│                                      │
│  ▾ Effects                       +   │
│    ┌┐┘ .5  (opacity)            −    │
│    (+ add filter, backdrop-filter)   │
│    cursor  -                         │
│    pointer-events  -                 │
│  ─────────────────────────────────   │
│                                      │
│  ▾ Borders                       +   │
│    Width  -  Style  -  Color  -      │
│    Radius  -                    ⌜⌝   │
│    (corner-by-corner toggle)         │
│  ─────────────────────────────────   │
│                                      │
│  ▾ Transform                     +   │
│    (translate, rotate, scale, skew)  │
│  ─────────────────────────────────   │
│                                      │
│  ▾ Animation                     +   │
│    (name, duration, timing, fill)    │
│  ─────────────────────────────────   │
│                                      │
│  ▾ Transition                    +   │
│    (property, duration, timing,      │
│     delay)                           │
│  ─────────────────────────────────   │
│                                      │
│  7 properties          📋  ⊕  css    │  ← Footer: count, copy, add, raw
│                                      │
└──────────────────────────────────────┘
```

### Property Section Details

Each section maps to a set of CSS properties. Based on Nordcraft's architecture, **styles are stored as a flat `Record<string, string>`** — the section grouping is purely a UI concern.

#### Size Section

| Control | CSS Properties | Editor Type |
|---------|---------------|-------------|
| Width / Height | `width`, `height` | Number input with unit dropdown (px, %, vh, vw, auto, fit-content) |
| Min/Max | `min-width`, `max-width`, `min-height`, `max-height` | Same as above (collapsed by default, show via +) |
| Margin | `margin-top`, `margin-right`, `margin-bottom`, `margin-left` | Visual box model editor — click any side to edit, shift+click for symmetric |
| Padding | `padding-top`, `padding-right`, `padding-bottom`, `padding-left` | Same as margin, nested inside |

**Visual box model editor:**
```
         ┌────── margin ──────┐
         │     ┌── 16 ──┐     │
         │  8  │ padding │  8  │     Click any number to edit
         │     │  ┌──┐   │     │     Scroll to scrub value
         │     │  │  │   │     │     Shift+click = all sides
         │     │  └──┘   │     │     Token suggestions on edit
         │     └── 16 ──┘     │
         └────────────────────┘
```

#### Layout Section

| Control | CSS Properties | Editor Type |
|---------|---------------|-------------|
| Display | `display` | Segmented buttons: Flex / Block / Inline / Grid / None + dropdown for more |
| Direction | `flex-direction` | Arrow buttons: ↓ (column) →│ (row) + wrap toggle |
| Alignment | `justify-content`, `align-items` | **9-dot grid** — click position to set both at once (Nordcraft pattern) |
| Justify presets | `justify-content` | Icon buttons: \|00 (start) 0\|0 (center) 00\| (end) 0-0 (space-between) |
| Align presets | `align-items` | Icon buttons: similar to justify |
| Gap | `gap`, `column-gap`, `row-gap` | Number input with unit, link icon to sync row/column |
| Flex child | `flex-grow`, `flex-shrink`, `align-self` | Shown when selected element is inside a flex parent |

**9-dot alignment grid (Nordcraft's signature control):**
```
┌─────────────┐
│  ·  ·  ·    │  Top row:    start / center / end
│  ·  ●  ·    │  Middle row: start / center / end
│  ·  ·  ·    │  Bottom row: start / center / end
└─────────────┘
● = current selection (center/center)
Click any dot → sets justify-content + align-items together
```

#### Position Section

| Control | CSS Properties | Editor Type |
|---------|---------------|-------------|
| Position | `position` | Segmented buttons: Static / Relative / Absolute / Fixed / Sticky |
| Offsets | `top`, `right`, `bottom`, `left` | Number inputs (only shown for non-static positions) |
| Z-index | `z-index` | Number input |
| Overflow | `overflow`, `overflow-x`, `overflow-y` | Dropdown: visible / hidden / scroll / auto |

#### Text Section

| Control | CSS Properties | Editor Type |
|---------|---------------|-------------|
| Font family | `font-family` | Dropdown with project fonts + Google Fonts |
| Font weight | `font-weight` | Dropdown: 100-900 / Thin-Black |
| Font size | `font-size` | Number input with unit |
| Line height | `line-height` | Number input with unit |
| Letter spacing | `letter-spacing` | Number input |
| Text align | `text-align` | Segmented buttons: [L] [C] [R] [J] |
| Text transform | `text-transform` | Segmented buttons: [Aa] [AA] [aa] |
| Text decoration | `text-decoration` | Dropdown: none / underline / line-through |
| White space | `white-space` | Dropdown (collapsed by default) |
| Word break | `word-break` | Dropdown (collapsed by default) |
| Color | `color` | Color swatch + picker (with token suggestions) |

#### Background Section

| Control | CSS Properties | Editor Type |
|---------|---------------|-------------|
| Color | `background-color` | Color swatch + picker with token suggestions |
| Image | `background-image` | URL input or gradient editor |
| Gradient | `background-image: linear-gradient(...)` | Visual gradient editor with stops |
| Size | `background-size` | Dropdown: cover / contain / custom |
| Position | `background-position` | Dropdown or XY inputs |
| Repeat | `background-repeat` | Dropdown: repeat / no-repeat / repeat-x / repeat-y |

Multiple backgrounds supported via `+` button (add layers).

#### Effects Section

| Control | CSS Properties | Editor Type |
|---------|---------------|-------------|
| Opacity | `opacity` | Slider 0-1 |
| Box shadow | `box-shadow` | X, Y, blur, spread number inputs + color swatch. Multiple shadows via `+` |
| Filter | `filter` | Dropdown: blur, brightness, contrast, etc. with value slider |
| Backdrop filter | `backdrop-filter` | Same as filter |
| Cursor | `cursor` | Dropdown: pointer / default / grab / text / etc. |
| Pointer events | `pointer-events` | Dropdown: auto / none |

#### Borders Section

| Control | CSS Properties | Editor Type |
|---------|---------------|-------------|
| Border width | `border-width` (per side) | Number input, lock icon for uniform |
| Border style | `border-style` | Dropdown: solid / dashed / dotted / none |
| Border color | `border-color` | Color swatch + picker |
| Border radius | `border-radius` (per corner) | Number input, lock icon for uniform, visual corner preview |
| Outline | `outline-width`, `outline-style`, `outline-color` | Same pattern (collapsed by default) |

**Visual corner radius editor:**
```
┌ 8 ─────── 8 ┐
│              │     Click lock icon ⌜⌝ to toggle
│              │     uniform vs per-corner editing
└ 8 ─────── 8 ┘
```

#### Transform Section

| Control | CSS Properties | Editor Type |
|---------|---------------|-------------|
| Translate | `translate` or `transform: translate()` | X, Y number inputs |
| Rotate | `rotate` or `transform: rotate()` | Angle input with visual dial |
| Scale | `scale` or `transform: scale()` | X, Y number inputs (1 = 100%) |
| Skew | `transform: skew()` | X, Y angle inputs |
| Transform origin | `transform-origin` | 9-dot grid or XY inputs |

#### Animation Section

| Control | CSS Properties | Editor Type |
|---------|---------------|-------------|
| Animation name | `animation-name` | Dropdown of defined @keyframes |
| Duration | `animation-duration` | Time input (ms/s) |
| Timing | `animation-timing-function` | Dropdown: ease / linear / ease-in-out + cubic-bezier editor |
| Delay | `animation-delay` | Time input |
| Fill mode | `animation-fill-mode` | Dropdown: none / forwards / backwards / both |
| Iteration | `animation-iteration-count` | Number input or "infinite" |

#### Transition Section

| Control | CSS Properties | Editor Type |
|---------|---------------|-------------|
| Property | `transition-property` | Multi-select dropdown of CSS properties |
| Duration | `transition-duration` | Time input (ms/s) |
| Timing | `transition-timing-function` | Dropdown + cubic-bezier visual editor |
| Delay | `transition-delay` | Time input |

### Search Property — Global CSS Property Search

At the top of the Editor tab, a search input lets designers type any CSS property name:

```
┌──────────────────────────────┐
│ Search property...        ▼  │
├──────────────────────────────┤
│ Results:                     │
│ background-blend-mode        │
│ mix-blend-mode               │
│ isolation                    │
│ ...                          │
└──────────────────────────────┘
```

- Searching jumps to the section containing that property and highlights it
- If the property isn't in any section, it opens the **Advanced** freeform input (key:value escape hatch for any CSS property)
- Property names autocomplete using keyword data from the [mdn-data](https://github.com/mdn/data) npm package (same approach as Nordcraft)

### CSS Variables Section

Sits between the search bar and the first section. Shows custom properties applied to or inherited by the selected element:

```
CSS Variables                              +
──────────────────────────────────────────
--color-primary    ■ #3B82F6    ↺ reset
--spacing-md         16px       ↺ reset
```

The `+` button opens a dropdown of all available tokens from imported theme files to add a new override.

### Data Model — Flat Storage, UI Categorization

Following Nordcraft's pattern, styles are stored as a **flat `Record<string, string>`** in both the runtime state and the .0c file. The section grouping (Size, Layout, Text, etc.) is purely a UI concern in the editor — it does not affect storage.

```typescript
// How a selected element's styles are stored
type ElementStyles = Record<string, string>;

// Example:
{
  "width": "100%",
  "height": "auto",
  "display": "flex",
  "flex-direction": "column",
  "gap": "8px",
  "background-color": "var(--color-primary)",
  "border-radius": "8px"
}

// The editor maps each property to its section:
const SECTION_MAP: Record<string, string> = {
  "width": "size", "height": "size", "margin-top": "size", ...
  "display": "layout", "flex-direction": "layout", "gap": "layout", ...
  "position": "position", "z-index": "position", "overflow": "position", ...
  "font-family": "text", "font-size": "text", "color": "text", ...
  "background-color": "background", "background-image": "background", ...
  "opacity": "effects", "box-shadow": "effects", "filter": "effects", ...
  "border-width": "borders", "border-radius": "borders", ...
  "transform": "transform", ...
  "animation-name": "animation", ...
  "transition-property": "transition", ...
};
```

### Input Controls Reference

Every numeric value in the editor uses the same base control:

| Control | Behavior |
|---------|----------|
| **Number input** | Type value directly. Scroll wheel to scrub ±1 (±10 with Shift, ±0.1 with Alt). |
| **Unit dropdown** | px / % / em / rem / vh / vw / auto / fit-content. Click to cycle, dropdown for full list. |
| **Color swatch** | Small colored square. Click → opens full color picker with HSL spectrum, hex/rgb/hsl inputs, opacity, token suggestions. |
| **Segmented buttons** | Mutually exclusive options (like display modes, text-align). Click to select. |
| **Dropdown** | Standard select for keyword values (overflow, cursor, font-weight). Searchable for long lists. |
| **Slider** | For 0-1 ranges (opacity) or angles (rotation). Drag or click. |
| **9-dot grid** | Nordcraft's alignment control. Click a dot to set two properties at once. |
| **Visual box model** | Nested rectangles for margin/padding. Click any side to edit. |

### Interaction Patterns

| Interaction | Behavior |
|-------------|----------|
| **Single click** | Select element, show selection outline + handles, open property panel |
| **Double click** | Enter text editing mode (contentEditable) |
| **Hover** | Show element name tooltip + measurement guides to nearby elements |
| **Drag handle** | Resize element (updates width/height) |
| **Alt + hover** | Show distance measurements from selected element to hovered element |
| **Cmd/Ctrl + click** | Multi-select elements |
| **Arrow keys** | Move selected element (updates margin/position) |
| **Shift + arrow** | Move by 10px increments |
| **Cmd/Ctrl + Z** | Undo last change |
| **Cmd/Ctrl + Shift + Z** | Redo |
| **Scroll in property field** | Scrub numeric value up/down |
| **Tab in property field** | Move to next input |
| **Cmd/Ctrl + S** | Search property (focus search input) |

### Design Token Integration

When a designer changes a value, the overlay should:

1. Check if the current value comes from a design token (CSS variable)
2. If yes, offer to change the token value (affects all uses) or override locally
3. If no, suggest matching tokens from the design system
4. If the designer enters a raw value, show a warning: "This value isn't in your design system. Create a token?"

This enforces design system consistency without blocking the designer.

### Style Editor Modes — Main App vs Variants

The full style editor works in **both** the main app and variants. The UI is identical — same 11 sections, same controls, same interactions. The difference is where changes are written.

#### Main App Mode — The Style Editor IS the Feedback Tool

In the main app, every style change the designer makes becomes **structured feedback** — not vague text comments, but precise CSS property changes with before/after values and token references.

```
Designer clicks element in main app
        │
        ▼
Style editor opens with all computed styles (11 sections)
        │
        ▼
Designer changes background-color via color picker
        │
        ├──→ Inline style applied to iframe DOM (instant visual feedback)
        │
        └──→ ChangeItem recorded in state + saved to .0c:
             {
               element: ".hero",
               property: "background-color",
               old: "rgba(0,0,0,0)" → new: "var(--color-base-900)",
               token: "--color-base-900"
             }
        │
        ▼
Changes list shows ① ② ③ with before → after
        │
        ├──→ "Copy Prompt" → structured markdown for AI agent
        └──→ "Apply to Source" → VS Code extension writes to files (future)
```

**Why this is better than text feedback:**

```
Old feedback (text):
  "Make the hero section darker and the text bigger"
  → Vague. Developer guesses. Multiple rounds of review.

New feedback (visual changes):
  ① .hero  background-color  ■ → ■  --color-base-900
  ② .hero h1  font-size  32px → 48px
  ③ .hero h1  font-weight  400 → 700
  ④ .hero p  color  ■ → ■  --color-text-muted
  → Exact. AI agent executes precisely. One round.
```

The designer never writes text feedback. They just design. The system captures what they did.

#### Variant Mode — Free Sandbox Editing

In variants, changes are written directly to the variant's own CSS copy. The designer experiments freely without affecting the main app.

```
Designer forks a component → variant created
        │
        ▼
Style editor opens — same UI, same 11 sections
        │
        ▼
Designer changes styles freely
        │
        └──→ Written directly to variant.modifiedCss
             (variant has its own copy — no consequences)
        │
        ▼
Compare variant vs original side-by-side on canvas
        │
        ▼
Happy → "Finalize" → changes extracted as ChangeItems
        → Same structured feedback output as main app mode
```

#### Mode Indicator in the Panel

The style editor shows a subtle mode banner at the top so the designer always knows context:

```
Main app mode:                          Variant mode:
┌────────────────────────────┐          ┌────────────────────────────┐
│ ◉ .hero-section        ✕   │          │ ◉ .hero-section        ✕   │
│ Changes tracked (3)        │          │ Editing: "Dark hero v2"    │
│ [Copy Prompt] [Clear All]  │          │ [Finalize] [Reset]         │
├────────────────────────────┤          ├────────────────────────────┤
│ ▾ Size ...                 │          │ ▾ Size ...                 │
│ ▾ Layout ...               │          │ ▾ Layout ...               │
└────────────────────────────┘          └────────────────────────────┘
```

#### Behavior Comparison

| Behavior | Main App | Variant |
|----------|----------|---------|
| **Style editor UI** | Full editor (all 11 sections) | Same full editor |
| **Changes visible** | Yes — inline style on iframe DOM | Yes — variant's own CSS |
| **Where changes are stored** | `themeChanges[]` / `changeItems[]` in .0c | `variant.modifiedCss` in .0c |
| **Survives dev server rebuild** | Yes — .0c persists, re-applied on load | Yes — .0c persists variant data |
| **Output for AI** | Structured ChangeItems → "Copy Prompt" | Same, after "Finalize" |
| **Reset behavior** | Remove individual change → inline style reverts | "Reset" → variant returns to original |
| **Side-by-side comparison** | N/A (changes are on the live app) | Variant card next to source node on canvas |
| **Multiple iterations** | Changes accumulate in one list | Fork multiple variants to compare |

#### Re-applying Changes on Rebuild

When the dev server restarts, the main app reloads fresh (no inline styles). The .0c file still has all the ChangeItems. The overlay re-applies them:

```
Dev server restarts → iframe reloads fresh DOM
        │
        ▼
Overlay reads .0c from IndexedDB
        │
        ▼
For each saved ChangeItem:
  1. Find element by selector in new DOM
  2. Re-apply inline style override
  3. Designer sees all their changes restored
        │
        ▼
Changes list still shows ① ② ③ — nothing lost
```

This is why dual persistence (.0c + IndexedDB) matters — the designer's work survives any rebuild.

---

## 7. Variant & Changeset Architecture

### Why This Matters

When a designer makes visual changes, those changes must eventually reach production code with **pixel-perfect precision**. The storage format determines whether an AI agent or developer gets vague instructions ("here's some modified HTML") or exact instructions ("change `.hero h1` font-size from 32px to 48px").

### Current Problem — HTML/CSS Blob Storage

The current `VariantData` stores raw HTML/CSS strings:

```typescript
// Current (problematic)
type VariantData = {
  html: string;          // full HTML snapshot of original
  css: string;           // full CSS snapshot of original
  modifiedHtml?: string; // full HTML after changes
  modifiedCss?: string;  // full CSS after changes
};
```

This works for **previewing** but fails for **production push** because:

| Problem | Impact |
|---------|--------|
| Can't tell what changed | Entire HTML blob, change is buried inside |
| Can't map to source files | No connection between change and `Hero.tsx:42` |
| AI gets imprecise prompt | "Here's 500 lines of HTML" vs "change this one property" |
| Can't undo one change | Must revert entire variant |
| Merge conflicts impossible | Two designers change same variant = unresolvable blob conflict |

### Industry Research — How Others Solve This

| Tool | Storage Format | Key Insight |
|------|---------------|-------------|
| **Onlook** | Typed Action union (`UpdateStyleAction`, `InsertElementAction`, `EditTextAction`) with original + updated values per property. Uses `data-oid` for source mapping. | **Structured changesets with source pointers** |
| **Nordcraft** | Base `Record<string, string>` + `StyleVariant[]` array where each variant is a condition + style diff | **Base style + conditional overrides** |
| **Builder.io** | Component tree with per-breakpoint style objects. Build-time instrumentation maps pixels to source lines. | **Typed component tree + source instrumentation** |
| **Pencil.dev** | `.pen` JSON tree with typed objects (rectangle, frame, text) and properties. Code generation is a separate step. | **Design-native format, code gen is export** |

**The pattern is clear: every production-grade tool uses structured changesets, not HTML/CSS blobs.**

### The Solution — Hybrid: Changesets + Snapshots

```
┌─────────────────────────────────────────────────────────────┐
│                     Variant Storage                          │
│                                                             │
│  LAYER 1: CHANGESET (source of truth)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ changes: [                                          │    │
│  │   { type: "style", selector: ".hero",               │    │
│  │     property: "background-color",                   │    │
│  │     original: "rgba(0,0,0,0)",                      │    │
│  │     new: "var(--color-base-900)",                   │    │
│  │     token: "--color-base-900" },                    │    │
│  │   { type: "style", selector: ".hero h1",            │    │
│  │     property: "font-size",                          │    │
│  │     original: "32px", new: "48px" },                │    │
│  │   { type: "insert", parent: ".hero",                │    │
│  │     position: "after:.hero h1",                     │    │
│  │     element: { tag: "div", class: "hero-badge",     │    │
│  │       text: "New", styles: { ... } } },             │    │
│  │   { type: "text", selector: ".hero p",              │    │
│  │     original: "Welcome", new: "Start building" }    │    │
│  │ ]                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  LAYER 2: SNAPSHOT (for preview — derived from changeset)   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ snapshot: {                                         │    │
│  │   html: "<div class='hero'>...</div>",              │    │
│  │   css: ".hero { background: ... }"                  │    │
│  │ }                                                   │    │
│  │ (regenerated by applying changeset to base DOM)     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  LAYER 3: SOURCE MAP (future — for direct code push)        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ sourceMappings: [{                                  │    │
│  │   selector: ".hero",                                │    │
│  │   filePath: "src/components/Hero.tsx",              │    │
│  │   line: 42,                                         │    │
│  │   framework: "tailwind"                             │    │
│  │ }]                                                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**The changeset is the source of truth. The snapshot is derived. The source map enables code push.**

### The Unified DesignChange Type

One type system for ALL changes — style edits, new elements, text changes, removals, moves, and attribute edits. Works identically in main app mode (feedback) and variant mode (sandbox).

```typescript
type DesignChange =
  | {
      // ── STYLE CHANGE ──────────────────────────────────
      // Designer changes a CSS property value
      type: "style";
      id: string;
      elementSelector: string;
      elementTag: string;
      elementClasses: string[];
      property: string;              // "background-color", "font-size", etc.
      originalValue: string;         // computed value before change
      newValue: string;              // new value
      originalToken?: string;        // if value came from a CSS variable
      newToken?: string;             // if mapped to a design token
      sourceType: "rule" | "inline" | "inherited";
      timestamp: number;
    }
  | {
      // ── INSERT ELEMENT ─────────────────────────────────
      // Designer adds a new div, button, section, etc.
      type: "insert";
      id: string;
      parentSelector: string;        // where to insert
      position: string;              // "before:.sibling" | "after:.sibling" | "first" | "last"
      element: {
        tag: string;                 // "div", "button", "section", "img", etc.
        className: string;           // auto-generated or designer-named
        text?: string;               // initial text content
        styles: Record<string, string>;  // initial CSS properties
        attributes?: Record<string, string>;  // href, src, alt, etc.
        children?: {                 // nested elements
          tag: string;
          className: string;
          text?: string;
          styles: Record<string, string>;
        }[];
      };
      timestamp: number;
    }
  | {
      // ── REMOVE ELEMENT ─────────────────────────────────
      // Designer deletes an element
      type: "remove";
      id: string;
      elementSelector: string;
      removedSnapshot: string;       // full HTML of removed element (for undo)
      timestamp: number;
    }
  | {
      // ── MOVE ELEMENT ───────────────────────────────────
      // Designer drags an element to a new position
      type: "move";
      id: string;
      elementSelector: string;
      fromParent: string;            // original parent selector
      fromPosition: number;          // original index in parent
      toParent: string;              // new parent selector
      toPosition: string;            // "before:.sibling" | "after:.sibling" | index
      timestamp: number;
    }
  | {
      // ── TEXT CHANGE ────────────────────────────────────
      // Designer edits text content (double-click to edit)
      type: "text";
      id: string;
      elementSelector: string;
      originalText: string;
      newText: string;
      timestamp: number;
    }
  | {
      // ── ATTRIBUTE CHANGE ───────────────────────────────
      // Designer changes an HTML attribute
      type: "attribute";
      id: string;
      elementSelector: string;
      attribute: string;             // "href", "src", "alt", "placeholder", etc.
      originalValue: string;
      newValue: string;
      timestamp: number;
    };
```

### Updated VariantData Type

```typescript
type VariantData = {
  id: string;
  name: string;
  sourceType: "page" | "component";
  sourceElementId?: string | null;
  sourceSelector?: string;
  sourcePageRoute?: string;
  parentId: string | null;          // null = forked from source
                                     // "variant-abc" = forked from another variant
  status: "draft" | "finalized" | "sent" | "pushed";
  createdAt: number;
  sourceViewportWidth?: number;
  sourceContentHeight?: number;

  // LAYER 1: Changeset — the actual changes (source of truth)
  changes: DesignChange[];

  // LAYER 2: Snapshot — for preview rendering (derived from changes)
  snapshot: {
    html: string;
    css: string;
  };

  // LAYER 3: Source mappings (future — for direct code push)
  sourceMappings?: {
    elementSelector: string;
    filePath: string;
    line: number;
    framework: string;
  }[];
};
```

### How Each Change Type Works in the Editor

#### Style Changes (click element → edit in property panel)

```
Designer clicks .hero in variant preview
        │
        ▼
Style editor opens with computed styles (all 11 sections)
        │
        ▼
Designer changes background-color via color picker
        │
        ├──→ changes.push({
        │      type: "style",
        │      elementSelector: ".hero",
        │      property: "background-color",
        │      originalValue: "rgba(0,0,0,0)",
        │      newValue: "var(--color-base-900)",
        │      newToken: "--color-base-900"
        │    })
        │
        ├──→ Inline style applied to variant iframe (instant preview)
        │
        └──→ Snapshot regenerated
```

#### Insert Element (add new div, button, section, etc.)

```
Designer clicks "+ Add Element" button in variant toolbar
        │
        ▼
Element picker appears:
  [div] [section] [button] [a] [img] [span] [h1-h6] [p] [ul/ol]
        │
        ▼
Designer picks "div", drops it after .hero h1
        │
        ▼
System generates class name:
  Context: parent=.hero, after=h1, tag=div
  → Suggested: "hero-badge"
  → Designer can rename
        │
        ▼
New element appears in variant preview (editable)
        │
        ▼
Designer styles it using the same property panel:
  background-color: var(--color-primary)
  padding: 4px 12px
  border-radius: 9999px
  font-size: 12px
        │
        ▼
changes.push({
  type: "insert",
  parentSelector: ".hero",
  position: "after:.hero h1",
  element: {
    tag: "div",
    className: "hero-badge",
    text: "New",
    styles: {
      "background-color": "var(--color-primary)",
      "padding": "4px 12px",
      "border-radius": "9999px",
      "font-size": "12px"
    }
  }
})
```

#### Auto-Generated Class Names

When a designer creates a new element, the system generates a semantic class name:

| Strategy | When Used | Example |
|----------|-----------|---------|
| **Semantic** (preferred) | Parent context + element role | `.hero` + badge → `.hero-badge` |
| **Designer-named** | Designer types a name | Prompt: "Name?" → `.promo-tag` |
| **Scoped fallback** | Can't determine context | `.oc-{variantId short}-{index}` |

The generated class + styles become real CSS. The AI agent writes the class to a stylesheet and inserts the HTML at the correct position in the component file.

#### Remove Element

```
Designer right-clicks element in variant → "Remove"
        │
        ▼
Element removed from variant DOM
        │
        ▼
changes.push({
  type: "remove",
  elementSelector: ".hero .old-badge",
  removedSnapshot: "<span class='old-badge'>Beta</span>"  // for undo
})
        │
        ▼
Snapshot regenerated without the element
```

#### Move Element (drag to reorder)

```
Designer drags .hero-cta from inside .hero-content to after .hero h1
        │
        ▼
changes.push({
  type: "move",
  elementSelector: ".hero-cta",
  fromParent: ".hero-content",
  fromPosition: 2,
  toParent: ".hero",
  toPosition: "after:.hero h1"
})
        │
        ▼
DOM updated in variant preview, snapshot regenerated
```

#### Text Change (double-click to edit)

```
Designer double-clicks "Welcome to our app" text
        │
        ▼
Text becomes editable (contentEditable)
        │
        ▼
Designer types "Start building today"
        │
        ▼
changes.push({
  type: "text",
  elementSelector: ".hero p",
  originalText: "Welcome to our app",
  newText: "Start building today"
})
```

#### Attribute Change

```
Designer selects an <img>, changes src in attribute editor
        │
        ▼
changes.push({
  type: "attribute",
  elementSelector: ".hero img",
  attribute: "src",
  originalValue: "/old-hero.jpg",
  newValue: "/new-hero.jpg"
})
```

### Feedback Tool Inside Variants

The same style editor and change tracking system works inside variants. A variant is just another canvas the designer can inspect and modify:

```
┌───────────────────────────────────────────────────────────┐
│                    Variant Canvas                          │
│                                                           │
│  ┌──────────────┐            ┌──────────────────────────┐ │
│  │ Source Node   │            │ Variant: "Dark hero v2"  │ │
│  │ (original)    │     →     │                          │ │
│  │              │            │  Designer clicks any     │ │
│  │              │            │  element here →           │ │
│  │              │            │  same style editor opens  │ │
│  │              │            │  same property sections   │ │
│  │              │            │  same color pickers       │ │
│  │              │            │  same token suggestions   │ │
│  │              │            │                          │ │
│  │              │            │  + can add new elements   │ │
│  │              │            │  + can remove elements    │ │
│  │              │            │  + can edit text          │ │
│  │              │            │  + can reorder elements   │ │
│  └──────────────┘            └──────────────────────────┘ │
│                                                           │
│  All changes → variant.changes[]                          │
│  All changes → saved to .0c                               │
│  All changes → survive rebuild                            │
└───────────────────────────────────────────────────────────┘
```

### Variant-on-Variant — Nested Iterations

Designers can fork a variant to try different directions without losing the parent work. The `parentId` field creates a tree:

```
Source (main app)
  │
  ├── Variant A: "Dark hero"
  │   changes: [bg → dark, text → white]
  │   │
  │   ├── Variant A1: "Dark hero + badge"
  │   │   parentId: "variant-A"
  │   │   changes: [+ insert badge element]
  │   │   (inherits A's changes + adds its own)
  │   │
  │   └── Variant A2: "Dark hero + gradient"
  │       parentId: "variant-A"
  │       changes: [bg → gradient instead of solid]
  │       (inherits A's changes + overrides bg)
  │
  └── Variant B: "Compact hero"
      changes: [padding reduced, font smaller]
      (independent from A — different direction)
```

Each child variant stores **only its own changes**, not the parent's. To render a child variant:

```
Render Variant A1:
  1. Start with source DOM
  2. Apply Variant A changes (bg → dark, text → white)
  3. Apply Variant A1 changes (+ insert badge)
  4. Result: dark hero with badge
```

#### How the Style Editor Shows Inheritance

When editing a child variant, the style editor distinguishes between inherited and local changes:

```
┌────────────────────────────────────┐
│ ◉ .hero            ✕               │
│ Variant: "Dark hero + badge"       │
│ Inherits from: "Dark hero"         │
├────────────────────────────────────┤
│                                    │
│  ▾ Background                      │
│    ┌──┐  var(--color-base-900)     │
│    └──┘  ↰ inherited from "Dark   │  ← Dimmed, shows origin
│            hero"                   │     Click to override locally
│                                    │
│  ▾ Text                            │
│    Color  var(--color-text-on-dark)│
│           ↰ inherited              │  ← Also inherited
│                                    │
│  ── Local Changes (this variant) ──│
│                                    │
│  ▾ New Elements                    │
│    + .hero-badge (inserted)        │  ← This variant's own change
│                                    │
└────────────────────────────────────┘
```

### What "Copy Prompt" Generates

The changeset produces structured, precise AI prompts for every change type:

````markdown
## Variant: "Dark hero + badge"
Based on: source (/)

### Style Changes
1. `.hero` background-color: rgba(0,0,0,0) → var(--color-base-900)
2. `.hero h1` color: rgb(31,42,36) → var(--color-text-on-dark)
3. `.hero h1` font-size: 32px → 48px

### New Elements
4. Insert after `.hero h1`:
   ```html
   <div class="hero-badge">New</div>
   ```
   Styles for `.hero-badge`:
   - background-color: var(--color-primary)
   - padding: 4px 12px
   - border-radius: 9999px
   - font-size: 12px
   - color: var(--color-text-on-primary)

### Text Changes
5. `.hero p` → "Start building today" (was: "Welcome to our app")

### Attribute Changes
6. `.hero img` src → "/new-hero.jpg" (was: "/old-hero.jpg")

### Removed Elements
7. Removed `.hero .old-badge` (was: `<span class="old-badge">Beta</span>`)
````

An AI agent can execute every line of this precisely. A developer can review it instantly. No ambiguity.

### Comparison: Old vs New Prompt Output

```
OLD (HTML blob):
  "Here's the modified variant HTML (487 lines):
   <div class='hero' style='background:...'> ... </div>"
  → AI must diff 487 lines to find what changed
  → Developer can't review quickly
  → Imprecise, error-prone

NEW (structured changeset):
  "7 changes to .hero section:
   3 style changes, 1 insert, 1 text, 1 attribute, 1 removal"
  → AI executes each change atomically
  → Developer reviews a clear list
  → Precise, auditable, undoable
```

### How Changesets Map to the .0c File

In the .0c project file, variants store their full changeset:

```json
{
  "variants": [{
    "id": "variant-abc123",
    "name": "Dark hero + badge",
    "parentId": null,
    "status": "draft",
    "changes": [
      {
        "type": "style",
        "id": "chg-1",
        "elementSelector": ".hero",
        "property": "background-color",
        "originalValue": "rgba(0,0,0,0)",
        "newValue": "var(--color-base-900)",
        "newToken": "--color-base-900",
        "timestamp": "2026-04-12T10:30:00Z"
      },
      {
        "type": "insert",
        "id": "chg-4",
        "parentSelector": ".hero",
        "position": "after:.hero h1",
        "element": {
          "tag": "div",
          "className": "hero-badge",
          "text": "New",
          "styles": {
            "background-color": "var(--color-primary)",
            "padding": "4px 12px",
            "border-radius": "9999px"
          }
        },
        "timestamp": "2026-04-12T10:32:00Z"
      }
    ],
    "snapshot": {
      "html": "<div class='hero'>...</div>",
      "css": ".hero { ... } .hero-badge { ... }"
    }
  }]
}
```

The changeset is small, diffable in git, and mergeable. Two designers working on different variants produce clean, non-conflicting JSON.

### Undo/Redo with Changesets

Because every change is an atomic entry in the `changes[]` array, undo/redo is trivial:

```
Undo:
  1. Pop last entry from changes[]
  2. If style change → revert inline style to originalValue
  3. If insert → remove the element from DOM
  4. If remove → re-insert from removedSnapshot
  5. If text → revert to originalText
  6. Regenerate snapshot

Redo:
  1. Push entry back to changes[]
  2. Re-apply the change
  3. Regenerate snapshot
```

Individual changes can also be removed from anywhere in the list (not just the last one), enabling selective undo: "Keep the color change but undo the font-size change."

---

## 8. Themes Module — Design Token Engine (Killer Feature)

### Why This Is the Differentiator

Most design-to-code tools generate code from designs. Zeros does the opposite: it lets designers **change production code visually through design tokens**. The Themes module is the engine that makes this possible.

No other tool in the competitive landscape offers this exact workflow: open a real CSS file with design tokens → see them visualized → change them visually → write back to the source file surgically. This is the feature that makes "pull, design, push" real.

### Current Architecture

The Themes system is **bifurcated** into two complementary subsystems:

```
┌────────────────────────────────────────────────────────────────┐
│  1. THEME MODE (Inspector Integration)                         │
│     Real-time visual inspection + inline style changes         │
│                                                                │
│  User flow:                                                    │
│  Click "Theme" in toolbar → Select element → See color props   │
│  → Pick new color from token palette → Change applied inline   │
│  → Change tracked in state.themeChanges → Copy Prompt for AI   │
│                                                                │
│  Key files:                                                    │
│  - theme-mode-panel.tsx    (token palette + changes list)      │
│  - theme-color-resolver.ts (computed style → token resolution) │
│  - inspector detail panel  (color swatches + picker trigger)   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  2. THEMES PAGE (Token Editor)                                 │
│     Declarative token editing + file sync                      │
│                                                                │
│  User flow:                                                    │
│  Navigate to Themes page → Add CSS file → See token table      │
│  → Edit values in cells → Color picker for color tokens        │
│  → Click "Sync" to write back to CSS file                      │
│                                                                │
│  Key files:                                                    │
│  - themes-page.tsx         (table editor UI)                   │
│  - css-token-parser.ts     (CSS → token extraction)            │
└────────────────────────────────────────────────────────────────┘
```

### CSS Parsing Engine (css-token-parser.ts)

The parser achieves production-grade precision:

| Capability | Implementation |
|-----------|---------------|
| Block extraction | Strips comments, tracks line numbers, matches braces, extracts selectors + declarations |
| Theme detection | `:root` → "default", `[data-theme="light"]` → "light", `.theme-dark` → "dark", `prefers-color-scheme` → auto |
| Custom property extraction | Regex: `/(--[\w-]+)\s*:\s*([^;]+);/g` per block |
| Syntax detection | Classifies each token as color / length-percentage / percentage / number / angle / time / * |
| var() resolution | Resolves var() chains up to 10 levels deep |
| Surgical write-back | `applyTokensToSource()` replaces only values, preserves @layer, @theme, imports, comments, formatting |

### Token Resolution Pipeline (theme-color-resolver.ts)

When an element is inspected in Theme Mode, `getColorProperties()` runs this pipeline:

```
1. Get computed styles for 33+ color properties
   (color, background-color, border-color, outline-color, box-shadow, etc.)

2. For each property with a non-default value:
   a. Resolve the specified value from matching CSS rules
   b. If value contains var() → walk the token chain
   c. Determine source type: inline | rule | inherited
   d. Convert to hex/rgb/hsl for display

3. Return ColorPropertyInfo[] with:
   - property name, computed value, source selector
   - token chain (if var()-based)
   - source type for edit strategy
```

### Bidirectional File Sync

```
CSS File on Disk
     │
     ▼ (File System Access API: showOpenFilePicker)
FileSystemFileHandle stored in ThemeFile.handle
     │
     ├──→ READ: 1-second polling via handle.getFile().text()
     │    Detects external changes, re-parses tokens
     │
     ├──→ WRITE: Manual "Sync" button
     │    applyTokensToSource() builds updated CSS
     │    handle.createWritable() writes back
     │    Only token VALUES change — everything else preserved
     │
     └──→ PERSIST: Dual persistence (see Section 4)
          .0c file stores: file path, theme columns, token snapshot
          IndexedDB stores: FileSystemFileHandle for instant re-access
          On rebuild: restore from IndexedDB handles → fallback to .0c paths
```

### Change Tracking & AI Integration

When a designer changes a color in Theme Mode:

1. Inline style applied immediately: `element.style[property] = newValue`
2. `ThemeChangeItem` recorded: `{ elementSelector, property, oldValue, newValue, tokenName? }`
3. Changes List panel shows numbered items with before → after swatches
4. "Copy Prompt" button generates structured markdown with all changes
5. Markdown includes CSS selectors, property names, old/new values, token references

This is the bridge to AI agents: the designer makes visual changes, the system generates a precise prompt, the AI agent applies them to source code.

### What Needs Improvement

| Area | Current State | Target State |
|------|--------------|-------------|
| **Undo/Redo** | No history | Full undo stack for token edits and theme changes |
| **Non-color tokens** | Color-only inspection | Spacing, typography, border-radius token inspection and editing |
| **Value validation** | None | Validate values match declared syntax type (e.g., color token must be valid color) |
| **Theme column deletion** | Can add, can't delete | Full CRUD for theme columns |
| **Polling performance** | 1s interval on all files | Debounced polling, skip unchanged files, event-based for WebSocket bridge |
| **Token suggestions** | Basic | When designer uses raw value, suggest matching tokens from design system |
| **Visual diff** | None | Before/after comparison when tokens change |
| **Conflict resolution** | None | When two designers change same token, visual merge |
| **Token grouping** | By name prefix | Smart grouping: semantic (brand, neutral, feedback) + by usage |
| **CSS-in-JS support** | CSS files only | Support styled-components, emotion, CSS Modules token extraction |
| **Reset/revert individual** | Revert all or nothing | Reset individual property changes from inspector |
| **Inline editing of changes** | View-only changes list | Click change number → edit property/value inline |

### Themes Module Roadmap

**Near-term (next iteration):**
- Show only applied color properties (not all 33+) in inspector
- Add search to apply new CSS color properties
- Clear visual distinction between existing vs newly applied properties
- Reset button per individual CSS property in inspector
- Clickable change numbers → inline edit property values
- Remove individual changes (with design reset)
- Resizable theme mode panel with content fitting width

**Mid-term:**
- Spacing token inspection and editing
- Typography token inspection and editing
- Token validation against syntax type
- Undo/redo for all token operations
- Smart token grouping

**Long-term:**
- Full design system enforcement mode
- Cross-file token dependency visualization
- CSS-in-JS / Tailwind token support
- WebSocket bridge for real-time token sync (replaces polling)

---

## 9. Communication Bridge Design

### WebSocket Protocol

Port: `24193` (configurable)

```
Browser Overlay                    VS Code Extension
     │                                    │
     │──── ws://localhost:24193 ─────────▶│
     │                                    │
     │  CONNECT                           │
     │◀──── CONNECTED { projectId } ──────│
     │                                    │
     │── STYLE_CHANGE ──────────────────▶│
     │   { selector, property, value,     │
     │     sourceHint }                   │
     │                                    │
     │◀── FILE_WRITTEN { file, line } ───│
     │                                    │
     │  (Vite HMR auto-updates browser)   │
     │                                    │
     │── REQUEST_SOURCE_MAP ────────────▶│
     │   { selector }                     │
     │                                    │
     │◀── SOURCE_MAP_RESULT ─────────────│
     │   { selector, file, line,          │
     │     componentName }                │
     │                                    │
     │── SAVE_CHECKPOINT ───────────────▶│
     │   { label }                        │
     │                                    │
     │◀── CHECKPOINT_SAVED ──────────────│
     │   { revision, commitHash }         │
     │                                    │
     │── SHARE_CHANGES ─────────────────▶│
     │                                    │
     │◀── CHANGES_SHARED ───────────────│
     │   { remote, branch }               │
     │                                    │
     │── AGENT_REQUEST ─────────────────▶│
     │   { prompt, context }              │
     │                                    │
     │◀── AGENT_RESPONSE ───────────────│
     │   { action, filesChanged }         │
```

### Message Types Reference

```typescript
// ── Browser → Extension ──────────────────────────────

interface StyleChangeMessage {
  type: "STYLE_CHANGE";
  selector: string;           // CSS selector for the element
  property: string;           // CSS property name
  value: string;              // new value
  previousValue?: string;     // for undo support
  sourceHint?: string;        // optional file path hint from source maps
}

interface TokenChangeMessage {
  type: "TOKEN_CHANGE";
  tokenName: string;          // e.g. "--color-primary"
  themeId: string;            // which theme
  value: string;              // new value
  sourceFile?: string;        // the CSS file containing this token
}

interface RequestSourceMapMessage {
  type: "REQUEST_SOURCE_MAP";
  selector: string;           // CSS selector
  tagName: string;
  className: string;
  textContent?: string;       // first 50 chars, for disambiguation
}

interface SaveCheckpointMessage {
  type: "SAVE_CHECKPOINT";
  label: string;              // designer's description
  changedFiles?: string[];    // files modified since last checkpoint
}

interface ShareChangesMessage {
  type: "SHARE_CHANGES";
  createPR?: boolean;
  prTitle?: string;
  prDescription?: string;
}

interface AgentRequestMessage {
  type: "AGENT_REQUEST";
  prompt: string;             // designer's natural language request
  selectedElement?: string;   // selector of element in focus
  context?: object;           // .0c project state for AI context
}

// ── Extension → Browser ──────────────────────────────

interface FileWrittenMessage {
  type: "FILE_WRITTEN";
  file: string;
  line?: number;
  property: string;
  value: string;
  success: boolean;
  error?: string;
}

interface SourceMapResultMessage {
  type: "SOURCE_MAP_RESULT";
  selector: string;
  file: string;               // relative path to source file
  line: number;
  column?: number;
  componentName?: string;
  framework: string;          // react | vue | svelte | etc.
  stylingApproach: string;    // tailwind | css-modules | styled-components | inline | css
}

interface CheckpointSavedMessage {
  type: "CHECKPOINT_SAVED";
  revision: number;
  commitHash: string;
  filesCommitted: string[];
}

interface AgentResponseMessage {
  type: "AGENT_RESPONSE";
  action: string;             // what the agent did
  filesChanged: string[];     // which files were modified
  success: boolean;
}

interface ProjectStateMessage {
  type: "PROJECT_STATE";
  state: OCProjectFile;       // full .0c project state
}
```

### Vite Plugin Enhancement

The currently-stub Vite plugin becomes the browser-side WebSocket client:

```typescript
// src/vite-plugin.ts (enhanced)

export function zeros(options?: ZerosPluginOptions): Plugin {
  return {
    name: "Zeros",
    apply: "serve",

    configureServer(server) {
      // 1. Inject Zeros WebSocket client into served pages
      // 2. Set up middleware to serve .0c file state
      // 3. Watch for .0c file changes and notify the overlay
    },

    transformIndexHtml(html) {
      // Inject <script> that connects to extension WebSocket
      // and bootstraps the Zeros overlay communication
    }
  };
}
```

---

## 10. Designer Workflow & UX

### First-Time Setup (One Time)

```
1. Install VS Code or Cursor (if not already installed)
2. Install Zeros extension from marketplace
3. Done. No terminal. No configuration.
```

### Daily Workflow

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. OPEN PROJECT                                        │
│     Open VS Code → File → Open Folder → select repo    │
│     (or click recent project)                           │
│                                                         │
│  2. GET LATEST                                          │
│     VS Code Source Control tab → click "Pull" button    │
│     (or Zeros sidebar shows "Get Latest" button)      │
│                                                         │
│  3. OPEN DESIGN CANVAS                                  │
│     Double-click "project.0c" in file tree              │
│     → Extension dashboard opens                         │
│     → Click "Open in Browser"                           │
│     → Dev server starts automatically                   │
│     → Browser opens with app + overlay active            │
│                                                         │
│  4. MAKE DESIGN CHANGES                                 │
│     In browser:                                         │
│     - Click elements to select                          │
│     - Use property panel to change colors, spacing,     │
│       typography, layout, borders, effects              │
│     - Use token editor for design system changes        │
│     - Use AI chat for structural changes                │
│     - Changes are live — see them instantly              │
│                                                         │
│  5. SAVE CHECKPOINT                                     │
│     Click "Save Checkpoint" in overlay sidebar          │
│     → Enter description: "Updated button colors"        │
│     → Git commit happens invisibly                      │
│                                                         │
│  6. SHARE CHANGES                                       │
│     Click "Share Changes" in overlay sidebar            │
│     → Git push happens invisibly                        │
│     → Optionally creates a PR                           │
│     → Designer gets a link to share with team           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### What the Designer Never Sees

- Terminal / command line
- package.json, node_modules, tsconfig
- Raw CSS or JSX/TSX code
- Git commands (commit, push, pull, merge, rebase)
- Build errors (the extension handles these)
- npm install output

### What the Designer Always Sees

- Their app, running live in the browser
- Visual property editors (like Figma)
- Design tokens organized by category
- A history of their checkpoints (like save points)
- Feedback from AI agents visualized on the canvas
- A clean, professional design tool interface

### Error Handling for Designers

| Error | What Designer Sees | What Happens Behind the Scenes |
|-------|-------------------|-------------------------------|
| Dev server not running | "Starting your project..." with spinner | Extension detects framework, runs `npm run dev` |
| Build error | "Something went wrong with the project setup. Ask a developer to check." | Extension shows build error in terminal for developer to fix |
| Git conflict | "Someone else changed the same area. Here's what changed:" + visual diff | Extension attempts auto-merge; if .0c conflicts, shows visual merge UI |
| File write fails | "Couldn't save this change. Try again?" + undo option | Extension logs error, offers to retry or revert |
| WebSocket disconnected | "Reconnecting..." + auto-retry | Extension attempts reconnect every 2 seconds |

---

## 11. AI Agent Integration

### Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Zeros Overlay │     │  VS Code Extension│     │  AI Agent        │
│  (Browser)       │     │                  │     │  (Claude Code /  │
│                  │     │  ┌────────────┐  │     │   Cursor / etc.) │
│  Designer types: │────▶│  │ MCP Server │──┼────▶│                  │
│  "Make the hero  │     │  │            │  │     │  Reads .0c file  │
│   section more   │     │  │ Provides:  │  │     │  Understands     │
│   compact"       │     │  │ - .0c state│  │     │  design context  │
│                  │◀────│  │ - Element  │  │◀────│  Makes code      │
│  Sees AI changes │     │  │   tree     │  │     │  changes         │
│  reflected live  │     │  │ - Tokens   │  │     │                  │
│                  │     │  │ - Feedback │  │     │                  │
│                  │     │  └────────────┘  │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### MCP Server Tools

The extension exposes these tools via MCP (Model Context Protocol) for AI agents:

```typescript
// Tool: read_design_state
// Returns the full .0c project state for AI context
{
  name: "read_design_state",
  description: "Read the current Zeros design state including elements, tokens, variants, and feedback",
  returns: OCProjectFile
}

// Tool: read_element_styles
// Returns computed styles for a specific element
{
  name: "read_element_styles",
  description: "Get the computed styles and source location for a DOM element",
  params: { selector: string },
  returns: { styles: Record<string, string>, sourceFile: string, sourceLine: number }
}

// Tool: list_design_tokens
// Returns all design tokens and their values
{
  name: "list_design_tokens",
  description: "List all CSS custom properties / design tokens with their values across themes",
  returns: DesignToken[]
}

// Tool: get_pending_feedback
// Returns feedback items the designer has annotated
{
  name: "get_pending_feedback",
  description: "Get feedback annotations from the designer that need to be addressed",
  returns: FeedbackItem[]
}

// Tool: apply_design_change
// Applies a visual change and notifies the overlay
{
  name: "apply_design_change",
  description: "Apply a style change to an element. The overlay will reflect this immediately.",
  params: { selector: string, property: string, value: string }
}
```

### AI Workflow Example

```
Designer (in overlay AI chat): "Make the pricing cards equal height 
and add more spacing between them"

    ↓ Message sent via WebSocket to Extension

Extension:
    1. Formats prompt with .0c context (element tree, current styles)
    2. Dispatches to detected AI agent (e.g., Claude Code)

AI Agent:
    1. Reads .0c file via MCP → understands the page layout
    2. Uses read_element_styles → gets current pricing card CSS
    3. Identifies the source file: src/components/PricingCards.tsx
    4. Edits the file: adds min-h-[400px] and gap-8
    5. Uses apply_design_change to notify overlay

Extension:
    1. Vite HMR pushes the update to browser
    2. Sends AGENT_RESPONSE to overlay

Designer:
    Sees the pricing cards update live in the browser
    Can further adjust with visual property editors
    Or ask AI for more changes
```

---

## 12. Phased Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Goal: Browser overlay can change CSS values and write them to actual files.**

| Task | Description | Priority |
|------|-------------|----------|
| WebSocket bridge in Vite plugin | Overlay ↔ Extension real-time communication | P0 |
| WebSocket server in VS Code extension | Accept connections from browser overlay | P0 |
| Basic file writer | Receive CSS property changes, write to .css files | P0 |
| Source map resolver (basic) | Map CSS selector → CSS file and line number | P0 |
| Color picker component | Visual color editor with hex/rgb/hsl inputs | P0 |
| Spacing editor component | Visual margin/padding editor with number inputs | P0 |
| Typography editor component | Font/size/weight/height editors | P0 |

**Milestone: Designer can click an element, change its color with a picker, and the CSS file updates.**

### Phase 2: Design Tool Experience (Weeks 5-8)

**Goal: Property panel feels like a real design tool with all common editors.**

| Task | Description | Priority |
|------|-------------|----------|
| Layout editor (Flex/Grid) | Visual flex direction, justify, align, gap controls | P0 |
| Border & radius editor | Width, style, color, corner radius controls | P0 |
| Shadow editor | Visual box-shadow editor with offset/blur/spread/color | P1 |
| Opacity & blend mode | Slider + dropdown | P1 |
| Element resize handles | Drag corners/edges to resize elements | P0 |
| Measurement guides | Show distances between elements on hover | P1 |
| Multi-select support | Cmd+click to select multiple, batch edit | P1 |
| Undo/redo system | Track changes, Cmd+Z to reverse, across files | P0 |
| Token suggestions | Suggest design tokens instead of raw values | P1 |

**Milestone: Designer can do 80% of common design adjustments visually.**

### Phase 3: VS Code Extension & .0c Integration (Weeks 9-12)

**Goal: Double-click .0c file → full design experience launches.**

| Task | Description | Priority |
|------|-------------|----------|
| Custom editor provider for .0c | Opens dashboard when .0c file is double-clicked | P0 |
| Dev server auto-detect & start | Find package.json scripts, start dev server | P0 |
| Browser auto-launch | Open default browser with overlay active | P0 |
| .0c file save to file system | Save .0c alongside IndexedDB (dual persistence) | P0 |
| Git abstraction: save checkpoint | One-click commit from overlay sidebar | P1 |
| Git abstraction: share changes | One-click push from overlay sidebar | P1 |
| Git abstraction: get latest | One-click pull with .0c state reload | P1 |
| `npx Zeros init` CLI | Scaffold .0c file for existing projects | P1 |

**Milestone: Designer opens .0c → browser launches → designs visually → saves → pushes. Complete workflow.**

### Phase 4: AI Agent Integration (Weeks 13-16)

**Goal: AI agents understand design context and respond to designer requests.**

| Task | Description | Priority |
|------|-------------|----------|
| MCP server in extension | Expose .0c state, element tree, tokens to AI agents | P0 |
| AI chat panel in overlay | Designer types natural language requests | P0 |
| Agent dispatch to Claude Code | Route requests via MCP → Claude Code | P0 |
| Agent dispatch to Cursor | Route requests via Cursor's composer | P1 |
| Live change visualization | Show AI-made changes highlighted in overlay | P1 |
| Feedback → Agent pipeline | Annotations automatically dispatched to AI | P1 |

**Milestone: Designer asks AI to "make the header sticky" → AI makes code change → designer sees it live.**

### Phase 5: Advanced Design Tool Features (Weeks 17-24)

**Goal: Feature parity with essential design tool workflows.**

| Task | Description | Priority |
|------|-------------|----------|
| Component boundary detection | Identify React/Vue/Svelte component boundaries in DOM | P1 |
| Component-level editing | Edit component props visually, not just CSS | P1 |
| Responsive editing | Edit styles per breakpoint with preview switching | P0 |
| Tailwind class editing | Understand and modify Tailwind utility classes | P0 |
| CSS Modules support | Map `.module.css` files correctly | P1 |
| Styled-components support | Edit template literal styles | P2 |
| Asset management | Drag-drop images, manage static assets | P2 |
| Prototype/interaction mode | Define hover/click states visually | P2 |
| Visual diff | Before/after comparison for checkpoints | P1 |
| .0c merge conflict resolver | Visual tool for resolving .0c merge conflicts | P2 |

**Milestone: Zeros is a viable daily tool for production design work.**

### Phase 6: Polish & Ecosystem (Weeks 25+)

| Task | Description |
|------|-------------|
| Extension marketplace publishing | Publish to VS Code + Open VSX marketplaces |
| Framework auto-detection | Detect React/Vue/Svelte/Angular and adapt editing strategy |
| Plugin system | Allow community to extend property editors |
| Design system import | Import tokens from Figma, Style Dictionary, Tokens Studio |
| Collaboration features | Multiple designers on same project (via git branches) |
| Tutorial / onboarding | First-run experience for new designers |

---

## 13. Competitive Landscape

### Direct Competitors

| Tool | Approach | Strengths | Weaknesses | What Zeros Can Learn |
|------|----------|-----------|------------|----------------------|
| **Pencil.dev** | VS Code extension with `.pen` files in git | MCP integration, bidirectional design-code, clean DX | IDE-only canvas (no real browser rendering), early-stage | `.pen` file format design, MCP integration pattern |
| **Onlook** | Standalone Electron app, React-only | Open source (4.2k stars), two-way DOM-code sync | React-only, Electron overhead, no AI integration | DOM-to-source mapping approach, two-way sync architecture |
| **Subframe** | Web-based visual editor + CLI sync | "Design IS code" philosophy, clean React/Tailwind output | SaaS dependency, no local-first, limited framework support | Component registration pattern, Tailwind-native editing |
| **Cursor Visual Editor** | Built into Cursor IDE | Massive user base, AI-native, integrated with Cursor | Cursor-only, WebView rendering (not real browser), RAM-heavy | AI prompt UX, visual editor interaction patterns |
| **Builder.io Visual Copilot** | Figma plugin + CLI | Enterprise-grade, Figma ecosystem, multiple frameworks | Requires Figma, not code-first, generation step | Figma-to-code pipeline, framework adapter architecture |

### Indirect Competitors

| Tool | Approach | Relevance |
|------|----------|-----------|
| **Figma Make** | AI generates code from Figma designs | Figma-to-code direction (opposite of Zeros's code-first) |
| **v0 by Vercel** | AI generates UI from prompts | Competing vision for AI-generated design, Git-native |
| **Webflow** | Visual web builder | Gold standard for visual editing UX, but walled garden |
| **Plasmic** | Register components for visual editing | Component registration pattern for visual editing |
| **Framer** | Visual builder generating React | Smooth design-to-code, but not on existing codebases |
| **Penpot** | Open source design tool | Open source precedent, CSS Grid layout editing |

### Zeros Differentiation

| Differentiator | Why It Matters |
|---------------|----------------|
| **Real browser rendering** | Unlike Pencil.dev/Cursor (WebView), Zeros renders in the actual browser. What you see is exactly what ships. |
| **Framework agnostic** | Works with React, Vue, Svelte, Angular, plain HTML/CSS. Not locked to one framework. |
| **Code-first, not generation** | Works on your existing codebase. No "generate and integrate" step. |
| **Git-native .0c format** | Design state lives in the repo. Diffable, mergeable, reviewable. |
| **AI agent agnostic** | Works with Claude Code, Cursor, Copilot, Windsurf — not locked to one AI. |
| **Local-first** | No SaaS dependency. Everything runs on the designer's machine. |
| **Library, not platform** | `<Zeros />` embeds into any app. The tool lives where the code lives. |

### Market Position

```
                    Visual Fidelity
                         ▲
                         │
          Figma Make  ●  │  ● Webflow
                         │
         Pencil.dev  ●   │      ● Framer
                         │
     Cursor Visual ●     │  ● Zeros (target)
                         │
          Builder.io ●   │
                         │
          ─────────────────────────────▶
         Separate from code    On production code
```

Zeros targets the **upper-right quadrant**: high visual fidelity (real browser rendering) AND directly on production code.

---

## 14. Technical Decisions & Trade-offs

### Decision 1: Browser Overlay vs. VS Code WebView

**Chosen: Browser overlay (Ctrl+Shift+D)**

| Factor | Browser Overlay | VS Code WebView |
|--------|----------------|-----------------|
| Rendering fidelity | Real browser, real CSS, 100% accurate | Chromium-based but sandboxed, quirks possible |
| Performance | Native browser performance | WebView overhead + VS Code process |
| Framework support | Any framework, any CSS | Same, but iframe-in-WebView adds complexity |
| File system access | None (needs bridge) | Full access via VS Code API |
| HMR integration | Native Vite HMR | Requires proxy setup |
| Designer experience | Full-screen, immersive | Constrained to VS Code panel size |

Trade-off: We need a WebSocket bridge for file writes, but gain perfect rendering fidelity and a better design experience.

### Decision 2: WebSocket vs. HTTP Polling

**Chosen: WebSocket (replaces current HTTP polling)**

| Factor | WebSocket | HTTP Polling |
|--------|-----------|-------------|
| Latency | ~1ms | 2000ms poll interval |
| Bidirectional | Yes | Request-response only |
| Real-time feel | Instant feedback | Noticeable delay |
| Connection state | Clear connected/disconnected | Ambiguous |
| Complexity | Slightly more setup | Simpler initial implementation |

Trade-off: Slightly more setup, but the real-time experience is essential for a design tool.

### Decision 3: Source File Identification Strategy

**Chosen: Multi-strategy approach (progressive enhancement)**

| Strategy | How It Works | Accuracy | Framework Support |
|----------|-------------|----------|-------------------|
| CSS selector → stylesheet search | Grep for selector in CSS files | Medium | All |
| React DevTools-style fiber walk | Traverse React component tree, read `__source` | High | React only |
| Vite source maps | Use source maps to trace transpiled code | High | All (with Vite) |
| `data-source` attributes (dev build) | Inject source file info as data attributes | Perfect | All (with plugin) |
| Component name → file search | Match component name to file name | Medium | All |

Phase 1 starts with CSS selector search + Vite source maps. Phase 5 adds React fiber walk and `data-source` injection.

### Decision 4: .0c File Storage

**Chosen: Dual persistence (IndexedDB + file system)**

- **IndexedDB**: Fast auto-save in browser (500ms debounce). Always available.
- **File system**: The .0c file in the repo. Updated on "Save Checkpoint" or periodically synced.

The IndexedDB version is the "working draft." The file system version is the "saved version" that gets committed to git.

### Decision 5: Styling Approach Detection

**Chosen: Auto-detect per project**

The file writer must know how styles are applied to write changes correctly:

| Approach | Detection Method | Write Strategy |
|----------|-----------------|---------------|
| Tailwind CSS | Check for `tailwind.config` or `@tailwind` directives | Modify className in JSX |
| CSS Modules | Check for `.module.css` imports | Modify the .module.css file |
| Plain CSS | Check for `<link>` to stylesheets | Modify the .css file |
| CSS-in-JS | Check for `styled-components` / `emotion` imports | Modify template literals |
| Inline styles | Check for `style=` props | Modify style object in JSX |

Most projects use a mix. The file writer applies the correct strategy per element based on how that element is currently styled.

### Decision 6: Removing the Layers Panel

**Chosen: Remove layers, keep inspect-first model**

| Factor | Layers Panel (DOM Tree) | Inspect-First (Click on Page) |
|--------|------------------------|------------------------------|
| Mental model | Developer-oriented (div > div > span) | Designer-oriented (point at what you see) |
| Accuracy | DOM tree includes framework wrappers, fragments, context providers — noise for designers | What you click is what you get |
| Figma parity | DOM layers ≠ Figma layers. Will always disappoint. | Direct manipulation is closer to Figma's feel |
| Maintenance | Complex recursive tree rendering, search, visibility/lock toggles | Element selection already exists in inspector |
| Value | Useful for overlapping/hidden elements | 95% of cases covered by click-to-inspect |

**What to preserve from layers:**
- Element count badge → move to inspector toolbar
- Search functionality → move to a quick element search in toolbar (Cmd+F for elements)
- Visibility toggle → not needed (designers don't hide DOM elements)

**What to gain from removal:**
- Simpler UI — one less panel to understand
- More canvas space for the live app preview
- Clearer identity: this is a design tool, not a dev inspector

---

## 15. Open Questions

### Product Questions

1. **Branch strategy for designers:** Should designers work on `main` directly, or should the extension auto-create a `design/[name]` branch? Creating branches adds complexity but prevents conflicts.

2. **Multi-designer collaboration:** If two designers edit the same page simultaneously (on different branches), how do we handle .0c merge conflicts? A visual merge tool is needed eventually.

3. **Design system enforcement:** How strict should token suggestions be? Options range from "suggest tokens" (soft) to "only allow token values" (strict, enforced by team settings).

4. **Offline support:** Should the overlay work without the VS Code extension running? (Possible for inspection/annotation, not for file writes.)

5. **Component vs. element editing:** Should the overlay understand component boundaries and let designers edit component props (e.g., `<Button variant="primary">`)? This is powerful but requires framework-specific integration.

### Technical Questions

1. **Source map reliability:** How reliable are Vite source maps for tracing DOM elements back to source files across frameworks? Do we need per-framework adapters?

2. **Tailwind class conflicts:** When a designer changes a property that conflicts with existing Tailwind classes, should we remove the old class and add a new one, or add an override?

3. **CSS specificity:** When the overlay writes a style change, where should it be written to ensure it actually applies? (Tailwind layer, component style, global override?)

4. **Performance budget:** How much overhead does the overlay add to the host app? What's the acceptable performance impact?

5. **Hot reload edge cases:** Are there cases where Vite HMR can't handle a file change and requires a full reload? How do we handle those gracefully?

### Strategic Questions

1. **Monetization:** Free open-source tool? Freemium with team features? Enterprise licensing? The competitive landscape is split.

2. **Framework prioritization:** Start with React-only (like Onlook) or framework-agnostic from day one? Framework-agnostic is harder but has a larger market.

3. **Marketplace timing:** When should the VS Code extension be published to the marketplace? Too early = bad reviews. Too late = missed adoption window.

4. **Pencil.dev compatibility:** Should Zeros read/write `.pen` files for interop? Or focus on .0c as a better format?

5. **Open source strategy:** Full open source (like Penpot/Onlook) or proprietary with open-source components? Open source builds community but requires sustainable funding.

---

## Appendix A: Key Reference Projects

| Project | URL | What to Study |
|---------|-----|--------------|
| **Nordcraft** | **github.com/nordcraftengine/nordcraft** | **Primary reference: native HTML/CSS visual editor, all CSS property panels, design editor patterns. Study this first for any visual editing feature.** |
| Onlook | github.com/onlook-dev/onlook | DOM-to-code sync, React source mapping |
| Pencil.dev | pencil.dev | .pen format, MCP integration, IDE extension UX |
| Subframe | subframe.com | Component-backed design, Tailwind output |
| Penpot | github.com/penpot/penpot | Open source design tool, CSS Grid editing |
| Plasmic | github.com/plasmicapp/plasmic | Component registration, visual editing architecture |
| css.gui | github.com/components-ai/css.gui | CSS visual development environment |
| Style Dictionary | github.com/style-dictionary/style-dictionary | Design token transformation |

## Appendix B: File Structure (Target)

```
Zeros/
├── src/
│   ├── zeros/
│   │   ├── canvas/              # ReactFlow canvas + nodes
│   │   ├── engine/              # <Zeros /> entry component
│   │   ├── format/              # .0c file format + persistence
│   │   ├── inspector/           # DOM inspection utilities
│   │   ├── panels/              # Sidebar, toolbar, layers, settings
│   │   ├── editors/             # NEW: Visual property editors
│   │   │   ├── color-editor.tsx
│   │   │   ├── spacing-editor.tsx
│   │   │   ├── typography-editor.tsx
│   │   │   ├── layout-editor.tsx
│   │   │   ├── border-editor.tsx
│   │   │   ├── shadow-editor.tsx
│   │   │   └── token-suggest.tsx
│   │   ├── bridge/              # NEW: WebSocket client
│   │   │   ├── ws-client.ts
│   │   │   └── messages.ts
│   │   ├── store/               # State management
│   │   ├── themes/              # Design token editor
│   │   └── utils/
│   ├── vite-plugin.ts           # Enhanced with WebSocket + HMR
│   └── index.ts                 # Public API
├── extensions/
│   └── vscode/
│       └── src/
│           ├── extension.ts
│           ├── custom-editor-provider.ts    # NEW
│           ├── websocket-bridge.ts          # NEW
│           ├── file-writer.ts               # NEW
│           ├── source-map-resolver.ts       # NEW
│           ├── git-abstraction.ts           # NEW
│           ├── dev-server-manager.ts        # NEW
│           ├── mcp-server.ts                # NEW
│           └── agent-dispatch.ts            # EXISTING
├── docs/
│   └── PRODUCT_VISION.md        # This document
├── project.0c                   # Example .0c design file
├── package.json
├── tsup.config.ts
└── vite.config.ts
```

## Appendix C: Glossary

| Term | Definition |
|------|-----------|
| **.0c file** | JSON design document format. The "Figma file" that lives in git alongside code. |
| **Overlay** | The Zeros UI that appears on top of the running app in the browser (Ctrl+Shift+D). |
| **Property editor** | Visual control for editing a CSS property (color picker, spacing slider, etc.). |
| **Checkpoint** | Designer-friendly name for a git commit. "Save checkpoint" = commit. |
| **Share** | Designer-friendly name for git push. "Share changes" = push (optionally create PR). |
| **Source map** | Mapping from a DOM element to the source file + line that created it. |
| **Design token** | A CSS custom property (variable) that's part of the design system. |
| **Variant** | A fork of a page or component with modified HTML/CSS for comparison. |
| **Bridge** | The WebSocket connection between browser overlay and VS Code extension. |
| **MCP** | Model Context Protocol. Standard for AI agents to access external tools/data. |

---

*This document is the strategic blueprint for Zeros. It should be updated as decisions are made, questions are answered, and the roadmap progresses.*
