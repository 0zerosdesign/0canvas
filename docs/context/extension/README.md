# VS Code Extension

> `extensions/vscode/src/extension.ts` -- entry point
> `extensions/vscode/package.json` -- manifest

The 0canvas VS Code extension is the editor-side counterpart to the browser overlay. It connects to the Vite plugin's WebSocket bridge, receives style change requests from the browser, resolves CSS source locations, writes changes to disk, manages project state sync, dispatches AI requests to IDE agents, and exposes MCP tools for external AI agents.

---

## Extension Activation Flow

The extension activates on `onStartupFinished` (declared in `package.json`).

### `activate(context)` sequence:

1. **Detect agent** -- `detectAgent()` checks `vscode.env.appName` for Cursor, then looks for Copilot Chat and Claude Code extensions
2. **Get workspace root** -- from `vscode.workspace.workspaceFolders[0]`
3. **Status bar** -- creates a right-aligned status bar item with command `0canvas.sendToAgent`
4. **Sidebar** -- registers `SidebarProvider` as a webview view provider on the Activity Bar
5. **Dev Server Manager** -- `new DevServerManager(workspaceRoot)`, checks if server is already running
6. **Custom Editor** -- registers `OCEditorProvider` for `*.0c` files
7. **WebSocket bridge** (if workspace exists):
   - Creates `CSSSourceResolver`, `CSSFileWriter`, `TailwindWriter`
   - Creates `BridgeWebSocket` client
   - Registers all 5 message handlers (inline in extension.ts, duplicated in handlers/ modules)
   - Starts the bridge (`wsBridge.start()`)
8. **MCP server** -- creates and starts MCP server, injects bridge reference
9. **HTTP bridge client** -- legacy feedback polling on port 24192
10. **Commands** -- registers 5 commands

### `deactivate()`:
Stops MCP server, disposes WebSocket bridge and HTTP client.

---

## The 5 Handler Modules

The extension processes messages in two places: inline in `extension.ts` (the active code path) and as extracted modules in `handlers/`. Both implementations are equivalent.

### 1. Style Handler

> `extensions/vscode/src/handlers/style-handler.ts`

Handles `STYLE_CHANGE` messages:
1. Calls `CSSSourceResolver.resolve(selector, property)` to find the source file and line
2. If not found: sends `STYLE_CHANGE_ACK` with `success: false` and error message
3. If found: calls `CSSFileWriter.write(file, line, property, value)` to update the declaration in place
4. Sends `STYLE_CHANGE_ACK` with `success`, `file`, `line`, or `error`
5. Vite HMR picks up the file change and hot-reloads the browser

### 2. Tailwind Handler

> `extensions/vscode/src/handlers/tailwind-handler.ts`

Handles `TAILWIND_CLASS_CHANGE` messages:
1. Calls `TailwindWriter.writeClassChange(selector, action, className)`
2. Logs success/failure
3. No ACK message is sent back (fire-and-forget)

### 3. Source Map Handler

> `extensions/vscode/src/handlers/source-map-handler.ts`

Handles `REQUEST_SOURCE_MAP` messages:
1. Calls `CSSSourceResolver.resolve(selector, property)`
2. If found: sends `SOURCE_MAP_RESULT` with `file`, `line`, `column`
3. If not found: sends `ERROR` with code `SOURCE_NOT_FOUND`

### 4. Sync Handler

> `extensions/vscode/src/handlers/sync-handler.ts`

Handles two message types:

**`PROJECT_STATE_SYNC`** (browser -> extension):
- Extracts `filePath` (or defaults to `"project.0c"`)
- Writes the JSON content to disk at `{workspaceRoot}/{filePath}`
- Tracks project ID to file path in a local Map

**`PEER_CONNECTED`** (when a browser connects):
- Finds all `*.0c` files in the workspace (up to 20, excluding `node_modules`)
- Reads and validates each as JSON
- Sends `PROJECT_STATE_LOADED` for each valid file back to the browser

### 5. AI Handler

> `extensions/vscode/src/handlers/ai-handler.ts`

Handles `AI_CHAT_REQUEST` messages:
1. Calls `buildAIContext()` to generate rich markdown context
2. Writes context to `.0canvas/ai-request.md`
3. Builds a direct prompt with inline summary (selector, top 8 styles, instructions)
4. Copies full context to clipboard as backup
5. Opens the IDE chat panel via `workbench.action.chat.open` with the direct prompt
6. Attempts auto-submit via `workbench.action.chat.acceptInput` (with 1-second delay, tries 3 command variants)
7. Falls back to notification if chat open fails
8. Sends `AI_CHAT_RESPONSE` back to browser with success/failure

---

## CSS Source Resolver

> `extensions/vscode/src/css-source-resolver.ts`

### How It Finds Selectors in CSS Files

`resolve(selector, property) -> SourceLocation | null`

1. **Find all CSS files** via `vscode.workspace.findFiles("**/*.css", ...)` excluding `node_modules`, `dist`, `.next`, `build`
2. **Sort by priority** -- files in `src/` are searched first
3. **Generate selector variants** from the input selector:
   - Full selector (e.g., `button.primary`)
   - Individual class names (e.g., `.primary`)
   - Tag name (e.g., `button`)
   - ID (e.g., `#main`)
4. **For each CSS file, for each variant:**
   - Scan lines looking for the selector (with `lineMatchesSelector` regex)
   - Skip comment lines (`/*`, `//`, `*`)
   - Match as standalone token: `(^|[\s,>+~{])selector([\s,>+~{.:[]\|$)`
   - Find the opening brace (may be on next line)
   - Search inside the rule block for the property declaration (`findPropertyInBlock`)
   - Track brace depth to avoid leaking into nested rules
   - Only match properties at depth === 1

### Return Value

```typescript
interface SourceLocation {
  file: string;      // relative path from workspace root
  absPath: string;   // absolute path
  line: number;      // 1-based line number of the property declaration
  column: number;    // 0-based column
  selector: string;  // the matched selector text
}
```

---

## CSS File Writer

> `extensions/vscode/src/css-file-writer.ts`

### How It Writes Values Preserving Formatting

**`write(filePath, line, property, newValue) -> WriteResult`**

1. Reads the file content, splits into lines
2. On the target line, matches the regex: `^\s*{property}\s*:\s*{oldValue}{trailing};?.*$`
3. The regex captures three groups:
   - Leading whitespace + property + colon + spacing
   - The old value (everything before `;` or `!important`)
   - Trailing semicolon, `!important`, etc.
4. Replaces ONLY the value portion: `match[1] + newValue + match[3]`
5. **Atomic write**: writes to a `.0canvas-tmp` file first, then renames it over the original
6. If rename fails, cleans up the temp file

**`addProperty(filePath, selectorLine, property, value) -> WriteResult`**

1. Starting from the selector line, tracks brace depth to find the closing `}`
2. Detects indentation from existing properties in the block
3. Inserts a new `{indent}{property}: {value};` line before the closing brace
4. Writes the file directly (not atomic)

Both methods auto-convert camelCase properties to kebab-case.

---

## Tailwind Writer

> `extensions/vscode/src/tailwind-writer.ts`

### How It Modifies className in JSX

`writeClassChange(selector, action, className) -> { success, file?, error? }`

1. **Extract classes from selector** -- regex `\.[\w-]+` strips the dots (e.g., `div.flex.gap-4` -> `["flex", "gap-4"]`)
2. **Find JSX/TSX files** -- `vscode.workspace.findFiles("**/*.{tsx,jsx}", ...)`
3. **For each file, scan for className attributes** -- matches three patterns:
   - `className="..."` (string literal)
   - `` className={`...`} `` (template literal)
   - `className={clsx("...")}` (function call with string)
4. **Match threshold** -- the className must contain at least `min(2, selectorClasses.length)` of the selector's classes
5. **Modify:**
   - `add`: append the new class (skip if already present)
   - `remove`: filter out the class from the space-separated list
6. **Write** -- replaces the className value in-place, writes the entire file

Returns the first match found. Does not handle multiple matches.

---

## Sidebar Dashboard

> `extensions/vscode/src/sidebar-provider.ts`

A webview view provider registered on the Activity Bar at `0canvas.dashboardView`.

### Displays:
- **Bridge status** -- colored dot (green/yellow/gray) + label (Connected/Connecting/Disconnected)
- **Dev server status** -- URL if detected, "Not detected" otherwise
- **Agent name** -- Cursor, Copilot, Claude Code, or Agent

### Actions (buttons):
- **Open in Browser** -- sends `openBrowser` message, executes `vscode.env.openExternal` with dev server URL
- **Send Feedback to Agent** -- executes `0canvas.sendToAgent` command (shows pending count)
- **Copy Feedback** -- executes `0canvas.copyFeedback` command

### Update Methods:
- `updateBridgeStatus(status)` -- re-renders with new status
- `updateDevServerUrl(url)` -- re-renders with server URL
- `updatePendingFeedback(count)` -- re-renders with feedback count
- `updateAgent(name)` -- re-renders with agent name

The HTML uses VS Code CSS variables for theming (`--vscode-foreground`, `--vscode-button-background`, etc.).

---

## Custom Editor for .0c Files

> `extensions/vscode/src/custom-editor-provider.ts`

Registered as `0canvas.ocEditor` with `priority: "default"` for `*.0c` files. Instead of showing raw JSON, displays a project dashboard.

### Dashboard Shows:
- **Project info card**: name, framework, last updated, pages count, variants count, checkpoints count, schema version
- **Status card**: dev server (running/stopped + URL), bridge (connected/connecting/disconnected)
- **Action buttons**: "Open in Browser" or "Start Dev Server" (contextual), "Refresh Status"

### Behavior:
- Parses the `.0c` file JSON on open and on document change
- Listens to dev server status changes
- Manages a set of `activeWebviews` for multi-panel updates
- `updateBridgeStatus()` propagates to all open editors

### Parsed Project Info:
```typescript
interface ProjectInfo {
  name: string;
  framework: string;
  schemaVersion: number;
  revision: number;
  updatedAt: number | null;
  variantCount: number;
  pageCount: number;
  checkpointCount: number;
}
```

---

## Dev Server Manager

> `extensions/vscode/src/dev-server-manager.ts`

Manages the Vite dev server lifecycle from within VS Code.

### `checkRunning() -> { running, url }`
Reads `.0canvas/.port` file. If a valid port is found, returns `{ running: true, url: "http://localhost:{port}" }`.

### `detectDevCommand() -> { command, args } | null`
1. Reads `package.json` scripts
2. Checks candidates in order: `test:ui`, `dev`, `start`, `serve`
3. Detects package manager: pnpm (if `pnpm-lock.yaml`), yarn (if `yarn.lock`), npm (default)
4. Returns `{ command: "pnpm", args: "run dev" }` etc.

### `start() -> url | null`
1. Checks if already running
2. Detects dev command
3. Creates a VS Code terminal named "0canvas Dev Server"
4. Runs the command in the terminal
5. Waits up to **15 seconds** for `.0canvas/.port` to appear (polls every 500ms)
6. Returns the URL on success, shows warning on timeout

### `openBrowser()`
Opens `vscode.env.openExternal` with the dev server URL. If not running, attempts to start first.

### Status Listeners
`onStatusChange(cb)` -- notifies when running state or URL changes.

---

## MCP Server

> `extensions/vscode/src/mcp-server.ts`

Exposes design state to external AI agents via the Model Context Protocol. Uses `@modelcontextprotocol/sdk` with **stdio transport**.

### 5 MCP Tools:

#### 1. `0canvas_read_design_state`
- **Parameters:** none
- **Returns:** JSON of all `.0c` project files in the workspace
- Finds all `*.0c` files (excluding `node_modules`), parses and returns as `{ "relative/path.0c": parsedContent }`

#### 2. `0canvas_get_element_styles`
- **Parameters:** `selector` (string, e.g., `.hero-title`)
- **Returns:** source locations for 11 common CSS properties + matched CSS rules
- Resolves each property via `CSSSourceResolver`
- Also runs `findCSSRulesForSelector()` which scans CSS files for rules containing the selector's last part, collecting full rule blocks (up to 10)

#### 3. `0canvas_list_tokens`
- **Parameters:** none
- **Returns:** all CSS custom properties (`--variable-name`) from workspace CSS files
- Scans all CSS files with regex `^\s*(--[\w-]+)\s*:\s*(.+?)\s*;`
- Returns `{ tokenCount, tokens: { "--var-name": { value, file, line } } }`

#### 4. `0canvas_get_feedback`
- **Parameters:** none
- **Returns:** pending feedback items from `.0c` project files
- Filters for `status === "pending"` in `feedbackItems` arrays
- Returns `{ pendingCount, items }`

#### 5. `0canvas_apply_change`
- **Parameters:** `selector`, `property` (kebab-case), `value`
- **Action:** resolves source location, writes new value via `CSSFileWriter`, notifies browser via WebSocket bridge with `STYLE_CHANGE_ACK`
- **Returns:** `{ success, file, line, message }` or error

### Registration

The 5 tools are also declared in `package.json` under `contributes.languageModelTools` for VS Code's Language Model API integration (with `canBeReferencedInPrompt: true`).

---

## Agent Dispatch

> `extensions/vscode/src/agent-dispatch.ts`

Dispatches design feedback to the appropriate AI agent in the IDE.

### `detectAgent() -> AgentType`

Detection order:
1. **Cursor** -- `vscode.env.appName.toLowerCase().includes("cursor")`
2. **Copilot** -- `vscode.extensions.getExtension("github.copilot-chat")` exists
3. **Claude Code** -- `vscode.extensions.getExtension("anthropic.claude-code")` exists
4. **Unknown** -- fallback

`AgentType = "cursor" | "copilot" | "claude-code" | "codex" | "unknown"`

### `sendToAgent(markdown, agent) -> boolean`

1. Writes markdown to `.0canvas/feedback.md` in the workspace
2. Copies markdown to clipboard as backup
3. Dispatches to agent-specific trigger

### Agent-Specific Triggers

**Cursor (`triggerCursor`):**
1. Opens chat via `workbench.action.chat.open` with a prompt referencing `.0canvas/feedback.md`
2. Attempts auto-submit with increasing delays (800ms, 1200ms, 1600ms, 2000ms) trying multiple submit commands: `workbench.action.chat.acceptInput`, `chat.acceptInput`, `composer.acceptInput`, `aichat.submit`
3. Falls back to `aichat.newchataction` command
4. Falls back to clipboard + manual paste instruction

**Copilot (`triggerCopilot`):**
1. Opens chat with prompt
2. Auto-submits after 600ms via `workbench.action.chat.acceptInput`
3. Falls back to notification

**Claude Code (`triggerClaudeCode`):**
1. Creates a VS Code terminal named "0canvas -> Claude"
2. Sends command: `claude "Read .0canvas/feedback.md and fix all the visual feedback issues..."`
3. Falls back to clipboard notification

**Fallback (`triggerFallback`):**
- Shows notification that feedback is saved and copied

---

## AI Context Builder

> `extensions/vscode/src/ai-context.ts`

`buildAIContext(request, workspaceRoot) -> string`

Generates a structured markdown document for AI agents with:

1. **Header:** "0canvas Design Request"
2. **Designer's request:** the query text
3. **Selected element:** CSS selector (if present)
4. **Current styles:** up to 15 important CSS properties in a code block (display, position, width, height, margin, padding, color, backgroundColor, fontSize, fontWeight, flexDirection, alignItems, justifyContent, gap, borderRadius, boxShadow)
5. **Current route:** if provided
6. **Pending feedback:** contents of `.0canvas/feedback.md` (if exists)
7. **Instructions:**
   - Make changes to source files
   - Browser hot-reloads via Vite HMR
   - Prefer CSS files or Tailwind classes over inline styles
   - Prefer changing token values if element uses CSS variables
   - Briefly describe changes after making them

---

## Registered Commands

| Command | Title | Action |
|---------|-------|--------|
| `0canvas.sendToAgent` | Send Feedback to Agent | Fetch pending feedback, dispatch to detected agent |
| `0canvas.copyFeedback` | Copy Feedback to Clipboard | Format and copy pending feedback as markdown |
| `0canvas.showFeedback` | Show Pending Feedback | Open formatted feedback in a new editor tab |
| `0canvas.openBrowser` | Open in Browser | Read port from `.0canvas/.port`, open in external browser |
| `0canvas.startDevServer` | Start Dev Server | Run `devServer.start()` to launch Vite in a terminal |

---

## Status Bar

Right-aligned status bar item with three states:
- **Offline:** `$(circle-slash) 0canvas` -- bridge offline, no background
- **Pending:** `$(comment-discussion) 0canvas: {count}` -- warning background, click to send
- **Connected:** `$(check) 0canvas` -- connected to agent, no background

---

## File Dependencies

| File | Role |
|------|------|
| `extension.ts` | Entry point: activation, handler registration, commands |
| `websocket-client.ts` | `BridgeWebSocket` -- connects to Vite plugin, auto-discovers via .port file |
| `css-source-resolver.ts` | `CSSSourceResolver` -- finds selectors in CSS files on disk |
| `css-file-writer.ts` | `CSSFileWriter` -- writes CSS values preserving formatting |
| `tailwind-writer.ts` | `TailwindWriter` -- modifies className in JSX/TSX files |
| `sidebar-provider.ts` | `SidebarProvider` -- Activity Bar dashboard webview |
| `custom-editor-provider.ts` | `OCEditorProvider` -- .0c file project dashboard |
| `dev-server-manager.ts` | `DevServerManager` -- detect, start, manage Vite dev server |
| `mcp-server.ts` | `ZeroCanvasMcpServer` -- 5 MCP tools for external AI agents |
| `agent-dispatch.ts` | `detectAgent()`, `sendToAgent()` -- Cursor, Copilot, Claude Code support |
| `ai-context.ts` | `buildAIContext()` -- rich markdown context for AI prompts |
| `messages.ts` | Bridge message types (mirror of `src/0canvas/bridge/messages.ts`) |
| `handlers/style-handler.ts` | Extracted STYLE_CHANGE handler |
| `handlers/tailwind-handler.ts` | Extracted TAILWIND_CLASS_CHANGE handler |
| `handlers/source-map-handler.ts` | Extracted REQUEST_SOURCE_MAP handler |
| `handlers/sync-handler.ts` | Extracted PROJECT_STATE_SYNC + PEER_CONNECTED handlers |
| `handlers/ai-handler.ts` | Extracted AI_CHAT_REQUEST handler |
| `package.json` | Extension manifest: activation, commands, custom editors, MCP tools |
