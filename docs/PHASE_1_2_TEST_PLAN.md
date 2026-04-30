# Phase 1 + Phase 2 — End-to-End Test Plan

**Created:** 2026-04-29 · **Last update:** 2026-04-29 (subagent nesting + redacted thinking + MCP rich content + tool-call cursor) · **Companion to:** [CHAT_REBUILD_ROADMAP.md](./CHAT_REBUILD_ROADMAP.md)

This is a storytelling-format test plan you walk through as the user. Each scenario tells you what to do, what to expect, and what's behind it. Use the **Status** field to skip scenarios whose implementation is genuinely not shipped yet.

Status legend:

- ✓ **Shipped** — should work end-to-end. Test it and report any failure.
- ⚠ **Partial** — main path works but a sub-feature is deliberately deferred. Test the main path; the sub-feature gap is noted.
- ✗ **Not implemented** — skip; it's on the not-done list at the bottom.

Run the tests in order. Earlier tests set up state later tests rely on (chats, scroll positions, policies, etc.).

---

## Quick orientation — what's done vs not

**Phase 1 (DONE in earlier commits):** ACP type-system removal, CSS prefix migration, agent ID rename, canonical message kinds declared, clean ACP break — all shipped through commit `1b3abb7`.

**Phase 2 — chat-side experience (done):**

- Stage 1 — Long-run UX foundation ✓
- Stage 2 — Card system pt.1 (Shell, Edit, Read) ✓
- Stage 3 — Card system pt.2 (Search, Plan, Thinking, Question, Error, Subagent, Fetch, MCP, Mode banner) ✓ (with three minor sub-feature deferrals — see "Not done" at end)
- Stage 4 — Long-run UX completion (run-summary, rail, windowing, HUD, Stop, streaming markdown, context pill) ✓
- Stage 5 — Inline permissions + mode controls ✓

**Phase 2 — adapter & polish (also done, less battle-tested):**

- Stage 6 — Codex + Cursor normalizers ✓ (translators exist; cross-agent unification needs empirical run-through)
- Stage 7 — Gemini + Copilot + Droid normalizers ✓ (same caveat)
- Stage 8 — OpenCode adapter ✓ (server-attached, 649-line `adapter.ts`)
- Stage 9 — Project-context chip + memory inspector ✓
- Stage 10 — Capability test matrix published in [AGENT_CAPABILITY_TEST_MATRIX.md](./AGENT_CAPABILITY_TEST_MATRIX.md) ✓

**Phase 2 — Stage 11 partial + Track 5.C done (2026-04-29 update):**

- Track 5.C — HMR Fast Refresh fix ✓ (sessions-provider split into provider/hooks/context files)
- Stage 11.2 — Shiki worker mode ✓ (highlights now run off-main-thread; main-thread fallback when Worker unavailable)
- Stage 11.4 — WebSocket queue dedup ✓ (idempotent requests dedup by `(type, sessionId|chatId)`; per-type cap on `AGENT_LOAD_SESSION` etc.)
- Stage 11.4 — "Load older messages" affordance ✓ (button at top of message list pages older transcript from SQLite; viewport position preserved)
- Stage 11.1 — Lighter alternative shipped (`content-visibility: auto` on inactive turns); **full react-virtuoso deferred** to avoid regressing sticky-prompt + Cmd+↑/↓ keybind which traverse DOM directly
- Inferred-from-text question heuristic ✓ (quick-reply banner under agent text that ends with `?` or has a numbered option list)

**Also shipped 2026-04-29 (later in the day):**

- Stage 11.3 — Tool-call follow-along is now incremental (cursor-based forward sweep) instead of full re-scan ✓
- §2.4.7 — Subagent nested transcript ✓ (Claude adapter forwards `parent_tool_use_id`; renderer groups child events under the parent SubagentCard with indented left-border accent)
- §2.4.8 — Redacted thinking badge ✓ (Claude adapter detects `redacted_thinking` blocks; renderer shows a distinct "redacted" pill instead of char count)
- MCP rich content blocks ✓ (image content blocks render as `<img>`; resource blocks show URI + text/blob preview; audio blocks render with `<audio controls>`; resource_link blocks render as a download badge)

**Still NOT done:**

- Stage 11.1 full — react-virtuoso virtualization (deferred — `content-visibility: auto` covers the practical perf gap up to several thousand messages; full virtuoso would risk regressing sticky prompt + Cmd+↑/↓)
- Plan mutation modes (`patch`/`append` — adapters use `replace`, functionally equivalent today; would be dead code without an adapter that emits them)
- Thinking shows `chars` not `tokens` — Claude doesn't expose per-block token counts (`usage.thinking_tokens` is turn-aggregate); estimating from char count would be misleading
- Goose-style rich MCP-UI widgets (separate spec from MCP core; needs `@mcp-ui/client` or similar component library)

The chat is **functionally complete and performant** today.

---

## Setup

Before starting:

1. Run `pnpm electron:dev` to launch the app.
2. Make sure at least these CLIs are installed and authenticated:
  - `claude` (Claude Code) — `claude /login` once.
  - `codex` (OpenAI Codex) — `codex login` once.
  - One of: `cursor-agent` / `gemini` / `droid` / `copilot` / `opencode` for cross-agent tests.
3. Open a real test project (any non-trivial git repo, ideally with > 20 files). The roadmap testing in this repo itself works fine.
4. Have the dev tools console open — you'll occasionally watch for warnings.

If any of these CLIs aren't available, skip the scenarios marked **(needs <agent>)**. The chat experience tests below all run on Claude alone.

---

# Journey 1 — First launch and orientation

## 1.1 Cold start renders without flicker

**Status:** ✓ Shipped

**Story:** You quit the app a week ago. Today you launch it cold. The sidebar should paint instantly with all your old chats, even before the engine connects.

**Steps:**

1. Quit the app fully (Cmd+Q on Mac).
2. Launch `pnpm electron:dev`.
3. Watch the first second carefully.

**Expected:**

- Sidebar populates immediately with chats from local cache (localStorage) — no spinner-then-list flash.
- A "connecting…" indicator appears briefly somewhere subtle (composer footer pill).
- Once the engine connects, the indicator disappears. Chats are clickable.
- If localStorage is empty (e.g. fresh install) but SQLite has chats, they recover within a second from the durable store.

**Counter-pattern to flag:** sidebar showing empty-state for >1 second on cold start, then snapping populated.

**Files:** [src/app-shell.tsx:395-462](../src/app-shell.tsx#L395)

---

## 1.2 Agent picker shows what you have installed

**Status:** ✓ Shipped

**Story:** You want to confirm Zeros sees your locally-installed CLIs.

**Steps:**

1. Click the agent picker (top of an empty composer or via Settings → Agents).
2. Look at the list of available agents.

**Expected:**

- Each installed agent shows as **available** (not greyed).
- Each missing agent shows as install-needed with the appropriate `npm install -g …` hint.
- Login state is probed without ever reading credentials — agents you haven't run `<agent> login` for show as "needs auth."

**Counter-pattern:** Zeros showing an agent as "missing" when you can run it from Terminal.

---

# Journey 2 — Sending your first prompt

## 2.1 Send a simple prompt and watch the response stream

**Status:** ✓ Shipped

**Story:** Sanity check. The agent responds, text streams in chunks, the chrome looks right.

**Steps:**

1. Create a fresh chat: New Chat → Claude.
2. Type *"Hello, who are you?"* and press Enter.
3. Watch the response.

**Expected:**

- Composer's primary button transforms from **icon-only Send** (paper plane) to **labeled `[■ Stop]`** (red destructive variant) the moment the prompt fires.
- Your prompt renders as a user message bubble, then sticks to the top of the viewport (sticky positioning).
- Activity HUD appears at composer footer: agent name + current state + elapsed time + Stop affordance.
- Assistant text chunks appear progressively — markdown formatting works, code blocks highlight.
- When done, the Stop button reverts to Send. HUD clears.

**Counter-pattern:** Stop button stays as `Stop` after completion (cancel-debounce not clearing).

**Files:** [src/zeros/agent/agent-chat.tsx:1129-1157](../src/zeros/agent/agent-chat.tsx#L1129) (Stop swap), [activity-hud.tsx](../src/zeros/agent/activity-hud.tsx)

---

## 2.2 Sticky user prompt during a long response

**Status:** ✓ Shipped — the highest-leverage long-run UX feature.

**Story:** You ask a complex question. The agent talks for a while. You scroll down to read its answer. Your original question stays visible at the top so you don't lose your place.

**Steps:**

1. In the same chat, send: *"Explain TypeScript's type system in detail with code examples"* (long-streaming response).
2. While the response streams, scroll down through the assistant text.
3. Look at the top of the viewport.

**Expected:**

- Your prompt is **stuck to the top** of the viewport for the entire turn.
- If the prompt is short (≤3 lines), it shows in full.
- If the prompt is >3 lines, it auto-collapses to a single-line preview `[You: Explain TypeScript… ▾]` with a chevron. Click → expands to full prompt as a popover.

**Steps continued:**

4. Send a *new* prompt (e.g. *"thanks"*).

**Expected:**

- The previous turn's prompt **unsticks** and scrolls naturally with the rest of history.
- The new prompt becomes the new sticky.

**Counter-pattern:** prompt staying stuck after a new turn starts (sticky doesn't release).

**Files:** [turn-container.tsx:119-182](../src/zeros/agent/turn-container.tsx#L119)

---

## 2.3 Sticky-bottom auto-scroll with unstick

**Status:** ✓ Shipped

**Story:** A long response is streaming. The chat auto-follows new content. You scroll up to read something. Auto-follow stops. You go back to bottom — auto-follow resumes.

**Steps:**

1. Send a prompt that produces a long response.
2. While streaming, **scroll up** (wheel or trackpad) by a couple of message-heights.
3. Watch the chat.
4. Scroll back to the very bottom.

**Expected:**

- Auto-scroll **stops immediately** when you scroll up — no yanking-down on the next chunk. Stay where you parked.
- A floating pill appears bottom-right: **"Jump to latest +N new"** with a count of new chunks.
- Once you scroll back to bottom (within a 32px threshold), auto-follow re-engages.
- The floating pill fades away once stuck again.

**Counter-pattern:** auto-scroll continues yanking down while you're reading mid-transcript (the ChatGPT counter-pattern the roadmap explicitly calls out as banned).

**Files:** [use-sticky-bottom.ts](../src/zeros/agent/use-sticky-bottom.ts)

---

## 2.4 Jump pills

**Status:** ✓ Shipped

**Story:** You're scrolled up reading the agent's earlier output. You want to jump back to your prompt or to the live tail.

**Steps:**

1. During an in-flight long turn, scroll up so both your prompt AND the live content are off-screen.
2. Look top-right and bottom-right.
3. Click each pill in turn.

**Expected:**

- **Top-right pill:** "Jump to my prompt" (visible because the active prompt is above the viewport).
- **Bottom-right pill:** "Jump to latest +N new" (visible because new content is arriving below).
- Click "Jump to my prompt" → smoothly scrolls to your prompt.
- Click "Jump to latest" → smoothly scrolls to bottom; auto-follow re-engages.
- Both pills fade out when their condition is no longer true.

**Files:** [jump-pills.tsx](../src/zeros/agent/jump-pills.tsx)

---

## 2.5 Keybinds — `Cmd+↑`/`↓`/`Home`/`End`/`K`

**Status:** ✓ Shipped

**Story:** Long Claude run with 50 tool calls and 10 thinking blocks. You want to scan only user prompts and final assistant text — skipping the tool noise.

**Steps:**

1. In a chat with multiple turns and tool calls, press `Cmd+↑` repeatedly.
2. Then `Cmd+↓` to walk back.
3. `Cmd+Home` and `Cmd+End` to jump to absolute top/bottom.
4. With focus anywhere outside the composer, press `Cmd+K`.
5. With focus **inside** the composer's textarea, press `Cmd+↑`.

**Expected:**

- `Cmd+↑/↓` jumps between **only user prompts and final assistant text** — skips tool cards, thinking blocks, plan panels.
- `Cmd+Home`/`End` jumps to chat top / bottom.
- `Cmd+K` from anywhere — focuses the composer textarea.
- `Cmd+↑` from inside the textarea — does **NOT** trigger jump (preserves native cursor behavior); only jumps when focus is outside an input.

**Counter-pattern:** `Cmd+↑` triggering while typing in the composer (native textarea behavior wins).

**Files:** [agent-chat.tsx:523-588](../src/zeros/agent/agent-chat.tsx#L523), [use-sticky-bottom.ts:151-191](../src/zeros/agent/use-sticky-bottom.ts#L151)

---

# Journey 3 — Tool cards

## 3.1 Shell card with xterm output

**Status:** ✓ Shipped

**Story:** You ask Claude to run a shell command. It renders as a terminal-style card with proper ANSI colors.

**Steps:**

1. *"Run `git log --oneline --color=always | head -20`"*.
2. Look at the card.
3. Click the chevron to collapse.
4. Run a failing command: *"Run `ls /nonexistent`"*.
5. Run a long-output command: *"Run `find . -type f -name '*.ts' | head -50`"* (live streaming).

**Expected:**

- Card header: terminal icon, command in monospace, status badge `running` → `exit 0` (or `failed`), duration.
- Body: xterm.js DOM-rendered output with **proper ANSI colors** (no raw `\033[33m` escape codes).
- `cwd:` chip appears under header only if command runs in a subdirectory (not project root).
- Default-collapsed on success; default-expanded on failure (red border-left).
- Streaming output: tokens appear progressively — does NOT wait for completion.
- Collapsing a completed card disposes the xterm (no memory leak).
- Output >5000 lines: shows "Show all 5000 lines" button; xterm mounts only on click.

**Counter-pattern:** raw escape codes visible in the body, or output appearing in a single chunk after the entire command finishes (should stream).

**Files:** [tool-shell.tsx](../src/zeros/agent/renderers/tool-shell.tsx)

---

## 3.2 Edit card with diff (replacement mode + patch mode)

**Status:** ✓ Shipped

**Story:** Claude edits a file. You see a unified diff with line numbers, +N/−M counts, and syntax highlighting.

**Steps:**

1. *"Add a comment at the top of README.md explaining what this project is."*
2. Look at the Edit card.
3. *"Now make three more small edits to README.md, one at a time."*
4. Look at the merged Edit card.
5. **(needs Codex)** Same prompt against Codex (which uses `apply_patch`).

**Expected:**

- Header: file path, +N/−M counts, status badge `applied`/`failed`/`applying`/`queued`, duration.
- Body: hunk-based unified diff with line numbers, `+`/`−` markers, **syntax highlighting** (shiki).
- Side-by-side layout when panel ≥ 800px wide; stacked otherwise.
- Three sequential edits to README.md should collapse into **ONE Edit card** with a `+2 more changes ▾` chevron — click to expand the per-edit history.
- Codex's `apply_patch` should render via the *patch mode* path (diff arrives directly); should look identical to Claude's *replacement mode* (diff computed from before/after).

**Counter-pattern:** three Edit cards stacked instead of one collapsed merged card (mergeKey not firing).

**Files:** [tool-edit.tsx](../src/zeros/agent/renderers/tool-edit.tsx)

---

## 3.3 Read card with line range

**Status:** ✓ Shipped

**Story:** Claude reads a file. The card shows path, line range, and a syntax-highlighted preview.

**Steps:**

1. *"Read package.json and tell me what it contains."*
2. *"Read src/zeros/agent/agent-chat.tsx, lines 1-50."*
3. *"Read the entire src/zeros/agent/agent-chat.tsx file."*

**Expected:**

- Header: file path, line range chip (`L1-50/N` or just total), status badge.
- Default-collapsed; click chevron → expands.
- Body: syntax-highlighted source matching the file's extension (TS for `.ts`, MD for `.md`, etc.).
- For files >200 lines: collapsed preview shows first 200 lines + `Show all 4520 lines` button at the bottom.
- Claude's Read tool prepends `   1\tcontent` line numbers — these should be **stripped before highlighting** so you see clean source code.

**Files:** [tool-read.tsx](../src/zeros/agent/renderers/tool-read.tsx)

---

## 3.4 Search card

**Status:** ✓ Shipped

**Story:** Claude greps the codebase. Matches render grouped by file with counts.

**Steps:**

1. *"Search for any TODO comments in this repo."*
2. Look at the Grep card.

**Expected:**

- Header: query / pattern + match count badge.
- Body: matches grouped by file. Each line: `path:line · matched-text` (with the matched substring highlighted).
- Empty search → "0 matches" state.
- Glob and Grep both render through the same Search card.

**Files:** [tool-search.tsx](../src/zeros/agent/renderers/tool-search.tsx)

---

## 3.5 Fetch card (URL fetch + web_search)

**Status:** ✓ Shipped

**Story:** Two distinct sub-modes — fetching a single URL vs running a web search.

**Steps:**

1. *"Fetch https://example.com and summarize the response."* (URL fetch)
2. *"Search the web for the latest Anthropic Claude pricing."* (web_search)

**Expected:**

- **URL fetch sub-mode:** URL chip, response status code, content-type, collapsible body preview.
- **Web search sub-mode:** query string, top hits list with title + URL + snippet. Click a hit → opens URL.

**Files:** [tool-fetch.tsx](../src/zeros/agent/renderers/tool-fetch.tsx)

---

## 3.6 Plan / Todo panel — pinned to active turn

**Status:** ✓ Shipped (per-turn pinning is the highlight of Stage 3)

**Story:** Claude uses TodoWrite to track multi-step work. The plan card sits inside the active turn, right under your sticky prompt.

**Steps:**

1. *"Make a plan for refactoring the auth flow in this app, using TodoWrite to track items as you work."*
2. Watch where the plan panel appears.
3. Scroll down through the response — plan card position relative to viewport.
4. Send a new prompt.

**Expected:**

- Plan card renders **inside the active turn**, right below your sticky user prompt — not as detached chrome above the message list.
- Items render with status icons: `○` pending, `⋯` in progress (animated), `✓` completed (strike-through), `✗` cancelled (dim).
- Live-updates as TodoWrite events flow.
- When you scroll down through the response, the plan moves with the turn (it's anchored to the turn's structure, not the viewport).
- After a new prompt, the plan from the previous turn unsticks with the turn; if a new plan starts, that lives in the new active turn.
- **Edge case:** chats with NO plan events should NOT render the panel anywhere.

**⚠ Sub-feature gap (deferred):** the plan card always uses `replace` semantics today — adapter-side `patch` and `append` mutation modes aren't wired. Functionally identical for current agents.

**Counter-pattern:** plan rendering twice (above the message list AND inside the turn). If you see two plan cards, the fallback wiring is misfiring.

**Files:** [agent-chat.tsx:921-977](../src/zeros/agent/agent-chat.tsx#L921), [PlanPanel inline definition at agent-chat.tsx:1180](../src/zeros/agent/agent-chat.tsx#L1180)

---

## 3.7 Thinking block + `Cmd+Shift+T` toggle + redacted badge

**Status:** ✓ Shipped (redacted badge added 2026-04-29)

**Story:** Claude's reasoning streams as a thinking block. You can toggle a single one or all at once. Encrypted reasoning shows a distinct redacted badge.

**Steps:**

1. *"Take time to think through your reasoning, then explain how this app's architecture works."* (Claude with extended thinking enabled)
2. While the agent thinks, look at the thinking block.
3. After the turn completes, look at the thinking block again.
4. Click the chevron to expand it.
5. Press **`Cmd+Shift+T`** (or `Ctrl+Shift+T` on Linux/Windows).
6. Press it again.
7. **For the redacted variant:** ask Claude something it considers sensitive enough to redact reasoning for (specifics vary; this fires for safety-relevant prompts). When it returns, look for a thinking block with the "redacted" badge instead of a char count.

**Expected:**

- **During streaming:** `[Brain] Thinking… 12s` with shimmer animation on "Thinking" + live duration.
- **After turn ends:** settles to `[Brain] Thinking · 412 chars ▾` (no shimmer).
- Click chevron → expands to italic body text.
- `Cmd+Shift+T` toggles **every thinking block in the chat at once**. Press again → all toggle back.
- `Cmd+Shift+T` works even while typing in the composer (intentional — peek at reasoning without losing focus).
- **Redacted blocks:** show `[Brain] Thinking · REDACTED` with a pill-style uppercase italic badge instead of char count. Chevron is disabled (no body to expand). Doesn't shimmer. Mixed-content thinking messages (some plain + some redacted blocks) keep the redacted flag once any block in the message is encrypted.

**⚠ Sub-feature gap:** token count is `chars` not `tokens` — Claude doesn't surface per-block token counts (`usage.thinking_tokens` is turn-aggregate; estimating from chars would be misleading).

**Files:** [thinking-block.tsx](../src/zeros/agent/renderers/thinking-block.tsx), keybind in [agent-chat.tsx](../src/zeros/agent/agent-chat.tsx) (around line 535), Claude adapter handles redacted at [translator.ts redacted_thinking branch](../src/engine/agents/adapters/claude/translator.ts) (around line 308)

---

## 3.8 Subagent card with nested transcript

**Status:** ✓ Shipped (nested transcript added 2026-04-29)

**Story:** Claude delegates work to a subagent. You see the parent card showing the delegated task, the nested transcript of every event the subagent emitted, and the final result.

**Steps:**

1. *"Use a subagent to explore this codebase structure and report what each top-level directory contains."*
2. Look at the Agent (subagent) card.
3. While the subagent is running, watch the card body — it should default-expanded for in-flight subagents.
4. After completion, click the chevron to collapse, then re-expand.

**Expected:**

- Header: subagent name + task description + status badge (queued / running / done / failed) + duration.
- **Default-expanded while the subagent is in flight** so you can watch progress live.
- **Default-collapsed once the subagent finishes** (you can still re-open).
- Body sections, in order:
  - **Task** — the prompt / description that triggered the subagent.
  - **Nested events (N)** — every event the subagent emitted, indented under a left-border accent. Each renders via the same MessageView, so child tool calls show up as full-fidelity Shell / Edit / Read / Search / Plan / Thinking cards inside the parent's card.
  - **Result** — the subagent's final summary text.
- **Top-level timeline does NOT show the child events** — they're routed exclusively into the SubagentCard's nested transcript via `parentToolId` (no double-rendering).
- New child events arriving live re-render the SubagentCard incrementally (memo equality bails when the children bucket reference changes).

**Counter-pattern:** child events appearing both inside the SubagentCard AND at the top-level of the chat (`parentToolId` not propagating).

**Files:** [tool-subagent.tsx](../src/zeros/agent/renderers/tool-subagent.tsx) (children rendering), Claude adapter in [translator.ts onAssistant](../src/engine/agents/adapters/claude/translator.ts) (around line 280) reads `parent_tool_use_id` from the assistant envelope and stamps `parentToolId` on every event in the chunk

---

## 3.9 MCP card with rich content blocks

**Status:** ✓ Shipped (image / resource / audio rendering added 2026-04-29)

**Story:** An MCP server tool fires. Text output renders as before; image / resource / audio attachments render as actual widgets instead of raw base64 JSON.

**Steps:**

1. With any MCP server configured (a screenshot tool like puppeteer-mcp, a docs server, or a custom one) — trigger a tool.
2. Look at the card body.
3. For image-returning tools (e.g. screenshot MCPs), the card should show a real `<img>`.
4. For resource-returning tools (e.g. file readers), the URI + content text should render as a labeled section.

**Expected:**

- Header: `<server>.<tool>` (e.g. `zeros-design.apply_change`).
- Expanded body sections:
  - **Input** — JSON of the call arguments (collapsible).
  - **Attachments** (when present) — rich rendering per content block:
    - **`type: "image"`** → actual `<img>` rendered from `data:<mime>;base64,<data>` (max-height 320px, bordered).
    - **`type: "resource"` (text variant)** → URI label + `<pre>` with the resource's text content.
    - **`type: "resource"` (blob variant, image mime)** → renders as `<img>`.
    - **`type: "resource"` (blob variant, other mime)** → URI + mime type badge with download icon.
    - **`type: "resource_link"`** → clickable link with title + description.
    - **`type: "audio"`** → native `<audio controls>` widget.
  - **Output** — text content (concatenated from `text` blocks).
- For tool calls returning ONLY text (the most common case), the card looks identical to before — only image/resource/audio blocks render differently.

**Counter-pattern:** images returning as raw base64 JSON in the Output section instead of as `<img>` widgets.

**⚠ Gap:** Goose-style rich MCP-UI widgets (interactive react components driven by MCP) aren't rendered — those are a separate spec (`mcp-ui`) requiring a component library; not part of MCP core.

**Files:** [tool-mcp.tsx](../src/zeros/agent/renderers/tool-mcp.tsx) (`MCPMediaBlock` + `splitContentBlocks`)

---

# Journey 4 — Permissions and modes

## 4.1 Inline permission cluster — basic flow

**Status:** ✓ Shipped

**Story:** Claude wants to run a Bash command. Instead of a global modal-ish bar, the approve/deny UI sits **right under the tool card**.

**Steps:**

1. With Claude in `default` permission mode, ask: *"run `git status` here"*.
2. Look at the chat.
3. Click `Allow once`.

**Expected:**

- Bash card appears with a **permission cluster directly below it**: risk-tinted banner, headline like "Agent wants to run: `git status`", buttons:
  - `Allow once`
  - `Deny once`
  - `Always allow`
  - `Always block`
  - `Cancel`
- The **global PermissionBar** (the bar between message list and composer) does NOT appear — the inline cluster suppresses it because the toolCallId matches a visible card.
- Click `Allow once` → cluster disappears, card transitions to running → completed. No policy saved.
- Click `Deny once` → agent receives the rejection; card shows failed state.

**Counter-pattern:** both the inline cluster AND the global PermissionBar appearing simultaneously (toolCallId-match check is misfiring).

**Files:** [inline-permission.tsx](../src/zeros/agent/renderers/inline-permission.tsx), conditional in [agent-chat.tsx:1005-1019](../src/zeros/agent/agent-chat.tsx#L1005)

---

## 4.2 Sticky "Always allow" policy

**Status:** ✓ Shipped

**Story:** You don't want to keep approving Bash. Click "Always allow" once, and future Bash calls in this chat auto-fire.

**Steps:**

1. In a fresh chat, ask Claude to run `ls`.
2. Click `Always allow` in the permission cluster.
3. Now ask Claude to run `ls -la` (different command, same Bash tool).
4. Look at the second Bash card.
5. Click the `✕` on the auto-decision chip.
6. Ask Claude to run `pwd`.

**Expected:**

- First call: cluster appears, you click Always allow, agent proceeds.
- Second call: **no cluster appears** — auto-fired by the policy.
- An **auto-decision chip** renders under the auto-handled card: `Auto-allowed by policy · ✕ revoke`.
- Click `✕` → policy is removed.
- Third call: cluster appears again (policy gone).

**Steps continued — per-chat scoping:**

7. Open a different chat.
8. Ask Claude to run a Bash command in the new chat.

**Expected:**

- The `Always allow` policy from the first chat does **NOT** apply — cluster appears in the new chat.

**Files:** [policies.ts](../src/zeros/agent/policies.ts), [auto-decision-chip.tsx](../src/zeros/agent/renderers/auto-decision-chip.tsx)

---

## 4.3 Inline cluster for design-tool calls (with diff)

**Status:** ✓ Shipped

**Story:** Claude wants to apply a CSS change. The cluster shows a richer body with the design-tool-specific prompt and the before/after diff.

**Steps:**

1. Open a project on the canvas. Select a button element.
2. *"Change the background color of the selected button to blue."*
3. Look at the cluster.

**Expected:**

- Headline like *"Change `background-color` on `.btn-primary`"*.
- Body shows **before/after diff** of the CSS value (when workspace snapshot is available).
- Click `Allow once` → change applies; the canvas re-renders with the new color.

**Files:** [inline-permission.tsx:62-71](../src/zeros/agent/renderers/inline-permission.tsx#L62) (designtool integration)

---

## 4.4 ExitPlanMode card

**Status:** ✓ Shipped

**Story:** You put Claude in `plan` mode. It explores, proposes a plan, then calls `ExitPlanMode`. You approve and pick the next mode.

**Steps:**

1. Click the mode pill in composer footer; select `plan` (Claude's plan mode).
2. *"Plan a refactor of the auth flow in this app."*
3. Wait for the agent to call `ExitPlanMode`.
4. Look at the ExitPlanMode card.
5. Click `accept-edits`.

**Expected:**

- ExitPlanMode card with:
  - Plan content rendered as **markdown** (headers, bullets, code blocks).
  - Status: `Pending approval`.
  - Three buttons: `default` · `accept-edits` · `auto`.
- Click `accept-edits`:
  - Plan is approved (`respondToPermission` → allow_once).
  - Mode switches to `acceptEdits` for subsequent edits (no more permission prompts for writes).
  - Card transitions to `Approved`.
- A **mode-switch banner** also appears in the timeline: `─── Switched to acceptEdits mode ──── 14:32 ───`.

**Counter-pattern:** clicking a button only approves the plan but doesn't actually switch modes (subsequent edits still require approval — `setMode` callback not firing).

**Files:** [tool-exit-plan-mode.tsx](../src/zeros/agent/renderers/tool-exit-plan-mode.tsx), [mode-switch-banner.tsx](../src/zeros/agent/renderers/mode-switch-banner.tsx)

---

## 4.5 Mode pill in composer

**Status:** ✓ Shipped

**Story:** The mode pill shows what mode the active agent is in. Click to change.

**Steps:**

1. With a Claude chat open, click the mode pill (eye icon, currently labeled with the active mode).
2. Select different modes one by one.
3. Switch to a Codex chat (or any non-Claude agent).
4. Click the mode pill there.

**Expected:**

- **Claude chat:** dropdown shows native modes — `default`, `acceptEdits`, `auto`, `bypassPermissions`, `plan` — each with a description hint.
- **Codex chat:** falls back to local 4-item list — `Full Access`, `Auto Edit`, `Ask First`, `Plan Only` (Codex doesn't advertise native modes).
- The pill label reflects the currently-active mode.

**Files:** [composer-pills.tsx:302-391](../src/zeros/agent/composer-pills.tsx#L302)

---

## 4.6 Mode-switch banner for autonomous switches

**Status:** ✓ Shipped (Claude path verified; Gemini autonomous needs separate test)

**Story:** Some agents switch modes mid-run. The timeline shows a banner so you see when it happened.

**Steps:**

1. With Claude in plan mode, prompt: *"plan and then exit plan mode to execute"*. Approve via ExitPlanMode card → triggers Claude path.
2. **(needs Gemini)** Send Gemini a prompt that should trigger `enter_plan_mode` autonomously.

**Expected:**

- Banner inside the timeline: `─── Switched to <mode> mode ──── HH:MM ───` at the moment of the switch.
- Distinct visual style — not a tool card, not a regular text message.

**Files:** [mode-switch-banner.tsx](../src/zeros/agent/renderers/mode-switch-banner.tsx)

---

## 4.7 Question card — native blocking path

**Status:** ✓ Shipped (native + inferred paths both working)

**Story:** Claude calls `AskUserQuestion`. You see a structured form, not a generic text bubble.

**Steps:**

1. *"I want to set up a new project. Ask me which framework, build tool, and styling system to use, then propose a structure."*
2. Wait for the agent to call `AskUserQuestion`.
3. Fill in the form.

**Expected:**

- Question card renders with:
  - Question text + header.
  - Radio buttons (single choice), checkboxes (multi-choice), or text input (matching `inputType` from the tool).
  - Single submit button at the bottom for stacked questions.
- Submit → answer routes back as `tool_result`; agent continues from where it stopped.

**Files:** [question-card.tsx](../src/zeros/agent/renderers/question-card.tsx)

---

## 4.7b Inferred question — quick-reply heuristic

**Status:** ✓ Shipped (2026-04-29)

**Story:** Codex/Cursor/Copilot/Droid (and sometimes Claude) end a turn with a clarifying `?` as plain assistant text rather than a structured tool. A small banner under the message signals "you need to reply" and offers quick-reply buttons when the text contains a numbered option list.

**Steps (needs Codex or Cursor to test the inferred path):**

1. *"I want to add a new feature. Should I do A) authentication, B) dashboard widgets, or C) data export?"* — agent ends with a question containing a numbered list.
2. Wait for the turn to complete.
3. Look below the agent's last message.
4. Click one of the quick-reply buttons.

**Expected:**

- A discreet banner appears under the agent's final text:
  - **With option list:** "Pick one to reply, or type below." plus 2-5 buttons (one per parsed option).
  - **Just `?` ending, no list:** "→ Reply below to continue." (hint only, no buttons).
- Click a button → sends as a normal next-turn user prompt (the agent processes it as if you typed it).
- The banner does NOT appear:
  - On any message that's not the chat's tail.
  - While the turn is still streaming.
  - When the text doesn't end with `?` AND has no numbered list.

**Counter-pattern:** banner showing on EVERY agent text (heuristic too eager) — flag for tuning.

**Files:** [inferred-question.tsx](../src/zeros/agent/renderers/inferred-question.tsx), wired via [message-view.tsx](../src/zeros/agent/renderers/message-view.tsx)

---

## 4.8 Error card

**Status:** ✓ Shipped

**Story:** Agent fails with an unsupported model or other error. Tinted error card with retry/dismiss controls.

**Steps:**

1. Set Codex's model to one your subscription doesn't support (or unplug WiFi mid-prompt).
2. Send a prompt.

**Expected:**

- Tinted error card replaces the old plain-text `⚠ Codex error: ...`.
- Card body: error message + recoverable / fatal classification.
- Affordances: `Retry`, `Dismiss`, `View details` (expand for stack trace / raw error).

**Files:** [error-card.tsx](../src/zeros/agent/renderers/error-card.tsx)

---

# Journey 5 — Long-run experience

## 5.1 30-minute Claude run

**Status:** ✓ Shipped

**Story:** A multi-step Claude run with hundreds of tool calls. Compact and navigable, not a kilometre-tall wall.

**Steps:**

1. *"Audit this entire repo. List every TypeScript file, summarize what each does, identify any code smells, and propose 5 specific improvements."*
2. Let it run for 5-10 minutes. Watch the chat.
3. Scroll up and down. Use jump pills.
4. Look at the left gutter.
5. Look at the composer footer.

**Expected:**

- **Default-collapsed cards** — successful tool cards show a one-line summary, not full panels.
- **Long-turn windowing:** when the active turn exceeds ~20 events, only the last 20 render live. Older events collapse to a banner: `78 earlier events hidden ───`.
- **Vertical timeline rail** in the left gutter: coloured dots per tool call (status-tinted), short bars for thinking blocks. Hover any dot → tooltip with name + duration. Click → scrolls that card into view.
- **Activity HUD** at the composer footer: agent name + current tool + elapsed time + tool count + Stop. Visible even when scrolled away.
- **Sticky prompt** at top of viewport throughout — your original prompt is always one glance away.

**Files:** [turn-event-list.tsx](../src/zeros/agent/turn-event-list.tsx), [turn-rail.tsx](../src/zeros/agent/turn-rail.tsx), [activity-hud.tsx](../src/zeros/agent/activity-hud.tsx)

---

## 5.2 Run-summary roll-up after turn ends

**Status:** ✓ Shipped

**Story:** Once a long turn finalizes, the next turn arrives. The previous turn collapses to a one-line summary so the chat doesn't grow unbounded.

**Steps:**

1. After the long run from 5.1, send a new short prompt (*"thanks"*).
2. Look at the previous turn.
3. Click the chevron on its summary.

**Expected:**

- Previous turn collapses to: `Edited 12 files (+340/−80), ran 3 commands, called 4 web searches · 4m 12s ▾`.
- Click chevron → expands to the full timeline.
- **Sticky-expanded behavior:** if you manually expand a finalized turn, then send another prompt, that turn stays expanded — doesn't auto-collapse mid-read.
- The most-recent (active) turn never rolls up.

**Files:** [turn-event-list.tsx:71-78](../src/zeros/agent/turn-event-list.tsx#L71), [turn-summary.tsx](../src/zeros/agent/turn-summary.tsx)

---

## 5.3 Streaming markdown smoothness at scale

**Status:** ✓ Shipped (worker mode active 2026-04-29)

**Story:** Open a chat with 100+ messages. Scroll smoothly. New chunks shouldn't jank the screen. Code blocks highlight off the main thread.

**Steps:**

1. Open the longest existing chat (or generate one with a long Claude run).
2. Scroll up through the entire transcript.
3. Send a new prompt that streams a long response with multiple code blocks.

**Expected:**

- Scrolling is smooth — no jank, no flicker, no cursor-jump on selection.
- During streaming, only the actively-streaming `<TextMessage>` re-renders. All earlier ones stay frozen because their `[useMarkdown, message.text]` deps don't change.
- Code blocks in streaming responses syntax-highlight progressively, **without pinning the main thread** (shiki runs in a Web Worker).
- Off-viewport turns are layout-skipped via `content-visibility: auto`; you can verify in DevTools by inspecting an inactive turn — its render box reports as elided when scrolled away.

**Verification (optional):**

- Open DevTools Performance panel. Record a 5-second window during a streaming response with 5+ code blocks.
- Look for the worker thread — shiki work happens there, not on the main thread.
- Main-thread frame budget should stay under 16ms even with simultaneous code-block highlighting.

**⚠ Stage 11.1 partial:** full react-virtuoso virtualization isn't shipped (it would risk breaking sticky-prompt + Cmd+↑/↓ keybind which traverse DOM directly). `content-visibility: auto` covers the practical perf gap up to several thousand messages.

**Files:** [text-message.tsx:28-37](../src/zeros/agent/renderers/text-message.tsx#L28), [markdown.ts](../src/zeros/agent/markdown.ts), [syntax.ts](../src/zeros/agent/renderers/syntax.ts), [syntax.worker.ts](../src/zeros/agent/renderers/syntax.worker.ts)

---

## 5.4 Context pill — token display + cost popover

**Status:** ✓ Shipped (carryover bug fix from Stage 3 testing)

**Story:** The composer footer pill shows token usage. The buggy `Window 291.4k / 200.0k · 100%` display should be gone.

**Steps:**

1. Send a few prompts to Claude (Sonnet 4.6 default).
2. Look at the context pill.
3. Click it.
4. Switch to Claude Opus 4.7 (1M context variant) in the model picker.
5. Send another prompt.
6. Click the pill again.

**Expected:**

- Pill shows: `[gauge] 12.4k` (just the token count).
- Click → popover with two rows:
  - `This turn: 12.4k · $0.03` (cost only when adapter reports it).
  - `Model context: 200k`.
- After switching to Opus 1M: popover shows `Model context: 1M` (or similar).
- Pill never shows `Window X / Y · 100%` after just a few prompts (that was the bug).

**Counter-pattern:** if `Model context` always reads `200k` regardless of model, the `contextWindowForClaudeModel` lookup isn't being applied.

**Files:** [composer-pills.tsx:586-619](../src/zeros/agent/composer-pills.tsx#L586), [translator.ts:441-451](../src/engine/agents/adapters/claude/translator.ts#L441)

---

## 5.5 Stop button cancels cleanly

**Status:** ✓ Shipped

**Story:** During a long run, you click Stop. Cancel goes through cleanly — no false error.

**Steps:**

1. Send a long-running prompt.
2. Mid-run, click `[■ Stop]`.
3. Wait for it to settle.

**Expected:**

- Agent process receives SIGTERM.
- The expected exit (code 143) does NOT surface as a "failed" red error card. Phase 0's cancel-debounce hides it for 5 seconds, during which the post-cancel exit is treated as expected.
- Status returns to `ready`. Stop button reverts to Send.
- You can immediately send the next prompt.

**Counter-pattern:** "agent error" tag appearing after cancel.

**Files:** [agent-chat.tsx:1129-1157](../src/zeros/agent/agent-chat.tsx#L1129), [sessions-store.ts](../src/zeros/agent/sessions-store.ts) (cancellingChats Set)

---

# Journey 6 — Multi-chat and persistence

## 6.1 Per-chat scroll memory in-session

**Status:** ✓ Shipped

**Story:** You're reading mid-transcript in chat A. Switch to chat B. Switch back to chat A — it lands at exactly where you left off.

**Steps:**

1. In chat A, scroll to a specific position (not at the bottom — e.g. 3 turns up).
2. Sidebar → click chat B.
3. Send a prompt or scroll a bit in chat B.
4. Sidebar → click back to chat A.

**Expected:**

- Chat A restores to the **exact scroll position** you left, not snap-to-bottom.
- Each chat has its own scroll memory.

**Files:** [agent-chat.tsx:467-488](../src/zeros/agent/agent-chat.tsx#L467) (restore + persist)

---

## 6.2 Per-chat scroll memory across app restart ⭐

**Status:** ✓ Shipped (THIS WAS THE STAGE 1 GAP THIS SESSION CLOSED)

**Story:** You scroll mid-transcript in chat A. Quit the app. Reopen. Open chat A — same scroll position is preserved.

**Steps:**

1. In chat A, scroll to a specific position (note approximately where).
2. Wait ~1 second after your last scroll movement (debounce window).
3. Quit the app (Cmd+Q).
4. Relaunch.
5. Open chat A.

**Expected:**

- Chat A lands at the exact saved scroll position.
- A fresh chat (never scrolled) snaps to bottom — that's the correct fallback, not "snap to top."

**Verification deep-test (optional):**

- Open SQLite at `~/Library/Application Support/Zeros{,Dev}/zeros-agent-history.db`.
- `SELECT chat_id, scroll_position FROM agent_chat_meta;` → should show your chats with non-null scroll positions.
- Scroll burst test: scroll fast for 5 seconds, then stop. After 1 second of idle, the SQLite value should match your final resting position (debounced — not every intermediate value).

**Counter-pattern:** chat snapping to bottom on reopen even after you scrolled mid-transcript before quitting.

**Files:** [electron/db.ts:70-76,158-184](../electron/db.ts#L70) (schema + setter), [sessions-store.ts:81-100](../src/zeros/agent/sessions-store.ts#L81) (debounced write), [src/app-shell.tsx:393-410](../src/app-shell.tsx#L393) (boot hydration)

---

## 6.3 Chat-switch performance — no cross-chat re-render

**Status:** ✓ Shipped (Phase 0 work)

**Story:** A token streaming into chat A should not re-render chat B's view, the sidebar, or the design canvas.

**Steps:**

1. Open chat A (active streaming run). Scroll up to read mid-stream.
2. Look at the sidebar — does it visually flash or "jitter" with each chunk?
3. Switch to chat B briefly.
4. Switch back to chat A.

**Expected:**

- Sidebar is stable — no flicker on each token.
- The chat A → chat B switch is instant (no spinner, no reload).
- Chat A's mid-read scroll position is preserved on return (per 6.1).

**Files:** [sessions-store.ts](../src/zeros/agent/sessions-store.ts) (Zustand per-chat slices, Phase 0)

---

## 6.4 Mode and policies persist across restart

**Status:** ✓ Shipped

**Story:** Switch a chat to `acceptEdits` mode. Add an "Always allow Bash" policy. Quit and relaunch.

**Steps:**

1. In chat X, click the mode pill → set to `acceptEdits`.
2. Run a Bash command, click `Always allow`.
3. Quit. Relaunch.
4. Open chat X.

**Expected:**

- Mode pill still reads `acceptEdits`.
- Run another Bash command — auto-fires (policy persisted via SQLite `agent_chat_policies` table).

**Files:** [policies.ts:118-160](../src/zeros/agent/policies.ts#L118), [electron/db.ts agent_chat_policies schema](../electron/db.ts)

---

# Journey 7 — Cross-agent unification

## 7.1 Same prompt, same chrome — Claude vs Codex

**Status:** ✓ Shipped

**Story:** The whole point of Phase 2's adapter normalization. The same prompt to Claude and to Codex should render through the same canonical cards.

**Steps (needs Codex):**

1. In chat A (Claude), send: *"read package.json and tell me what scripts are defined"*.
2. In chat B (Codex), send the same prompt.
3. Compare the two chats side-by-side.

**Expected:**

- Same Read card chrome (or Shell card if Codex routes through `cat`). Same headers, status badges, durations.
- Only difference: agent badge in the chat header.
- Codex's `apply_patch` (when it edits) renders identically to Claude's `Edit`.

**Files:** [src/engine/agents/adapters/codex/translator.ts](../src/engine/agents/adapters/codex/translator.ts), canonical kind mapping at [src/zeros/bridge/agent-events.ts:107-121](../src/zeros/bridge/agent-events.ts#L107)

---

## 7.2 Cursor tool calls now render

**Status:** ✓ Shipped (closes the long-standing gap from §5.A)

**Story:** Pre-Phase-2, Cursor agent prompts returned but tool calls didn't render. That gap should now be closed.

**Steps (needs Cursor):**

1. *"List the files in this folder and tell me what they do."* against Cursor.
2. Look at the chat.

**Expected:**

- Cursor's `tool_call` events now produce visible Shell / Read / Search / Edit cards — same chrome as Claude.
- Thinking is NOT rendered for Cursor — that's a deliberate "absence is the contract" choice (Cursor's CLI doesn't emit thinking in print mode). The chat just shows text without thinking; no error, no stub.

**Files:** [src/engine/agents/adapters/cursor/translator.ts](../src/engine/agents/adapters/cursor/translator.ts) (405 lines)

---

## 7.3 Gemini, Copilot, Droid

**Status:** ✓ Shipped (translators exist; needs empirical verification per agent)

**Steps (needs each agent):**

1. Same simple prompt against Gemini, Copilot, Droid in turn.
2. Verify Shell / Read / Edit / Search cards render uniformly.
3. For Gemini: prompt that should trigger `enter_plan_mode` autonomously → mode-switch banner should appear.
4. For Copilot: tool calls should render via ACP `session/update` → tool_call notifications.

**Files:** [src/engine/agents/adapters/gemini/adapter.ts](../src/engine/agents/adapters/gemini/adapter.ts), [src/engine/agents/adapters/copilot/translator.ts](../src/engine/agents/adapters/copilot/translator.ts), [src/engine/agents/adapters/droid/translator.ts](../src/engine/agents/adapters/droid/translator.ts)

---

## 7.4 OpenCode adapter — server-attached

**Status:** ✓ Shipped

**Story:** OpenCode is structurally different — it spawns its own HTTP server (`opencode serve`) and we attach as a client via SSE. Should still emit the same canonical events as the others.

**Steps (needs OpenCode):**

1. Configure an OpenCode model (e.g. `anthropic/claude-sonnet-4-5` or a cheap alternative like `openrouter/moonshot/kimi-k2`).
2. Send a tool-heavy prompt.
3. Verify:
  - Cards render the same as the other agents.
  - Model picker shows the 75+ providers from `client.provider.list()`.

**Files:** [src/engine/agents/adapters/opencode/adapter.ts](../src/engine/agents/adapters/opencode/adapter.ts) (649 lines), [translator.ts](../src/engine/agents/adapters/opencode/translator.ts) (498 lines)

---

# Journey 8 — Capability transparency

## 8.1 Project-context chip in chat header

**Status:** ✓ Shipped

**Story:** A chip in the chat header shows what context files the active agent is loading from disk for this cwd.

**Steps:**

1. Open a chat in a project that has `CLAUDE.md` and `AGENTS.md` at root.
2. Look at the chat header.
3. Click the chip.

**Expected:**

- Chip shows the count + names of loaded context files.
- Click → popover lists each file with size, mtime, first-200-chars preview, and an `Open in editor` action.
- Per-agent: Claude shows `CLAUDE.md` family + `~/.claude/CLAUDE.md` + `.claude/rules/*.md`. Codex shows `AGENTS.md` chain. Gemini shows `GEMINI.md`. Cursor shows both `.cursor/rules/*` and `AGENTS.md` and `CLAUDE.md` (compat).

**Files:** [project-context-chip.tsx](../src/zeros/agent/project-context-chip.tsx)

---

## 8.2 Memory inspector in Settings → Agents

**Status:** ✓ Shipped

**Story:** Each agent's persistent memory is surfaced in Settings so you can see what it has remembered about your work.

**Steps:**

1. Open Settings → Agents.
2. Expand each agent.

**Expected:**

- **Claude:** lists files in `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` + topic files. Click a row → copy full path. `Open in editor` action.
- **Codex:** `~/.codex/memories/` summaries.
- **Gemini:** `~/.gemini/GEMINI.md` (single global file).
- **Cursor:** "Open in browser" link to `https://cursor.com/cli/memories` (Cursor stores server-side; we can't render content directly).
- **Droid / Copilot / OpenCode:** "Not yet supported" state (no documented memory file location for these CLIs at the verified versions).

**Files:** [agent-memory-inspector.tsx](../src/zeros/agent/agent-memory-inspector.tsx)

---

## 8.3 Capability test matrix doc — per-agent run

**Status:** ✓ Shipped (as documentation + test corpus)

**Steps:**

1. Open [docs/AGENT_CAPABILITY_TEST_MATRIX.md](./AGENT_CAPABILITY_TEST_MATRIX.md).
2. Walk through each test for each agent you have installed.

**Expected:** the doc has a 7-row test corpus per agent (project-context loading, memory persistence, subagent invocation, skill activation, session resume, MCP injection, headless flags). Most rows are `◯` (manual verification needed) — running them is a one-prompt round-trip per agent. Worth doing for at least Claude + your most-used non-Claude agent.

---

# Journey 9 — Performance and durability (Stage 11 + Track 5.C)

These tests cover the perf + dev-experience items shipped 2026-04-29.

## 9.1 Load older messages from SQLite

**Status:** ✓ Shipped (Stage 11.4)

**Story:** A chat with > 200 turns has older history on disk that the in-memory hydrate window doesn't show. A "Load older messages" button at the top pages it back without snapping you to the new top.

**Steps:**

1. Find a chat with more than 200 messages on disk (or generate one with several long runs in the same chat). The Phase 0 hydrate window is 200, so anything older than the 200th most-recent message is hidden initially.
2. Open that chat. Scroll to the very top of the message list.
3. You should see a small dashed-pill button: `Load older messages`.
4. Click it. Watch the viewport.
5. Scroll position should be **preserved** — the messages you were reading should stay where they are; new older messages appear *above*, not below.
6. Repeat clicking until the button disappears.

**Expected:**

- Each click loads up to 200 more older messages from SQLite.
- Viewport stays anchored — no jump to either top or bottom.
- Button shows "Loading older messages…" while fetching.
- Once SQLite returns 0 rows (or the page is partial), the button hides — no infinite empty loads.
- Restart the app, reopen the chat — the hydrate window resets to the latest 200, the older history is back on disk; the button reappears.

**Counter-pattern:** clicking the button yanks the scroll position to the new top of the list (the scrollHeight delta anchor isn't applying).

**Files:** [agent-chat.tsx loadOlder callback](../src/zeros/agent/agent-chat.tsx) (~line 500), [agent-history-client.ts:windowOlderMessages](../src/zeros/agent/agent-history-client.ts), [electron/db.ts:windowOlderMessages](../electron/db.ts)

---

## 9.2 Shiki worker — main thread stays responsive

**Status:** ✓ Shipped (Stage 11.2, 2026-04-29)

**Story:** A long response with many code blocks should highlight without pinning the main thread. Worker mode does the regex grammar work off-main-thread.

**Steps:**

1. *"Show me 10 different examples of TypeScript advanced types, each as a separate code block"* — produces 10+ code blocks streaming in.
2. Open DevTools → Performance → record.
3. Send the prompt; let it stream for 5-10 seconds.
4. Stop recording.

**Expected:**

- Worker thread is visible in the recording's threads list — busy during code-block highlighting.
- Main thread stays responsive (frame budget < 16ms most of the time).
- Code blocks render with syntax colors as expected.
- If you have shiki main-thread fallback active (e.g. running in a test harness), highlights still work — they just block the main thread instead of using the worker.

**Counter-pattern:** code blocks render unhighlighted (worker failed to load and the fallback didn't kick in) → check console for worker errors.

**Files:** [syntax.ts](../src/zeros/agent/renderers/syntax.ts) (worker dispatch + fallback), [syntax.worker.ts](../src/zeros/agent/renderers/syntax.worker.ts) (worker), [vite.config.ts](../vite.config.ts) (`worker.format: "es"`)

---

## 9.3 WebSocket queue dedup during reconnect

**Status:** ✓ Shipped (Stage 11.4)

**Story:** During a brief disconnect, repeated requests to the same chat or session shouldn't pile up — the newer request supersedes the older.

**Steps (a bit synthetic, you can skip if disconnect testing is a hassle):**

1. Open Chat A. While it's mid-prompt, **kill the engine sidecar** (e.g. `kill -9` the engine process from Activity Monitor, or use `pnpm electron:dev` and SIGTERM the engine in another terminal).
2. The chat enters reconnecting state. The bridge auto-reconnects after a few seconds.
3. While disconnected, click between Chat A and Chat B several times rapidly (each chat-switch fires `AGENT_LOAD_SESSION` for its sessionId).
4. Wait for reconnect.

**Expected:**

- After reconnect, only the **latest** `AGENT_LOAD_SESSION` for each chat fires; older queued copies are rejected with `"… superseded by newer queued copy"` in the console.
- The per-type cap (50 for `AGENT_LOAD_SESSION`) prevents pathological queue growth — verifiable by spamming chat-switches; you'd see `"AGENT_LOAD_SESSION dropped (per-type cap)"` rejections rather than `"queue full"` rejections of unrelated traffic.

**Counter-pattern:** every chat switch during a reconnect produces a flood of duplicate `AGENT_LOAD_SESSION` requests when reconnect fires (no dedup).

**Files:** [ws-client.ts:dedupSupersededInQueue](../src/zeros/bridge/ws-client.ts)

---

## 9.4 `content-visibility` smoothness on long chats

**Status:** ✓ Shipped (Stage 11.1 lighter alternative)

**Story:** Off-viewport turns skip layout/paint via `content-visibility: auto`. The active turn always renders so its sticky prompt and live tool cards work.

**Steps:**

1. Open the longest chat you have (or generate one with 30+ turns).
2. Scroll up and down rapidly.
3. Open DevTools → Elements. Find an inactive `.oc-agent-turn` that's well off-screen. In Computed styles, check `content-visibility`.

**Expected:**

- Scrolling is noticeably smoother than the pre-Phase-2 chat (no per-turn layout cost on every scroll event).
- Inactive turns show `content-visibility: auto`. The active turn (`.oc-agent-turn-active`) shows `content-visibility: visible` (always rendered).
- Sticky prompts on the active turn still pin to viewport correctly — `content-visibility: visible` ensures it's not skipped.
- Cmd+↑/↓ jump-by-text-message still works across all turns (full DOM is still in the tree, just layout-skipped when off-screen).

**Counter-pattern:** sticky prompt fails to pin (active turn was incorrectly content-visibility-skipped); jump-by-message keybind misses some messages.

**Files:** [zeros-styles.ts `.oc-agent-turn` rules](../src/zeros/engine/zeros-styles.ts) (around line 3480)

---

## 9.5 HMR Fast Refresh in dev — no full reload on edit

**Status:** ✓ Shipped (Track 5.C)

**Story:** When you edit a renderer file in dev mode, Vite Fast Refresh should hot-swap the component without losing the chat's session state. Pre-Track-5.C, every edit caused a full page reload.

**Steps (dev only):**

1. Run `pnpm electron:dev`.
2. Open a chat. Send a prompt and let it complete. Note the session state (messages, scroll position, selected mode).
3. Open a renderer file like [src/zeros/agent/renderers/text-message.tsx](../src/zeros/agent/renderers/text-message.tsx) or [src/zeros/agent/renderers/thinking-block.tsx](../src/zeros/agent/renderers/thinking-block.tsx).
4. Make a tiny visual edit (e.g. change a className or add a `console.log`).
5. Save the file.

**Expected:**

- The edit hot-swaps in place. No full page reload.
- The chat keeps its messages, scroll position, and mode. The session is NOT reset.
- Console shows `[vite] hot updated: /src/zeros/agent/renderers/text-message.tsx` (or similar).
- Editing [src/zeros/agent/sessions-provider.tsx](../src/zeros/agent/sessions-provider.tsx) still hot-swaps cleanly because it now contains only the component (hooks moved to [sessions-hooks.ts](../src/zeros/agent/sessions-hooks.ts), context moved to [sessions-context.ts](../src/zeros/agent/sessions-context.ts)).

**Counter-pattern:** any save to a renderer file triggers a full reload (you'd lose the chat state and have to re-open the chat).

**Files:** [sessions-provider.tsx](../src/zeros/agent/sessions-provider.tsx), [sessions-hooks.ts](../src/zeros/agent/sessions-hooks.ts), [sessions-context.ts](../src/zeros/agent/sessions-context.ts)

---

# Journey 10 — Counter-patterns to watch for

These are known bad UX patterns the roadmap explicitly bans. If you see any of these, that's a bug:

1. **Auto-scroll re-engaging while you're reading mid-transcript** — banned. The "ChatGPT smart autoscroll" pattern. Once unstuck, must stay unstuck until you scroll back to bottom yourself.
2. **First user message of a 200-turn project pinning forever** — banned. We pin **the active turn's** prompt only. Old prompts scroll naturally with their turns.
3. **Modal permission dialogs** — banned. All permission UI is inline with the tool card. The global PermissionBar is now a fallback only.
4. **Per-message animations / shimmer on idle messages** — banned. Reserve motion for state changes only (a tool finishes, thinking starts, mode switches).
5. **Re-rendering full markdown on every streaming token for past messages** — banned. Only the actively-streaming message re-parses; everything else is memoized.
6. **One card per tool call with no collapsing** (Cline pattern) — banned. Default-collapsed for completed; expanded only for in-flight or failed.
7. **MCP / WebSocket / connection status surfaced anywhere user-facing** — banned per the existing "no technical UI" memory.
8. **PlanPanel rendering twice** (once above the message list AND inside the active turn) — would be a fallback wiring bug. Should only render once, inside the active turn.
9. **Permission cluster AND global PermissionBar showing for the same toolCallId** — would be a toolCallId-match bug.
10. **Stop button stuck as `Stop` after cancel completes** — would be a `cancellingChats` cleanup bug.

---

# Known not-done items (skip these until later stages)

These are real gaps you should NOT spend time hunting bugs on — they're explicitly slated for later work or deemed not worth the risk/scope.

**Updated 2026-04-29 (multiple rounds)** — most items previously listed here have shipped:

- ✓ Track 5.C HMR fix (sessions-provider split)
- ✓ Stage 11.2 shiki worker
- ✓ Stage 11.3 tool-call follow-along (incremental cursor)
- ✓ Stage 11.4 WS dedup + load-older affordance
- ✓ Inferred-from-text question card
- ✓ Subagent nested transcript (Claude path)
- ✓ Redacted thinking badge
- ✓ MCP image / resource / audio rich rendering
- ✓ `content-visibility` safety net

What's actually left:

| Item | Status | Impact |
|---|---|---|
| Full react-virtuoso virtualization | Deferred (lighter alt shipped) | `content-visibility: auto` covers typical scale up to several thousand messages. Full virtuoso would risk regressing sticky prompt + Cmd+↑/↓ DOM-traversal keybind. Revisit only if profiling proves the need. |
| Subagent nested transcript for non-Claude agents | Awaiting per-agent adapter work | Claude's `parent_tool_use_id` is plumbed end-to-end. Droid `Task` and OpenCode `task` need their translators to emit `parentToolId` on the same canonical events; once they do, the renderer side already works. |
| Plan mutation modes (`patch` / `append` vs `replace`) | Won't fix without consumer | All adapters emit `replace` today; adding `patch`/`append` plumbing without an adapter that emits them would be dead code. |
| Thinking shows `chars` instead of `tokens` | Honest limitation | Claude's `usage.thinking_tokens` is turn-aggregate, not per-block. Estimating tokens from chars would be misleading; `chars` is honest. |
| Goose-style rich MCP-UI widgets | Niche | The MCP-UI spec is separate from MCP core and needs a dedicated component library (`@mcp-ui/client` or similar). Image/resource/audio content (the common cases) DO render now via §3.9. |

---

# Reporting bugs

If something doesn't match the **Expected** in any test:

1. Note the journey + scenario number (e.g. *"5.4 — context pill still shows Window/Y format"*).
2. Capture the symptom (screenshot, browser console error, or `~/Library/Logs/Zeros{,Dev}/main.log` snippet).
3. We diagnose against the file:line cited in that test's **Files** field.

---

**End of test plan.** Test sequentially — earlier journeys set up state (chats, scroll positions, policies, mode) that later journeys assume. After all journeys pass, Phase 1 + Phase 2 (less Stage 11 perf and Track 5.C HMR) are end-to-end verified.
