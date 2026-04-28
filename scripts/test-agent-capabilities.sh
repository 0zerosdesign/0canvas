#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# Stage 10 — re-runnable capability probe
# ──────────────────────────────────────────────────────────
#
# Captures the deterministic subset of the matrix in
# docs/AGENT_CAPABILITY_TEST_MATRIX.md:
#
#   - which agents are installed + version
#   - resume-flag presence (parsed from --help)
#   - headless smoke ("say hi" → exit code + duration)
#
# Manual / paid-quota tests (project-context, memory, subagent,
# skill, MCP) are out of scope here — they need real model
# round-trips and are tracked manually in the matrix.
#
# Re-run before every release: `bash scripts/test-agent-capabilities.sh`
# ──────────────────────────────────────────────────────────

set -uo pipefail

AGENTS=(claude codex cursor-agent gemini droid copilot opencode)
TMP="$(mktemp -d)"
trap "rm -rf '$TMP'" EXIT

echo "Stage 10 capability probe — $(date '+%Y-%m-%d %H:%M:%S')"
echo

# ── Versions ──────────────────────────────────────────────
echo "## Versions"
for cli in "${AGENTS[@]}"; do
  if command -v "$cli" >/dev/null 2>&1; then
    ver=$("$cli" --version 2>&1 | head -1 | tr -d '\n')
    printf "  %-15s %s\n" "$cli" "$ver"
  else
    printf "  %-15s NOT INSTALLED\n" "$cli"
  fi
done
echo

# ── Resume-flag detection ────────────────────────────────
echo "## Resume flags"
detect_resume() {
  local cli=$1
  local out
  # Grep ALL --resume / --continue / -r / `resume ` (codex subcommand)
  # lines, then pick the most informative one. Earlier draft used a
  # too-narrow regex that missed -r prefixes (Gemini/Droid) and
  # mis-matched --cloud for Cursor.
  out=$("$cli" --help 2>&1 | grep -iE "(\-\-resume|\-\-continue|^\s*resume\s|\-r,\s\-\-resume)" | head -1)
  if [ -n "$out" ]; then
    echo "$out" | sed 's/^[[:space:]]*//' | head -c 80
  else
    echo "(none in --help)"
  fi
}
for cli in "${AGENTS[@]}"; do
  if command -v "$cli" >/dev/null 2>&1; then
    flag=$(detect_resume "$cli")
    printf "  %-15s %s\n" "$cli" "$flag"
  fi
done
echo

# ── Headless smoke ───────────────────────────────────────
# Each agent needs its own headless invocation — this is the
# matrix Test 7. Failure here means our adapter's headless flags
# are wrong (or the agent's defaults changed). Re-test on every
# CLI bump.
echo "## Headless smoke (\"say hi\")"
mkdir -p "$TMP/probe-cwd"
cd "$TMP/probe-cwd"

run_test() {
  local label=$1
  shift
  local start=$(date +%s)
  "$@" > /dev/null 2>"$TMP/$label.err"
  local ec=$?
  local end=$(date +%s)
  local dur=$((end - start))
  if [ $ec -eq 0 ]; then
    printf "  %-15s ✓ %2ss\n" "$label" "$dur"
  else
    printf "  %-15s ✗ exit=%d %2ss — see %s\n" "$label" "$ec" "$dur" "$TMP/$label.err"
  fi
}

if command -v claude >/dev/null 2>&1; then
  run_test claude claude -p "say hi" --output-format json
fi
if command -v codex >/dev/null 2>&1; then
  run_test codex codex exec --skip-git-repo-check --output-last-message "$TMP/codex.out" "say hi"
fi
if command -v cursor-agent >/dev/null 2>&1; then
  run_test cursor cursor-agent -p "say hi" --output-format text --trust --model auto
fi
if command -v gemini >/dev/null 2>&1; then
  run_test gemini env GOOGLE_GENAI_USE_GCA=true gemini -p "say hi" --output-format text --approval-mode yolo --skip-trust
fi
if command -v droid >/dev/null 2>&1; then
  run_test droid droid exec --output-format stream-json --auto medium "say hi"
fi
if command -v copilot >/dev/null 2>&1; then
  run_test copilot copilot -p "say hi" --output-format json --allow-all-tools
fi
if command -v opencode >/dev/null 2>&1; then
  # OpenCode's CLI headless mode is `opencode run`, not the serve+SDK
  # path our adapter uses. We probe `run` for completeness — there's
  # no `--print` flag on opencode 1.14.x; the default output is the
  # final response text on stdout.
  run_test opencode opencode run "say hi"
fi

echo
echo "Done. Update docs/AGENT_CAPABILITY_TEST_MATRIX.md if anything regressed."
