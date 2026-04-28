// ──────────────────────────────────────────────────────────
// Native application menu
// ──────────────────────────────────────────────────────────
//
// Electron application menu. Five submenus:
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
    //    app menu on Darwin). ──
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
    //
    // Standard Electron role accelerators — these work in both dev
    // and packaged builds. We expose DevTools in production too: the
    // user is the developer here (designers + engineers debugging
    // their own UI), and Inspect Element is core to that workflow.
    {
      label: "View",
      submenu: [
        { role: "reload" },              // Cmd+R
        { role: "forceReload" },         // Cmd+Shift+R
        { role: "toggleDevTools" },      // Cmd+Alt+I (Cmd+Opt+I)
        { type: "separator" },
        { role: "resetZoom" },           // Cmd+0
        { role: "zoomIn" },              // Cmd+=
        { role: "zoomOut" },             // Cmd+-
        { type: "separator" },
        { role: "togglefullscreen" },    // Ctrl+Cmd+F
      ],
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
