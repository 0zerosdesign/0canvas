# Zeros — Context Module Index

> **2026-04-20; updated PR 2 and PR 4.** Each module `README.md` under this tree has a **doc label** banner (Partial / Superseded): **VS Code extension** and **Tauri** mentions in older prose are **historical**; the shipping app is **Electron** + the local engine — see [../Zeros-Structure/03-Mac-App-Architecture.md](../Zeros-Structure/03-Mac-App-Architecture.md).
>
> **2026-04-20; updated PR 2.** This directory carries per-module reference
> docs for the **design workspace / engine** code, originally written for
> the V1/V2 browser-overlay era. That code **still runs inside Column 3**
> of the Electron Mac app (`src/zeros/**`, `src/engine/**`). This index
> flags accuracy and gaps.
>
> **Current product vision and doc labels:** see
> [../Zeros-Structure/00-Start-Here.md](../Zeros-Structure/00-Start-Here.md)
> and [../Zeros-Structure/12-Doc-Index-And-Labels.md](../Zeros-Structure/12-Doc-Index-And-Labels.md).

---

## Module status

Each module doc below is categorized by where its code lives in the
Mac app, and how current the doc is:

- **Engine / Col 3**: the code lives in `src/zeros/**` + `src/engine/**`,
  runs as part of the Column 3 canvas.
- **Shell / Col 1-2**: the code lives in `src/shell/**` — not covered
  by existing docs (see §Gaps).
- **Electron main**: the code lives in `electron/**` (IPC, sidecar,
  keychain, PTY, Git, menus) — not covered module-by-module here (see
  `docs/Zeros-Structure/03-Mac-App-Architecture.md`).

| Module | Location | Doc status | Notes |
|---|---|---|---|
| [inspector/](inspector/README.md) | Engine / Col 3 | ✅ current | DOM inspector overlay. Still correct. |
| [style-panel/](style-panel/README.md) | Engine / Col 3 | ✅ current | StylePanel component + editors/libraries sub-docs. Still correct. |
| [canvas-variants/](canvas-variants/README.md) | Engine / Col 3 | ✅ current | Variant canvas + ReactFlow wiring. |
| [themes/](themes/README.md) | Engine / Col 3 | ✅ current | ThemesPage + theme mode panel. Now accessed via Col 3 page tab instead of sidebar. |
| [feedback/](feedback/README.md) | Engine / Col 3 | ✅ current | Feedback annotations + right-panel Feedback tab. |
| [format-persistence/](format-persistence/README.md) | Engine / Col 3 | 🚧 partial | `.0c` file schema still correct. "IndexedDB primary" description is stale — Mac app is file-first via `native/storage.ts`. |
| [responsive/](responsive/README.md) | Engine / Col 3 | ✅ current | Device presets + breakpoint switcher. |
| [settings/](settings/README.md) | Engine + Shell | 🚧 partial | Engine-era settings page is still rendered by `settings-page.tsx`, but it now lives *inside Col 3* (Pass 4) and uses Keychain-backed storage via the Electron main path (see `electron/ipc/commands/secrets.ts`). The sidebar described here is the Pass-4 horizontal tabs. |
| [ai-agents/](ai-agents/README.md) | Engine / Col 3 | 🚧 partial | Inline-edit flow is still correct. The "AI panel in Col 3 right slot" is being removed per V3 Decision 8 — Col 2 owns AI. |
| [bridge-communication/](bridge-communication/README.md) | Engine / Col 3 | 🚧 partial | Engine ↔ webview WebSocket is still correct. The sidecar is owned by `electron/sidecar.ts` (not user-run CLI). MCP is still relevant *for external AI tools*; Col 2 agent chat uses the native agent stack, not that MCP path for the same work. |
| [overlay/](overlay/README.md) | Engine / Col 3 | 🚧 partial | "Overlay" means Col 3 content now. No FAB button in the Mac app. Command palette (Cmd+/) and inline edit (Cmd+K) still work. |
| [extension/](extension/README.md) | SUPERSEDED | ⏳ obsolete | The VS Code extension is frozen / deprecated per V3. Kept for historical context. |
| [tailwind/](tailwind/) | *empty directory* | ⏳ gap | Tailwind class-writer docs never written. |

---

## Gaps (modules with no doc yet)

These are code surfaces that exist but aren't documented in `context/`.
Each is a candidate for a new subdirectory under this index.

### `src/shell/` — the Electron app shell

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

### `electron/` — main process (native)

IPC handlers, sidecar management, keychain, PTY, Git, file commands,
deep links, menus. Start with `electron/main.ts`, `electron/sidecar.ts`,
`electron/ipc/router.ts`, and `electron/preload.ts`. No per-file
reference doc in `context/` yet; see
[../Zeros-Structure/03-Mac-App-Architecture.md](../Zeros-Structure/03-Mac-App-Architecture.md).

### `src/native/` — renderer native facade

TypeScript wrappers around the preload’s `invoke` / `listen` surface:

- `native.ts` — bridge entry.
- `storage.ts` — app-data JSON read/write.
- `settings.ts` — settings shim backed by `storage.ts`.
- `secrets.ts` — Keychain access via the Electron main process.
- `recent-projects.ts` — recent project list persistence.

### Skills system

Skills are markdown under `<project>/skills/`. The loader lives in
`electron/ipc/commands/skills.ts`. No module doc in `context/` yet.

---

## Per-module TODO (fine-tuning)

Tracked alongside `docs/Zeros-Structure/09-Cleanup-And-Consolidation-Plan.md`
and per-module refresh work.

### format-persistence/

- [ ] Remove the "IndexedDB primary" paragraphs; the current truth is
      "file-first via `native/storage.ts`". IDB is only used for
      ephemeral UI state (scroll position, etc.).
- [ ] Document the `~/Library/Application Support/zeros/` layout
      (projects, settings.json, keychain, logs).

### settings/

- [ ] Replace the vertical-sidebar diagram with the Pass-4 horizontal
      tabs screenshot/description.
- [ ] Document the Claude Pro OAuth flow (new in Phase 4).
- [ ] Document Keychain-backed API-key storage path.

### ai-agents/

- [ ] Remove the "AI panel in Col 3 right slot" references; that path
      is being deleted (Stream 2).
- [ ] Add a pointer to the Col 2 chat surface and the engine’s native
      agent / CLI adapter routing (`src/engine/agents/`, `electron/ipc/commands/ai-cli.ts`).
- [ ] Document the Skills system (markdown-driven specialized prompts).

### bridge-communication/

- [ ] Clarify two AI surfaces:
      - Engine ↔ external AI tools via MCP (still works; see V2 §7).
      - Col 2 chat ↔ subprocess / Anthropic SDK (new, bypasses MCP).
- [ ] Document the sidecar lifecycle owned by `electron/sidecar.ts`:
      spawn, port discovery, kill-on-close, respawn on project change.
- [ ] Document the `project-changed` (or equivalent) main→renderer path and the
      `onProjectChanged` listener used by `app-shell.tsx`.

### overlay/

- [ ] Rename / clarify: "overlay" in the Mac-app era means Column 3.
      No FAB, no portal into `document.body` — it's just a column.
- [ ] The V1 `<Zeros />` component is still shipped for the npm
      distribution; note that distinction.

### extension/

- [x] Mark SUPERSEDED at the top — **done (PR 4 doc label).** The VS Code extension is frozen
      and not on any active roadmap.

### tailwind/

- [ ] Either populate with the Tailwind class-writer architecture
      (from `src/engine/tailwind-writer.ts`) or remove the directory.

### New docs needed (gaps)

- [ ] `shell/README.md` — describe each of the six Col 2 panels +
      Col 1 nav.
- [ ] `electron-main/README.md` — optional: one section per concern in
      `electron/` (or link out to `Zeros-Structure/03` only).
- [ ] `native-bridge/README.md` — `src/native/` + preload contract.
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
4. **Retire** `extension/` with a SUPERSEDED banner — done at file level;
   product vision now lives in `docs/Zeros-Structure/`.

Progress on each of these is reflected in
[../Zeros-Structure/09-Cleanup-And-Consolidation-Plan.md](../Zeros-Structure/09-Cleanup-And-Consolidation-Plan.md)
and [../Zeros-Structure/12-Doc-Index-And-Labels.md](../Zeros-Structure/12-Doc-Index-And-Labels.md).
