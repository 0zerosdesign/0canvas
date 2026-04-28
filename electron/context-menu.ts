// ──────────────────────────────────────────────────────────
// Right-click context menu — Inspect Element + standard text edit
// ──────────────────────────────────────────────────────────
//
// Default Electron BrowserWindows have NO context menu — right-click
// is silently ignored. We add a minimal one with:
//   - Inspect Element (always)
//   - Cut / Copy / Paste (only when right-clicking an editable area)
//
// Works identically in dev and packaged builds. The DevTools toggle
// in the View menu (Cmd+Alt+I) and this Inspect entry both end up at
// the same Chromium devtools instance.
// ──────────────────────────────────────────────────────────

import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from "electron";

export function setupContextMenu(win: BrowserWindow): void {
  win.webContents.on("context-menu", (_event, params) => {
    const items: MenuItemConstructorOptions[] = [];

    if (params.isEditable) {
      items.push(
        { role: "cut", enabled: params.editFlags.canCut },
        { role: "copy", enabled: params.editFlags.canCopy },
        { role: "paste", enabled: params.editFlags.canPaste },
        { type: "separator" },
        { role: "selectAll", enabled: params.editFlags.canSelectAll },
        { type: "separator" },
      );
    } else if (params.selectionText && params.selectionText.length > 0) {
      items.push(
        { role: "copy" },
        { type: "separator" },
      );
    }

    items.push({
      label: "Inspect Element",
      click: () => {
        // openDevTools is idempotent — calling it on an already-open
        // panel is a no-op. inspectElement focuses the panel on the
        // node under the cursor.
        win.webContents.inspectElement(params.x, params.y);
        if (!win.webContents.isDevToolsOpened()) {
          win.webContents.openDevTools({ mode: "detach" });
        }
      },
    });

    Menu.buildFromTemplate(items).popup({ window: win });
  });
}
