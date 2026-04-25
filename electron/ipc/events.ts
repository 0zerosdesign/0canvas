// ──────────────────────────────────────────────────────────
// Zeros Electron — event bus (main → renderer)
// ──────────────────────────────────────────────────────────
//
// Electron has no app-wide renderer event analogue by default.
// We channel all events through a single IPC message ("zeros:event")
// tagged with a name, so the preload can route them to the renderer's
// subscribers by name. This lets the same facade code in the renderer
// subscribe to `project-changed`, `deep-link`, `ai-stream-event`, etc.
// subscribe through one native-shell abstraction.
//
// Event names (canonical across native-shell emissions):
//   project-changed   { root: string, port: number }
//   deep-link         string
//   ai-stream-event   { session_id, kind, ... }
//   engine-restarted  { port: number }
//   pty-data          { sessionId, data } (Phase 6)
// ──────────────────────────────────────────────────────────

import type { BrowserWindow } from "electron";

export const IPC_EVENT_CHANNEL = "zeros:event";

export interface ZerosEventEnvelope {
  name: string;
  payload: unknown;
}

let mainWindow: BrowserWindow | null = null;

/** Called once from main.ts after BrowserWindow creation. */
export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
}

/** Emit a named event to the renderer. Safe to call before the window
 *  exists or after it's closed — drops silently. */
export function emitEvent(name: string, payload: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const envelope: ZerosEventEnvelope = { name, payload };
  mainWindow.webContents.send(IPC_EVENT_CHANNEL, envelope);
}
