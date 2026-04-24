// ──────────────────────────────────────────────────────────
// Factory Droid hook injection
// ──────────────────────────────────────────────────────────
//
// Droid's hook API mirrors Claude Code's exactly: same event names,
// same stdin-JSON envelope, same exit-2 blocking, same
// {"hookSpecificOutput":{"permissionDecision":"allow|deny|ask"}}.
// See https://docs.factory.ai/reference/hooks-reference.
//
// We assume Droid honors `FACTORY_CONFIG_DIR` the same way Claude
// honors `CLAUDE_CONFIG_DIR` — per-process override of the config
// search path. If Droid in fact uses a different env var, the hooks
// silently don't fire and the adapter falls back to its default
// stream-json behavior (degraded but not broken). This assumption
// will be confirmed (or corrected) the first time a user exercises
// a tool-call-approval flow.
//
// ──────────────────────────────────────────────────────────

import * as fsp from "node:fs/promises";
import * as path from "node:path";

const HOOK_HEADER_TOKEN = "X-Zeros-Token";
const HOOK_HEADER_SESSION = "X-Zeros-Session-Id";
const HOOK_HEADER_EVENT = "X-Zeros-Event";

interface DroidHookSpec {
  type: "http";
  url: string;
  headers: Record<string, string>;
}

interface DroidHookMatcher {
  matcher?: string;
  hooks: DroidHookSpec[];
}

interface DroidSettings {
  hooks: {
    PreToolUse?: DroidHookMatcher[];
    PostToolUse?: DroidHookMatcher[];
    Stop?: DroidHookMatcher[];
    Notification?: DroidHookMatcher[];
    SessionEnd?: DroidHookMatcher[];
  };
}

export interface DroidHookInstallInput {
  configDir: string;
  hookUrl: string;
  token: string;
  sessionId: string;
}

export async function installDroidHooks(
  input: DroidHookInstallInput,
): Promise<string> {
  const { configDir, hookUrl, token, sessionId } = input;
  const baseHeaders = {
    [HOOK_HEADER_TOKEN]: token,
    [HOOK_HEADER_SESSION]: sessionId,
  };
  const hookFor = (event: string): DroidHookSpec => ({
    type: "http",
    url: hookUrl,
    headers: { ...baseHeaders, [HOOK_HEADER_EVENT]: event },
  });
  const settings: DroidSettings = {
    hooks: {
      PreToolUse: [{ matcher: ".*", hooks: [hookFor("PreToolUse")] }],
      PostToolUse: [{ matcher: ".*", hooks: [hookFor("PostToolUse")] }],
      Stop: [{ hooks: [hookFor("Stop")] }],
      Notification: [{ hooks: [hookFor("Notification")] }],
      SessionEnd: [{ hooks: [hookFor("SessionEnd")] }],
    },
  };
  await fsp.mkdir(configDir, { recursive: true });
  const settingsPath = path.join(configDir, "settings.json");
  await fsp.writeFile(settingsPath, JSON.stringify(settings, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
  return settingsPath;
}
