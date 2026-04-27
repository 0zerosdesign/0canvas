# Agent runtime (native)

Per-agent adapters that talk to each coding-CLI directly. No external
protocol, no npx adapter chain, no foreign dependencies — every wire
shape is owned in `src/zeros/bridge/agent-events.ts`.

## Why this exists

See `docs/AGENT_RUNTIME.md` for the full rationale. Short version: a
generic-protocol layer (handshake + npx install + JSON-RPC framing
fragility) outweighed its structured-event benefit for our use case.
Emdash and Conductor both converged on native CLI adapters for the
same reason. Our existing `electron/ipc/commands/ai-cli.ts` already
proved the pattern works for Claude and Codex.

## Layout

```
src/engine/agents/
├── README.md              — this file
├── types.ts               — AgentAdapter interface + event types
├── gateway.ts             — AgentGateway (orchestrator; drops into ZerosEngine)
├── registry.ts            — local manifest of supported agents (no CDN)
├── session-paths.ts       — ~/Library/Application Support/Zeros/sessions/
├── hook-server/
│   └── server.ts          — localhost HTTP, per-session tokens
├── adapters/
│   ├── base.ts            — shared stream-json + process-lifecycle helpers
│   ├── claude/            — (Phase 1)
│   ├── codex/             — (Phase 2)
│   ├── cursor/            — (Phase 3)
│   ├── droid/             — (Phase 4)
│   ├── copilot/           — (Phase 5)
│   └── gemini/            — (Phase 6)
└── stream-json/
    └── parser.ts          — NDJSON line parser (stdout/stderr)
```

## How agents plug in

Every adapter implements `AgentAdapter` (see `types.ts`). It owns one
CLI subprocess per session, translates the CLI's native events into the
canonical `AgentSessionEvent` stream, and reports lifecycle failures
through `AgentFailure`. The gateway multiplexes these over the
WebSocket.

Transport per agent:

| Agent | Transport | Event source |
|---|---|---|
| Claude Code | child_process + `--output-format stream-json --include-hook-events` | stdout NDJSON + localhost HTTP hooks + ~/.claude/projects JSONL tail |
| Codex | child_process + `codex exec --json` | stdout NDJSON + ~/.codex/sessions rollout JSONL |
| Cursor | child_process + `cursor-agent -p --output-format stream-json` | stdout NDJSON |
| Factory Droid | child_process + `droid exec --output-format stream-json --auto medium` | stdout NDJSON + HTTP hooks via .factory/settings.json |
| Copilot CLI | PTY + HTTP hooks | hooks (preToolUse/postToolUse/sessionStart/sessionEnd) |
| Gemini CLI | PTY + regex busy/idle + OTel telemetry file | `GEMINI_TELEMETRY_OUTFILE` + ANSI-stripped stdout |

## Auth posture

We never store tokens, never read credential files, never handle
OAuth. `ai_cli_is_authenticated` probes for the existence of the CLI's
own credential file (macOS Keychain for Claude, `~/.codex/auth.json`
for Codex, etc.) — presence-only, never read. `runCliLogin` opens
Terminal and runs `<cli> login` so the vendor's OAuth flow stays
vendor-side. The user owns the token; the CLI owns the session; we
orchestrate.

## Session state

Each session gets a directory at
`~/Library/Application Support/Zeros/sessions/<session-id>/` containing:

- `meta.json` — agent id, cwd, created-at, pid
- `env/` — per-agent config overrides (e.g. CLAUDE_CONFIG_DIR for
  Claude hook injection)
- `log/` — transcript, stderr tail
- `telemetry/` — OTel files for Gemini, rollout copies for Codex

Directories are cleaned on session end or app-quit. Crash-recoverable:
if Zeros dies mid-session, the next start can inspect these dirs and
decide which sessions to resume.
