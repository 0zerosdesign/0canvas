# UI Inventory And Wiring Status

This document lists the visible UI surfaces across the Mac app, 0colors, 0research, and 0accounts. It focuses on what the user sees, what each UI is for, and whether it is wired, partially wired, placeholder, or legacy.

Status labels:

- **Wired**: visible and connected to real behavior.
- **Partially wired**: visible and useful, but some actions are incomplete, stale, or limited.
- **Placeholder**: intentionally visible but not implemented yet.
- **Legacy / compatibility**: still in code for older flows or package compatibility.
- **Hidden until condition**: only appears when a feature state requires it.

## Zeros Mac App: Global Shell

### Title Bar

Location:

- `src/shell/title-bar.tsx`

User purpose:

- Gives the app a native desktop frame feel.
- Sits above the three-column workspace.

Status:

- **Wired** as part of the Electron shell.

Notes:

- Not a product navigation area by itself.

### Activity Bar

Location:

- `src/shell/activity-bar.tsx`

Visible UI:

- Projects icon.
- Chats icon.
- Ports icon.
- Search icon.
- Settings icon at the bottom.

User purpose:

- Looks like Cursor/VS Code style primary navigation.

Status:

- **Partially wired**.

What works:

- Clicking Settings opens/closes the real Settings page.
- Clicking top icons changes the selected activity state visually.
- If Settings is open, clicking a top icon returns to the app body.

What is not fully wired:

- The top icons do not currently swap Column 1 content into separate Projects/Chats/Ports/Search views.
- `app-shell.tsx` comments say this is currently visual state only and future migration will use it to filter the sidebar.

Product interpretation:

> The activity bar visually promises multiple sidebar modes, but today Column 1 still renders the same full navigation tree.

Cleanup recommendation:

- Either wire Projects/Chats/Ports/Search to real sidebar filters or simplify the activity bar until those views exist.

## Zeros Mac App: Column 1 Navigation

Location:

- `src/shell/column1-nav.tsx`

Column 1 is the left sidebar. It is one of the most important user-facing areas.

### Brand Header

Visible UI:

- Zeros logo.
- "Zeros" label when expanded.
- Sidebar collapse/expand button.

Status:

- **Wired**.

What works:

- Collapse state persists in settings.
- Collapsed mode changes labels into icon-only navigation.

### Open Workspace Button And Menu

Visible UI:

- "Open Workspace" button.
- Recent project search.
- Recent project list.
- "Open Folder..."
- "Clone from URL..."

Status:

- **Wired**, with one UX limitation.

What works:

- Recent projects are loaded.
- Search filters recent projects.
- Picking a project opens that path.
- Open Folder uses the native file picker.
- Clone from URL opens a clone modal and then opens the cloned repo.

Limitation:

- Opening a different project respawns the engine and reloads the whole webview.

Product interpretation:

> This is the current project switcher. It works, but not yet "instant."

### Clone Modal

Visible UI:

- Git URL field.
- Destination folder field.
- Clone button.
- Busy/error state.

Status:

- **Wired** through native Git clone flow.

Risk:

- Destination path default is a placeholder-like `/Users/{you}/Projects/...` if the user has not edited it. This should be improved to use a real default folder.

### New Agent Button

Visible UI:

- "New Agent" row.
- `Cmd+N` shortcut hint.

Status:

- **Wired**.

What works:

- Clears active chat.
- Opens the empty/new-agent composer.
- Pre-warms the default agent.
- Column 3 collapses automatically because no active chat is selected.

### Workspace Chat Groups

Visible UI:

- Pinned chat group.
- Workspace/project groups.
- Collapsible sections.
- Per-workspace plus button.
- Chat rows.
- Show more/show less.
- Empty "No agents" state.
- Right-click workspace context menu.

Status:

- **Wired**.

What works:

- Chats are grouped by project folder.
- Pinned chats show separately.
- Chat rows show live status: idle, working, waiting for permission.
- Chat rows can be selected.
- Chats can be deleted.
- Chats can be pinned/unpinned on hover.
- Workspace sections can be collapsed.
- Right-click can remove non-current workspaces from the sidebar.
- A new chat in a hidden workspace auto-reveals the workspace again.

Limitation:

- The "No agents" phrase can be confusing. It means no chats/agents in that workspace, not that no CLI agents are installed.

### LOCALHOST Section

Visible UI:

- Collapsible LOCALHOST header.
- Count badge.
- Rows for discovered ports.
- Empty message when no dev servers are detected.

Status:

- **Wired**.

What works:

- Polls localhost services.
- Dev-server rows are clickable.
- Clicking a dev-server sets the Design workspace preview URL.
- Non-preview services are disabled.

Product interpretation:

> This is how the Mac app finds the user's running web app to inspect.

### Profile Footer Menu

Visible UI:

- Profile button/avatar.
- Update pill/dot.
- Menu with How to, Settings, Logout.

Status:

- **Partially wired**.

What works:

- How to opens the GitHub README/docs URL.
- Settings opens the real Settings page.
- Update pill handles update available/downloading/ready/error states.

What is not wired:

- Logout is currently a visible no-op. Code comments say account/license auth is future Phase 5.

Product recommendation:

- Hide Logout until account auth exists, or label it as disabled/coming soon.

## Zeros Mac App: Column 2 Agent Workspace

Locations:

- `src/shell/column2-workspace.tsx`
- `src/shell/column2-chat-view.tsx`
- `src/shell/empty-composer.tsx`
- `src/zeros/agent/agent-chat.tsx`
- `src/shell/mission-panel.tsx`

### Column 2 Tabs

Visible UI:

- Chat tab.
- Mission tab.
- Show Panel button when Column 3 is collapsed.

Status:

- **Wired**.

What works:

- `Cmd+1` switches to Chat.
- `Cmd+2` switches to Mission.
- Show Panel expands Column 3.

### Empty Composer / New Agent Window

Visible UI:

- Large composer.
- Workspace/folder chip.
- Branch chip.
- Agent pill.
- Model pill.
- Effort pill.
- Permission pill.
- Attachment/image affordance.
- Send button.
- First-run "no installed agents" guidance when applicable.

Status:

- **Wired**.

What works:

- Selects workspace.
- Uses current Git branch info.
- Loads agent registry.
- Pre-warms default agent.
- Creates a chat on send.
- Queues the first message for the newly mounted chat.
- Supports image attachments.

Important behavior:

- This is the "new chat" window. It does not create an empty chat until the user sends.

### Active Chat View

Visible UI:

- Agent header.
- Message list.
- Tool cards.
- Permission modal/prompt.
- Composer.
- Agent/model/effort/permission/branch/context pills.
- Mention picker.
- Slash command picker.
- Summary handoff pill when switching agents.

Status:

- **Wired**, with persistence caveat.

What works:

- Starts/loads agent session.
- Sends prompts through the engine.
- Streams agent messages and tool states.
- Handles permission responses.
- Can switch agents by creating a new chat.
- Can resume previous sessions for supported agents.

Limitation:

- Chat records persist, but a clean long-term transcript model is not yet fully documented as product source of truth.

### New Chat Picker In Header

Visible UI:

- Plus/new chat dropdown.
- Installed/runnable agents.
- Recent threads when supported.

Status:

- **Wired / partially wired** depending on agent.

What works:

- Creates a new chat bound to a selected agent.
- Can list recent sessions for agents that support history.

Limitations:

- Some agents support session history better than others.
- Disabled/unavailable agents can appear but are not runnable.

### Mission Panel

Visible UI:

- Active sessions metric.
- Approximate token metric.
- Last error metric.
- Recent sessions list.

Status:

- **Partially wired**.

What works:

- Displays activity from `ai-stream-event` when those events are emitted.

Potential mismatch:

- The primary modern agent path uses engine WebSocket `AGENT_`* events. Mission Control should be reconciled with the current event stream so it reliably reflects all native agents.

## Zeros Mac App: Column 3 Work Surface

Location:

- `src/shell/column3.tsx`

Visible tabs:

- Design.
- Git.
- Terminal.
- Env.
- Todo.
- Hide Panel button.

Status:

- **Wired**.

Shortcuts:

- `Cmd+6`: Design.
- `Cmd+7`: Git.
- `Cmd+8`: Terminal.
- `Cmd+9`: Env.
- `Cmd+0`: Todo.
- `Option+Cmd+B`: hide/show Column 3.

### Design Tab

Location:

- `src/zeros/engine/zeros-engine.tsx`

Status:

- **Wired**, but it carries old browser-overlay architecture.

Visible UI:

- Internal Design/Theme sidebar.
- Workspace toolbar.
- Variant canvas.
- Source preview node.
- Style/Feedback/Theme panel.
- Command palette.
- Inline edit.
- Visual diff.

More detail is in `11-Design-Workspace-Deep-Dive.md`.

### Git Tab

Location:

- `src/shell/git-panel.tsx`

Status:

- **Wired**, with some implementation comments stale.

Visible UI:

- Repo status.
- Changed files.
- Stage/unstage.
- Commit message.
- Suggest commit message.
- Commit.
- Push/pull.
- Branch controls.
- Diff/visual diff.
- Conflict actions.
- GitHub compare/open PR-style link.

Limitations:

- Residual comment drift is being reduced in the naming pass (PR 1/2); native Git/PTY live under Electron + IPC, not a Rust `libgit2` shell.
- Visual rendered diff is limited, especially outside CSS.

### Terminal Tab

Location:

- `src/shell/terminal-panel.tsx`

Status:

- **Wired in the Mac app**.

Visible UI:

- Terminal tabs.
- Add session.
- Close session.
- xterm terminal surface.

What works:

- Spawns `/bin/zsh -l` through native PTY.
- Uses active chat folder as cwd when available.

Limitations:

- Requires native runtime.
- Sessions do not persist across restarts.
- Shell customization is deferred.

### Env Tab

Location:

- `src/shell/env-panel.tsx`

Status:

- **Wired in the Mac app**.

Visible UI:

- Environment file list.
- Key/value editor.
- Save controls.
- Gitignored awareness.

Purpose:

- Edit `.env` files without leaving Zeros.

### Todo Tab

Location:

- `src/shell/todo-panel.tsx`

Status:

- **Wired**.

Visible UI:

- Markdown todo file content.
- Todo item list.
- Toggle/edit/save controls.

Data:

- Uses `.zeros/todo.md` in the current project.

## Zeros Mac App: Settings

Location:

- `src/zeros/panels/settings-page.tsx`

Settings is a full-body screen, not just a Column 3 tab.

### Settings Navigation

Visible sections:

- General.
- Agents.
- AI Models.
- API Keys.
- Appearance.
- MCP Servers.
- Debug.

Status:

- **Wired navigation**.

### General

Status:

- **Placeholder / informational**.

Visible message:

- Accounts and plan management arrive later.
- Zeros currently runs in free/BYO-key mode.

### Agents

Status:

- **Wired**.

What works:

- Lists agent registry.
- Shows install/auth state through `AgentsPanel`.
- Lets user set default agent for new chats.
- Refresh action reloads registry/catalog.
- Hover pre-warms agents.

### AI Models

Status:

- **Wired, but partly legacy-labeled**.

What works:

- Provider tile selection for Claude and Codex.
- Subscription versus API key auth.
- CLI install/auth detection.
- Opens install docs.
- Opens login in Terminal.
- Stores API keys in keychain.
- Thinking effort selection.
- Agent Teams toggle.

Notes:

- The UI labels mention only Claude/Codex here, while the broader agent registry supports more agents.
- Agent Teams is experimental and should be treated as not fully productized.

### API Keys

Status:

- **Wired**.

What works:

- OpenAI API key.
- Anthropic API key.
- GitHub PAT.
- Save/delete through macOS keychain.

Potential stale hint:

- The Anthropic hint says "Reserved for Phase 4 when Claude is wired into chat," but Claude is now part of the native agent runtime direction. Update copy.

### Appearance

Status:

- **Placeholder**.

Visible message:

- Theme, accent color, and font size controls arrive later.

### MCP Servers

Status:

- **Placeholder / partially outdated copy**.

Visible message:

- Built-in engine exposes its MCP server.
- User-installed servers arrive later.

Note:

- Copy still mentions arriving alongside Claude CLI integration, which is stale if Claude is already integrated.

### Debug

Status:

- **Wired**.

Visible UI:

- Engine root.
- Engine port.
- Project.
- Framework.
- Active chat.
- Chat count.
- Variant count.
- Feedback count.

Purpose:

- Sanity checks and diagnostics.

## Zeros Design Workspace Internal UI

Location:

- `src/zeros/engine/zeros-engine.tsx`
- `src/zeros/panels/app-sidebar.tsx`
- `src/zeros/panels/workspace-toolbar.tsx`

### Internal Design Sidebar

Visible UI:

- Design.
- Themes.
- Close button only when running as floating overlay with `onClose`.

Status:

- **Wired**.

Mac app note:

- In the Mac app Column 3, `onClose` is not passed, so the close button usually does not appear.

### Workspace Toolbar

Visible UI:

- Zeros logo.
- Project switcher/name.
- Feedback / Style / Theme mode toggle.
- `.0c` export.
- `.0c` import.

Status:

- **Wired / partially wired**.

What works:

- Switches Style/Feedback/Theme mode.
- Exports and imports `.0c`.
- Project name handling exists.

Limitations:

- `.0c` UX is still legacy naming.
- Project switcher here is separate from the Mac app workspace switcher, which can confuse users.

## 0colors UI Surfaces

Locations:

- `apps/0colors/packages/frontend/src/routes.ts`
- `apps/0colors/packages/frontend/src/App.tsx`
- `apps/0colors/packages/frontend/src/pages/`*
- `apps/0colors/packages/frontend/src/components/*`

0colors is a separate web app, not yet embedded in the Zeros Mac app.

### 0colors Routes

Visible routes:

- `/`
- `/projects`
- `/community`
- `/community/:slug`
- `/settings`
- `/profile`
- `/sample-project`
- `/sample-project/:slug`
- `/project/:slug`
- `/project/:slug/code`
- `/project/:slug/export`

Status:

- **Wired through one lazy AppShell**.

Note:

- Routing is URL-aware, but rendering control remains inside `AppShell` during migration.

### Projects Dashboard

Location:

- `apps/0colors/packages/frontend/src/pages/ProjectsPage.tsx`

Visible UI:

- Sidebar nav items.
- Project rows.
- Project stats.
- Project action menu: export, duplicate, delete.
- Sign in/sign out affordances.
- Profile section.
- Community section.
- AI settings section.
- Admin QA dashboard for admins.
- Sample/template project handling.
- Star/default template control for template admins.

Status:

- **Wired**, but large and multi-purpose.

Risk:

- This page carries many product modes in one component and should be split if integrated into Zeros.

### 0colors Editor Toolbar

Location:

- `apps/0colors/packages/frontend/src/components/layout/AppToolbar.tsx`

Visible UI:

- Canvas view button.
- Code Preview button.
- Export Tokens button.
- Publish to Community button for eligible cloud projects.
- Page selector/dropdown.
- Theme selector/dropdown.
- Rename/delete page/theme controls.
- Token table toggle and related actions.

Status:

- **Wired**.

Conditional behavior:

- Publish button only appears for cloud projects when authenticated and not sample mode.
- Rename/delete is blocked in sample mode.

### 0colors Canvas Area

Location:

- `apps/0colors/packages/frontend/src/components/layout/AppCanvasArea.tsx`

Visible UI:

- Sign In button when unauthenticated.
- Sample/community read-only bar.
- Duplicate/remix controls.
- Go back prompt.
- Restore tokens prompt.
- Multi-select action bars.
- Bottom toolbar.
- AI chat toggle.
- Node tool buttons.
- Dev Mode.
- Shortcuts.
- Command palette.
- Undo/redo.
- Main view content: canvas, code preview, export.

Status:

- **Wired**, but should be decomposed before Mac app integration.

### 0colors Canvas

Location:

- `apps/0colors/packages/frontend/src/components/canvas/ColorCanvas.tsx`

Visible UI:

- Node graph canvas.
- Color nodes.
- Palette nodes.
- Spacing nodes.
- Token nodes.
- Wires/relationships.
- Selection/multiselect.
- Advanced popup.
- Node card controls.

Status:

- **Wired**.

Complexity note:

- This is a very large, central component. Integrating 0colors should extract its model/logic before moving the UI.

### 0colors Tokens Panel

Location:

- `apps/0colors/packages/frontend/src/components/tokens/TokensPanel.tsx`
- `ConnectedTokensPanel.tsx`

Visible UI:

- Token groups.
- Token search/filter.
- Cloud sync indicator.
- Manual sync.
- Navigate-to-node.
- Token operations.

Status:

- **Wired**.

Note:

- `ConnectedTokensPanel` is compatibility wrapper; the panel now reads most data from Zustand directly.

### 0colors Dev Mode Panel

Location:

- `apps/0colors/packages/frontend/src/pages/DevModePanel.tsx`
- `ConnectedDevModePanel.tsx`

Visible UI:

- Input tab.
- Output tab.
- Webhook URL/secret.
- Per-node webhook URLs.
- GitHub output settings.
- Webhook output settings.
- Pull API settings.
- Schedule settings.
- Run now/test controls.

Status:

- **Wired in 0colors web/cloud architecture**, but not yet converted to local-first Mac app behavior.

Mac app integration recommendation:

- Keep the concept, but replace hosted-first assumptions with local file output and optional cloud publishing.

### 0colors Auth Page

Location:

- `apps/0colors/packages/frontend/src/pages/AuthPage.tsx`

Status:

- **Legacy / likely reduced role** because the app now uses `@0zerosdesign/auth-client` provider at root.

Recommendation:

- Confirm whether this page is still reachable. If not, archive/remove after migration.

## 0accounts UI Surfaces

Locations:

- `website/0accounts/packages/frontend/src/routes.tsx`
- `website/0accounts/packages/frontend/src/App.tsx`

Visible routes:

- `/`: dashboard.
- `/login`.
- `/signup`.
- `/forgot-password`.
- `/reset-password`.
- `/verify-email`.
- `/profile`.
- `/settings`.

Status:

- **Wired** as the account hub.

Visible app shell:

- Header appears only when authenticated and not on public auth pages.
- Main layout wraps protected pages.
- Auth layout wraps auth pages.
- Loading spinner appears during auth check on protected routes.
- Toasts appear bottom-right.

Purpose:

- Central account/auth hub for Zeros products.

Mac app relationship:

- Should remain optional for local Mac app use.
- Should be used for cloud, subscription, team, and community features.

## 0research UI Surfaces

Locations:

- `website/0research/src/app/routes.ts`
- `website/0research/src/app/pages/HomePage.tsx`
- `website/0research/src/app/internal/AiToolPage.tsx`

### Public Home Feed

Route:

- `/`

Visible UI:

- Feed experience.
- Metadata sidebar/list.
- Rich media/content feed.
- Active item selection.
- Infinite metadata loading.
- Smart media prefetch.

Status:

- **Wired**.

Backend/data:

- Uses feed metadata and media APIs.
- Intended to read from Supabase/Directus-backed content.

### Internal AI Tool

Route:

- `/internal`

Visible UI:

- Workspace layout.
- Internal nav.
- Agent selector.
- Conversation list.
- Chat panel.
- Output panel.
- Resizable columns.
- Output items/fields.
- Directus save/publish style workflow.

Status:

- **Wired for internal authenticated users**.

Purpose:

- Internal tool for generating and managing research/content outputs.

Note:

- Some docs still call this `/0ai`; current route is `/internal`.

## Important UI Cleanup Summary

Highest-priority cleanup:

1. Wire or simplify the Mac app Activity Bar top icons.
2. Hide or disable Logout until account auth exists.
3. Update stale Settings copy for Claude/MCP phases.
4. Decide whether the Design workspace project switcher should remain when the Mac app already has Open Workspace.
5. Rename `.0c` UI once `.zeros` is real.
6. Split 0colors UI into product modules before integrating.
7. Remove or archive legacy 0colors `AuthPage` if no longer reachable.
8. Reconcile Mission Control with current native agent event stream.

Best user-facing structure for the Mac app:

- **Column 1**: workspaces, chats, local app targets, profile/account.
- **Column 2**: agent conversation and agent activity.
- **Column 3**: Design, Colors, Git, Terminal, Env, Todo.
- **Settings**: app, agents, account, keys, MCP, appearance, debug.

