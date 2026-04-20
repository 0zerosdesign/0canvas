# 0canvas — Context Module Index

> **2026-04-20.** This directory carries per-module reference docs for
> the engine and overlay code, originally written for the V1/V2 era.
> The code those docs describe **still lives in the Tauri Mac app** —
> it's now the Column 3 canvas (engine) and its shared panel/inspector
> subsystem. This index tells you which module doc is still accurate,
> which needs a touch-up, and where the gaps are.
>
> For the current product vision see
> [../PRODUCT_VISION_V3.md](../PRODUCT_VISION_V3.md).

---

## Module status

Each module doc below is categorized by where its code lives in the
Mac app, and how current the doc is:

- **Engine / Col 3**: the code lives in `src/0canvas/**` + `src/engine/**`,
  runs as part of the Column 3 canvas.
- **Shell / Col 1-2**: the code lives in `src/shell/**` — not covered
  by existing docs (see §Gaps).
- **Rust backend**: the code lives in `src-tauri/src/**` — not covered
  by existing docs (see §Gaps).

| Module | Location | Doc status | Notes |
|---|---|---|---|
| [inspector/](inspector/README.md) | Engine / Col 3 | ✅ current | DOM inspector overlay. Still correct. |
| [style-panel/](style-panel/README.md) | Engine / Col 3 | ✅ current | StylePanel component + editors/libraries sub-docs. Still correct. |
| [canvas-variants/](canvas-variants/README.md) | Engine / Col 3 | ✅ current | Variant canvas + ReactFlow wiring. |
| [themes/](themes/README.md) | Engine / Col 3 | ✅ current | ThemesPage + theme mode panel. Now accessed via Col 3 page tab instead of sidebar. |
| [feedback/](feedback/README.md) | Engine / Col 3 | ✅ current | Feedback annotations + right-panel Feedback tab. |
| [format-persistence/](format-persistence/README.md) | Engine / Col 3 | 🚧 partial | `.0c` file schema still correct. "IndexedDB primary" description is stale — Mac app is file-first via `native/storage.ts`. |
| [responsive/](responsive/README.md) | Engine / Col 3 | ✅ current | Device presets + breakpoint switcher. |
| [settings/](settings/README.md) | Engine + Shell | 🚧 partial | Engine-era settings page is still rendered by `settings-page.tsx`, but it now lives *inside Col 3* (Pass 4) and gets the Keychain-backed API key path from `src-tauri/src/secrets.rs`. The sidebar described here is the Pass-4 horizontal tabs. |
| [ai-agents/](ai-agents/README.md) | Engine / Col 3 | 🚧 partial | Inline-edit flow is still correct. The "AI panel in Col 3 right slot" is being removed per V3 Decision 8 — Col 2 owns AI. |
| [bridge-communication/](bridge-communication/README.md) | Engine / Col 3 | 🚧 partial | Engine ↔ webview WebSocket is still correct. The sidecar now launches via `src-tauri/src/sidecar.rs` (not user-run CLI). MCP bridge description is still accurate *for the external-AI-tool surface*; Col 2 chat bypasses MCP. |
| [overlay/](overlay/README.md) | Engine / Col 3 | 🚧 partial | "Overlay" means Col 3 content now. No FAB button in the Mac app. Command palette (Cmd+/) and inline edit (Cmd+K) still work. |
| [extension/](extension/README.md) | SUPERSEDED | ⏳ obsolete | The VS Code extension is frozen / deprecated per V3. Kept for historical context. |
| [tailwind/](tailwind/) | *empty directory* | ⏳ gap | Tailwind class-writer docs never written. |

---

## Gaps (modules with no doc yet)

These are code surfaces that exist but aren't documented in `context/`.
Each is a candidate for a new subdirectory under this index.

### `src/shell/` — the Tauri shell

Covers Col 1 nav, Col 2 tabs, and the six Col 2 panel components:

- `column1-nav.tsx` — brand row, New Chat, Skills, workspace dropdown,
  chats list, localhost list, profile menu.
- `column2-workspace.tsx` — tab routing for Chat / Git / Terminal /
  Env / Todo / Mission.
- `git-panel.tsx` — Git panel (branches, diff, stage, commit, push).
- `terminal-panel.tsx` — xterm.js + pty.
- `env-panel.tsx` — `.env*` file editor.
- `todo-panel.tsx` — per-project todos.
- `mission-panel.tsx` — Mission Control dashboard over the AI subprocess bridge.

### `src-tauri/src/` — Rust backend

Ten modules, 3,062 LOC total. See
[../PRODUCT_VISION_V3.md §7](../PRODUCT_VISION_V3.md#7-rust-backend--what-lives-where)
for the current breakdown. No per-module reference doc yet.

### `src/native/` — Tauri JS bridge

Thin TypeScript wrappers around Tauri commands:

- `storage.ts` — app-data JSON read/write.
- `settings.ts` — `getSetting` / `setSetting` shim backed by
  `storage.ts`.
- `secrets.ts` — Keychain access via `secrets.rs`.
- `tauri-events.ts` — `onProjectChanged`, `shellOpenUrl`, etc.
- `recent-projects.ts` — recent project list persistence.

### Skills system

Skills live in `skills/*.md`. Loaded by `src-tauri/src/skills.rs`.
See [../PRODUCT_VISION_V3.md §9](../PRODUCT_VISION_V3.md#9-ai-integration).
No module doc yet.

---

## Per-module TODO (fine-tuning)

Tied to Stream 1.5 of [../PRODUCT_VISION_V3.md §15](../PRODUCT_VISION_V3.md#15-todo--fine-tuning-needed).

### format-persistence/

- [ ] Remove the "IndexedDB primary" paragraphs; the current truth is
      "file-first via `native/storage.ts`". IDB is only used for
      ephemeral UI state (scroll position, etc.).
- [ ] Document the `~/Library/Application Support/zero-canvas/` layout
      (projects, settings.json, keychain, logs).

### settings/

- [ ] Replace the vertical-sidebar diagram with the Pass-4 horizontal
      tabs screenshot/description.
- [ ] Document the Claude Pro OAuth flow (new in Phase 4).
- [ ] Document Keychain-backed API-key storage path.

### ai-agents/

- [ ] Remove the "AI panel in Col 3 right slot" references; that path
      is being deleted (Stream 2).
- [ ] Add a pointer to the Col 2 Chat panel and the `ai_cli.rs` /
      `anthropic.ts` streaming routing.
- [ ] Document the Skills system (markdown-driven specialized prompts).

### bridge-communication/

- [ ] Clarify two AI surfaces:
      - Engine ↔ external AI tools via MCP (still works; see V2 §7).
      - Col 2 chat ↔ subprocess / Anthropic SDK (new, bypasses MCP).
- [ ] Document the sidecar lifecycle owned by `src-tauri/src/sidecar.rs`:
      spawn, port discovery, kill-on-close, `respawn_engine` on project change.
- [ ] Document the `project-changed` Tauri event + the
      `onProjectChanged` listener used by `app-shell.tsx`.

### overlay/

- [ ] Rename / clarify: "overlay" in the Mac-app era means Column 3.
      No FAB, no portal into `document.body` — it's just a column.
- [ ] The V1 `<ZeroCanvas />` component is still shipped for the npm
      distribution; note that distinction.

### extension/

- [ ] Mark SUPERSEDED at the top. The VS Code extension is frozen
      and not on any active roadmap.

### tailwind/

- [ ] Either populate with the Tailwind class-writer architecture
      (from `src/engine/tailwind-writer.ts`) or remove the directory.

### New docs needed (gaps)

- [ ] `shell/README.md` — describe each of the six Col 2 panels +
      Col 1 nav.
- [ ] `rust-backend/README.md` — one per Rust module, aligned with
      V3 §7.
- [ ] `native-bridge/README.md` — Tauri JS bridge.
- [ ] `skills/README.md` — skills directory structure, frontmatter
      schema, bundled skills, how to add a custom skill.

---

## Execution approach

Rather than audit and rewrite all 16 module docs in one sprint, the
plan is:

1. **Banner each stale doc** with a one-line status pointer to this
   index so readers know the scope of drift.
2. **Write the three gap docs** (`shell/`, `rust-backend/`,
   `native-bridge/`) since those are the biggest coverage holes.
3. **Patch the four 🚧 partial docs** (format-persistence, settings,
   ai-agents, bridge-communication, overlay) as the related code is
   touched during Streams 2-5.
4. **Retire** `extension/` with a SUPERSEDED banner once V3 is the
   single source of vision truth.

Progress on each of these lives in
[../PRODUCT_VISION_V3.md §15 Stream 1.5](../PRODUCT_VISION_V3.md#15-todo--fine-tuning-needed).
