# Chat Rebuild — Phase 0 Retrospective

**Status:** Shipped 2026-04-26 in commit `2be41ae`.
**Scope:** Foundation work. Phase 1 (Conductor-quality renderers) lands on top.

---

## Table of contents

1. [Why this work started](#1-why-this-work-started)
2. [The benchmark: Conductor 0.49.0](#2-the-benchmark-conductor-0490)
3. [The Phase 0 plan, as written](#3-the-phase-0-plan-as-written)
4. [What we shipped, step by step](#4-what-we-shipped-step-by-step)
   - 4.1 [Renderer registry](#41-renderer-registry)
   - 4.2 [Zustand per-chat slices](#42-zustand-per-chat-slices)
   - 4.3 [rAF + startTransition coalescing](#43-raf--starttransition-coalescing)
   - 4.4 [SQLite persistence](#44-sqlite-persistence)
5. [Bugs found while shipping](#5-bugs-found-while-shipping)
6. [Codex side-quest](#6-codex-side-quest)
7. [Diagnostic + dev-experience improvements](#7-diagnostic--dev-experience-improvements)
8. [Architectural lessons](#8-architectural-lessons)
9. [What stayed the same](#9-what-stayed-the-same)
10. [Files changed](#10-files-changed)

---

## 1. Why this work started

The user shared the Conductor 0.49.0 *"Allegro"* changelog and said:

> *"I want that level of faster, seamless experience, very soon we will be building lots of design tools and layers which will definitely increase the memory and CPU usage. So I don't want the agentic chat experience to take more CPU and memory; it should feel faster and lighter."*

The concrete worry was forward-looking: **adding design tooling on top of the agent chat will compete for CPU and memory unless the chat path is architected to stay cheap regardless of what runs alongside it.**

The audit (run before any code changed) found seven hotspots in the existing chat code, ranked by severity:

| # | Hotspot | Severity | File |
|---|---|---|---|
| 1 | Message list never virtualized — entire DOM kept alive | **Critical** | [agent-chat.tsx](../src/zeros/agent/agent-chat.tsx) |
| 2 | Single global `useState<Record<chatId, slot>>` — every chat re-renders on every chat's update | **Critical** | [sessions-provider.tsx](../src/zeros/agent/sessions-provider.tsx) |
| 3 | No streaming coalescence — one `setState` per token chunk | **High** | sessions-provider.tsx |
| 4 | Tool-call follow-along scans all messages on every update | **High** | agent-chat.tsx |
| 5 | `MessageView` not memoized | **High** | agent-chat.tsx |
| 6 | No request dedup in WebSocket queue | Medium | ws-client.ts |
| 7 | Multiple `setState` calls per turn (usage + mode + plan + messages each separate) | Medium | sessions-provider.tsx |

Underlying all of this was a deeper observation: the chat UI was **half-built**. Streaming text and design-tool tool calls had rich rendering, but the standard CLI-agent tool calls (Bash, Edit, Read, Grep, Glob, WebFetch, TodoWrite, Task) all fell through to a single generic card. So the question wasn't only *how do we make this faster?* — it was *how do we make this faster in a way that lets us build the missing renderers without churning the chat shell on every addition?*

That framing produced the Phase 0 design: lock the data model + renderer dispatch + persistence layer first, then build per-tool renderers on top, then add virtualization once heights are stable.

---

## 2. The benchmark: Conductor 0.49.0

From [conductor.build/changelog/0.49.0-conductor-allegro-gpt-5-5](https://www.conductor.build/changelog/0.49.0-conductor-allegro-gpt-5-5):

- **50% faster** on tab create / workspace switch / file render
- **150 MB smaller** binary
- Lower memory usage
- Cache-first startup (PR status restored from cache before network)
- Non-blocking checkpoints (off the response critical path)
- xterm DOM renderer (vs canvas)
- Reduced GitHub polling

The pattern is *"they didn't find a magic bullet. They went through every blocking call, every cache miss, every redundant render and fixed them"*. We took the same approach: don't try to do one big rewrite, find every footgun and fix them in order of impact.

---

## 3. The Phase 0 plan, as written

The plan as agreed in the conversation, before any code:

> **Phase 0 — Foundation (3-4 days, no visible UI change)**
>
> 1. Canonical message type union — replace binary `kind: "text" | "tool"` with a discriminated union covering every event type the engine emits.
> 2. Renderer registry pattern — replace the if-else MessageView with a dispatch table keyed by message kind.
> 3. Zustand sliced store — one slice per chat. Per-chat selectors. Stops cross-chat re-render cascade.
> 4. SQLite persistence layer — `better-sqlite3` in main process, exposed over IPC. Hydrates last N messages on boot.
> 5. Unknown-kind fallback — surface unrecognized events visibly, never drop silently.
> 6. rAF coalesced streaming + `startTransition` — buffer bridge messages into a frame, flush once per frame.

> **Phase 1 — Renderers (~1 week)** — Bash, Read, Edit, Grep, Glob, WebFetch, TodoWrite, Task, thinking block, usage badge, error card.

> **Phase 2 — Performance (~3 days)** — react-virtuoso drop-in (free MIT core), react-shiki worker mode, tool-call index map, WS queue dedup.

> **Phase 3 — Polish** — cache-first startup, non-blocking session boot, tree-shake bundle.

The user explicitly chose **fully-OSS only** (`react-virtuoso` core MIT, not the paid Message List add-on). And explicitly Electron, not Tauri (a memory I had to correct mid-conversation).

Phase 0 is what shipped in commit `2be41ae`.

---

## 4. What we shipped, step by step

### 4.1 Renderer registry

**Before:** [agent-chat.tsx:925-946](../src/zeros/agent/agent-chat.tsx#L925-L946) held a binary `MessageView` — `if (message.kind === "text") { ... } else { <ToolCallCard /> }`. Every new event type was a fork inside this 1434-line file. There was no fallback for unknown kinds — they silently disappeared.

**After:** [src/zeros/agent/renderers/](../src/zeros/agent/renderers/) — eight new files:

| File | Role |
|---|---|
| [types.ts](../src/zeros/agent/renderers/types.ts) | `Renderer<M>`, `RendererContext`, `RendererRegistry` types. |
| [registry.ts](../src/zeros/agent/renderers/registry.ts) | `defaultRegistry` + `resolveRenderer()`. Three dispatch axes: text-by-role, tool custom matchers (design tools, subagent), tool-by-ACP-kind, fallback. |
| [message-view.tsx](../src/zeros/agent/renderers/message-view.tsx) | The single memoized `MessageView` component agent-chat now imports. Custom equality compares per-message reference + the right slice of `applyReceipts`. |
| [text-message.tsx](../src/zeros/agent/renderers/text-message.tsx) | Extracted text bubble; memoized. |
| [tool-card.tsx](../src/zeros/agent/renderers/tool-card.tsx) | Extracted `ToolCard` + `ApplyChangeReceipt` + `ToolContentView`. Memoized. |
| [design-tools.ts](../src/zeros/agent/renderers/design-tools.ts) | Extracted `DESIGN_TOOLS` + `matchDesignTool` + `lookupCurrentValue` + `PermissionPrompt` types. |
| [subagent.ts](../src/zeros/agent/renderers/subagent.ts) | Extracted `matchSubagent` + `SUBAGENT_TITLE_PATTERN`. |
| [unknown-message.tsx](../src/zeros/agent/renderers/unknown-message.tsx) | **New.** Conductor-style minimal card — surface + token-only styling, collapsible JSON. Catches any future event the UI doesn't yet handle. |

**Result:**
- `agent-chat.tsx` shrank from 1434 → 1032 lines (-402, -28%).
- Adding a new tool renderer (Phase 1) is one new file + one line in `registry.ts`. No edits to agent-chat.
- Design-tool / subagent / generic paths all behave identically — guaranteed by keeping the existing CSS class names (`oc-acp-msg`, `oc-acp-tool`, `oc-acp-receipt-*`, etc.) untouched.

### 4.2 Zustand per-chat slices

**Before:** [sessions-provider.tsx](../src/zeros/agent/sessions-provider.tsx) stored every chat in `useState<Record<string, AgentSessionState>>`. Every store mutation produced a new object reference. Every consumer of the context re-rendered on every mutation. Chat A streaming a token re-rendered chat B's `MessageView` and the sidebar's `ChatRow` for B and C and D.

**After:** new [sessions-store.ts](../src/zeros/agent/sessions-store.ts) — Zustand store with:
- `sessions: Record<string, AgentSessionState>` — the slot map
- `warmAgentIds: Set<string>` — the green-dot set
- `sessionToChatId: Record<string, string>` — O(1) reverse index, atomically updated with `sessions`
- `loadInProgress: Set<string>` — chats currently inside `AGENT_LOAD_SESSION` (used for replay-suppression; see §5)
- Pure mutators (`setSession`, `patchSession`, `removeSession`, `setWarmAgent`, `clearAll`)
- Bridge-notification reducers (`applyBridgeUpdate`, `applyBridgePermissionRequest`, `applyBridgeStderr`, `applyBridgeAgentExit`)

**The crucial change:** `useChatSession(chatId)` now subscribes via `useSessionsStore((s) => s.sessions[chatId] ?? BLANK)`. Per-chat slice. Chat A's tokens no longer touch chat B's render path.

The provider was rewritten on top of the store — all bridge-bound actions (sendPrompt, ensureSession, etc.) now read state via `useSessionsStore.getState()` and write via store actions. The context value is just the actions object — stable across renders.

### 4.3 rAF + startTransition coalescing

**Before:** the bridge listener called `setSessions` directly on every `AGENT_SESSION_UPDATE` notification. Claude Code streams ~100ms tokens; a 30-second response is ~300 setState cycles, each a full provider broadcast.

**After:** [sessions-provider.tsx:184-309](../src/zeros/agent/sessions-provider.tsx) — bridge listeners buffer notifications into per-event-type arrays. One `requestAnimationFrame` flush per frame drains them all in a single transition.

| Event type | Urgency | Path |
|---|---|---|
| `AGENT_SESSION_UPDATE` (token chunks, tool deltas, plan, mode, usage) | Non-urgent | Buffered → rAF flush → `startTransition` |
| `AGENT_AGENT_STDERR` | Non-urgent | Same |
| `AGENT_PERMISSION_REQUEST` | **Urgent** | Synchronous (control-plane) |
| `AGENT_AGENT_EXITED` | **Urgent** | Synchronous (control-plane) |

Token rate caps at ~60 store updates/sec regardless of how fast the engine emits. React tags those updates as non-urgent so typing/clicks always pre-empt them.

### 4.4 SQLite persistence

**Before:** chats lived only in renderer memory. Reload = lost chat. The `MAX_MESSAGES_PER_CHAT = 1000` cap silently dropped older messages.

**After:** [electron/db.ts](../electron/db.ts) + [electron/ipc/commands/agent-history.ts](../electron/ipc/commands/agent-history.ts) + [src/zeros/agent/agent-history-client.ts](../src/zeros/agent/agent-history-client.ts).

**Schema:**
```sql
CREATE TABLE agent_messages (
  chat_id     TEXT NOT NULL,
  ord         INTEGER NOT NULL,
  msg_id      TEXT NOT NULL,
  kind        TEXT NOT NULL,
  payload     TEXT NOT NULL,        -- JSON-serialized AgentMessage
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (chat_id, ord)
);

CREATE TABLE agent_chat_meta (
  chat_id     TEXT PRIMARY KEY,
  agent_id    TEXT,
  agent_name  TEXT,
  session_id  TEXT,
  updated_at  INTEGER NOT NULL
);
```

**Pragmas:** `journal_mode = WAL`, `synchronous = NORMAL`. Trades a small crash-recovery window for 5-10× write speed — appropriate for chat traffic where the live engine stream re-emits anything lost.

**Storage location:** `~/Library/Application Support/Zeros Dev/zeros-agent-history.db` (dev) or `Zeros/zeros-agent-history.db` (packaged).

**IPC commands** (registered in [electron/ipc/commands/index.ts](../electron/ipc/commands/index.ts)):
- `agent_history_append` — bulk-upsert messages by `(chat_id, msg_id)`
- `agent_history_window` — fetch most-recent N, paginated by `ord`
- `agent_history_clear_chat` — delete a chat's transcript
- `agent_history_set_chat_meta` / `agent_history_get_chat_meta` / `agent_history_list_chats`

**Persistence subscription** in the provider — fires after every store mutation, diffs each chat's message list against a `lastWritten` reference map, writes only the new/updated entries. Streaming chunks share a stable msgId so the main process UPSERTs in place — no row explosion. ~60 writes/sec ceiling matches the rAF cap.

**Hydration** via new `hydrateChat(chatId)` action exposed by `useChatSession`. Called from [column2-chat-view.tsx:147](../src/shell/column2-chat-view.tsx#L147) on mount. Idempotent: skips if the slot already has messages.

**Shutdown** — [electron/main.ts](../electron/main.ts) closes the DB handle on `before-quit` so the WAL gets checkpointed cleanly.

---

## 5. Bugs found while shipping

The first three Phase 0 steps shipped clean. Then user testing surfaced bugs. Each one taught us something.

### 5.1 Claude Code duplication on reopen — three iterations to fix

**Symptom:** every time the user quit and reopened the app, every Claude Code message + thinking block + response stacked another copy. After 3 reopens: 3 copies. The user's screenshot showed three identical "Hey! 👋" responses in a row.

**First diagnosis:** hydrate-from-disk + agent's `loadSession` replay both populate the message list. Disk-stored msgIds (renderer-fallback ids) ≠ engine's freshly-assigned msgIds, so `applyUpdate`'s coalescing-by-msgId never matched.

**First fix (insufficient):** moved hydrate to the `else` branch so it only ran when there was no `persistedSessionId`. That stopped duplication for Claude Code — but **broke Codex/Cursor**, whose `loadSession` is a no-op (just stashes thread id, no replay). Their chats came back empty on reopen.

**Second fix:** added `loadInProgress: Set<string>` to the store, set during `loadIntoChat`'s RPC, checked inside `applyBridgeUpdate` to drop content events. Hydrate restored to always-on. **Still broken.**

**Why the second fix didn't work:** the rAF flush is **lazy**. Bridge events buffer up. `loadIntoChat`'s RPC resolves and clears the flag *before* the rAF fires. By flush time, the flag is false, replay events apply, duplicates pile up. The flag was checked at the wrong layer.

**Third fix (the one that worked):** moved the flag check to the **bridge listener**, synchronously, at receive time:

```ts
// sessions-provider.tsx:265-294
const unsubUpdate = bridge.on("AGENT_SESSION_UPDATE", (raw) => {
  const state = useSessionsStore.getState();
  const chatId = state.sessionToChatId[msg.notification.sessionId];
  if (chatId && state.loadInProgress.has(chatId)) {
    const upd = msg.notification.update as { sessionUpdate?: string };
    const isContentEvent =
      upd.sessionUpdate === "user_message_chunk" ||
      upd.sessionUpdate === "agent_message_chunk" ||
      upd.sessionUpdate === "agent_thought_chunk" ||
      upd.sessionUpdate === "tool_call" ||
      upd.sessionUpdate === "tool_call_update";
    if (isContentEvent) return; // drop, don't even buffer
  }
  updateBuffer.push(msg.notification);
  schedule();
});
```

The flag is true at the moment each event arrives (set synchronously before the RPC), so events drop reliably even if the rAF fires after the flag is cleared.

**Plus a cleanup pass:** existing duplicates already on disk got de-duped at hydrate time via `dedupeConsecutiveMessages` (only consecutive `(role, text)` or `(toolKind, title, rawInput)` matches collapse). Conservative — legitimate repeats across separate turns survive.

**Lesson:** lazy flushing + state-flag-based filtering is a foot-gun. Any flag that gates content has to be checked at the synchronous receive boundary, not at the lazy flush.

### 5.2 Tombstone race in chat persistence — silent data loss

**Symptom:** the user opened the app and the entire sidebar was empty. All previously-existing chats gone.

**Root cause:** [app-shell.tsx](../src/app-shell.tsx) had a "tombstone" mechanism to distinguish *user intentionally cleared all chats* from *primary localStorage was wiped, restore from backup*. The old code:

```ts
if (state.chats.length > 0) {
  setSetting(CHATS_BACKUP_KEY, state.chats);
  setSetting(CHATS_TOMBSTONE_KEY, false);
} else {
  setSetting(CHATS_TOMBSTONE_KEY, true);  // ← any empty render fires this
}
```

A single render where `state.chats` was briefly empty (a workspace swap, a reducer hiccup, or just the initial reducer state slipping out before HYDRATE_CHATS landed) was enough to set the tombstone permanently. On next mount, the hydrate logic saw `tombstone=true` and refused to restore from the (perfectly intact) backup.

**Fix** ([app-shell.tsx:326-379](../src/app-shell.tsx#L326-L379)) — two guards:

1. **Transition required** — only act on a non-empty → empty *transition*, tracked via `prevChatsLengthRef`. Empty→empty is a no-op so initial-render-before-hydrate and genuinely fresh installs never tombstone.
2. **5-second debounce** — even on a real transition, wait 5s before writing the tombstone. If chats reappear (transient hiccup), the timer is cancelled and the tombstone never fires.

User clears all chats and walks away → tombstone after 5s, intentional clear honored. Transient empty during workspace swap → no tombstone, backup recovery still works on next mount.

### 5.3 useAgentSessions runaway loop — 50+ AGENT_INIT_AGENT/sec

**Symptom:** Codex never responded. The user sent prompts; the chat showed "streaming…" forever.

**What the live log showed** (after I added engine-side dispatch logging):

```
17:02:08  AGENT_NEW_SESSION  codex-acp
17:02:08  AGENT_PROMPT       codex-acp
... and then every 1-2ms ...
17:02:08.405 AGENT_INIT_AGENT codex-acp
17:02:08.407 AGENT_INIT_AGENT codex-acp
17:02:08.408 AGENT_INIT_AGENT codex-acp
... hundreds of these per second, indefinitely ...
```

Real codex prompts couldn't get through the flood.

**Root cause:** Phase 0 step 3 introduced a regression. The new `useAgentSessions()`:

```ts
// BAD — fresh object every render
export function useAgentSessions(): SessionsCtx {
  const ctx = useContext(ActionsCtx);
  const sessions = useSessionsStore((s) => s.sessions);
  const warmAgentIds = useSessionsStore((s) => s.warmAgentIds);
  return { ...ctx, sessions, warmAgentIds };  // ← new reference every render
}
```

Pre-Phase-0 the equivalent was a `useMemo`'d object with stable identity. The spread broke that contract.

**Why it bit empty-composer specifically:** [empty-composer.tsx:470-485](../src/shell/empty-composer.tsx#L470-L485) had a `useEffect(..., [agent?.id, sessions])`. Stable `agent?.id` but unstable `sessions` → effect fires on every render. Inside the effect: `sessions.initAgent(agent.id)`. So every render of empty-composer fired one `AGENT_INIT_AGENT`. With unrelated state churn (memory logger, file watchers, sessions store mutations), empty-composer re-renders ~50 times per second.

**Fix** ([sessions-provider.tsx:1133-1146](../src/zeros/agent/sessions-provider.tsx#L1133-L1146)) — `useAgentSessions()` now returns the **stable** actions context directly. The `sessions` and `warmAgentIds` data fields are gone from the returned object. Two consumers that actually read those fields were migrated:

- [summary-handoff-pill.tsx:49](../src/zeros/agent/summary-handoff-pill.tsx#L49) — `sessions.sessions[id]` → `sessions.getSession(id)` (action)
- [agent-pill.tsx:79](../src/zeros/agent/agent-pill.tsx#L79) — `sessions.warmAgentIds.has()` → `useWarmAgentIds().has()` (dedicated hook subscribes to just that slice)

**Lesson:** when a hook is widely used in `useEffect` deps, its return identity is part of its API contract. Spreading store-subscribed data into a returned object silently breaks every consumer that depends on stable identity.

### 5.4 Sidebar pagination broken in two ways

**Symptom 1:** the user's "Documents/0kit" workspace had 16 chats listed but no "Show more" or "Show less" button.

**Root cause 1:** the toggle button was implemented as **two separate conditions**:
```tsx
{hiddenCount > 0 && !isShowingAll && <Button>Show more (N)</Button>}
{isShowingAll && chats.length > PROJECT_CHATS_VISIBLE && <Button>Show less</Button>}
```
Either one could fail independently if state got out of sync.

**Symptom 2:** when expanded, the chat list was clipped into a 280px scroll-box (`is-scroll` class with `max-height: calc(10 * 28px)`). Gaps misaligned, hover states felt foreign, scroll-inside-scroll was awkward.

**Fix** ([column1-nav.tsx](../src/shell/column1-nav.tsx) — multiple edits):

1. Replaced the boolean `projectsExpanded` toggle with a numeric `projectsVisibleCount` per folder.
2. New actions: `showMoreInFolder(folder, total)` adds 10 chats per click; `showLessInFolder(folder)` resets to 5.
3. JSX renders **one** button at a time:
   - `Show more (X of Y)` while there are more chats hidden
   - `Show less` while expanded beyond the default 5
4. Removed the `is-scroll` class — chats now flow with the same row UI throughout. The column's own scroll handles long lists.
5. Persisted under a new settings key (`column-1-projects-visible-count`).

### 5.5 Codex never responded (multi-cause)

**Symptom:** the user picked Codex, sent a prompt, and got nothing — sometimes silently, sometimes after 60+ seconds of "streaming…".

**Multiple root causes layered together:**

1. **Init-flood saturating the bridge** (5.3 above) — even when the prompt eventually got through, the bridge queue was full of init requests.
2. **Model picker had no effect.** [codex/spec.ts](../src/engine/agents/adapters/codex/spec.ts) built `["exec", "--skip-git-repo-check", promptText, "--json"]` — no `--model` flag. The renderer set `OPENAI_MODEL` env per the catalog config, but the codex CLI doesn't read that env, only its `--model` flag. Whatever model the user picked was ignored; codex used its global default.
3. **Errors were silently dropped.** The codex translator's `onError` was a no-op:
   ```ts
   private onError(_event: CodexErrorEvent): void {
     // Stream-level error — adapter's stderr-tail + exit classification
     // will surface this as AgentFailure. Nothing to emit to the chat.
   }
   ```
   And `onTurnFailed` only set internal stop-reason state, didn't surface the error message. So when the API returned *"The 'gpt-5.5' model requires a newer version of Codex"*, the user saw nothing.
4. **CLI version too old.** The user had `codex-cli 0.121.0`. Recent versions of `codex` CLI have schema changes; some models (gpt-5.5) require ≥0.125.

**Fixes:**

1. (5.3) Stable `useAgentSessions()` killed the init flood.
2. ([codex/spec.ts:41-79](../src/engine/agents/adapters/codex/spec.ts#L41-L79)) — translate `state.env.OPENAI_MODEL` into `--model <name>` CLI args. Picker now actually drives codex.
3. ([codex/translator.ts:360-410](../src/engine/agents/adapters/codex/translator.ts#L360-L410) + helper `extractErrorMessage`) — `onError` and `onTurnFailed` now both emit an `agent_message_chunk` with the unwrapped OpenAI error text. Users see *⚠ Codex error: \<reason\>* directly in the chat.
4. `npm install -g @openai/codex@latest` — upgraded user from 0.121 → 0.125.
5. Added a fail-loud path in [shared/stream-json-adapter.ts](../src/engine/agents/adapters/shared/stream-json-adapter.ts) — if a CLI subprocess exits cleanly (code 0) with no terminal event, throw a structured `protocol-error` with the spawn args + stderr tail so the failure mode becomes visible.

### 5.6 Codex catalog over-inclusive

**Symptom:** the model picker for Codex listed 15 models. 12 of them errored on the user's account.

**Root cause:** the catalog ([catalogs/models-v1.json](../catalogs/models-v1.json)) listed every model the OpenAI API supports — but most of those require an API-key auth flow that Codex CLI distinguishes from a ChatGPT subscription auth. The user has a ChatGPT account; only `gpt-5.5`, `gpt-5.4`, `gpt-5.3-codex` work for that auth tier.

**Verification:** I empirically tested every codex model against the live CLI:

| Model | Status |
|---|---|
| gpt-5.5 | ✅ works |
| gpt-5.4 | ✅ works |
| gpt-5.3-codex | ✅ works |
| gpt-5.5-codex / mini, gpt-5.4-codex, gpt-5.3 / -fast / -low / -mini / -nano, o4-mini-high, o4-mini, o3-pro, o3 | ❌ "not supported when using Codex with a ChatGPT account" |

Same audit for Claude (4/4 work) and Gemini (5/5 work) — they don't have this auth-tier issue.

**Fix:** trimmed the codex list in `catalogs/models-v1.json` to the 3 verified-working entries. Notes field documents the policy: *list only models a typical user can actually use; re-add the API-key-only ones behind a tier flag once API-key auth lands.*

---

## 6. Codex side-quest

The codex bug-hunt produced more than just fixes — it shipped a permanent diagnostic framework:

### Live-log workflow

In dev mode, the engine subprocess was spawned with `stdio: "inherit"` so engine output went to the terminal. That meant remote diagnosis was blind — `main.log` (the file Electron-main writes) didn't capture anything from the engine. We changed [electron/sidecar.ts](../electron/sidecar.ts) to always pipe engine stdout/stderr through Electron-main's `console.log` / `console.error`, so everything lands in `~/Library/Logs/Zeros Dev/main.log` with a `[engine]` prefix.

This unlocked **live debugging from a remote agent**. The Monitor tool can `tail -F` `main.log` and stream filtered events back as Claude Code notifications. While the user interacts with the running app, Claude sees the engine activity in real time. This is how the init-flood and codex no-response bugs were diagnosed in the same conversation they were reported.

### Engine dispatch / spawn / exit logging

Three new log breadcrumbs:

- **[engine/index.ts:325-345](../src/engine/index.ts#L325-L345)** — every AGENT_* dispatch is logged with type + agent + session + reqId.
- **[gateway.ts:328-360](../src/engine/agents/gateway.ts#L328-L360)** — `[agents] adapter created: <id>` on creation, `[agents] adapterForSession miss: ...` with the live adapter set on lookup failure.
- **[shared/stream-json-adapter.ts](../src/engine/agents/adapters/shared/stream-json-adapter.ts)** — `[agents] <id> prompt spawn: cmd=... args=... cwd=...`, the first 5 stream events with their type, every stderr line, and `[agents] <id> prompt exit: code=N events=N sawTerminal=bool`.

These stay on permanently. The cost is one log line per major event; the value is being able to diagnose the next "no response" bug from a single run instead of hours of speculation.

---

## 7. Diagnostic + dev-experience improvements

Beyond the live-log workflow:

### Pre-existing TS errors fixed

[use-agent-session.tsx:547-549](../src/zeros/agent/use-agent-session.tsx#L547-L549) — the ACP SDK 0.19 widened `messageId` to `string | null | undefined`. The `appendText` helper signature still said `string | undefined`. Added `?? undefined` to coalesce the null. The strict `tsc` build is now clean for the agent path; only an unrelated demo file error remains.

### Native module rebuild script updated

[package.json](../package.json) — added `better-sqlite3` to:
- `electron:rebuild` script (`electron-rebuild --only node-pty,keytar,better-sqlite3`)
- `pnpm.onlyBuiltDependencies` (allows the post-install build script to run)

So future Electron upgrades pick up the SQLite native module along with keytar and node-pty.

---

## 8. Architectural lessons

Three patterns came out of this work that should generalize to future surfaces:

### 8.1 Stable hook identity is part of the API contract

If a hook returns an object that gets used in `useEffect` deps anywhere in the codebase, its identity is observable. Spreading store-subscribed data into a returned object silently breaks every consumer. The fix: return either the raw stable context, or a `useMemo`'d composition; expose subscription-derived data via dedicated hooks (`useChatSlot`, `useWarmAgentIds`).

### 8.2 Event filtering must be synchronous at the receive boundary

A flag that gates events has to be checked at the moment events arrive, not at the moment they're processed. rAF batching (or any kind of deferred processing) can delay processing until *after* the flag has been cleared, leaking the events the flag was supposed to drop.

### 8.3 Tombstone-style intent flags need transition + debounce

A single-render anomaly (initial state, transient empty during a workspace swap, a reducer hiccup) should not be enough to set a permanent intent flag. Two safeguards: only set on a real *transition* (track previous state), and *debounce* the set so transient anomalies have time to recover.

---

## 9. What stayed the same

Phase 0 was deliberately conservative on the visible UI. Things we didn't touch:

- **CSS class names** (`oc-acp-msg`, `oc-acp-tool`, `oc-acp-receipt-*`, etc.) all preserved. Visual identical.
- **Design-tool rendering** — the `apply_change`, `get_selection`, `read_design_state`, `apply_change` cards render exactly as before.
- **Permission prompts** — the 4-button Allow Once / Always / Reject Once / Always grid is unchanged.
- **Plan panel** — collapsible todo list, same layout.
- **Composer pills** — model / effort / permissions / branch / context all unchanged.
- **Sidebar visual style** — only the pagination behavior + `is-scroll` removal.

All of this is intentional. Phase 0 sets up the architecture; Phase 1 is where the visible UX gets richer.

---

## 10. Files changed

The single Phase 0 commit (`2be41ae`) touched **33 files** with **+2,903 / −1,031** lines.

**New files (13):**

- `electron/db.ts` — SQLite connection + queries
- `electron/ipc/commands/agent-history.ts` — IPC handlers
- `src/zeros/agent/agent-history-client.ts` — renderer-side IPC client
- `src/zeros/agent/sessions-store.ts` — Zustand store
- `src/zeros/agent/renderers/types.ts`
- `src/zeros/agent/renderers/registry.ts`
- `src/zeros/agent/renderers/message-view.tsx`
- `src/zeros/agent/renderers/text-message.tsx`
- `src/zeros/agent/renderers/tool-card.tsx`
- `src/zeros/agent/renderers/design-tools.ts`
- `src/zeros/agent/renderers/subagent.ts`
- `src/zeros/agent/renderers/unknown-message.tsx`
- `src/zeros/agent/renderers/index.ts`

**Modified (20):**

- `catalogs/models-v1.json` — codex trimmed to verified-working
- `electron/ipc/commands/index.ts` + `electron/ipc/router.ts` — register agent-history commands
- `electron/main.ts` — `closeAgentHistory()` on quit
- `electron/sidecar.ts` — pipe engine stdio to main.log
- `package.json` + `pnpm-lock.yaml` — added zustand, better-sqlite3
- `src/app-shell.tsx` — tombstone race fix
- `src/engine/agents/adapters/codex/spec.ts` — model flag wiring
- `src/engine/agents/adapters/codex/translator.ts` — error visibility
- `src/engine/agents/adapters/shared/stream-json-adapter.ts` — fail-loud + spawn diagnostics
- `src/engine/agents/gateway.ts` — adapter map diagnostics
- `src/engine/index.ts` — dispatch logging
- `src/shell/column1-nav.tsx` — sidebar pagination
- `src/shell/column2-chat-view.tsx` — hydrate + loadInProgress wiring
- `src/zeros/agent/agent-chat.tsx` — extracted renderers
- `src/zeros/agent/agent-pill.tsx` — useWarmAgentIds migration
- `src/zeros/agent/sessions-provider.tsx` — Zustand-backed rewrite + persistence
- `src/zeros/agent/summary-handoff-pill.tsx` — getSession migration
- `src/zeros/agent/use-agent-session.tsx` — ACP SDK type fix

The commit is on `main` and pushed.
