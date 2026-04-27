# Chat Rebuild — Forward Roadmap (rev. 2026-04-27)

**Companion to:** [CHAT_REBUILD_PHASE_0.md](./CHAT_REBUILD_PHASE_0.md) (the retrospective).
**Status:** Phase 0 shipped in `2be41ae`. Phase 1 is in flight:
- Stage 1A (ACP type-system removal) — `1f85761`
- Stage 1B.1-3 (CSS prefix + localStorage + UI strings + comments) — `71f7f66`
- Stage 1B.4 (agent ID rename with backward-compat — superseded by 1C) — `828f0a7`
- Stage 1A.8 (canonical message kinds declared) — `0a2dcbb`
- Stage 1C (clean ACP break, no backward-compat) — `af45f5e`
- Stage 1C cleanup (final identifier renames) — `1b3abb7`

This rev replaces the previous draft, removes the Codex API-key parallel track (deferred indefinitely — CLI subscription auth is the only supported flow today), folds the original Phase 2 + Phase 3 into a single performance/architecture phase merged with the 360-degree migration audit, and adds:

- **Stage 1C** — clean ACP break with no backward-compat aliases. Decided 2026-04-27 because half-here ACP residue (alias maps, migration shims, legacy keychain fallbacks) was creating cognitive load. All paths now expect canonical IDs (`claude`, `codex`, `amp`); persisted user data referencing legacy IDs is treated as invalid (chats need recreating, API keys need re-entering, enabled-agents need re-toggling).
- **§2.8 CLI vs API agent adapters** — the architectural model for handling both consumer-CLI agents (today's path) and future direct-API agents in the same renderer pipeline.
- **§2.9 Agent capability transparency** — the architectural commitment that every CLI's native capabilities (memory, skills, subagents, MCP, project context) flow through our wrapper unchanged because we drive the CLI, we don't replace it. Plus the renderer-side affordances we add on top (project-context indicator, memory inspector) and the gotchas (Cursor/Amp cloud-coupled resume, Task→Agent rename, TUI-only capabilities handled out-of-band).
- **§2.10 Adapter contract refinements (DPCode-inspired)** — the OpenCode adapter joins the lineup as the 8th agent, with a server-first integration pattern (spawn `opencode serve`, attach `@opencode-ai/sdk`, consume SSE bus). Validated against [DPCode](https://github.com/Emanuele-web04/dpcode) (MIT, Electron + Effect-TS) which has already integrated Claude/Codex/Gemini/OpenCode behind a single `ProviderAdapterShape<TError>` contract. Patterns adopted: declarative `capabilities` struct, `raw + providerRefs` fields on every canonical event for free debugging, `OPENCODE_CONFIG_CONTENT={}` env trick to neuter user config without touching it. Patterns deliberately not adopted: their monolithic 2,127-line `MessagesTimeline.tsx` (we keep our renderer registry).
- **OpenCode** as our 8th agent — opens the cheap-alternative-models story (Kimi K2 via OpenRouter, Qwen3 via local Ollama, GLM 4.5, DeepSeek V3, etc.) without us needing to build per-model adapter logic. OpenCode is provider-agnostic over 75+ model providers via Vercel AI SDK + models.dev.

---

## Table of contents

1. [Where we are](#1-where-we-are)
2. [Phase 1 — Unified Conductor-quality experience](#2-phase-1--unified-conductor-quality-experience)
   - 2.1 [Why "unified" is the through-line](#21-why-unified-is-the-through-line)
   - 2.2 [The canonical event taxonomy](#22-the-canonical-event-taxonomy)
   - 2.3 [Adapter normalizers — where agent dialects collapse](#23-adapter-normalizers--where-agent-dialects-collapse)
   - 2.4 [The unified card system](#24-the-unified-card-system)
   - 2.5 [Long-run UX — scroll, prompt pinning, compactness](#25-long-run-ux--scroll-prompt-pinning-compactness)
   - 2.6 [Inline permissions with sticky decisions](#26-inline-permissions-with-sticky-decisions)
   - 2.7 [Agent-specific affordances (where unification breaks)](#27-agent-specific-affordances-where-unification-breaks)
   - 2.8 [CLI vs API agent adapters (the parallel-adapter model)](#28-cli-vs-api-agent-adapters-the-parallel-adapter-model)
   - 2.9 [Agent capability transparency — what passes through, what we add](#29-agent-capability-transparency--what-passes-through-what-we-add)
   - 2.10 [Adapter contract refinements (from DPCode research)](#210-adapter-contract-refinements-from-dpcode-research)
3. [Phase 2 — Performance + architecture (merged with 360-degree audit)](#3-phase-2--performance--architecture-merged-with-360-degree-audit)
   - 3.1 [Workspace store: Zustand migration](#31-workspace-store-zustand-migration)
   - 3.2 [Message-list virtualization (react-virtuoso)](#32-message-list-virtualization-react-virtuoso)
   - 3.3 [Streaming markdown + Shiki worker](#33-streaming-markdown--shiki-worker)
   - 3.4 [Tool-call index + WS dedup](#34-tool-call-index--ws-dedup)
   - 3.5 [Engine sidecar runtime decision](#35-engine-sidecar-runtime-decision)
   - 3.6 [Canvas iframe virtualization](#36-canvas-iframe-virtualization)
   - 3.7 [IPC delta protocol](#37-ipc-delta-protocol)
   - 3.8 [Cache-first startup](#38-cache-first-startup)
   - 3.9 [Non-blocking session boot](#39-non-blocking-session-boot)
   - 3.10 [Bundle + binary trim](#310-bundle--binary-trim)
   - 3.11 [SQLite windowed view](#311-sqlite-windowed-view)
4. [Parallel tracks](#4-parallel-tracks)
   - 4.A [Cursor translator (thinking + tool calls)](#4a-cursor-translator-thinking--tool-calls)
   - 4.B [~~Codex API-key auth~~ — REMOVED](#4b-codex-api-key-auth--removed)
   - 4.C [HMR Fast Refresh recovery](#4c-hmr-fast-refresh-recovery)
5. [Audit summary — what's solid, what's still risky](#5-audit-summary--whats-solid-whats-still-risky)
6. [Suggested order](#6-suggested-order)
7. [End-state vision](#7-end-state-vision)
8. [References](#8-references)

---

## 1. Where we are

Phase 0 set the foundation: renderer registry, per-chat Zustand slices, rAF coalescing, SQLite persistence. The chat path is now extensible (new tool renderers land as new files plus a single registry entry), sliced (adding a 10th chat or a design overlay doesn't multiply chat-side render cost), persistent (SQLite is the source of truth; hydrates last 200 messages on chat open), coalesced (bridge events flush at most once per animation frame), and diagnosable (engine logs forward into `main.log`; dispatch / spawn / exit logging means future "no response" bugs surface in seconds).

What this **doesn't** yet give us — and what this rev addresses:

- **No purpose-built UI for non-design tool calls.** Bash, Edit, Read, Grep, Glob, WebFetch, TodoWrite, Task — all fall through to the generic `ToolCard`. The renderer registry's `toolByKind` table is empty (`src/zeros/agent/renderers/registry.ts:43`). Phase 1 fills it.
- **No unification across agents.** Today the Codex error path, the Cursor "no thinking" gap, and Claude's rich tool surface all render through the same generic card with no agent-aware shape. Phase 1 introduces a canonical event taxonomy + adapter normalizers so every agent's output flows into the same set of cards.
- **No long-run UX affordances.** Scroll behaviour is `scrollTop = scrollHeight` on every change (`src/zeros/agent/agent-chat.tsx:296-301`). After a 30-min Claude run with hundreds of tool calls + thinking blocks, the user has lost their original prompt and can't navigate back to it. Phase 1 ships the full long-run UX kit (sticky-bottom with unstick-on-user-scroll, per-turn sticky user prompt, jump-by-text-message keybind, run-summary roll-up, vertical timeline rail, etc.).
- **No virtualization.** 1000-message chats still mount 1000 DOM nodes. Same problem on the design canvas — every variant `<iframe>` stays mounted (`src/zeros/canvas/variant-canvas.tsx`). Phase 2 fixes both.
- **Workspace state is a single 23-field React Context reducer.** `src/zeros/store/store.tsx` holds `elements`, `variants`, `themes`, `chats`, inspector mode, and 18 more fields in one `useReducer` whose dispatcher broadcasts every change to every consumer. Cross-chat / cross-canvas / cross-inspector re-render cascade is the canvas-side equivalent of the bug Phase 0 just fixed for chat. Phase 2 migrates it to Zustand slices.
- **Engine sidecar is Node.js in both dev and prod.** The previous draft of this roadmap (and the 360-audit document) said "Node in prod, Bun in dev" — this is incorrect. `package.json` shows `"serve:engine": "node dist-engine/cli.js"`, the build is `node scripts/build-sidecar.mjs`, and tsup compiles to Node-targeted output. Phase 2 makes a deliberate runtime decision rather than drifting.
- **All IPC is full-state.** SET_ELEMENTS dispatches the entire `ElementNode[]` tree on every selection or DOM change. The bridge has no delta protocol. Phase 2 adds one.
- **Bundle is 1.38 MB / 367 KB gzipped, binary is full Electron + Chromium.** Phase 2 audits and trims.

Phase 1 closes the visible-UX gap. Phase 2 scales it and rebuilds the surrounding architecture for the next 12 months of features without re-running Phase 0's pain.

---

## 2. Phase 1 — Unified Conductor-quality experience

**Goal:** every CLI agent — Claude Code, Codex, Cursor, Gemini, Copilot, Amp, Droid, plus any agent we add later — produces a chat that looks and feels identical at the chrome level. Same Bash card, same Edit card, same Read card, same Thinking block, same Plan panel, same scroll behaviour, same prompt-pinning, same run summary. Per-agent quirks stay inside the adapter, never inside the renderer. The user can switch from Claude to Codex mid-project and notice no UI shift — only a model change.

**Estimated scope:** ~2 weeks. The work splits cleanly into the canonical event taxonomy (~3 days), the adapter normalizers (~3 days, can parallelize per agent), the card system (~4 days, parallelizable per card), the long-run UX kit (~3 days), and inline permissions (~1 day). With two of us shipping cards in parallel, ~10 working days.

### 2.1 Why "unified" is the through-line

The user was emphatic on this point: every agent should render through the same UI. A bash command from Codex should look identical to a bash command from Claude. A read from Cursor should look identical to a read from Gemini. A subagent from Amp should look identical to a Task from Claude. New agents added later inherit the renderers for free.

The reason this isn't trivial is that the eight CLIs we support emit eight different shapes:

- **Claude Code** wraps Anthropic's streaming API events: `content_block_start` / `content_block_delta` (with `text_delta`, `thinking_delta`, `input_json_delta` subtypes) / `content_block_stop` / `message_delta` / `message_stop` plus `system`, `assistant`, `user`, `result` envelope messages, with `parent_tool_use_id` linking subagent events. ([code.claude.com/docs/en/agent-sdk/streaming-output](https://code.claude.com/docs/en/agent-sdk/streaming-output))
- **Codex** uses item-types: `thread.started`, `turn.started`, `item.started`, `item.updated`, `item.completed`, `turn.completed`, `turn.failed`, with item subtypes `agent_message`, `reasoning`, `command_execution`, `file_change`, `mcp_tool_call`, `web_search`, `plan_update`. ([developers.openai.com/codex/noninteractive](https://developers.openai.com/codex/noninteractive))
- **Cursor** emits `system` (init), `user`, `assistant` (one chunk per turn — no token streaming), `tool_call` (with `subtype: "started" | "completed"`), `result`. **Thinking is explicitly suppressed in print mode.** ([cursor.com/docs/cli/reference/output-format](https://cursor.com/docs/cli/reference/output-format))
- **Gemini** emits `init`, `message`, `tool_use`, `tool_result`, `error`, `result`. Thinking surface is undocumented. ([geminicli.com/docs/cli/headless](https://geminicli.com/docs/cli/headless/))
- **Copilot** is the structural odd-one-out among the stream-json crowd: it uses bidirectional **JSON-RPC over stdio** via the Agent Client Protocol (`copilot --acp`). Notifications come through `session/update` with variants `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `plan`. Tool calls have a real `tool_call_update` mid-flight progress event that nobody else has. ([github.blog/changelog/2026-01-28-acp-support-in-copilot-cli-is-now-in-public-preview](https://github.blog/changelog/2026-01-28-acp-support-in-copilot-cli-is-now-in-public-preview/))
- **Amp** mirrors Claude's shape (`system`, `user`, `assistant`, `result`) with `--stream-json-thinking` to expose `thinking` / `redacted_thinking` content blocks. ([ampcode.com/manual](https://ampcode.com/manual))
- **Droid** emits `system`, `message`, `tool_call`, `tool_result`, `assistant_chunk`, `completion`, `exit`. Thinking surface is undocumented. ([docs.factory.ai/guides/building/droid-exec-tutorial](https://docs.factory.ai/guides/building/droid-exec-tutorial))
- **OpenCode** is the most architecturally different of the eight: it's **server-first**. The CLI binary boots an HTTP server (`opencode serve`) that exposes an OpenAPI 3.1 surface plus an SSE event bus. The official `@opencode-ai/sdk` is the canonical client. Bus events: `message.updated`, `message.part.updated`, `message.part.delta` (token streaming), `permission.asked`/`replied`, `question.asked`/`replied`, `session.status`, `session.compacted`, `session.error`, `mcp.tools.changed`. The narrower `opencode run --format json` (NDJSON to stdout) is a subset for one-shot use; we use `serve` to get the full vocabulary. ([opencode.ai/docs/server](https://opencode.ai/docs/server/), [opencode.ai/docs/sdk](https://opencode.ai/docs/sdk/), [github.com/sst/opencode](https://github.com/sst/opencode))

The unification strategy is the standard one: a canonical event vocabulary in the middle, with adapter-side normalizers that translate native events into the canonical set, and renderers that consume only canonical events. We already have the rough shape of this (the renderer registry resolves by message kind), but the message kinds today are bound to the ACP-ish subset Claude/Amp emit. Phase 1 generalizes the kind system.

**DPCode validates the architecture.** [Emanuele-web04/dpcode](https://github.com/Emanuele-web04/dpcode) is an MIT-licensed Electron-based agentic-coding IDE that has already integrated four of our eight agents (Claude, Codex, Gemini, OpenCode) using exactly this adapter pattern. They prove a single `ProviderAdapterShape<TError>` interface (with declarative `capabilities` struct) handles four wildly different transports: Claude via the official Node SDK, Codex via JSON-RPC over stdio (`codex app-server`), Gemini via PTY+ACP, OpenCode via HTTP+SSE through the SDK. Their canonical event vocabulary (~44 events) is more granular than our v1 taxonomy and is documented in [§2.10 (Adapter contract refinements)](#210-adapter-contract-refinements-from-dpcode-research) below — patterns we adopt and patterns we deliberately don't. Anti-pattern they don't recommend either: their renderer is a 2,127-line monolithic timeline, which is what we're explicitly avoiding with the renderer registry.

### 2.2 The canonical event taxonomy

Every adapter emits — and every renderer consumes — events drawn from this set:

| Canonical event | Required fields | Optional fields | Notes |
|---|---|---|---|
| `session.start` | `session_id, agent, model, cwd` | `tools[], capabilities[]` | One per run. Drives the chat header. |
| `text.chunk` | `message_id, role, text` | — | Streaming assistant text token/segment. |
| `text.complete` | `message_id, role, text` | — | Finalized text. For agents that don't token-stream (Cursor), each `assistant` event becomes both chunks and complete in the same payload. |
| `thinking.chunk` | `message_id, text` | — | Streaming reasoning. Optional per agent. |
| `thinking.redacted` | `message_id` | — | Encrypted thinking block (Amp/Claude). |
| `tool.start` | `tool_id, name, input` | `parent_tool_id, kind, mergeKey` | Tool invocation begins. `kind` is the canonical category (see §2.3). `mergeKey` (see §2.5) lets the renderer collapse repeated calls. |
| `tool.input_chunk` | `tool_id, partial_json` | — | Streaming tool-arg JSON. Claude/Amp only. Renderers ignore if absent. |
| `tool.progress` | `tool_id, status` | `partial_output` | Mid-flight update. Native only on ACP (Copilot) and Codex (`item.updated`). |
| `tool.end` | `tool_id, status, output` | `error, truncated, exit_code, duration_ms` | Tool finished. `status` is `completed` or `failed`. |
| `plan.update` | `items[]` | `replace: bool` | Plan/todo board mutated. `replace=true` overwrites; `false` patches by item id. |
| `subagent.start` | `subagent_id, parent_tool_id, description` | `agent` | Task delegation. Claude/Amp only. |
| `subagent.end` | `subagent_id, summary` | — | Subagent finished. |
| `error` | `severity, message` | `recoverable, code` | Non-fatal warning or fatal failure. |
| `usage` | — | `in_tokens, out_tokens, cache_read, cache_write, reasoning_tokens, cost_usd` | Per-turn or final. Adapters fill what they have; the badge renders only present fields. |
| `permission.request` | `request_id, tool_id, scope, risk` | `description, diff` | Inline permission prompt. |
| `permission.decision` | `request_id, decision, sticky_for?` | — | User answered. |
| `clarifying_question` | `message_id, prompt` | `choices[], input_type` | Distinct from regular text — renders as a form. |
| `session.end` | `status, duration_ms, num_turns` | `stop_reason, permission_denials` | Terminal event. |

This vocabulary covers every observed event across the eight CLIs. Some agents emit a strict subset (Cursor never emits `thinking.chunk`; Droid never emits `subagent.*`; OpenCode in `run --format json` mode skips `tool.input_chunk` and `tool.progress` even though its server bus has them); the renderers handle absence gracefully — a missing thinking block is invisible, not stubbed. This is critical for the user's "unified UI" requirement: the *contract* is unified even when an agent doesn't fill every field.

**Two refinements adopted from DPCode** (see §2.10):
- Every canonical event carries an optional **`raw: { source, payload }`** field — the original native event verbatim. Free "view raw" debug capability; zero translator complexity.
- Every canonical event carries an optional **`providerRefs`** struct — `{ providerThreadId?, providerTurnId?, providerItemId?, providerRequestId?, providerParentThreadId?, parentProviderTurnId? }`. Lets us grep server logs by either canonical or native ID without the translator throwing detail away.

### 2.3 Adapter normalizers — where agent dialects collapse

Each adapter under [src/engine/agents/adapters/](../src/engine/agents/adapters/) gets a `Normalizer` module that consumes the agent's native stream and emits canonical events. The shared work that Phase 0's `stream-json-adapter` already does (line buffering, JSON parse, fail-loud on missing terminal events) becomes the substrate; the per-agent translator becomes a normalizer.

The hard part is the **canonical tool kind**. Every agent has its own tool names (`Bash` vs `shell` vs `run_shell_command` vs `Execute`), and some agents express what other agents call distinct tools as flavors of one tool (Codex routes Read/Grep through `shell`). The mapping table lives in the adapter and is the contract:

| Canonical kind | Claude tools | Codex items | Cursor tools | Gemini tools | Amp tools | Droid tools | OpenCode tools |
|---|---|---|---|---|---|---|---|
| `shell` | `Bash` | `command_execution` | `shellToolCall` | `run_shell_command` | `Bash` | `Execute` | `bash` |
| `read` | `Read` | (via shell `cat`) | `readToolCall` | `read_file`, `read_many_files` | `Read` | `Read` | `read` |
| `edit` | `Edit`, `MultiEdit`, `Write` | `file_change` (apply_patch) | `editToolCall`, `writeToolCall` | `replace`, `write_file` | `Edit` | `ApplyPatch` | `edit`, `write`, `apply_patch` (GPT-5/Codex models) |
| `search` | `Grep`, `Glob` | (via shell `rg`/`find`) | `grepToolCall`, `globToolCall` | `grep_search`, `glob`, `list_directory` | `Grep` (+ Glob) | (via shell) | `grep`, `glob`, `codesearch` (Zen-gated) |
| `fetch` | `WebFetch` | `web_search` (live mode) | — | `web_fetch` | web browsing | — | `webfetch` |
| `web_search` | `WebSearch` | `web_search` | — | `google_web_search` | — | — | `websearch` (Exa or Zen gated) |
| `todo` | `TodoWrite` | `plan_update` | `todoToolCall`, `updateTodosToolCall` | `write_todos` | `TodoWrite` | — | `todowrite` |
| `subagent` | `Task` (renamed `Agent` v2.1.63) | — | — | — | `Task` | `Task` (`subagent_type:`) | `task` (`subagent_type:` general/explore/custom) |
| `mcp` | (any MCP tool) | `mcp_tool_call` | (any MCP tool) | (any MCP tool) | (any MCP tool) | (any MCP tool) | (any MCP tool) |
| `skill` | (slash-command expansion) | (slash-command expansion) | — | `activate_skill` | (skills loaded inline) | — | `skill` (loads `SKILL.md` content into context) |
| `other` | (anything else) | (anything else) | (anything else) | (anything else) | (anything else) | (anything else) | `lsp`, `plan`, `question`, `invalid` (also: any plugin tool) |

Crucial decision: **for Codex and Droid, we do *not* try to upgrade `shell cat foo.ts` into a `read` card.** That would mean parsing shell strings in the adapter, which fails the moment the user pipes (`cat foo.ts | head -20`) or quotes (`grep "foo bar" file`) or chains (`cat foo && echo done`). The adapter renders those as `shell` cards and trusts the user to read the command. Across-agent unification means *the same canonical kind renders identically*; it does not mean *every agent emits every kind*.

**OpenCode-specific note:** OpenCode auto-swaps the `edit`+`write` tools for `apply_patch` when the model is GPT-5 / Codex-class (registry.ts pattern in their source). The translator must handle both — both produce file edits, the canonical `edit` card renders both via the patch-mode path. The `codesearch` / `websearch` tools are gated behind `OPENCODE_ENABLE_EXA=1` or use of the OpenCode Zen provider; if neither is configured the tools simply don't appear in the model's tool list (they're not errors).

Adapters live at:

- [src/engine/agents/adapters/claude/normalizer.ts](../src/engine/agents/adapters/claude/normalizer.ts) (new) — wraps `ClaudeStreamTranslator`
- [src/engine/agents/adapters/codex/normalizer.ts](../src/engine/agents/adapters/codex/normalizer.ts) (new) — wraps `CodexTranslator`
- [src/engine/agents/adapters/cursor/normalizer.ts](../src/engine/agents/adapters/cursor/normalizer.ts) (new) — wraps Cursor stream-json (also fixes Track A)
- [src/engine/agents/adapters/gemini/normalizer.ts](../src/engine/agents/adapters/gemini/normalizer.ts) (new) — for Gemini headless
- [src/engine/agents/adapters/copilot/normalizer.ts](../src/engine/agents/adapters/copilot/normalizer.ts) (new) — bridges ACP JSON-RPC notifications
- [src/engine/agents/adapters/amp/normalizer.ts](../src/engine/agents/adapters/amp/normalizer.ts) (new)
- [src/engine/agents/adapters/droid/normalizer.ts](../src/engine/agents/adapters/droid/normalizer.ts) (new)
- [src/engine/agents/adapters/opencode/normalizer.ts](../src/engine/agents/adapters/opencode/normalizer.ts) (new) — server-attached: spawns `opencode serve --port <random>`, attaches `@opencode-ai/sdk`, consumes SSE bus events. See §2.10 for the spawn pattern + DPCode-validated config-neutering trick.

The shared canonical event types live at [src/engine/agents/canonical.ts](../src/engine/agents/canonical.ts) (new). The renderer-side `AgentMessage` discriminated union (today defined inline in `agent-chat.tsx`) moves into [src/zeros/agent/canonical-message.ts](../src/zeros/agent/canonical-message.ts) (new) so renderers and engine share the type.

A note on the ACP/Copilot transport: it is bidirectional and request/response-shaped, while the others are unidirectional NDJSON. The Copilot normalizer bridges by translating `session/update` notifications into canonical events and stashing the request-id correlation so cancel + permission flows work. This is structurally the same work the existing ACP code does today, just fed back through the canonical pipeline.

### 2.4 The unified card system

Each card is a self-contained file under [src/zeros/agent/renderers/](../src/zeros/agent/renderers/). Each registers in [registry.ts](../src/zeros/agent/renderers/registry.ts) under the canonical `kind` (and optionally a sub-matcher for cases where `kind=mcp` needs per-server rendering). They land independently — work parallelizes.

The visual contract (Conductor / Cursor / Zed convergence — see [§8](#8-references) for sources):

- **Default-collapsed.** Successful completed cards collapse to a one-line summary `[icon] tool_name target … status (duration)`. Click to expand the full args + output. Cards in `failed` state stay expanded. Cards in `pending` / `in_progress` are partially expanded (header + streaming output).
- **Unified header.** Every card has the same chrome: `[kind icon] [agent badge — only on switch] [title] [status badge] [duration]`. Per-tool styling lives **inside** the body, not in the chrome.
- **Streaming-aware.** Cards that receive `tool.input_chunk` show input building up; cards that receive `tool.progress` show output filling in.
- **State-merging where applicable.** TodoWrite, file edits to the same file, and successive search hits all carry a `mergeKey` that tells the renderer "render only the latest payload of this group as the canonical card; collapse predecessors into a tiny `Updated · 12s ago` chevron under it." This is the single biggest compactness win Claude Code uses today and it generalizes cleanly. (Source: [github.com/anthropics/claude-code/issues/1173](https://github.com/anthropics/claude-code/issues/1173) — TodoWrite-as-single-block.)

#### 2.4.1 Shell card — `tool-shell.tsx`

**Why:** every agent runs shell. It's the highest-volume tool by far on a long Claude run.

**What renders:**
- Command line in monospace, syntax-highlighted as `bash`
- Status badge (`pending` → `running` → `completed`/`failed`)
- `cwd` chip (only when ≠ project root)
- Streaming output area; uses the **xterm.js DOM renderer** (already in deps; this is what Conductor 0.49 switched to). One xterm instance per shell card, mounted on first output, disposed on collapse.
- ANSI colors / cursor codes / progress bars render correctly
- Exit code with color (0 = success border-left green, ≠0 = red)
- Duration on completion
- Expand/collapse via header click; collapsed shows last line of output as preview
- Long output (> 5000 lines): show "Show all 5000 lines" button instead of mounting xterm; mount on click

**Streaming:** Bash output streams via `tool.progress` (Codex `item.updated`, ACP `tool_call_update`) where available; for agents that don't stream (Claude, Amp), output appears in a single chunk on `tool.end`. UI handles both — the streaming dots transition to "completed in 12.3s" cleanly.

#### 2.4.2 Edit / Write card — `tool-edit.tsx`

**Why:** code edits are the most-impactful tool calls. A diff view is the difference between "I trust this agent" and "I have no idea what just happened."

**What renders:**
- File path (clickable; opens in OS default editor — later, embedded source view)
- Inline unified diff with syntax highlighting
- Line counts (`+N / −M`) and per-hunk context
- Width-adaptive layout: side-by-side ≥800px panel width, stacked otherwise (OpenCode pattern)
- "Open file" / "Revert" / "Stage in git" affordances on hover
- Status badge same as Shell

**Two render modes (driven by adapter, not by agent):**
- **Patch mode** (Codex `apply_patch`, Droid `ApplyPatch`): the adapter feeds the unified diff directly; renderer parses + highlights.
- **Replacement mode** (Claude `Edit` / `Write`, Cursor `editToolCall`, Gemini `replace` / `write_file`, Amp `Edit`): the adapter feeds `before` + `after` strings (or, for Write, `null` + `after`); renderer computes a diff with the [`diff`](https://www.npmjs.com/package/diff) package (~5KB).

**Merge:** consecutive edits to the same file share `mergeKey: "edit:<path>"`. The renderer collapses N edits into one cumulative diff, with a `+N more changes` chevron underneath that expands to per-edit history.

**Highlighting:** via **react-shiki in Worker mode** (Phase 2.3). Phase 1 ships with main-thread shiki to avoid blocking on Phase 2; the worker swap is a one-liner once 2.3 lands.

#### 2.4.3 Read card — `tool-read.tsx`

- File path + line range (`lines 1-200 of 4520`)
- Collapsed preview (first ~10 lines + "Show all" expand)
- Syntax-highlighted via the same shared shiki worker
- For agents that don't expose Read (Codex, Droid), `cat foo.ts` invocations render as Shell cards — see §2.3.

#### 2.4.4 Search card — `tool-search.tsx`

- Query / pattern at the top
- Match list grouped by file: `path:line  matched-text` (highlighted match)
- Match count badge
- Each match clickable (jumps to file:line — later)
- Empty result state: "0 matches"
- For agents that route search through shell (Codex, Droid), invocations of `rg` / `grep` / `find` render as Shell cards

#### 2.4.5 Fetch card — `tool-fetch.tsx`

Two sub-modes selected by canonical `kind`:

- `fetch` — URL, response status code, content-type, collapsible body preview
- `web_search` — query string, top 3-5 hits with title + URL + snippet, click to open

#### 2.4.6 Plan / Todo panel — `plan-panel.tsx`

**Why:** Claude's `TodoWrite`, Codex's `plan_update`, Cursor's `todoToolCall`/`updateTodosToolCall`, Gemini's `write_todos`, Copilot's ACP `plan` notification, and Amp's TodoWrite all serve the same UI role: a live updating checklist that represents the agent's current intent. Five different protocol shapes, one component.

**Behaviour:**
- Canonical `plan.update` events drive a single live block per turn
- Items: `pending` (○), `in_progress` (⋯ animated), `completed` (✓ strikethrough), `cancelled` (✗ dim)
- Three mutation modes: `replace` (full overwrite), `patch` (by item id), `append` — driven by the adapter
- Renders pinned at the top of the active turn (see §2.5 — prompt pin), collapsing to one-line summary `Plan · 4/12 done` when the user scrolls below it
- Distinct visual style from the existing collapsed `PlanPanel` — this is per-turn, that one was per-session
- Existing session-level plan in `session.plan` (today rendered by `PlanPanel` above the message list) becomes the canonical surface; tool-level TodoWrite/plan_update calls feed it

**The cross-agent unification here is the single highest-leverage thing in Phase 1.** Today five agents emit five different shapes, and we render them as five differently-rendered tool cards. After Phase 1, all five drive the same Plan panel.

#### 2.4.7 Subagent card — `tool-subagent.tsx`

**Why:** Claude `Task` and Amp `Task` are the only subagent surfaces. When a parent agent delegates, the user wants a clear nested view.

**What renders:**
- Subagent name + task description as the card header
- Status badge for the overall subagent task (pending → running → completed)
- Nested transcript indented with a left border accent
- Collapsed by default (default-collapsed rule); click to expand
- The nested transcript uses the same renderer registry recursively — every event with `parent_tool_id == this.tool_id` renders as a child
- For runs with > 50 nested events: show only the latest 20, with "X earlier nested events" chevron (the same accordion the long-run kit uses — see §2.5)

#### 2.4.8 Thinking block — `thinking-block.tsx`

**Why:** distinguish reasoning from output, give the user a way to scan past it without reading.

**Behaviour:**
- While streaming: one-line shimmer `∴ Thinking… 12s` (Claude Code pattern — see [blog.alexbeals.com/posts/claude-codes-thinking-animation](https://blog.alexbeals.com/posts/claude-codes-thinking-animation))
- On `content_block_stop` for thinking: collapses to `[Thinking · 412 tok · 12s ▾]` chevron
- Click expands to full reasoning text; dim italic typography
- `Cmd+Shift+T` toggles all thinking blocks in the session (Claude Code VS Code panel pattern — [github.com/anthropics/claude-code/issues/36006](https://github.com/anthropics/claude-code/issues/36006))
- For agents that don't expose thinking (Cursor in headless, Gemini, Droid as of April 2026): no card. Not a stub. The user just sees text without thinking — same posture every other product takes.
- For Amp's `redacted_thinking`: collapsed badge `[Thinking · redacted · 412 tok]`, no expand

#### 2.4.9 Clarifying question card — `question-card.tsx`

**Why:** every agent eventually needs to ask the user something — "which framework?", "delete or rename?", "approve this approach?". Today these come through as plain assistant text and the user has no signal that a reply is expected. We need a distinct visual primitive.

**Two paths — both must work**:

**Native blocking questions (Claude `AskUserQuestion`, Gemini `ask_user`):**
- The agent emits a `tool_use` whose name is the question tool. Payload is structured: `questions[]` each with `question`, `header` (≤16 chars), `inputType: choice|multi_choice|text|yesno`, `options[{label, description, preview?}]`, `multiSelect`. ([Claude AskUserQuestion docs](https://code.claude.com/docs/en/agent-sdk/user-input), [Gemini ask_user docs](https://geminicli.com/docs/tools/ask-user/))
- The agent **process is blocked** awaiting reply.
- The renderer shows: header + question + radio buttons (single choice) or checkboxes (multi-choice) or a text input, plus a submit button.
- On submit: the adapter routes the answer back as a `tool_result` (Claude/Gemini reply protocol), unblocking the agent. The agent continues from where it stopped.
- Multiple questions in one call render as a stacked form, single submit at the bottom.

**Inferred non-blocking questions (Codex, Cursor, Copilot, Amp, Droid):**
- These agents have no native question event — they emit assistant text and end the turn. The agent process is not blocked; control returns to us.
- Detect via heuristic: `turn.completed` arrived, last assistant text ends with `?` or contains an option list (`1)... 2)... 3)...`), no further tool calls scheduled.
- Render the same question card UI, but on submit it sends a normal next-turn user prompt (not a tool reply).
- Visual difference: a small "the agent will respond with your answer" hint instead of "the agent is waiting" — so the user knows the reply is going as a new turn.
- Conservative: only auto-elevate to question card when the heuristic is confident; otherwise the text renders as regular assistant text and the user can just type a reply normally.

**Reply protocol per agent:**

| Agent | Mechanism | Reply channel |
|---|---|---|
| Claude Code | `tool_use{name:"AskUserQuestion"}` | `tool_result` with `{questions, answers: {<question text>: <label>}}` |
| Gemini CLI | `tool_use{name:"ask_user"}` | `tool_result` with `{answers: {"0": "...", "1": "..."}}` |
| Codex | Inferred from text + `turn.completed` | New `session.prompt` next turn |
| Cursor | Inferred from text + `result` | New session prompt |
| Copilot ACP | Inferred from `agent_message_chunk` | New `session/prompt` JSON-RPC call |
| Amp | Inferred from `assistant` + `result` | New JSON line via `--stream-json-input` |
| Droid | Inferred from `message` + `completion` | New JSONL via `--input-format stream-jsonrpc` |

**Constraints to remember:**
- Claude subagents (`Task` tool) **cannot** call `AskUserQuestion`. If a subagent has a question, it must surface to the parent. The renderer should not show question cards inside subagent traces.
- Copilot ACP has a bug ([github.com/github/copilot-cli#845](https://github.com/github/copilot-cli/issues/845)) where it auto-approves tool calls and never sends `session/request_permission`. Until fixed, even tool-permission requests come through as text — we treat them all as inferred questions.
- Gemini headless behaviour for `ask_user` is undocumented; verify against live CLI whether the tool fires before being filtered. Worst case it's silenced and we never see the event — same fallback as the inferred path.

#### 2.4.10 Error card — `error-card.tsx`

For canonical `error` events and for the existing `session.error` state. Tinted card with retry / dismiss / "view details" affordances. Replaces today's plain-text `⚠ Codex error: …` rendering.

#### 2.4.11 Usage badge — extend existing

Already wired in `session.usage`. Phase 1 makes it canonical-event driven and adds:
- Per-turn usage chip on the run summary (see §2.5)
- Cumulative tokens / cost in the chat header
- Cost calculation when adapter provides per-token pricing (Phase 2 polish)

**Bug carryover from Stage 3 testing — fixed in Stage 5.2:**
Display used to read `Window 291.4k / 200.0k · 100%` after just three Claude prompts because two things were wrong:
1. **Hardcoded 200k window for all Claude variants** — fixed in [`claude/translator.ts`](../src/engine/agents/adapters/claude/translator.ts) by capturing `model` from the `system.init` event and routing through `contextWindowForClaudeModel(model)` — 1M for `opus-4-7[1m]`, 200k for the rest of the 4.x / 3.x family.
2. **`used / window · %` was the wrong ratio** — `result.usage` reports tokens billed across the turn's tool-use loop (Claude makes multiple internal API calls per prompt), not current window fill. ContextPill UI now drops the headline percentage; pill shows just the token count, popover shows "This turn: 291.4k · $0.04" with model context listed informationally.

`AgentUsage.costUsd` added so the popover can surface per-turn cost when the adapter reports it (Claude `result.total_cost_usd`).

#### 2.4.12 MCP card — `tool-mcp.tsx`

Generic card for any tool with `kind: "mcp"`. Header: `<server>.<tool>`, body: collapsible JSON for arguments + result. Goose-style: when the result is a `ui` content payload (rich MCP-UI components), render as the embedded widget instead of JSON. (Source: [github.com/block/goose](https://github.com/block/goose).)

#### 2.4.13 Mode controls + auto-switch banner

**Why:** every agent has some concept of "mode" — Plan / Execute / Ask, Manual / AcceptEdits / Auto / Bypass, and (for Amp) a capability tier. Some agents (Gemini, Claude in part) can switch modes autonomously mid-run. Today we have no UI for any of this; the user can't tell what mode an agent is in or when it switched.

**Three orthogonal axes** — researched across all 7 agents ([code.claude.com/docs/en/permission-modes](https://code.claude.com/docs/en/permission-modes), [geminicli.com/docs/reference/tools](https://geminicli.com/docs/reference/tools/), [cursor.com/changelog/cli-jan-16-2026](https://cursor.com/changelog/cli-jan-16-2026), [agentclientprotocol.com/protocol/session-modes](https://agentclientprotocol.com/protocol/session-modes), [docs.factory.ai/reference/cli-reference](https://docs.factory.ai/reference/cli-reference)):

**Axis A — Phase** (what the agent is *doing*):
- `explore` — read-only exploration (Cursor "ask")
- `plan` — research and propose, no edits (Claude `plan`, Gemini plan, Cursor plan, Copilot plan, Droid `--use-spec`)
- `execute` — full agent (default)

**Axis B — Permission** (what the agent is *allowed* to do):
- `manual` — ask each time (Claude `default`)
- `accept-edits` — auto-approve safe writes, prompt risky (Claude `acceptEdits`)
- `auto` — classifier-gated (Claude `auto` only)
- `bypass` — yolo (Claude `bypassPermissions`, Codex `--yolo`, Droid `--skip-permissions-unsafe`)
- `pre-approved-only` — CI-style lockdown (Claude `dontAsk`)

**Axis C — Capability tier** (Amp-only):
- `smart` (default), `rush` (fast/cheap), `deep` / `deep^2` / `deep^3` (extended reasoning)

**Where mode events surface in the stream:**

| Agent | Init event carries mode? | Mid-stream switch event |
|---|---|---|
| Claude Code | `system.permissionMode` | `tool_use{name:"ExitPlanMode"}` followed by permission_request — auto-EXIT only (user must auto-ENTER) |
| Codex | None (set at process start) | None — no phase concept; only `update_plan` (which is a todo, not a mode) |
| Cursor | `system.permissionMode` | None documented (mode is set at startup or via slash command) |
| Gemini CLI | ACP `availableModes` | `enter_plan_mode` / `exit_plan_mode` tool calls — **true autonomous switching** |
| Copilot ACP | ACP `availableModes` | `session/update.current_mode_update` notification |
| Amp | None formal | None — `smart`/`rush`/`deep` set at startup |
| Droid | Uncertain | Uncertain — verify against live CLI |

**Renderer surfaces:**

1. **Mode pill in the composer footer** — extends the existing `PermissionsPill`. Shows `[Phase] / [Permission]` (e.g. `Plan · Manual` or `Execute · AcceptEdits`). For Amp, shows tier instead. Click to change. Only enabled axes for the current agent are shown — Codex sees only the permission axis, Amp sees only the tier.

2. **Auto-switch banner inside the timeline** — when the agent switches modes autonomously (Gemini's `enter_plan_mode`, Claude's `ExitPlanMode`, ACP `current_mode_update` for Copilot), insert a banner row in the active turn:

   ```
   ─── Switched to Plan mode ──────────────── 14:32:18 ───
   ```

   The banner is its own renderer (`mode-switch-banner.tsx`) and registered for the canonical `mode.switch` event.

3. **`ExitPlanMode` permission card** — Claude's `ExitPlanMode` is a tool that asks the user to approve the proposed plan and pick the next mode (default / acceptEdits / auto). It's not a regular tool card; it's effectively a mode-switch permission prompt. Render as a special card variant of the inline permission system (§2.6) with the plan content quoted and three "switch to ..." buttons.

4. **Per-chat mode persistence** — selected phase / permission persists per chat in Zustand and SQLite. Switching back to a Plan-mode chat next session restores Plan mode in the composer, even though the underlying CLI process is fresh.

**Adapter responsibilities (added to §2.3):**

Each normalizer translates native mode events into a canonical `mode.switch` event:

```ts
type ModeSwitch = {
  kind: 'mode.switch';
  source: 'user' | 'agent';
  axis: 'phase' | 'permission' | 'tier';
  from: string;
  to: string;
  reason?: string;        // Claude ExitPlanMode plan content; Gemini's auto-entry rationale
  requiresApproval?: boolean;  // true for Claude ExitPlanMode
}
```

This is the single mechanism that handles all of "user toggled mode pill", "Claude is asking permission to exit plan mode", "Gemini decided to enter plan mode", and "Copilot's ACP `current_mode_update`" — same canonical event, different sources.

**Important constraints:**
- Codex doesn't have a phase axis. The mode pill hides the Phase control for Codex; only Permission shows.
- Amp has no formal phase axis either. Show only Tier.
- Copilot ACP has a known plan-mode leak bug ([github.com/github/copilot-cli#1543](https://github.com/github/copilot-cli/issues/1543)) — the agent sometimes exits plan mode and modifies code without permission. We can't fix this; surface it as an error if observed but don't break.

### 2.5 Long-run UX — scroll, prompt pinning, compactness

The user's specific worries:

> *Claude Code will think too long, take 30 minutes, do a lot of bash, write, review, WebSearch, MCP search. There will be a lot of thinking cards. The user has previously given some prompt — when the AI is working it auto-scrolls to the right, and the user has to scroll up too long to see their previous prompt.*

This is the single most important piece of Phase 1 and the part the original roadmap left untreated. The patterns below are drawn from Cursor 3.0, Claude Code (terminal + VS Code), Conductor 0.49, Zed Agent Panel, OpenCode, and T3 Chat — citations in [§8](#8-references).

#### 2.5.1 Per-turn structure as the unit of UX

Every event between two consecutive user prompts forms a **turn**. The renderer wraps each turn in a `<TurnContainer>` element. The active (in-flight) turn is a stateful container with the long-run affordances; a finalized turn collapses to a summary that can be expanded back to the full timeline.

```
[user prompt 1]          ← TurnContainer(closed)
  [run summary roll-up]    one-line "Edited 3 files (+14/−2), 2 commands, 1 m 4 s ▾"
[user prompt 2]          ← TurnContainer(closed)
  ...
[user prompt N — active] ← TurnContainer(open)
  [sticky prompt bar]      pins to viewport top while turn is in flight
  [plan panel]             pinned under the sticky prompt
  [tool cards / thinking / text — live]
  [activity HUD — at composer footer]
```

This per-turn anchoring is what solves the user's worry. The active turn's user prompt is sticky-positioned at the top of the viewport (`position: sticky; top: 0`); when a new turn starts (a new user prompt is sent), the previous turn finalizes and scrolls naturally with the rest of history. So the user always has visual access to "the prompt I just asked" without needing to scroll, and the sticky doesn't permanently eat real estate.

This is the *per-turn* version of the Claude Code VS Code panel pin behaviour ([github.com/anthropics/claude-code/issues/36146](https://github.com/anthropics/claude-code/issues/36146)) — Anthropic ships whole-thread pin and it's contentious because old prompts are irrelevant. Per-turn pin is the correct refinement.

If the active turn's prompt is more than 3 lines, the sticky version collapses to a single line `[You: Refactor the auth flow… ▾]`; click expands the full prompt as a popover.

#### 2.5.2 Sticky-bottom auto-scroll with unstick on user scroll

Replace the current `scrollTop = scrollHeight` reflex (`agent-chat.tsx:296-301`) with the standard well-behaved-chat pattern (OpenCode `ScrollBoxRenderable`, Cursor 3.0):

- Track `isAtBottom` with a 32px threshold.
- On every new chunk: only auto-scroll if `isAtBottom`.
- Any user wheel / touch / keyboard movement away unsets the flag.
- Reaching the bottom again re-sets it.

When unstuck, show two floating pills:
- **Bottom-right: "Jump to latest"** with a `+N new` count if streaming is happening above.
- **Top-right: "Jump to my prompt"** when the active turn's prompt is above the viewport — this is the fast path for the user's worry, even when sticky-prompt is collapsed.

Both pills fade away when stuck again.

**Counter-pattern to avoid:** ChatGPT's "smart" autoscroll that re-sticks while the user is mid-read is universally hated and has spawned a browser-extension ecosystem to disable it ([blog.promptlayer.com/how-to-stop-chatgpt-autoscroll](https://blog.promptlayer.com/how-to-stop-chatgpt-autoscroll/)). Once unstuck, stay unstuck.

#### 2.5.3 Default-collapsed cards + state-merging

(Spelled out in §2.4 — repeated here for the long-run angle.)

Default-collapsed tool cards mean a 30-min run with 200 tool calls is roughly 200 single-line entries instead of 200 fully-expanded panels. Combined with state-merging on TodoWrite/edit/search, the same 30-min run typically collapses to:

- 1 plan panel (live, self-mutating)
- ~30 single-line tool entries
- ~5 collapsed thinking chevrons
- 5-10 final assistant text blocks

That's a screen or two of vertical space for an entire 30-minute run, scrollable rather than a kilometre-tall wall.

#### 2.5.4 Vertical timeline rail (left gutter)

A 16px gutter on the left of each turn container. One coloured dot per tool call, one underscore per thinking block, status-coloured (pending grey, running blue spinner, success green, failed red). Hover shows a tooltip with the tool + duration; click scrolls that card into view.

This is the high-density skim affordance Conductor and Zed both use. Lets users skim 50 tool calls vertically without expanding any card.

Trade-off: requires fixed gutter; doesn't suit narrow panels under ~360px. Below that breakpoint we hide the rail and rely on the run-summary roll-up (§2.5.5) instead.

#### 2.5.5 Run-summary roll-up after turn ends

When a turn finalizes (new user prompt arrives or session ends), the per-turn container collapses to a one-line summary:

`Edited 12 files (+340/−80), ran 3 commands, called 4 web searches, 4 m 12 s ▾`

The full timeline is hidden behind the chevron. Click expands back to the full per-card stream.

Adapted from Zed's "files edited" accordion. It's the difference between "this chat has 47 turns and 1200 tool calls visible" and "this chat has 47 collapsible turn summaries."

#### 2.5.6 Long-turn windowing

Inside the active turn — even before it finalizes — long timelines get the accordion too. Render only the last K=20 chunks live; older chunks collapse into a `94 earlier steps ▾` expander. Critical for 30-minute Claude runs that emit 500+ chunks.

#### 2.5.7 Jump-by-text-message keybind

`Cmd+Up` / `Cmd+Down` walks **only** user prompts and final assistant text, skipping tool/thinking chunks. (OpenCode `Next/Previous Message` pattern.) Maps directly to the user's "where did I ask?" worry — a single keystroke jumps to the active turn's user prompt regardless of how many cards are between.

`Cmd+Home` / `Cmd+End` jump to thread start / end.

#### 2.5.8 Per-chat scroll memory

When the user swaps between parallel agent tabs in the sidebar, each chat restores its last scroll position rather than snapping to bottom. (Conductor 0.49 explicitly.) State is per-chat in the Zustand store, persisted to SQLite alongside chat metadata.

#### 2.5.9 Activity HUD pinned to composer footer

A persistent thin status strip at the composer footer shows:

`[agent avatar] [agent name] · Tool: bash · 2 m 14 s · 14 tool calls · [Stop]`

Visible whenever a turn is in flight, regardless of scroll position. Reuses the existing `ComposerStateChip` slot. This is the user's HUD even when scrolled away from the live content.

#### 2.5.10 Global stop button replaces send during run

Composer mode switches: **Send** (idle) / **Stop** (running) / **Continue** (paused). Removes the "where do I cancel" hunt. (Zed, OpenCode, Cursor pattern.)

#### 2.5.11 Streaming markdown

Past messages get `React.memo` keyed by `chunk.id + chunk.finalized`. Only the actively-streaming message re-parses markdown each chunk. (T3 Chat pattern — see [§8](#8-references).) This is the difference between "renders fine at 30 messages, jank at 100" and "renders fine at 1000+." Phase 1 ships chunked-markdown; Phase 2 swaps shiki to worker mode.

We use [`marked`](https://marked.js.org/) (already in deps) with a streaming-aware lexer; old messages serialize to HTML once and stay memoized.

#### 2.5.12 Counter-patterns to avoid

- **Whole-thread pin of the first user message.** What Anthropic ships (#36146) and what users complain about — the first prompt of a 200-turn project is irrelevant context. We pin **the active turn's** prompt, only while in flight.
- **Per-message animations.** Conductor 0.35.3 explicitly removed animations because of "high idle CPU usage." Reserve motion for state changes (a tool finishes, thinking starts), never ambient.
- **Re-rendering full markdown on every streaming token.** Default `react-markdown` does this; profile shows frame drops by ~30 messages.
- **Modal permission dialogs.** Anything that pulls focus from the timeline. Inline only — see §2.6.
- **One card per tool call with no collapsing.** Cline's strict approach makes long runs unusable. Default-collapsed.
- **Surfacing internal state (MCP/WebSocket/connection).** Per the existing `feedback_no_technical_ui.md` memory.
- **Heavy virtualization too early.** `react-virtuoso` is great but introduces measurement bugs with variable-height tool cards. Phase 1 uses `content-visibility: auto` + memoization. Phase 2.2 reaches for virtuoso when profiling proves the need at >500 messages.

### 2.6 Inline permissions with sticky decisions

Today the permission UI lives in `PermissionBar` between the message list and the composer. It's not modal but it is global — it sits in chrome rather than next to the tool call that triggered it.

Phase 1 moves permission to the tool card itself:

- The tool card's status is `permission_pending`; the card body shows: brief description, the diff (for apply_change), a button cluster: `Allow · Deny · Always for <tool> · Always for <scope> · Settings`.
- "Always for X" decisions persist to a per-chat policy (Zustand + SQLite). They don't cross chats by default; a Settings page lists every "Always for" decision so users can revoke.
- The existing global `PermissionBar` becomes a fallback for legacy non-card permission requests (auth modals, etc.).

Pattern source: Zed's inline permission cluster, Continue.dev's per-tool policies, Claude Code's permission modes.

This change is small (a few hundred lines) but high-impact: a long Claude run with 14 permission prompts feels totally different when each is a 2-second click in-context vs. 14 modal interrupts.

### 2.7 Agent-specific affordances (where unification breaks)

A few cases that don't unify cleanly and need agent-aware rendering inside the unified card:

1. **Plan vs todo mutation modes** — handled by the adapter (`replace` / `patch` / `append`); the renderer is unified.
2. **Thinking visibility** — handled by absence (no event = no card). The renderer is unified; per-agent gaps are silent.
3. **Tool-call progress** — only ACP (Copilot) and Codex (`item.updated`) have it. Renderer accepts patches when present, renders fine when absent.
4. **Patch-style vs replacement-style edits** — adapter normalizes; renderer chooses mode based on which fields are populated.
5. **Codex/Droid reading via shell** — falls through to Shell card (deliberate, not a fallback).
6. **Gemini's `enter_plan_mode` / `exit_plan_mode`** — these are tools on the wire but UX-wise they're a *mode banner* across the conversation. Adapter translates them into `session.start.capabilities` and a banner; not into tool cards.
7. **Gemini's `activate_skill`** — system-level chip, not a tool card.
8. **Amp's `Oracle`** — a delegated-reasoning tool that calls a different model. Render as a quoted reasoning card distinct from local thinking, with the model attribution.
9. **MCP UI payloads** — Goose-style, the result content can be a UI fragment; the MCP card renders that instead of JSON.
10. **Mode primitives differ across agents** — Codex has no phase; Amp has no phase; only Gemini does true model-initiated phase entry. The mode pill (§2.4.13) hides axes the agent doesn't expose. Same canonical mechanism, different visible controls.
11. **Cursor's "thinking-as-text" case** — Cursor's CLI in `--print` mode does not emit thinking events ([cursor.com/docs/cli/reference/output-format](https://cursor.com/docs/cli/reference/output-format)); any reasoning-style content arrives inside ordinary `assistant` text. The text renderer handles it transparently — no thinking chevron, just text. The user sees prose like *"I'll start by reading the file, then…"* exactly as the agent emitted it. No special handling needed; the absence of thinking events is itself the contract.
12. **OpenCode's `plan` is an agent, not a mode** — every other agent with a "plan" concept exposes it as a permission-mode flag (Claude `--permission-mode plan`) or as model-initiated tools (Gemini `enter_plan_mode`). OpenCode instead defines plan as a **primary agent** (built-in alongside `build`). Switching is `--agent plan` on `run`, or `Tab` in the TUI, or `default_agent` in `opencode.json`. Our mode pill (§2.4.13) maps a "Plan" UI selection to an `--agent plan` invocation when the active adapter is OpenCode; the canonical `mode.switch` event is still emitted so the timeline banner is unified.
13. **OpenCode's `question` tool is denied in headless `run` mode** — by design (run.ts installs a session permission rule denying the `question` permission entirely). Clarifying questions cannot fire in `opencode run`. **Workaround:** we use `opencode serve` + SDK as our integration path (not `run`), and the SSE bus exposes `question.asked` events that we render via the canonical question card (§2.4.9). The reply protocol routes through `POST /question/reply` on the server.
14. **OpenCode's `permission.asked` auto-rejects in `run` mode** unless `--dangerously-skip-permissions`. Server mode is interactive — the SSE bus emits `permission.asked` and we reply via `POST /permission/reply` with `"once" | "always" | "reject"`. This integrates cleanly with our inline permission cluster (§2.6) — same Allow/Deny/Always-for-X buttons, just routing through OpenCode's REST endpoint instead of injected hooks.
15. **OpenCode's `apply_patch` vs `edit`+`write` swap** for GPT-5/Codex-class models — see §2.3. Adapter normalizes both to canonical `edit`; renderer doesn't need to care.
16. **OpenCode's model selection is a `provider/model` slug** like `anthropic/claude-sonnet-4-5`, `openrouter/moonshot/kimi-k2`, `ollama/qwen3-coder`. We hydrate the model picker from `client.provider.list()` (or `opencode models <provider>` CLI fallback) at adapter init time. **This is OpenCode's killer feature for our cheap-alternative-models story** — Kimi K2 via OpenRouter, Qwen3 via local Ollama, GLM 4.5, etc.
17. **OpenCode's auth lives in `~/.local/share/opencode/auth.json`** (XDG data dir, mode 0600). We never read or write it — the user runs `opencode auth login <provider>` interactively in their own terminal, and our spawned subprocess inherits the file. Same posture as the other CLIs.
18. **OpenCode's session resume is offline-capable** — sessions live in SQLite at `~/.local/share/opencode/opencode.db`. `opencode --continue` (most recent root session) or `--session <id>` (specific) works without network. Cloud session sharing is opt-in via `--share`, not a default.

These are the only places agent identity surfaces in the renderer. Everywhere else, the rule is: same card, same chrome, regardless of which agent emitted it.

### 2.8 CLI vs API agent adapters (the parallel-adapter model)

**The architectural commitment:** the frontend never distinguishes between agents that run as a CLI subprocess (today's path) and agents that run as a direct API client (future). They are both adapters in the engine registry; both emit canonical events; the renderer is identical.

**Today's adapters all wrap CLIs.** The user's installed CLI is detected, its login state is probed (existence-only — we never read credentials), its `stream-json` (or PTY for Gemini/Copilot) output is consumed by a per-CLI translator, and that translator emits canonical `SessionUpdate` events into the bridge. The user's subscription / API-key auth lives entirely in the CLI's own config files and keychain entries.

**Future API adapters fit the same shape.** When (if) we add a `claude-api` adapter that talks to the Anthropic SDK directly:

- It registers in `AGENT_MANIFEST` with `id: "claude-api"`, parallel to the existing `claude` (CLI) entry.
- Its `createAdapter()` returns an `AgentAdapter` that, instead of spawning a subprocess, opens a streaming Anthropic API session.
- Its translator converts Anthropic streaming events (`content_block_delta` etc.) into the same canonical `SessionUpdate` shapes the Claude CLI translator already produces.
- Its `authMethods` advertise an env-var auth method requiring `ANTHROPIC_API_KEY` — the existing AuthModal renders it without modification.
- The renderer registry doesn't change. Tool cards, thinking blocks, plans, questions — all dispatch the same way.

**What this means for the user:** they may see two Claude entries in the agent picker (`Claude Code` from CLI + `Claude API` direct), each with its own auth flow + login state. Both produce identical chat output because both feed the same canonical event vocabulary.

**What it means architecturally:** the boundary between "CLI" and "API" lives entirely in `src/engine/agents/adapters/<agent>/`. Adding an API adapter is a self-contained operation — new spec, new translator, new registry entry. Zero changes to the bridge protocol, the canonical event types, or the renderer registry.

**Direct validation from the field.** The 360-degree analysis the user shared confirms this is exactly what every successful platform does:

> *"None of the analyzed tools attempt to handle this diversity in the frontend UI. Instead, they all implement an Adapter Pattern in their backend/sidecar."* (Comparing t3code's `ProviderAdapterShape`, opencode's `MessageV2` schema, Conductor's normalized event pipeline.)

> *"Whether the agent is Claude (API), Cursor (CLI), or OpenCode (CLI), the specific adapter is responsible for translating the agent's native output into a unified RuntimeEventRaw schema."* — t3code

We are explicitly building toward this convergence. Phase 1 Stage 1A defined the canonical event vocabulary (`src/zeros/bridge/agent-events.ts`). Phase 1 Stage 1A.8 declared the canonical message kinds. Future API adapters slot in without revisiting either.

**Today's scope:** CLI adapters only. The user's wording: *"in the future we may develop the API as well; in that case, what we will be doing? It is a question."* The answer is documented above; the implementation lives in a future phase. No code change to today's bridge / renderer is required to keep the door open — the canonical types already accommodate it.

**Practical guideline for now:** when an adapter has both a CLI and an API path available (Claude, Codex, Gemini), we choose the CLI today because:
- Auth is simpler (delegate to the CLI's own login flow; no key handling)
- Subscription billing is the user's existing relationship with the vendor
- The CLI keeps pace with vendor-specific features (e.g., Claude's MCP integration, Codex's sandboxing) without our needing to track them

We revisit when (a) a real user requests it, or (b) CLI rate limits / model availability cap usage in a way an API key would unlock.

### 2.9 Agent capability transparency — what passes through, what we add

This section captures the 2026-04-27 architecture discussion about whether wrapping a CLI breaks any of its native capabilities (memory, skills, subagents, MCP, project context, session resume). The short answer is **no, every CLI capability works transparently** because of how we spawn the subprocess. The long answer below documents which capabilities each agent has, where they live on disk, the gotchas (cloud-coupled session state on two agents, TUI-only capabilities we handle out-of-band), and the renderer-side affordances we add on top (project-context indicator, memory inspector).

#### 2.9.1 The architectural posture: we drive the CLI, we don't replace it

Verified at [src/engine/agents/adapters/base.ts:53](../src/engine/agents/adapters/base.ts#L53):

```ts
env: opts.env ? { ...process.env, ...opts.env } : process.env,
```

Every subprocess we spawn inherits the user's full environment (`HOME`, `PATH`, `XDG_CONFIG_HOME`, vendor env vars). We only **layer** per-agent env on top — never override. So when `claude -p "…"` runs inside our subprocess pipe, it's the same `claude` binary, in the same `$HOME`, with the same config dirs, the same auth files, the same skills directory, the same MCP servers as if the user typed `claude` in Terminal.app. The only difference: *we* feed it the prompt and *we* read its stream-json output.

**This is the GitHub Desktop / Tower / GitKraken pattern for Git, applied to agentic CLIs.** Those tools don't reimplement git's commit logic; they shell out to `git` with the right flags and parse the output. We do the same with `claude` / `codex` / `cursor-agent` / `gemini` / `amp` / `droid` / `copilot`.

**The implication for product strategy:** we are not in a maintenance race with vendors. When Anthropic adds a new memory feature to Claude Code, it's in `claude` the moment the user runs `npm install -g @anthropic-ai/claude-code@latest`. We don't have to reimplement it. We may want to add a renderer for nicer display, but the *functionality* is free.

#### 2.9.2 Per-agent capability matrix

| Capability | Claude | Codex | Cursor | Gemini | Copilot | Amp | Droid | OpenCode |
|---|---|---|---|---|---|---|---|---|
| **Project-context file(s)** | `CLAUDE.md` (walks up + per-subdir) + `CLAUDE.local.md` + `.claude/rules/*.md` with `paths:` frontmatter | `AGENTS.md` (walks up) + `~/.codex/AGENTS.md` global | `.cursor/rules/*` + `AGENTS.md` + `CLAUDE.md` (per Cursor docs) + legacy `.cursorrules` | `GEMINI.md` hierarchy + JIT-loaded from any file's parent dirs; configurable via `context.fileName` | `AGENTS.md` + `<name>.agent.md` custom-agent files | `AGENTS.md` (walks up to $HOME) + `$HOME/.config/amp/AGENTS.md`; falls back to `AGENT.md` or `CLAUDE.md` | `AGENTS.md` | `AGENTS.md` + `CLAUDE.md` (compat) + `CONTEXT.md` (legacy). Walks up to worktree root; **first match wins**. Plus per-file traversal: when `read` tool reads a file, OpenCode walks its parent dirs and attaches nearby `AGENTS.md`/`CLAUDE.md` once per message |
| **User config dir** | `~/.claude/` | `~/.codex/` | `~/.cursor/` | `~/.gemini/` | `~/.copilot/` (or `$XDG_CONFIG_HOME/copilot/`) | `~/.config/amp/` | `~/.factory/` | XDG-pure: config `~/.config/opencode/`, data `~/.local/share/opencode/`, cache `~/.cache/opencode/`, state `~/.local/state/opencode/` |
| **Auto-memory (file-backed)** | `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` + topic files. First 200 lines / 25 KB injected at session start | `~/.codex/memories/` (auto-injected; opt-in via `[features].memories = true`) | Cloud "Memories" feature (per-project, server-side) | `/memory show\|add\|refresh` writes to `~/.gemini/GEMINI.md` | none formal | AGENTS.md hierarchy fills the role | AGENTS.md fills the role | none formal — AGENTS.md hierarchy + skills fill the role |
| **Memory tool (model-callable)** | `memory_20250818` API tool — model emits `tool_use` with `name: "memory"` and a `command` field operating on virtual `/memories`. **File backend is the host's responsibility** | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| **Skills / extensions** | `~/.claude/skills/<name>/SKILL.md` (skill = folder with frontmatter + body). Resolution: enterprise > personal > project > plugin. Live-reloaded within a session | `~/.codex/skills/` (recently added; thin docs) | `~/.cursor/skills-cursor/` | `~/.gemini/extensions/<name>/gemini-extension.json` (each declares MCP servers, commands, hooks, sub-agents) | `<name>.agent.md` custom agents | `amp.skills.path` config + `mcp.json` in skill dirs | (none formal — `~/.factory/droids/` covers the related "custom agent" use case) | `.opencode/skills/<name>/SKILL.md` + `~/.config/opencode/skills/`. Also reads `.claude/skills/` (Claude compat) and `.agents/skills/` (cross-tool compat). Loaded on-demand by the `skill` tool. Plus **plugins** in `.opencode/plugins/` + `~/.config/opencode/plugins/` + npm packages listed in `opencode.json` |
| **Subagents (model-spawnable)** | `Agent` tool (renamed from `Task` in v2.1.63) + `.claude/agents/` and `~/.claude/agents/` markdown definitions. Stream events carry `parent_tool_use_id` linking children to parent | none documented public | Background Agents (cloud, separate product) + internal composer subagents | declared via extensions | `<name>.agent.md` custom agents (user/repo/org scope) | parallel subagents but not user-defined; final summary returns to parent | `Task` tool with `subagent_type: <droid-name>`; droid markdown files in `.factory/droids/` (project) or `~/.factory/droids/` (personal) | `task` tool with `subagent_type:` (built-ins: `general` full-access, `explore` read-only fast). User-defined agents in `opencode.json` `agent.*` or markdown files in `~/.config/opencode/agents/` (global) / `.opencode/agents/` (project). Each agent has `mode: primary\|subagent\|all`, `tools` allow/deny map, `permission`, `model`, `prompt`, `temperature`, `top_p`, `steps` |
| **MCP injection point** | `--settings <file>` (hooks) + `--mcp-config <file>` (servers); OR scope-based in `~/.claude.json` (local) / `.mcp.json` (project) / user-scope | `-c mcp_servers.<name>...` per-invocation flag; `~/.codex/config.toml` global | `.cursor/mcp.json` (project) + `~/.cursor/mcp.json` (global) | `mcpServers` in `settings.json` or in extensions | `--additional-mcp-config <file>` per-session; `~/.copilot/mcp-config.json` global | `amp.mcpServers` in user/workspace settings; `amp mcp add` CLI | per-droid frontmatter; `~/.factory/tools/` | `mcp` key in `opencode.json` (local stdio or remote HTTP/SSE with OAuth). **Or dynamic per-session via `POST /mcp` on the running server** — cleanest path for our wrapper to inject design-tools MCP without touching user config. Or env: `OPENCODE_CONFIG_CONTENT={"mcp":{...}}` |
| **Session persistence** | Local — `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` | Local — `~/.codex/sessions/` + SQLite (`logs_2.sqlite`, `state_5.sqlite`) | **Cloud** — Composer threads on Cursor's servers; `~/.cursor/chats/` is local cache | Local — `~/.gemini/history/` | Local — `~/.copilot/`; cloud delegation flow is separate | **Cloud** — `ampcode.com/threads`; `@T-<thread-id>` cross-thread refs need network | Local — `~/.factory/sessions/` | Local — SQLite at `~/.local/share/opencode/opencode.db` (Drizzle schemas; tables: `Session`, `Message`, `Part`, `Todo`, `Permission`). Cloud sharing is opt-in via `--share` flag |
| **Resume offline** | ✓ | ✓ | ✗ (cloud-coupled) | ✓ | ✓ (delegation flow excepted) | ✗ (cloud-coupled) | ✓ | ✓ — `--continue` (most recent root session), `--session <id>` (specific), `--fork` (with one of the above) |
| **Headless flag we use** | `-p --output-format stream-json --verbose --settings <file> --permission-mode default --session-id <uuid>` | `exec --skip-git-repo-check --json` | `-p --output-format stream-json --stream-partial-output --trust --model auto` | PTY (no headless stream-json — we drive TUI + read OTel telemetry file) | PTY (no headless JSON output) | `-x --stream-json` | `exec --output-format json` | **Server-attached:** `serve --hostname 127.0.0.1 --port <random> -p <random-pwd>`. Then `@opencode-ai/sdk`: `client.session.create()` + `client.session.prompt()` + `client.event.subscribe()` SSE stream. Spawn env: `OPENCODE_CONFIG_CONTENT={...overrides}` to neuter user config (DPCode trick — see §2.10). |
| **Models / providers** | Anthropic only (subscription auth via Claude Pro/Max OAuth or API key) | OpenAI ChatGPT-tier (subscription) — Codex 0.125+ | Cursor Pro / API-key | Google Gemini (subscription / API key) | GitHub Copilot subscription | GPT-5.5 / Anthropic via Sourcegraph routing + custom `smart`/`rush`/`deep` tiers | Factory routing | **Provider-agnostic, 75+ providers** via Vercel AI SDK + models.dev catalog. Native: OpenAI, Anthropic (Claude Pro/Max OAuth), Google Vertex AI, Groq, OpenRouter, Ollama, LM Studio, llama.cpp, Bedrock, Azure, Copilot device-flow, GitLab Duo, OpenCode Zen gateway. Plus any OpenAI-compatible via `baseURL`. **This is the killer cheap-alternative-models story** — Kimi K2 via OpenRouter, Qwen3 via local Ollama, GLM 4.5, DeepSeek V3, etc. |

The data on this table comes from each vendor's docs + verification on the live filesystem during the 2026-04-27 capability research. References live in §8.

#### 2.9.3 Cloud-coupled session state (Cursor + Amp)

These two are the structural odd-ones-out. Their authoritative session state lives on the vendor's server, not on the user's disk:

- **Cursor** keeps Composer threads in Cursor's cloud (tied to the user's Cursor account). The local `~/.cursor/chats/` and `agent-cli-state.json` are caches. If the user is offline, or their Cursor token is revoked, "resume last thread" can fail in a way it never does for Claude/Codex/Gemini/Copilot/Droid (which keep everything local).
- **Amp** keeps threads at `ampcode.com/threads`. Resume via `amp threads continue` or `@T-<thread-id>` references go through Sourcegraph's server.

**Implication for our product:** when we eventually build a "Resume previous session" UI (Phase 2 polish, or a Phase 3 feature), Cursor and Amp need an "offline / not authenticated, can't resume" state that the others don't. Worth a UI affordance that distinguishes "we don't have this session locally" from "the agent doesn't have a resume capability."

We can't fix this — it's a property of how those two CLIs work. But we should expose it honestly.

#### 2.9.4 TUI-only capabilities — handled out-of-band

Some vendor capabilities are interactive-mode only and don't surface in headless / stream-json mode. We already handle these correctly:

| Capability | Where it normally lives | How we handle it |
|---|---|---|
| OAuth login (`/login`, `gh auth login`, etc.) | Vendor's CLI in interactive mode | User runs the login command in their own Terminal *first*; our subprocess inherits the auth files. Documented in [agents/README.md](../src/engine/agents/README.md) |
| Permission prompts (shell, file edits) | Vendor's CLI defaults to interactive prompts | We pass headless flags (`claude --permission-mode default`, `cursor-agent --trust`, `amp -x`, `droid exec`, etc.) plus `--settings`-based hook injection where supported |
| Plan-mode keybinding (`Shift+Tab` in Claude TUI) | Claude's TUI | Replaced by our composer's mode pill (Phase 1 §2.4.13) |
| `/memory` slash command UI (Claude, Codex, Gemini) | Vendor's TUI | Replaced by our memory inspector — see §2.9.6 |
| `/agents`, `/permissions`, `/config` UI (Claude) | Vendor's TUI | Replaced by our Settings → Agents panel; permissions inline (Phase 1 §2.6); config via composer pills |
| Approval / diff acceptance UI (Cursor) | Cursor's TUI | Replaced by inline permission cluster (Phase 1 §2.6) |

#### 2.9.5 Project-context indicator (chat header chip)

**New Phase 1 addition** (small renderer-side chip).

A chip in the chat header showing what context files the agent is loading for the current chat's cwd. Per agent:

- **Claude**: list of `CLAUDE.md` files visible from cwd (project + parents + `~/.claude/CLAUDE.md`) plus active rules from `.claude/rules/*.md`
- **Codex**: `AGENTS.md` files (cwd + parents + `~/.codex/AGENTS.md`)
- **Cursor**: `.cursor/rules/*` + `AGENTS.md` + `CLAUDE.md` if present at root
- **Gemini**: `GEMINI.md` files
- **Amp**: `AGENTS.md` (with fallback to `AGENT.md` / `CLAUDE.md`)
- **Droid**: `AGENTS.md`
- **Copilot**: `AGENTS.md` + custom agent files

Click expands a popover listing each file with size + first 200 chars preview + "Open in editor" action.

**Why it matters:** a recurring source of confusion in agent IDEs is "what does the agent know before I send my prompt?" Surfacing the loaded context closes that loop. Especially valuable when chats span monorepos with nested context files.

**Implementation note:** read-only, file-system-driven. The renderer reads files at chat-cwd via the existing IPC `git`/`fs` capability (already wired). No bridge protocol changes.

**Scope:** ships in Phase 1 alongside the long-run UX kit — natural fit because the chip lives in the same per-turn header area that the prompt-pin work is restructuring.

#### 2.9.6 Memory inspector (Settings → Agents)

**New Phase 1 addition** (Settings panel surface).

A read-only viewer in Settings → Agents → \<agent\> showing the agent's persistent memory state:

- **Claude**: `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` + topic files. Shows what auto-memory has captured for the current project. "Open in editor" opens the file in the user's default editor.
- **Codex**: `~/.codex/memories/` summaries / durable entries / recent inputs. Same UI shape.
- **Gemini**: `~/.gemini/GEMINI.md` (the file `/memory add` writes to).
- **Cursor**: link out to Cursor's web UI (their Memories are server-side; we can't render contents directly, but we can deep-link).
- **Amp / Copilot / Droid**: AGENTS.md / custom-agent files in the same panel.

**Why it matters:** mirrors the `/memory` slash command from Claude / Codex / Gemini's own TUIs (which our wrapper bypasses since we don't run the TUI). Without this, users have no in-app way to see what an agent has memorized about their project.

**Implementation note:** file-system reads via the existing IPC capability. Read-only in v1; future revisions can add edit-and-save.

**Scope:** small Settings page addition; ships parallel to Phase 1 §2.6 (inline permissions) since both extend the agent settings surface.

#### 2.9.7 Subagent rename — Claude `Task` → `Agent` (v2.1.63)

A specific gotcha to call out for the Subagent card (§2.4.7):

In Claude Code v2.1.63, the subagent invocation tool was renamed from `Task` to `Agent`. Existing chats and some Claude SDK fields (`system:init.tools`, `permission_denials[].tool_name`) still emit `"Task"`. Our renderer **must** match both names.

Lives in the Claude adapter normalizer (Phase 1 §2.3): the normalizer maps `tool_use.name in {"Task", "Agent"}` → canonical `kind: "subagent"`. The Subagent card renderer then doesn't see the difference.

#### 2.9.8 Per-agent capability test matrix

Referenced from §6 (suggested order). When we onboard a new agent or upgrade an existing one's CLI version, run this test corpus:

1. **Project-context loading** — create a `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` (per agent) at project root with a marker phrase. Send a prompt that should reveal the agent has read it. Verify the marker shows up in the response.
2. **Memory persistence across sessions** — start a session, ask the agent to remember a specific fact about the project. Quit the session, start a new one in the same cwd, ask "what did I tell you about X?" Verify recall.
3. **Subagent invocation** — for agents that support it (Claude, Droid, Amp): prompt that should trigger Task/Agent delegation. Verify nested events render with `parent_tool_use_id` correctly indented in the Subagent card.
4. **Skill activation** — install a known skill in the agent's skills dir. Trigger it via `/skill-name` or by description. Verify it expands to the expected prompt and the agent acts on it.
5. **Session resume** — start a session, send a turn, quit. Resume via the agent's resume flag. Verify the prior turn loads into the chat.
6. **MCP injection** — verify our injected design-tool MCP server is visible to the agent (prompt that should trigger an `apply_change` tool call). Verify a user-configured project-level MCP server (`.cursor/mcp.json`, `.mcp.json`, etc.) is also visible. Both should work.
7. **Headless flags** — verify the agent runs to completion with `code=0` and no manual approval prompts blocking.

Format: `docs/AGENT_CAPABILITY_TEST_MATRIX.md` (created during Phase 1 finalization). Each agent gets a row per test; pass / fail / N/A; CLI version tested. Re-run on every CLI minor version bump.

### 2.10 Adapter contract refinements (from DPCode research)

This section captures the 2026-04-27 deep-research findings on [DPCode](https://github.com/Emanuele-web04/dpcode) (MIT, Electron + Bun + Effect-TS, ~273 stars, very active) — a similar Electron-based agentic-coding IDE that has already integrated Claude / Codex / Gemini / **OpenCode** behind a single adapter contract. Patterns we adopt, patterns we deliberately don't, and the OpenCode adapter integration plan that emerged.

#### 2.10.1 What DPCode validates

Their `ProviderAdapterShape<TError>` (in their `apps/server/src/provider/Services/ProviderAdapter.ts`) is the same shape as our roadmap's `AgentAdapter` — `startSession`, `sendTurn`, `interruptTurn`, `respondToRequest`, `respondToUserInput`, `streamEvents: Stream<ProviderRuntimeEvent>`, plus a declarative `capabilities` struct.

Most importantly: they've validated this single contract against four wildly different transports:

- **Claude** via the official `@anthropic-ai/claude-agent-sdk` Node SDK (in-process `query()` async iterator, no subprocess)
- **Codex** via `codex app-server` JSON-RPC over stdio (officially supported by OpenAI)
- **Gemini** via PTY + `--acp` flag (Agent Communication Protocol)
- **OpenCode** via HTTP + SSE through `@opencode-ai/sdk` (server-first)

This is reassuring confirmation that our adapter contract can survive whatever next CLI we onboard — the per-agent transport choice is encapsulated entirely inside the adapter folder.

#### 2.10.2 Patterns we adopt

**A. Declarative `capabilities` struct on every adapter.** Instead of defensive runtime checks ("does this adapter support setMode?"), each adapter declares what it supports up front:

```ts
interface AdapterCapabilities {
  steerTurn: boolean;          // mid-turn redirection (Codex/Claude only)
  forkSession: boolean;        // session forking
  compactThread: boolean;      // explicit compaction
  startReview: boolean;        // review mode
  listSkills: boolean;
  listCommands: boolean;
  listPlugins: boolean;
  listModels: boolean;
  sessionModelSwitch: "in-session" | "restart-session" | "unsupported";
  thinkingBudget: boolean;     // configurable thinking-token budget
  voiceTranscription: boolean;
}
```

The mode pill (§2.4.13), inline permission cluster (§2.6), model picker (§2.4.13), and feature flags (Phase 2) all read this struct. Disabled controls render as `disabled` UI rather than error states. Adopted in §2.3 — the canonical adapter contract gets this as a first-class field.

**B. `raw + providerRefs` on every canonical event.** Each event carries:
- `raw?: { source: "claude.sdk.message" | "codex.app-server.notification" | "opencode.sdk.event" | ... ; payload: unknown }` — the original native event
- `providerRefs?: { providerThreadId?, providerTurnId?, providerItemId?, providerRequestId?, providerParentThreadId?, parentProviderTurnId? }`

Free "view raw event" debug capability for Settings → Developer; free correlation between native logs and canonical events. Adopted in §2.2.

**C. The `OPENCODE_CONFIG_CONTENT={}` env trick.** When DPCode spawns `opencode serve`, they pass `OPENCODE_CONFIG_CONTENT: "{}"` in env — which **fully overrides** the user's `~/.config/opencode/opencode.json` with an empty config. Net effect: our wrapper controls the OpenCode runtime entirely; no surprises from user-configured MCP servers, custom system prompts, or permission rules bleeding in. Then we layer in our own MCP servers (the design tools) via `POST /mcp` at runtime.

The same pattern, generalized: **per-adapter "config neutering" path**.

| Agent | Config-neuter mechanism |
|---|---|
| Claude | `--settings <wrapper-owned-file>` flag merges, never overrides; we accept this |
| Codex | `-c <key>=<value>` per-invocation overrides; user's `~/.codex/config.toml` still loads |
| Cursor | `--mcp-config` flag for our MCP; user config still loads |
| Gemini | `--system-settings <tmpdir-file>` (DPCode pattern: write to `${tmpdir}/dpcode/gemini/settings.json`) |
| Copilot | `--additional-mcp-config` |
| Amp | Workspace `.amp/settings.json` if we control cwd |
| Droid | `FACTORY_CONFIG_DIR=<wrapper-dir>` env (existing pattern) |
| **OpenCode** | **`OPENCODE_CONFIG_CONTENT={...}` env** — neuters user config entirely |

Each adapter's `spec.ts` declares its config-neuter env/flags; the gateway sets them at spawn time.

**D. The `canUseTool` Deferred bridge** (Claude SDK pattern, generalizable). When the SDK calls our permission callback, we return a `Promise` whose resolution is wired to a Deferred that the canonical event stream resolves later — when the user clicks Allow/Deny in our UI. This cleanly separates "agent is blocked waiting for a decision" from "user clicked a button somewhere." Adopt for Claude (SDK-native) and apply the same Deferred pattern to OpenCode's `POST /permission/reply` and any future SDK-based adapter.

**E. The "appendDelta with deduplication" helper.** OpenCode's SDK occasionally sends overlapping/duplicate `message.part.delta` events. DPCode's `appendOpenCodeAssistantTextDelta(prevText, delta)` returns `{nextText, deltaToEmit}` — handles the case correctly. We adopt this in our OpenCode normalizer (and Claude/Cursor where we've already seen similar issues — Cursor's `--stream-partial-output` has the same overlap pattern, handled at [translator.ts:288-298](../src/engine/agents/adapters/claude/translator.ts#L288-L298)).

**F. SQLite event-sourcing as a future option** (not adopted now, but flagged). DPCode persists every canonical event into an `orchestration_events` SQLite table; UI projections derive from this log and can be rebuilt at any time. Heavier than our current "session messages only" model but it's the natural Phase 3 evolution if we ever need crash-recovery of in-flight turns.

#### 2.10.3 Patterns we deliberately don't adopt

**A. Their monolithic `MessagesTimeline.tsx` (2,127 lines).** A single React component switching on `workEntry.itemType` to decide what to render. This is exactly the pattern our renderer registry (Phase 0) replaced. Our `src/zeros/agent/renderers/registry.ts` + per-tool-kind dispatch is structurally cleaner.

**B. Their composer-anchored permission panel.** They render approvals docked to the composer (`ComposerPendingApprovalPanel.tsx`). Argument: composer is always in view. Our argument: locality (decision next to context) is more important. Both are defensible; we keep §2.6's inline cluster, but consider a hybrid in v2 (inline + composer chip showing "N pending approvals").

**C. Their flat adapter file structure.** DPCode's adapters live as flat files (`provider/Services/ClaudeAdapter.ts` + `provider/Layers/ClaudeAdapter.ts`). Our `src/engine/agents/adapters/<agent>/{spec,translator,hooks,history}.ts` folder structure is clearer for non-trivial adapters with multiple supporting files. Keep ours.

**D. Their fragmented Zustand store layout (13 stores, the main one at 3,844 lines).** A "design choice" that grew organically, per their own AGENTS.md. We keep the per-chat slicing pattern from Phase 0 and add slices as needed.

#### 2.10.4 OpenCode adapter integration plan

**Spec** ([src/engine/agents/adapters/opencode/spec.ts](../src/engine/agents/adapters/opencode/spec.ts) — new):
- `agentId: "opencode"`
- `cliBinary: "opencode"` (path overridable via `providerOptions.opencode.binaryPath`)
- `installHint`: `npm install -g opencode-ai` ([opencode.ai/docs/install/](https://opencode.ai/docs/install/))
- `authProbe`: existence of `~/.local/share/opencode/auth.json` (XDG)
- `loginCommand`: `opencode auth login` (interactive, runs in user's Terminal)
- `minCliVersion: "1.14.0"` (where `--format json` and the `@opencode-ai/sdk` v2 stabilized)

**Spawn pattern: server-attached** (richer than `run --format json`).

```ts
// On session start:
const port = await findAvailablePort(0);
const password = randomUUID();
const child = spawn("opencode", [
  "serve",
  "--hostname=127.0.0.1",
  `--port=${port}`,
], {
  cwd: state.cwd,
  env: {
    ...process.env,
    OPENCODE_SERVER_PASSWORD: password,
    OPENCODE_CONFIG_CONTENT: JSON.stringify(buildWrapperConfig(state)),
    OPENCODE_DISABLE_CLAUDE_CODE_PROMPT: "1", // don't bleed in ~/.claude/CLAUDE.md
  },
});
await waitForLog(child.stdout, /opencode server listening/);

const client = createOpencodeClient({
  baseUrl: `http://127.0.0.1:${port}`,
  basicAuth: { username: "opencode", password },
});

// Inject our design-tools MCP server dynamically:
await client.mcp.add({ name: "zeros-design", type: "remote", url: zerosMcpUrl });

// Create or resume session:
const session = state.resumeId
  ? { sessionID: state.resumeId }
  : await client.session.create({ title: state.title, permission: buildPermissionRules(state) });

// Subscribe to bus:
const events = client.event.subscribe();
for await (const event of events) {
  emit(translate(event)); // → canonical SessionUpdate
}
```

**Translator** ([src/engine/agents/adapters/opencode/translator.ts](../src/engine/agents/adapters/opencode/translator.ts) — new). Maps OpenCode's bus events to canonical:

| OpenCode bus event | Canonical event | Notes |
|---|---|---|
| `message.updated` (assistant, first time seen) | `session.start` (if first) + usage update | extract `providerID`, `modelID`, `variant` |
| `message.part.delta` (`field: "text"`, part type `text`) | `text.chunk` | DPCode's appendDelta-with-dedup helper |
| `message.part.delta` (`field: "text"`, part type `reasoning`) | `thinking.chunk` | only when `--thinking` set or in server mode |
| `message.part.updated` (part type `text`, `time.end` set) | `text.complete` | finalized |
| `message.part.updated` (part type `tool`, `state.status: "running"`) | `tool.start` | input + title from `state.input`/`state.title` |
| `message.part.delta` on a tool part (output streaming) | `tool.progress` | bash output streams here |
| `message.part.updated` (part type `tool`, `state.status: "completed"`) | `tool.end` (success) | output + metadata.diff for edits |
| `message.part.updated` (part type `tool`, `state.status: "error"`) | `tool.end` (failed) | `state.error` |
| Tool with `tool: "task"` | `subagent.start`/`subagent.end` (canonical kind: `subagent`) | `state.input.subagent_type` etc. |
| `permission.asked` | `permission.request` | `tool` field links to triggering tool call |
| `permission.replied` | `permission.decision` | |
| `question.asked` | `clarifying_question` | server-only; not in `run` mode |
| `session.status` (`status.type: "idle"`) | `session.end` (normal) | with cost rollup |
| `session.status` (`status.type: "retry"`) | `error` (warning, recoverable) | |
| `session.compacted` | (internal — context-window banner, optional) | |
| `session.error` (overflow) | (internal — compaction in progress) | |
| `session.error` (other) | `error` (severity: `error`) | |
| `mcp.tools.changed` | (internal — refresh MCP tool list) | |

**Auth flow:**
- The user runs `opencode auth login <provider>` in their own Terminal first (interactive OAuth or API-key prompt for the provider).
- Our subprocess inherits `~/.local/share/opencode/auth.json` automatically.
- We never read or write that file.
- We optionally support `OPENCODE_AUTH_CONTENT` (raw JSON env var) for users who want to BYO via our UI — same env-var pattern as the Claude API-key flow but pointing into OpenCode.

**Model picker:** at adapter init, we hydrate the OpenCode-specific model list via `client.provider.list()` (server endpoint `GET /provider`). The `provider/model` slugs (e.g. `anthropic/claude-sonnet-4-5`, `openrouter/moonshot/kimi-k2`) populate the composer's model pill. **This unlocks the cheap-alternative-models story** — Kimi K2, Qwen3 Coder via Ollama, GLM 4.5 via OpenRouter, DeepSeek V3 via OpenRouter, etc.

**MCP injection:** we register our design-tools MCP server via `POST /mcp` at session start. Per-session, never written to user config. Cleanest of all the agents.

**Capabilities struct** (declared in `spec.ts`):
- `steerTurn: false` (OpenCode doesn't have mid-turn steering)
- `forkSession: true` (`--fork`)
- `compactThread: true` (`/compact` + `session.compacted` event)
- `listSkills: true` (`opencode serve` exposes `GET /skills`)
- `listCommands: true` (`GET /command`)
- `listPlugins: true` (`GET /plugin`)
- `listModels: true` (`GET /provider` then drill in)
- `sessionModelSwitch: "restart-session"` (model is bound to session at create time)
- `thinkingBudget: true` (`--variant high|max|minimal`)

#### 2.10.5 What this adds to our roadmap

OpenCode integration ships as part of Phase 1 — the new adapter folder pattern is identical to the others, the canonical events are already designed, and the renderer cards already cover OpenCode's tool surface (bash/edit/read/grep/etc. all map cleanly).

**Estimated incremental scope:** 1.5-2 days on top of Phase 1's existing budget. The work splits roughly:
- Spec + spawn / serve attach: 0.5 day
- Translator (SSE bus → canonical): 0.75 day
- Auth + model picker hydration + MCP injection: 0.5 day
- Capability matrix entry, capability test row, roadmap doc updates: 0.25 day

Sequenced after Stage 7 (Codex + Cursor) in §6 — reuses the same patterns, just with a server-attach instead of subprocess pipe.

---

## 3. Phase 2 — Performance + architecture (merged with 360-degree audit)

The previous draft of this roadmap had a Phase 2 (performance scale: virtuoso, shiki worker, tool-call index, WS dedup) and a Phase 3 (polish: cache-first startup, non-blocking session boot, bundle audit, SQLite windowed view). The 360-degree migration audit added: workspace store Zustand migration, engine sidecar runtime decision, canvas iframe virtualization, IPC delta protocol.

These all serve the same end-state — chat + canvas stay smooth at 1000+ messages, 50+ chats, 30+ design variants — and they're tightly coupled in practice (you can't virtualize the message list without resolving the workspace store re-render cascade; you can't ship Bun in the sidecar without confirming `better-sqlite3` and `node-pty` work; you can't add deltas without first sliced state). So they merge into one phase.

**Estimated scope:** ~2 weeks. Splits into chat-side performance (3.2-3.4: ~3 days), workspace-side restructuring (3.1, 3.6, 3.7: ~5 days, depends on 3.1 first), runtime / startup / bundle (3.5, 3.8-3.10: ~3 days), and SQLite polish (3.11: ~1 day). With the chat and canvas tracks parallelizing after 3.1 lands, ~10 working days.

The audit summary at the end ([§5](#5-audit-summary--whats-solid-whats-still-risky)) captures what's solid vs still-risky after Phase 1 + 2 ship.

### 3.1 Workspace store: Zustand migration

**Why:** [src/zeros/store/store.tsx](../src/zeros/store/store.tsx) is a single `useReducer` over a 23-field `WorkspaceState` (elements tree, variants, themes, chats, inspector mode, view route, project connection, AI settings, feedback, project generation, etc.). Every dispatch produces a new top-level object reference. Every consumer of `useWorkspace()` re-renders on every dispatch.

This is the canvas-side equivalent of the bug Phase 0 just fixed for chat. Symptoms today:
- Selecting an element in the inspector re-renders all variant nodes.
- Updating one variant's CSS re-renders every variant.
- Theme edits re-render everything.
- A chat update (because `chats` lives in the same workspace state) re-renders the canvas.

**The refactor:**

1. Split `WorkspaceState` into Zustand slices:
   - `useElementsStore` — element tree, selectedElementId, hoveredElementId
   - `useVariantsStore` — variants array, activeVariantId
   - `useThemesStore` — themes, themeMode, themeChanges
   - `useInspectorStore` — inspector mode, style panel, view mode, breakpoint
   - `useProjectStore` — project connection, devServerUrl, framework
   - `useViewStore` — currentView, currentRoute, activePage
   - `useChatThreadsStore` — chats, activeChatId (separate from the existing `sessions-store` which holds in-flight session state)
   - `useAISettingsStore` — aiSettings, projectGeneration, pendingChatSubmission
   - `useFeedbackStore` — feedbackItems, newAgentFolder

2. Existing consumers of `useWorkspace()` migrate to the relevant slice + selector. The reducer's switch statement decomposes into per-slice action creators.

3. `findElement()` and `updateElementInTree()` helpers become methods on `useElementsStore` so the recursion doesn't traverse from React component scope.

4. Cross-slice operations (e.g. "delete a variant and clear its inspector selection") are coordinated via small thunk-style functions, not by re-introducing a top-level reducer.

**Outcome:** dragging a node updates `useElementsStore`; only canvas nodes that subscribe to that specific element via `useElementsStore(s => s.byId[id])` re-render. Variant CSS edits no longer re-render the inspector. Chat updates no longer re-render the canvas.

This is the highest-leverage canvas-side change. Until 3.1 lands, the rest of Phase 2 (especially 3.6 iframe virtualization) won't deliver its full value because re-render storms still propagate.

### 3.2 Message-list virtualization (react-virtuoso)

**Why:** today every message is mounted in DOM. With 1000 messages × N concurrent chats, that's thousands of nodes always alive.

**What changes:**
- [agent-chat.tsx:668](../src/zeros/agent/agent-chat.tsx#L668) — wrap `messages.map(...)` in `<Virtuoso>` from `react-virtuoso` (free MIT core, not the paid `@virtuoso.dev/message-list`).
- `followOutput="smooth"` and `initialTopMostItemIndex={Infinity}` for chat-style anchor.
- Each renderer is already memoized (Phase 0); virtuoso-recycled rows update cleanly.
- The sticky per-turn prompt (§2.5.1) requires that turn containers be the virtualized item, not individual messages — virtuoso handles variable heights, but sticky-positioned children need their parent to be the row.

**Why this is now a one-day drop-in:** Phase 0 made renderers self-contained and memoized. Phase 1 gives them stable heights per kind (default-collapsed cards have stable collapsed height; expanded heights are measured on toggle). Pre-Phase 0/1 this would have been weeks of measurement bugs.

**Note:** keep `content-visibility: auto` on turn containers as a belt-and-suspenders for browsers that support it; virtuoso handles outside-viewport, content-visibility handles within-viewport partial paint.

### 3.3 Streaming markdown + Shiki worker

**Why:** Shiki's regex-heavy grammars can pin the main thread ~50ms per code block. Multiple streaming code blocks → visible jank. And default `react-markdown` re-parses the entire message on every token.

**What changes:**
- Switch syntax-highlight import from `react-shiki` to `react-shiki/worker`.
- Highlighting runs in a Web Worker; main thread receives rendered HTML.
- Shared worker boot cost (~50ms) amortized across all code blocks.
- Pair with the streaming-markdown approach already shipped in Phase 1 (§2.5.11). Old messages serialize once to HTML and stay memoized.

### 3.4 Tool-call index + WS dedup

**Tool-call follow-along: O(N) → O(1).** [agent-chat.tsx:320-366](../src/zeros/agent/agent-chat.tsx#L320-L366) iterates all messages on every store update to find pending design-tool calls. Build an index map keyed by `toolCallId` at message-insert time, stored alongside the chat slot in the Zustand store. The follow-along effect reads `index.get(id)` instead of scanning.

**WebSocket queue dedup.** [ws-client.ts](../src/zeros/bridge/ws-client.ts) bounds the offline queue at 256 entries with no dedup. The same `AGENT_LOAD_SESSION` for one sessionId can pile up 5×. Dedup by `(type, sessionId)`; per-type cap (max 50 `AGENT_LOAD_SESSION` queued at once).

The Phase 0 stable-actions fix removed the main runaway-init scenario; the queue shape is still wasteful, this is the cleanup.

### 3.5 Engine sidecar runtime decision

**Correcting the previous draft:** the sidecar runs on **Node.js in both dev and prod** today — `package.json` has `"serve:engine": "node dist-engine/cli.js"` and the build is via tsup targeting Node. The 360-audit document said "Bun in dev / Node in prod", which is wrong.

**The decision Phase 2 forces:** stay on Node, or move to Bun.

**Pro-Bun:**
- Faster cold start (relevant for sidecar respawn during dev iteration; less so in prod where the sidecar lives for the session)
- Faster JSON parse on the hot path (relevant for high-volume stream-json from a parallel-agents future)
- Built-in SQLite (we already use `better-sqlite3` in Electron-main; doesn't help us, the sidecar doesn't currently talk to SQLite)
- Native TypeScript execution (one less build step)

**Pro-Node:**
- `better-sqlite3`, `node-pty`, `keytar` are all native modules with N-API bindings — they work under Bun's Node compat, but Bun's compat layer is the layer that gets new bug reports first when these modules update
- The MCP SDK (`@modelcontextprotocol/sdk`) targets Node; community support is Node-first
- `electron-builder` Node sidecar packaging is well-documented; Bun-as-sidecar packaging is novel territory
- Zero current code is Bun-specific, so we're not paying any Node tax today

**Recommendation: stay on Node.** Bun's wins (cold-start, JSON parse) aren't on our hot path — the sidecar is long-lived, and JSON parse is per-token not per-mass. The risks (native module compat, packaging novelty) are real and would rather be spent elsewhere. The 360-audit's claim that "Node will struggle to orchestrate 50 parallel agents" is unsupported by any benchmark we have; the orchestration cost is dominated by subprocess I/O, which is OS-level.

**What we do instead:** profile the sidecar before assuming we have a runtime problem. The Phase 0 dispatch / spawn / exit logging gives us per-event telemetry; if the sidecar shows >5ms median latency between subprocess output and bridge dispatch, we revisit. Until then, the runtime is not the bottleneck.

This explicitly closes the question rather than letting it drift. If later evidence flips the answer, we revisit.

### 3.6 Canvas iframe virtualization

**Why:** `src/zeros/canvas/variant-canvas.tsx` mounts every variant `<iframe>` simultaneously. Each iframe is a full browser context with its own JS heap and rendering pipeline. On a project with 30 variants, the canvas is 30 live browsers running on a single Mac.

**What changes:**

1. **Intersection-observer-driven mount/unmount.** Each `VariantNode` watches its own intersection with the canvas viewport. Outside viewport (with a generous margin to account for React Flow's pan/zoom): unmount the iframe and replace with a snapshot image.
2. **Snapshot capture.** Before unmounting, capture the iframe's rendered surface to a `<canvas>` (or just `<img>`) via the existing canvas screenshot infrastructure. Store the snapshot data-url in the variant's slice of `useVariantsStore`. Re-mount with live iframe when the variant comes back into view.
3. **Mount budget.** Hard cap of 6 live iframes regardless of viewport; LRU-evict the least-recently-active. Active = focused, or being inspected, or recently scrolled into view.

This depends on 3.1 — the Zustand variants slice — because each variant's mount/snapshot state needs granular subscription. Without 3.1, the IO event would bounce through the global reducer and re-render everything.

**The 360-audit's "long term: WebGL canvas" suggestion:** out of scope. Replacing React Flow with PixiJS / WASM is a multi-month project for a marginal benefit at our current scale. We re-evaluate when iframe virtualization runs out of headroom.

### 3.7 IPC delta protocol

**Why:** today `SET_ELEMENTS` dispatches the entire `ElementNode[]` tree on every selection or DOM change. Even a single style update sends the full tree across the IPC boundary.

**What changes:**

1. **Element tree deltas.** Instead of `SET_ELEMENTS(fullTree)`, dispatch `UPDATE_ELEMENT({ id, patch })` or `INSERT_ELEMENT({ parentId, index, node })`. The renderer's Zustand store applies the patch to its local copy.
2. **Initial sync stays full.** First load of a variant still ships the full tree once. Only subsequent changes are deltas.
3. **Inspector style updates** (the highest-frequency event) become especially small: one element id + a styles object diff.
4. **Bridge protocol stays JSON.** The 360-audit's binary protocol (Protocol Buffers) suggestion is not worth the build complexity at our current message rates. Re-evaluate if bridge throughput exceeds 1k msg/s.

The delta layer is implemented in the Zustand workspace store (3.1) — `useElementsStore` exposes `applyPatch(patch)` actions, and the engine emits patches instead of full trees.

### 3.8 Cache-first startup

**Why:** today boot waits for bridge connect → `AGENT_LIST_AGENTS` round-trip → agent install / auth probes → session list fetch, all in series, before the user sees anything useful.

**What changes:**
- Cache the agent registry to localStorage; render the sidebar / agent picker from cache on cold mount; refresh in the background.
- Cache last-active state per chat (selected agent, model, mode); restore composer pills instantly.
- Cache `bridgeStatus` last-known value; show "connecting…" pill instead of waiting.

**Source:** Conductor 0.49 explicitly does this and credits it for half the perceived speedup.

### 3.9 Non-blocking session boot

**Why:** today `loadIntoChat` awaits the engine round-trip before status flips to `ready`. The chat shows "warming…" for the duration.

**What changes:**
- Render the disk-hydrated transcript immediately (Phase 0 already does this).
- Show a lightweight "connecting" pill in the corner during engine warm-up.
- Subsequent prompts work — composer is interactive while warm-up completes (queues into the existing `queuedPreview` slot).

### 3.10 Bundle + binary trim

Renderer: 1.38 MB / 367 KB gzipped. Conductor shaved 150 MB.

- Audit `lucide-react` imports — every `import { Plus } from 'lucide-react'` vs. `import * as Icons from 'lucide-react'`. Tree-shaking only works with named imports.
- Audit `@radix-ui/*` — drop unused primitives.
- Drop bundled native modules we no longer use.
- `electron-builder` `asar` audit — exclude source maps and dev artifacts from the production binary.
- Remove dead `// removed:` code paths.
- Run `pnpm dlx vite-bundle-visualizer` for the renderer; `npx source-map-explorer` for the engine sidecar.

### 3.11 SQLite windowed view

Optional polish. Today we hydrate 200 messages on mount (`HYDRATE_WINDOW`); older messages stay on disk but aren't visible.

- Add a "Load older" affordance at the top of the message list.
- Calls `agent_history_window(chatId, limit, before)` with the oldest visible `ord`.
- Prepends the older window to the in-memory list.
- Combines with virtuoso (3.2): "load older" prepends; virtuoso handles the index update.

---

## 4. Parallel tracks

Tracks that run alongside the phases without blocking each other.

### 4.A Cursor translator (thinking + tool calls)

**Why:** Cursor agent currently emits prompts but no thinking blocks or tool calls show up in the UI. Reported by the user; pre-existing, not a Phase 0 regression. The cursor adapter [cursor/spec.ts](../src/engine/agents/adapters/cursor/spec.ts) reuses `ClaudeStreamTranslator` on the assumption *"Cursor's stream-json schema is close enough to Claude's"*. That assumption holds for plain text but breaks for thinking + tool calls.

**Important:** as of April 2026, Cursor's docs explicitly state thinking is **not emitted in headless print mode** ([cursor.com/docs/cli/reference/output-format](https://cursor.com/docs/cli/reference/output-format)). So this track has two halves:

1. **Tool-call translation.** Cursor emits `tool_call` events with `subtype: started/completed` and tool-specific shapes (`shellToolCall`, `readToolCall`, etc. — see [tarq.net/posts/cursor-agent-stream-format](https://tarq.net/posts/cursor-agent-stream-format/)). Today these don't render. Build a `CursorStreamTranslator` (or extend Claude's) to map them to canonical `tool.start` / `tool.end` events. **This is real work and must ship in Phase 1.**

2. **Thinking visibility.** Cursor doesn't emit thinking in print mode. So we don't render thinking for Cursor — gracefully, no stub, no error. The user sees text without thinking, same posture every other product takes.

**Diagnosis approach:**
1. With `pnpm electron:dev` running, send Cursor a prompt that should think + use tools (e.g. "list the files in this folder and tell me what they do").
2. Watch `main.log` via the live-log workflow — the spawn diagnostic shows exact stream-json events Cursor emits.
3. Compare against `ClaudeStreamTranslator`'s expected schema.
4. Write `cursor/normalizer.ts` that translates Cursor events to canonical events.

**Estimated scope:** half-day to a day for tool calls (depends on the schema delta). Thinking is a no-op (won't be emitted; renderer handles absence).

**Why it matters:** Cursor is the most popular non-Claude agent. Shipping with cursor "no tool calls" is a real gap. With Phase 0's live-log workflow we can diagnose this in one session. This track is effectively **part of Phase 1.3 (adapter normalizers)** — splitting it out only because it's a known pre-existing user-visible gap.

### 4.B ~~Codex API-key auth~~ — REMOVED

**Per user decision (2026-04-27):** removed from the roadmap.

The previous draft proposed an API-key auth flow for Codex to unlock 12 catalog models that require API-key tier rather than ChatGPT subscription. The user has decided that limiting Codex to the 3 subscription-tier models is fine — agentic CLI users connect their existing Codex CLI subscription, and the model picker should reflect what their subscription gives them, not what the API tier could give if they paid separately. This is the correct posture: the catalog reflects what the chosen CLI auth flow exposes.

If we revisit this later (a real user asks for it, or codex-cli changes its auth model), we'll re-add behind a tier flag. Until then, the codex catalog stays at the verified-working subscription-tier 3 (gpt-5.5, gpt-5.4, gpt-5.3-codex) and we don't build the API-key flow.

### 4.C HMR Fast Refresh recovery

**Why:** [sessions-provider.tsx](../src/zeros/agent/sessions-provider.tsx) exports both hooks (`useChatSession`, `useAgentSessions`, `useWarmAgentIds`) and a component (`AgentSessionsProvider`) from the same file. Vite Fast Refresh disables itself when a file mixes these — every edit causes a full reload instead of a hot-swap.

**Fix:** split into two files:
- `sessions-provider.tsx` → just the `<AgentSessionsProvider>` component
- `sessions-hooks.ts` → `useChatSession`, `useAgentSessions`, `useWarmAgentIds`

**Scope:** 30 minutes including grep + import update. Pure dev-experience win, not a runtime bug. (Was Track D in the previous draft; renamed since Track B is removed.)

---

## 5. Audit summary — what's solid, what's still risky

### Solid (post-Phase 0)

| Area | Status |
|---|---|
| Renderer registry pattern | Battle-tested by existing migrations. Phase 1 will exercise it heavily. |
| Zustand per-chat slices (chat) | Verified — cross-chat re-render cascade is gone. |
| rAF coalescence | Verified at the engine level. |
| SQLite append-only schema | Verified — no data-loss surfaces in audit. |
| Tombstone race | Fixed with transition + 5s debounce. |
| Codex error visibility | Verified empirically — unsupported-model errors now surface as chat bubbles. |
| Codex model picker (subscription tier) | Verified — `--model` flag wired through, catalog matches working models. |
| Live-log diagnostic workflow | Verified across multiple bug-hunt sessions. |
| Stable `useAgentSessions` reference | Verified — no more init-loop. |
| ACP type-system removal (Stage 1A) | Shipped 1f85761. `@agentclientprotocol/sdk` dropped from devDependencies; native types own the wire format. |
| ACP cosmetic cleanup (Stage 1B.1-3) | Shipped 71f7f66. CSS prefix `oc-acp-*` → `oc-agent-*`, localStorage key migrated, UI strings + comments swept. |
| Agent ID rename (Stage 1B.4) | Shipped 828f0a7 (with backward-compat); replaced 2026-04-27 by clean break. Canonical IDs `claude` / `codex` / `amp` are now the only accepted values. |
| Canonical message kinds declared (Stage 1A.8) | Shipped 0a2dcbb. Type union extended; dispatch + renderers land in Stages 3-4. |
| Clean ACP break (Stage 1C) | Shipped this rev. All backward-compat paths deleted: `agent-id-aliases.ts` removed, registry alias map removed, SQLite migration removed, workspace state migration removed, keychain prefix fallback removed, legacy localStorage key removed, `canonicalAgentId()` lookups stripped. The codebase no longer carries any ACP shape. **Breaking for users carrying forward pre-rename data:** chats with `agentId: "claude-acp"` no longer match an adapter; API keys saved under `acp::*` keychain prefix become unreadable; `zeros.acp.enabledAgents` localStorage is ignored. Acceptable per the user's "start fresh, no half-here state" decision. |

### Will be solid after Phase 1

| Area | Risk today | Mitigation in Phase 1 |
|---|---|---|
| Cursor tool calls don't render | Pre-existing gap | Stage 7 — `cursor/normalizer.ts` |
| Bash/Edit/Read/Grep/Web/Todo/Task render as generic card | Largest visible UX gap | Stages 3 + 4 — unified card system |
| Clarifying questions look like regular text; user has no reply UI | All 7 agents | §2.4.9 — question card with native + inferred paths |
| Mode auto-switches happen silently (Gemini enters plan mode; Claude exits) | Confusion about agent state | §2.4.13 — mode pill + auto-switch banner + ExitPlanMode permission card |
| Long Claude runs lose user prompt | Worry #2 | Stage 2 — per-turn sticky prompt + jump-by-text-message |
| Auto-scroll snaps even when reading | Worry #3 | Stage 2 — sticky-bottom with unstick |
| Compactness in 30-min runs | Worry #1 / #4 | Stages 3 + 4 default-collapse + Stage 5 run-summary roll-up + long-turn windowing |
| UI per agent, not unified | Worry #5 | §2.2 + §2.3 — canonical event taxonomy + adapter normalizers |
| Permission prompts as global bar | Disrupts focus during long runs | Stage 6 — inline permissions with sticky decisions |
| User can't see what context (CLAUDE.md/AGENTS.md/GEMINI.md) the agent loaded | Recurring confusion in agent IDEs | Stage 9 — project-context indicator chip (§2.9.5) |
| User can't see what an agent has memorized about their project | `/memory` slash command was TUI-only | Stage 9 — memory inspector in Settings → Agents (§2.9.6) |
| Per-agent capability regressions on CLI version bumps | E.g. Claude `Task` → `Agent` rename in v2.1.63; Codex `assistant_message` → `agent_message` rename | Stage 10 — per-agent capability test matrix (§2.9.8) |
| No path to cheap-alternative models (Kimi K2, Qwen3 via Ollama, GLM 4.5, DeepSeek V3 etc.) | Each adapter today is single-vendor | Stage 8.5 — OpenCode adapter (§2.10) opens 75+ model providers via Vercel AI SDK + models.dev |
| Defensive runtime checks on adapter capabilities ("does this adapter support setMode?") | Cluttered call sites | §2.10.2 — declarative `capabilities` struct on every adapter; UI reads it for enable/disable state |
| Hard to debug why a canonical event has the shape it has | Translators throw away native detail | §2.10.2 — `raw + providerRefs` fields on every canonical event; "view raw" debug capability for free |
| User config bleeds into agent runtime in ways we don't control (e.g. user-configured MCP server crashes our session) | Inconsistent across agents | §2.10.2 — per-adapter "config-neuter" mechanism table; OpenCode uses `OPENCODE_CONFIG_CONTENT={}` env (DPCode pattern) |

### Will be solid after Phase 2

| Area | Risk after Phase 1 | Mitigation in Phase 2 |
|---|---|---|
| Workspace state re-render cascade (canvas-side) | Same shape as Phase 0's chat bug, still present on canvas | §3.1 — workspace store Zustand migration |
| 1000+ messages keep all DOM nodes | Phase 1 helps via collapse + windowing; virtuoso closes the gap | §3.2 — react-virtuoso |
| Shiki on main thread | jank on streaming code blocks | §3.3 — worker mode |
| Tool-call follow-along O(N) | scales poorly | §3.4 — index map |
| WS queue duplicates | wasteful, not user-visible | §3.4 — dedup |
| 30 live iframes on canvas | memory pressure | §3.6 — IO virtualization + 6-iframe LRU |
| Full-tree IPC sync | wasteful at scale | §3.7 — delta protocol |
| Cold-start serial fetches | feels slow | §3.8 — cache-first startup |
| Bundle size 1.38MB | growth path unconstrained | §3.10 — bundle audit |

### Still risky after both phases (deferred / accept)

| Area | Risk | Why deferred |
|---|---|---|
| Engine sidecar Bun migration | Marginal wins, real native-module risk | §3.5 — explicitly decided to stay on Node; revisit only if profiling shows it's the bottleneck |
| WebGL canvas (replace React Flow) | Multi-month project | Out of Phase 2 scope; iframe virtualization (3.6) buys headroom; revisit if exhausted |
| Binary IPC protocol (Protobuf) | Build-system complexity | Not worth it at current message rates; revisit at >1k msg/s |
| Codex API-key auth | 12 unsupported models | §4.B — explicitly removed per user decision |
| TS strict-mode errors in `src/demo/main.tsx` | unrelated to chat path | Pre-existing, not on critical path |
| Engine source watcher SIGTERMs on every `src/engine/` edit | inherent to dev mode | Could narrow watcher to built artifacts; invasive, leave for now |

### Not at risk but worth noting

- **Concurrency in SQLite** — WAL handles concurrent reads + one writer fine at our scale.
- **Zustand subscribe + persistence subscriber loop** — fire-and-forget IPC, no re-entrancy.
- **xterm.js memory** — one xterm per live shell card; with default-collapsed and the long-turn windowing, the live count stays small (typically <10 simultaneously). If profiling shows otherwise, dispose on collapse.

---

## 6. Suggested order

### Phase 1 — Done (committed, pushed, tested)

| Stage | Commit | What shipped |
|---|---|---|
| 1A | [`1f85761`](https://github.com/Withso/zeros/commit/1f85761) | ACP type-system removal — `@agentclientprotocol/sdk` dropped from devDependencies; native types own the wire format (`src/zeros/bridge/agent-events.ts`); 27 type-only imports migrated |
| 1B.1-3 | [`71f7f66`](https://github.com/Withso/zeros/commit/71f7f66) | CSS prefix `oc-acp-*` → `oc-agent-*` (121 classes); localStorage key migrated; UI strings + comment sweep |
| 1B.4 | [`828f0a7`](https://github.com/Withso/zeros/commit/828f0a7) | Agent IDs `claude-acp`/`codex-acp`/`amp-acp` → `claude`/`codex`/`amp` with backward-compat (later replaced by 1C) |
| 1A.8 | [`0a2dcbb`](https://github.com/Withso/zeros/commit/0a2dcbb) | Canonical message kinds declared (Thinking / Plan / Question / ModeSwitch / Subagent / ErrorNotice) |
| 1C | [`af45f5e`](https://github.com/Withso/zeros/commit/af45f5e) | Clean ACP break — all backward-compat code deleted (alias map, SQLite migration, workspace state migration, keychain prefix fallback, legacy localStorage key) |
| 1C cleanup | [`1b3abb7`](https://github.com/Withso/zeros/commit/1b3abb7) | Final identifier renames (`acpMode` → `agentsBetaMode`, `failureFromAcpError` → `failureFromAgentError`, `handleAcpMessage` → `handleAgentMessage`) |

**Verified working** post-1C: agents panel populates, prompts to Cursor / Codex / Claude all return successful turns, build + typecheck clean, `@agentclientprotocol/sdk` zero-references confirmed.

### Phase 1 — Next, in order

| # | Stage | Time | What |
|---|---|---|---|
| **1** | **Stage 2 — Long-run UX foundation** | ~2d | Sticky-bottom auto-scroll with unstick; per-turn `<TurnContainer>`; sticky user prompt at top of active turn; "Jump to my prompt" + "Jump to latest" pills; `Cmd+Up/Down` jump-by-text-message keybind; per-chat scroll memory in Zustand+SQLite. Highest-impact UX delta. |
| **2** | **Stage 3 — Card system part 1: Shell, Edit, Read** | ~2d | `tool-shell.tsx` (xterm DOM renderer), `tool-edit.tsx` (diff with patch + replacement modes), `tool-read.tsx` (collapsed preview). Default-collapsed; status badges; width-adaptive diffs. Highest-volume cards ship first. |
| **3** | **Stage 4 — Card system part 2** | ~2.5d | Search + Plan + Thinking + Question + Error + Usage + Subagent + Fetch + MCP. State-merging via `mergeKey` (TodoWrite as one live block). Includes the §2.4.13 mode pill + auto-switch banner. |
| **4** | **Stage 5 — Long-run UX completion** | ~1.5d | Run-summary roll-up after turn ends; vertical timeline rail (left gutter); long-turn windowing (last K=20 + chevron for older); activity HUD pinned to composer footer; global Stop replaces Send during run; streaming markdown chunking. **Plus context-usage display fix (carryover from Stage 3 testing — see §2.4.x below).** |
| **5** | **Stage 6 — Inline permissions + mode controls** | ~1.5d | Move permission UI from global bar to per-tool-card cluster; "Always for X" sticky decisions persisted per chat; mode pill in composer (Phase / Permission / Tier axes); auto-switch banner; ExitPlanMode special permission card. |
| **6** | **Stage 7 — Codex + Cursor normalizers** (Track 4.A) | ~1.5d | `codex/normalizer.ts` translates `item.*` events → canonical. `cursor/normalizer.ts` translates Cursor's `tool_call` events → canonical (closes the long-standing Cursor-no-tool-calls gap). |
| **7** | **Stage 8 — Gemini + Copilot + Amp + Droid normalizers** | ~2d | Remaining stream-json/PTY adapters. Gemini's `enter_plan_mode`/`exit_plan_mode` autonomous switching surfaces as canonical `mode.switch` events. Copilot ACP `current_mode_update` notifications. |
| **8** | **Stage 8.5 — OpenCode adapter (server-attached)** (§2.10.4) | ~1.5-2d | Spawn `opencode serve --port <random>`, attach `@opencode-ai/sdk`, consume SSE bus. SSE-bus → canonical translator (mapping table in §2.10.4). `OPENCODE_CONFIG_CONTENT={...}` env to neuter user config (DPCode trick). Hydrate model picker from `client.provider.list()`. Inject design-tools MCP via `POST /mcp`. **This unlocks the cheap-alternative-models story** — Kimi K2, Qwen3 via Ollama, GLM 4.5, DeepSeek V3, etc. |
| **9** | **Stage 9 — Project-context indicator + Memory inspector** (§2.9.5 + §2.9.6) | ~1d | Chat-header chip showing loaded `CLAUDE.md`/`AGENTS.md`/`GEMINI.md`/`OPENCODE` context files; Settings → Agents memory viewer per agent. Both file-system-driven, no bridge changes. |
| **10** | **Stage 10 — Per-agent capability test matrix run** (§2.9.8) | ~1.5d | Execute the 7-test corpus against all 8 agents (Claude, Codex, Cursor, Gemini, Copilot, Amp, Droid, OpenCode). Document pass/fail per test in `docs/AGENT_CAPABILITY_TEST_MATRIX.md`. CLI versions recorded. Re-run on minor version bumps. |
| **11** | **Track 4.C HMR Fast Refresh** | 30 min | Split `sessions-provider.tsx` so Vite Fast Refresh works on it. Drop-in dev win. |

**Phase 1 budget:** ~16 days serial (was ~14d before adding Stage 8.5 OpenCode). With parallelization (cards in Stages 3 + 4, normalizers in Stages 7/8/8.5) and one developer: ~11-12 days. Two developers: ~8 days.

### Phase 2 — After Phase 1 lands

| # | Stage | Time | What |
|---|---|---|---|
| 11 | Phase 2.1 — Workspace store Zustand migration | ~3-4d | Highest-leverage canvas-side change. Blocks 14 (iframe virt) and 15 (delta IPC). |
| 12 | Phase 2.2-2.4 — Virtuoso + Shiki worker + tool-call index + WS dedup | ~2d | Parallelizable with 11 once contract is stable. |
| 13 | Phase 2.5 — Engine sidecar runtime decision | (decision-only) | Stay on Node unless profiling proves otherwise; documented in §3.5. |
| 14 | Phase 2.6 — Canvas iframe virtualization | ~2d | Depends on 11. |
| 15 | Phase 2.7 — IPC delta protocol | ~2d | Depends on 11. |
| 16 | Phase 2.8-2.10 — Cache-first startup + non-blocking boot + bundle audit | ~2-3d | Parallelizable. |
| 17 | Phase 2.11 — SQLite windowed view | ~1d | Optional polish; pairs with Virtuoso (12). |

### Notes on parallelization

Most of Phase 1 parallelizes well — the registry pattern was specifically designed so each card's a standalone file. Shipping one card per day for a week is realistic with two of us; one card every 1.5 days alone.

The long-run UX foundation (Stage 2 above) is the riskiest piece because sticky-positioning + (eventually) virtuoso + variable card heights interact subtly; budget extra time to profile in real long runs.

Stages 7 + 8 + 8.5 (per-agent normalizers) parallelize across agents but each one has its own quirks — Codex's item-types, Cursor's stream-json shape, Gemini/Copilot's PTY-based event extraction, Droid's spec mode, **OpenCode's server-first SSE bus** (the structurally most-different of the eight). Don't try to ship them all on the same day; ship one, run the relevant capability tests (Stage 10), then move to the next.

**Stage 8.5 (OpenCode) is the most novel** — it's the only adapter where we manage a long-lived child server (not a per-prompt subprocess), parse SSE events (not NDJSON), and hydrate the model catalog from a runtime API call (not a static catalog file). It's also the only adapter where users can pick from 75+ model providers (cheap alternatives like Kimi K2 via OpenRouter, local Ollama models, etc.). DPCode's `OpenCodeAdapter.ts` (2,337 lines, MIT) is a working reference.

Stage 10 (capability test matrix) is *not* a single big stage — run the relevant subset of tests after each adapter is finalized in Stages 7 + 8 + 8.5. The Stage 10 milestone is "all 8 agents have a published row in the matrix and any failed tests have a tracked-defect note."

---

## 7. End-state vision

After Phase 1 + 2:

- Every CLI agent's tool call has a purpose-built card matching Conductor / Cursor density, identical across agents.
- 30-minute Claude runs feel compact: one plan panel, ~30 single-line tool entries, ~5 collapsed thinking chevrons, a few text blocks. The user's prompt stays visible at the top of the active turn for the whole 30 minutes.
- Every chat is virtualized; 10,000-message transcripts are smooth.
- The canvas runs at ≤6 live iframes regardless of variant count, snapshot-fallback off-screen.
- The workspace store is sliced; updating one variant's CSS doesn't touch the inspector's render path; chat updates don't touch the canvas.
- Element-tree IPC is delta-only after the initial sync.
- Cold start renders the sidebar from cache before the engine connects.
- Bundle is meaningfully lighter; binary trim audit ships at least 30-40% of the reachable margin.
- Every supported agent (Claude, Codex, Cursor, Amp, Droid, Copilot, Gemini, **OpenCode**) renders through the same canonical event pipeline. Adding the next agent — including any future API-direct adapter (§2.8) — is: spec + normalizer + register the adapter. Renderers come for free.
- Users have access to 75+ model providers via OpenCode (§2.10) — Kimi K2 via OpenRouter, Qwen3 via local Ollama, GLM 4.5, DeepSeek V3, etc. — without us building per-model adapter logic. The cheap-alternative-models story is "use OpenCode" instead of "we built our own."
- Permissions are inline, with persistent "Always for X" decisions; long runs no longer get interrupted by 14 modal prompts.
- Every CLI's native capabilities (memory, skills, subagents, MCP, project context) flow through unchanged because we drive the CLI, we don't replace it (§2.9). The user runs `claude /login` or installs a skill in `~/.claude/skills/` and Zeros immediately sees it without any glue code on our side.
- Users can see, from the chat header, which `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` files the agent has loaded for the current project (project-context chip, §2.9.5). And from Settings → Agents, what the agent has memorized about their work (memory inspector, §2.9.6). No `/memory` TUI required.
- A published per-agent capability test matrix (`docs/AGENT_CAPABILITY_TEST_MATRIX.md`, §2.9.8) documents which features work in which CLI version. Bumping a CLI ships a re-run; regressions surface as a row turning red, not as a silent "this used to work" mystery.

That's the *"design tools and layers added on top won't bog down the chat — and the chat won't bog down the design tools either"* posture this all started from — combined with the *"every CLI's full power, surfaced in our UI, with no maintenance race"* posture that came out of the 2026-04-27 capability discussion.

---

## 8. References

External research and source citations underlying this rev. Verified during research on 2026-04-27.

### Agent CLI streaming protocols

- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Claude Code streaming output (Agent SDK)](https://code.claude.com/docs/en/agent-sdk/streaming-output)
- [Anthropic Streaming Messages](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [OpenAI Codex non-interactive mode](https://developers.openai.com/codex/noninteractive)
- [OpenAI Codex CLI features](https://developers.openai.com/codex/cli/features)
- [OpenAI Codex changelog](https://developers.openai.com/codex/changelog)
- [Cursor CLI output format](https://cursor.com/docs/cli/reference/output-format)
- [Prettifying Cursor CLI Agent's stream format (tarq.net)](https://tarq.net/posts/cursor-agent-stream-format/)
- [Gemini CLI headless mode](https://geminicli.com/docs/cli/headless/)
- [Gemini CLI tools reference](https://geminicli.com/docs/reference/tools/)
- [GitHub Copilot CLI repo](https://github.com/github/copilot-cli)
- [ACP support in Copilot CLI public preview (changelog)](https://github.blog/changelog/2026-01-28-acp-support-in-copilot-cli-is-now-in-public-preview/)
- [Agent Client Protocol introduction](https://agentclientprotocol.com/get-started/introduction)
- [Amp Owner's Manual](https://ampcode.com/manual)
- [Amp manual appendix (stream-json schema)](https://ampcode.com/manual/appendix)
- [Amp streaming JSON announcement](https://ampcode.com/news/streaming-json)
- [Factory Droid Exec tutorial](https://docs.factory.ai/guides/building/droid-exec-tutorial)
- [OpenCode docs](https://opencode.ai/docs/)
- [OpenCode CLI reference](https://opencode.ai/docs/cli/)
- [OpenCode server (HTTP + SSE bus)](https://opencode.ai/docs/server/)
- [OpenCode SDK (`@opencode-ai/sdk`)](https://opencode.ai/docs/sdk/)
- [OpenCode providers (75+)](https://opencode.ai/docs/providers/)
- [OpenCode agents (primary + subagent)](https://opencode.ai/docs/agents/)
- [OpenCode tools (16 built-in)](https://opencode.ai/docs/tools/)
- [OpenCode rules (AGENTS.md / CLAUDE.md compat)](https://opencode.ai/docs/rules/)
- [OpenCode skills](https://opencode.ai/docs/skills/)
- [OpenCode plugins](https://opencode.ai/docs/plugins/)
- [OpenCode permissions](https://opencode.ai/docs/permissions/)
- [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers/)
- [OpenCode Zen gateway](https://opencode.ai/docs/zen/)
- [OpenCode GitHub repo](https://github.com/sst/opencode) (MIT)

### Reference IDE wrappers

- [DPCode (Emanuele-web04/dpcode)](https://github.com/Emanuele-web04/dpcode) — Electron + Effect-TS multi-agent IDE; integrates Claude / Codex / Gemini / OpenCode behind a single `ProviderAdapterShape<TError>` contract. MIT, ~273 stars, very active. Reference impl studied for §2.10 patterns.
- [DPCode `ProviderAdapter.ts`](https://github.com/Emanuele-web04/dpcode/blob/main/apps/server/src/provider/Services/ProviderAdapter.ts) — the adapter contract we mirror.
- [DPCode `OpenCodeAdapter.ts`](https://github.com/Emanuele-web04/dpcode/blob/main/apps/server/src/provider/Layers/OpenCodeAdapter.ts) — 2,337-line working OpenCode integration; reference for our Stage 8.5.
- [DPCode `providerRuntime.ts`](https://github.com/Emanuele-web04/dpcode/blob/main/packages/contracts/src/providerRuntime.ts) — 44-event canonical taxonomy; informed our `raw + providerRefs` pattern.

### Long-run agent UX patterns

- [Cursor 3.0 changelog](https://cursor.com/changelog/3-0)
- [Cursor — Expanding our long-running agents research preview](https://cursor.com/blog/long-running-agents)
- [Cursor forum — Agent chat window scrolling broken (#151105)](https://forum.cursor.com/t/agent-chat-window-scrolling-broken/151105)
- [Cursor forum — Scroll position when changing agent tabs (#149377)](https://forum.cursor.com/t/scroll-position-when-changing-agent-tabs/149377)
- [Claude Code — Use Claude Code in VS Code](https://code.claude.com/docs/en/vs-code)
- [Claude Code — Permission modes](https://code.claude.com/docs/en/permission-modes)
- [Claude Code — Auto mode (Anthropic engineering)](https://www.anthropic.com/engineering/claude-code-auto-mode)
- [Claude Code Internals, Part 11: Terminal UI (Marco Kotrotsos)](https://kotrotsos.medium.com/claude-code-internals-part-11-terminal-ui-542fe17db016)
- [Claude Code issue #36146 — First user message stays pinned in VS Code panel](https://github.com/anthropics/claude-code/issues/36146)
- [Claude Code issue #36006 — Show extended thinking in CLI output](https://github.com/anthropics/claude-code/issues/36006)
- [Claude Code issue #42733 — Tool output trimmed in terminal UI](https://github.com/anthropics/claude-code/issues/42733)
- [Claude Code issue #1173 — TodoWrite updates inside Task tool](https://github.com/anthropics/claude-code/issues/1173)
- [Claude Code's thinking animation (Alex Beals)](https://blog.alexbeals.com/posts/claude-codes-thinking-animation)
- [Conductor changelog](https://www.conductor.build/changelog)
- [Conductor 0.49 Allegro changelog](https://www.conductor.build/changelog/0.49.0-conductor-allegro-gpt-5-5)
- [Zed — Agent Panel docs](https://zed.dev/docs/ai/agent-panel)
- [Zed — Agent settings docs](https://zed.dev/docs/ai/agent-settings)
- [Zed DeepWiki — Agent Panel and UI Components](https://deepwiki.com/zed-industries/zed/11.4-agent-connection-and-backends)
- [OpenCode — TUI docs](https://opencode.ai/docs/tui/)
- [OpenCode DeepWiki — TUI Architecture / Tool Framework](https://deepwiki.com/sst/opencode/6.1-tool-framework)
- [T3 Chat](https://t3.chat/)
- [Aider in-chat commands](https://aider.chat/docs/usage/commands.html)
- [Continue — Quick Start (Agent)](https://docs.continue.dev/ide-extensions/agent/quick-start)
- [Goose (block/goose) GitHub](https://github.com/block/goose)
- [Cline GitHub](https://github.com/cline/cline)
- [Sourcegraph Amp](https://sourcegraph.com/amp)

### UX research / interaction patterns

- [NN/g — Designing Scroll Behavior: When to Save a User's Place](https://www.nngroup.com/articles/saving-scroll-position/)
- [LogRocket — Choosing the right scrolling design pattern](https://blog.logrocket.com/ux-design/creative-scrolling-patterns-ux/)
- [Streamlit discussion — Anchor/stick the most recent user message](https://discuss.streamlit.io/t/anchor-stick-the-most-recent-user-message-to-the-top-of-a-container/111675)
- [Dave Lage — Streaming chat scroll to bottom with React](https://davelage.com/posts/chat-scroll-react/)
- [GetStream — VirtualizedMessageList](https://getstream.io/chat/docs/sdk/react/components/core-components/virtualized_list/)
- [LogRocket — react-virtualized vs react-window](https://blog.logrocket.com/react-virtualized-vs-react-window/)
- [PromptLayer — How to Stop ChatGPT Autoscroll](https://blog.promptlayer.com/how-to-stop-chatgpt-autoscroll/)
