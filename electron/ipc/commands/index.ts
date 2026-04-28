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
  keychainDelete,
  keychainGet,
  keychainSet,
} from "./secrets";
import { listEnvFiles, saveEnvFile } from "./env-files";
import { loadTodoFile, saveTodoFile } from "./todo";
import { agentContextFiles } from "./agent-context";
import { agentMemoryFiles } from "./agent-memory";
import { pickCssFile, readCssFile, writeCssFile } from "./css-files";
import { skillsList } from "./skills";
import { discoverLocalhostServices } from "./localhost";
import { ptyKill, ptyResize, ptySpawn, ptyWrite } from "./pty";
import {
  aiCliCheck,
  aiCliIsAuthenticated,
  aiCliRunLogin,
} from "./ai-cli";
import { notifySend } from "./notifications";
import {
  agentHistoryAppend,
  agentHistoryClearChat,
  agentHistoryDeletePlan,
  agentHistoryDeletePolicy,
  agentHistoryGetChatMeta,
  agentHistoryGetPlan,
  agentHistoryListChats,
  agentHistoryListPolicies,
  agentHistorySetChatMeta,
  agentHistoryUpsertPlan,
  agentHistoryUpsertPolicy,
  agentHistoryWindow,
} from "./agent-history";
import {
  processRelaunch,
  updaterCheck,
  updaterInstall,
} from "../../updater";
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

  // Phase 5 — keychain / env / todo / css / skills / localhost
  setCommand("keychain_set", keychainSet);
  setCommand("keychain_get", keychainGet);
  setCommand("keychain_delete", keychainDelete);
  setCommand("list_env_files", listEnvFiles);
  setCommand("save_env_file", saveEnvFile);
  setCommand("load_todo_file", loadTodoFile);
  setCommand("save_todo_file", saveTodoFile);
  setCommand("agent_context_files", agentContextFiles);
  setCommand("agent_memory_files", agentMemoryFiles);
  setCommand("pick_css_file", pickCssFile);
  setCommand("read_css_file", readCssFile);
  setCommand("write_css_file", writeCssFile);
  setCommand("skills_list", skillsList);
  setCommand("discover_localhost_services", discoverLocalhostServices);

  // Phase 6 — PTY (terminal) via node-pty. Commands are registered
  // here because the terminal bridge is Electron-specific.
  setCommand("pty_spawn", ptySpawn);
  setCommand("pty_write", ptyWrite);
  setCommand("pty_resize", ptyResize);
  setCommand("pty_kill", ptyKill);

  // Phase 7 — AI CLI helpers (install-probe + auth-probe + login).
  //
  // The engine's AgentGateway owns the actual subprocess lifecycle
  // now, so the legacy claude_spawn / codex_spawn / ai_cli_cancel
  // handlers are gone (pre-4432b40 they streamed NDJSON directly
  // to the renderer; post-migration the same path runs through the
  // WebSocket + AgentAdapter chain). The three below are kept
  // because Settings still talks to them directly:
  //   - ai_cli_check: filesystem probe for "is <binary> on PATH?"
  //   - ai_cli_is_authenticated: fallback auth probe (the wire-side
  //     `authenticated` field on BridgeRegistryAgent is the primary).
  //   - ai_cli_run_login: osascript → Terminal.app → `<bin> login`.
  setCommand("ai_cli_check", aiCliCheck);
  setCommand("ai_cli_is_authenticated", aiCliIsAuthenticated);
  setCommand("ai_cli_run_login", aiCliRunLogin);

  // Phase 8 — notifications, updater, process
  setCommand("notify_send", notifySend);
  setCommand("updater_check", updaterCheck);
  setCommand("updater_install", updaterInstall);
  setCommand("process_relaunch", processRelaunch);

  // Phase 0 step 4 — agent transcript persistence (better-sqlite3).
  // Renderer-side store calls these via window.__ZEROS_NATIVE__ to
  // append on every chunk, hydrate on boot, and clear on chat reset.
  setCommand("agent_history_append", agentHistoryAppend);
  setCommand("agent_history_window", agentHistoryWindow);
  setCommand("agent_history_clear_chat", agentHistoryClearChat);
  setCommand("agent_history_set_chat_meta", agentHistorySetChatMeta);
  setCommand("agent_history_get_chat_meta", agentHistoryGetChatMeta);
  setCommand("agent_history_list_chats", agentHistoryListChats);
  setCommand("agent_history_list_policies", agentHistoryListPolicies);
  setCommand("agent_history_upsert_policy", agentHistoryUpsertPolicy);
  setCommand("agent_history_delete_policy", agentHistoryDeletePolicy);
  setCommand("agent_history_get_plan", agentHistoryGetPlan);
  setCommand("agent_history_upsert_plan", agentHistoryUpsertPlan);
  setCommand("agent_history_delete_plan", agentHistoryDeletePlan);
}
