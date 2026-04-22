// ──────────────────────────────────────────────────────────
// Auto-updater wiring (electron-updater)
// ──────────────────────────────────────────────────────────
//
// Replaces tauri-plugin-updater. electron-updater looks for
// `latest-mac.yml` (and the signed zip/dmg it points at) in
// GitHub Releases — electron-builder drops those artifacts
// at release time (Phase 9 config).
//
// The renderer's useUpdater() hook subscribes to `updater-status`
// events to drive the Update pill UI. Possible kinds:
//   idle | checking | available | downloading | ready | error
//
// Matches the existing Tauri-side UpdaterStatus union in
// src/native/updater.ts so the React component doesn't branch.
// ──────────────────────────────────────────────────────────

import { app } from "electron";
import { autoUpdater } from "electron-updater";
import { emitEvent } from "./ipc/events";
import type { CommandHandler } from "./ipc/router";

let wired = false;

function forward(kind: string, extra: Record<string, unknown> = {}): void {
  emitEvent("updater-status", { kind, ...extra });
}

/** Wire electron-updater's events once. Logs to console (matches
 *  the Tauri-side background warnings) and forwards structured
 *  status to the renderer for the Update pill. */
export function setupUpdater(): void {
  if (wired) return;
  wired = true;

  // Dev / unpackaged builds: no meaningful update source. Skip
  // silently so hitting the Update button in `pnpm electron:dev`
  // doesn't throw.
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false; // require explicit install click
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    forward("checking");
  });
  autoUpdater.on("update-available", (info) => {
    forward("available", {
      version: info?.version ?? "",
      notes:
        typeof info?.releaseNotes === "string"
          ? info.releaseNotes
          : undefined,
    });
  });
  autoUpdater.on("update-not-available", () => {
    forward("idle");
  });
  autoUpdater.on("download-progress", (progress) => {
    forward("downloading", {
      downloaded: progress?.transferred ?? 0,
      total: progress?.total ?? null,
      version: autoUpdater.currentVersion?.version ?? "",
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    forward("ready", { version: info?.version ?? "" });
  });
  autoUpdater.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.warn("[updater] error:", err?.message ?? err);
    forward("error", { message: err?.message ?? String(err) });
  });
}

// ── IPC commands exposed to the renderer ──────────────────

/** Check for updates — mirrors Tauri's `check()` call. Returns
 *  lightweight metadata the renderer can display immediately. */
export const updaterCheck: CommandHandler = async () => {
  if (!app.isPackaged) return null;
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.updateInfo) return null;
    const info = result.updateInfo;
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

/** Download + install + relaunch. Mirrors the Tauri side's
 *  downloadAndInstall() + relaunch() chain — `quitAndInstall()`
 *  handles both steps. */
export const updaterInstall: CommandHandler = async () => {
  if (!app.isPackaged) return;
  try {
    await autoUpdater.downloadUpdate();
    // Events (download-progress / update-downloaded) fire during the
    // download; the renderer picks them up via `updater-status` and
    // reflects them in the pill.
    autoUpdater.quitAndInstall(false, true);
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : String(err),
    );
  }
};

/** Explicit process relaunch (matches Tauri's plugin-process
 *  `relaunch()`). Used by the updater install flow when the caller
 *  wants to stage-then-relaunch separately. */
export const processRelaunch: CommandHandler = () => {
  app.relaunch();
  app.exit(0);
};
