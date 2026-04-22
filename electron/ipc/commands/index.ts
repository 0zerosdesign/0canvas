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
import {
  gitBranchCreate,
  gitBranchDelete,
  gitBranchList,
  gitBranchSwitch,
  gitClone,
  gitCommit,
  gitConflictList,
  gitDiffFile,
  gitDiscardFile,
  gitFileAtHead,
  gitLogRecent,
  gitPull,
  gitPush,
  gitPushForce,
  gitRemoteUrl,
  gitResetHard,
  gitResolveFileOurs,
  gitResolveFileTheirs,
  gitRevertCommit,
  gitStageAll,
  gitStageFile,
  gitStatus,
  gitSuggestCommitMessage,
  gitUnstageAll,
  gitUnstageFile,
  gitWorktreeAdd,
  gitWorktreeList,
  gitWorktreeRemove,
} from "./git";

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

  // Phase 4 — git (28 commands) via simple-git
  setCommand("git_status", gitStatus);
  setCommand("git_stage_file", gitStageFile);
  setCommand("git_unstage_file", gitUnstageFile);
  setCommand("git_stage_all", gitStageAll);
  setCommand("git_unstage_all", gitUnstageAll);
  setCommand("git_commit", gitCommit);
  setCommand("git_push", gitPush);
  setCommand("git_pull", gitPull);
  setCommand("git_push_force", gitPushForce);
  setCommand("git_diff_file", gitDiffFile);
  setCommand("git_log_recent", gitLogRecent);
  setCommand("git_branch_list", gitBranchList);
  setCommand("git_branch_switch", gitBranchSwitch);
  setCommand("git_branch_create", gitBranchCreate);
  setCommand("git_branch_delete", gitBranchDelete);
  setCommand("git_suggest_commit_message", gitSuggestCommitMessage);
  setCommand("git_remote_url", gitRemoteUrl);
  setCommand("git_discard_file", gitDiscardFile);
  setCommand("git_file_at_head", gitFileAtHead);
  setCommand("git_clone", gitClone);
  setCommand("git_worktree_list", gitWorktreeList);
  setCommand("git_worktree_add", gitWorktreeAdd);
  setCommand("git_worktree_remove", gitWorktreeRemove);
  setCommand("git_conflict_list", gitConflictList);
  setCommand("git_resolve_file_ours", gitResolveFileOurs);
  setCommand("git_resolve_file_theirs", gitResolveFileTheirs);
  setCommand("git_revert_commit", gitRevertCommit);
  setCommand("git_reset_hard", gitResetHard);

  // Phases 5-7 append their own setCommand calls here as they land.
}
