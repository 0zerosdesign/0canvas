// ──────────────────────────────────────────────────────────
// Zeros Electron — main process entry
// ──────────────────────────────────────────────────────────
//
// Boot sequence:
//   1. registerIpcHandlers()         — install the `zeros:invoke` router
//   2. registerAllCommands()         — wire phase-implemented commands
//   3. spawnEngine(defaultRoot)      — child process + .port polling
//   4. startWatchdog()               — 2s TCP heartbeat, respawn on loss
//   5. createMainWindow()            — BrowserWindow + preload
//
// Shutdown:
//   - app.on("before-quit") → shutdown() kills the engine child,
//     stops the watchdog, clears state. Without this the Node
//     process outlives the window and holds port 24193.
//
// Window geometry migrated from the legacy native config:
//   1600x1000 default, 1200x700 min, hidden-inset title bar so app
//   content extends under the traffic lights.
// ──────────────────────────────────────────────────────────

// === EARLIEST TRACE (packaged app debug) ===
// Runs before any imports that could fail silently so we get at
// least one line in /tmp proving main.cjs executed. Remove after
// Phase 9 stabilises.
try {
  require("node:fs").writeFileSync(
    "/tmp/zeros-boot.log",
    `[${new Date().toISOString()}] main.cjs loaded, argv=${JSON.stringify(process.argv)}\n`,
    { flag: "a" },
  );
} catch (err) {
  // ignore — can't even write to /tmp
}

import { app, BrowserWindow, nativeImage } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerIpcHandlers } from "./ipc/router";
import { registerAllCommands } from "./ipc/commands";
import { setMainWindow } from "./ipc/events";
import {
  defaultProjectRoot,
  shutdown as shutdownSidecar,
  spawnEngine,
  startEngineCodeWatcher,
  startWatchdog,
} from "./sidecar";
import { installAppMenu } from "./menu";
import { setupDeepLink } from "./deep-link";
import { setupUpdater } from "./updater";

// ──────────────────────────────────────────────────────────
// Dev / prod environment separation
// ──────────────────────────────────────────────────────────
// `pnpm electron:dev` runs an unpackaged app; we want it to behave
// like a distinct "Zeros Dev" application so it doesn't share
// state with a packaged /Applications/Zeros.app the user also has
// installed. Shared state corrupts easily — localStorage of one
// would wipe the other, IndexedDB races, etc.
//
// This must run BEFORE anything reads app.getName() or
// app.getPath("userData") — deep-link setup, log file init, window
// construction all depend on these. Must also run before app.ready.
if (!app.isPackaged) {
  app.setName("Zeros Dev");
  // appData = ~/Library/Application Support on macOS.
  app.setPath(
    "userData",
    path.join(app.getPath("appData"), "Zeros Dev"),
  );
}

const APP_LABEL = app.getName(); // "Zeros" in prod, "Zeros Dev" in dev

// Packaged GUI apps detach from the terminal so `console.log` /
// `console.error` vanish. To debug production startup, mirror
// everything into a rotating log file under the user's app-data
// directory. Tail it with:
//   tail -f ~/Library/Logs/Zeros/main.log          # prod
//   tail -f "~/Library/Logs/Zeros Dev/main.log"    # dev
function setupLogFile(): void {
  const logDir = path.join(os.homedir(), "Library", "Logs", APP_LABEL);
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    /* can't make the log dir — nothing to do */
    return;
  }
  const logPath = path.join(logDir, "main.log");
  const stream = fs.createWriteStream(logPath, { flags: "a" });
  const origLog = console.log.bind(console);
  const origErr = console.error.bind(console);
  const stamp = () => new Date().toISOString();
  console.log = (...args: unknown[]) => {
    stream.write(`[${stamp()}] ${args.map(String).join(" ")}\n`);
    origLog(...args);
  };
  console.error = (...args: unknown[]) => {
    stream.write(`[${stamp()}] ERROR ${args.map(String).join(" ")}\n`);
    origErr(...args);
  };
  // Surface unhandled errors into the log — otherwise the app dies
  // silently and we have no trace.
  process.on("uncaughtException", (err) => {
    stream.write(`[${stamp()}] UNCAUGHT ${err.stack ?? err.message ?? err}\n`);
  });
  process.on("unhandledRejection", (reason) => {
    stream.write(`[${stamp()}] UNHANDLED ${String(reason)}\n`);
  });
  console.log(
    `[${APP_LABEL}] main log: ${logPath} | packaged=${app.isPackaged} cwd=${process.cwd()}`,
  );
}

setupLogFile();

const DEV_URL = process.env.ELECTRON_RENDERER_URL ?? "http://localhost:5173";
const isDev = !app.isPackaged;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    // Window title flips with the app identity so users can tell
    // dev and prod apart at a glance when both are open.
    title: APP_LABEL,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    void win.loadURL(DEV_URL);
    // DevTools stays closed by default. Toggle with ⌥⌘I (macOS) /
    // Ctrl+Shift+I (Win/Linux) when you actually need it. Opt in at
    // launch with `ZEROS_DEVTOOLS=1 pnpm electron:dev` if you want
    // it to open every run.
    if (process.env.ZEROS_DEVTOOLS === "1") {
      win.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    void win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  return win;
}

// Deep-link setup must happen BEFORE app.whenReady() so the
// single-instance lock is acquired and macOS's open-url handler is
// registered inside will-finish-launching (otherwise cold-launched
// zeros:// URLs get dropped).
setupDeepLink();

/** Give the Dock icon the Zeros brand in both dev and prod, and add
 *  a "Dev" badge in dev so the user can visually tell the unpackaged
 *  dev instance apart from an installed /Applications/Zeros.app.
 *
 *  In packaged builds electron-builder writes the icon into the bundle's
 *  Info.plist, so `app.dock.setIcon()` is only strictly necessary in
 *  dev. Calling it in both modes is idempotent — prod just overwrites
 *  with the same image. */
function setupDockBrand(): void {
  if (process.platform !== "darwin") return;
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "..", "..", "Resources", "icon.icns")
    : path.join(__dirname, "..", "build", "icons", "icon.png");
  try {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) app.dock?.setIcon(image);
  } catch {
    /* icon missing is cosmetic — carry on */
  }
  // Dev-mode badge — tiny "Dev" label rendered on top of the Dock
  // icon by macOS. Disappears when the app quits.
  if (!app.isPackaged) {
    app.dock?.setBadge("Dev");
  }
}

/**
 * Pull the user's real shell PATH into the Electron process BEFORE we
 * spawn the engine. macOS GUI apps launched from Finder or the Dock
 * inherit only `/usr/bin:/bin:/usr/sbin:/sbin` — no Homebrew, no
 * npm-global, no Volta/fnm/mise/asdf shims. That's why `isOnPath(
 * "claude")` in the engine's CLI probe returned false for every user
 * who installed their CLIs the normal way, and why every agent pill
 * showed "not installed" in the packaged app.
 *
 * `fix-path` runs `$SHELL -ilc 'echo $PATH'` once and rewrites
 * `process.env.PATH` before anything else reads it — including the
 * engine child spawn, which inherits the fixed PATH. Emdash, Claude
 * Desktop, and Conductor all land on the same fix; it's the standard
 * Electron-on-macOS workaround.
 *
 * Dynamic-imported because `fix-path` ships ESM-only and our main
 * bundle is CJS. The await lives inside whenReady() so we never block
 * the event loop before it's running.
 */
async function hydrateShellPath(): Promise<void> {
  try {
    const mod = (await import("fix-path")) as { default: () => void };
    mod.default();
    console.log(`[Zeros] shell PATH hydrated (${(process.env.PATH ?? "").split(":").length} entries)`);
  } catch (err) {
    // Non-fatal: on Linux / Windows the default PATH is usually fine,
    // and even on macOS the user can still launch from `pnpm electron:dev`
    // which inherits the terminal PATH anyway.
    console.warn(
      `[Zeros] fix-path failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

app.whenReady().then(async () => {
  setupDockBrand();

  // PATH repair MUST happen before spawnEngine — the engine's CLI
  // probe reads process.env.PATH at each listAgents() call, and the
  // engine child inherits our env. Awaiting here costs ~80–200ms on
  // a cold shell; worth it to make every agent pill work.
  await hydrateShellPath();

  // Install the native app menu (File > Open Folder, Edit, View, etc).
  // Safe to call before the window exists — macOS associates the
  // menu with the app, not a specific window.
  installAppMenu();

  // Wire electron-updater event forwarding. No-op on unpackaged
  // dev builds; on release builds this starts listening for
  // downloaded / available / progress / error events.
  setupUpdater();

  // IPC plumbing BEFORE the window loads so any command fired during
  // boot (ws-client's `get_engine_port` probe, store rehydrate, etc.)
  // finds a registered handler instead of "No handler for 'zeros:invoke'".
  registerIpcHandlers();
  registerAllCommands();

  // Spawn the engine before the window loads. If it fails we log and
  // continue — the webview will simply show a disconnected state
  // (which is a better error than a blank app that hangs forever).
  const root = defaultProjectRoot();
  try {
    const port = await spawnEngine(root);
    // eslint-disable-next-line no-console
    console.log(`[Zeros] engine spawned on port ${port} at ${root}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[Zeros] engine spawn failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // Watchdog runs for the life of the process; shutdown() clears its
  // timer so it doesn't race the clean-quit path.
  startWatchdog();

  // Dev-only: when tsup rewrites dist-engine/cli.js we SIGTERM the
  // running engine; watchdog respawns it with the fresh code.
  startEngineCodeWatcher();

  const win = createMainWindow();
  setMainWindow(win);

  // macOS: re-create the window when the dock icon is clicked and no
  // windows are open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const next = createMainWindow();
      setMainWindow(next);
    }
  });
});

// Keep the app alive on macOS when all windows close (standard macOS
// behaviour — user explicitly Quits via Cmd+Q).
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Kill the engine child before exit. `before-quit` fires once, even
// if multiple windows close, so the shutdown is single-threaded.
app.on("before-quit", () => {
  shutdownSidecar();
  // Close the agent-history SQLite handle. better-sqlite3 ignores a
  // missing close() in dev (the OS reaps the FD), but a clean close
  // checkpoints the WAL so the next launch reads the latest tail.
  void import("./db").then((m) => m.closeAgentHistory()).catch(() => {});
});
