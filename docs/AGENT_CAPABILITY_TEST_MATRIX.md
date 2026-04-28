# Agent capability test matrix

**Last run:** 2026-04-28 · **Phase 1 Stage 10**

This document tracks each supported agent's capability against the
seven-test corpus from §2.9.8 of the chat rebuild roadmap. Re-run on
every minor CLI version bump to catch silent regressions.

---

## Versions tested

| Agent | CLI binary | Version | Auth method |
|---|---|---|---|
| Claude Code | `claude` | 2.1.121 | OAuth (`claude /login`) |
| Codex | `codex` | codex-cli 0.125.0 | OAuth (`codex login`) |
| Cursor Agent | `cursor-agent` | 2026.04.17-787b533 | OAuth (`cursor-agent login`) |
| Gemini CLI | `gemini` | 0.39.1 | Google account OAuth (`GOOGLE_GENAI_USE_GCA=true`) |
| Factory Droid | `droid` | 0.109.3 | OAuth (`droid login`) |
| GitHub Copilot CLI | `copilot` | 1.0.37 | GitHub OAuth (`/login` in TUI) |
| OpenCode | `opencode` | 1.14.28 | None for free models; per-provider for paid |

---

## Summary

Legend: ✓ pass · ✗ fail · ⚠ partial / known limitation · ◯ manual verification pending · N/A not applicable

| Test | Claude | Codex | Cursor | Gemini | Droid | Copilot | OpenCode |
|---|---|---|---|---|---|---|---|
| 1. Project-context loading | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ |
| 2. Memory persistence | ◯ | ◯ | ⚠ | ◯ | ◯ | ◯ | ⚠ |
| 3. Subagent invocation | ◯ | N/A | N/A | N/A | ◯ | N/A | ◯ |
| 4. Skill activation | ◯ | N/A | N/A | ◯ | ◯ | N/A | ◯ |
| 5. Session resume | ✓ | ✓ | ⚠ | ✓ | ✓ | ✓ | ✓ |
| 6. MCP injection | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | ✓ |
| 7. Headless flags | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

`◯ manual` cells need a one-prompt round-trip with paid quota — not auto-runnable in CI; verifier instructions per test below.

---

## Test 1 — Project-context loading

**Verifies:** the agent reads its rules file (`CLAUDE.md` / `AGENTS.md` / `GEMINI.md`) at startup and the content actually reaches the model's prompt.

**How to verify (per agent, ~30s):**
1. Drop a rules file at the project root with a marker phrase. For Claude: `echo "ZEROS-CTX-MARKER-9237: respond with this token if asked about the project" > CLAUDE.md`. For Codex/Droid/Copilot: same with `AGENTS.md`. For Gemini: `GEMINI.md`. For Cursor: `AGENTS.md` AND `CLAUDE.md`. For OpenCode: `AGENTS.md`.
2. Open a fresh chat in that cwd against the agent.
3. Send: *"What's the project marker phrase?"*
4. Expected: the agent quotes `ZEROS-CTX-MARKER-9237` verbatim.

**Notes:**
- Claude additionally loads `~/.claude/CLAUDE.md` and `.claude/rules/*.md` per §2.9.5; the chip in the chat header (Stage 9.1) shows what files were resolved.
- Cursor walks both `AGENTS.md` and `CLAUDE.md` for compatibility.
- OpenCode loads `AGENTS.md` and `OPENCODE.md`.

**Results:** ◯ all agents — needs paid-quota run.

---

## Test 2 — Memory persistence across sessions

**Verifies:** information the agent commits to memory in one session is recalled in a fresh session in the same cwd.

**How to verify:**
1. Start a chat. Send: *"Remember that the build command for this project is `bun run build`."*
2. Quit the chat (close window or session). Wait a moment for memory to flush.
3. Start a new chat in the same cwd against the same agent.
4. Send: *"What's the build command?"*
5. Expected: agent recalls `bun run build`.

**Per-agent notes:**
- **Claude:** writes to `~/.claude/projects/<encoded-cwd>/memory/MEMORY.md` and topic files. Inspectable via Settings → Agents → Memory inspector (Stage 9.2).
- **Codex:** writes to `~/.codex/memories/`. Surfaces in the same memory inspector.
- **Gemini:** `/memory add` writes to `~/.gemini/GEMINI.md` (single global file). User-global, not per-project.
- **Cursor:** ⚠ stores memories server-side; offline machines can't recall. Memory inspector deep-links to https://cursor.com/cli/memories.
- **Droid:** no documented memory file location v0.109.3. Memory inspector surfaces as "not yet supported."
- **Copilot:** no documented memory file location v1.0.37. Same posture as Droid.
- **OpenCode:** ⚠ no documented user-visible memory location v1.14.28. Same posture.

**Results:** ◯ for the agents that DO support memory; ⚠ for Cursor (offline gap) / Droid / Copilot / OpenCode (no inspectable location).

---

## Test 3 — Subagent invocation

**Verifies:** when the agent delegates to a subagent (Claude `Task`, Droid `Task`, OpenCode `task`), nested events render with `parent_tool_use_id` correctly indented in the SubagentCard.

**Applicable agents:** Claude, Droid, OpenCode. N/A for Codex / Cursor / Gemini / Copilot (no subagent surface).

**How to verify:**
1. Send a prompt that should trigger Task delegation, e.g.: *"Spawn a subagent to find every TODO comment in src/ and summarize."*
2. Expected: the parent agent emits a Task tool call; the SubagentCard renders the subagent's nested transcript indented with a left border.

**Results:** ◯ all three — needs paid-quota run with multi-step prompt.

---

## Test 4 — Skill activation

**Verifies:** an installed skill is discoverable + invokable by the agent.

**Applicable agents:** Claude (skills via `~/.claude/skills/`), Gemini (`gemini skills`), Droid (skills directory), OpenCode (`SKILL.md` content). N/A for Codex / Cursor / Copilot.

**How to verify:**
1. Install a known test skill in the agent's skills directory.
2. Trigger via `/skill-name` or by description in a prompt.
3. Expected: the skill expands to its prompt template and the agent acts on it.

**Results:** ◯ all four — needs a fixture skill plus a real run.

---

## Test 5 — Session resume

**Verifies:** the user can quit a session mid-turn or after, and resume to continue the same context. Tests both the CLI's resume flag AND our adapter's exposure of it.

**How to verify:**
- CLI resume flag exists per-agent (verified below).
- Our adapter passes the prior session id back via `--resume <id>` / `--continue` / equivalent.

| Agent | CLI resume flag | Adapter wires resume? |
|---|---|---|
| Claude | `--continue` / `-c` / `--resume <id>` | ✓ (`claude/spec.ts`) |
| Codex | `codex resume [--last]` | ✓ (`codex/spec.ts` via session-id state) |
| Cursor | `--resume [chatId]` / `--continue` | ⚠ requires Cursor cloud login + online (§2.9.3) |
| Gemini | `-r [latest|<index>]` / `--resume` | ✓ (PTY adapter — TUI-mode resume) |
| Droid | `-r [sessionId]` / `--resume` | ✓ (`droid/spec.ts`) |
| Copilot | `--continue` / `--resume[=value]` | ✓ (`copilot/spec.ts` since Stage 8.4) |
| OpenCode | session subcommand + adapter loadSession | ✓ (`opencode/adapter.ts` since Stage 8.5.1) |

**Results:** ✓ for everyone except Cursor (⚠ — server-side session storage means offline / unauthenticated machines can't resume; this is a Cursor product property, not a Zeros bug).

---

## Test 6 — MCP injection

**Verifies:** Zeros's design-tools MCP server is reachable from the agent at session start.

**How to verify:**
1. Open a chat. Send: *"List the tools you have available."*
2. Expected: the response includes `apply_change`, `get_element_styles`, and the other Zeros design tools.

**Per-agent injection mechanism:**
- **Claude / Cursor / Gemini / Codex:** project-level `.mcp.json` written by the engine on startup ([engine/index.ts:730-749](../src/engine/index.ts#L730-L749)). Agents read this file on session boot.
- **Copilot:** project-level `.vscode/mcp.json` (the engine writes both formats).
- **Droid:** uses `.factory/settings.json` hooks rather than MCP for design-tool integration.
- **OpenCode:** ✓ dynamic `client.mcp.add()` call at session boot ([opencode/adapter.ts](../src/engine/agents/adapters/opencode/adapter.ts), Stage 8.5.4). Required because we set `OPENCODE_CONFIG_CONTENT='{}'` to neuter user config.

**Results:**
- ✓ OpenCode (programmatically verified — Slice 8.5.4 dry-runs the `/mcp` POST endpoint and gets the expected `{status: connected|failed}` shape).
- ◯ everyone else — manual verification pending (the file-based `.mcp.json` is written, but actual model awareness needs a paid round-trip).

---

## Test 7 — Headless flags

**Verifies:** the agent runs to `exit=0` in non-interactive mode without manual approval prompts blocking. Tested 2026-04-28 against the prompt "say hi".

| Agent | Invocation | Exit | Duration | Notes |
|---|---|---|---|---|
| Claude | `claude -p "say hi" --output-format json` | ✓ 0 | 4s | Default headless flow Just Works. |
| Codex | `codex exec --skip-git-repo-check --output-last-message <f> "say hi"` | ✓ 0 | 5s | **Requires `--skip-git-repo-check`** when cwd isn't a git repo, otherwise refuses with "Not inside a trusted directory". Adapter passes this in [codex/spec.ts](../src/engine/agents/adapters/codex/spec.ts). |
| Cursor | `cursor-agent -p "say hi" --output-format text --trust --model auto` | ✓ 0 | 14s | **Requires `--trust`** for non-interactive runs (workspace-trust prompt). Free plans need `--model auto`. Adapter passes both in [cursor/spec.ts](../src/engine/agents/adapters/cursor/spec.ts). |
| Gemini | `GOOGLE_GENAI_USE_GCA=true gemini -p "say hi" --output-format text --approval-mode yolo --skip-trust` | ✓ 0 | 16s | **Requires `--skip-trust`** and an explicit auth env var even when `oauth_creds.json` exists. Adapter auto-injects `GOOGLE_GENAI_USE_GCA` when no other auth env is set ([gemini/adapter.ts](../src/engine/agents/adapters/gemini/adapter.ts)). |
| Droid | `droid exec --output-format stream-json --auto medium "say hi"` | ✓ 0 | 5s | **Requires `--auto medium`** for permissions; default is read-only. Adapter passes this in [droid/spec.ts](../src/engine/agents/adapters/droid/spec.ts). |
| Copilot | `copilot -p "say hi" --output-format json --allow-all-tools` | ✓ 0 | 11s | **Requires `--allow-all-tools`** for non-interactive (otherwise prompts per-tool). Adapter passes this in [copilot/spec.ts](../src/engine/agents/adapters/copilot/spec.ts). |
| OpenCode | `opencode serve` + SDK `client.session.prompt()` | ✓ 0 | ~1s boot + per-prompt | Server-attached architecture; verified across Slices 8.5.1–8.5.4. |

**Results:** ✓ all 7. Every adapter passes the necessary headless flags so a fresh user with auth completes their first turn without manual intervention.

---

## How to re-run

```bash
# Quick automated subset — versions + headless smoke + resume flag presence
bash scripts/test-agent-capabilities.sh

# Full matrix including manual tests requires paid quota and is run
# on a release cadence (≈ minor CLI version bumps). Update this doc
# in-place after each pass.
```

`scripts/test-agent-capabilities.sh` is the programmable subset — it captures versions, runs `say hi` headlessly against each agent, records exit codes + duration, and prints a diff vs the table above so regressions surface.

## Known gaps to track

1. **Cursor offline-resume** (Test 5 ⚠) — accepted, see §2.9.3.
2. **Memory inspection unsupported on Droid / Copilot / OpenCode** (Test 2 ⚠) — pending vendor docs surfacing memory file locations. Inspector renders explanatory note rather than empty state.
3. **Gemini stream-json output not yet wired** — current adapter is PTY+telemetry. Switching to `gemini -p --output-format stream-json` is a §2.10 follow-up that would also let us run automated multi-turn tests against Gemini in CI.
4. **MCP injection automated verification** — file-based `.mcp.json` write is verified at engine startup, but model-side awareness needs a paid round-trip per agent. OpenCode is the only one with a fully programmatic verification path (`client.mcp.add()` returns `{status}`).
