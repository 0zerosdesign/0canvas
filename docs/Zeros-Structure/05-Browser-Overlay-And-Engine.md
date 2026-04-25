# Browser Overlay And Engine

This explains what happened to the original browser overlay and how much of it still exists.

For the deeper breakdown of the Style editor, variants, `.0c` persistence, and backend write flow, read `11-Design-Workspace-Style-Editor-Deep-Dive.md`.

## Short Answer

The browser overlay did not disappear. Its core design workspace became the **Design tab in Column 3** of the Mac app.

Old model:

> Add `<Zeros />` to a web page and open a floating overlay on top of that page.

Current Mac app model:

> Open the Zeros Mac app, pick a project/dev server, and use the design workspace inside the desktop shell.

## What Still Exists

The overlay entry still exists in:

- `src/zeros/engine/zeros-engine.tsx`

It exports:

- `<Zeros />`: the public floating overlay component.
- `<EngineWorkspace />`: the workspace UI used by both overlay and Mac app.
- `AutoConnect`: connects the workspace to the current environment.

The Mac app mounts `EngineWorkspace` in:

- `src/shell/column3.tsx`

## Browser Overlay Behavior

The old `<Zeros />` component:

1. Creates a portal div on `document.body`.
2. Injects Zeros CSS into the page.
3. Shows a floating action button when closed.
4. Opens a full-screen overlay when active.
5. Uses `Ctrl/Cmd + Shift + D` shortcut.
6. Skips mounting inside preview iframes.
7. Wraps the workspace with store and bridge providers.

This is still useful if Zeros is published as an embeddable npm package, but it is no longer the primary Mac app experience.

## Mac App Behavior

In the Mac app:

1. `src/app-shell.tsx` renders the full desktop shell.
2. `src/shell/column3.tsx` renders Column 3 tabs.
3. The `Design` tab mounts `EngineWorkspace`.
4. The engine workspace uses the same inspector/style/canvas modules.
5. Column 3 adds native-adjacent tabs: Git, Terminal, Env, Todo.

This means the old overlay is now more like an internal design module.

## What The "Engine" Means

There are two meanings that can be confusing:

### UI engine / overlay engine

This is the React design workspace:

- `src/zeros/engine/zeros-engine.tsx`
- `src/zeros/engine/zeros-styles.ts`
- `src/zeros/panels/`*
- `src/zeros/canvas/*`
- `src/zeros/inspector/*`

It is what the user sees.

### Local backend engine

This is the hidden sidecar process:

- `src/engine/index.ts`
- `src/engine/server.ts`
- `src/engine/*`

It indexes files, writes changes, serves WebSocket/MCP, and manages agents.

Cleanup recommendation:

- Rename docs/comments so "engine" is not overloaded.
- Use **Design Workspace** for the UI.
- Use **Local Engine** for the sidecar backend.

## What Happened To The Old VS Code Extension

The old VS Code extension path is documented as superseded in `docs/context/extension/README.md`.

Its old responsibilities moved to the local engine:

- CSS source resolution
- file writing
- `.0c` sync
- MCP tools
- agent handoff

The current repo does not show an active `extensions/vscode` folder in the top-level source map, and the docs say it is frozen/not on the active roadmap.

## What Happened To ACP

ACP as a runtime dependency was replaced by native adapters.

Current facts:

- `src/engine/acp/` is gone.
- `src/zeros/acp/` became `src/zeros/agent/`.
- Wire message names now use `AGENT_`*.
- Some ids/comments still contain `acp` for compatibility/history.
- `@agentclientprotocol/sdk` is still present for types.

Product meaning:

> The user should not think about ACP. They should think "Zeros connects to the AI coding tools I already use."

## What Works In The Design Workspace

The current design workspace supports or partially supports:

- project connection
- app preview selection through localhost
- DOM element inspection
- element selection/highlight
- style panel
- style edits written through local engine
- Tailwind class changes
- variants
- feedback
- theme mode
- token file parsing/editing
- command palette
- inline edit
- visual diff
- `.0c` import/export

## What Is Legacy Or Needs Cleanup

### Floating overlay UI

Keep it only if the public npm overlay is still part of strategy. If the product is Mac-app-first, isolate it as legacy/public-package mode.

### CSS injection

`zeros-styles.ts` is still an active monolithic injection entry. Column 3 has to carefully apply `data-Zeros-root` only for the Design tab because the engine CSS reset can damage the Git/Terminal/Env/Todo typography.

This is a strong signal that styling needs cleanup.

### Docs mentioning overlay as primary

Some docs still explain the browser overlay as the main product. They should be labeled historical or rewritten.

### Tauri references

**PR 1** updated most stale **code** comments. **PR 2** added `12-Doc-Index-And-Labels.md` and fixed doc indexes. Legacy **attribute** names (for example `data-tauri-drag-region`) can remain for compatibility; behavior is provided by Electron.

### Design mode names

Some docs mention an `"ai"` design mode, but current store type is `"style"` or `"feedback"` plus separate theme mode. Verify and clean docs/types before building new features on this.

## Recommended Product Direction

Choose one primary surface:

> Zeros is the Mac app. The browser overlay is a legacy/public-package mode.

Then structure code around that:

- `src/shell`: Mac shell.
- `src/design-workspace`: renamed from `src/zeros/engine` over time.
- `src/local-engine`: clarify backend engine naming, if practical.
- `src/zeros/agent`: agent UI.
- `src/engine/agents`: native agent backend.

Do not remove working overlay code until the public package decision is clear. But stop letting overlay assumptions shape the Mac app UX.

## Product Explanation For The User

The old overlay was like a design layer floating over a website. The new Mac app is a full workspace around that design layer: chats, agents, Git, terminal, env, todos, and project files all live together.