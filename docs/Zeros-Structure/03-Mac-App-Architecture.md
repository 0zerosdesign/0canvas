# Mac App Architecture

This explains how the app works behind the scenes without assuming deep technical background.

## One-Sentence Version

Zeros is an Electron Mac app where the visible React UI talks to a hidden local engine process, and that engine talks to the user's project files, coding-agent CLIs, and MCP tools.

## The Three Main Processes

### 1. Electron Main Process

Lives in `electron/`.

This is the native Mac app controller. It:

- creates the app window
- owns the native menu
- spawns the engine sidecar
- manages deep links
- manages auto-update
- exposes native commands to the renderer
- runs file/Git/shell/PTY commands safely outside the browser sandbox

Important files:

- `electron/main.ts`
- `electron/preload.ts`
- `electron/sidecar.ts`
- `electron/ipc/router.ts`
- `electron/ipc/commands/*`

### 2. Renderer Process

Lives mostly in `src/`.

This is the visible React app. It:

- renders the three-column shell
- stores UI state
- shows chats
- shows design panels
- sends requests to Electron native IPC
- sends engine messages over WebSocket

Important files:

- `src/main.tsx`
- `src/app-shell.tsx`
- `src/shell/*`
- `src/zeros/*`

### 3. Engine Sidecar Process

Lives in `src/engine/`.

This is a local backend process. It:

- indexes the user project
- watches files
- resolves CSS selectors to source files
- writes CSS/Tailwind changes
- manages `.0c` files
- exposes MCP tools to agents
- manages native coding-agent CLIs
- serves HTTP + WebSocket on localhost

Important files:

- `src/engine/index.ts`
- `src/engine/server.ts`
- `src/engine/mcp.ts`
- `src/engine/agents/*`

## Boot Sequence

When the app starts:

1. Electron main starts.
2. It separates dev and prod app identity (`Zeros Dev` in development).
3. It hydrates the real macOS shell PATH so CLIs installed by the user are available.
4. It starts the engine sidecar with a project root.
5. The engine binds to `127.0.0.1`, usually port `24193`.
6. The engine writes `<project>/.zeros/.port`.
7. Electron creates the BrowserWindow.
8. The React renderer loads.
9. The renderer connects to the engine WebSocket.
10. The app hydrates chats, settings, and recent projects.
11. Agents are pre-warmed after the engine reports ready.

## Communication Map

```
User clicks/types
  ↓
React renderer
  ↓                 ↘
Electron IPC         WebSocket
  ↓                   ↓
Native commands       Local engine
  ↓                   ↓
File system/Git       Project index, CSS writer, MCP, agent CLIs
```

## Electron IPC

Electron IPC is used for native Mac operations the browser cannot do safely.

Examples:

- open project folder
- read/write `.env`
- Git status/stage/commit/push
- spawn terminal PTY
- read/write CSS files
- keychain/secrets
- shell open URL
- reveal in Finder
- notifications
- updater

The renderer calls these through `src/native/native.ts` and `src/native/runtime.ts`.

The important design choice:

> React components should not know Electron details. They call a small native facade.

## WebSocket Engine Bridge

The renderer talks to the engine through a WebSocket client:

- `src/zeros/bridge/ws-client.ts`
- `src/zeros/bridge/use-bridge.tsx`
- `src/zeros/bridge/messages.ts`

Used for:

- style changes
- source maps
- project state sync
- selected element context
- agent session messages
- engine readiness

## Local Engine Responsibilities

### Project Indexing

The engine scans the project and builds a selector/file/token index.

Purpose:

- find CSS selectors
- resolve style edits to real files
- understand framework shape
- expose project knowledge to agents

### CSS Writing

When the user edits a style:

1. React sends `STYLE_CHANGE`.
2. Engine resolves the selector/property.
3. Engine writes the CSS file.
4. React receives an acknowledgement.
5. The user's dev server hot reloads.

### Tailwind Writing

When a Tailwind class change is requested:

1. React sends `TAILWIND_CLASS_CHANGE`.
2. Engine finds JSX/TSX className usage.
3. Engine edits the class string.

This is best-effort and should be treated carefully because JSX matching can be ambiguous.

### File Watching

The engine watches project files so caches can stay fresh.

### MCP

The engine exposes MCP tools at `/mcp`.

Why it matters:

- Agents can ask Zeros for design context.
- Agents can get the selected element.
- Agents can apply design-aware changes.

### Agent Gateway

The engine owns the coding-agent runtime.

It:

- lists supported agents
- checks whether CLIs are installed
- checks auth status without reading secrets
- starts sessions
- sends prompts
- handles permissions
- streams updates back to React

## Sidecar Watchdog

`electron/sidecar.ts` keeps the engine alive.

It:

- kills stranded old engine processes on startup if they look like Zeros engines.
- spawns the engine.
- polls for the `.zeros/.port` file.
- checks the engine port every 2 seconds.
- respawns the engine after repeated failures.
- emits `engine-restarted` so the renderer can reconnect.

Why this matters for UX:

- The app should recover if the local engine crashes.
- The user should not need to restart the whole Mac app.

## Project Switching

Current behavior:

1. User opens a folder.
2. Electron respawns the engine for that folder.
3. Renderer receives `project-changed`.
4. Renderer reloads the webview.

This is reliable but not seamless.

Future ideal:

- Keep the React app mounted.
- Swap engine root.
- Rehydrate project-specific state.
- Preserve app shell and visible UI.

## Current Native Runtime Status

The codebase has migration leftovers:

- Legacy **attribute** names (for example `data-tauri-drag-region`) may
  still appear; behavior is provided by the Electron window.
- **PR 1** updated many obsolete “Tauri / Rust side / ACP” **comments** in
  source; **PR 2** labeled documentation (see `12-Doc-Index-And-Labels.md`).
- Current root package and main process are **Electron**; the active
  renderer bridge is `window.__ZEROS_NATIVE__` from `electron/preload.ts`.

## What Happens In Browser-Only Dev

If someone runs only `pnpm dev`:

- React renderer runs in Vite.
- Electron native APIs are missing.
- Read-style native functions often return empty/null.
- Write-style native functions throw a clear "requires the Mac app" error.

This is useful for UI iteration, but it is not the real product environment.

## Performance Notes

Current performance-positive decisions:

- Engine runs local, not remote.
- Agents are pre-warmed.
- Engine port range avoids hard startup failures.
- Shell PATH hydration fixes missing CLI problems.
- Sidecar watchdog recovers engine crashes.
- Renderer caps per-chat message history to avoid memory growth.

Current performance risks:

- Full webview reload on project switch.
- The old engine workspace CSS is injected as a large scoped stylesheet.
- Some old overlay UI assumptions still live inside the native app.
- 0colors is not yet code-split as a native module because it is still a separate app.

## Product Interpretation

For a non-technical owner:

- **Electron** is the Mac app container.
- **Renderer** is the visible interface.
- **Engine** is the local backend.
- **IPC** is how the visible app asks the Mac for native things.
- **WebSocket** is how the visible app talks to the local Zeros engine.
- **MCP** is how agents get Zeros-specific design tools.
- **Agent adapters** are translators between Zeros and installed CLIs like Claude/Codex.

