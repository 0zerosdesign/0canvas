// ──────────────────────────────────────────────────────────
// Claude hook injection
// ──────────────────────────────────────────────────────────
//
// Claude Code reads hook definitions from its config directory. We
// give each session its own CLAUDE_CONFIG_DIR so our hooks can't
// bleed into the user's global config or project `.claude/`.
//
// Hook transport is HTTP — Claude POSTs a JSON payload to our local
// server, headers carry the session token that the hook server uses
// to authenticate the request and route to the right adapter.
//
// Events we register:
//   - PreToolUse   — permission gate (can block)
//   - PostToolUse  — tool result telemetry
//   - Stop         — end-of-turn marker
//   - Notification — auth/UI-nudge side channel
//
// The hook payload Claude sends includes session_id, tool_name,
// tool_input, tool_use_id — enough for the adapter to correlate with
// the live stream-json events.
//
// ──────────────────────────────────────────────────────────

import * as fsp from "node:fs/promises";
import * as path from "node:path";

const HOOK_HEADER_TOKEN = "X-Zeros-Token";
const HOOK_HEADER_SESSION = "X-Zeros-Session-Id";
const HOOK_HEADER_EVENT = "X-Zeros-Event";

interface ClaudeHookSpec {
  type: "http";
  url: string;
  headers: Record<string, string>;
  allowedEnvVars?: string[];
}

interface ClaudeHookMatcher {
  matcher?: string;
  hooks: ClaudeHookSpec[];
}

interface ClaudeSettings {
  hooks: {
    PreToolUse?: ClaudeHookMatcher[];
    PostToolUse?: ClaudeHookMatcher[];
    Stop?: ClaudeHookMatcher[];
    Notification?: ClaudeHookMatcher[];
    SessionEnd?: ClaudeHookMatcher[];
  };
}

export interface ClaudeHookInstallInput {
  /** Where CLAUDE_CONFIG_DIR points for this session. */
  configDir: string;
  /** URL of our localhost hook server — from HookServerHandle. */
  hookUrl: string;
  /** Token the hook server issued for this session. */
  token: string;
  /** Session id the adapter uses internally (also the header value). */
  sessionId: string;
}

/**
 * Write Claude's per-session settings.json with our hook endpoints
 * installed. Every event posts to the same URL; the `X-Zeros-Event`
 * header disambiguates which lifecycle point fired.
 *
 * Values are baked into the JSON at write-time rather than interpolated
 * via `${ENV_VAR}` — simpler, one less moving piece, and the file is
 * already private to this session's dir.
 */
export async function installClaudeHooks(
  input: ClaudeHookInstallInput,
): Promise<string> {
  const { configDir, hookUrl, token, sessionId } = input;

  const baseHeaders = {
    [HOOK_HEADER_TOKEN]: token,
    [HOOK_HEADER_SESSION]: sessionId,
  };

  const hookFor = (event: string): ClaudeHookSpec => ({
    type: "http",
    url: hookUrl,
    headers: { ...baseHeaders, [HOOK_HEADER_EVENT]: event },
  });

  const settings: ClaudeSettings = {
    hooks: {
      // Fires before EVERY tool call. We gate permissions here. A
      // blank matcher (".*") applies to all tools; the adapter
      // decides which need user approval.
      PreToolUse: [
        { matcher: ".*", hooks: [hookFor("PreToolUse")] },
      ],
      PostToolUse: [
        { matcher: ".*", hooks: [hookFor("PostToolUse")] },
      ],
      Stop: [{ hooks: [hookFor("Stop")] }],
      Notification: [{ hooks: [hookFor("Notification")] }],
      SessionEnd: [{ hooks: [hookFor("SessionEnd")] }],
    },
  };

  await fsp.mkdir(configDir, { recursive: true });
  const settingsPath = path.join(configDir, "settings.json");
  await fsp.writeFile(settingsPath, JSON.stringify(settings, null, 2), {
    encoding: "utf-8",
    // 0600 — dir is already session-private, but belt-and-suspenders
    // so the token can't be read by other users on shared machines.
    mode: 0o600,
  });
  return settingsPath;
}
