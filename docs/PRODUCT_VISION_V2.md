# Zeros Product Vision V2 — The Universal Design Engine

> **⚠️ SUPERSEDED by [PRODUCT_VISION_V3.md](PRODUCT_VISION_V3.md) on
> 2026-04-20.** V3 pivots to a native Tauri Mac app as the primary
> distribution. V2's npm engine + browser overlay remains alive as a
> secondary distribution channel and is still accurate for that surface,
> but the app, the shell, and the overall vision are V3's shape now.
> Read V3 first; treat V2 as historical + npm-only reference.

---

> **One install. One command. A design tool appears on your app.**
> No extensions. No plugins. No configuration. It just works.

**Version:** 2.0
**Date:** 2026-04-15
**Author:** Zeros Design
**Supersedes:** PRODUCT_VISION.md (V1.1, 2026-04-12)
**Superseded by:** PRODUCT_VISION_V3.md (V3.0, 2026-04-20)

---

## Table of Contents

1. [Vision: What Changed](#1-vision-what-changed)
2. [Core Experience Principles](#2-core-experience-principles)
3. [The Engine — Heart of Zeros](#3-the-engine--heart-of-Zeros)
4. [Engine Architecture & Technology](#4-engine-architecture--technology)
5. [The .0c File — Living Design Document](#5-the-0c-file--living-design-document)
6. [Browser Overlay — A Design Tool, Not a Dev Tool](#6-browser-overlay--a-design-tool-not-a-dev-tool)
7. [AI Integration — Invisible and Powerful](#7-ai-integration--invisible-and-powerful)
8. [Auth, Cloud & Data Strategy](#8-auth-cloud--data-strategy)
9. [Monetization & Pricing](#9-monetization--pricing)
10. [Phase 1 Roadmap](#10-phase-1-roadmap)
11. [Decisions Log](#11-decisions-log)

---

## 1. Vision: What Changed

### V1 Vision (Superseded)

V1 was built around VS Code as the shell:

```
VS Code Extension ←→ WebSocket ←→ Browser Overlay
```

This created hard dependencies: you needed VS Code (or a fork), you needed the extension installed, and the browser overlay couldn't function without the extension running. It excluded Claude Code, Codex, Lovable, Bolt, and every terminal-based or cloud-based coding tool.

### V2 Vision

**The engine lives in the codebase. One install command. Everything works.**

```
npm install @Withso/zeros
```

That's it. The next time the user runs their dev server, a design tool appears in the browser. No VS Code extension. No browser extension. No configuration file. No MCP setup. No WebSocket debugging. The user presses `Ctrl+Shift+D` and starts designing.

```
User's Codebase
  └── node_modules/@Withso/zeros/
       └── The Engine (Node.js process)
            ├── Reads and writes CSS/source files directly
            ├── Serves the browser overlay
            ├── Communicates with AI tools automatically
            └── Manages .0c design files on disk
```

### What's Different

| Aspect | V1 | V2 |
|--------|----|----|
| **Dependency** | VS Code + Extension + Browser | npm package only |
| **File system access** | Via VS Code Extension APIs | Direct Node.js `fs` — the engine IS a Node.js process |
| **AI tool integration** | VS Code extension dispatches to IDE agents | MCP endpoint auto-starts, any AI tool connects |
| **Works with** | VS Code, Cursor (with extension) | VS Code, Cursor, Claude Code, Codex, Antigravity, Lovable, Bolt, Replit, any terminal, any IDE, no IDE |
| **User sees** | MCP status, WebSocket connection, IDE settings | Nothing. A design tool. |
| **Setup steps** | Install package + install extension + configure | Install package |

### The Principle

**Zeros is a design tool that happens to run in a browser.**

The user should never think about engines, bridges, protocols, or connections. They should think about colors, spacing, typography, and layout. Every technical detail operates silently under the hood. The only time the tool surfaces a technical notification is when something is broken and needs the user's attention.

---

## 2. Core Experience Principles

### Principle 1: It's a Design Tool

The overlay looks and feels like a design application. Not a developer tool. Not an inspector. Not a debugger.

- No "MCP Connected" badges
- No WiFi icons showing connection status
- No "IDE & Agents" settings pages
- No WebSocket status indicators
- No "Bridge" or "Relay" terminology anywhere
- No technical jargon in any UI element

If the engine is connected and working (which it should be 99% of the time), the user sees a clean design interface. Period.

**When something goes wrong:** A single, human-readable notification appears:

```
"Zeros can't connect to your project. Is your dev server running?"
```

Not:

```
"WebSocket connection failed on port 24193. MCP transport timeout. Bridge relay disconnected."
```

### Principle 2: One Command, Everything Works

The installation and setup experience:

```bash
# Step 1: Install
npm install @Withso/zeros

# Step 2: Add to your app (one line)
# In your main entry file:
import '@Withso/zeros';

# Step 3: Run your dev server
npm run dev

# Step 4: Press Ctrl+Shift+D in the browser
# The design tool appears. Start designing.
```

No configuration files. No environment variables. No port numbers. No `.mcp.json` to create. The engine auto-detects everything.

### Principle 3: Design Files Live in the Codebase

The `.0c` file is created, managed, and deleted from the browser overlay UI:

- **Create:** User clicks "New Project" in the overlay → `.0c` file appears in the codebase root
- **Save:** Auto-saves continuously as the user works → engine writes to disk
- **Delete:** User clicks "Delete Project" in the overlay → engine removes the `.0c` file from disk

The `.0c` file is committed to git alongside the code. It's the team's design document.

No IndexedDB as primary storage. No file picker prompts. No "export" step. The file is always on disk, always in sync, always in git.

### Principle 4: The Browser is the Canvas

The real app, running in a real browser, is the design surface. What the designer sees is exactly what ships. No rendering engine approximation. No simulated viewports. The browser's own rendering — with all its quirks, fonts, and behaviors — is the source of truth.

### Principle 5: AI is a Silent Collaborator

AI agents interact with Zeros through MCP. The MCP server starts automatically with the engine. AI tools discover it automatically through config files the engine generates. The user never configures this.

When a designer makes changes and wants AI help, they describe what they want in the overlay's AI chat. The engine routes the request to whatever AI tool is available. The designer doesn't choose between "Cursor mode" or "Claude Code mode" — it just works.

---

## 3. The Engine — Heart of Zeros

### What the Engine Is

The engine is a standalone Node.js process that runs alongside the user's dev server. It is the brain of Zeros — it reads the codebase, writes changes back to source files, serves the browser overlay, and exposes an MCP endpoint for AI tools.

```
┌──────────────────────────────────────────────────────────┐
│  Zeros Engine (Node.js process, port 24193)             │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  HTTP + WebSocket Server (single port)              │ │
│  │  ├── WebSocket /ws — browser overlay connects here  │ │
│  │  ├── POST /mcp — AI tools connect here              │ │
│  │  └── GET /health — status check                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  CSS Intelligence                                   │ │
│  │  ├── File Discovery (finds all CSS files)           │ │
│  │  ├── CSS Parser (builds selector → file:line index) │ │
│  │  ├── Source Resolver (selector → source location)   │ │
│  │  └── File Writer (atomic write → HMR picks it up)  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Project Manager                                    │ │
│  │  ├── .0c File Manager (read/write/create/delete)    │ │
│  │  ├── File Watcher (detects external changes)        │ │
│  │  └── Framework Detector (React, Vue, Svelte, etc.)  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  MCP Server (Streamable HTTP)                       │ │
│  │  ├── Zeros_read_design_state                      │ │
│  │  ├── Zeros_get_element_styles                     │ │
│  │  ├── Zeros_list_tokens                            │ │
│  │  ├── Zeros_get_feedback                           │ │
│  │  └── Zeros_apply_change                           │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
         │                              │
    WebSocket                    MCP (HTTP POST)
         │                              │
    Browser Overlay              AI Tools
    (the design UI)         (Claude Code, Cursor,
                             Codex, Copilot, etc.)
```

### How the Engine Starts

**Option A: Alongside the dev server (recommended)**

Users add the engine to their `dev` script:

```json
{
  "scripts": {
    "dev": "concurrently 'vite' 'Zeros serve'",
    "dev:design": "Zeros serve"
  }
}
```

Or use the Vite plugin (convenience wrapper around the same engine):

```typescript
// vite.config.ts
import { zeros } from '@Withso/zeros/vite';

export default defineConfig({
  plugins: [react(), zeros()]
});
```

**Option B: Manual start**

```bash
npx Zeros serve
```

Starts the engine on port 24193 (default), auto-detects project root, begins watching files.

**Option C: Auto-start via package import**

When the user imports `@Withso/zeros` in their app, the library attempts to connect to the engine on the default port. If no engine is running and the environment is development, the overlay shows a gentle prompt:

```
"Start the Zeros engine to enable design editing:
 npx Zeros serve"
```

### What the Engine Does on Startup

```
1. Resolve project root (walk up from cwd looking for package.json)
2. Detect framework (React, Vue, Svelte, Next, Nuxt, Astro, etc.)
3. Discover all CSS files (tinyglobby, ignoring node_modules/dist)
4. Parse CSS files → build selector index (PostCSS)
5. Find existing .0c files in the project
6. Start HTTP + WebSocket server on port 24193
7. Start file watcher (@parcel/watcher)
8. Write .zeros/.port file for overlay discovery
9. Generate .mcp.json if not present (for AI tool auto-discovery)
10. Log one line: "Zeros engine ready on port 24193"
```

Time budget: under 500ms for a typical project (50 CSS files, ~5000 rules).

### The Filesystem is the Bridge

The engine doesn't need to be inside Vite, Webpack, or any bundler. When it writes a CSS change to disk:

1. Engine writes to `styles/buttons.css`
2. Vite's file watcher detects the change → HMR pushes to browser
3. Webpack's file watcher detects the change → HMR pushes to browser
4. Any dev server's file watcher detects the change → reloads

**The filesystem is the universal bridge between the engine and any dev server.** This is why the engine works with every framework and every bundler — it just writes files.

---

## 4. Engine Architecture & Technology

### Technology Stack — Chosen for Efficiency

Every dependency was chosen based on benchmarks for a daemon targeting <35MB memory and <10ms response time per operation.

| Concern | Technology | Why |
|---------|-----------|-----|
| **File watching** | `@parcel/watcher` | Native C++ (FSEvents/inotify/kqueue). Event coalescing in C++ prevents JS thread flooding. Used by VS Code, Tailwind, Nuxt. Lowest memory of all watchers. |
| **CSS parsing** | `postcss` | 28ms parse time for bootstrap-sized files. Source locations on every node (`source.start.line`). `walkRules()` API purpose-built for selector iteration. Massive ecosystem. |
| **File discovery** | `tinyglobby` | Built on `fdir` (fastest file crawler — 1M files in <1s). 179KB vs fast-glob's 513KB. 2 dependencies vs 17. |
| **WebSocket** | `ws` | Already in project dependencies. 3KB per connection. Zero native deps. Perfect for 1-5 local connections. |
| **HTTP server** | Node.js native `http` | Zero framework overhead. Shares port with WebSocket. Only 1-2 routes needed (MCP + health). |
| **MCP transport** | `@modelcontextprotocol/sdk` (Streamable HTTP) | Official SDK. Single POST endpoint. All major AI tools support it. |
| **Atomic file writes** | Manual (write-tmp-rename) | 10 lines of code, no dependency. POSIX-guaranteed atomic rename. |
| **CLI framework** | Minimal (process.argv parsing) | No commander/yargs needed for `Zeros serve [--port N]`. |

### Memory Budget

| Component | Memory |
|-----------|--------|
| Node.js runtime | ~15 MB |
| @parcel/watcher | ~2-3 MB |
| PostCSS (loaded lazily) | ~2 MB |
| CSS selector index (50 files, ~5000 rules) | ~0.5 MB |
| File content cache | ~1 MB |
| ws server (5 connections) | ~0.1 MB |
| HTTP server + MCP transport | ~1 MB |
| **Total** | **~22-28 MB** |

Target: **under 35 MB** in production use. Verified with `process.memoryUsage()` monitoring.

### Incremental Processing Pipeline

When a CSS file changes, the engine does NOT re-scan the entire project:

```
File change event (@parcel/watcher)
  → Debounce (50ms, coalesce rapid editor saves)
  → Read only the changed file
  → Parse with PostCSS (<5ms for typical component CSS)
  → Update selector index (remove old entries for this file, add new)
  → Notify browser overlay via WebSocket
  → Total: <10ms per file change
```

### Selector Resolution — How It Works

When the browser overlay sends a style change request:

```
Browser: "Change .hero-section background-color to #EF4444"

Engine:
  1. Look up ".hero-section" in selector index → Map.get()  [<1ms]
  2. Found: { file: "styles/hero.css", line: 42 }
  3. Read file, find property "background-color" in that rule block
  4. Atomic write: replace value, write to tmp, rename
  5. Dev server detects change → HMR → browser updates
  6. Send ACK to browser overlay via WebSocket
  
Total: <15ms from click to visual update
```

### Caching Strategy

Three caches, all `Map`-based with file-keyed invalidation:

**1. Selector Index** — the primary data structure

```
Map<string, SourceLocation[]>
  ".hero-section" → [{ file: "styles/hero.css", line: 42, column: 1 }]
  ".btn-primary"  → [{ file: "styles/buttons.css", line: 15, column: 1 }]
  ...
```

Built once on startup (~200ms for 50 files). Updated incrementally per-file on change (<5ms).

**2. File Content Cache** — avoids re-reading unchanged files

```
Map<string, { content: string, mtime: number }>
```

**3. Token Index** — CSS custom properties for the design token system

```
Map<string, { value: string, file: string, line: number }>
  "--color-primary" → { value: "#3B82F6", file: "styles/tokens.css", line: 8 }
```

### Engine Source Structure

```
src/
  engine/
    index.ts              — ZerosEngine class, lifecycle management
    server.ts             — HTTP + WebSocket server on single port
    css-resolver.ts       — Selector → file:line resolution via PostCSS
    css-writer.ts         — Atomic file writing with format preservation
    tailwind-writer.ts    — Tailwind class manipulation in JSX/TSX
    oc-manager.ts         — .0c file CRUD (create/read/update/delete)
    watcher.ts            — @parcel/watcher wrapper with debounce
    mcp.ts                — MCP server with 5 tools, Streamable HTTP
    framework-detector.ts — Detect React/Vue/Svelte/Next/etc.
    discovery.ts          — Find CSS files, .0c files, config files
    cache.ts              — Selector index, file cache, token index
    types.ts              — Shared types for engine ↔ overlay messages

  cli.ts                  — CLI entry point: npx Zeros serve
  
  vite-plugin.ts          — Optional Vite wrapper (starts engine in-process)
```

### CLI Interface

```bash
# Start the engine (primary command)
npx Zeros serve
npx Zeros serve --port 24193
npx Zeros serve --root /path/to/project

# Create a new .0c project file
npx Zeros init
npx Zeros init --name "My App"

# Check engine status
npx Zeros status
```

The CLI is minimal. `serve` is the only command most users ever run.

### Graceful Lifecycle

```
Startup:
  → Detect project root
  → Build indexes
  → Start server
  → Write .zeros/.port
  → Write .mcp.json (if missing)
  → Ready

Running:
  → Watch files, update indexes incrementally
  → Handle WebSocket messages from browser
  → Handle MCP requests from AI tools
  → Auto-save .0c files when browser sends updates

Shutdown (SIGTERM / SIGINT / SIGHUP):
  → Stop accepting connections
  → Close WebSocket clients gracefully
  → Stop file watcher
  → Remove .zeros/.port
  → Exit
```

---

## 5. The .0c File — Living Design Document

### Lifecycle — Created and Managed from the UI

The .0c file is NOT created by a CLI command or manually. It's created from the browser overlay:

```
User opens app in browser
  → Presses Ctrl+Shift+D
  → Zeros overlay appears
  → If no .0c file exists: "Create a new design project?"
  → User clicks "Create" and names it
  → Engine creates the .0c file in the project root
  → File appears in git status immediately
```

**Delete from UI:**

```
User opens project settings in overlay
  → Clicks "Delete Project"
  → Confirmation dialog: "This will remove the .0c file from your codebase"
  → Engine deletes the file from disk
  → File disappears from git status
```

**Multiple .0c files:** A codebase can have multiple `.0c` files (e.g., `homepage.0c`, `dashboard.0c`). The overlay shows a project switcher.

### What the .0c File Stores

Everything needed to restore the designer's workspace:

```typescript
{
  // Project metadata
  project: { id, name, createdAt, updatedAt, revision },
  
  // Codebase context (auto-detected by engine)
  workspace: { root, framework, entryFiles },
  
  // The designer's work
  variants: DesignVariant[],        // Design explorations
  changes: DesignChange[],          // Style/text/layout changes on the main app
  themeFiles: ThemeFileEntry[],     // Imported CSS token files
  themeChanges: ThemeChange[],      // Token value modifications
  feedback: FeedbackItem[],         // Comments and annotations
  
  // Workspace state
  breakpoints: { desktop, laptop, tablet, mobile },
  history: { checkpoints: Checkpoint[] },
  
  // Integrity
  integrity: { hash, generator }
}
```

### What the .0c File Does NOT Store

- API keys (stored in engine's local config or cloud)
- User authentication tokens (stored in cloud)
- Binary assets (images stay in the codebase)
- Computed styles (derived from the live app)
- Full HTML snapshots (changesets replace blobs — see V1 Section 7)

### Persistence Model — File-First

V1 used IndexedDB as the fast layer with .0c as backup. **V2 inverts this:**

```
V1: IndexedDB (primary) ←→ .0c file (backup)
V2: .0c file (primary, on disk) ←→ Engine memory (fast cache)
```

The engine keeps the current project state in memory for instant responses. Every change is written to the .0c file on disk within 500ms (debounced auto-save). The .0c file on disk is always the source of truth.

**Why this change:**
- No more IndexedDB permission issues across different localhost ports
- No more "browser data cleared, all work lost" scenarios
- The file is always in git, always portable, always recoverable
- The engine (not the browser) manages persistence — more reliable

**IndexedDB still used for:** UI state only (scroll position, panel sizes, which panel is open). Not design data.

---

## 6. Browser Overlay — A Design Tool, Not a Dev Tool

### What the User Sees

When the user presses `Ctrl+Shift+D`, a full design tool appears:

```
┌──────────────────────────────────────────────────────────────────┐
│ Toolbar: [Select] [Inspect] [Responsive ▼] [AI Chat]     [Save] │
├──────────────────────────────────────────────────────────────────┤
│                                               │ Property Panel   │
│                                               │ ┌──────────────┐│
│                                               │ │ .hero-section││
│    Live App Preview                           │ │              ││
│    (the actual running application)           │ │ ▾ Size       ││
│                                               │ │ ▾ Layout     ││
│    Click any element to select it             │ │ ▾ Text       ││
│    Drag handles to resize                     │ │ ▾ Background ││
│    Double-click to edit text                  │ │ ▾ Effects    ││
│                                               │ │ ▾ Borders    ││
│                                               │ │              ││
│                                               │ │ ── Changes ──││
│                                               │ │ ① bg: ■→■    ││
│                                               │ │ ② size: 32→48││
│                                               │ └──────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### What the User Does NOT See

- No "MCP Connected" indicator
- No WiFi/connection status icons
- No "Engine Status" panel
- No "IDE & Agents" settings section
- No WebSocket status
- No port numbers
- No "Bridge" or "Relay" mentions
- No technical error codes

### Error States — Human Language Only

| Situation | What the user sees |
|-----------|-------------------|
| Engine not running | "Start the Zeros engine to enable design editing. Run: `npx Zeros serve`" |
| Engine disconnected mid-session | "Reconnecting..." (auto-retries silently). After 10s: "Connection lost. Your changes are saved locally." |
| CSS write failed | "Couldn't update [filename]. The file may be read-only." |
| .0c file conflict | "This design file was modified externally. Reload?" |

### Settings Page — Simplified

The settings page contains:

1. **AI Settings** — Provider selection and API key (for direct AI features)
2. **Project** — Project name, framework info (read-only, auto-detected)
3. **About** — Version, links

**Removed from V1:**
- ~~IDE & Agents section~~ — AI tools connect automatically via MCP
- ~~Connection status indicators~~ — Engine connection is invisible when working
- ~~Auto-send feedback toggle~~ — Feedback flows through the standard design workflow

---

## 7. AI Integration — Invisible and Powerful

### How AI Tools Connect

The engine starts an MCP server on the same port as the WebSocket. AI tools discover it through config files:

**Auto-generated `.mcp.json`** (engine creates this on first run):

```json
{
  "mcpServers": {
    "Zeros": {
      "type": "http",
      "url": "http://localhost:24193/mcp"
    }
  }
}
```

This file is compatible with Claude Code, Cursor, and other MCP-aware tools. The engine also generates `.vscode/mcp.json` for VS Code Copilot compatibility.

**The user never configures this.** The engine writes the files. The AI tools read them. Connection happens automatically.

### MCP Tools Exposed

| Tool | What it does | Who uses it |
|------|-------------|-------------|
| `Zeros_read_design_state` | Returns the .0c project file | AI agents wanting design context |
| `Zeros_get_element_styles` | Computed styles + source location for a selector | AI agents making targeted CSS changes |
| `Zeros_list_tokens` | All CSS custom properties (design tokens) | AI agents working with the design system |
| `Zeros_get_feedback` | Pending feedback/change items | AI agents processing design requests |
| `Zeros_apply_change` | Write a CSS change to source + notify browser | AI agents executing design changes |

### AI Chat in the Overlay

The overlay includes an AI chat panel. When the user types a design request:

```
User: "Make the hero section feel more premium"

→ Engine builds context: selected element, computed styles, design tokens, 
  nearby elements, .0c project state
→ Sends to configured AI provider (OpenAI API, or routes through MCP to 
  connected IDE agent)
→ AI responds with specific CSS changes
→ Engine applies changes to source files
→ Browser hot-reloads
→ User sees the result immediately
```

The AI provider is configured once in settings. After that, the user just chats.

### API Key Storage

API keys for direct AI features (OpenAI, Anthropic) are stored:

1. **In the engine's local config:** `~/.zeros/config.json` (user-global, never committed to git)
2. **In environment variables:** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (standard convention)
3. **In the cloud account:** (future, after auth is implemented) encrypted, per-user

API keys are NEVER stored in the codebase, the .0c file, or any git-tracked file.

---

## 8. Auth, Cloud & Data Strategy

### When Auth is Implemented

Auth and login are the **last implementation**, after the core design tool experience is complete and polished. The tool must work fully without login first.

### What Changes With Auth

| Without login (free, local) | With login (paid, cloud-synced) |
|---|---|
| Engine runs locally, full design capability | Same + cloud features |
| .0c files saved to disk only | .0c file metadata synced to cloud (not file content) |
| AI via BYOK (bring your own key) | AI credits included in subscription |
| Single user | Team collaboration (async) |
| No usage tracking | Usage analytics for the user |

### Data Separation — What Goes Where

**Stays LOCAL (in the codebase, in git):**

| Data | Storage | Reason |
|------|---------|--------|
| `.0c` project files | Disk (project root) | Design data belongs with the code. Version-controlled. Diffable. |
| CSS/source file changes | Disk (the actual source files) | This IS the production code. |
| Design tokens | Disk (CSS files) | Tokens are code. |

**Stays LOCAL (on the user's machine, NOT in git):**

| Data | Storage | Reason |
|------|---------|--------|
| API keys | `~/.zeros/config.json` | Security. Never in a repo. |
| Auth tokens | `~/.zeros/auth.json` | Session management. |
| Engine preferences | `~/.zeros/config.json` | User-specific settings. |
| UI state | Browser localStorage | Panel positions, theme preference. |

**Goes to CLOUD (database, after auth):**

| Data | Storage | Reason |
|------|---------|--------|
| User account | Cloud DB | Authentication, identity. |
| Team membership | Cloud DB | Collaboration, access control. |
| Subscription/billing | Cloud DB | Payment processing, plan limits. |
| API key vault (encrypted) | Cloud DB | Secure, cross-device API key access. |
| Bug/feedback tracking | Cloud DB | Team visibility, status tracking across sessions. |
| Usage metrics | Cloud DB | Analytics, rate limiting, plan enforcement. |
| .0c file registry | Cloud DB | "Which .0c files exist in which repos" — metadata only, not content. |
| Shared variant links | Cloud DB | Shareable URLs to view specific design variants. |

**The cloud NEVER stores:**
- Actual .0c file content (that's in git)
- Source code (that's in the codebase)
- Full design snapshots (that's in the .0c file)

The cloud is for **identity, collaboration metadata, and secure storage**. The design work stays in the codebase.

### Auth Flow

```
User opens Zeros overlay
  → Overlay works fully without login (free tier)
  
User wants cloud features (sync, team, AI credits)
  → Clicks "Sign In" in the overlay
  → OAuth popup (GitHub / Google)
  → Token stored locally in ~/.zeros/auth.json
  → Engine sends token with cloud API requests
  → Cloud features activate
```

Login is unobtrusive. The overlay never blocks the user or forces login. It's always available as an option, never a gate for basic functionality.

---

## 9. Monetization & Pricing

### Open-Core Model

The core overlay and engine are open source (MIT). Revenue comes from cloud services and premium features.

| Tier | Price | What You Get |
|------|-------|-------------|
| **Free** | $0 | Full engine + overlay. Local .0c files. BYOK for AI. Single user. |
| **Pro** | $12-15/month | AI credits (no BYOK needed). Cloud API key vault. Bug/feedback tracking in cloud. Priority support. |
| **Team** | $25-30/user/month | Shared .0c file registry. Team feedback dashboard. Shared variant links. Role-based access. SSO. |
| **Enterprise** | Custom | Self-hosted cloud. SAML. Audit logs. Dedicated support. Custom integrations. |

### Why This Works

1. **Free tier is genuinely useful.** The full design tool works without paying. This drives adoption.
2. **Cloud features are the natural upgrade.** "I want my API key on all my devices" → Pro. "My team needs to see feedback" → Team.
3. **AI costs are real.** Including AI credits justifies the subscription — it costs us money to proxy LLM calls.
4. **Open source core builds community.** Contributors improve the tool. Users evangelize it.

### Protection Against Forks

The open-source core creates the community. The cloud services are the moat. Someone can fork the overlay, but they can't fork the user base, the cloud infrastructure, or the team collaboration features.

---

## 10. Phase 1 Roadmap

Phase 1 is about building the universal engine and proving the core experience works.

### Phase 1A: The Engine (Weeks 1-3)

**Goal:** `npx Zeros serve` works. Browser overlay connects. CSS changes write to source files.

| Task | Priority | Notes |
|------|----------|-------|
| Create `src/engine/` module | Critical | Migrate CSS resolver + writer from VS Code extension to pure Node.js |
| Build `src/cli.ts` entry point | Critical | `npx Zeros serve --port 24193` |
| HTTP + WebSocket on single port | Critical | Node.js `http` + `ws`, no framework |
| CSS selector index (PostCSS) | Critical | Parse all CSS files, build Map<selector, location> |
| Incremental file watching | Critical | @parcel/watcher, re-parse only changed files |
| .0c file manager | Critical | Create/read/write/delete from engine |
| Atomic CSS file writing | Critical | Write-tmp-rename, preserves formatting |
| Update `<Zeros />` component | Critical | Connect to engine WebSocket instead of Vite plugin relay |
| Tailwind class writer | High | Modify className in JSX/TSX files |
| Framework detection | Medium | Auto-detect React/Vue/Svelte/Next/Nuxt/Astro |

### Phase 1B: MCP Integration (Week 4)

**Goal:** AI tools auto-discover and connect to Zeros. No configuration needed.

| Task | Priority | Notes |
|------|----------|-------|
| MCP server with Streamable HTTP transport | Critical | Mount on engine's HTTP server at `/mcp` |
| Auto-generate `.mcp.json` | Critical | Written to project root on engine startup |
| Auto-generate `.vscode/mcp.json` | High | For VS Code Copilot compatibility |
| Implement 5 MCP tools | Critical | read_design_state, get_element_styles, list_tokens, get_feedback, apply_change |
| Test with Claude Code | Critical | `claude mcp add` → verify tools work |
| Test with Cursor | High | Verify auto-discovery from `.mcp.json` |

### Phase 1C: Clean Up the Overlay (Week 5)

**Goal:** Remove all technical indicators. The overlay is a design tool, nothing else.

| Task | Priority | Notes |
|------|----------|-------|
| Remove WiFi/connection status icons | Critical | From style-panel.tsx, color-editor.tsx |
| Remove "IDE & Agents" settings section | Critical | From settings-page.tsx |
| Remove MCP status indicators | Critical | Any remaining MCP badges or mentions |
| Simplify error states | Critical | Human-readable messages only |
| .0c file creation from overlay UI | High | "New Project" button → engine creates file |
| .0c file deletion from overlay UI | High | "Delete Project" → engine removes file |
| Project switcher (multiple .0c files) | Medium | Dropdown in toolbar |
| Simplify settings page | Medium | AI Settings + Project + About only |

### Phase 1D: Polish & Validate (Week 6)

**Goal:** Test on 10+ real projects. Fix edge cases. The experience is solid.

| Task | Priority | Notes |
|------|----------|-------|
| Test on real React project (e.g., cal.com) | Critical | Large, Tailwind-based, complex |
| Test on Vue project | Critical | Verify framework-agnostic claim |
| Test on Svelte project | High | Different compile model |
| Test on Next.js project | High | SSR + client, App Router |
| Test on plain HTML/CSS project | High | No framework, no bundler |
| Fix edge cases found in testing | Critical | Expect 10-20 issues |
| Performance profiling | Medium | Verify <35MB memory, <10ms response |
| Write setup documentation | Medium | README with install + usage |

### Phase 1E: Vite Plugin Wrapper (Week 7)

**Goal:** Optional one-command experience for Vite users.

| Task | Priority | Notes |
|------|----------|-------|
| Simplify `vite-plugin.ts` to wrap engine | Medium | Starts engine in-process, no separate terminal |
| Auto-inject overlay script | Low | `transformIndexHtml` adds the import |

### Phase 1F: Auth & Cloud (Future — After Phase 1 is solid)

**Goal:** Login, cloud sync, team features. This is the LAST thing built.

| Task | Priority | Notes |
|------|----------|-------|
| OAuth flow (GitHub, Google) | Future | In the overlay, not a separate page |
| Cloud API for bug/feedback tracking | Future | Team-visible feedback dashboard |
| API key vault | Future | Encrypted, per-user, cross-device |
| Subscription management | Future | Stripe integration |
| Team collaboration features | Future | Shared variant links, role-based access |

---

## 11. Decisions Log

### Decision 1: Engine-First, Not Extension-First

**Date:** 2026-04-15
**Decision:** Build the engine as a standalone Node.js CLI process, not a VS Code extension.
**Rationale:** The VS Code extension approach locks out Claude Code, Codex, Lovable, Bolt, Replit, terminal-only workflows, and every non-VS-Code IDE. The standalone engine works with everything.
**Trade-off:** Users run two commands (`npm run dev` + `npx Zeros serve`) instead of one. Mitigated by the Vite plugin wrapper and npm script patterns.

### Decision 2: CLI-First, Not Vite-Plugin-First

**Date:** 2026-04-15
**Decision:** Build the standalone CLI as the primary distribution, with the Vite plugin as an optional convenience wrapper.
**Rationale:** The Vite plugin only works with Vite. The CLI works with Vite, Webpack, Next, Nuxt, Astro, Rspack, plain HTML, and any current or future bundler. The filesystem is the universal bridge — the engine writes files, any dev server's watcher picks them up.
**Trade-off:** Slightly more setup friction for Vite users. Mitigated by the optional Vite plugin.

### Decision 3: No Technical UI

**Date:** 2026-04-15
**Decision:** Remove all MCP status indicators, connection badges, WebSocket status, WiFi icons, and "IDE & Agents" settings from the overlay UI.
**Rationale:** Zeros is a design tool. Designers don't care about MCP protocols or WebSocket states. Technical details should be invisible when working and human-readable when broken.
**Trade-off:** Harder to debug connection issues. Mitigated by clear error messages and `npx Zeros status` CLI command for diagnostics.

### Decision 4: .0c Files on Disk, Not IndexedDB

**Date:** 2026-04-15
**Decision:** The .0c file on disk (managed by the engine) is the primary persistence layer. IndexedDB is only used for ephemeral UI state.
**Rationale:** V1's IndexedDB-primary approach had failure modes: different localhost ports lost data, browser data clearing lost work, no portability. The file on disk is always in git, always portable, always recoverable. The engine (not the browser) manages persistence.
**Trade-off:** Requires the engine to be running for persistence. If the engine stops, unsaved changes in the overlay's memory are lost. Mitigated by aggressive auto-save (500ms debounce).

### Decision 5: Cloud Stores Metadata, Not Design Data

**Date:** 2026-04-15
**Decision:** The cloud database stores identity, billing, API keys, and collaboration metadata. It NEVER stores .0c file content or source code.
**Rationale:** Design data belongs in the codebase, version-controlled with git. Storing it in the cloud creates sync conflicts, data ownership questions, and adds complexity without value. The cloud adds value through identity, security, and team features — not by duplicating what git already does.

### Decision 6: Auth is Last

**Date:** 2026-04-15
**Decision:** Authentication and cloud features are the last thing implemented, after the core design tool experience is complete and validated.
**Rationale:** The tool must be genuinely useful without login. If the free, local-only experience isn't compelling, adding a login wall won't make it better. Auth is a monetization feature, not a product feature. Ship the product first.

---

## Appendix: V1 → V2 Migration Notes

### Files to Migrate from VS Code Extension

| Extension File | Migrates To | Changes Needed |
|---|---|---|
| `css-source-resolver.ts` | `src/engine/css-resolver.ts` | Replace `vscode.workspace.findFiles()` with `tinyglobby`. Replace `vscode.Uri` with plain paths. |
| `css-file-writer.ts` | `src/engine/css-writer.ts` | Already pure Node.js. Copy directly. |
| `tailwind-writer.ts` | `src/engine/tailwind-writer.ts` | Check for VS Code API usage, replace if found. |
| `mcp-server.ts` | `src/engine/mcp.ts` | Switch from stdio to Streamable HTTP transport. Remove `vscode.workspace.findFiles()`. |
| `messages.ts` | `src/engine/types.ts` | Already pure TypeScript types. Copy directly. |
| `ai-context.ts` | `src/engine/ai-context.ts` | Already pure logic. Copy directly. |

### UI Elements to Remove

| File | Element to Remove |
|---|---|
| `style-panel.tsx` | WiFi/WifiOff icons, connection status indicator |
| `color-editor.tsx` | WiFi/WifiOff icons, connection status indicator |
| `settings-page.tsx` | "IDE & Agents" section entirely |
| `agent-panel.tsx` | Entire panel (replaced by simplified AI chat) |
| `store.tsx` | `wsStatus`, `wsLogs`, `wsPort` state fields |

### Files to Deprecate

| File/Directory | Action |
|---|---|
| `extensions/vscode/` | Freeze. Do not delete — may become optional enhancement later. |
| `src/zeros/bridge/` | Remove after engine migration. Bridge logic moves to engine. |
| `.zeros/.port` | Still used, but written by engine instead of Vite plugin. |
