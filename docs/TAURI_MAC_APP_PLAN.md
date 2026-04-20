# 0canvas → Tauri Mac App (Mac-only, browser overlay sunset)

> **Status:** Planning only — **not started**. Revisit after current fine-tuning and improvements to the existing npm overlay + V2 engine are complete.

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

## Locked Decisions

1. **Framework:** Tauri + Node sidecar (engine runs unchanged as child process)
2. **Distribution:** Direct download only. **Apple Developer ID ($99/yr) signed + notarized at launch** — no compromise on security. `tauri-plugin-updater` (Sparkle-style) auto-update via GitHub Releases with cryptographic signing. **No App Store** — sandbox would block the agent CLI runner. **During development (Phases 0–4):** use ad-hoc signing or Tauri's built-in dev signing — no Dev ID needed until Phase 5 distribution polish. Dev ID only purchased when preparing the public launch build.
3. **Scope:** Full vision v0.1 — native shell + full feature parity with today + git + Claude/OpenAI BYO-key + agent runner + skills system + worktree parallel agents
4. **Repo structure:** Single-app monorepo (not a multi-surface workspace) — details below
5. **Git UX:** Designer-only. Staged/unstaged/diff panel. **No Monaco, no file tree, no code viewer.** Visual token/style diffs only.
6. **AI:** Prefer Claude CLI via Max subscription (zero API cost), `@anthropic-ai/sdk` API-key fallback, OpenAI as alt provider. Keys in macOS keychain.
7. **Pricing model:** One-time tiered (Free with BYO-key / ~$59 Pro) — no monthly SaaS. Copy Clonk's model.
8. **Skills:** Markdown files at `.0canvas/skills/*.md`. User/community-extensible. No rebuild to add skills.
9. **Parallel agents via git worktrees** — the Mac app's killer differentiator the overlay literally cannot have.
10. **Browser overlay sunset:** final `0.0.x` release, deprecate on npm, repo banner pointing to Mac app, migration guide for any existing users.

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
- [src/vite-plugin.ts](../src/vite-plugin.ts) — entire Vite plugin
- [tsup.config.ts](../tsup.config.ts) — entry 2 (Vite plugin build) and entry 1's external-React config; keep engine build only
- [package.json](../package.json) — `./vite` export, `peerDependencies`, `peerDependenciesMeta`, `bin`, `main`, `module`, `types`, `exports`, `files` (all go away for an app, not a library)
- [src/index.ts](../src/index.ts) — public export surface (inspector utilities, hooks, types as public API). React component mounts internally, not exported.
- [src/0canvas/format/oc-project-store.ts](../src/0canvas/format/oc-project-store.ts) lines 128–186 — `downloadProjectFile` Blob/anchor, `importProjectFile` hidden file input
- [src/0canvas/db/variant-db.ts](../src/0canvas/db/variant-db.ts) — entire IndexedDB layer
- Iframe dual-mode fallbacks in [src/0canvas/inspector/target.ts](../src/0canvas/inspector/target.ts), source-node.tsx, variant-node.tsx — Mac app has one document
- Z-index `2147483646`/`2147483647` → `9999` (no host z-index war)

**MIGRATE (same capability, different storage/transport):**
- `oc-project-store.ts` IDB persistence (lines 37–54) → `~/Library/Application Support/0canvas/projects/{id}.0c` via Tauri fs
- `oc-sync-meta` IDB store → `~/Library/Application Support/0canvas/sync-meta.json`
- [src/0canvas/panels/style-panel.tsx:587](../src/0canvas/panels/style-panel.tsx#L587) localStorage focus-mode pref → `~/Library/Application Support/0canvas/settings.json`
- `AI_SETTINGS` localStorage → macOS keychain (via Tauri Rust command wrapping `security-framework`)
- Hardcoded `ws://localhost:24193/ws` ([src/0canvas/bridge/ws-client.ts:44](../src/0canvas/bridge/ws-client.ts#L44)) → reads `window.__0CANVAS_PORT__` injected by Tauri `initialization_script`

**KEEP UNCHANGED:**
- Engine ([src/engine/](../src/engine/)) — all 11 files, WebSocket protocol, MCP tools, cache, watcher, resolver, writer, framework detector
- All React UI ([src/0canvas/](../src/0canvas/)) except the deletions/migrations above
- Bridge messages schema ([src/0canvas/bridge/messages.ts](../src/0canvas/bridge/messages.ts)) — platform-neutral already
- `tinyglobby` file discovery — just point at user-selected repo root
- PostCSS-based CSS resolution, atomic temp-file-rename writes
- Framework detection

---

## Phased Plan (v0.1 target: 12–15 weeks solo)

### Phase 0 — Cleanup & Storage Migration (1–1.5 weeks)

**Goal:** existing codebase with IDB/npm plumbing stripped out; feature parity preserved against a local filesystem.

- Delete `vite-plugin.ts`, `db/variant-db.ts`, download/import UI in `oc-project-store.ts`, iframe dual-mode, npm-library exports
- Build `src/native/storage.ts` — same API shape as today's IDB calls, but backed by filesystem (initially via Node fs during dev, Tauri fs after Phase 1)
- Migrate `oc-project-store` IDB code paths to filesystem equivalent
- Migrate localStorage settings → single `settings.json`
- Fix hardcoded WS port — read from `window.__0CANVAS_PORT__` fallback 24193
- Simplify [tsup.config.ts](../tsup.config.ts) to engine-only entry
- Regression: every existing feature still works when running against local filesystem (dev mode with vanilla Vite harness for now)

**Exit criteria:** `pnpm dev` in the current repo shows every feature in the parity contract working; no IDB used; no Vite plugin used; clean codebase ready to be wrapped in Tauri.

### Phase 1 — Tauri Shell + Sidecar (2–3 weeks)

**Goal:** "it's a Mac app." 100% feature parity, zero new features.

- Scaffold `src-tauri/` with `cargo tauri init`
- Configure `tauri.conf.json`: window (1400×900, resizable), menu, CSP allowing `ws://localhost:*`, `http://localhost:*`
- Write `src-tauri/src/sidecar.rs`: launch compiled engine via `Command::sidecar` on app start, kill on exit, restart on crash
- Compile engine as **Bun single-file executable** via `bun build --compile` — critical for `@parcel/watcher` `.node` binary bundling (avoid `pkg`/`nexe` — fragile)
- Write `src-tauri/src/main.rs`: read engine's `.0canvas/.port` file to discover actual port, inject into webview via `initialization_script`
- Wire `src/native/storage.ts` to Tauri fs API (swap Node fs dev-mode for Tauri fs production)
- Build native menu: File (Open Folder, Open Recent, Close), Edit (Undo/Redo dispatched to store), View (Toggle Canvas/Inspector), Window, Help
- Native file dialog for "Open Folder" → sets engine's working root
- macOS permissions: Contacts/Calendar/etc. OFF. Only filesystem access (user-granted per-folder).
- Webview loads built React UI via `beforeDevCommand`/`beforeBuildCommand` → `vite build`

**Exit criteria:**
- `cargo tauri dev` opens Mac window, HMR works on React changes
- Every feature from the parity contract works identically to Phase 0
- `cargo tauri build` produces a working `.app` (ad-hoc signed, unsigned for distribution)
- Sidecar auto-restarts on crash; no zombie Node processes on app quit
- WebSocket reconnects cleanly after sidecar restart

### Phase 2 — Native Upgrades That Solve Current Pain Points (1.5–2 weeks)

**Goal:** deliver the promised Mac-app advantages that are impossible in a browser.

- **Local `theme.css` auto-sync** (solves today's #1 pain): replace `File System Access API` in [src/0canvas/themes/themes-page.tsx](../src/0canvas/themes/themes-page.tsx) with direct fs read + `@parcel/watcher` subscription. Token table live-updates when user edits `theme.css` in their IDE. Two-way sync preserved.
- **Project workspace manager** (new route): recent projects list, "Open Folder", framework badge per project, per-project `.0c` persistence path
- **macOS keychain for API keys**: Rust command wrapping `security-framework`; storage API swap transparent to UI
- **Native notifications**: replace in-app toasts with `tauri-plugin-notification` for important events (agent completed, PR pushed)
- **Deep link handler**: `zero-canvas://open?path=/Users/...` — for "Open in 0canvas" links later

**Exit criteria:** opening a cloned repo, theme.css edits flow both ways without manual upload; workspace manager shows recent projects; API keys persist through app restart via keychain.

### Phase 3 — Git UX for Designers (3–4 weeks)

**Goal:** full designer-safe git flow — no CLI, no Monaco, no file tree.

- `src-tauri/src/git.rs` with `git2-rs` exposing commands: `git_clone`, `git_status`, `git_stage`, `git_unstage`, `git_commit`, `git_push`, `git_pull`, `git_branch_create`, `git_branch_switch`, `git_branch_list`, `git_diff_file`, `git_log_recent`, `git_worktree_add`, `git_worktree_remove`, `git_worktree_list`
- GitHub auth: Device Flow OAuth; token in keychain
- New panel `src/panels/git-panel.tsx`:
  - Branch pill ("editing: main")
  - **Unstaged changes** list — files with visual diff preview on click
  - **Staged changes** list — same
  - **Recent commits** — last 10 on branch
  - Commit box — auto-suggested message from engine cache (e.g. "Updated button-primary color, adjusted hero spacing")
  - Buttons: Stage All, Unstage, Commit, Push, Pull, Open PR on GitHub (via `shell::open` to compare URL)
- Extend [src/0canvas/panels/visual-diff.tsx](../src/0canvas/panels/visual-diff.tsx) with file-level git diff tab showing token/style deltas (NOT raw code text)
- Clone flow in workspace manager: paste GitHub URL → `git_clone` → open

**Exit criteria:** designer pastes GitHub URL, clones, edits button color, clicks Save, sees commit on GitHub. Full flow in < 30 seconds for the happy path.

### Phase 4 — AI: Claude SDK + CLI Subprocess + Skills + Worktree Agents (3–4 weeks)

**Goal:** BYO-subscription AI with designer-specific skills and parallel-agent exploration.

- Add `@anthropic-ai/sdk` next to [src/0canvas/lib/openai.ts](../src/0canvas/lib/openai.ts). Extract `src/lib/ai-stream.ts` common streaming interface — panels become provider-agnostic dropdown.
- **Prompt caching mandatory**: `cache_control: {type:"ephemeral"}` on system prompt and tool defs. Recoups cost within 2 messages.
- **Claude CLI subprocess path** (Clonk/Commander pattern): if user has Claude Max, spawn `claude-code` via `shell::spawn` — zero API cost. Stream stdout/stderr back to chat panel via Tauri events. Provider dropdown: "Claude Max (CLI)", "Claude API", "OpenAI API".
- **Skills system**: `skills/` directory with markdown files. Engine exposes skills via new MCP tool `0canvas_list_skills`. Skills picker in AI panel. Each skill = specialized system prompt + allowlisted MCP tool set.
- Initial skills shipped:
  - `audit-contrast.md` — WCAG violations across all variants
  - `migrate-tokens.md` — rename/restructure tokens across codebase
  - `generate-variants.md` — produce N variants in parallel worktrees
  - `clone-design.md` — screenshot → tokens → rebuild in user's design system
  - `theme-propagation.md` — token change → update dependent styles consistently
- **Worktree parallel agents** (killer feature): `worktree.rs` orchestrates `git worktree add ../variant-a`, `../variant-b`, `../variant-c`; spawns 3 `claude-code` subprocesses in parallel, one per worktree, each with `generate-variants` skill. Existing [src/0canvas/canvas/variant-canvas.tsx](../src/0canvas/canvas/variant-canvas.tsx) renders all three side-by-side by running engine in read-only mode against each worktree. Designer picks one → `git worktree remove` others, merge chosen.
- **Mission-control AI tab** (capability-added to existing AI panel): active agents list, pending diffs to review, skill queue, token/cost meter

**Exit criteria:**
- User adds Claude key in settings → persists through restart
- Provider dropdown: Claude CLI (Max), Claude API, OpenAI — all three work
- "Generate 3 variants" creates 3 worktrees, 3 parallel agents, 3 live-rendered variants on canvas; pick merges one, discards others
- Skills picker shows all shipped skills; user can add `skills/custom.md` and it appears without rebuild

### Phase 5 — Distribution Polish (2 weeks)

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

### Phase 6 — Windows/Linux (post-v0.1, future)

Tauri cross-compiles. Re-evaluate after Mac v0.1 is shipping and stable (3+ months post-launch).

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
| Firewall prompt on engine start | Bind strictly to `127.0.0.1` (not `0.0.0.0` — note: today's server binds to `0.0.0.0` at [src/engine/server.ts:194](../src/engine/server.ts#L194), must change in Phase 1). |
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
- [src/vite-plugin.ts](../src/vite-plugin.ts)
- [src/0canvas/db/variant-db.ts](../src/0canvas/db/variant-db.ts)
- [src/index.ts](../src/index.ts) (public export surface) — replace with internal `src/main.tsx`
- [src/0canvas/format/oc-project-store.ts](../src/0canvas/format/oc-project-store.ts) lines 128–186 (download/import UI)
- [package.json](../package.json) fields: `bin`, `main`, `module`, `types`, `exports`, `files`, `peerDependencies`, `peerDependenciesMeta`
- [tsup.config.ts](../tsup.config.ts) entry 1 (browser lib) and entry 2 (Vite plugin); keep entry 3 (CLI/engine) for engine sidecar build, or replace with Bun compile script

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
- [src/0canvas/bridge/ws-client.ts:44](../src/0canvas/bridge/ws-client.ts#L44) — read port from `window.__0CANVAS_PORT__`
- [src/engine/server.ts:194](../src/engine/server.ts#L194) — bind to `127.0.0.1` not `0.0.0.0`
- [src/0canvas/format/oc-project-store.ts](../src/0canvas/format/oc-project-store.ts) lines 37–54 — swap IDB for filesystem
- [src/0canvas/panels/style-panel.tsx:587](../src/0canvas/panels/style-panel.tsx#L587) — swap localStorage for settings file
- [src/0canvas/themes/themes-page.tsx](../src/0canvas/themes/themes-page.tsx) — swap File System Access API for native fs + watcher
- [src/0canvas/inspector/overlay.ts](../src/0canvas/inspector/overlay.ts) lines 76, 82 — z-index to 9999
- [src/0canvas/inspector/target.ts](../src/0canvas/inspector/target.ts) — remove iframe dual-mode fallback (keep single-doc path)
- [package.json](../package.json) — becomes an app package (name `@zerosdesign/0canvas-mac`, private, Tauri scripts)

**Keep unchanged (100% reuse):**
- All of [src/engine/](../src/engine/) (11 files)
- All of [src/0canvas/canvas/](../src/0canvas/canvas/)
- All of [src/0canvas/editors/](../src/0canvas/editors/)
- All of [src/0canvas/panels/](../src/0canvas/panels/) (except specific modifications above)
- All of [src/0canvas/store/](../src/0canvas/store/)
- All of [src/0canvas/format/](../src/0canvas/format/) except `oc-project-store.ts` storage layer
- All of [src/0canvas/inspector/](../src/0canvas/inspector/) except overlay z-index and iframe fallback
- All of [src/0canvas/themes/](../src/0canvas/themes/) except file access layer
- [src/0canvas/bridge/messages.ts](../src/0canvas/bridge/messages.ts), [src/0canvas/bridge/use-bridge.tsx](../src/0canvas/bridge/use-bridge.tsx)

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

**Total effort:** 12–15 weeks for v0.1 (including Phase 0 cleanup and Phase 5 distribution). This is ~2–3 weeks longer than the earlier "shared codebase" plan's 9–13 weeks, but:
- Delivered app has **higher quality** (one tested surface, not two)
- **Zero ongoing dual-surface maintenance tax**
- Feature velocity from Phase 2 onwards is roughly 2× because there's no capability-gate discipline to enforce
- The Mac app gets all the killer differentiators (git, worktrees, CLI agents, native file sync) — overlay could never have these

**The net:** slightly longer to v0.1, then significantly faster forever after, and the product that ships is meaningfully better.
