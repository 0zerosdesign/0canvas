# Settings

## Overview

The Settings page provides configuration for AI providers and IDE/agent connections. It is accessed via the app sidebar navigation (activePage = "settings") and replaces the main canvas view with a two-column settings layout.

Key files:
- `src/0canvas/panels/settings-page.tsx` -- settings page layout, AI settings panel
- `src/0canvas/panels/agent-panel.tsx` -- IDE & Agents panel
- `src/0canvas/store/store.tsx` -- AiSettings type, SET_AI_SETTINGS action
- `src/0canvas/lib/openai.ts` -- model list, settings persistence helpers

## Settings Layout

The settings page uses a two-column layout:

- **Left column:** navigation sidebar with section list
- **Right column:** scrollable content area showing the active section

Two sections are available:

| Section       | ID             | Icon     |
|---------------|----------------|----------|
| AI Settings   | `ai-settings`  | Sparkles |
| IDE & Agents  | `ide-agents`   | Zap      |

The default active section is "AI Settings".

## AI Settings

### Provider Selector

Three AI provider options are presented as selectable cards:

| Provider    | Value      | Description                                       |
|-------------|------------|---------------------------------------------------|
| ChatGPT     | `chatgpt`  | Use your ChatGPT subscription via local proxy      |
| OpenAI API  | `openai`   | Direct API with your own key (BYOK)                |
| IDE Agent   | `ide`      | Send to Cursor, Claude Code, or Copilot            |

Clicking a card sets `provider` in the settings state. The active card receives the `is-active` class.

### ChatGPT Proxy Configuration

When provider is `chatgpt`, a configuration section appears:

- **Instructions:** "Run `npx openai-oauth` to start the local proxy, then enter the URL below."
- **Proxy URL input:** defaults to `http://127.0.0.1:10531`

The `npx openai-oauth` command starts a local OAuth proxy on port 10531 that authenticates with the user's ChatGPT session.

### OpenAI API Configuration

When provider is `openai`, a configuration section appears:

- **API Key input:** password field, placeholder `sk-...`

### Model Selection

When provider is `chatgpt` or `openai`, model and temperature controls appear:

**Model dropdown** with available models:

| Model Family | Models                                              |
|-------------|-----------------------------------------------------|
| GPT-5.4     | GPT-5.4, GPT-5.4 Mini                              |
| GPT-5.3     | GPT-5.3 Codex                                       |
| GPT-5.2     | GPT-5.2 Codex, GPT-5.2                             |
| GPT-5.1     | GPT-5.1 Codex Max, GPT-5.1 Codex, GPT-5.1, GPT-5.1 Codex Mini |
| GPT-5       | GPT-5 Codex, GPT-5, GPT-5 Codex Mini               |
| GPT-4.1     | GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano               |
| GPT-4o      | GPT-4o, GPT-4o Mini                                 |

Default model: `gpt-4o`

**Temperature slider:**
- Range: 0 to 1.5
- Step: 0.1
- Default: 0.7
- Current value displayed next to the label

### IDE Agent Mode

When provider is `ide`, an info message is shown:

> "AI requests will be sent to the connected IDE agent (Cursor, Claude Code, Copilot) via the WebSocket bridge."

### Auto-Send Feedback Toggle

A toggle switch in the "Feedback Pipeline" section:

- **Label:** "Auto-send feedback to agent"
- **Description:** "Automatically dispatch new feedback items to the AI agent for processing."
- **Default:** off

When enabled, new feedback items are automatically sent to the connected agent via the bridge (see Feedback docs for the auto-send pipeline).

### Save Button

Clicking "Save Settings" does two things:
1. Persists settings to `localStorage` via `saveAiSettings()`
2. Dispatches `SET_AI_SETTINGS` to update the global store state

A "Saved!" confirmation appears for 2 seconds.

## AiSettings Type

```typescript
type AiProvider = "chatgpt" | "openai" | "ide";

type AiSettings = {
  provider: AiProvider;
  proxyUrl: string;         // default: "http://127.0.0.1:10531"
  apiKey: string;           // default: ""
  model: string;            // default: "gpt-4o"
  temperature: number;      // default: 0.7
  autoSendFeedback: boolean; // default: false
};
```

## Settings Persistence

AI settings are persisted via two mechanisms:

1. **localStorage:** `loadAiSettings()` and `saveAiSettings()` in `src/0canvas/lib/openai.ts` read/write to localStorage for cross-session persistence
2. **Store state:** `dispatch({ type: "SET_AI_SETTINGS", settings })` updates the in-memory state used by the AI chat panel and auto-send system

On mount, the AiSettingsPanel loads from localStorage and syncs with the store state if there are non-default values.

## IDE & Agents

The agent panel (`agent-panel.tsx`) shows a list of supported IDE connections:

| IDE           | Type           | Description                        | Icon | Color   | Setup Method |
|---------------|----------------|------------------------------------|------|---------|--------------|
| Claude Code   | `claude-code`  | AI-powered coding agent by Anthropic| CC   | #2563EB | mcp          |
| Cursor        | `cursor`       | AI-first code editor                | Cu   | #3B82F6 | extension    |
| Windsurf      | `windsurf`     | Agentic IDE by Codeium              | Ws   | #1D4ED8 | extension    |
| VS Code       | `vscode`       | With GitHub Copilot                 | VS   | #60A5FA | extension    |
| Antigravity   | `antigravity`  | Visual-first AI development         | AG   | #1E40AF | cli          |

Each IDE is rendered as a card (`IDECard`) showing:
- Colored icon badge with 2-letter abbreviation
- IDE name
- Description

A setup hint at the bottom reads: "Use the Send button in the waitlist to copy feedback to your clipboard, then paste it into your AI agent chat."

### IDEConnection Type

```typescript
type IDEType = "claude-code" | "cursor" | "vscode" | "windsurf" | "antigravity" | "custom";

type IDEConnection = {
  id: string;
  name: string;
  type: IDEType;
  status: "connected" | "disconnected" | "connecting";
  lastSync?: number;
  projectPath?: string;
  description: string;
  color: string;
  icon: string;           // 2-letter abbreviation
  setupMethod: "cli" | "extension" | "mcp";
};
```

All IDEs default to `status: "disconnected"`. Connection status can be updated via the `UPDATE_IDE_STATUS` store action.

## User Workflow

1. Click the Settings icon in the app sidebar
2. The settings page replaces the canvas view
3. **AI Settings** is shown by default
4. Select an AI provider (e.g., "OpenAI API")
5. Enter your API key in the password field
6. Choose a model from the dropdown (e.g., GPT-5.4)
7. Adjust the temperature slider if desired
8. Optionally enable "Auto-send feedback to agent"
9. Click "Save Settings"
10. Switch to the "IDE & Agents" section to see supported IDE connections
11. Navigate back to Design to return to the canvas

## Pending Features

- **Theme settings:** dark/light mode toggle, custom accent colors
- **Shortcut customization:** rebinding keyboard shortcuts for all actions
- **Workspace preferences:** default viewport, default zoom level, panel layout preferences
- **IDE connection management:** actively connecting/disconnecting IDEs with status indicators
- **Per-project settings:** storing settings in the .0c project file rather than global localStorage
