// ──────────────────────────────────────────────────────────
// IPC commands: sidecar + project folder switching
// ──────────────────────────────────────────────────────────
//
// Ports the handlers in src-tauri/src/lib.rs for:
//   get_engine_port, get_engine_root,
//   open_project_folder, open_project_folder_path, open_cloned_project
//
// Each of these is the frontend's contact point with the engine's
// lifecycle. `open_project_folder*` kills the running child and
// respawns rooted at the new folder, then emits `project-changed`
// so the webview reconnects the WebSocket bridge at the new port.
// ──────────────────────────────────────────────────────────

import { BrowserWindow, dialog } from "electron";
import {
  assertIsDirectory,
  currentPort,
  currentRoot,
  spawnEngine,
} from "../../sidecar";
import { emitEvent } from "../events";
import type { CommandHandler } from "../router";

interface ProjectChangedPayload {
  root: string;
  port: number;
}

export const getEnginePort: CommandHandler = () => {
  // Renderer expects `number | null`; Rust returns `Option<u16>`.
  return currentPort();
};

export const getEngineRoot: CommandHandler = () => {
  return currentRoot();
};

/** Show the native folder picker. On pick, respawn the engine rooted
 *  at the selected folder and emit `project-changed`. Cancellation
 *  returns `null` (not an error) so the UI can treat it as a no-op. */
export const openProjectFolder: CommandHandler = async () => {
  const parent =
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

  const result = await dialog.showOpenDialog(parent ?? undefined!, {
    properties: ["openDirectory"],
    title: "Open Folder",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const root = result.filePaths[0];
  const port = await spawnEngine(root);
  const payload: ProjectChangedPayload = { root, port };
  emitEvent("project-changed", payload);
  return payload;
};

async function respawnAtPath(root: string): Promise<ProjectChangedPayload> {
  assertIsDirectory(root);
  const port = await spawnEngine(root);
  const payload: ProjectChangedPayload = { root, port };
  emitEvent("project-changed", payload);
  return payload;
}

/** Open a known folder by absolute path (no dialog). Used by the
 *  recent-projects list. Throws if the path no longer exists so the
 *  UI can prune stale entries. */
export const openProjectFolderPath: CommandHandler = (args) => {
  const root = typeof args.path === "string" ? args.path : "";
  if (!root) throw new Error("open_project_folder_path: missing path");
  return respawnAtPath(root);
};

/** Phase 3-F git-clone finaliser. Same behaviour as
 *  openProjectFolderPath, kept as a separate command for semantic
 *  clarity at call sites. */
export const openClonedProject: CommandHandler = (args) => {
  const root = typeof args.path === "string" ? args.path : "";
  if (!root) throw new Error("open_cloned_project: missing path");
  return respawnAtPath(root);
};
