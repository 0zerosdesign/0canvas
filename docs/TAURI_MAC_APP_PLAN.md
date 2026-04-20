# 0canvas → Tauri Mac App (Mac-only, browser overlay sunset)

> **📌 Status (2026-04-20):** This is the execution plan behind
> [PRODUCT_VISION_V3.md](PRODUCT_VISION_V3.md). Phases 0, 1A, 1B, 1C,
> 2, and 4 (WIP) have shipped to `main`. Phase 3 partly shipped
> (`git2-rs` git panel is done; clone flow, worktrees, conflict UX
> still pending). Phase 5 (signed distribution) is gated on completion
> of Streams 2-5 in the V3 TODO. Each phase below carries a ✅/🚧/⏳
> marker and the date/commit where possible. See §TODO at bottom for
> the current work queue.

## Context

**Decision (locked):** 0canvas becomes a Mac-only native app built on Tauri. The existing npm browser-overlay (`@zerosdesign/0canvas`) is sunsetted. The VS Code extension stays frozen. All future development targets one surface: a direct-download Mac app that designers install to edit production code visually with AI.

**Why this simplification wins:**
- Testing matrix collapses from `N IDEs × M frameworks × 3 browsers × React versions × Tailwind configs` to `1 platform × M frameworks`
- Brand promise "it just works" becomes *keepable* — you control every dependency from pixel to file-write
- npm supply-chain risk and host-bundler conflicts eliminated
- Single code path, single user funnel, single support surface
- All current overlay pain points disappear on Mac: manual `theme.css` upload → auto file-watch; IDB size limits → real files; iframe z-index wars → own window; browser-API gaps → full OS access
- Solo-dev focus: one product, one ship

**What we're giving up (accepted tradeoffs):**
- Cloud-IDE users (Lovable/Replit/Bolt/StackBlitz) — can't install native app in their sandbox. They're mostly greenfield app-builders anyway; wrong fit for brownfield editing.
- Windows/Linux at launch — Tauri cross-compiles so this is a Phase 6 problem, not a "never" problem
- Viral npm distribution — trade for cleaner, measurable downloads
- Existing npm users (if any) — clean sunset with free Pro licenses as migration path

**Feature contract — nothing regresses.** Every capability in the current codebase continues to work in the Mac app. The research inventory produced a 20-section list covering ~60 files; the Mac app's Phase 1 exit criteria is 100% of today's functionality running natively, before any new features are added.

**Inspiration landscape (verified):**
- **Clonk** (`clonk.ai`, also known as Komand) — **primary model for Mac app UX, pricing, and agent workflow.** Native Mac app, direct DMG from GitHub, no App Store. BYO-subscription pricing (Free with user's keys / $6.90 Lite / $59 Pro one-time). Skills system as markdown (`.claude/skills/`). Git worktrees for parallel agents. Claims "$1/app with BYO-keys vs $3,000+ elsewhere." Key difference: Clonk is **greenfield** (prompt → new app); 0canvas is **brownfield** (existing repo → visual edits). Adopt their shell, pricing, skills system, worktree pattern — reject their 1-shot app generator and boilerplate picker.
- **Onlook** (`onlook.com`) — "Cursor for Designers." Visual editor on real Next.js + Tailwind code. Web-container-based (CodeSandbox SDK). Validates the visual-editing-on-production-code philosophy. We're choosing native over web for the reasons above.
- **Commander** (`thecommander.app`) — Native Swift Mac app (~30 MB). Diff viewer, git worktree management, spawned coding-agent CLIs (Claude Code, Codex, OpenCode). Validates the "spawn `claude-code` as subprocess + worktree-parallel agents" pattern.
- **Tauri vs Electron (2026):** Tauri wins on bundle size (~2–10 MB vs 80–200 MB), RAM (~50% less), cross-platform reach, and native feel. Effort gap is closed when you're not afraid of ~500 lines of Rust glue.

---

## Positioning (refined)

0canvas is not a "design tool." It's a **design-first Mac app for people who ship production code** — designers editing real repos, AND solo developers / indie hackers who want a visual-canvas + AI-agent workflow that doesn't fight their existing habits. The addressable audience is everyone doing design-adjacent work on a real codebase.

| Persona | How they use 0canvas | What they need that others don't |
|---|---|---|
| **Designer on real code** (no git comfort) | Visual edits via canvas → chat says "save my changes" → done | Minimal git UI (branch pill, Save Changes button), everything else handled by agent |
| **Solo developer / indie hacker** | Primary IDE-lite for shipping a product. Canvas for UI work, integrated terminal + git panel + env editor for dev work, agent for everything in between | Feature parity with the power-user subset of VS Code (terminal, env, agents), without the cognitive overhead |
| **Design-eng pair** | Designer edits in canvas, engineer reviews diffs in same app or pulls the branch in their own IDE | No vendor lock-in. Git repo is the shared source of truth. |

The product must keep a clean designer on-ramp while exposing every developer-grade capability (integrated terminal, env editor, full git operations, multi-agent worktrees). These are NOT in tension: we hide developer panels behind tabs; designers who never open the Terminal tab never encounter it.

**0canvas is not a VS Code fork.** It coexists with any IDE the user already runs. See the "VS Code & Other IDEs — Coexistence, Not a Fork" section below.

---

## Locked Decisions

1. **Framework:** Tauri + Node sidecar (engine runs unchanged as child process)
2. **Distribution:** Direct download only. **Apple Developer ID ($99/yr) signed + notarized at launch** — no compromise on security. `tauri-plugin-updater` (Sparkle-style) auto-update via GitHub Releases with cryptographic signing. **No App Store** — sandbox would block the agent CLI runner. **During development (Phases 0–4):** use ad-hoc signing or Tauri's built-in dev signing — no Dev ID needed until Phase 5 distribution polish. Dev ID only purchased when preparing the public launch build.
3. **Scope:** Full vision v0.1 — native shell + three-column UI + full feature parity with today + git + embedded terminal + env editor + todo + Claude/OpenAI BYO-key + agent runner + skills system + worktree parallel agents
4. **Repo structure:** Single-app monorepo (not a multi-surface workspace) — details below
5. **Target audience:** Designers AND solo developers / indie hackers. The visual canvas is the differentiator; the IDE-lite underneath is table stakes.
6. **UI shell:** Three-column layout — (1) collapsible navigation, (2) tabbed agent workspace (Chat/Git/Terminal/Env/Todo), (3) design canvas. See "UI Architecture" section.
7. **Git UX (dual-track):** Simple visual panel for the 80% common ops (branch, stage, commit, push, pull, diff). Agent chat + integrated terminal for the power-user 20% (rebase, cherry-pick, stash, conflict resolution). No Monaco, no code editor view; the repo's text editing lives in the user's own editor or in agent operations.
8. **AI:** Prefer Claude CLI via Max subscription (zero API cost), `@anthropic-ai/sdk` API-key fallback, OpenAI as alt provider (incl. ChatGPT Pro via Codex path per Clonk). Keys in macOS keychain.
9. **Pricing model:** One-time tiered (Free with BYO-key / ~$59 Pro) — no monthly SaaS. Copy Clonk's model.
10. **Skills:** Markdown files at `.0canvas/skills/*.md`. User/community-extensible. No rebuild to add skills.
11. **Parallel agents via git worktrees** — the Mac app's killer differentiator the overlay literally cannot have.
12. **Embedded terminal:** `tauri-plugin-pty` + `xterm.js` in the webview. Multiple sessions, respects the opened project's cwd, is the universal power-user escape hatch.
13. **VS Code coexistence (not fork):** Users can run VS Code/Cursor/Windsurf/Zed alongside 0canvas on the same repo. Git is the shared source of truth. 0canvas works whether or not those editors are installed.
14. **Browser overlay sunset:** final `0.0.x` release, deprecate on npm, repo banner pointing to Mac app, migration guide for any existing users.

---

## Architecture — Tauri + Node Sidecar

```
┌───────────────────────────────────────────┐
│ Tauri App (0canvas.app)                   │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │ WKWebView (React UI)                │  │
│  │  - All existing src/0canvas/** code │  │
│  │  - Direct Tauri API access          │  │
│  │  - Talks to engine via ws://        │  │
│  └────────────┬────────────────────────┘  │
│               │ localhost WS              │
│  ┌────────────▼────────────────────────┐  │
│  │ Node Sidecar (engine)               │  │
│  │  - All existing src/engine/** code  │  │
│  │  - WS on 127.0.0.1:24193            │  │
│  │  - MCP server on /mcp               │  │
│  │  - @parcel/watcher, PostCSS, etc.   │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │ Rust Core (src-tauri)               │  │
│  │  - git2-rs (git ops)                │  │
│  │  - security-framework (keychain)    │  │
│  │  - shell::spawn (claude/codex CLI)  │  │
│  │  - fs/dialog/menu/updater           │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

**Three-process model inside one signed Mac app:**
- **Rust core** handles windowing, menus, file dialogs, keychain, git (via `git2-rs`), auto-update, and spawning external CLIs.
- **Node sidecar** is the existing V2 engine, launched at app startup via `Command::sidecar`. Runs unchanged from today's `npx 0canvas serve`.
- **Webview** renders the React UI — same components as today, but with native Tauri APIs available directly (no `PlatformAdapter` abstraction needed anymore).

**Why no `PlatformAdapter` layer anymore:** the adapter pattern existed to gate features between browser and Mac. With browser dead, there's nothing to gate. Delete the abstraction, call Tauri APIs directly. Less code, less indirection, less debug surface.

---

## UI Architecture — Three-Column Layout

Inspired by Clonk's shell pattern, adapted to foreground 0canvas's unique differentiator (the design canvas). The three columns are independent; only Column 2 and Column 3 are required for daily work. Column 1 can collapse to an icon rail.

```
┌──────────────┬────────────────────────┬──────────────────────────────────┐
│ COLUMN 1     │ COLUMN 2               │ COLUMN 3                         │
│ Navigation   │ Agent Workspace        │ Design Canvas                    │
│ (collapsible)│ (tabbed panel)         │ (primary differentiator)         │
├──────────────┼────────────────────────┼──────────────────────────────────┤
│ Logo         │ ┌──────────────────┐   │ ┌──────────────────────────────┐ │
│ + New Chat   │ │ 💬 📂 >_ 🔑 ☑   │   │ │ [Browser preview tabs...]    │ │
│ ⚡ Skills    │ └──────────────────┘   │ └──────────────────────────────┘ │
│              │ Chat│Git│Term│Env│Todo │                                  │
│ CHATS        │                        │   ReactFlow infinite canvas      │
│ 📁 project-1 │ [active panel content] │   ┌─────┐   ┌─────┐   ┌─────┐    │
│   Chat 1     │                        │   │ src │──▶│ v1  │──▶│ v2  │    │
│   Chat 2     │                        │   └─────┘   └─────┘   └─────┘    │
│ 📁 project-2 │                        │                                  │
│              │                        │   [Theme panel, style panel,     │
│              │                        │    inspector — contextual]       │
│ ───────────  │                        │                                  │
│ TERMINALS  2 │                        │                                  │
│ LOCALHOST 28 │                        │                                  │
│  :5432       │                        │                                  │
│  :24193      │                        │                                  │
│              │                        │                                  │
│ ───────────  │                        │                                  │
│ 🔔 What's new│                        │                                  │
│ 👤 arunrk    │                        │                                  │
└──────────────┴────────────────────────┴──────────────────────────────────┘
```

### Column 1 — Navigation (collapsible)

Fixed to ~260px when expanded, collapses to ~48px icon rail. Top-right corner has the collapse toggle.

- **Top:** 0canvas logo. Beneath: `+ New Chat` button, `⚡ Skills` link (opens skills browser in column 2).
- **CHATS section:** nested tree — folders (e.g. a project = folder), chats within each folder. Selected chat sets column 2's Chat tab context. Folder icon `+` adds a new folder.
- **TERMINALS:** count badge; clicking opens the Terminal tab in column 2 and switches to that session.
- **LOCALHOST:** auto-discovered local services (the engine's own `:24193`, any dev server the user ran via integrated terminal, postgres, etc.). Click an entry to open it as a preview tab in column 3.
- **Bottom:** "What's new" (version changelog link), profile avatar with menu → **How to** (docs) · **Settings** (full page) · **Logout**.

State persistence: which folder is expanded, current active chat, collapse state → `~/Library/Application Support/0canvas/ui-state.json` via `src/native/settings.ts`.

### Column 2 — Agent Workspace (tabbed)

Fixed to ~440px wide (resizable). Top icon bar switches between 5 panels. Each panel keeps its own state across switches.

**a. 💬 Chat** (default on first launch)
- Conversation thread with the active agent (Claude Max CLI / Claude API / OpenAI)
- Provider dropdown + model switcher + adaptive-thinking-effort pills (Low / Medium / High / xHigh) for Claude
- Skill picker inline (e.g. "/audit-contrast")
- Input box with `@file` reference, `@element` reference (pulls from column 3 selection), `@skill` invocation
- Streaming responses with inline CSS/code application (carry forward today's inline-edit pattern)
- Agent-run subcommands render as cards (e.g. "Ran `git commit -m ...` → success")

**b. 📂 Git**
- Top: current branch as a pill (click → branch switcher), **Pull** and **Push N** buttons (N = ahead count)
- Tabs: **Unstaged (N) | Staged (M)**
- File list per tab: click → shows visual diff in column 3 (token-level / style-level for `.css`, text diff for other files)
- Bottom: commit message textarea (agent auto-suggests from `EngineCache` changes) + **Commit** button
- **FILES** sub-section (right-side in our version, or as expandable section) — raw file list with green/red/yellow status icons, same as Clonk screenshot 1
- **RECENT COMMITS** collapsible section at bottom — last 10 commits with hash, message, relative time
- Power ops (rebase, cherry-pick, stash, conflict resolution): not in this UI. User either asks the agent in Chat or runs in Terminal tab.

**c. `>_` Terminal**
- `xterm.js` pty via `tauri-plugin-pty`. User's shell (zsh default), colors, unicode, mouse all work.
- Multiple sessions via tabs inside this panel; LOCALHOST badge in column 1 increments.
- Working directory = currently opened project's root. Inherits `PATH` so `claude`, `codex`, `gh`, `npm`, etc. all resolve.
- "+ New Terminal" button top-right of panel.

**d. 🔑 Env**
- Tabs for each env file found in the repo: `.env.local` / `.env` / `.env.development` etc.
- Variable table: key | value (masked, click-to-reveal) | remove button
- `+ Add Variable` button. Save writes atomically to the real file.
- Warning banner if the file is `.gitignore`'d correctly (reassurance for designers).

**e. ☑ Todo**
- Simple markdown-backed task list stored at `.0canvas/todo.md` (or per-chat in the chat metadata).
- Checkboxes, drag-reorder, keyboard shortcuts.
- Agent can write/update this file via Chat → items appear live.
- This is the lightweight "what's next" panel — not a Linear/Jira replacement.

### Column 3 — Design Canvas (primary differentiator)

Fills remaining width. This is where **all current 0canvas functionality lives** — nothing from today's overlay is dropped. High level:

- **Top tab bar** — like today, but now includes: Browser Preview (default when project has a dev server running, the "http://localhost:XXXX" type tab), plus user-created canvas tabs. Per-tab state persisted.
- **ReactFlow infinite canvas** — unchanged from today. Source node + variant nodes, auto-layout, pan/zoom, minimap, selection.
- **Inspector overlays** — hover/select, fork pills, feedback pills (all current code paths preserved).
- **Style panel** — 35+ CSS properties across 5 category tabs, inline edit, code view. Floats/docks on the right inside column 3.
- **Theme panel** — design tokens, multi-theme columns, two-way file sync (now via native fs + @parcel/watcher, no more manual upload).
- **Variant system** — fork page/component/variant, status machine (draft → finalized → sent → pushed), visual diff.
- **Feedback system** — element pills, waitlist drawer.
- **Inline edit / AI overlays** — Cmd+K quick edit still works, tied to the current chat session in column 2.

Column 3 can be hidden for a "chat + terminal only" workflow (e.g. when the user just wants to run agent tasks and review diffs). Minimum width enforced so nodes stay readable.

### Cross-column interactions (key flows)

- Click an element in Column 3 → highlights in column 3, pipes a `@element` chip into Column 2 Chat input
- Agent in Column 2 Chat writes a file → Column 3 hot-reloads via `@parcel/watcher` → visual updates instant
- Switch chat in Column 1 → Column 2 Chat rebinds to that conversation; Column 2 Git/Terminal/Env stay the same (they're workspace-scoped, not chat-scoped)
- "Run in worktree" skill spawns 3 parallel agents → Column 3 renders 3 variant nodes live → user picks one → Git panel in Column 2 shows the merge

---

## VS Code & Other IDEs — Coexistence, Not a Fork

A common confusion worth addressing explicitly: **0canvas does not fork, replace, or depend on VS Code.**

- 0canvas opens a **local folder** that happens to be a git repo. That folder was put there by whatever means the user chose — `git clone` in terminal, GitHub Desktop, VS Code's clone UI, or 0canvas's own "Clone from GitHub URL" button (Phase 4).
- 0canvas performs git operations via `git2-rs` (Rust bindings to libgit2, the same library VS Code's git extension uses underneath). Independent of any editor.
- Users can run VS Code, Cursor, Windsurf, Zed, or IntelliJ alongside 0canvas on the same repo. Both edit files, both respect git, no conflicts — because git is the shared source of truth.
- The user's terminal inside 0canvas is a real shell with real `$PATH` — `code .`, `cursor .`, `claude`, `codex`, `gh` all just work if installed.
- 0canvas does **not** ship a code editor. When a user wants to edit code text directly, they:
  1. Ask the agent in Chat (which edits via tools)
  2. Run `code .` in the integrated terminal to open their preferred editor
  3. Use an external editor they already have open
- **No VS Code extension is needed** on the 0canvas side. The frozen `extensions/vscode/` directory is not revived.

This keeps 0canvas's scope focused: we are **the design canvas + the agent workspace + the git/env/terminal utility belt** — not another IDE trying to replace the user's chosen editor.

---

## Settings Page Spec

Accessed via profile menu → Settings. Full-page overlay (hides the three-column shell). Left sidebar + detail panel. "← Back to app" top-left.

**Sidebar sections (match Clonk where it makes sense):**

- **General** — account (avatar, name, email), current plan pill (Free / Pro), Upgrade card (Clonk-style feature tiles: "Unlimited skills", "Parallel worktree agents", "Priority support"). Upgrade button opens checkout in external browser.
- **AI Models** — provider cards (Claude SDK | OpenAI Codex). For Claude: Adaptive Thinking Effort (Low/Medium/High/xHigh), Agent Teams toggle (experimental, behind a warning about token usage). For OpenAI: auth method switch (ChatGPT Pro subscription OAuth vs API Key), signed-in status with sign-out button.
- **Appearance** — theme (Light/Dark/Auto), accent color, font size, FAB corner.
- **Notch** (future) — menu-bar notch-style quick access.
- **Dock Pet** (future/experimental) — playful agent mascot in the dock showing current activity. Clonk has this; we may skip or add in Phase 6.
- **API Keys** — BYO-key entry (Claude API Key, OpenAI API Key, GitHub PAT, etc.). Stored in macOS keychain via Rust `security-framework`. Per-key "Last used" and "Remove" buttons.
- **MCP Servers** — installed list (our engine's MCP appears here as built-in, plus any user-installed servers like Directus, Context7, Figma, Supabase, GitHub, etc.) with Authenticate / Toggle / Delete / Configure buttons. Recommended list below for one-click install (Context7, Figma MCP, Supabase, GitHub, Filesystem, Brave Search, Memory, Puppeteer, Slack, PostgreSQL — same catalog Clonk exposes).
- **Debug** — log viewer, engine port, sidecar status, MCP connectivity tester, diagnostics export.

Settings storage: `~/Library/Application Support/0canvas/settings.json` (non-secret) + macOS keychain (secrets). No database.

---

## Repo Structure — Simplified

```
/                          (repo root, Tauri + npm package root)
├── src-tauri/             (Rust shell)
│   ├── src/
│   │   ├── main.rs        (app entry, sidecar lifecycle)
│   │   ├── git.rs         (git2-rs IPC commands)
│   │   ├── keychain.rs    (security-framework)
│   │   ├── shell.rs       (spawn claude/codex, stream stdout)
│   │   ├── fs.rs          (file dialogs, project open)
│   │   └── worktree.rs    (parallel-agent worktree orchestration)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                   (React UI — existing src/0canvas/ moves here)
│   ├── main.tsx           (Tauri webview entry)
│   ├── app.tsx            (top-level)
│   ├── panels/            (all existing panels)
│   ├── canvas/            (variant canvas)
│   ├── inspector/         (DOM inspector)
│   ├── editors/           (style/color/typography/etc)
│   ├── themes/            (themes-page, theme-mode-panel)
│   ├── store/             (workspace store — unchanged)
│   ├── format/            (.0c format — filesystem-backed now)
│   ├── bridge/            (ws-client, messages — unchanged)
│   ├── db/                (DELETED — IDB gone)
│   ├── native/            (NEW: thin Tauri API wrappers)
│   └── lib/               (openai.ts, NEW claude.ts, NEW ai-stream.ts)
├── engine/                (Node sidecar — existing src/engine/ moves here)
│   └── ... (unchanged)
├── skills/                (NEW: markdown skill files)
│   ├── audit-contrast.md
│   ├── migrate-tokens.md
│   ├── generate-variants.md
│   ├── clone-design.md
│   └── theme-propagation.md
├── scripts/
│   └── build-sidecar.ts   (Bun compile step for engine binary)
├── package.json           (single package — no workspaces)
└── docs/
```

**Not a pnpm workspace, not a multi-package monorepo.** One package, one `package.json`, one install. The plan's earlier workspace-split complexity was there to keep the npm overlay alive — drop the overlay, drop the workspace. This is the single biggest simplification.

---

## Feature Parity Contract

Every item in today's codebase must work in the Mac app's Phase 1 exit. High-level buckets:

| Bucket | Mac-app destination |
|---|---|
| **Overlay shell** — launch, toggle, keyboard shortcut (Cmd+Shift+D), FAB button, z-index | Becomes the entire app window — z-index arms race deleted |
| **DOM inspector** — hover/select overlays, tag labels, size badges, fork/feedback pills | Works on webview DOM (inspecting the variant iframes) |
| **Style panel** — 35+ CSS properties across 5 category tabs (Layout/Spacing/Size/Typography/Fill & Border), box model, code view | Unchanged — pure React |
| **Canvas** — ReactFlow infinite canvas, source node (1440×800), variant nodes, auto-layout | Unchanged — `@xyflow/react` works in webview |
| **Variant system** — fork page/component/variant, rename, delete, status (draft→finalized→sent→pushed), viewport presets | Unchanged; push-to-main writes via engine |
| **AI chat + inline edit** — streaming, context injection, variant-aware, accept/reject | Unchanged protocol; providers expand (Claude + OpenAI + Claude CLI) |
| **Visual diff** — before/after slider | Unchanged |
| **Themes/design tokens** — token table, color picker, multi-theme columns, theme-mode switching | **Upgraded:** File System Access API replaced by native fs. Solves manual upload pain. |
| **Feedback system** — intent/severity/comment, waitlist queue, dual-send (MCP + clipboard) | Unchanged protocol; clipboard fallback less necessary (MCP always reachable) |
| **.0c format** — OCDocument, OCProject, Zod schemas, bidirectional parsing, SHA-256 integrity | Unchanged — but **storage migrates IDB → filesystem** (see below) |
| **Command palette** — Cmd+K launcher | Unchanged |
| **Engine** — CSS resolver, Tailwind writer, file watcher, MCP server, framework detection | Unchanged — runs as sidecar |
| **WebSocket bridge** — browser ↔ engine messages | Unchanged protocol; port injected from Tauri instead of hardcoded |
| **Settings** — AI provider/model/key, theme, hotkey, FAB position | Unchanged UI; API keys move to macOS keychain |
| **Import/export** — download/import `.0c` files, sync-to-IDE | Replaced by native file dialogs + direct fs write |
| **Copy-for-Agent markdown** — element context for pasting into AI | Unchanged |

**Nothing is deleted from the user's perspective.** Several things are *upgraded* (theme.css auto-sync, API key keychain, file dialogs instead of browser downloads). The only deletions are internal plumbing that served the npm-library use case.

---

## What Gets Deleted / Migrated (from audit)

**DELETE (npm-library-only code — no user impact):**
- `src/vite-plugin.ts` — entire Vite plugin
- `tsup.config.ts` — entry 2 (Vite plugin build) and entry 1's external-React config; keep engine build only
- `package.json` — `./vite` export, `peerDependencies`, `peerDependenciesMeta`, `bin`, `main`, `module`, `types`, `exports`, `files` (all go away for an app, not a library)
- `src/index.ts` — public export surface (inspector utilities, hooks, types as public API). React component mounts internally, not exported.
- `src/0canvas/format/oc-project-store.ts` lines 128–186 — `downloadProjectFile` Blob/anchor, `importProjectFile` hidden file input
- `src/0canvas/db/variant-db.ts` — entire IndexedDB layer
- Iframe dual-mode fallbacks in `src/0canvas/inspector/target.ts`, `source-node.tsx`, `variant-node.tsx` — Mac app has one document
- Z-index `2147483646`/`2147483647` → `9999` (no host z-index war)

**MIGRATE (same capability, different storage/transport):**
- `oc-project-store.ts` IDB persistence (lines 37–54) → `~/Library/Application Support/0canvas/projects/{id}.0c` via Tauri fs
- `oc-sync-meta` IDB store → `~/Library/Application Support/0canvas/sync-meta.json`
- `style-panel.tsx:587` localStorage focus-mode pref → `~/Library/Application Support/0canvas/settings.json`
- `AI_SETTINGS` localStorage → macOS keychain (via Tauri Rust command wrapping `security-framework`)
- Hardcoded `ws://localhost:24193/ws` (`bridge/ws-client.ts:44`) → reads `window.__0CANVAS_PORT__` injected by Tauri `initialization_script`

**KEEP UNCHANGED:**
- Engine (`src/engine/**`) — all 11 files, WebSocket protocol, MCP tools, cache, watcher, resolver, writer, framework detector
- All React UI (`src/0canvas/**`) except the deletions/migrations above
- Bridge messages schema (`bridge/messages.ts`) — platform-neutral already
- `tinyglobby` file discovery — just point at user-selected repo root
- PostCSS-based CSS resolution, atomic temp-file-rename writes
- Framework detection

---

## Phased Plan (v0.1 target: 15–19 weeks solo, updated for three-column shell)

Scope expanded from the earlier plan: Phase 1 now includes the full three-column UI shell and Column 2's developer tools (terminal, env, todo). This is what makes 0canvas a credible design-first Mac IDE rather than just a design tool in a window.

### Phase 0 — Cleanup & Storage Migration (✅ COMPLETED 2026-04-20)

**Goal:** existing codebase with IDB/npm plumbing stripped out; feature parity preserved against a local filesystem.

Merged to `main` in two commits:
- `42374c9` Phase 0A: npm library plumbing removed (vite-plugin, public exports, library-only tsup entries), WS port made dynamic, engine bound to `127.0.0.1`, overlay z-index reduced.
- `9a1c4cd` Phase 0B+0C: `src/native/storage.ts` and `src/native/settings.ts` abstractions introduced (Phase-1 seam); all 4 IDB callers migrated; style-panel localStorage migrated; iframe `|| document` fallbacks replaced with `el.ownerDocument.defaultView`.

- Delete `vite-plugin.ts`, `db/variant-db.ts`, download/import UI in `oc-project-store.ts`, iframe dual-mode, npm-library exports
- Build `src/native/storage.ts` — same API shape as today's IDB calls, but backed by filesystem (initially via Node fs during dev, Tauri fs after Phase 1)
- Migrate `oc-project-store` IDB code paths to filesystem equivalent
- Migrate localStorage settings → single `settings.json`
- Fix hardcoded WS port — read from `window.__0CANVAS_PORT__` fallback 24193
- Simplify `tsup.config.ts` to engine-only entry
- Regression: every existing feature still works when running against local filesystem (dev mode with vanilla Vite harness for now)

**Exit criteria:** `pnpm dev` in the current repo shows every feature in the parity contract working; no IDB used; no Vite plugin used; clean codebase ready to be wrapped in Tauri.

### Phase 1A — Tauri Shell + Sidecar + Column 3 parity ✅ SHIPPED

**Goal:** "it's a Mac app." All existing 0canvas functionality runs inside Column 3 of the three-column layout, wrapped in a Tauri window.

- Scaffold `src-tauri/` with `cargo tauri init`
- Configure `tauri.conf.json`: window (1600×1000, resizable, min 1200×700), macOS title-bar style, CSP allowing `ws://localhost:*`, `http://localhost:*`
- Write `src-tauri/src/sidecar.rs`: launch compiled engine via `Command::sidecar` on app start, kill on exit, restart on crash
- Compile engine as **Bun single-file executable** via `bun build --compile` — critical for `@parcel/watcher` `.node` binary bundling (avoid `pkg`/`nexe` — fragile)
- Write `src-tauri/src/main.rs`: read engine's `.0canvas/.port` file to discover actual port, inject into webview via `initialization_script` (exposes `window.__0CANVAS_PORT__` which `ws-client.ts` already reads — no overlay code change needed)
- Wire `src/native/storage.ts` to Tauri fs API (swap IDB shim for `~/Library/Application Support/0canvas/projects/*.0c` real-file persistence)
- Build **three-column shell** layout: `src/app.tsx` renders `<Column1Nav /><Column2Workspace /><Column3Canvas />`. Column 1 is a placeholder (content in 1B); Column 3 wraps today's entire UI (canvas, panels, inspector) unchanged. Column 2 is placeholder with tab bar stub.
- Build native menu: File (Open Folder, Open Recent, Close), Edit (Undo/Redo dispatched to store), View (Toggle Column 1/Column 3), Window, Help
- Native file dialog for "Open Folder" → sets engine's working root → sidecar restarts with new cwd
- macOS permissions: Contacts/Calendar/etc. OFF. Only filesystem access (user-granted per-folder).
- Webview loads built React UI via Vite; `cargo tauri dev` spins the dev server

**Exit criteria:**
- `cargo tauri dev` opens Mac window, three-column skeleton visible, HMR works
- Column 3 shows all current 0canvas features working identically to Phase 0 Vite harness
- `cargo tauri build` produces a working `.app` (ad-hoc signed)
- Sidecar auto-restarts on crash; no zombie Node processes on app quit
- Open a folder → engine discovers framework + CSS files → overlay reflects them

### Phase 1B — Column 1 Navigation + Column 2 Chat tab ✅ SHIPPED (1B-a..d)

**Goal:** the left nav works, and the agent chat lives in its proper home (Column 2, not floating).

- **Column 1:** implement
  - Logo + `+ New Chat` + `⚡ Skills`
  - CHATS tree with folders (`0canvas-state.folders`, `0canvas-state.chats` stored in `settings.ts`)
  - LOCALHOST auto-discovery (poll common dev-server ports: 3000, 5173, 5432, 24193, …; show any that respond)
  - Profile dropdown (How to / Settings / Logout) — Settings button navigates to Settings page
  - Collapse toggle (top-right of column 1); collapsed state = icon rail
- **Column 2 Chat tab:** migrate today's `ai-chat-panel.tsx` from Column 3 overlay into Column 2. Providers still work (OpenAI; Claude added in Phase 4). `@element` chip from Column 3 selection piped into chat input via a workspace-scoped context store.
- **State wiring:** active chat in Column 1 binds to Column 2 Chat content. New Chat creates a new thread, auto-folder-sorted by current project.

**Exit criteria:**
- Open app → see Column 1 populated with real chats
- Click an element in Column 3 canvas → `@element` chip appears in Column 2 Chat input
- Send a message → streams back, applies edits (same as today's overlay)
- Collapse Column 1 → icon rail; uncollapse restores

### Phase 1C — Column 2 Dev Tools: Terminal + Git + Env + Todo ✅ SHIPPED
(Phase 1C-Git commit `ae71af0`, Terminal/Env/Todo earlier in 1C)

**Goal:** Column 2's full tab set is functional.

- **Terminal tab:** integrate `tauri-plugin-pty` (Rust) + `xterm.js` + `@xterm/addon-fit` (frontend). Spawn the user's `$SHELL` (default zsh). Cwd = current project root. Multi-session support (in-panel tabs). Font/colors match app theme.
- **Git tab:** add `git2-rs` dep and `src-tauri/src/git.rs` exposing Tauri commands: `git_status`, `git_stage`, `git_unstage`, `git_stage_all`, `git_commit`, `git_push`, `git_pull`, `git_branch_list`, `git_branch_current`, `git_branch_switch`, `git_branch_create`, `git_diff_file`, `git_log_recent`. UI panel renders Unstaged/Staged tabs + commit box + branch pill + Push N / Pull buttons + Recent Commits list. Visual diff hooks into existing `panels/visual-diff.tsx`.
- **Env tab:** glob for `.env*` files in project root. Render each as a tab inside the Env panel. Table editor: key/value rows, `+ Add Variable`, masked values with click-to-reveal. Writes via native fs atomically. Warns if file is not `.gitignore`'d.
- **Todo tab:** markdown-backed at `.0canvas/todo.md`. Parses `- [ ]` / `- [x]` checkboxes; agent can edit this file directly; live reload on file change.
- **Icon bar** in Column 2 top: switches between the 5 panels; keyboard shortcuts `⌘1`–`⌘5`.

**Exit criteria:**
- Terminal: `echo $SHELL` returns zsh; `ls` shows project root; can run `npm run dev` and see output
- Git: edit a style → Unstaged list shows file → click to see visual diff → Stage All → Commit with auto-message → Push → `gh pr create` from terminal succeeds
- Env: add `TEST_VAR=hello` → saves to `.env.local` → verify via `cat .env.local` in terminal
- Todo: agent says "add a task: refactor theme panel" → `.0canvas/todo.md` gets the line → UI shows it

### Phase 2 — Native Upgrades That Solve Current Pain Points ✅ SHIPPED (2-A..2-F)

Commits on `main`:
- `4c6f09e` 2-A: fix Column 3 / Column 2 Chat styling
- `a2c2582` 2-B: route overlay AI flows into Column 2 chat
- `497fd2a` 2-C: macOS keychain for API keys
- `8d68d23` 2-D: Workspace Manager (recent projects dropdown)
- `e787e10` 2-E: Settings page multi-section sidebar + real API Keys tab
- `426c86a` 2-F: deep link handler + native notifications

**Goal:** deliver the promised Mac-app advantages that are impossible in a browser.

- **Local `theme.css` auto-sync** (solves today's #1 pain): replace `File System Access API` in `themes-page.tsx` with direct fs read + `@parcel/watcher` subscription. Token table live-updates when user edits `theme.css` in their IDE. Two-way sync preserved.
- **Project workspace manager** (new route): recent projects list, "Open Folder", framework badge per project, per-project `.0c` persistence path. Lives as a Column 1 picker above CHATS, or a dedicated Home screen when no project is open.
- **macOS keychain for API keys**: Rust command wrapping `security-framework`; storage API swap transparent to UI. `src/native/secrets.ts` replaces localStorage for sensitive values.
- **Native notifications**: replace in-app toasts with `tauri-plugin-notification` for important events (agent completed, PR pushed)
- **Deep link handler**: `zero-canvas://open?path=/Users/...` — for "Open in 0canvas" links later
- **Settings page routing**: implement the Settings page spec from "Settings Page Spec" section. General + AI Models + Appearance + API Keys + MCP Servers + Debug tabs. The sidebar pattern shown in the Clonk screenshots.

**Exit criteria:** opening a cloned repo, theme.css edits flow both ways without manual upload; workspace manager shows recent projects; API keys persist through app restart via keychain; Settings page is fully navigable with all tabs functional.

### Phase 3 — Git UX Polish + Designer-Safe Flow 🚧 PARTIAL

Shipped: `git2-rs` backend + visual diff panel (Phase 1C-Git).
Not yet shipped: clone flow, worktree commands, PR button, merge
conflict UX, power-user inline affordances (fuzzy branch search,
revert/reset from commit log). See §TODO.

**Goal:** the designer-friendly git layer on top of the raw git2 plumbing already shipped in Phase 1C.

- **Clone flow** in workspace manager: paste GitHub URL → `git_clone` → open. Device Flow OAuth for GitHub; token in keychain. Public repos work without auth.
- **`git_worktree_add` / `_remove` / `_list`** commands — foundation for Phase 5 parallel-agent worktrees.
- **Commit message auto-suggest** from `EngineCache` changed selectors/tokens (e.g. "Updated `button-primary` color, adjusted `hero` spacing"). User can always edit before confirming.
- **Visual diff polish**: extend `panels/visual-diff.tsx` with a file-level git diff tab showing token/style deltas as rendered previews (the button in `main` vs the button with pending changes), not as raw text diff. Raw text diff still available via a "Show text diff" toggle for the developer audience.
- **"Open PR on GitHub"** button → builds the `.../compare/branch` URL → `shell::open` to browser.
- **Safety affordances for designers**: "Discard changes" needs confirmation; "Force push" is off by default (opt-in via settings, warning banner); can't delete current branch.
- **Power-user affordances inline**: branch switcher supports fuzzy search; commit log expandable to full history; right-click on a commit → "Copy SHA", "Revert", "Reset to here" (with warning).
- **Merge conflict UX**: when a pull creates conflicts, git panel shows a "3 files in conflict" banner → click → conflict resolution view listing each file. For each file: **"Keep mine" / "Keep theirs" / "Resolve with agent"** (agent opens the file, understands context, proposes resolution in chat).

**Exit criteria:** designer pastes GitHub URL, clones, edits button color, clicks Save, sees commit on GitHub (happy path < 30s). Conflict scenario: two branches modified same variable → agent resolves with user approval.

### Phase 4 — AI: Claude SDK + CLI Subprocess + Skills + Worktree Agents 🚧 WIP (SHIPPED TO MAIN)

Shipped in commit `f29af21` (Phase 4 WIP bundle):
- `src-tauri/src/ai_cli.rs` — subprocess bridge for `claude` / `codex`
- `src-tauri/src/skills.rs` — markdown skills loader
- `src/0canvas/lib/ai-cli.ts` — AsyncGenerator streaming bridge
- `src/0canvas/lib/anthropic.ts` — direct Messages API streaming
- `src/shell/mission-panel.tsx` — Mission Control dashboard
- 5 skills in `skills/`: audit-contrast, clone-design, generate-variants, migrate-tokens, theme-propagation

Not yet shipped: worktree orchestration (the killer parallel-agent
feature), prompt caching with `cache_control`, per-skill tool
allowlists. See §TODO.

**Goal:** BYO-subscription AI with designer-specific skills and parallel-agent exploration.

- Add `@anthropic-ai/sdk` next to `src/lib/openai.ts`. Extract `src/lib/ai-stream.ts` common streaming interface — panels become provider-agnostic dropdown.
- **Prompt caching mandatory**: `cache_control: {type:"ephemeral"}` on system prompt and tool defs. Recoups cost within 2 messages.
- **Claude CLI subprocess path** (Clonk/Commander pattern): if user has Claude Max, spawn `claude-code` via `shell::spawn` — zero API cost. Stream stdout/stderr back to chat panel via Tauri events. Provider dropdown: "Claude Max (CLI)", "Claude API", "OpenAI API".
- **Skills system**: `skills/` directory with markdown files. Engine exposes skills via new MCP tool `0canvas_list_skills`. Skills picker in AI panel. Each skill = specialized system prompt + allowlisted MCP tool set.
- Initial skills shipped:
  - `audit-contrast.md` — WCAG violations across all variants
  - `migrate-tokens.md` — rename/restructure tokens across codebase
  - `generate-variants.md` — produce N variants in parallel worktrees
  - `clone-design.md` — screenshot → tokens → rebuild in user's design system
  - `theme-propagation.md` — token change → update dependent styles consistently
- **Worktree parallel agents** (killer feature): `worktree.rs` orchestrates `git worktree add ../variant-a`, `../variant-b`, `../variant-c`; spawns 3 `claude-code` subprocesses in parallel, one per worktree, each with `generate-variants` skill. Existing `canvas/variant-canvas.tsx` renders all three side-by-side by running engine in read-only mode against each worktree. Designer picks one → `git worktree remove` others, merge chosen.
- **Mission-control AI tab** (capability-added to existing AI panel): active agents list, pending diffs to review, skill queue, token/cost meter

**Exit criteria:**
- User adds Claude key in settings → persists through restart
- Provider dropdown: Claude CLI (Max), Claude API, OpenAI — all three work
- "Generate 3 variants" creates 3 worktrees, 3 parallel agents, 3 live-rendered variants on canvas; pick merges one, discards others
- Skills picker shows all shipped skills; user can add `skills/custom.md` and it appears without rebuild

### Phase 5 — Distribution Polish ⏳ NOT STARTED

**This is the only phase that requires the paid Apple Developer ID.** All prior phases use ad-hoc/dev signing and don't cost anything.

- **Apple Developer ID** ($99/yr) — purchased at the start of this phase, not before
- **Code signing + notarization** via Tauri's build pipeline (`tauri signer` + `xcrun notarytool`) — Gatekeeper accepts silently on all user machines, no "unidentified developer" warnings
- **Auto-update** via `tauri-plugin-updater` + signed static manifest on GitHub Pages/Releases → Sparkle-style seamless updates with cryptographic verification
- **Signed DMG** with custom background, app icon, dock layout
- **Deep link registration** (`zero-canvas://open?path=...`)
- **Homebrew cask** — secondary install path for power users who prefer `brew install --cask 0canvas`
- **Landing page** with direct DMG download (primary) + Homebrew command (secondary)
- **Migration docs** for any existing npm-overlay users
- **Final npm release** — `@zerosdesign/0canvas@0.1.0` with deprecation banner pointing to the Mac app

**Exit criteria:**
1. Signed + notarized DMG installs on clean Mac → Gatekeeper accepts silently, no warnings
2. Push version bump → existing install receives signed update, verifies signature, applies automatically
3. Homebrew cask install works as alternative path
4. Deep links open the app from browser/other apps

### Phase 6 — Windows/Linux (post-v0.1, future) ⏳

Tauri cross-compiles. Re-evaluate after Mac v0.1 is shipping and stable (3+ months post-launch).

---

## Design System Lock-In — Passes 1-5 ✅ SHIPPED

Not part of the original phase plan but executed 2026-04-20 to make
the shipped UI internally consistent before Phase 5 distribution.

| Pass | Scope | Commit |
|---|---|---|
| 1 | Surface & border token unification (col 1/2 → `floor`, canvas → `surface--0`, all borders → `border--on-surface-0`) | `f951eff` |
| 2 | Typography scale lock-in (5 canonical sizes: 10/11/12/13/15 + 18 page h1) | `9ae0d80` |
| 3 | Spacing & radius lock-in (5 radii: 4/6/8/12/9999; odd-number paddings snapped) | `6863bdc` |
| 4 | Settings into the 3-column shell (no more fullscreen takeover) | `241132d` |
| 5 | Primitive vocabulary (`.oc-btn`, `.oc-input`, `.oc-card`) + legacy focus/disabled normalization | `c3c915c` |

Full scale documented at the top of
[src/shell/app-shell.css](src/shell/app-shell.css). New code should
use the primitives; existing per-feature classes migrate as features
are touched.

---

## Sunset Plan for Browser Overlay

1. **Final release** — ship one last `@zerosdesign/0canvas@0.1.0` with:
   - README banner pointing to 0canvas.app Mac download
   - `console.warn` on mount: "The npm overlay is deprecated. Install the Mac app for full features."
2. **npm deprecation** — `npm deprecate @zerosdesign/0canvas "Install the Mac app at 0canvas.app"`
3. **GitHub repo** — top-level notice; issues redirected
4. **VS Code extension** — already frozen; no new publishes
5. **Existing users** — free Pro license migration offer; `.0c` projects import via "Open Folder" in the Mac app (same format, filesystem-backed now)

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `@parcel/watcher` native `.node` won't bundle | Use Bun `--compile`. Validated path per engine research. |
| WKWebView visual differences vs Chromium | Budget 2 days Phase 1 visual QA. Target macOS 14+ (modern WKWebView). Test `backdrop-filter`, `:has()`, `tw-animate-css`. |
| Firewall prompt on engine start | Bind strictly to `127.0.0.1` (not `0.0.0.0` — note: today's server binds to `0.0.0.0` at `server.ts:194`, must change in Phase 1). |
| Port collision | Engine already retries 24193–24200. Plumb `actualPort` from `.0canvas/.port` → webview. |
| Keychain UX (Touch ID flows) | Test early in Phase 2. Fallback: encrypted file in `~/Library/Application Support/0canvas/` with passphrase. |
| Rust learning curve | Scope Rust to ~600–800 lines calling `git2` + `security-framework` + `shell::spawn`. No idiomatic gymnastics. |
| Engine binary size (Bun compile) | ~50 MB compressed. Acceptable for ~80 MB total app. |
| Multi-client broadcast behavior | Engine broadcasts to all WS clients; a future "open multiple project windows" feature would need filtering. Note for Phase 6. |
| IDB data migration for existing npm users | One-time import flow: on first Mac-app launch, detect browser IDB export file the user downloaded, auto-import. Document in migration guide. |
| Agent CLI subprocess auth (Claude Max login) | User logs into `claude-code` CLI once; app just spawns. No in-app login UI needed. |
| App Developer ID not yet purchased during dev | Use ad-hoc signing or Tauri dev builds in Phases 0–4. Purchase Dev ID only at Phase 5 kickoff. Dev builds run locally via `cargo tauri dev` without any signing. |
| Notarization stapling delays for CI | `xcrun notarytool submit --wait` in Phase 5 release pipeline. Typical 5–15 min. Budget into release cadence; don't block hot-fixes on notarization — ship via Homebrew cask for urgent patches (strips quarantine). |

---

## Files — Concrete Action Map

**Delete entirely:**
- `src/vite-plugin.ts`
- `src/0canvas/db/variant-db.ts`
- `src/index.ts` (public export surface) — replace with internal `src/main.tsx`
- `src/0canvas/format/oc-project-store.ts` lines 128–186 (download/import UI)
- `package.json` fields: `bin`, `main`, `module`, `types`, `exports`, `files`, `peerDependencies`, `peerDependenciesMeta`
- `tsup.config.ts` entry 1 (browser lib) and entry 2 (Vite plugin); keep entry 3 (CLI/engine) for engine sidecar build, or replace with Bun compile script

**Create:**
- `src-tauri/**` — Rust shell (main.rs, git.rs, keychain.rs, shell.rs, fs.rs, worktree.rs, sidecar.rs)
- `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
- `src/native/storage.ts` — filesystem-backed `.0c` store (replaces IDB)
- `src/native/secrets.ts` — keychain wrapper (replaces localStorage API key)
- `src/native/dialog.ts` — native file picker (replaces Blob/anchor download)
- `src/native/shell.ts` — `claude-code` / `codex` / `gh` spawn wrappers
- `src/lib/claude.ts` — `@anthropic-ai/sdk` wrapper mirroring `openai.ts`
- `src/lib/ai-stream.ts` — shared streaming contract
- `src/panels/git-panel.tsx` — designer git UX
- `src/panels/workspace-manager.tsx` — project browser
- `src/panels/mission-control.tsx` — agent dashboard (in AI panel)
- `skills/*.md` — five initial design skills
- `scripts/build-sidecar.ts` — Bun compile for engine binary

**Modify:**
- `src/0canvas/bridge/ws-client.ts:44` — read port from `window.__0CANVAS_PORT__`
- `src/engine/server.ts:194` — bind to `127.0.0.1` not `0.0.0.0`
- `src/0canvas/format/oc-project-store.ts` lines 37–54 — swap IDB for filesystem
- `src/0canvas/panels/style-panel.tsx:587` — swap localStorage for settings file
- `src/0canvas/themes/themes-page.tsx` — swap File System Access API for native fs + watcher
- `src/0canvas/inspector/overlay.ts:76,82` — z-index to 9999
- `src/0canvas/inspector/target.ts` — remove iframe dual-mode fallback (keep single-doc path)
- `package.json` — becomes an app package (name `@zerosdesign/0canvas-mac`, private, Tauri scripts)

**Keep unchanged (100% reuse):**
- All of `src/engine/**` (11 files)
- All of `src/0canvas/canvas/**`
- All of `src/0canvas/editors/**`
- All of `src/0canvas/panels/**` (except specific modifications above)
- All of `src/0canvas/store/**`
- All of `src/0canvas/format/**` except `oc-project-store.ts` storage layer
- All of `src/0canvas/inspector/**` except overlay z-index and iframe fallback
- All of `src/0canvas/themes/**` except file access layer
- `src/0canvas/bridge/messages.ts`, `bridge/use-bridge.tsx`

---

## Verification Plan

**Phase 0 end-to-end:** every feature in the parity contract works with local-filesystem storage, no IDB, no Vite plugin. Regression run against `untitled.0c`, `arun.0c`, `cursor.0c`, `design.0c` sample projects — all load, edit, save correctly.

**Phase 1 end-to-end:**
1. `cargo tauri dev` opens Mac window
2. HMR on React changes
3. Open folder → engine detects framework, indexes CSS
4. Inspect element → edit style → CSS file mutated on disk (`git status` shows change)
5. WS reconnects after `killall node` — sidecar auto-restarts
6. Every parity-contract feature verified

**Phase 2 end-to-end:**
1. Open repo with `theme.css`; edit in external editor; tokens update in app live via watcher
2. Workspace manager shows 3 recent projects across restarts
3. API key saved → restart app → still there → no re-prompt

**Phase 3 end-to-end:**
1. Clone from GitHub URL succeeds
2. Visual edit → Save → commit on GitHub (confirmed via `gh pr list` or web)
3. Branch switch loads correct state

**Phase 4 end-to-end:**
1. Three provider dropdown options all work
2. "Generate 3 variants" creates 3 worktrees, 3 agents, 3 rendered variants
3. Custom skill in `skills/my.md` appears in picker without rebuild
4. Claude Max CLI path consumes zero API credits

**Phase 5 end-to-end:**
1. Signed + notarized DMG installs on clean Mac; Gatekeeper accepts silently with no warnings
2. Push a version bump → existing install receives signed update via `tauri-plugin-updater`, verifies signature, applies seamlessly
3. `brew install --cask 0canvas` alternative path works for power users
4. Deep link `zero-canvas://` opens the app correctly from a browser

**Regression guard every phase:** the parity-contract feature list is a checklist. Every PR merge runs through it in a manual smoke-test pass (~15 min). No automated end-to-end suite needed for v0.1 — manual QA against one contract is sufficient for solo-dev scope.

---

## Answer to the User's Question

**Can we make this Mac-only? How do we preserve everything?**

Yes — and the Mac-only decision actually makes this *easier*, not harder. By dropping the npm overlay and the dual-surface complexity, the architecture collapses from "pnpm workspace + `PlatformAdapter` + dual build" to "one app, one build." Every feature in the current codebase has a concrete destination in the Mac app (most files move unchanged; a small set of files migrate storage/transport). The 20-section feature inventory is the contract — nothing gets lost, several things get upgraded (theme.css sync, keychain, native dialogs).

**Total effort (updated):** 15–19 weeks for v0.1 after Phase 0's scope expansion to a three-column shell + integrated terminal + env editor + todo + designer+developer dual positioning. Phase 0 is already complete (1 week); remaining 14–18 weeks covers Phases 1A–1C, 2, 3, 4, and 5.

**Why it's still worth it:**
- Delivered app has **higher quality** (one tested surface, not two)
- **Zero ongoing dual-surface maintenance tax**
- Feature velocity from Phase 2 onwards is 2× because no capability-gate discipline to enforce
- The Mac app gets all the killer differentiators (git, worktrees, CLI agents, native file sync, embedded terminal, designer-safe git UI) — overlay could never have these
- Broadened audience (solo developers, not just designers) is ~10× the addressable market vs a designer-only tool

**The net:** meaningfully longer to v0.1, but the product that ships is a credible design-first Mac IDE — not a hobby-project overlay in a window.

---

## TODO — What's Left to Reach Phase 5

Cross-reference with [PRODUCT_VISION_V3.md §15](PRODUCT_VISION_V3.md#15-todo--fine-tuning-needed).
The streams below are the working queue between now and Phase 5
distribution; each maps to one (or more) V3 TODO items.

### Phase 3 completion

- [ ] Clone flow in workspace manager (paste GitHub URL → `git_clone` → open).
- [ ] `git_worktree_add` / `_remove` / `_list` Tauri commands.
- [ ] Commit message auto-suggest from `EngineCache` changed selectors.
- [ ] Visual diff file-level tab (rendered previews of changed components).
- [ ] "Open PR on GitHub" button → `shell::open` compare URL.
- [ ] Power-user git affordances: fuzzy branch search, revert/reset
      right-click, expandable commit log.
- [ ] Merge conflict UX: "Keep mine / Keep theirs / Resolve with agent".
- [ ] Safety rails: confirm Discard Changes, opt-in force-push.

### Phase 4 completion

- [ ] Prompt caching with `cache_control: {type:"ephemeral"}` on
      system prompt + tool defs in both `anthropic.ts` and the CLI bridge.
- [ ] Per-skill allowlisted MCP tool sets (currently every skill gets
      all tools).
- [ ] Worktree parallel agents — the killer differentiator.
      `worktree.rs` + `generate-variants` skill wiring.
- [ ] Mission Control live wiring: active agents list, pending diffs,
      token/cost meter should update in real time (currently static).
- [ ] `/commands` stub entries (`/explore`, `/agents`, `/plugins`,
      `/mcp`) either implemented or removed.

### Streams 2-5 (from PRODUCT_VISION_V3 §15)

- [ ] **Stream 2**: Remove `designMode: "ai"` from Col 3 (Col 2
      owns AI per Decision 8).
- [ ] **Stream 3**: Project grouping in Col 1 — chats nested under
      project folders, chat schema adds `projectRoot`, per-project
      isolation.
- [ ] **Stream 4**: Per-project context routing — git/terminal/env/
      todo/preview URL/skills all scoped to active project, clean
      switching with no webview reload.
- [ ] **Stream 5**: Chat composer polish — two-level model picker,
      per-chat thinking effort persistence, inline branch create,
      permission-mode guardrails, live context indicator, implemented
      commands, skills drawer.

### Phase 5 prerequisites (blockers for distribution)

- [ ] Apple Developer ID enrolled ($99/yr).
- [ ] Icon assets: app icon, DMG background, Finder icons at all sizes.
- [ ] Code-signing certificate installed in Keychain.
- [ ] `tauri.conf.json` signing identity configured.
- [ ] Auto-update signing key generated + manifest hosting plan
      (GitHub Pages or Releases).
- [ ] Privacy-policy + terms-of-service landing page copy.
- [ ] Sunset banner wording for the final npm release.

### Codebase hygiene (non-blocking but owed)

- [ ] Delete unused `.text-\[Npx\]` utility classes (dead).
- [ ] Primitive migration: each `.oc-foo-btn` → `.oc-btn oc-btn--*`
      as features are touched; delete duplicate CSS.
- [ ] Consolidate hover-tint (half the codebase uses 0.03, half 0.04).
- [ ] Icon-size audit — snap every `size={…}` to 14 / 16 / 18.
- [ ] Focus-visible on `.oc-input` and `.oc-card` (currently only
      `.oc-btn` has it).
- [ ] Legacy engine bridge code: what's still needed for npm
      distribution vs dead inside the Tauri app.
