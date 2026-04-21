# 0canvas × ACP — 100% native integration plan

*This plan supersedes the ACP sections of `docs/ZED_ADOPTION.md` for implementation purposes. Collab is explicitly deferred. `ZED_ADOPTION.md` stays in the repo as the broader strategy doc.*

## Context

0canvas today spawns Claude Code / Codex CLI as subprocesses, dispatches its own MCP tools, and parses streaming output in the chat panel — every wire is bespoke. The goal of this plan is to replace that with a **100% ACP-native integration**, modeled exactly on how Zed, JetBrains, Fabriqa, Tidewave, and Toad do it: no custom agent-side code, no custom registry, no custom auth. We embed the ACP SDK, fetch the shared registry, spawn agents as shipped, and the user's own credentials stay on the user's machine.

The user's hard constraints:
- **Zero custom writing.** Use ACP exactly as distributed. Inherit SDK and agent updates automatically.
- **Registry-driven.** The agent list, install, and update mechanisms must match the shared ACP registry (same list Zed and Fabriqa show).
- **Never get blocked by Anthropic / OpenAI / Google.** The integration architecture must not create the exposure of "routing a user's subscription through a third-party product."
- **Collab panel deferred.** Not in scope here.

---

## Legal reality check — the part that must be stated first

Three corrections to assumptions that were shaping this plan, grounded in primary sources:

1. **ACP is not a legal shield.** `agentclientprotocol.com` is a technical spec governed jointly by Zed Industries and JetBrains (two-person BDFL per `MAINTAINERS.md`). Anthropic / OpenAI / Google have no governance seat and have issued no public endorsement. `docs.claude.com` does not reference ACP. The open issue `github.com/agentclientprotocol/claude-agent-acp#337` asks Anthropic to clarify ToS applicability to ACP clients — **unanswered**. Treat ACP conformance as zero legal weight; each vendor's ToS applies independently to each client.

2. **The April 2026 change is a billing change, not a block.** On **April 4, 2026** Anthropic stopped Pro/Max plans from subsidizing third-party harness usage (OpenClaw cited by name). Users can still invoke third-party tools — just via extra-usage billing or their own API key. The *actual* ToS prohibition on third-party Claude.ai login routing has been in place since the **Feb 19, 2026** docs update, with OAuth enforcement from **Jan 9, 2026**. The operative sentence, verbatim from `code.claude.com/docs/en/legal-and-compliance`:

   > *"Anthropic does not permit third-party developers to offer Claude.ai login or to route requests through Free, Pro, or Max plan credentials on behalf of their users. Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice."*

3. **Zed isn't blessed — it's structurally compliant.** Zed spawns the user's own locally-installed Claude Code as a child process; the user runs `/login` themselves; Zed never sees, stores, or proxies the OAuth token. That pattern fits inside Anthropic's "ordinary individual use of Claude Code and the Agent SDK" carve-out. The same carve-out protects Fabriqa, Tidewave, Toad, and JetBrains — all of whom are commercial closed-source ACP clients with no special Anthropic agreement. It can be revoked at any time ("without prior notice"), but as of today it is the sanctioned path.

**What this means for 0canvas:** the architecture the user wants — zero custom code, agents run themselves, credentials never touch 0canvas — *is* the defensible architecture. The user's instinct is right even though the reasoning ("ACP protects us") is wrong. The protection comes from **how the integration executes**, not from the protocol name. The plan below is built to stay strictly inside that carve-out, and to have a clean API-key fallback that needs no carve-out at all.

---

## The ACP architecture we are adopting, verbatim

### Registry

- Canonical source: `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`
- Static JSON served from CDN. 27 agents today. Schema at `github.com/agentclientprotocol/registry/agent.schema.json`.
- Each agent has: `id`, `name`, `version` (semver), `description`, `distribution`, optional `repository`, `website`, `authors`, `license`, `icon`.
- `distribution` is one of `binary` (per-platform archive + cmd/args/env), `npx` (npm package), or `uvx` (PyPI via uv). Installer formats (`.dmg`, `.pkg`, `.deb`, `.msi`) are explicitly out of scope.
- Auto-update mechanism: **the registry itself is updated hourly by CI** in `github.com/agentclientprotocol/registry`. It polls npm, PyPI, and GitHub Releases for each agent and commits version bumps to `main`. Clients refetch the JSON; they don't need their own updater.
- 0canvas fetches this JSON, caches it, diffs on refresh. Nothing custom.

### SDK

- `@agentclientprotocol/sdk` (TypeScript), Apache-2.0, currently v0.19.0, on npm. Maintained by Zed + JetBrains.
- Client-side entry point: `ClientSideConnection`. Spawn agent subprocess, pipe stdin/stdout, wrap in `ClientSideConnection`, call `initialize` → `newSession` → `prompt`. Implement handlers for `SessionUpdate` notifications (message chunks, tool calls, plan updates, permission requests).
- Free to embed commercially. No certification program.

### Agents we plan to surface

All 27 in the registry, shown in a Zed/Fabriqa-style picker. Minimum viable set for 0canvas v1:
- **Claude Agent** (`claude-acp`) — Apache-2.0 wrapper; delegates to `@anthropic-ai/claude-agent-sdk` + user's Claude binary. Supports three auth methods: Claude Subscription (Pro/Max OAuth), Anthropic Console (API key), Gateway (custom base URL).
- **Codex CLI** (`codex-acp`)
- **Gemini CLI** (`gemini`)
- **GitHub Copilot** (`github-copilot-cli`)

Every other agent in the registry shows up in the picker automatically. We do nothing per-agent.

### Auth, the critical constraint

- **0canvas never touches OAuth tokens, never stores API keys on behalf of an agent, never proxies requests.** Each agent handles its own auth via its own terminal flow. The user runs `claude /login` (or similar) inside the agent's TTY; the token lives in the user's OS keychain or the agent's own config dir.
- When the ACP agent advertises multiple `AuthMethod`s at `initialize`, 0canvas presents them as radio options; the user picks; we call the agent's native auth command and get out of the way.
- This is exactly what the claude-agent-acp README + the registry's `AUTHENTICATION.md` specify. No custom work.

---

## Sequenced implementation

### Phase 1 — ACP core replaces the bespoke engine

Rip out the custom MCP dispatcher + bespoke Claude CLI spawn. Replace with:

- New module `src/acp/client.ts` — thin wrapper around `ClientSideConnection` with 0canvas-specific handlers. **Thin** = no business logic in here, just dispatch.
- New module `src/acp/registry.ts` — fetches the CDN JSON, caches to `.0canvas/registry.json`, exposes agent list.
- New module `src/acp/session.ts` — per-session state: which agent, which auth method, thread id, pending permissions.
- Rewrite `src/engine/index.ts`: engine's job becomes "host ClientSideConnection, broadcast SessionUpdates to the browser over the existing WebSocket."
- Delete `src/engine/mcp.ts` as the primary dispatcher. Keep the 5 tool implementations (read state, get styles, list tokens, get feedback, apply CSS) **as ACP client-side methods** — `fs/read_text_file`, `fs/write_text_file`, plus custom 0canvas tool handlers invoked through the standard `session/request_permission` flow. ACP's spec explicitly contemplates this: the client is the trusted I/O layer, the agent asks permission to touch the workspace.
- `src/0canvas/bridge/ws-client.ts` carries ACP `SessionUpdate` payloads, not custom `STYLE_CHANGE`/`AI_CHAT_REQUEST` messages.

### Phase 2 — Chat panel rebuilt around SessionUpdate stream

`src/0canvas/panels/ai-chat-panel.tsx`:
- Messages list consumes `UserMessageChunk` / `AgentMessageChunk` / `AgentThoughtChunk`.
- Tool cards render from `ToolCall` + `ToolCallUpdate`. Each card shows `title`, `kind`-based icon, `status` progress, `content[]` body (markdown / diff / terminal).
- Permission modal rendered from `session/request_permission` — one approve/deny per request.
- Mentions (`@file`, `@selection`, images) via ACP's standard `ContentBlock[]`. 0canvas adds the design-context mentions from `ZED_ADOPTION.md` (`@color/primary`, `@Button`, etc.) **as client-side UI sugar** that expands into standard `ContentBlock` text — not a protocol extension.
- Keep `buildAiContextMarkdown()` and the existing system prompts; attach as initial `ContentBlock` on session creation.

### Phase 3 — Registry-driven agent picker (Zed/Fabriqa-style UI)

Per the screenshots the user shared:

- Side panel "ACP Registry" section lists all agents from the registry JSON.
- For each agent: name, version, description, icon, GitHub link.
- Three states: **Installed** (detected on disk), **Available** (in registry, not installed), **Unavailable** (registry entry marked unavailable or failed health check).
- Actions: `Install` triggers `npx <package>@<version>` first-run (npm caches it) / `uvx` / binary download per `distribution` type. `Remove` clears the cache. `Set as default`. `Advanced options` opens the agent's `settings`.
- **Auto-detection of locally-installed CLIs.** On startup, for each registry agent, we check if its `cmd` resolves on PATH (e.g. `which claude`, `which codex`, `which gemini`). If yes, mark Installed without needing the npx/binary flow — this is what Zed does, which is why it lights up immediately when a user already has Claude Code installed.
- Filter/search ("Filter agents...") and All / Installed / Not Installed tabs, matching the Fabriqa UX.

### Phase 4 — Auth surfaces per agent, always inside the agent's terminal

- When the user first selects an agent, 0canvas calls `initialize` → reads advertised `AuthMethod`s → renders a modal with those exact options.
- Selecting "Claude Subscription" runs `claude /login` inside a small in-app terminal view; the user authenticates in their browser; the token lands in their `~/.claude/` config. 0canvas never sees the token.
- Selecting "Anthropic Console" prompts for the API key; **store it in the OS keychain via Tauri's secure storage**, never in `.0c` or plaintext. On session start, pass as env var to the agent subprocess. (Even here, 0canvas is the key-holder per user choice — not routing through a subscription.)
- Selecting "Gateway" (Claude) sets `ANTHROPIC_BASE_URL` / `ANTHROPIC_CUSTOM_HEADERS` from user-provided settings.
- Same pattern for every agent; each agent's `AuthMethod` list is authoritative.

### Phase 5 — Design-native rendering (client-only, no protocol forks)

Everything design-specific is **purely client-side rendering**, so we keep the "zero custom agent code" rule:
- Tool-call cards inspect `ToolCall.title` / `content[]` / `locations[]` and render design-aware treatments: style-diff thumbnails, affected-component counts, viewport jump on `locations[]`.
- Mentions UI expands into standard `ContentBlock` text; the agent sees normal ACP payloads.
- Subagent delegation ("a11y-auditor", "token-consolidator") is just *prompting* claude-agent-acp to spawn subagents via `SpawnAgentTool` — it's already in the ACP spec, we just expose it in the UI.

---

## What we explicitly do NOT write

- ❌ No 0canvas fork of `claude-agent-acp`, `codex-acp`, `gemini-cli`, or any agent. Use as shipped.
- ❌ No 0canvas registry. Use `cdn.agentclientprotocol.com/registry/v1/latest/registry.json`.
- ❌ No OAuth flow code. Agents do their own.
- ❌ No credential storage for subscription-based agents. API keys go to OS keychain at user's explicit request.
- ❌ No proxying of vendor API calls. Agent subprocess talks to vendor directly.
- ❌ No custom ACP extensions that break compatibility. `_meta` vendor fields OK (spec'd), custom methods not.
- ❌ No fork of `@agentclientprotocol/sdk`. Pinned dependency, upgrade when released.

---

## Legal posture — what ships, what's opt-in, what never ships

### Default, marketed path — bring your own API key

- Claude: Anthropic Console key (`sk-ant-...`) stored in OS keychain
- OpenAI: OpenAI API key
- Gemini: Google AI API key
- Unambiguously permitted under each vendor's Commercial/API Business Terms.
- 0canvas's marketing copy, onboarding, and first-run should default here.

### Power-user opt-in — bring your own installed CLI (subscription path)

- Enabled only if the user already has `claude` / `codex` / `gemini` on PATH with their own `/login` session.
- 0canvas just spawns the existing CLI; the user's existing OAuth token (in `~/.claude/`, etc.) handles auth.
- UI is explicit: *"Uses your locally-installed Claude Code. Subject to Anthropic's Terms of Service. Your credentials never leave your machine."*
- This matches the Zed / Fabriqa / JetBrains pattern. Stays inside Anthropic's "ordinary individual use of Claude Code and the Agent SDK" carve-out.
- Not a protected path: Anthropic can revoke at any time. Live with that risk consciously.

### Never ships, ever

- Any flow where 0canvas ingests, stores, or forwards a user's Claude.ai / ChatGPT / Google AI consumer OAuth token.
- Any "sign in with Claude" button hosted by 0canvas.
- Any proxying of vendor API calls through 0canvas infrastructure.
- Any marketing copy that frames the subscription as "used through 0canvas" — frame it as "the agent you installed, driven by 0canvas's design interface."

### 0canvas ToS must include

- User represents they own the API keys / subscriptions they bring.
- User is bound by each vendor's then-current usage policy (link out).
- 0canvas disclaims liability for user violations of vendor ToS.
- No credential sharing between 0canvas users.

### Proactive outreach

- Email `partnerships@anthropic.com` before public launch. Same for OpenAI and Google. Template: "We built a design-focused ACP client on the same pattern as Zed / Fabriqa / JetBrains. Here's what we do / don't do with credentials. Would appreciate a review."
- Track the **Claude Partner Network** announcement (`anthropic.com/news/claude-partner-network`) — the formal integration track may open.
- Monitor `agentclientprotocol/claude-agent-acp#337` for any Anthropic response.

---

## Critical files (current 0canvas) to modify

- `src/engine/index.ts` — rewrite as ACP session host
- `src/engine/mcp.ts` — delete as primary dispatcher; port tool implementations to ACP client-side methods
- `src/engine/oc-manager.ts` — unchanged for now
- `src/0canvas/panels/ai-chat-panel.tsx` — rebuild around `SessionUpdate` stream, tool cards, permission modals
- `src/0canvas/bridge/ws-client.ts` — carry ACP payloads
- `src/0canvas/store/store.tsx` — replace `AiProvider` / `AiAuthMethod` fields with ACP session + agent + auth-method model

## New modules to add

- `src/acp/client.ts` — `ClientSideConnection` wrapper
- `src/acp/registry.ts` — registry fetch + cache + auto-detect installed CLIs
- `src/acp/session.ts` — per-session state
- `src/acp/auth.ts` — auth method routing (surface agent's own flow, never custom)
- `src/0canvas/panels/agents-panel.tsx` — new Zed/Fabriqa-style registry UI
- `src-tauri/src/keychain.rs` — secure API-key storage (Tauri plugin)

## Reusable from current 0canvas

- `buildAiContextMarkdown()` → attach as initial `ContentBlock` on `newSession`
- `CanvasBridgeClient` transport → carry ACP `SessionUpdate` frames
- System prompts (`VARIANT_SYSTEM_PROMPT`, `ELEMENT_SYSTEM_PROMPT`) → initial thread context
- Existing 5 MCP tool implementations → port to ACP client-side handlers with `session/request_permission` gating

---

## References (all verified by research agents today)

- ACP docs: https://agentclientprotocol.com/get-started/introduction · /clients · /registry
- Registry repo: https://github.com/agentclientprotocol/registry
- Registry CDN JSON: https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json
- claude-agent-acp: https://github.com/agentclientprotocol/claude-agent-acp (Apache-2.0, maintained by Zed + JetBrains)
- TS SDK: https://www.npmjs.com/package/@agentclientprotocol/sdk
- Maintainers / governance: `MAINTAINERS.md` in the agentclientprotocol org
- Anthropic legal page: https://code.claude.com/docs/en/legal-and-compliance
- Zed "Claude Code via ACP" blog: https://zed.dev/blog/claude-code-via-acp
- Zed "ACP Registry is Live" blog: https://zed.dev/blog/acp-registry
- Open ToS question: https://github.com/agentclientprotocol/claude-agent-acp/issues/337
- Fabriqa: https://fabriqa.ai
- Claude Partner Network: https://www.anthropic.com/news/claude-partner-network
- April 4 2026 change (reporting): TechCrunch, VentureBeat, The Register

## Verification

- [ ] `registry.ts` fetches the CDN JSON and surfaces all 27 agents
- [ ] Agents Panel matches Zed/Fabriqa screenshot UX (filter, install/remove, set default, advanced options, auto-detect installed)
- [ ] Claude Agent installs via npx, user authenticates via `/login` in in-app terminal, session round-trips a tool call end-to-end without 0canvas touching the OAuth token
- [ ] Claude Agent also works with API-key path; key lives in OS keychain, never in `.0c` or logs
- [ ] Codex, Gemini, and one more agent work identically
- [ ] Chat panel renders `AgentMessageChunk`, `AgentThoughtChunk`, `ToolCall`, `ToolCallUpdate`, `Plan`, `CurrentModeUpdate` correctly
- [ ] Permission modal gates every tool call that requires it
- [ ] Existing 5 design tools (read state, get styles, list tokens, get feedback, apply CSS) round-trip through ACP as client-side handlers
- [ ] Upgrade path: bumping `@agentclientprotocol/sdk` picks up protocol updates; refetching registry picks up agent updates; neither requires 0canvas code changes

---

## Phase 1a + 1b + 1c — what shipped, how to smoke test

Phase 1 is fully closed. ACP is wired end-to-end: registry-driven picker, subprocess lifecycle, auth modal with OS-keychain storage, chat surface with tool cards and permission gating, all behind the `⚡` toggle in the legacy chat panel.

### What shipped

**Engine (Node.js sidecar):**
- `src/engine/acp/registry.ts` — fetches `cdn.agentclientprotocol.com/registry/v1/latest/registry.json`, caches to `.0canvas/acp/registry.json`, falls back to cache on network failure. Platform-aware `resolveLaunch()` resolves npx/uvx/binary invocation per agent.
- `src/engine/acp/client.ts` — spawns the vendor's own CLI, wraps stdio with `ndJsonStream`, constructs `ClientSideConnection`. Graceful SIGTERM → SIGKILL shutdown.
- `src/engine/acp/session-manager.ts` — one subprocess per agent id, multiple sessions per subprocess. Pending-permission registry bridges the SDK's async callback to a browser round-trip.
- `src/engine/index.ts` — 6 new `ACP_*` message handlers dispatch to the session manager; outbound traffic (SessionUpdate, permission prompt, stderr, exit) fans out over the existing WebSocket. Legacy MCP + `AI_CHAT_REQUEST` paths fully intact.
- `src/engine/types.ts` — 16 new `ACP_*` message types; `createMessage<T>` tightened to narrow the discriminated union (fixes pre-existing tsc errors across the repo).

**Browser (UI):**
- `src/0canvas/acp/use-acp-session.tsx` — React hook over the bridge. Handles listAgents / startSession(agentId, {agentName, env}) / sendPrompt / cancel / respondToPermission. Text-chunk coalescing for scroll perf.
- `src/0canvas/acp/agents-panel.tsx` — searchable list of all registry agents. Per-agent card: name, version, dist kind (npx/uvx/binary), id, description, Start button.
- `src/0canvas/acp/auth-modal.tsx` (1c) — method picker. Known vendors (Anthropic, OpenAI, Google) get API-key input + subscription opt-in; unknown agents bypass the modal and start directly. API keys persist to the OS Keychain via `src/native/secrets.ts`.
- `src/0canvas/acp/acp-chat.tsx` — messages, agent thoughts, tool-call cards, permission bar, Send/Stop composer. Compliance micro-line under the composer ("Credentials stay with the agent CLI").
- `src/0canvas/acp/acp-mode.tsx` — orchestrates picker → auth → chat. Back from auth returns to picker; back from chat resets session state (subprocess stays warm under the session manager).
- `src/0canvas/panels/ai-chat-panel.tsx` — added `Zap`-icon toggle in the existing header. In ACP mode, the panel body is replaced with `<AcpMode />`; title flips to "ACP · Beta"; legacy state preserved across toggles.

**Shared:**
- `src/0canvas/bridge/messages.ts` — mirror of engine types; `import type` from `@agentclientprotocol/sdk` so the wire stays honest to the spec.

Builds: engine (tsup) and UI (vite) both green. `tsc --noEmit` clean for all new code.

### Smoke test procedure

**Preconditions.** You need an Anthropic API key (get one at `console.anthropic.com/settings/keys`) *or* a pre-existing `claude` CLI with `/login` done. Both paths are supported in the auth modal.

1. **Build + launch:**
   ```
   pnpm build:sidecar
   pnpm tauri:dev
   ```

2. **Open the chat panel** and click the `⚡` (Zap) icon in the header. The panel title flips to "ACP · Beta".

3. **Registry fetch.** You should see the list of all 27 agents from `cdn.agentclientprotocol.com`. Each row shows name, version, npx/uvx/binary, id, description. Search to filter. Click 🔄 to force-refresh from the CDN.

4. **Pick Claude Agent → Auth modal appears.** Two options:
   - **Anthropic API key (Recommended)** — paste `sk-ant-...` into the input. Click Continue. Key is stored in the macOS Keychain via `src/native/secrets.ts` (falls back to localStorage in the plain-browser dev harness) and injected as `ANTHROPIC_API_KEY` when the subprocess spawns. On subsequent sessions, the field pre-fills from the keychain.
   - **Use my installed Claude CLI** — relies on your existing `claude /login` session. 0canvas spawns the CLI clean; the CLI reads its own config dir for credentials. 0canvas never sees the OAuth token.
5. **Session starts.** Under the hood:
   - Engine calls `ensureAgent("claude-acp", { env })` → spawns `npx --yes @agentclientprotocol/claude-agent-acp@0.30.0` with the chosen env
   - First run downloads the npm package (~15–30s). Subsequent runs are instant.
   - Engine calls `initialize()` → advertised auth methods come back
   - Engine calls `newSession({ cwd: projectRoot })` → sessionId returned
   - UI swaps to chat view with header "Claude Agent · session xxx…"

6. **Send a prompt.** Try: *"List the files in this project."*

   If you ever need to rotate the API key: back out of the session, pick Claude Agent again, enter a new key. The session-manager detects env drift, disposes the stale subprocess, and respawns with the new env — no Tauri restart needed.
   - You should see the user message appear immediately
   - Agent text streams in as `AgentMessageChunk`s — text coalesces into a single bubble as chunks arrive
   - For a list-files prompt, claude-agent-acp will issue tool calls; you'll see gray tool-call cards with status icons (Clock → Loader2 → CheckCircle2)
   - Stream ends, `lastStopReason` shows in the header subtitle

7. **Permission prompt.** Ask: *"Write a file called `acp-test.txt` with 'hello'."*
   - claude-agent-acp will request permission. The amber permission bar appears at the bottom of the messages.
   - Choose "Allow once" to approve or "Cancel turn" to reject.
   - If allowed, the tool-call card advances to "completed" and the file is written.

8. **Cancel test.** Send a long prompt and click **Stop** while it streams. The turn should end with `stopReason: "cancelled"`.

9. **Switch agents.** Click the ← back arrow to return to the picker. Select **Codex CLI** or **Gemini CLI**. Each agent spawns independently; Claude Agent stays alive in the background (one subprocess per agent id).

### Inspecting what happened

- **Registry cache on disk:** `.0canvas/acp/registry.json` — the exact JSON fetched from the CDN, plus a `fetchedAt` timestamp.
- **Agent stderr:** currently logged to the engine's stdout and broadcast to the browser (stored in `session.stderrLog`, max 200 lines). Not surfaced in the UI yet — inspect via React DevTools on the hook state.
- **Engine logs:** look for `[acp claude-acp]` prefixed lines in the Tauri console / engine stdout.

### Known scope limits after 1c

- **Session persistence:** in-memory only. Refreshing the page or restarting the engine kills sessions. Phase 2: session resume via `loadSession` once the agent supports it.
- **Subscription path uses current shell env.** When the user picks "Use my installed Claude CLI", we spawn with no injected env. If your launch shell already had `ANTHROPIC_API_KEY` exported, that leaks through into `process.env`. For 1c this is intentional — it's your own env, it's already your machine — but Phase 2 will scrub known auth env vars when subscription mode is chosen, to guarantee the agent uses its own stored credentials not yours.
- **UI polish:** the chat uses plain Tailwind styling, not the `oc-chat-*` scoped classes the legacy panel uses. Visually distinct by design — "Beta" — Phase 2 aligns once the surface is locked.

---

## Phase 2a — agent gets the canvas

The value-unlock milestone. Claude now *has tools*: it can read the design state, inspect elements, list tokens, read feedback, and apply CSS changes — all via the 0canvas MCP endpoint, auto-attached to every ACP session. Zero agent-side config; all five tools show up automatically.

### What shipped

- [src/engine/acp/session-manager.ts](src/engine/acp/session-manager.ts) — new `registerMcpServer(handle)` / `unregisterMcpServer(name)`. Every `newSession` auto-injects registered servers into the ACP `mcpServers` array. Spec-native wire: `{ type: "http", name, url, headers }`.
- [src/engine/index.ts](src/engine/index.ts) — after the HTTP server binds its port, the engine registers `{ name: "0canvas", url: "http://127.0.0.1:<port>/mcp" }` with the session manager. The existing MCP endpoint (already used by external agents) is now also wired into ACP sessions.
- [src/0canvas/acp/acp-chat.tsx](src/0canvas/acp/acp-chat.tsx) — tool-card renderer recognizes the 5 design tool names by substring match and renders design-native treatment: vendor-colored border, semantic icon (Palette / Target / FileText / MessageSquare / Zap), friendly label ("Apply CSS change" not "mcp__0canvas__apply_change"), inline summary of the call args (e.g. `.hero { color: #3B82F6 }`).

### How to verify end-to-end

With Phase 1c's smoke test already passing, try:

1. **"What design tokens do we have?"** — Agent calls `list_tokens`. You'll see a green-bordered tool card with a palette icon labeled "Read design tokens · 0canvas". Agent's reply enumerates the real `--foo-bar` names from your CSS.
2. **"Change `--color-primary` to `#3B82F6`."** — Agent calls `apply_change`. Tool card shows `--color-primary { --color-primary: #3B82F6 }` or similar summary. CSS file edits on disk; HMR reloads the iframe.
3. **"List all pending feedback."** — Agent calls `get_feedback`. If your `.0c` file has any pending items, they come back.

### What's not in 2a yet (staged for 2c onward)

- **Design-native permission modal.** Permission bar still renders the agent's raw option labels; future phase reframes them per tool kind.
- **@-mention picker** for tokens/components/variants in the composer.
- **Visual before/after diff cards** when `apply_change` lands — currently shows the text summary only.

---

## Phase 2b — follow-along + selection awareness

The agent now sees what the designer is pointing at, and the canvas follows what the agent is editing. Design pair-programming loop closed.

### What shipped

- [src/0canvas/acp/selection-sync.tsx](src/0canvas/acp/selection-sync.tsx) — effect-only component. Watches `state.selectedElementId`; when it changes, sends `ELEMENT_SELECTED` (selector + tag + class list + computed styles) over the bridge. Null selection sends an empty payload to clear the cache upstream.
- [src/app-shell.tsx](src/app-shell.tsx) — mounts `<SelectionSync />` once under `BridgeProvider` so it runs app-wide.
- [src/engine/index.ts](src/engine/index.ts) — new `handleElementSelected` caches the latest payload in `this.currentSelection`; MCP server is handed a getter so the 6th tool always reads fresh data without tight coupling.
- [src/engine/mcp.ts](src/engine/mcp.ts) — new tool **`0canvas_get_selection`**. Returns `{ selector, tagName, className, computedStyles, updatedAt }` or `{ selection: null, hint: "Nothing selected..." }`. The agent SHOULD call this first on every turn.
- [src/0canvas/store/store.tsx](src/0canvas/store/store.tsx) — new `findBySelector(elements, selector)` helper, mirror of the existing `findElement(elements, id)`.
- [src/0canvas/acp/acp-chat.tsx](src/0canvas/acp/acp-chat.tsx) — follow-along effect. When a 0canvas tool call streams in with a `selector` in its rawInput, the component resolves the element in the workspace tree, dispatches `SELECT_ELEMENT`, and calls `flashElement` so the overlay highlights it. Idempotent per tool-call id. `MousePointer2` icon added for the selection tool.

### How to verify

1. **Selection round-trip.** Select any element in the canvas. Ask Claude: *"What element do I have selected?"* — Agent calls `0canvas_get_selection` (green MousePointer2 card), reports the selector and tag.
2. **Follow-along on inspect.** With nothing selected, ask: *"Look at `.hero-title` and tell me its current color."* — Agent calls `0canvas_get_element_styles` with `{ selector: ".hero-title" }`. The canvas selects and flashes `.hero-title` as the tool call streams in.
3. **Follow-along on apply.** Ask: *"Change `.hero-title` padding to 2rem."* — Agent calls `0canvas_apply_change`. Canvas jumps to the element before the write lands; the designer sees what's about to be touched.
4. **Null selection.** Clear selection (Esc), ask: *"What am I looking at?"* — Agent gets `{ selection: null, hint: "..." }` and asks the designer which element to focus on, rather than guessing.

---

## Phase 2c — @-mention picker

Designer types `@` and picks project-native context from a keyboard-driven list: the current selection, every design token, every variant, every pending feedback item. The composer keeps the compact token (`@token:--color-primary`) for readability, but on send each mention expands inline into descriptive English — so the agent reads a natural sentence with real values attached, without any protocol extension.

### What shipped

- [src/0canvas/acp/mentions.ts](src/0canvas/acp/mentions.ts) — `collectMentions(workspaceState)` walks themes/variants/feedback/selection into a unified `MentionItem[]`; `filterMentions` is position-ranked fuzzy; `detectMentionTrigger` returns the current trigger range when the caret sits inside an unterminated `@...`; `expandMentionsInText` replaces every token with its live expansion at send time.
- [src/0canvas/acp/mention-picker.tsx](src/0canvas/acp/mention-picker.tsx) — popover list with per-kind icons (MousePointer2 / Palette / Layers / MessageCircle), active highlight, `mousedown` picks (beats textarea blur), scroll-into-view as the keyboard highlight moves.
- [src/0canvas/acp/use-acp-session.tsx](src/0canvas/acp/use-acp-session.tsx) — `sendPrompt(text, displayText?)`. The UI shows `displayText`, the agent receives `text`. Default keeps them the same.
- [src/0canvas/acp/acp-chat.tsx](src/0canvas/acp/acp-chat.tsx) — mention plumbing: caret tracking, trigger detection, arrow/Enter/Tab/Escape keyboard nav, insert-and-advance, and `expandMentionsInText` called on send so the wire gets `design token --color-primary (values: default=#3B82F6, light=#2563EB)` while the user sees `@token:--color-primary`.

### How to verify

1. **Selection mention.** Select any element. Type `@sel` in the composer → picker filters to the Selection row → Enter inserts `@selection `. Send *"Change @selection to use @token:--color-primary."* — agent sees a natural sentence with real selector + token value.
2. **Token mention.** Type `@primary` (or a partial token name). Picker shows matching tokens with value hints. Enter inserts. On send, `@token:--color-primary` expands to `design token --color-primary (values: default=#3B82F6, light=#2563EB)`.
3. **Variant mention.** `@` → scroll to a Variant row → pick. Agent sees `variant "My Hero v2" (component, status finalized, sourced from .hero-title)`.
4. **Feedback mention.** If you have pending feedback items, `@` picks the most-recent-first list. Expansion includes the intent, severity, and element selector.
5. **Escape / dismiss.** Open the picker with `@`, press Escape → a space is inserted to close the trigger without picking anything; typing continues normally.

### What's still staged

- **Element mention** — skipped for MVP; the element tree is deep and mostly unlabeled. `@selection` covers the common case. Revisit if we ever add a real component abstraction.

---

## Phase 2d — designer-language permission modal

The permission bar speaks Designer, not Engineer. When the agent asks permission for a recognized 0canvas tool, the prompt carries a one-line summary of the action (tool-specific), a body explaining what's about to happen, and for `apply_change` a compact before → after diff of the CSS value. Reads tint the bar green (low risk); writes stay amber. Option buttons normalise noisy kind names ("allow_once" → "Allow once", "reject_always" → "Always block") without stomping anything the agent spelled out clearly.

### What shipped

- [src/0canvas/acp/acp-chat.tsx](src/0canvas/acp/acp-chat.tsx) — each `DESIGN_TOOLS` entry can expose a `describePermission(rawInput, ctx)` that returns `{ headline, body?, diff?, risk }`. `PermissionBar` matches the tool by title, pulls the prompt, looks up the element by selector to compute the "before" value for diffs, and renders the risk-tinted bar. Unknown tools fall through to the original behaviour.
- Option labels pass through `friendlyOptionLabel(name, kind)` which only rewrites the noisy kind-only strings ("allow_once", "reject_always") so bespoke agent copy keeps shining through.

### How to verify

1. **Low-risk tint.** Ask: *"What tokens do I have?"* — agent calls `list_tokens` → permission bar shows "Read all design tokens" with a green tint and a Palette icon.
2. **High-risk tint + diff.** Select a real element whose CSS you can read (e.g. `.hero-title`). Ask: *"Change @selection color to #3B82F6."* — agent calls `apply_change` → permission bar shows a Zap icon, headline "Apply CSS change to .hero-title", and a monospace before → after pair: `− color: rgb(15, 23, 42)` / `+ color: #3B82F6;`.
3. **Unknown selector.** Ask for a change on a selector that isn't live in the current canvas — the before row renders `(unset)` instead of a stale value.
4. **Option label normalisation.** The buttons now read "Allow once / Always allow / Block / Always block" when the agent returns bare kind strings; agent-authored labels ("Approve this edit") still render as-is.

---

## Phase 2e — persistent design receipts in the chat history

Completed `apply_change` tool calls stop looking like status dots and start reading like a design journal. The card grows a permanent receipt with the selector header, the before → after CSS values, and the source file location — so scrolling back through a session tells the same story as scrolling back through Git history, but in designer language.

### What shipped

- [src/0canvas/acp/acp-chat.tsx](src/0canvas/acp/acp-chat.tsx) — new `applyReceipts` state keyed by `toolCallId`. The existing follow-along effect captures the pre-change CSS value at first observation of the tool call (same moment it grabs the selector to flash the canvas), so by the time the card re-renders completed, `before` still reflects what was on disk before the agent wrote.
- New `ApplyChangeReceipt` component renders inside `ToolCallCard` whenever we have a captured receipt AND status is `completed` or `failed`. Shows: selector header, monospace `− prop: before;` / `+ prop: after;` diff, optional source path/line from `ToolCall.locations[0]`. Failed writes strike through the `+` line to make "we didn't apply this" unmissable.
- Pending `apply_change` cards still show the raw one-line summary so the streaming status is legible; the receipt takes over once the tool settles.

### How to verify

1. **Happy path.** With `.hero-title` visible in the canvas and its current color say `rgb(15, 23, 42)`, ask: *"Change @selection color to #3B82F6."* Agent calls `apply_change`. While in progress the card shows the usual Zap summary; once completed it swaps to a receipt — `.hero-title` header, `− color: rgb(15, 23, 42);` red row, `+ color: #3B82F6;` green row, and (if the resolver returned a location) `src/styles/hero.css:42` footer.
2. **Unset before.** Ask the agent to set a property that isn't currently declared on the element. Receipt shows `(unset)` italic on the before row — designer sees it's an addition rather than a replacement.
3. **Failed write.** Force a failure (e.g. ask to change a property on a selector that doesn't resolve to any CSS file). Card flips to failed status, receipt `+` line is grey with strikethrough so nothing reads like a successful edit.
4. **Scrollback.** Do several edits in one session. Scroll up — every completed `apply_change` renders its receipt, together reading like a changelog. Canvas follow-along is idempotent so re-rendering doesn't re-flash old edits.

---

## Phase 2f — styling alignment on the 0canvas design system

The ACP surface now rides the same design tokens as the legacy `oc-chat-*` surface instead of arbitrary Tailwind `white/30` / `emerald-500/20` / `[#1a1a1a]` colors. One set of typography, one palette, one spacing grid — toggling the `⚡` button swaps the *body* of the panel, not the visual language.

### What shipped

- [src/0canvas/engine/0canvas-styles.ts](src/0canvas/engine/0canvas-styles.ts) — a dedicated ~450-line `oc-acp-*` block appended to `ZEROCANVAS_CSS`. Covers: surface wrapper, subheader, message roles (user/agent/thought/system mirror `oc-ai-msg-*` tokens), tool cards + design vs generic variants, apply-change receipt + row states, permission bar with `-low` and `-high` risk tints, composer input/send/stop (mirrors `oc-ai-input-row`), mention picker (mirrors `oc-slash-menu`), registry rows, auth method cards + field + disclaimer + actions, plus small states (error, empty, loading).
- [src/0canvas/acp/acp-chat.tsx](src/0canvas/acp/acp-chat.tsx) — swapped every color-bearing Tailwind utility for the new classes. `oc-acp-surface` on the root, `oc-acp-subheader` with `oc-chat-iconbtn` for the back button, `oc-acp-body` + `oc-acp-messages`, message rows use `oc-acp-msg oc-acp-msg-{role}`, tool cards use `oc-acp-tool oc-acp-tool-design` for recognized 0canvas tools, receipts use the token-backed `oc-acp-receipt-*` stack, permission bar branches on `oc-acp-perm-low` / `oc-acp-perm-high`, composer uses `oc-acp-input` / `oc-acp-send-btn` / `oc-acp-stop-btn`.
- [src/0canvas/acp/agents-panel.tsx](src/0canvas/acp/agents-panel.tsx) — `oc-acp-reg-*` for search, list, row, avatar, title, version/dist badges, Start button, footer.
- [src/0canvas/acp/auth-modal.tsx](src/0canvas/acp/auth-modal.tsx) — `oc-acp-auth-*` for the subheader, method cards, key field, disclaimer, cancel/continue actions.
- [src/0canvas/acp/mention-picker.tsx](src/0canvas/acp/mention-picker.tsx) — `oc-acp-menu-*` classes, positioned to the composer row which now has `position: relative`.

### How to verify

1. **Side-by-side.** Open the chat panel, toggle `⚡` off → look at the legacy panel's typography, icon button hover, input background. Toggle on → the ACP surface now uses the same font sizes, input padding, `oc-chat-iconbtn` hover tint, 8px border-radius. No more 12-pixel-plain-text contrast dip.
2. **Token inheritance.** Pick Claude Agent → auth modal. Radio dots, card borders, input focus ring — all pick up `--color--text--success`, `--color--border--on-surface-*`, `--color--outline--focus` from the theme file. Rebind the theme and the ACP surface follows.
3. **Tool cards.** Agent calls `list_tokens` → the card's left border tints with the shared emerald-on-surface mix, icon color comes from `--color--text--success`. Agent calls an unknown tool (e.g. the agent's built-in `Bash`) → neutral `--color--border--on-surface-0` border instead of the green design-tool treatment.
4. **Permission risk tints.** Reads now render in the emerald-tinted `oc-acp-perm-low` bar; writes stay in amber `oc-acp-perm-high`. Diff rows inside the bar reuse the same `oc-acp-receipt-row-*` classes as the post-completion receipt, so prompt and history look consistent.
5. **Mention picker.** Open `@` — popover now matches `oc-slash-menu`: same `--color--surface--1` background, same 10px border-radius, same `--shadow-lg`, same active-row tint.
6. **Dark-mode only is fine.** The repo is currently dark-theme only; these tokens are all defined for dark. If a light theme ever lands, the ACP surface tracks it automatically because no hex literal survives in the components.

### If something goes wrong

- **Registry fetch fails:** check network, DNS, proxy. Cache fallback still serves a stale registry if one exists.
- **Agent never initializes:** look at engine stdout for `[acp claude-acp]` stderr lines. Common causes: `npx` not on PATH, network blocking npm, corporate proxy not configured.
- **`auth_required` error on session start:** the agent needs auth you haven't provided. For Claude Agent: `export ANTHROPIC_API_KEY=...` or run `claude /login` in a terminal first.
- **Prompt hangs forever:** cancel with Stop. Check stderr log. Most likely the agent is waiting on a permission prompt that didn't render — file an issue with the permission request payload.

## Decisions locked

1. **First-launch default:** Claude Agent preselected, API-key onboarding. Fastest to "chat works" and stays on the unambiguously-permitted legal path. Picker remains one click away for users who want other agents or the subscription path.
2. **Login UI surface:** Dedicated modal with embedded terminal. Figma-native feel; the compliance disclaimer ("Uses your locally-installed Claude Code. Credentials never leave your machine. Subject to Anthropic's ToS.") lives inline with the terminal prompt, unambiguous at the moment it matters.
