// ──────────────────────────────────────────────────────────
// Phase-by-phase command registration
// ──────────────────────────────────────────────────────────
//
// Each phase adds a block here that calls `setCommand(...)` for the
// commands it lights up. The router's initial table registers every
// command as `notImpl`; this file replaces entries with real handlers
// as they come online. Keeps the "what's ready vs stubbed" question
// one-file-away from any caller.
// ──────────────────────────────────────────────────────────

import { setCommand } from "../router";
import {
  getEnginePort,
  getEngineRoot,
  openClonedProject,
  openProjectFolder,
  openProjectFolderPath,
} from "./sidecar";
import {
  openInstallTerminal,
  openInTerminal,
  revealInFinder,
  shellOpenUrl,
} from "./shell";

export function registerAllCommands(): void {
  // Phase 2 — sidecar + project folder
  setCommand("get_engine_port", getEnginePort);
  setCommand("get_engine_root", getEngineRoot);
  setCommand("open_project_folder", openProjectFolder);
  setCommand("open_project_folder_path", openProjectFolderPath);
  setCommand("open_cloned_project", openClonedProject);

  // Phase 3 — shell helpers
  setCommand("shell_open_url", shellOpenUrl);
  setCommand("reveal_in_finder", revealInFinder);
  setCommand("open_in_terminal", openInTerminal);
  setCommand("open_install_terminal", openInstallTerminal);

  // Phases 4-7 append their own setCommand calls here as they land.
}
