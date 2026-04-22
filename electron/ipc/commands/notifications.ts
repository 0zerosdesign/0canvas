// ──────────────────────────────────────────────────────────
// IPC command: native notification — replaces the Tauri
// notification plugin for the Electron build.
// ──────────────────────────────────────────────────────────
//
// The renderer's notify() façade (src/native/tauri-events.ts)
// routes to this command when isElectron(). macOS's
// NSUserNotificationCenter is reached via Electron's built-in
// Notification class — no plugin, no permission plumbing: the
// OS surfaces its own permission prompt on first display.
// ──────────────────────────────────────────────────────────

import { Notification } from "electron";
import type { CommandHandler } from "../router";

export const notifySend: CommandHandler = (args) => {
  const title = String(args.title ?? "Zeros");
  const body = args.body !== undefined ? String(args.body) : undefined;
  // Notification.isSupported() returns false in environments without
  // a notification center (CI, headless). Silent no-op matches the
  // Tauri path's behaviour when permission is denied.
  if (!Notification.isSupported()) return;
  const notif = new Notification({ title, body, silent: false });
  notif.show();
};
