# Agent Chat And Agents

This explains how chat windows, new-agent windows, and coding agents work today.

## Current Direction

Zeros no longer depends on external ACP adapter packages at runtime. The current direction is:

> Use the user's own installed coding-agent CLIs directly, then translate each CLI's output into one consistent Zeros chat UI.

Supported agent families are defined in `src/engine/agents/registry.ts`:

- Claude Code
- Codex
- Cursor Agent
- Amp
- Factory Droid
- GitHub Copilot CLI
- Gemini CLI

## Why Native Adapters Replaced ACP

Older architecture used ACP-style adapters and `npx` packages. That caused:

- slow first starts
- large downloads
- adapter dependency risk
- transport hangs
- inconsistent support across vendors

The native adapter layer avoids this by spawning the vendor CLI directly.

Important nuance:

- Some ids still include `acp`, like `claude-acp` and `codex-acp`, for saved-data compatibility.
- The runtime path is native.
- Some comments still mention ACP because the wire protocol was preserved during migration.

## User Flow: Starting A New Chat

1. User lands on the empty composer.
2. User chooses or accepts:
  - workspace folder
  - Git branch
  - agent
  - model
  - reasoning effort
  - permission mode
  - image attachments
3. User sends prompt.
4. Zeros creates a `ChatThread`.
5. Zeros starts or reuses an agent subprocess.
6. Zeros sends the prompt.
7. Streaming messages/tool cards appear in the chat.

Key files:

- `src/shell/empty-composer.tsx`
- `src/shell/column2-chat-view.tsx`
- `src/zeros/agent/agent-chat.tsx`
- `src/zeros/agent/sessions-provider.tsx`
- `src/zeros/store/store.tsx`

## ChatThread Data Model

Each saved chat record contains:

- `id`: chat id
- `folder`: project folder/cwd
- `agentId`: selected agent
- `agentName`: display label
- `model`: chosen model or null for default
- `effort`: reasoning effort
- `permissionMode`: full, auto-edit, ask, or plan-only
- `title`: sidebar title
- `createdAt` / `updatedAt`
- `resumeSessionId`: optional previous session to load
- `pinned`: sidebar pinning
- `sourceChatId`: previous chat when switching agents

Important limitation:

- Chat records persist, but long-term message transcript storage is not yet a clean product-level model. Session state lives in the runtime provider and agent-side histories.

## Session Provider

`AgentSessionsProvider` is the renderer-side coordinator.

It provides:

- one session state per chat
- one WebSocket listener for engine messages
- session id to chat id mapping
- message lists
- pending permission state
- failure classification
- warm agent tracking
- list/init/start/load/cancel/send operations

Why it exists:

- The old hook model assumed one chat at a time.
- The production app needs many project-scoped chats.

## Engine Agent Gateway

The engine handles messages like:

- `AGENT_LIST_AGENTS`
- `AGENT_INIT_AGENT`
- `AGENT_NEW_SESSION`
- `AGENT_PROMPT`
- `AGENT_CANCEL`
- `AGENT_PERMISSION_RESPONSE`
- `AGENT_SET_MODE`
- `AGENT_LIST_SESSIONS`
- `AGENT_LOAD_SESSION`

These are received in `src/engine/index.ts` and routed to `AgentGateway`.

## Agent Registry

`src/engine/agents/registry.ts` is the source of truth for:

- which agents are known
- which CLI binary to probe
- install command
- docs URL
- auth detection method
- login command
- min/max supported CLI version
- adapter factory

Auth posture:

- Zeros does not store vendor tokens.
- Zeros does not read credential file contents.
- Zeros checks existence or status only.
- Login opens the vendor CLI flow in Terminal.

## Model Catalog

`catalogs/models-v1.json` lists selectable models.

The app has:

- bundled fallback
- hot update path through GitHub Pages
- provider-specific env var mapping

The model pill in chat uses this catalog so model updates do not always require a full app release.

## Permission Modes

Permission mode decides what the agent is allowed to do.

- **Full**: auto-approve everything.
- **Auto-edit**: allow reads and edits, ask for higher-risk actions.
- **Ask**: ask before writes/commands.
- **Plan-only**: agent should plan without executing.

This is essential for designer trust. The user should always understand whether an agent can edit files.

## Tool And Permission Cards

`AgentChat` renders:

- user/agent messages
- tool calls
- tool updates
- permission prompts
- error banners
- model/effort/permission pills
- branch/workspace context
- mention and slash command pickers
- image attachments

It does not own the protocol; it displays the state from `AgentSessionsProvider`.

## Agent Switch Flow

When a user switches agent from inside a chat:

1. Zeros creates a new chat.
2. It copies workspace folder, effort, and permission mode.
3. It binds the new agent.
4. It stores the old chat as `sourceChatId`.
5. The new composer can offer a summary handoff.

This keeps conversations clean and makes multi-agent work understandable.

## Recent Thread / Resume Flow

For agents with history support:

1. UI asks engine to list sessions.
2. Engine queries the agent's history files or CLI capabilities.
3. UI lets user pick one.
4. Chat stores `resumeSessionId`.
5. On mount, the session provider loads the old session.

This is currently more mature for Claude and Codex than for every adapter.

## Mission Control

`src/shell/mission-panel.tsx` is a small monitoring view.

It tracks:

- active sessions
- approximate tokens
- tool counts
- last errors

Current limitation:

- It listens to `ai-stream-event`, but the primary modern chat path uses engine WebSocket agent events. This panel may need to be reconciled with the current native agent event stream.

## What Works

- Native agent registry exists.
- Seven agent adapter families are represented.
- Chat records persist.
- Project-scoped cwd is wired.
- Agent/model/effort/permission controls are visible.
- Permission requests flow through UI.
- Pre-warming is implemented.
- Auth status is designed to avoid secret handling.

## What Needs Cleanup

- Rename remaining `acp` ids/comments carefully without breaking saved chats.
- Decide where chat transcripts are stored long term.
- Reconcile Mission Control with the current event stream.
- Make failure states and installation/auth guidance extremely non-technical.
- Add a product-level "Agents" settings page that explains what each agent needs installed.
- Make project switching and chat cwd changes feel instant.

## Product Explanation

The best way to explain this feature to users:

> Zeros lets you bring your own AI coding subscriptions. If you already use Claude Code, Codex, Cursor Agent, Gemini, or another supported CLI, Zeros can run it locally against your project and show the conversation in a designer-friendly workspace.