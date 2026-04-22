// ──────────────────────────────────────────────────────────
// Auto-updater — version check + browser-based install
// ──────────────────────────────────────────────────────────
//
// macOS auto-install via electron-updater's quitAndInstall() requires
// a Developer-ID-signed app. Ad-hoc signed builds (our current state:
// `mac.identity: null` + afterPack codesign) can't be replaced
// in-place reliably — quitAndInstall fails silently or throws, and
// the user hits a dead "Retry" button.
//
// Until we get an Apple cert we do the pragmatic thing: use
// electron-updater only for VERSION DETECTION (it parses the GitHub
// release's latest-mac.yml, compares against app.getVersion(), and
// fires update-available). When the user clicks install we
// `shell.openExternal(dmgUrl)` to download the new DMG in the
// browser; the user drags it to /Applications to replace the old
// version. Same pattern Rectangle, ImageOptim, etc. use.
//
// Once we have a Developer ID:
//   1. Flip mac.identity in electron-builder.yml
//   2. Add notarization (notarize: true + Apple ID env vars)
//   3. Swap updaterInstall() back to `autoUpdater.quitAndInstall`
// ──────────────────────────────────────────────────────────

import { app, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { emitEvent } from "./ipc/events";
import type { CommandHandler } from "./ipc/router";

let wired = false;

/** Holds the DMG URL from the most recent update check so the
 *  install handler can open it without a second network round-trip. */
let pendingDmgUrl: string | null = null;
let pendingVersion: string | null = null;

function forward(kind: string, extra: Record<string, unknown> = {}): void {
  emitEvent("updater-status", { kind, ...extra });
}

/** Build a direct GitHub Releases DMG URL from the version string.
 *  Matches electron-builder's filename pattern:
 *    Zeros-<version>-arm64.dmg
 *  If the pattern ever changes, update here. */
function buildDmgUrl(version: string): string {
  // Matches publish config in electron-builder.yml: Withso/zeros
  return `https://github.com/Withso/zeros/releases/download/v${version}/Zeros-${version}-arm64.dmg`;
}

/** Wire electron-updater's events once. We only listen for
 *  check-related events now — download/install events are skipped
 *  because we don't use electron-updater's download flow. */
export function setupUpdater(): void {
  if (wired) return;
  wired = true;

  // Dev / unpackaged builds: no meaningful update source.
  if (!app.isPackaged) return;

  // autoDownload false because we never use electron-updater's
  // own download path. We only use it for version comparison.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    forward("checking");
  });
  autoUpdater.on("update-available", (info) => {
    const version = info?.version ?? "";
    pendingVersion = version;
    pendingDmgUrl = version ? buildDmgUrl(version) : null;
    forward("available", {
      version,
      notes:
        typeof info?.releaseNotes === "string" ? info.releaseNotes : undefined,
    });
  });
  autoUpdater.on("update-not-available", () => {
    pendingVersion = null;
    pendingDmgUrl = null;
    forward("idle");
  });
  autoUpdater.on("error", (err) => {
    // Background check failures are noisy but non-fatal — log and
    // stay idle rather than flashing a red Retry pill the user
    // can't act on. Common causes: 404 before first release,
    // offline, rate-limited.
    // eslint-disable-next-line no-console
    console.warn("[updater] check error:", err?.message ?? err);
    forward("idle");
  });
}

// ── IPC commands exposed to the renderer ──────────────────

/** Check for updates. Returns lightweight metadata synchronously so
 *  the renderer can paint the pill immediately if a new version is
 *  live. Event stream handles longer-running progress. */
export const updaterCheck: CommandHandler = async () => {
  if (!app.isPackaged) return null;
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.updateInfo) return null;
    const info = result.updateInfo;
    // Only surface a "new version" when it's actually newer than the
    // running one. electron-updater may return the same version as a
    // no-op — emitEvent already handled that via the update-not-available
    // listener; here we mirror the guard so the renderer doesn't flash
    // an Update pill when nothing's really new.
    const current = app.getVersion();
    if (info.version === current) return null;
    return {
      version: info.version,
      notes:
        typeof info.releaseNotes === "string" ? info.releaseNotes : undefined,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[updater] check failed:", err);
    return null;
  }
};

/** "Install" = open the DMG in the user's browser. User drags
 *  new app into /Applications to replace the old one. */
export const updaterInstall: CommandHandler = async () => {
  if (!app.isPackaged) return;

  // Prefer the URL captured during the check — guaranteed to match
  // the version the UI currently shows as "available".
  const url = pendingDmgUrl;
  if (!url) {
    // Fallback: latest release page. Happens when the user clicks
    // install before a check has resolved an explicit version.
    await shell.openExternal("https://github.com/Withso/zeros/releases/latest");
    return;
  }
  try {
    await shell.openExternal(url);
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : String(err),
    );
  }
};

/** Explicit process relaunch (matches Tauri's plugin-process
 *  `relaunch()`). Kept for any caller that still needs an in-place
 *  restart after external state change. */
export const processRelaunch: CommandHandler = () => {
  app.relaunch();
  app.exit(0);
};
