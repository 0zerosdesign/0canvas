// ──────────────────────────────────────────────────────────
// Session directory layout — ~/Library/Application Support/Zeros/sessions/
// ──────────────────────────────────────────────────────────
//
// One directory per session. Persistent across app restarts so a
// crash mid-session leaves a breadcrumb the next boot can pick up
// (Phase 7+ will wire actual recovery). Cleaned on graceful session
// end or app-quit.
//
// Linux/Windows fall back to XDG / %APPDATA%; we prefer macOS-native
// paths since Zeros' primary distribution is the Mac app.
//
// ──────────────────────────────────────────────────────────

import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const APP_NAME = "Zeros";

function baseDir(): string {
  switch (process.platform) {
    case "darwin":
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        APP_NAME,
      );
    case "win32": {
      const appData = process.env.APPDATA
        ?? path.join(os.homedir(), "AppData", "Roaming");
      return path.join(appData, APP_NAME);
    }
    default: {
      // Linux / BSD — XDG_DATA_HOME or ~/.local/share
      const xdg = process.env.XDG_DATA_HOME
        ?? path.join(os.homedir(), ".local", "share");
      return path.join(xdg, APP_NAME.toLowerCase());
    }
  }
}

/** Root of all session state on this machine. */
export function sessionsRoot(): string {
  return path.join(baseDir(), "sessions");
}

/** Path for a single session. Does NOT create anything — caller calls `ensureSessionDir`. */
export function sessionDir(sessionId: string): string {
  return path.join(sessionsRoot(), sanitizeId(sessionId));
}

/** Create the session dir + standard subdirs. Idempotent. */
export async function ensureSessionDir(sessionId: string): Promise<{
  root: string;
  env: string;
  log: string;
  telemetry: string;
}> {
  const root = sessionDir(sessionId);
  const env = path.join(root, "env");
  const log = path.join(root, "log");
  const telemetry = path.join(root, "telemetry");
  await fsp.mkdir(env, { recursive: true });
  await fsp.mkdir(log, { recursive: true });
  await fsp.mkdir(telemetry, { recursive: true });
  return { root, env, log, telemetry };
}

/** Write session metadata (agent id, pid, created-at) for crash recovery. */
export async function writeSessionMeta(
  sessionId: string,
  meta: {
    agentId: string;
    cwd: string;
    pid?: number;
    createdAt: number;
  },
): Promise<void> {
  const root = sessionDir(sessionId);
  await fsp.writeFile(path.join(root, "meta.json"), JSON.stringify(meta, null, 2));
}

/** Remove the entire session dir. Called on graceful session end. */
export async function removeSessionDir(sessionId: string): Promise<void> {
  await fsp.rm(sessionDir(sessionId), { recursive: true, force: true });
}

/** Allow-list: alnum, dash, underscore. Matches UUID + our custom ids.
 *  Anything else gets stripped so we can never escape sessionsRoot(). */
function sanitizeId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) throw new Error(`invalid session id: ${id}`);
  return clean;
}
