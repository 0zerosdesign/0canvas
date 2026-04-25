# Current User Flows

This explains what a user can do in the current Zeros Mac app and how the UI is intended to feel.

## Main App Layout

The app is a three-column desktop workspace:

1. **Column 1: Navigation**
  Workspaces, chats, recent projects, localhost dev servers, settings/profile controls.
2. **Column 2: Agent Workspace**
  The current chat window and mission/activity view.
3. **Column 3: Work Surface**
  Design workspace, Git, Terminal, Env, and Todo.

Column 3 can collapse. When there is no active chat, the app forces Column 3 collapsed so the new-agent composer becomes the main focus, similar to Cursor's new chat flow.

## Flow: First Launch

What happens:

1. Electron starts.
2. The main process sets the app identity to `Zeros Dev` in development.
3. The Electron main process hydrates the macOS shell PATH so installed CLIs like `claude`, `codex`, or `cursor-agent` are discoverable.
4. Electron spawns the local Zeros engine sidecar.
5. The renderer loads the React app.
6. The renderer connects to the engine over WebSocket.
7. The app hydrates saved chats from local settings.
8. The app pre-warms agent subprocesses once the engine is ready.

What the user sees:

- A Cursor-like desktop app.
- Existing chats in the left sidebar if they have used the app before.
- A new-agent composer if no chat is selected.
- The design workspace if an active chat exists and Column 3 is visible.

## Flow: Open A Project Folder

The user can open a project from:

- native File menu
- Column 1 workspace controls
- Empty composer workspace pill
- recent projects list

What happens technically:

1. Renderer calls the native `open_project_folder` or `open_project_folder_path` command.
2. Electron tells the sidecar to respawn the engine with the new project root.
3. The engine writes the actual port into `<project>/.zeros/.port`.
4. Electron emits `project-changed`.
5. The renderer remembers the project and reloads the webview.
6. The app reconnects to the engine for the new root.

Current limitation:

- The current implementation reloads the entire renderer on project change. This is simple and reliable, but not the fastest possible experience.
- A future improvement should swap project state in-place without full reload.

## Flow: Discover Localhost App Preview

Column 1 polls local ports every few seconds.

What the user sees:

- Local dev servers appear in the `LOCALHOST` section.
- Clicking a dev server sets it as the preview target for the design workspace.

Why it matters:

- The design workspace needs a running app to inspect.
- The app avoids selecting Zeros' own Vite server as a preview target.

## Flow: New Agent Chat

This is one of the most important product flows.

What the user sees:

1. No active chat means the empty composer is centered.
2. The composer shows workspace/folder, branch, agent, model, effort, and permission controls.
3. The user types a message.
4. On send, Zeros creates a chat record and starts an agent session.

What happens technically:

1. `EmptyComposer` resolves the current project root.
2. It picks the default agent from settings.
3. It pre-warms that agent's subprocess.
4. On submit, it creates a `ChatThread`.
5. It dispatches `ADD_CHAT`.
6. It dispatches `SET_ACTIVE_CHAT`.
7. It queues the first message through `ENQUEUE_CHAT_SUBMISSION`.
8. `Column2ChatView` mounts `AgentChat`.
9. The session provider creates or resumes the native agent session.
10. Once ready, the queued prompt is sent.

User-facing value:

- The user can start like a normal AI chat.
- The chat is scoped to a project folder.
- The chosen agent/model/effort/permissions are saved on the chat.

Current limitation:

- Chat messages are mostly runtime session state. The chat list is persisted, but long-term message persistence is still not fully designed as a first-class project data model.

## Flow: Existing Chat

When the user clicks a chat in Column 1:

1. The active chat id changes.
2. Column 2 remounts the chat view for that id.
3. The session provider maps that chat to an agent session.
4. The agent runs with the chat's saved folder, model, effort, and permission mode.

The chat sidebar groups chats by project folder and supports pinning.

## Flow: Switch Agent In A Chat

Inside a chat, the user can switch to another agent.

What happens:

- Zeros creates a new chat bound to the new agent.
- It records the source chat id.
- The new chat can show a summary handoff pill so the user can transfer context.

Why this is good:

- Different agents stay cleanly separated.
- The user can move from Claude to Codex or Cursor without mutating the old conversation.

## Flow: Resume Recent Agent Thread

Some agents support listing/reloading past sessions.

What happens:

1. Zeros asks the engine for sessions for that agent.
2. The user selects a previous session.
3. The chat stores `resumeSessionId`.
4. On mount, `ChatBody` calls `loadIntoChat` instead of creating a new session.

Current status:

- This is wired for agents that support history. Claude and Codex have explicit history/replay work documented.

## Flow: Agent Permission Prompt

When an agent wants to run a risky action:

1. The engine receives a permission request from the native adapter or hook server.
2. The engine broadcasts an `AGENT_PERMISSION_REQUEST` message.
3. The renderer stores it on the correct chat session.
4. The UI asks the user to approve or deny.
5. The response travels back through WebSocket to the engine.
6. The engine unblocks the agent.

Permission modes:

- `full`: auto-approve everything.
- `auto-edit`: approve reads and file edits.
- `ask`: ask before writes/commands.
- `plan-only`: agent plans but does not execute.

## Flow: Inspect And Edit UI

The design workspace is in Column 3 under the `Design` tab.

What the user sees:

- A visual canvas/source preview.
- Element selection.
- Style panel.
- Feedback mode.
- Theme mode.
- Inline edit and command palette.

What happens technically:

1. The previewed app is loaded or selected.
2. Inspector code walks the DOM and builds element metadata.
3. The user selects an element.
4. Selection is stored in the workspace store.
5. The renderer sends selected element context to the engine.
6. Style edits call `STYLE_CHANGE`.
7. The engine resolves the source CSS rule and writes the file.
8. The user's dev server hot reloads.

Current limitations:

- The source preview and DOM inspection flow still comes from the browser-overlay architecture.
- It works best when a dev server is running and selectors can be resolved.
- The overall UX needs consolidation so it feels native, not embedded legacy overlay UI.

## Flow: Theme / Token Editing

The user can load CSS token files and inspect/edit tokens.

What happens:

- CSS files can be picked/read/written through native IPC.
- Theme files are parsed into design tokens.
- Tokens can be suggested inside the style panel.
- Theme mode tracks changes separately.

Current limitation:

- This is separate from the richer 0colors token graph. It is not yet one unified token system.

## Flow: Git Panel

Column 3 has a Git tab.

What the user can do:

- See status.
- Stage/unstage files.
- View diffs.
- Commit.
- Push/pull.
- Switch/create/delete branches.
- See conflicts and choose ours/theirs.
- Open GitHub compare URL.

Current limitation:

- Some comments still mention Rust/libgit2/Tauri history. The current native layer is Electron IPC with Git command wrappers.
- Visual diff for non-CSS and full rendered comparison is still limited.

## Flow: Terminal

Column 3 has a Terminal tab.

What the user can do:

- Open multiple terminal sessions.
- Sessions run `/bin/zsh -l`.
- CWD is the active chat folder if set, otherwise engine root.

Current limitation:

- Terminal sessions do not persist across app restarts.
- Shell customization is deferred.

## Flow: Env Editor

Column 3 has an Env tab.

What the user can do:

- List `.env` files.
- Edit key/value pairs.
- Save changes through native IPC.

Why it matters:

- Product designers/builders can configure apps without leaving Zeros.

## Flow: Todo Panel

Column 3 has a Todo tab.

What the user can do:

- Load a markdown todo file.
- Toggle/edit todo items.
- Save back to disk.

## Flow: Settings

Settings takes over the main body and hides the three-column shell.

What it contains:

- AI settings.
- Agent settings.
- Native app settings.
- Other product configuration.

## Flow: 0colors Today

0colors is not yet a native Zeros module. It runs as its own Vite + backend app under `apps/0colors`.

What users can do in 0colors:

- Create projects.
- Build node-based color systems.
- Create tokens and themes.
- Use palette/token nodes.
- Use advanced channel logic.
- Export CSS/DTCG/Tailwind/Figma formats.
- Use cloud sync.
- Publish community projects.
- Configure Dev Mode webhooks and token output.

What is not yet done:

- It is not embedded in the Mac app.
- Its data model is not merged into `.0c` or `.zeros`.
- Its backend/server workflows are not converted into local-first Mac workflows.

## Flow: 0accounts Today

0accounts handles shared auth for web products.

What users can do:

- Login/signup/reset password.
- View dashboard/profile/settings.
- Products can use the shared auth client.

Current relationship to Zeros Mac app:

- 0colors and 0research consume the auth client.
- The Mac app agent runtime does not depend on 0accounts for local coding-agent auth.
- A future Zeros account layer can use 0accounts for product licensing/cloud sync.

## Flow: 0research Today

0research is a learning/content site plus internal tooling.

What users can do:

- Visit the public home page.
- Authenticated users can enter `/internal`.
- Internal UI includes AI/content tooling.

Current relationship to Zeros Mac app:

- Separate website.
- Shares auth direction through 0accounts.
- Should stay website/content-first unless its internal tooling becomes part of Zeros product operations.

## What Works Best Right Now

- Electron app boot and sidecar architecture.
- Project-scoped agent chats.
- Native agent adapter direction.
- Design workspace reuse inside Column 3.
- Git/terminal/env/todo panels.
- 0colors as an independent product.
- 0accounts auth-client as a shared package.

## What Feels In Progress

- Smooth project switching without reload.
- Fully native-feeling design workspace.
- Long-term chat transcript persistence.
- `.0c` to `.zeros` format strategy.
- 0colors local-first integration.
- Removing old Tauri/ACP/VS Code extension terminology.
- One unified product information architecture.