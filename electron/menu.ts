// ──────────────────────────────────────────────────────────
// Native application menu
// ──────────────────────────────────────────────────────────
//
// Ports build_app_menu() from src-tauri/src/lib.rs (lines 371-445)
// plus the menu event handler at lines 551-560. Five submenus:
// Zeros (app menu), File, Edit, View, Window.
//
// File > Open Folder invokes the same path as the webview's
// `open_project_folder` IPC command — both end up in
// commands/sidecar.ts → spawnEngine + emit project-changed, so the
// renderer's ReloadOnProjectChange handler catches either entry.
// ──────────────────────────────────────────────────────────

import { Menu, type MenuItemConstructorOptions } from "electron";
import { openProjectFolder } from "./ipc/commands/sidecar";

export function installAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    // ── Zeros app menu (macOS only — first item always becomes the
    //    app menu on Darwin). Matches the Rust `app_menu` submenu. ──
    {
      label: "Zeros",
      submenu: [
        { role: "about", label: "About Zeros" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide", label: "Hide Zeros" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit", label: "Quit Zeros" },
      ],
    },

    // ── File ──────────────────────────────────────────────
    {
      label: "File",
      submenu: [
        {
          label: "Open Folder…",
          accelerator: "CmdOrCtrl+O",
          // Route through the same command handler the webview calls
          // so there's exactly one code path for both entry points.
          // Ignore the return value — the dialog's emit already
          // notifies the renderer via project-changed.
          click: () => {
            // IpcMainInvokeEvent is only there when called via IPC;
            // our direct invocation hands a synthesized empty event
            // that openProjectFolder doesn't actually read.
            void openProjectFolder({}, undefined as never);
          },
        },
        { type: "separator" },
        { role: "close", label: "Close Window" },
      ],
    },

    // ── Edit ──────────────────────────────────────────────
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },

    // ── View ──────────────────────────────────────────────
    {
      label: "View",
      submenu: [{ role: "togglefullscreen" }],
    },

    // ── Window ────────────────────────────────────────────
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
