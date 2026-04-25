# Adapter contract fixtures

One JSONL-per-scenario dump of a real CLI's `stream-json` output.
`scripts/test-adapters.mjs` replays each fixture through the
corresponding translator and asserts:

1. No unknown-event warnings (every line maps to a known event kind).
2. A monotonic sequence of `SessionNotification.sessionUpdate` kinds
   matches the golden list next to the fixture (`.expected.json`).
3. `stopReason` + `sawResult` / `sawTurnTerminal` end up in the
   expected terminal state.

When a vendor ships a stream-json schema change, this is the first
place it breaks — fixture lines that used to map cleanly now hit the
translator's `onUnknown` hook, and CI fails loud. That's the intended
early-warning system for "Codex shipped a new event type".

## Capturing a new fixture

Run the CLI with its stream-json flag, pipe to a file, run a small
representative prompt, then trim to the first ~50 lines:

```sh
# Claude
claude -p "what is 2+2?" --output-format stream-json --verbose \
    > scripts/fixtures/claude-basic.jsonl

# Codex
codex exec --json "what is 2+2?" \
    > scripts/fixtures/codex-basic.jsonl

# Cursor
cursor-agent -p "what is 2+2?" --output-format stream-json \
    > scripts/fixtures/cursor-basic.jsonl

# Amp
amp -x "what is 2+2?" --stream-json \
    > scripts/fixtures/amp-basic.jsonl
```

Then commit `foo.jsonl` and `foo.expected.json` side-by-side.
`foo.expected.json` lists the ordered `sessionUpdate` kinds the
translator should produce; generate it by running
`pnpm test:adapters --write` once and reviewing the diff.

## Why JSONL fixtures, not live CLI invocation

Live invocation would be flaky (auth expiry, network, rate limits)
and would require credentials in CI. Fixtures are deterministic,
check in with the repo, and anyone can reproduce a failure by
reading the fixture file. The fidelity cost is accepting that
fixtures go stale when a vendor ships a schema change — which is
exactly what we want CI to tell us.
