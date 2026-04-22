// ──────────────────────────────────────────────────────────
// zeros:// deep-link handler
// ──────────────────────────────────────────────────────────
//
// Ports handle_deep_link() from src-tauri/src/lib.rs (lines 289-340)
// plus the tauri_plugin_deep_link plumbing. Electron handles URL
// schemes differently from Tauri on each platform — all three code
// paths converge here:
//
//   1. App ALREADY running, user clicks zeros:// URL
//      → macOS: `app.on("open-url", ...)`
//      → Win/Linux: `app.on("second-instance", (_, argv) => ...)`
//         with the URL at the end of argv (requires single-instance
//         lock, which we take below)
//
//   2. App launched COLD by clicking zeros:// URL
//      → macOS: must register `open-url` INSIDE `will-finish-launching`,
//         otherwise the URL is dropped before the handler binds.
//      → Win/Linux: process.argv contains the URL on first boot.
//
// Action routing (mirrors Rust):
//   zeros://open?path=/abs/project  → spawn engine at path, emit
//                                     project-changed
//   anything else                   → forward verbatim to renderer
//                                     as `deep-link` event so JS can
//                                     handle it without a rebuild
// ──────────────────────────────────────────────────────────

import { app } from "electron";
import {
  assertIsDirectory,
  spawnEngine,
} from "./sidecar";
import { emitEvent } from "./ipc/events";

const SCHEME = "zeros";

/** Register zeros:// as a default protocol client. Must be called
 *  EARLY (before app.whenReady) on Windows/Linux because the OS
 *  caches the registration at app startup. On macOS registration
 *  is declared in Info.plist (electron-builder wires that in
 *  Phase 9); this runtime call is a safety net for dev. */
export function registerProtocol(): void {
  // Electron's helper — on macOS this ultimately updates
  // LaunchServices; on Win/Linux it edits the registry / .desktop file.
  // In dev (unpackaged) the exact call varies; we call the simple
  // form here and let electron-builder configure bundle-level
  // registration at packaging time.
  if (process.defaultApp) {
    // `defaultApp` is true when running via `electron .` — the
    // launching binary is Electron itself, not Zeros. Register with
    // explicit process.execPath + script path so the OS knows what
    // to spawn. Works around macOS Finder ignoring `zeros://` when
    // the registering binary is generic `Electron`.
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(SCHEME, process.execPath, [
        process.argv[1],
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(SCHEME);
  }
}

/** Parse a zeros:// URL and dispatch. Safe to call before the main
 *  window exists — emitEvent no-ops if mainWindow isn't set yet; the
 *  URL is re-emitted once the window binds (see enqueueBeforeWindow). */
async function handleUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`[Zeros] deep-link: invalid URL ${rawUrl}`);
    return;
  }

  if (parsed.protocol !== `${SCHEME}:`) {
    // eslint-disable-next-line no-console
    console.warn(`[Zeros] deep-link: unexpected protocol ${parsed.protocol}`);
    return;
  }

  // Rust puts the action in the host component for `zeros://open?...`
  // because there's no //user@ part. WHATWG URL parsing also puts it
  // in `hostname`; falls back to the stripped pathname for exotic
  // forms like `zeros:/open?...`.
  const action = parsed.hostname || parsed.pathname.replace(/^\/+/, "");

  // eslint-disable-next-line no-console
  console.log(`[Zeros] deep-link: ${rawUrl} → action=${action}`);

  if (action === "open") {
    const pathParam = parsed.searchParams.get("path");
    if (!pathParam) {
      // eslint-disable-next-line no-console
      console.warn("[Zeros] deep-link: zeros://open missing path=");
      emitEvent("deep-link", rawUrl);
      return;
    }
    try {
      assertIsDirectory(pathParam);
      const port = await spawnEngine(pathParam);
      emitEvent("project-changed", { root: pathParam, port });
      // eslint-disable-next-line no-console
      console.log(`[Zeros] deep-link open: spawned engine on port ${port}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[Zeros] deep-link open failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Let the renderer see the URL so it can show an error toast
      // (better UX than a silent failure).
      emitEvent("deep-link", rawUrl);
    }
    return;
  }

  // Unknown action — forward to renderer for JS-side handling.
  emitEvent("deep-link", rawUrl);
}

/** Pulled from argv so the Windows / Linux cold-launch path works.
 *  macOS never puts the URL in argv — it delivers via open-url. */
function findUrlInArgv(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg.startsWith(`${SCHEME}://`)) return arg;
  }
  return null;
}

/** Primary entry point for boot wiring in main.ts. Registers the
 *  protocol, locks to single-instance, and binds the three possible
 *  OS paths that can deliver a zeros:// URL. */
export function setupDeepLink(): void {
  registerProtocol();

  // Single-instance lock: if the user clicks a zeros:// URL while the
  // app is running, Windows/Linux open a second Electron process; we
  // want the existing one to handle it. macOS already enforces
  // single-instance for .app bundles, but taking the lock makes the
  // `second-instance` event fire there too for symmetry.
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on("second-instance", (_event, argv) => {
    const url = findUrlInArgv(argv);
    if (url) void handleUrl(url);
  });

  // macOS: URL delivered via open-url. Must be registered inside
  // will-finish-launching so a cold-launched URL doesn't get dropped
  // before the handler is attached.
  app.on("will-finish-launching", () => {
    app.on("open-url", (event, url) => {
      event.preventDefault();
      void handleUrl(url);
    });
  });

  // Windows / Linux cold launch — the URL is in our own argv.
  const bootUrl = findUrlInArgv(process.argv);
  if (bootUrl) {
    // Defer until after whenReady so mainWindow exists for emitEvent.
    void app.whenReady().then(() => handleUrl(bootUrl));
  }
}
