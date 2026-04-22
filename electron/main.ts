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
// Window geometry mirrors src-tauri/tauri.conf.json:
//   1600x1000 default, 1200x700 min, hidden-inset title bar so app
//   content extends under the traffic lights.
// ──────────────────────────────────────────────────────────

import { app, BrowserWindow } from "electron";
import path from "node:path";
import { registerIpcHandlers } from "./ipc/router";
import { registerAllCommands } from "./ipc/commands";
import { setMainWindow } from "./ipc/events";
import {
  defaultProjectRoot,
  shutdown as shutdownSidecar,
  spawnEngine,
  startWatchdog,
} from "./sidecar";
import { installAppMenu } from "./menu";
import { setupDeepLink } from "./deep-link";

const DEV_URL = process.env.ELECTRON_RENDERER_URL ?? "http://localhost:5173";
const isDev = !app.isPackaged;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    title: "Zeros",
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
    win.webContents.openDevTools({ mode: "detach" });
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

app.whenReady().then(async () => {
  // Install the native app menu (File > Open Folder, Edit, View, etc).
  // Safe to call before the window exists — macOS associates the
  // menu with the app, not a specific window.
  installAppMenu();

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
});
