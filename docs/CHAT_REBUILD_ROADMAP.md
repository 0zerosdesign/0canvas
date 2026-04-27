# Chat Rebuild — Forward Roadmap (rev. 2026-04-27)

**Companion to:** [CHAT_REBUILD_PHASE_0.md](./CHAT_REBUILD_PHASE_0.md) (the retrospective).
**Status:** Phase 0 shipped in `2be41ae`. This rev replaces the previous draft, removing the Codex API-key parallel track (deferred indefinitely — CLI subscription auth is the only supported flow), expanding Phase 1 with the unified-renderer + long-run UX work the user asked for, and folding the original Phase 2 + Phase 3 into a single performance/architecture phase merged with the 360-degree migration audit.

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

The reason this isn't trivial is that the seven CLIs we support emit seven different shapes:

- **Claude Code** wraps Anthropic's streaming API events: `content_block_start` / `content_block_delta` (with `text_delta`, `thinking_delta`, `input_json_delta` subtypes) / `content_block_stop` / `message_delta` / `message_stop` plus `system`, `assistant`, `user`, `result` envelope messages, with `parent_tool_use_id` linking subagent events. ([code.claude.com/docs/en/agent-sdk/streaming-output](https://code.claude.com/docs/en/agent-sdk/streaming-output))
- **Codex** uses item-types: `thread.started`, `turn.started`, `item.started`, `item.updated`, `item.completed`, `turn.completed`, `turn.failed`, with item subtypes `agent_message`, `reasoning`, `command_execution`, `file_change`, `mcp_tool_call`, `web_search`, `plan_update`. ([developers.openai.com/codex/noninteractive](https://developers.openai.com/codex/noninteractive))
- **Cursor** emits `system` (init), `user`, `assistant` (one chunk per turn — no token streaming), `tool_call` (with `subtype: "started" | "completed"`), `result`. **Thinking is explicitly suppressed in print mode.** ([cursor.com/docs/cli/reference/output-format](https://cursor.com/docs/cli/reference/output-format))
- **Gemini** emits `init`, `message`, `tool_use`, `tool_result`, `error`, `result`. Thinking surface is undocumented. ([geminicli.com/docs/cli/headless](https://geminicli.com/docs/cli/headless/))
- **Copilot** is the structural odd-one-out: it uses bidirectional **JSON-RPC over stdio** via the Agent Client Protocol (`copilot --acp`). Notifications come through `session/update` with variants `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `plan`. Tool calls have a real `tool_call_update` mid-flight progress event that nobody else has. ([github.blog/changelog/2026-01-28-acp-support-in-copilot-cli-is-now-in-public-preview](https://github.blog/changelog/2026-01-28-acp-support-in-copilot-cli-is-now-in-public-preview/))
- **Amp** mirrors Claude's shape (`system`, `user`, `assistant`, `result`) with `--stream-json-thinking` to expose `thinking` / `redacted_thinking` content blocks. ([ampcode.com/manual](https://ampcode.com/manual))
- **Droid** emits `system`, `message`, `tool_call`, `tool_result`, `assistant_chunk`, `completion`, `exit`. Thinking surface is undocumented. ([docs.factory.ai/guides/building/droid-exec-tutorial](https://docs.factory.ai/guides/building/droid-exec-tutorial))

The unification strategy is the standard one: a canonical event vocabulary in the middle, with adapter-side normalizers that translate native events into the canonical set, and renderers that consume only canonical events. We already have the rough shape of this (the renderer registry resolves by message kind), but the message kinds today are bound to the ACP-ish subset Claude/Amp emit. Phase 1 generalizes the kind system.

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

This vocabulary covers every observed event across the seven CLIs. Some agents emit a strict subset (Cursor never emits `thinking.chunk`; Droid never emits `subagent.*`); the renderers handle absence gracefully — a missing thinking block is invisible, not stubbed. This is critical for the user's "unified UI" requirement: the *contract* is unified even when an agent doesn't fill every field.

### 2.3 Adapter normalizers — where agent dialects collapse

Each adapter under [src/engine/agents/adapters/](../src/engine/agents/adapters/) gets a `Normalizer` module that consumes the agent's native stream and emits canonical events. The shared work that Phase 0's `stream-json-adapter` already does (line buffering, JSON parse, fail-loud on missing terminal events) becomes the substrate; the per-agent translator becomes a normalizer.

The hard part is the **canonical tool kind**. Every agent has its own tool names (`Bash` vs `shell` vs `run_shell_command` vs `Execute`), and some agents express what other agents call distinct tools as flavors of one tool (Codex routes Read/Grep through `shell`). The mapping table lives in the adapter and is the contract:

| Canonical kind | Claude tools | Codex items | Cursor tools | Gemini tools | Amp tools | Droid tools |
|---|---|---|---|---|---|---|
| `shell` | `Bash` | `command_execution` | `shellToolCall` | `run_shell_command` | `Bash` | `Execute` |
| `read` | `Read` | (via shell `cat`) | `readToolCall` | `read_file`, `read_many_files` | `Read` | `Read` |
| `edit` | `Edit`, `MultiEdit`, `Write` | `file_change` (apply_patch) | `editToolCall`, `writeToolCall` | `replace`, `write_file` | `Edit` | `ApplyPatch` |
| `search` | `Grep`, `Glob` | (via shell `rg`/`find`) | `grepToolCall`, `globToolCall` | `grep_search`, `glob`, `list_directory` | `Grep` (+ Glob) | (via shell) |
| `fetch` | `WebFetch` | `web_search` (live mode) | — | `web_fetch` | web browsing | — |
| `web_search` | `WebSearch` | `web_search` | — | `google_web_search` | — | — |
| `todo` | `TodoWrite` | `plan_update` | `todoToolCall`, `updateTodosToolCall` | `write_todos` | `TodoWrite` | — |
| `subagent` | `Task` | — | — | — | `Task` | — |
| `mcp` | (any MCP tool) | `mcp_tool_call` | (any MCP tool) | (any MCP tool) | (any MCP tool) | (any MCP tool) |
| `other` | (anything else) | (anything else) | (anything else) | (anything else) | (anything else) | (anything else) |

Crucial decision: **for Codex and Droid, we do *not* try to upgrade `shell cat foo.ts` into a `read` card.** That would mean parsing shell strings in the adapter, which fails the moment the user pipes (`cat foo.ts | head -20`) or quotes (`grep "foo bar" file`) or chains (`cat foo && echo done`). The adapter renders those as `shell` cards and trusts the user to read the command. Across-agent unification means *the same canonical kind renders identically*; it does not mean *every agent emits every kind*.

Adapters live at:

- [src/engine/agents/adapters/claude/normalizer.ts](../src/engine/agents/adapters/claude/normalizer.ts) (new) — wraps `ClaudeStreamTranslator`
- [src/engine/agents/adapters/codex/normalizer.ts](../src/engine/agents/adapters/codex/normalizer.ts) (new) — wraps `CodexTranslator`
- [src/engine/agents/adapters/cursor/normalizer.ts](../src/engine/agents/adapters/cursor/normalizer.ts) (new) — wraps Cursor stream-json (also fixes Track A)
- [src/engine/agents/adapters/gemini/normalizer.ts](../src/engine/agents/adapters/gemini/normalizer.ts) (new) — for Gemini headless
- [src/engine/agents/adapters/copilot/normalizer.ts](../src/engine/agents/adapters/copilot/normalizer.ts) (new) — bridges ACP JSON-RPC notifications
- [src/engine/agents/adapters/amp/normalizer.ts](../src/engine/agents/adapters/amp/normalizer.ts) (new)
- [src/engine/agents/adapters/droid/normalizer.ts](../src/engine/agents/adapters/droid/normalizer.ts) (new)

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

These are the only places agent identity surfaces in the renderer. Everywhere else, the rule is: same card, same chrome, regardless of which agent emitted it.

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

### Will be solid after Phase 1

| Area | Risk today | Mitigation in Phase 1 |
|---|---|---|
| Cursor tool calls don't render | Pre-existing gap | Track 4.A — `cursor/normalizer.ts` |
| Bash/Edit/Read/Grep/Web/Todo/Task render as generic card | Largest visible UX gap | §2.4 — unified card system |
| Clarifying questions look like regular text; user has no reply UI | All 7 agents | §2.4.9 — question card with native + inferred paths |
| Mode auto-switches happen silently (Gemini enters plan mode; Claude exits) | Confusion about agent state | §2.4.13 — mode pill + auto-switch banner + ExitPlanMode permission card |
| Long Claude runs lose user prompt | Worry #2 | §2.5.1 + §2.5.7 — per-turn sticky prompt + jump-by-text-message |
| Auto-scroll snaps even when reading | Worry #3 | §2.5.2 — sticky-bottom with unstick |
| Compactness in 30-min runs | Worry #1 / #4 | §2.4 default-collapse + §2.5.5 run-summary roll-up + §2.5.6 long-turn windowing |
| UI per agent, not unified | Worry #5 | §2.2 + §2.3 — canonical event taxonomy + adapter normalizers |
| Permission prompts as global bar | Disrupts focus during long runs | §2.6 — inline permissions with sticky decisions |

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

Serial path:

1. **Phase 1.A — Canonical event taxonomy + Claude/Amp/Codex normalizers** (3 days). Lands the contract; existing functionality keeps working because adapters emit the same shapes Claude already emitted, just routed through the canonical layer.
2. **Phase 1.B — Cursor normalizer** (Track 4.A, 0.5-1 day, parallel with #1's tail). Closes the longest-standing user-visible gap.
3. **Phase 1.C — Long-run UX kit** (3 days). Sticky per-turn prompt, sticky-bottom-with-unstick, jump pills, jump-by-text-message keybind, per-chat scroll memory, run summary roll-up, vertical timeline rail. Single highest-impact UX delta.
4. **Phase 1.D — Card system: Shell, Edit, Read, Search, Plan, Thinking** (4 days, parallelizable). Each card is a self-contained file. Shell and Edit ship first because they're the highest-volume.
5. **Phase 1.E — Card system: Fetch, Subagent, Question, Error, Usage, MCP** (1.5 days, parallelizable).
6. **Phase 1.F — Inline permissions with sticky decisions** (1 day).
7. **Phase 1.G — Gemini / Copilot / Droid normalizers** (1.5 days, parallelizable). Each agent gets a normalizer; renderers come for free.
8. **Track 4.C HMR Fast Refresh** (30 min). Drop-in dev win.
9. **Phase 2.1 — Workspace store Zustand migration** (3-4 days). Highest-leverage canvas-side change. Blocks 3.6 / 3.7.
10. **Phase 2.2-2.4 — Virtuoso + Shiki worker + tool-call index + WS dedup** (2 days, parallelizable with 9 once contract is stable).
11. **Phase 2.6 — Canvas iframe virtualization** (2 days; depends on 9).
12. **Phase 2.7 — IPC delta protocol** (2 days; depends on 9).
13. **Phase 2.5 — Engine sidecar runtime decision** (decision lands without code change; profile before re-opening).
14. **Phase 2.8-2.10 — Cache-first startup + non-blocking boot + bundle audit** (2-3 days, parallelizable).
15. **Phase 2.11 — SQLite windowed view** (1 day).

Most of Phase 1 parallelizes well — the registry pattern was specifically designed so each card's a standalone file. Shipping one card per day for a week is realistic with two of us; one card every 1.5 days alone. The long-run UX kit (#3) is the riskiest piece because sticky-positioning + virtuoso + variable card heights interact subtly; budget extra time to profile in real long runs.

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
- Every supported agent (Claude, Codex, Cursor, Amp, Droid, Copilot, Gemini) renders through the same canonical event pipeline. Adding the next agent is: spec + normalizer + register the adapter. Renderers come for free.
- Permissions are inline, with persistent "Always for X" decisions; long runs no longer get interrupted by 14 modal prompts.

That's the *"design tools and layers added on top won't bog down the chat — and the chat won't bog down the design tools either"* posture this all started from.

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
