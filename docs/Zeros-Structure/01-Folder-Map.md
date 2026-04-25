# Folder Map

This is a top-level map of what each important folder and file is for.

## Root Files

### `package.json`

The main app package. It describes the product as an Electron Mac app: "Visual design tool for production code. Mac app (Electron). Inspect elements, edit styles, push to git."

Important scripts:

- `pnpm dev`: runs the React/Vite renderer in a browser-like dev server.
- `pnpm electron:dev`: runs the full Electron Mac app in development.
- `pnpm build:engine`: builds the local engine.
- `pnpm build:sidecar`: builds the packaged engine binary.
- `pnpm electron:build`: builds the distributable Mac app.
- `pnpm test:adapters`: tests agent adapters.
- `pnpm check:ui`: checks UI consistency rules.

### `README.md`

Currently very minimal and stale. It still says "Design Collaboration Tool" and references Figma. It should be replaced with a real Zeros product README.

### `RULES.md`

Very important. This is the current design/code rulebook:

- One shared token file: `styles/tokens.css`.
- Components should use semantic tokens.
- Zeros Mac app and 0colors share the same token foundation.
- File organization rules are documented here.
- UI target is Cursor + Linear + Figma quality.

### `electron-builder.yml`

Electron packaging config. Used when creating the Mac app release.

### `vite.config.ts`, `tsup.config.ts`, `tsconfig.build.json`

Build tooling:

- Vite builds the React renderer.
- tsup builds the engine/main-process bundles.
- TypeScript config controls compile/type checking.

### `catalogs/models-v1.json`

Bundled model catalog for agent model pickers. It lists models for Claude, Codex/OpenAI, Gemini, Cursor, Amp, and Augment-like families. The app can hot-update this catalog through GitHub Pages.

## Main Product Code

### `src/`

The main Zeros app code. This is the product core.

Important areas:

- `src/main.tsx`: React entry point. Imports tokens and renders `AppShell`.
- `src/app-shell.tsx`: the top-level three-column Mac app shell.
- `src/shell/`: desktop app chrome and main workspace columns.
- `src/zeros/`: the design workspace, agents UI, inspector, store, themes, project format, and UI primitives.
- `src/engine/`: local backend engine that runs beside the Electron UI.
- `src/native/`: renderer-side wrapper around Electron native IPC.
- `src/demo/`: older/demo surfaces for browser iteration.
- `src/cli.ts`: command-line entry for serving the engine.

### `electron/`

The Electron main process and native command layer.

Important files:

- `electron/main.ts`: starts the Electron app, creates the window, spawns the engine sidecar, sets up menu/deep links/updater.
- `electron/preload.ts`: safely exposes `window.__ZEROS_NATIVE__` to the renderer.
- `electron/sidecar.ts`: spawns and watches the local engine process.
- `electron/ipc/router.ts`: central IPC router for renderer-to-main calls.
- `electron/ipc/commands/`: native command handlers for Git, terminal/PTY, shell, env files, CSS files, secrets, updater, skills, localhost discovery, and project switching.
- `electron/menu.ts`: native menu actions.
- `electron/deep-link.ts`: handles `zeros://` links.
- `electron/updater.ts`: update flow.

### `styles/tokens.css`

The one shared design-token source of truth. Zeros and 0colors are supposed to share these tokens so both products feel visually unified.

## Zeros UI Areas

### `src/shell/`

The Mac app shell. Think "Cursor-like IDE frame."

- `activity-bar.tsx`: far-left vertical activity icons.
- `title-bar.tsx`: custom title bar.
- `column1-nav.tsx`: left sidebar with chats, workspaces, localhost services, profile/settings.
- `column2-workspace.tsx`: middle workspace with Chat and Mission tabs.
- `column2-chat-view.tsx`: active chat rendering and agent picker flow.
- `empty-composer.tsx`: "New Agent" landing composer when no chat is active.
- `column3.tsx`: right/large work surface with Design, Git, Terminal, Env, Todo.
- `git-panel.tsx`: Git status, staging, commit, push/pull, branches, diffs.
- `terminal-panel.tsx`: embedded xterm terminal backed by native PTY.
- `env-panel.tsx`: `.env` file editor.
- `todo-panel.tsx`: markdown todo tracker.
- `mission-panel.tsx`: lightweight live agent activity monitor.
- `app-shell.css`: most shell styling.

### `src/zeros/engine/`

The old overlay workspace UI, now reused inside the Mac app.

- `zeros-engine.tsx`: exports public `<Zeros />` overlay and `EngineWorkspace`.
- `zeros-styles.ts`: injects the scoped design workspace CSS.
- `styles/`: split CSS modules for engine workspace areas.

In the Mac app, `EngineWorkspace` is mounted inside Column 3 instead of as a floating browser overlay.

### `src/zeros/inspector/`

DOM inspection and selection system.

- Finds elements in the previewed app.
- Builds element trees.
- Tracks hover/selection.
- Applies visual highlighting.
- Sends selected element context to the engine so agents can know what the user selected.

### `src/zeros/panels/`

Design workspace panels:

- `workspace-toolbar.tsx`: project name, style/feedback/theme mode, `.0c` import/export.
- `style-panel.tsx`: style editing surface.
- `inline-edit.tsx`: Cmd+K style inline edit path.
- `command-palette.tsx`: command palette.
- `visual-diff.tsx`: before/after visual diff.
- `app-sidebar.tsx`: internal design workspace sidebar.
- `settings-page.tsx`: settings inside the app.

### `src/zeros/editors/`

Focused style editors:

- `color-editor.tsx`
- `spacing-editor.tsx`
- `typography-editor.tsx`
- `layout-editor.tsx`
- `border-editor.tsx`
- `tailwind-editor.tsx`
- `controls.tsx`

These power the style panel.

### `src/zeros/canvas/`

Design canvas components:

- source preview node
- variant canvas
- variant node

This is where visual variants and source previews are represented.

### `src/zeros/themes/`

Theme/token file handling:

- CSS token parsing.
- Theme page.
- Theme mode panel.
- Color picker.
- Token resolution.

### `src/zeros/agent/`

Agent UI layer:

- chat UI
- session provider
- model/effort/permission pills
- agent picker
- auth modal
- enabled agents settings
- mention/slash command pickers
- per-agent branding

This is renderer-side. Actual CLI execution happens in `src/engine/agents`.

### `src/zeros/bridge/`

WebSocket client and message types between renderer and local engine.

- `ws-client.ts`: connects to engine WebSocket.
- `messages.ts`: message contract.
- `use-bridge.tsx`: React provider/hook around the connection.

### `src/zeros/store/`

Main React state store.

It holds:

- selected/hovered element
- project connection
- variants
- feedback
- themes
- AI settings
- chat threads
- pending chat submissions
- UI state

### `src/zeros/format/`

`.0c` project file format.

- `oc-project.ts`: schema, validation, import/export conversion.
- `oc-project-store.ts`: older IndexedDB + file sync path.
- `oc-parser.ts`, `oc-format.ts`: format helpers.

### `src/zeros/db/`

IndexedDB persistence for variants.

### `src/zeros/ui/`

Reusable UI primitives: buttons, inputs, tabs, cards, dialogs, dropdowns, scroll areas, tooltips, atoms, class merging.

New product UI should prefer these primitives.

### `src/zeros/lib/` and `src/zeros/utils/`

Utility code:

- AI stream helpers.
- OpenAI/Anthropic settings.
- CSS properties.
- Tailwind helpers.
- Clipboard helpers.

## Local Engine

### `src/engine/`

The local backend for the Mac app.

Important files:

- `index.ts`: `ZerosEngine` class. Starts indexing, WebSocket, MCP, file watcher, agent gateway.
- `server.ts`: local HTTP + WebSocket server.
- `cache.ts`: indexes CSS selectors/files/tokens.
- `css-resolver.ts`: finds source CSS rules.
- `css-writer.ts`: writes CSS changes.
- `tailwind-writer.ts`: writes Tailwind class changes.
- `oc-manager.ts`: reads/writes `.0c` files on disk.
- `mcp.ts`: exposes design tools to agents through MCP.
- `watcher.ts`: watches files.
- `framework-detector.ts`: identifies React/Next/Vue/etc.
- `agents/`: native agent adapter runtime.

### `src/engine/agents/`

Native agent backend.

- `registry.ts`: single source of truth for supported CLIs.
- `gateway.ts`: manages agents and sessions.
- `adapters/`: per-agent adapter implementations.
- `hook-server/`: localhost hook server used by agents that need callbacks.
- `session-paths.ts`: where agent sessions live on disk.
- `stream-json/`: parsing support.

## Sibling Products

### `apps/0colors/`

Vendored 0colors app. This is a complete separate product:

- `packages/frontend/`: Vite + React + Zustand color/token graph UI.
- `packages/backend/`: Hono backend with cloud sync, projects, templates, webhooks, token output APIs, community publishing, AI settings.
- `QA-automation/`: QA tests and automation.
- `scripts/`: QA and reporting helpers.

This is not yet integrated into the Mac app as a first-class module.

### `website/0accounts/`

0accounts website and shared auth package:

- `packages/frontend/`: accounts dashboard/login/profile/settings.
- `packages/auth-client/`: shared auth client consumed by 0colors and 0research.

### `servers/0accounts/`

0accounts backend API. Hono server on port `4456` locally. Uses Supabase for auth and Railway/Postgres-style data for profiles/products/access.

### `website/0research/`

0research frontend:

- public homepage
- authenticated `/internal` research tool
- internal AI/content tooling
- Directus/Supabase-related helpers

### `servers/0research/`

0research backend:

- Express API
- health route
- search route
- Supabase migrations and functions
- Directus sync scripts

## Generated Or Build Output

These folders are generated or release artifacts and should not be treated as source-of-truth product code:

- `dist/`
- `dist-electron/`
- `dist-engine/`
- `build/`
- `binaries/`
- `node_modules/`
- `snapshots/current/`
- `snapshots/diff/`

## Automation And Release

### `.github/workflows/`

- `publish-catalogs.yml`: publishes model catalog updates.
- `release.yml`: release automation.

### `scripts/`

Build and development helpers:

- sidecar build
- visual harness
- UI consistency check
- adapter tests
- fixture scripts

## Local Runtime Data

### `.zeros/`

Generated at runtime. Used by the engine for files like `.port`. It is ignored by Git.

### `.mcp.json`

Generated engine/MCP config. Ignored by Git.

### `.0canvas/`, `.claude/`, `.vscode/`

Tooling and local workspace folders. These are not product source.