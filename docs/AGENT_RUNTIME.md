# Agent runtime

> **Doc label (PR 4):** Current for **native agents**; verify details against `src/engine/agents/`. ACP is discussed below as **history** / motivation. Index: [`Zeros-Structure/12-Doc-Index-And-Labels.md`](Zeros-Structure/12-Doc-Index-And-Labels.md).

Zeros spawns coding-agent CLIs (Claude Code, Codex, Cursor, Amp,
Factory Droid, GitHub Copilot CLI, Gemini) and brokers their
conversations back to the chat UI. Every agent runs directly against
its vendor's CLI — no Agent Client Protocol, no npx adapter chain,
no foreign runtime dependencies.

> **Status:** the migration is complete. All 7 adapters ship on the
> native path; the ACP implementation (`src/engine/acp/`) is deleted.
> `ZEROS_ENGINE` env var is vestigial — the only backend is native.
> See `src/engine/agents/README.md` for the layout.

## Why we're moving off ACP

The Agent Client Protocol is a JSON-RPC-over-stdio contract between a
"client" (Zeros) and an "agent adapter" (one per CLI, shipped as an
npx package). On paper it gives us structured events, resumable
sessions, and permission prompts for free. In practice it imposed:

- **Cold start.** First invocation of each adapter downloads the npx
package — 50-200 MB, 10-60 s on residential connections. Our
`prewarm.ts` papers over this, but the paperwork itself costs ~60 s
of background CPU/network per boot.
- **Silent transport hangs.** JSON-RPC has a parser state. A
malformed line, a unicode boundary, an adapter deadlock — and the
connection looks healthy to the supervisor but dead to the user.
- **Foreign dependency chain.** `@zed-industries/claude-code-acp` →
`@anthropic-ai/claude-agent-sdk` → Anthropic API. Three versioning
surfaces, each of which can break us without our changes.
- **Partial agent coverage.** Gemini's `--acp` is first-class; Claude
and Codex are adapter-wrapped; the others are various third-party
shims of varying quality.

Two products with our exact constraints — Emdash (YC W26) and
Conductor (YC) — both evaluated ACP and shipped non-ACP. They both
re-use the CLI's own on-disk auth (no stored tokens, no OAuth
handling) and spawn the CLI directly.

## What the native runtime looks like

```
┌─────────────────────────────────────────────────────────────┐
│ UI (React) — unchanged                                       │
│   sessions-provider / useAcpSession / acp-chat              │
│                                                             │
│   ▲                                                         │
│   │ ACP_* wire messages (unchanged)                         │
│   ▼                                                         │
├─────────────────────────────────────────────────────────────┤
│ Engine                                                      │
│   ZerosEngine                                               │
│     └─ this.acp: AcpSessionManager | AgentGateway           │
│                (selected by ZEROS_ENGINE env var)           │
│                                                             │
│   AgentGateway  (native path)                               │
│     ├─ HookServer (shared; localhost HTTP; per-session tok) │
│     ├─ Registry (local manifest — 7 MVP agents)             │
│     └─ AgentAdapter[] — one per CLI (lazy-instantiated)     │
│                                                             │
│   ▲                                                         │
│   │ stdout NDJSON  +  HTTP POST from CLI hooks  +  file     │
│   │                                               tailing   │
│   ▼                                                         │
├─────────────────────────────────────────────────────────────┤
│ CLI subprocesses (user-installed, user-authenticated)       │
└─────────────────────────────────────────────────────────────┘
```

### Wire contract — frozen

The new runtime emits the **exact same `ACP_`* messages** the UI
already understands. See
`[src/zeros/bridge/messages.ts](../src/zeros/bridge/messages.ts)` for
the schema. The UI doesn't learn the backend changed. Renaming
`Acp`* → `Agent*` happens in Phase 9 after cutover; that's a pure
name change, not a behavior change.

### Transport per CLI


| CLI           | Transport                                                                     | Event source                                                           |
| ------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Claude Code   | child_process + `claude -p --output-format stream-json --include-hook-events` | stdout NDJSON + localhost HTTP hooks + `~/.claude/projects/**/*.jsonl` |
| Codex         | child_process + `codex exec --json`                                           | stdout NDJSON + `~/.codex/sessions/**/rollout-*.jsonl` + `-c notify=`  |
| Cursor        | child_process + `cursor-agent -p --output-format stream-json`                 | stdout NDJSON                                                          |
| Amp           | child_process + `amp -x --stream-json` (Claude-schema-compatible)             | stdout NDJSON                                                          |
| Factory Droid | child_process + `droid exec --output-format json`                             | stdout JSON + HTTP hooks (`.factory/settings.json`)                    |
| Copilot CLI   | PTY + HTTP hooks                                                              | hooks (`sessionStart`, `preToolUse`, `postToolUse`, `sessionEnd`)      |
| Gemini CLI    | PTY + ANSI regex + `GEMINI_TELEMETRY_OUTFILE`                                 | telemetry JSONL + stdout markers                                       |


Only two of seven use PTY (Copilot, Gemini — they don't publish a
structured output mode). The rest use child_process with their
documented `stream-json` flags. Cleaner than Emdash's one-size-fits-all
TUI-scraping.

## Auth posture

Same as before the migration, just expressed more cleanly:

- **We never store tokens.** Not OAuth, not API keys.
- **We never read credential files.** `probes.ts` checks for their
*existence* — `fs.stat` on `~/.claude/.credentials.json`, macOS
keychain `security find-generic-password` exit code for the Claude
OAuth entry, etc. The secret stays readable only by the CLI that
owns it.
- **We never run OAuth in-app.** The UI's "Sign in to Claude" button
opens Terminal and runs `claude /login`. The vendor's own flow
handles the browser hop.
- **Each CLI talks to its vendor with its vendor's token.** We're the
orchestrator, not a middleman.

This is the same posture Conductor documents in their FAQ and Emdash
ships with. Neither has attracted vendor pushback.

## Session state

Each session gets a directory under
`~/Library/Application Support/Zeros/sessions/<session-id>/`:

```
<session-id>/
  meta.json       — agent id, cwd, pid, created-at
  env/            — per-agent config overrides (e.g. CLAUDE_CONFIG_DIR)
  log/            — transcript, stderr tail
  telemetry/      — OTel files (Gemini), rollout copies (Codex)
```

Persistent across restarts — if Zeros dies mid-session, the next boot
can inspect these dirs and offer resume. Cleaned on graceful session
end or `before-quit`.

Linux/Windows fall back to XDG/`%APPDATA%`. `session-paths.ts` is the
one place that decides the root.

## Hook server

A single localhost HTTP endpoint shared by all adapters that need one
(Claude, Droid, Copilot today; trivial to extend):

- Binds `127.0.0.1` only. Never exposed off-host.
- Ephemeral port. Starts on first adapter that registers a session.
- Each session gets a UUID token (`X-Zeros-Token` header). Any POST
without a live token → 401 silently.
- Permission-type hooks block the CLI until the UI responds; the
gateway emits `ACP_PERMISSION_REQUEST`, the UI dispatches
`ACP_PERMISSION_RESPONSE`, the hook server replies to the still-open
HTTP request with the decision.
- 5-minute timeout per hook — if the UI hangs, auto-deny and surface
`ACP_ERROR` with `failure.kind: "timeout"`.

### Claude hook injection (no project-file pollution)

Claude reads hooks from `settings.json` files discovered in its config
dir (`CLAUDE_CONFIG_DIR` env var takes precedence). For each session we:

1. Write a minimal `settings.json` with our hook definitions into
  `~/Library/Application Support/Zeros/sessions/<sid>/env/claude/`.
2. Spawn `claude` with `CLAUDE_CONFIG_DIR` pointed at that directory.
3. Delete the directory on session end.

The user's `~/.claude/` and `<project>/.claude/.local.json` are never
touched. Every session has its own isolated config dir; concurrent
sessions can't collide.

## Feature flag — removed

The `ZEROS_ENGINE` env var selected the backend during the migration.
It's now vestigial: ACP code is gone, native is the only option. The
engine log line `[Zeros] Agent backend: native` at boot is a
confirmation, not a choice.

## Migration history

Shipped over Phases 0–9 in April 2026. Highlights:

- **Phase 0–6** — scaffold + seven per-CLI adapters (one per agent).
- **Phase 7** — macOS Keychain probe for Claude added to
`ai-cli.ts` auth checks.
- **Phase 8** — default flipped from `acp` to `native`.
- **Phase 9** — `src/engine/acp/` deleted entirely (1,708 LOC);
`AcpSessionManager` / `scheduleAgentInstallPrewarm` /
`@agentclientprotocol/sdk` runtime all gone. The SDK's type
declarations remain as compile-time-only imports (erased at
runtime) to preserve the existing wire-message shapes.

Deferred work — all landed 2026-04-25 alongside the core migration:

- **Phase 1.5** — Claude JSONL transcript replay on `loadSession`
via `~/.claude/projects/<hash>/<sid>.jsonl`; `usage_update`
emission mapping API tokens to context-window size; inline
base64 image + `@path` resource-link support in prompts.
- **Phase 2.5** — Codex `listSessions` enumerates rollout JSONL
files under `$CODEX_HOME/sessions/YYYY/MM/DD/`, reads the
first-line `thread.metadata` record, returns newest-first.
- **Phase 4.5** — Droid HTTP hooks via `FACTORY_CONFIG_DIR`
env override pointing at a per-session `settings.json`.
- **Phase 5.5** — Copilot HTTP hooks via `COPILOT_HOME` env
override + per-newline streaming (emits `agent_message_chunk`
per complete line instead of one blob at turn end).
- **Phase 6.5** — Gemini OTel telemetry tailer: spawned with
`GEMINI_TELEMETRY_OUTFILE`, tails that JSONL, translates tool
start/finish/error records into `tool_call`/`tool_call_update`
notifications.
- **Phase 9b** — `Acp`* → `Agent*` + `ACP_*` → `AGENT_*` rename
swept the whole tree. `src/zeros/acp/` → `src/zeros/agent/`;
`acp-chat.tsx` → `agent-chat.tsx`; `useAcpSession` →
`useAgentSession`; wire messages `AGENT_NEW_SESSION` etc.
Only surviving `Acp` tokens are in archival comments
(`ACP_INTEGRATION.md` → `AGENT_RUNTIME.md`).

## Things the UI will notice (and not)

Won't notice:

- Same composer, same pills, same chat flow.
- Same permission prompts (round-trip just uses a different wire).
- Same state machine (`warming` / `ready` / `reconnecting` / …).
- Same login flow (Terminal opens, user signs in vendor-side).

Will notice:

- Cold start drops from ~2–6s (ACP handshake + npx) to ~200–500ms
(direct CLI spawn). "Connecting…" overlay becomes rare.
- Silent hangs go away. When a CLI dies, the pipe closes — engine
sees it, reports `subprocess-exited`.
- Once a session is resumable, it survives app restarts.

## Troubleshooting


| Symptom                                                  | Check                                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Agent backend: acp" in log when expecting native        | `ZEROS_ENGINE=native` not set in the engine's env                                                                                                |
| Native adapter throws "not yet implemented"              | That adapter isn't in Phase 1-6 yet; switch back to acp with `unset ZEROS_ENGINE`                                                                |
| Hook server unreachable                                  | Check engine log for `[hook-server]`; verify no other process bound 127.0.0.1 on a random port                                                   |
| Claude says "no credentials" right after `claude /login` | macOS Keychain probe may miss on first login before OS keychain sync; retry `probeAuth` after 1-2s                                               |
| Session dir doesn't clean up                             | Graceful shutdown only — crashes leave dirs for recovery. Safe to `rm -rf ~/Library/Application Support/Zeros/sessions/` when nothing is running |
