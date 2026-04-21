// ──────────────────────────────────────────────────────────
// Auto-updater — Tauri updater plugin bridge
// ──────────────────────────────────────────────────────────
//
// Cursor-style flow: on launch (and every 30 min) we ask the
// configured GitHub Releases endpoint whether a newer version
// exists. When one is available, `status.kind === "available"`
// and the Update pill in the profile row becomes visible.
// Clicking it calls `install()` which downloads the signed
// update, verifies it against the pubkey in tauri.conf.json,
// applies it, and relaunches the app.
//
// Outside Tauri (plain `pnpm dev` via Vite) everything no-ops
// so the dev harness doesn't explode on imports.
// ──────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";

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

function isTauriWebview(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useUpdater(): {
  status: UpdaterStatus;
  checkNow: () => Promise<void>;
  install: () => Promise<void>;
} {
  const [status, setStatus] = useState<UpdaterStatus>({ kind: "idle" });
  // Hold the resolved Update handle between `check()` and `install()` so
  // we don't re-hit the network when the user clicks the pill.
  const pending = useRef<unknown>(null);

  const checkNow = useCallback(async () => {
    if (!isTauriWebview()) return;
    // Don't flash "checking" state in the UI — background polling every
    // 30 min shouldn't produce visual churn. Only an available update
    // should surface anything visible.
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
      // Background-check failures are common and non-actionable:
      //   - no releases exist yet (first run before CI publishes)
      //   - offline / rate-limited / transient 5xx
      //   - the endpoint was temporarily misconfigured
      // Logging to console is enough; never surface a red "Retry" pill
      // for something the user didn't initiate. Stay idle.
      console.warn("[updater] background check failed:", errMsg(err));
      setStatus({ kind: "idle" });
    }
  }, []);

  const install = useCallback(async () => {
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

  useEffect(() => {
    if (!isTauriWebview()) return;
    void checkNow();
    const id = window.setInterval(() => {
      void checkNow();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [checkNow]);

  return { status, checkNow, install };
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return JSON.stringify(err);
}
