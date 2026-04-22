// ──────────────────────────────────────────────────────────
// Zeros Electron — main process entry
// ──────────────────────────────────────────────────────────
//
// Phase 0 scaffold. Just creates a BrowserWindow pointing at
// the Vite dev server (or dist/index.html in prod). IPC, sidecar
// spawning, deep-link handling, menu, keychain — all arrive in
// later phases. See docs/TAURI_MAC_APP_PLAN.md for the full
// migration sequence.
//
// Window geometry mirrors src-tauri/tauri.conf.json:
//   1600x1000 default, 1200x700 min, hidden-inset title bar.
// ──────────────────────────────────────────────────────────

import { app, BrowserWindow } from "electron";
import path from "node:path";

// Vite dev server URL. Override with ELECTRON_RENDERER_URL for
// non-standard ports during CI / weird setups.
const DEV_URL = process.env.ELECTRON_RENDERER_URL ?? "http://localhost:5173";
const isDev = !app.isPackaged;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    title: "Zeros",
    // hiddenInset = macOS traffic lights stay visible, title bar becomes
    // transparent so app content can extend underneath. Closest analogue
    // to Tauri's `titleBarStyle: "Overlay" + hiddenTitle: true`.
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Preload needs `require("electron")` to call contextBridge; sandbox
      // would block that. Renderer stays sandboxed via contextIsolation.
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

app.whenReady().then(() => {
  createMainWindow();

  // macOS: re-create the window when the dock icon is clicked and no
  // windows are open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// Keep the app alive on macOS when all windows close (standard macOS
// behaviour — user explicitly Quits via Cmd+Q).
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
