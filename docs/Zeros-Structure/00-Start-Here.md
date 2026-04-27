# Zeros Structure: Start Here

This folder is a plain-English map of the current `0canvas` codebase. It is written for a product/design owner who wants to understand what the app does today, what is legacy, what is still in progress, and how the pieces should be cleaned up.

## What This Repo Is Today

The repo is not one simple app yet. It currently contains several product eras and sibling products:

- **Zeros Mac app**: the main product now. It is an Electron desktop app with a local engine process.
- **Zeros design workspace**: the former browser overlay experience, now mounted inside Column 3 of the Mac app.
- **Agent runtime**: a native CLI adapter layer for Claude Code, Codex, Cursor Agent, Droid, Copilot, and Gemini.
- **0colors**: a full separate token/color intelligence product vendored under `apps/0colors`.
- **0accounts**: shared account/auth website, backend, and auth client under `website/0accounts` and `servers/0accounts`.
- **0research**: learning/research website and internal tooling under `website/0research` and `servers/0research`.
- **Old docs and migration notes**: useful context, but some still mention Tauri, browser overlay, ACP, or VS Code extension flows that are no longer the primary path.

## The Most Important Mental Model

Think of the app as three layers:

1. **Desktop shell**
  The Electron app window, menus, native IPC, filesystem, keychain, terminal, Git, updater, project picker, and sidecar engine management.
2. **Local engine**
  A Node/Bun process spawned by Electron. It indexes the user project, watches files, writes CSS/source changes, serves WebSocket + MCP, and manages agent CLI sessions.
3. **React product UI**
  The visible three-column app: project/chat sidebar, agent chat workspace, and design/IDE panels.

## Current User Promise

The current Zeros product is trying to become:

> A local-first Mac app for designers and builders to open a codebase, inspect and edit UI, talk to coding agents using their existing subscriptions, manage project files, and eventually build token/color systems through 0colors.

That promise is partly implemented today. The strongest current areas are:

- Mac app shell and local engine boot.
- Agent chat and native CLI adapter direction.
- Project-scoped chats.
- Design workspace mounted in the Mac app.
- Git, terminal, env, and todo panels.
- Theme/token CSS inspection basics.

The weakest or most mixed areas are:

- `.0c` versus future `.zeros` format consolidation.
- Browser overlay public package versus Mac-app-only direction.
- 0colors integration into Zeros.
- `docs/context/` module docs now carry a **doc label** (PR 4) at the top: **Tauri** / **VS Code extension** phrasing in the body is **historical** unless the label says otherwise. The master list is `12-Doc-Index-And-Labels.md`. Active **code** comments were updated in PR 1.
- Some UI features are functional but still carry old names, old assumptions, or placeholder/migration comments.

## Reading Order

For a fast on-ramp, start with the repository **`README.md`** at the root (how to run the Mac app and how the three processes fit together). Then read these in order:

1. `01-Folder-Map.md` explains every top-level folder/file.
2. `02-Current-User-Flows.md` explains the app from the user perspective.
3. `03-Mac-App-Architecture.md` explains the desktop/backend flow.
4. `04-Agent-Chat-And-Agents.md` explains chat windows and native agents.
5. `05-Browser-Overlay-And-Engine.md` explains what happened to the old overlay.
6. `06-Project-Files-0c-And-Zeros.md` explains `.0c`, `.zeros`, and persistence.
7. `07-0colors-Integration.md` explains how 0colors should fold into the Mac app.
8. `08-0accounts-0research-Websites.md` explains accounts/auth/research.
9. `09-Cleanup-And-Consolidation-Plan.md` gives a cleanup roadmap.
10. `10-UI-Inventory-And-Wiring-Status.md` lists visible UIs and what is wired, partial, placeholder, or legacy.
11. `11-Design-Workspace-Style-Editor-Deep-Dive.md` explains the style editor, variants, `.0c`, and backend flow in detail.
12. `12-Doc-Index-And-Labels.md` lists which docs are current, partial, historical, or aspirational (naming and boundaries cleanup).

## Important Naming Reality

The repo still has mixed names:

- `0canvas` is the folder name.
- `@withso/zeros` is the root package.
- The app UI says **Zeros**.
- The older design file format is `.0c`.
- The future product file direction appears to be `.zeros`.
- Agent code still contains some historical `acp` ids for compatibility, even though the runtime is now native.

This is normal during a migration, but it should be cleaned up deliberately.