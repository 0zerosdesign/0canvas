# Zeros Product Vision V3 — The Native Mac App

> **One native Mac app. The designer's workspace sitting beside every AI
> agent, every git branch, every terminal. One project, one context,
> one window.**

**Version:** 3.0
**Date:** 2026-04-20
**Author:** Zeros Design
**Supersedes:** `PRODUCT_VISION_V2.md` (V2.0, 2026-04-15) and `PRODUCT_VISION.md` (V1, 2026-04-12)

---

## Table of Contents

1. [Vision: What Changed from V2](#1-vision-what-changed-from-v2)
2. [The Three-Column Shell](#2-the-three-column-shell)
3. [Column 1 — Project-First Navigation](#3-column-1--project-first-navigation)
4. [Column 2 — Agent Workspace](#4-column-2--agent-workspace)
5. [Column 3 — Design Canvas](#5-column-3--design-canvas)
6. [The Engine — Still Embedded, Now a Sidecar](#6-the-engine--still-embedded-now-a-sidecar)
7. [Rust Backend — What Lives Where](#7-rust-backend--what-lives-where)
8. [Data Model](#8-data-model)
9. [AI Integration](#9-ai-integration)
10. [Auth, Cloud & Data Strategy](#10-auth-cloud--data-strategy)
11. [Monetization](#11-monetization)
12. [Distribution](#12-distribution)
13. [Roadmap — Where We Actually Are](#13-roadmap--where-we-actually-are)
14. [Decisions Log](#14-decisions-log)
15. [TODO — Fine-Tuning Needed](#15-todo--fine-tuning-needed)

---

## 1. Vision: What Changed from V2

### V2 Vision (Superseded)

V2 was built around the engine as a Node.js CLI + browser overlay:

```
User's codebase
  └── node_modules/@Withso/zeros/
       └── Engine (Node.js, port 24193)
            ├── HTTP + WebSocket server
            ├── Serves browser overlay (<Zeros />)
            └── MCP endpoint for AI tools
```

The designer installed an npm package, ran `npx Zeros serve`, and the
browser overlay appeared on `Ctrl+Shift+D`.

### V3 Vision

**The designer's tool is a native Mac app. The codebase is one first-class
citizen inside it, alongside AI chat, git, terminal, env, todos, and mission
control.** The browser overlay that V2 shipped still exists, but it's one
column inside a three-column native window — not a separate surface on
a separate protocol.

```
┌──────────┬──────────────────────┬──────────────────────────┐
│ Column 1 │  Column 2            │  Column 3                │
│ Nav      │  Agent Workspace     │  Design Canvas           │
│ (248px)  │  (440px)             │  (fills the rest)        │
│          │                      │                          │
│ Projects │  Chat / Git / Term / │  Preview iframe,         │
│ Chats    │  Env / Todo /        │  StylePanel, ThemesPage, │
│ Profile  │  Mission Control     │  Settings, variants,     │
│          │                      │  feedback, inspector     │
└──────────┴──────────────────────┴──────────────────────────┘
                                  Column 1+2 = native shell
                                  Column 3   = the old overlay,
                                               now embedded
```

### What's Different from V2

| Aspect | V2 (npm engine + overlay) | V3 (native Mac app) |
|---|---|---|
| **Distribution** | `npm install @Withso/zeros` | Signed `.dmg` (Phase 5) / `brew install --cask` |
| **Shell** | Web page in the user's browser | Native Tauri window, three columns |
| **Engine** | Runs via `npx Zeros serve` | Spawned as a Tauri sidecar on app launch |
| **Chat** | Single AI panel in the overlay | Dedicated column with model / effort / permission / branch / context / commands |
| **Git** | Out of scope | First-class panel with `git2-rs` backend — branches, diffs, commits, push |
| **Terminal** | Out of scope | PTY panel (`tauri-plugin-pty` + xterm.js) |
| **Env files** | Out of scope | Env panel reading `.env*` with keychain-backed secret masking |
| **AI auth** | BYOK (OpenAI API key) | OAuth via Claude CLI (`claude login`) OR BYO API key OR Codex CLI |
| **Project mgmt** | One `.0c` file per codebase | Recent projects, workspace manager, folder-picker, deep links (`zeros://`) |
| **Cross-platform** | Any browser | macOS first (Tauri app). Other platforms follow. |
| **Design system** | Ad-hoc per component | Locked: surface/border/type/spacing/radius/primitives (Passes 1-5) |

### The Principle

**Designers already own one window where every tool they need to ship
a change lives together.** Design happens *with* code, not beside it;
AI agents work *with* designers, not through them; git history is *one
click away*, not one context switch. Cursor did this for code; Zeros
does it for design.

---

## 2. The Three-Column Shell

### Layout

Defined in [src/app-shell.tsx](src/app-shell.tsx) and
[src/shell/app-shell.css](src/shell/app-shell.css).

- **Column 1 — Navigation (248px, collapsible to 56px):** brand row,
  New Chat, Skills, workspace picker, chats list (nested under project
  folders), localhost ports list, profile + settings menu.
- **Column 2 — Agent Workspace (440px, fixed):** horizontal tabs
  (Chat / Git / Terminal / Env / Todo / Mission) driving a body below.
- **Column 3 — Design Canvas (fills remaining width):** the former
  browser overlay. Page tabs (Design / Themes), workspace toolbar,
  preview iframe with device switcher, right panel (StylePanel /
  Feedback). Also hosts the Settings page (tabs + content area inside
  Col 3 rather than a full-screen takeover).

### Uniform Chrome

After Pass 1 (surface & border unification):

- All three columns paint `--color--surface--floor` as chrome.
- Canvas / content areas paint `--color--surface--0` one step lighter.
- Column seams are `1px solid --color--border--on-surface-0`, not tone
  steps. This is the Cursor approach — uniform chrome, thin seams.

### Tab Pattern (Consistent Across Col 2, Col 3, Settings)

One horizontal tab bar primitive used three ways:

- Col 2: `Chat | Git | Terminal | Env | Todo | Mission`
- Col 3 page tabs: `Design | Themes` (Settings swaps in its own when
  active: `Back | General | AI Models | API Keys | Appearance |
  MCP Servers | Debug`).
- Tabs ship with the `oc-column-2__tab` / `oc-page-tab` / `oc-settings-tab`
  classes, all sharing the Pass 2 type scale and Pass 3 padding/radius.

### Window Drag

`data-tauri-drag-region` is attached to each column's top container
(brand row, tab bar, workspace toolbar). No dedicated drag strip; the
empty pixels inside those surfaces are draggable. macOS gives traffic-
light clicks priority so overlap with children is harmless.

---

## 3. Column 1 — Project-First Navigation

File: [src/shell/column1-nav.tsx](src/shell/column1-nav.tsx)

### What it shows

- **Brand row** — Zeros logo + collapse toggle.
- **New Chat** — starts a fresh chat thread in Col 2.
- **Skills** — opens the skills registry (markdown files under
  `skills/`).
- **Workspace dropdown** — currently active project + recent projects +
  "Open Folder…" via Tauri file dialog.
- **Chats section** — list of chat threads grouped under their project
  folder. Clicking a chat switches Col 2 to Chat and loads that thread.
- **Localhost section** — detected dev servers (`:5000`, `:5432`,
  `:24193` engine, etc.). Clicking sends Col 3's iframe to that URL.
- **Profile row** — avatar + settings menu (Open Docs, Settings, Logout).

### Project model — the current state

- Each project corresponds to a folder on disk.
- The active project drives the engine's `root` (cwd), the git panel's
  repo, the terminal's initial cwd, and Col 3's iframe URL.
- Recent projects persist in `~/Library/Application Support/zeros/`
  via `getSetting`/`setSetting`.

### What's missing (see §15 TODO)

- Project *groups* — chats should nest under a project folder header,
  like Cursor's sidebar. Today the UI shows a flat chats list with a
  workspace dropdown above it; the nesting is conceptual, not visual.
- Per-project chat isolation — a chat started in project A should not
  appear in project B's list.
- Drag/drop reordering, per-project chat archive, project rename,
  per-project colors.

---

## 4. Column 2 — Agent Workspace

File: [src/shell/column2-workspace.tsx](src/shell/column2-workspace.tsx)

### Tabs (6)

| Tab | Component | Status |
|---|---|---|
| Chat | [AIChatPanel](src/zeros/panels/ai-chat-panel.tsx) | Shipped. Streams via `ai-cli.ts` or `anthropic.ts` depending on auth method. |
| Git | [GitPanel](src/shell/git-panel.tsx) | Shipped (Phase 1C-Git). Branches, diff, stage, commit, push via `git2-rs` in [src-tauri/src/git.rs](src-tauri/src/git.rs). |
| Terminal | [TerminalPanel](src/shell/terminal-panel.tsx) | Shipped. PTY via `tauri-plugin-pty`, xterm.js renderer. |
| Env | [EnvPanel](src/shell/env-panel.tsx) | Shipped. Reads `.env*` files, masks secrets, writes via keychain when `SECRET_ACCOUNTS` flag is set. |
| Todo | [TodoPanel](src/shell/todo-panel.tsx) | Shipped. Local task list scoped to the active project. |
| Mission | [MissionPanel](src/shell/mission-panel.tsx) | Phase 4-J. Dashboard over the AI subprocess bridge. |

Keyboard shortcuts: `⌘1..⌘5` jump to the nth tab; Mission has no
shortcut yet.

### Chat flow (the primary surface)

```
User types in composer
  → model + effort + permission mode captured from toolbar dropdowns
  → Route based on auth method:
       Claude Pro   → ai-cli.ts → Tauri ai_cli_* commands → claude CLI subprocess
       API Key      → anthropic.ts OR openai.ts → HTTPS streaming
  → Stream assistant deltas back over Tauri events
  → Store messages in the chat thread (state.chats[id])
  → Auto-persist on change via native/settings.ts
```

Composer controls (left-to-right): model picker, adaptive thinking
effort, `+` commands menu, image attach, skills menu, submit.

### What's missing (see §15 TODO)

- Model dropdown needs a proper "Provider → Model" two-level menu
  matching the screenshot the user shared (Claude / Codex as providers,
  specific models nested).
- Adaptive thinking should persist per chat, not just per session.
- Branch switcher (bottom-left) needs to create branch inline.
- Permission mode (Plan Only / Ask First / Auto Edit / Full Access)
  works but lacks per-mode guardrails on tool calls.
- Context window indicator (0% / 200k) — reads from the last response's
  token usage; doesn't update while composing.
- `/commands` menu exists but several entries (`/explore`, `/agents`,
  `/plugins`, `/mcp`) are stubs.
- Chat sessions don't yet scope by project — entering a chat thread
  from a different project loads the same global list.

---

## 5. Column 3 — Design Canvas

The former browser overlay, embedded as a first-class column.

File: [src/zeros/engine/zeros-engine.tsx](src/zeros/engine/zeros-engine.tsx)

### Page tabs (top of Col 3)

- **Design** — the workspace: workspace toolbar + variant canvas
  (preview iframe with device switcher) + right panel.
- **Themes** — [ThemesPage](src/zeros/themes/themes-page.tsx): token
  browser, theme file imports, theme diffs.
- **Settings** — swaps in when activated from Col 1's profile menu.
  Tabs: `Back | General | AI Models | API Keys | Appearance |
  MCP Servers | Debug`.

### Right panel (under Design)

Three modes driven by `state.designMode`:
- `"style"` → [StylePanel](src/zeros/panels/style-panel.tsx) — the
  Figma-style property editor.
- `"ai"` → [AIChatPanel](src/zeros/panels/ai-chat-panel.tsx).
- default → Feedback list.

**Per V3's Col 2-owns-AI principle (§4), the `"ai"` mode should be
removed from Col 3.** See Stream 2 in §15.

### Canvas

- Preview iframe shows `state.project.devServerUrl` (auto-discovered
  from the localhost list or manually entered via the toolbar URL bar).
- Device presets: 1440px / Desktop / Laptop / Tablet / Mobile.
- Selecting an element in the iframe drives the StylePanel; feedback
  annotations and variants live alongside.

### Engine bridge

- [src/zeros/bridge/use-bridge.ts](src/zeros/bridge/use-bridge.ts)
  opens a WebSocket to the sidecar engine (port auto-discovered via
  the Tauri `get_engine_port` command).
- Messages: `get_element_styles`, `apply_change`, `list_tokens`,
  `read_design_state`, etc. — same shape as V2's MCP tools, but over
  a local WebSocket instead of MCP.

---

## 6. The Engine — Still Embedded, Now a Sidecar

### What it is

The same engine V2 described — Node.js process with CSS source
resolution, selector index, atomic file writes, `.0c` management —
but now spawned by the Tauri app instead of launched manually.

Source: [src/engine/](src/engine/) (user-facing npm package) and
[src-tauri/src/sidecar.rs](src-tauri/src/sidecar.rs) (Rust supervisor
that launches and monitors it).

### Launch flow

```
App starts
  → Tauri boot: sidecar::spawn()
  → Rust launches node dist-engine/cli.js serve --root <project>
  → Engine prints "listening on :24193"
  → Rust captures port, stores in SidecarState
  → Webview calls get_engine_port Tauri command
  → BridgeProvider opens WebSocket → engine
  → Col 3 engine UI becomes live
```

When the user picks a new project folder via File > Open Folder,
Rust restarts the sidecar with the new `--root` and emits
`project-changed`. The webview reloads to rehydrate state
(temporary until per-project in-place swap is implemented —
see §15).

### Dual distribution (future)

The engine is still exportable as an npm package. A future release
can ship both:

1. **Mac app** (primary) — Tauri window, sidecar engine.
2. **npm package** — `npm install @Withso/zeros` + `npx Zeros
   serve` for users who can't install the Mac app (Windows/Linux dev,
   CI, remote workspaces).

The V2 vision is not dead; it's the *second* distribution channel.

---

## 7. Rust Backend — What Lives Where

[src-tauri/src/](src-tauri/src/) (3,062 lines total):

| File | Size | Responsibility |
|---|---|---|
| `lib.rs` | 446 | App entrypoint, menu, deep-link handler, Tauri command registrations. |
| `main.rs` | 6 | Thin binary entry. |
| `sidecar.rs` | 254 | Spawns/kills the Node engine; exposes `get_engine_port`, `respawn_engine`. |
| `git.rs` | 1,149 | `git2-rs` wrapper: branch list, checkout, create-branch, diff, stage, commit, push, pull, log. Powers [GitPanel](src/shell/git-panel.tsx). |
| `ai_cli.rs` | 457 | Subprocess bridge to `claude` / `codex` CLIs. Streams stdout over Tauri events. Used when auth method is "Claude Pro" or "Codex CLI". |
| `env_files.rs` | 224 | Discovers `.env*`, parses key/value, masks based on heuristics + keychain flag. |
| `todo.rs` | 127 | Per-project todo list persistence (JSON in app data dir). |
| `css_files.rs` | 106 | Discovers CSS files in the project; companion to the Node engine for cases where the Rust side needs file locations. |
| `secrets.rs` | 105 | macOS Keychain via `security-framework`. `get_secret` / `set_secret` / `delete_secret` for API keys. |
| `skills.rs` | 104 | Loads markdown-with-frontmatter files from `skills/*.md` for the Skills menu. |
| `localhost.rs` | 84 | Scans for listening ports → powers Col 1 localhost section. |

### Tauri commands (6 registered in `lib.rs`)

- `get_engine_port`, `get_engine_root` — engine introspection.
- `open_folder_dialog`, `open_project` — folder picker → respawn engine
  → emit `project-changed`.
- `reveal_in_finder` — open Finder at a path.
- Plus command modules from git/ai_cli/env/todo/skills/secrets that
  each register their own commands (see each file's `#[tauri::command]`
  annotations).

---

## 8. Data Model

### Stores & persistence surfaces

| Data | Source of truth | Where |
|---|---|---|
| Chats (threads + messages) | App state | `localStorage` key `chats-v1`, mirrored to `settings.json` |
| Active chat id | App state | `localStorage` key `active-chat-id` |
| AI settings (provider, model, effort, API key ref) | App state | `settings.json` (non-secret) + macOS Keychain (secret) |
| Recent projects | App state | `settings.json` `recent-projects` |
| `.0c` project file | Project root | On disk — the design document |
| Engine selector index | Sidecar engine memory | Rebuilt on start, incremental per file change |
| Skills | `skills/*.md` | Markdown on disk, loaded by Rust on demand |
| Env keys/values | `.env*` files | Read/mask/write by `env_files.rs` |
| Git state | `.git/` | Read by `git2-rs` |
| Terminal scrollback | xterm.js buffer | Ephemeral (in-memory) |

### `.0c` file format

Unchanged from V2. See [src/zeros/format/oc-project.ts](src/zeros/format/oc-project.ts):

```typescript
{
  project: { id, name, createdAt, updatedAt, revision },
  workspace: { root, framework, entryFiles },
  variants: DesignVariant[],
  changes: DesignChange[],
  themeFiles: ThemeFileEntry[],
  themeChanges: ThemeChange[],
  feedback: FeedbackItem[],
  breakpoints: { desktop, laptop, tablet, mobile },
  history: { checkpoints: Checkpoint[] },
  integrity: { hash, generator }
}
```

Auto-save is still debounced 500ms — the engine (not the webview)
writes the file.

---

## 9. AI Integration

### Auth methods

Configured in Settings → AI Models:

1. **Claude Pro** — OAuth through the `claude` CLI. Tokens live in
   `~/.claude/`; we never touch them. Used via `ai_cli.rs`.
2. **API Key (Anthropic)** — Stored in macOS Keychain (`secrets.rs`),
   streamed via `anthropic.ts` (direct HTTPS).
3. **OpenAI Codex** — Via `openai.ts` if API key, via `codex` CLI if
   OAuth (mirrors the Claude flow through `ai_cli.rs`).
4. **MCP servers** — Not yet implemented in Col 2 (the old V2 MCP
   tooling is still there for the engine → AI-tool surface; Col 2
   chat is separate).

### Routing layer

```
Composer submit
  → WorkspaceStore.startChat(message, modelConfig)
    ├─ if aiSettings.authMethod === "claude-pro"
    │    → ai-cli.ts.sendMessage(...)   (Tauri subprocess bridge)
    ├─ else if provider === "anthropic"
    │    → anthropic.ts.stream(...)     (HTTPS SSE)
    └─ else if provider === "openai"
         → openai.ts.stream(...)        (HTTPS SSE)
  → onDelta → dispatch APPEND_CHAT_MESSAGE_DELTA
  → onDone  → dispatch CHAT_MESSAGE_DONE
  → onError → dispatch CHAT_MESSAGE_ERROR + toast
```

### Skills

Skills are markdown files with YAML frontmatter under `skills/`.
Current registry:

- `audit-contrast.md` — WCAG audit across variants.
- `clone-design.md` — screenshot → tokens → rebuild.
- `generate-variants.md`.
- `migrate-tokens.md`.
- `theme-propagation.md`.

Frontmatter shape: `{ name, description, icon }`. Selected via the
Skills dropdown in Col 1 or the composer's skills button.

### Adaptive thinking effort

`Low / Medium / High / xHigh`. When the model supports extended
thinking (Claude 4.x, GPT-5), this maps to the `thinking_budget`
header or equivalent. Persisted in AiSettings.

---

## 10. Auth, Cloud & Data Strategy

Unchanged strategy from V2: **local-first, cloud adds identity +
sync + billing when it lands.**

### Stays local (in the codebase, in git)

- `.0c` project files, CSS source changes, design tokens.

### Stays local (on the user's machine, NOT in git)

- API keys → macOS Keychain via `secrets.rs`.
- OAuth tokens → `~/.claude/` (owned by the Claude CLI; we don't touch them).
- Recent projects, chat threads, UI state → app-data JSON files.

### Cloud (future — post-Phase 5)

- User identity + subscription state.
- Team collaboration metadata.
- Encrypted API-key vault (cross-device).
- Shared variant links (shareable URLs).
- Usage metrics / rate limits.

Cloud **never** stores `.0c` content or source code.

### Auth is the last phase

Phase 5 ships signed distribution. Phase 6 adds login + cloud.
The app must be fully useful with no account.

---

## 11. Monetization

Open-core, same shape as V2:

| Tier | Price | What you get |
|---|---|---|
| **Free** | $0 | Full Mac app. Local `.0c` files. BYOK for AI. Single user. |
| **Pro** | ~$12-15/mo | Claude Pro / Codex subscription passthrough OR cloud AI credits. Keychain-sync across devices. Priority support. |
| **Team** | ~$25-30/user/mo | Shared `.0c` registry, team feedback dashboard, role-based access, SSO. |
| **Enterprise** | Custom | Self-hosted vault, SAML, audit logs. |

---

## 12. Distribution

### Phase 5 — signed Mac app

- `.dmg` with custom background, app icon, Applications drop target.
- Codesigning + notarization via Tauri's build pipeline (`tauri signer`
  + `xcrun notarytool`).
- `tauri-plugin-updater` + signed static manifest for seamless updates.
- `zeros://` deep-link registration (`Finder:open in app`, etc.).
- Homebrew cask: `brew install --cask Zeros`.
- Landing page with direct DMG download + Homebrew command.
- Final `@Withso/zeros@0.1.0` npm release with deprecation
  banner pointing to the Mac app (npm becomes a legacy / compatibility
  channel).

### Post-Phase 5

- Windows + Linux builds (Tauri supports both; needs code-signing
  setup + distribution channels).
- Auto-update with rollback.

---

## 13. Roadmap — Where We Actually Are

### ✅ Done

- **Phase 1A-1** Scaffold: 3-column shell, Col 1/2 placeholders, Col 3
  mounts the existing engine.
- **Phase 1A-2** Sidecar supervision: spawn Node engine, kill on
  window close, port introspection.
- **Phase 1A-3** Engine port discovery via Tauri command.
- **Phase 1B-a..d** Col 1 brand + nav, Col 2 tab bar, Chat tab mounts
  `AIChatPanel`, chat thread persistence.
- **Phase 1C-Git** Designer git panel via `git2-rs` (branches, diff,
  stage, commit, push).
- **Phase 1C-Terminal** PTY + xterm.
- **Phase 1C-Env** Env files panel.
- **Phase 1C-Todo** Todo panel.
- **Phase 2-A** Column 3 / Chat styling repair after the shell landed.
- **Phase 2-B** Overlay AI flows routed into Col 2 chat.
- **Phase 2-C** macOS Keychain for API keys.
- **Phase 2-D** Workspace Manager (recent projects dropdown).
- **Phase 2-E** Settings page multi-section sidebar + real API Keys tab.
- **Phase 2-F** Deep link handler + native notifications.
- **Phase 4** (WIP, merged to main) AI CLI bridge (`ai_cli.rs`,
  `ai-cli.ts`), Anthropic HTTPS streaming (`anthropic.ts`), Skills
  system, Mission Control panel.
- **Pass 1** Surface & border token unification (shell + engine).
- **Pass 2** Typography scale lock-in (5 canonical sizes).
- **Pass 3** Spacing & radius lock-in.
- **Pass 4** Settings into the 3-column shell (no more fullscreen).
- **Pass 5** Primitive vocabulary (`.oc-btn`, `.oc-input`, `.oc-card`)
  + legacy focus/disabled normalization.

### 🚧 In progress

- **Stream 2** Remove `designMode: "ai"` from Col 3.
- **Stream 3** Project grouping in Col 1 (chats nested under project
  folders, Cursor-style).
- **Stream 4** Per-project context routing (git / terminal / files /
  chat scoped to active project).
- **Stream 5** Chat interface polish — model picker, thinking effort,
  branch switcher, permission mode, context viewer, commands, open-
  project all verified working.

### 📋 Next

- **Stream 6** Context menu & keyboard shortcuts second pass.
- **Stream 7** Per-feature migration onto Pass 5 primitives (delete
  duplicate CSS as each component adopts).
- **Phase 5** Signed distribution (see §12).

---

## 14. Decisions Log

*(V2's decisions 1-6 remain valid where applicable; V3 adds:)*

### Decision 7: Native Mac App as Primary Distribution (V3)

**Date:** 2026-04-20
**Decision:** Pivot the primary distribution from an npm engine + browser
overlay to a signed Tauri Mac app that bundles the engine as a sidecar.
**Rationale:** V2's npm-install flow has high friction (users needed
Node.js, a package install, a CLI command, and to know about `Ctrl+Shift+D`).
Designers are not that audience. A Mac app is discoverable via DMG
download or Homebrew and starts with a double-click.
**Trade-off:** Mac-first means Windows/Linux users wait. Mitigated by
keeping the npm distribution alive as a secondary channel.

### Decision 8: Col 2 Owns AI (V3)

**Date:** 2026-04-20
**Decision:** Col 2 is the single place the designer interacts with
AI. Col 3's `designMode: "ai"` path is deprecated.
**Rationale:** Having AI in two places (right panel of Col 3 + Col 2
chat) is confusing. The inline-edit / command-palette flows in Col 3
already dispatch into Col 2's chat (see Phase 2-B). Keeping a separate
panel duplicates UI without adding capability.
**Trade-off:** Users who liked the right-panel AI panel lose it; they
gain a full chat column with model/effort/permission/branch/context.

### Decision 9: Projects Are Folders, Chats Nest Under Them (V3)

**Date:** 2026-04-20
**Decision:** Col 1 groups chats under the project folder they were
created in. Switching projects switches the active chat list, and the
chat context carries the project's root into terminal / git / files.
**Rationale:** Mirrors how Cursor's sidebar works. A chat always has
a workspace context; globalizing chats creates cross-project confusion.
**Trade-off:** Requires a chat-schema migration (add `projectRoot`
field) and per-project persistence.

### Decision 10: `/commands` + Skills Are Separate Surfaces (V3)

**Date:** 2026-04-20
**Decision:** `/commands` (typed in the composer) and Skills
(markdown-driven agents) are two menus, not merged.
**Rationale:** Commands are CLI-ish verbs (`/explore`, `/model`,
`/auth`). Skills are long-form markdown prompts the LLM can adopt
(`audit-contrast`, `clone-design`). Merging them hides structure.
**Trade-off:** Two menus to learn. Mitigated by consistent shortcut
surface in the composer.

---

## 15. TODO — Fine-Tuning Needed

This section is the concrete execution queue for Streams 2-5 and
beyond. Each item has a short description + where the work is.

### Stream 2 — Remove AI from Col 3

- [ ] Delete the `designMode === "ai"` branch in
  [src/zeros/engine/zeros-engine.tsx:464-499](src/zeros/engine/zeros-engine.tsx#L464-L499).
- [ ] Remove the AI toggle in
  [src/zeros/panels/workspace-toolbar.tsx](src/zeros/panels/workspace-toolbar.tsx)
  (the "AI" button that sets `designMode: "ai"`).
- [ ] Remove `"ai"` from the `designMode` union in
  [src/zeros/store/store.tsx](src/zeros/store/store.tsx).
- [ ] Verify the inline-edit and command-palette flows still dispatch
  into Col 2 chat (Phase 2-B already wired this, should be automatic).
- [ ] Delete dead CSS: `.oc-ai-diff-btn`, `.oc-ai-provider-btn`, and
  any `designMode==="ai"` styles.

### Stream 3 — Project grouping in Col 1

- [ ] Add `projectRoot: string` to the `ChatThread` schema in
  [src/zeros/store/store.tsx](src/zeros/store/store.tsx).
- [ ] Migration: existing chats get `projectRoot` from
  `get_engine_root` at boot; persist.
- [ ] Column 1 nav: group chats by `projectRoot`. Each project is a
  collapsible section with the folder name as the header.
- [ ] New Chat button creates a chat scoped to the active project.
- [ ] Workspace switcher (current dropdown) becomes the project
  list — clicking a project expands its chats.
- [ ] Per-project chat count badge next to the project name.
- [ ] Inline rename / delete project from the group header.

### Stream 4 — Per-project context routing

- [ ] Git panel: re-open repository on project change (currently
  reloads the entire webview).
- [ ] Terminal panel: when a terminal session is closed and the
  active project changes, the next new terminal opens in the new
  project's cwd. Keep existing terminals pointed at the project they
  were opened in (labeled in the tab).
- [ ] Env panel: re-read `.env*` on project switch.
- [ ] Todo panel: scope todo list by project root (file path becomes
  `<app-data>/todos/<hash-of-root>.json`).
- [ ] Col 3 iframe: the preview URL is a per-project setting, not a
  global one. Each project remembers its last dev-server URL.
- [ ] Chat panel: when switching project, load that project's chat
  threads; existing "active chat id" becomes per-project.
- [ ] Skills: scope skill availability by project if a project has a
  local `skills/` directory (falls back to global).

### Stream 5 — Chat interface polish

- [ ] Model dropdown: two-level "Provider → Model" menu matching the
  screenshots (Claude variants under Claude, GPT variants under
  Codex). Currently flat.
- [ ] Adaptive thinking: persist per-chat, not per-session. Bind to
  the specific chat thread so switching chats restores the thinking
  level that was used.
- [ ] Branch switcher (bottom-left): "Create new branch…" entry
  currently opens a dialog; make it inline with validation (branch
  name, `from main`).
- [ ] Permission mode: Plan Only / Ask First / Auto Edit / Full
  Access. Add per-tool gating in `ai-cli.ts` so Plan Only truly
  blocks writes/commands.
- [ ] Context window indicator: refresh while composing (not just
  after response). Include a breakdown tooltip (input / output /
  cache).
- [ ] `/commands` menu: implement the stub entries (`/explore`,
  `/agents`, `/plugins`, `/mcp`) or remove them.
- [ ] Skills button: expand/collapse the skills drawer inline
  rather than popping a separate menu; preview the skill's
  description on hover.
- [ ] Open Project (`…`) menu: add `Reveal in Finder`, `Open in
  Terminal`, `Open in VS Code`. First two are Tauri commands
  already; VS Code is one shell-open.

### Stream 6 — Context menus & keyboard shortcuts

- [ ] Right-click on a chat thread → rename, delete, pin, move to
  project.
- [ ] Right-click on a project → rename, remove from recents, show
  in Finder, open in terminal.
- [ ] `⌘N` for new chat, `⌘⇧N` for new project, `⌘,` for settings.
- [ ] Audit every `⌘` shortcut for conflicts with xterm.js (which
  captures many inside the Terminal tab).

### Stream 7 — Primitive migration

- [ ] Per feature as it's touched: replace `.oc-foo-btn` with `.oc-btn
  oc-btn--variant` in the JSX; delete the duplicated CSS rules.
- [ ] Start with the most-visible: Col 1 `New Chat` button, the chat
  composer's submit, the Themes "Import theme" button, Settings save.
- [ ] Track progress with a grep: `git grep oc-.*-btn -- "*.tsx"` —
  count should drop.

### Cross-cutting cleanup

- [ ] Dead CSS: delete unused `.text-\[Npx\]` utility classes (defined
  in `layout.ts` + `zeros-styles.ts`, referenced zero times in
  components).
- [ ] Legacy engine bridge code from V1/V2 (WebSocket MCP duplication)
  audit: keep what's needed for the npm distribution, delete what's
  only inside the Tauri app.
- [ ] Remove the v1 `PRODUCT_VISION.md` once this V3 is approved;
  mark V2 as superseded.
- [ ] Icon system: snap every icon `size={…}` prop to `14 / 16 / 18`
  (three levels, matching the comment at [app-shell.css:47](src/shell/app-shell.css#L47)).
  Audit required.
- [ ] Hover-tint consistency: half the codebase uses `rgba(255,255,255,0.04)`
  and half uses `rgba(255,255,255,0.03)`. Pick one.
- [ ] Focus-visible outlines on all interactive primitives (started
  in Pass 5 legacy-normalization, finish for inputs + cards).

### Doc alignment

- [ ] Update `TAURI_MAC_APP_PLAN.md` with the phases that actually
  shipped vs planned.
- [ ] Update `PROJECT_ANALYSIS.md` with current folder structure.
- [ ] Update each `docs/context/*/README.md` to note whether the
  module lives in the Tauri shell, the engine, or both.
- [ ] Rewrite `DOCUMENTATION.md` as an index pointing at V3, the
  phase plan, and per-module docs.
- [ ] Retire `PRODUCT_VISION.md` (V1) — keep the file but mark it
  SUPERSEDED with a pointer to V3.
- [ ] Verify `ATTRIBUTIONS.md` still lists the right libraries
  (Tauri, git2-rs, security-framework, tauri-plugin-pty are new).

---
