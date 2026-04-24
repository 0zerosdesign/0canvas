// ──────────────────────────────────────────────────────────
// Copilot CLI hook injection
// ──────────────────────────────────────────────────────────
//
// Copilot CLI reads hooks from `<COPILOT_HOME>/hooks.json` (or
// equivalent config file loaded at spawn) with shape:
//
//   {
//     "version": 1,
//     "hooks": {
//       "sessionStart":        [{ "type": "http", "url": "..." }],
//       "preToolUse":          [{ "type": "http", "url": "..." }],
//       "postToolUse":         [{ "type": "http", "url": "..." }],
//       "userPromptSubmitted": [{ "type": "http", "url": "..." }],
//       "sessionEnd":          [{ "type": "http", "url": "..." }],
//       "errorOccurred":       [{ "type": "http", "url": "..." }]
//     }
//   }
//
// The shape is best-effort (Copilot's hook spec has evolved through
// GA). If the field names or file name diverge in a given CLI
// version, the hooks silently don't fire — the adapter still works
// via PTY.
//
// ──────────────────────────────────────────────────────────

import * as fsp from "node:fs/promises";
import * as path from "node:path";

const HOOK_HEADER_TOKEN = "X-Zeros-Token";
const HOOK_HEADER_SESSION = "X-Zeros-Session-Id";
const HOOK_HEADER_EVENT = "X-Zeros-Event";

interface CopilotHookSpec {
  type: "http";
  url: string;
  headers: Record<string, string>;
}

interface CopilotSettings {
  version: 1;
  hooks: {
    sessionStart?: CopilotHookSpec[];
    preToolUse?: CopilotHookSpec[];
    postToolUse?: CopilotHookSpec[];
    userPromptSubmitted?: CopilotHookSpec[];
    sessionEnd?: CopilotHookSpec[];
    errorOccurred?: CopilotHookSpec[];
  };
}

export interface CopilotHookInstallInput {
  configDir: string;
  hookUrl: string;
  token: string;
  sessionId: string;
}

export async function installCopilotHooks(
  input: CopilotHookInstallInput,
): Promise<string> {
  const { configDir, hookUrl, token, sessionId } = input;
  const baseHeaders = {
    [HOOK_HEADER_TOKEN]: token,
    [HOOK_HEADER_SESSION]: sessionId,
  };
  const hookFor = (event: string): CopilotHookSpec => ({
    type: "http",
    url: hookUrl,
    headers: { ...baseHeaders, [HOOK_HEADER_EVENT]: event },
  });
  const settings: CopilotSettings = {
    version: 1,
    hooks: {
      sessionStart: [hookFor("sessionStart")],
      preToolUse: [hookFor("preToolUse")],
      postToolUse: [hookFor("postToolUse")],
      userPromptSubmitted: [hookFor("userPromptSubmitted")],
      sessionEnd: [hookFor("sessionEnd")],
      errorOccurred: [hookFor("errorOccurred")],
    },
  };
  await fsp.mkdir(configDir, { recursive: true });
  // Copilot reads either `config.json` or `hooks.json` depending on
  // version. Write both so whichever filename the CLI looks for
  // finds our definitions. Contents are identical.
  const configPath = path.join(configDir, "config.json");
  const hooksPath = path.join(configDir, "hooks.json");
  const body = JSON.stringify(settings, null, 2);
  await Promise.all([
    fsp.writeFile(configPath, body, { encoding: "utf-8", mode: 0o600 }),
    fsp.writeFile(hooksPath, body, { encoding: "utf-8", mode: 0o600 }),
  ]);
  return configPath;
}
