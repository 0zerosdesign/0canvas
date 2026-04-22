// ──────────────────────────────────────────────────────────
// Auto-updater — electron-updater bridge
// ──────────────────────────────────────────────────────────
//
// Cursor-style flow: on launch (and every 30 min) the main
// process checks the configured GitHub Releases endpoint for a
// newer version. When one is available, `status.kind ===
// "available"` and the Update pill in the profile row becomes
// visible. Clicking it calls `install()`, which downloads the
// signed update and relaunches the app via
// electron-updater's quitAndInstall().
//
// Under `pnpm dev` (no packaged main process) both checkNow and
// install no-op — app.isPackaged is false on the main side and
// updater_check returns null.
// ──────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { isElectron, nativeInvoke, nativeListen } from "./runtime";

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

  const checkNow = useCallback(async () => {
    if (!isElectron()) return;
    try {
      const meta = await nativeInvoke<{
        version: string;
        notes?: string;
      } | null>("updater_check");
      if (!meta) setStatus({ kind: "idle" });
      // If meta is non-null, the main process already fired
      // `updater-status: available` via the event stream; the
      // subscriber below handled it.
    } catch (err) {
      // Background-check failures are common and non-actionable
      // (offline, no releases yet, transient 5xx). Log, stay idle —
      // never surface a red "Retry" pill for something the user
      // didn't initiate.
      console.warn("[updater] background check failed:", errMsg(err));
      setStatus({ kind: "idle" });
    }
  }, []);

  const install = useCallback(async () => {
    if (!isElectron()) return;
    try {
      await nativeInvoke<void>("updater_install");
      // Main process emits download-progress / ready events during
      // the install; quitAndInstall relaunches after.
    } catch (err) {
      setStatus({ kind: "error", message: errMsg(err) });
    }
  }, []);

  // Subscribe to the main-process status stream once on mount.
  useEffect(() => {
    if (!isElectron()) return;
    let unlisten: (() => void) | null = null;
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
    return () => {
      unlisten?.();
    };
  }, []);

  // Boot-time check + 30-min background poll.
  useEffect(() => {
    if (!isElectron()) return;
    void checkNow();
    const id = window.setInterval(() => {
      void checkNow();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [checkNow]);

  return { status, checkNow, install };
}
