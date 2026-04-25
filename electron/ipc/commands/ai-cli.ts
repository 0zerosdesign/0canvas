// ──────────────────────────────────────────────────────────
// IPC commands: AI CLI helpers (install-probe, auth-probe, login)
// ──────────────────────────────────────────────────────────
//
// In the native agent runtime, the actual CLI
// subprocess lifecycle lives inside `src/engine/agents/` and rides
// the WebSocket between engine and renderer. The three commands
// below are the thin IPC helpers Settings still calls directly
// from the renderer:
//
//   - ai_cli_check               "is <binary> on PATH?"
//   - ai_cli_is_authenticated    fallback auth probe (legacy)
//   - ai_cli_run_login           osascript → Terminal → `<bin> login`
//
// The legacy claude_spawn / codex_spawn / ai_cli_cancel commands
// were removed because they duplicated (and drifted from) the
// new AgentGateway path. Their sole caller was the unmounted
// `src/zeros/panels/ai-chat-panel.tsx`, so deleting them is a
// true-dead-code removal rather than a behaviour change.
// ──────────────────────────────────────────────────────────

import { spawn as spawnChild, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { CommandHandler } from "../router";

// ── which-style binary lookup ─────────────────────────────

/** Node has no built-in `which`, so shell out to the POSIX `which`.
 *  Returns absolute path on success, null when
 *  not on PATH. PATH inheritance is handled by `fix-path` during
 *  Electron boot (see electron/main.ts::hydrateShellPath). */
function whichBinary(binary: string): string | null {
  try {
    const result = spawnSync("which", [binary], { encoding: "utf-8" });
    if (result.status !== 0) return null;
    const p = (result.stdout ?? "").trim();
    return p || null;
  } catch {
    return null;
  }
}

export const aiCliCheck: CommandHandler = (args) => {
  const binary = String(args.binary ?? "");
  if (!binary) return null;
  return whichBinary(binary);
};

// ── Auth probe (filesystem evidence, never reads tokens) ──
//
// LEGACY PATH. The engine's `AGENT_MANIFEST.authProbe` +
// `evaluateAuthProbe()` in src/engine/agents/probes.ts is the
// authoritative auth-state source now — its result ships on the
// wire as `BridgeRegistryAgent.authenticated`. The Agents panel
// calls this IPC only when the engine didn't populate that field
// (stale engine binary, agents without an AuthProbe).
//
// Keep this table in sync with the manifest. Drift here manifests
// as "composer says I'm signed in, Settings says I'm not" which is
// exactly the bug we just shipped and had to chase.

const AUTH_MARKERS: Record<string, string[]> = {
  // Claude Code — keychain entry is primary; dotfiles below are
  // fallback. keychainHasClaudeCredentials() handles the keychain
  // probe separately.
  claude: [
    ".claude/.credentials.json",
    ".claude/auth.json",
    ".claude/settings.json",
    ".claude/sessions",
    ".claude/projects",
    ".claude/history.jsonl",
  ],
  codex: [".codex/auth.json"],
  gemini: [".gemini/oauth_creds.json"],
  amp: [".config/amp/settings.json"],
  copilot: [".copilot/config.json", ".copilot/mcp-config.json"],
  droid: [".factory/config.json"],
  "cursor-agent": [".cursor/cli-config.json"],
  cursor: [".cursor/cli-config.json"],
};

function probeAuth(binary: string, home: string): boolean {
  const explicit = AUTH_MARKERS[binary];
  if (explicit) {
    if (explicit.some((m) => existsSync(path.join(home, m)))) return true;
  } else if (
    existsSync(path.join(home, `.${binary}`)) ||
    existsSync(path.join(home, ".config", binary))
  ) {
    return true;
  }

  // Keychain fallback (macOS) — Claude Code's newer versions store
  // the OAuth entry in Keychain under "Claude Code-credentials"
  // instead of writing to `~/.claude/.credentials.json`. Memoised
  // for 30s so we don't spawn `security` on every window focus.
  if (binary === "claude" && process.platform === "darwin") {
    return keychainHasClaudeCredentials();
  }
  return false;
}

let claudeKcCache: { ok: boolean; at: number } | null = null;
const KEYCHAIN_CACHE_MS = 30_000;

function keychainHasClaudeCredentials(): boolean {
  const now = Date.now();
  if (claudeKcCache && now - claudeKcCache.at < KEYCHAIN_CACHE_MS) {
    return claudeKcCache.ok;
  }
  try {
    const result = spawnSync(
      "security",
      ["find-generic-password", "-s", "Claude Code-credentials"],
      { timeout: 1500, stdio: "ignore" },
    );
    const ok = result.status === 0;
    claudeKcCache = { ok, at: now };
    return ok;
  } catch {
    claudeKcCache = { ok: false, at: now };
    return false;
  }
}

export const aiCliIsAuthenticated: CommandHandler = (args) => {
  const binary = String(args.binary ?? "");
  if (!binary) return false;
  const home = process.env.HOME;
  if (!home) return false;
  return probeAuth(binary, home);
};

// ── Login trigger — opens Terminal running `<bin> login` ──
//
// `<binary> login` is the convention Claude, Codex, Gemini, and
// most other agent CLIs follow. For agents that diverge (e.g.
// `gh auth login`), the user still lands in Terminal with the
// right binary name ready to hand — they can edit before Enter.
//
// This is also the target of the native adapters' synthesised
// `terminal` auth method (see adapters/base.ts::TERMINAL_AUTH_METHOD).

export const aiCliRunLogin: CommandHandler = async (args) => {
  const binary = String(args.binary ?? "").trim();
  if (!binary) throw new Error("ai_cli_run_login: missing binary");
  // Allow-list regex — no spaces or shell metachars escape into osascript.
  if (!/^[a-zA-Z0-9_.-]+$/.test(binary)) {
    throw new Error(`ai_cli_run_login: invalid binary name '${binary}'`);
  }
  const script = `tell application "Terminal" to do script "${binary} login"`;
  await new Promise<void>((resolve, reject) => {
    const child = spawnChild("osascript", ["-e", script], {
      stdio: "ignore",
      detached: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
};
