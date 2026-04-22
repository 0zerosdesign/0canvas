// ──────────────────────────────────────────────────────────
// Auto-updater — runtime-aware (Tauri plugin OR electron-updater)
// ──────────────────────────────────────────────────────────
//
// Cursor-style flow: on launch (and every 30 min) we ask the
// configured GitHub Releases endpoint whether a newer version
// exists. When one is available, `status.kind === "available"`
// and the Update pill in the profile row becomes visible.
// Clicking it calls `install()` which downloads the signed
// update, verifies it, applies it, and relaunches the app.
//
// Two backends, same UI contract:
//   Tauri    → @tauri-apps/plugin-updater + plugin-process
//   Electron → electron-updater via main-process IPC
//
// Outside a native runtime (plain Vite dev), everything no-ops
// so the dev harness doesn't explode on imports.
// ──────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { isElectron, isTauri, nativeInvoke, nativeListen } from "./runtime";

export type UpdaterStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; version: string; notes?: string }
  | {
      kind: "downloading";
      version: string;
      downloaded: number;
      total?: number;
    }
  | { kind: "ready"; version: string }
  | { kind: "error"; message: string };

const POLL_INTERVAL_MS = 30 * 60 * 1000;

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return JSON.stringify(err);
}

export function useUpdater(): {
  status: UpdaterStatus;
  checkNow: () => Promise<void>;
  install: () => Promise<void>;
} {
  const [status, setStatus] = useState<UpdaterStatus>({ kind: "idle" });
  // Tauri-only: hold the resolved Update handle between `check()` and
  // `install()` so we don't re-hit the network when the user clicks the
  // pill. Electron uses event-driven state managed in the main process.
  const pending = useRef<unknown>(null);

  // ── Tauri implementation ──────────────────────────────────

  const checkNowTauri = useCallback(async () => {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        pending.current = null;
        setStatus({ kind: "idle" });
        return;
      }
      pending.current = update;
      setStatus({
        kind: "available",
        version: update.version,
        notes: update.body,
      });
    } catch (err) {
      // Background-check failures are common and non-actionable
      // (offline, no releases yet, transient 5xx). Log, stay idle —
      // never surface a red "Retry" pill for something the user
      // didn't initiate.
      console.warn("[updater] background check failed:", errMsg(err));
      setStatus({ kind: "idle" });
    }
  }, []);

  const installTauri = useCallback(async () => {
    const update = pending.current as
      | {
          version: string;
          downloadAndInstall: (
            onEvent?: (ev: {
              event: "Started" | "Progress" | "Finished";
              data?: { contentLength?: number; chunkLength?: number };
            }) => void,
          ) => Promise<void>;
        }
      | null;
    if (!update) return;
    try {
      let total: number | undefined;
      let downloaded = 0;
      setStatus({ kind: "downloading", version: update.version, downloaded: 0 });
      await update.downloadAndInstall((ev) => {
        if (ev.event === "Started") {
          total = ev.data?.contentLength;
          setStatus({
            kind: "downloading",
            version: update.version,
            downloaded: 0,
            total,
          });
        } else if (ev.event === "Progress") {
          downloaded += ev.data?.chunkLength ?? 0;
          setStatus({
            kind: "downloading",
            version: update.version,
            downloaded,
            total,
          });
        } else if (ev.event === "Finished") {
          setStatus({ kind: "ready", version: update.version });
        }
      });
      setStatus({ kind: "ready", version: update.version });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      setStatus({ kind: "error", message: errMsg(err) });
    }
  }, []);

  // ── Electron implementation ───────────────────────────────
  //
  // electron-updater drives status via `updater-status` events
  // from the main process; we just mirror them into local state.
  // Check is a simple IPC call that kicks off the event chain.

  const checkNowElectron = useCallback(async () => {
    try {
      const meta = await nativeInvoke<{
        version: string;
        notes?: string;
      } | null>("updater_check");
      if (!meta) {
        setStatus({ kind: "idle" });
      }
      // If meta is non-null, the main process already fired
      // `updater-status: available` via the event stream; the
      // subscriber below handled it.
    } catch (err) {
      console.warn("[updater] background check failed:", errMsg(err));
      setStatus({ kind: "idle" });
    }
  }, []);

  const installElectron = useCallback(async () => {
    try {
      await nativeInvoke<void>("updater_install");
      // Main process emits download-progress / ready events as the
      // install runs; quitAndInstall relaunches after.
    } catch (err) {
      setStatus({ kind: "error", message: errMsg(err) });
    }
  }, []);

  // ── Runtime-agnostic wrappers ─────────────────────────────

  const checkNow = useCallback(async () => {
    if (isElectron()) return checkNowElectron();
    if (isTauri()) return checkNowTauri();
  }, [checkNowElectron, checkNowTauri]);

  const install = useCallback(async () => {
    if (isElectron()) return installElectron();
    if (isTauri()) return installTauri();
  }, [installElectron, installTauri]);

  // ── Event subscription (Electron only) + boot poll ────────

  useEffect(() => {
    // Subscribe to the Electron main process's status stream. No-op
    // under Tauri (the plugin reports progress via callback instead
    // of events). The runtime.ts nativeListen already returns a
    // no-op unsubscribe when neither runtime is present.
    let unlisten: (() => void) | null = null;
    if (isElectron()) {
      void nativeListen<Record<string, unknown>>("updater-status", (p) => {
        const kind = String(p.kind ?? "idle");
        switch (kind) {
          case "idle":
          case "checking":
            setStatus({ kind } as UpdaterStatus);
            break;
          case "available":
            setStatus({
              kind: "available",
              version: String(p.version ?? ""),
              notes: typeof p.notes === "string" ? p.notes : undefined,
            });
            break;
          case "downloading":
            setStatus({
              kind: "downloading",
              version: String(p.version ?? ""),
              downloaded: typeof p.downloaded === "number" ? p.downloaded : 0,
              total: typeof p.total === "number" ? p.total : undefined,
            });
            break;
          case "ready":
            setStatus({ kind: "ready", version: String(p.version ?? "") });
            break;
          case "error":
            setStatus({
              kind: "error",
              message: String(p.message ?? "update failed"),
            });
            break;
          default:
            // Unknown → stay put
            break;
        }
      }).then((fn) => {
        unlisten = fn;
      });
    }
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isElectron() && !isTauri()) return;
    void checkNow();
    const id = window.setInterval(() => {
      void checkNow();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [checkNow]);

  return { status, checkNow, install };
}
