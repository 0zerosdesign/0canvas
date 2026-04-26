// ──────────────────────────────────────────────────────────
// Zeros Electron — IPC router
// ──────────────────────────────────────────────────────────
//
// The renderer calls `window.__ZEROS_NATIVE__.invoke("cmd_name", args)`,
// which the preload forwards to `ipcMain.handle("zeros:invoke", ...)`.
// This router dispatches the command name to the matching handler.
//
// Phase 1: every command is `notImpl(phase)`. Subsequent phases replace
// entries in-place:
//
//   Phase 2  — get_engine_port, get_engine_root, open_project_folder*
//   Phase 3  — deep-link, shell helpers, install terminal
//   Phase 4  — git (28 commands)
//   Phase 5  — keychain, env, todo, css, skills, localhost
//   Phase 6  — pty_* (terminal)
//   Phase 7  — ai_cli_* + claude/codex spawns
//
// Native command router for renderer -> Electron main IPC.
// ──────────────────────────────────────────────────────────

import { ipcMain, type IpcMainInvokeEvent } from "electron";

export const IPC_INVOKE_CHANNEL = "zeros:invoke";

/** Handler signature — receives parsed args object, returns a value
 *  (or promise) that the renderer awaits. Throw to propagate an error
 *  back to the renderer's awaited `invoke()`. */
export type CommandHandler = (
  args: Record<string, unknown>,
  event: IpcMainInvokeEvent,
) => unknown | Promise<unknown>;

/** Throws a clear "not implemented yet" error back to the renderer.
 *  The phase number makes it obvious from the call site which migration
 *  phase owns the implementation. */
function notImpl(cmd: string, phase: number): CommandHandler {
  return () => {
    throw new Error(
      `[Zeros] IPC command "${cmd}" not implemented yet (scheduled for Phase ${phase})`,
    );
  };
}

/** The full command table. Keep this list in sync — a missing entry
 *  means a React call site throws "unknown command" in Electron.
 */
const commandTable: Record<string, CommandHandler> = {
  // ── Sidecar / engine lifecycle (Phase 2) ──────────────────
  get_engine_port: notImpl("get_engine_port", 2),
  get_engine_root: notImpl("get_engine_root", 2),
  open_project_folder: notImpl("open_project_folder", 2),
  open_project_folder_path: notImpl("open_project_folder_path", 2),
  open_cloned_project: notImpl("open_cloned_project", 2),

  // ── Shell / system (Phase 3) ──────────────────────────────
  shell_open_url: notImpl("shell_open_url", 3),
  reveal_in_finder: notImpl("reveal_in_finder", 3),
  open_in_terminal: notImpl("open_in_terminal", 3),
  open_install_terminal: notImpl("open_install_terminal", 3),

  // ── Git (Phase 4) ─────────────────────────────────────────
  git_status: notImpl("git_status", 4),
  git_stage_file: notImpl("git_stage_file", 4),
  git_unstage_file: notImpl("git_unstage_file", 4),
  git_stage_all: notImpl("git_stage_all", 4),
  git_unstage_all: notImpl("git_unstage_all", 4),
  git_commit: notImpl("git_commit", 4),
  git_push: notImpl("git_push", 4),
  git_pull: notImpl("git_pull", 4),
  git_push_force: notImpl("git_push_force", 4),
  git_diff_file: notImpl("git_diff_file", 4),
  git_log_recent: notImpl("git_log_recent", 4),
  git_branch_list: notImpl("git_branch_list", 4),
  git_branch_switch: notImpl("git_branch_switch", 4),
  git_branch_create: notImpl("git_branch_create", 4),
  git_branch_delete: notImpl("git_branch_delete", 4),
  git_suggest_commit_message: notImpl("git_suggest_commit_message", 4),
  git_remote_url: notImpl("git_remote_url", 4),
  git_discard_file: notImpl("git_discard_file", 4),
  git_file_at_head: notImpl("git_file_at_head", 4),
  git_clone: notImpl("git_clone", 4),
  git_worktree_list: notImpl("git_worktree_list", 4),
  git_worktree_add: notImpl("git_worktree_add", 4),
  git_worktree_remove: notImpl("git_worktree_remove", 4),
  git_conflict_list: notImpl("git_conflict_list", 4),
  git_resolve_file_ours: notImpl("git_resolve_file_ours", 4),
  git_resolve_file_theirs: notImpl("git_resolve_file_theirs", 4),
  git_revert_commit: notImpl("git_revert_commit", 4),
  git_reset_hard: notImpl("git_reset_hard", 4),

  // ── Keychain / env / todo / css / skills / localhost (Phase 5) ──
  keychain_set: notImpl("keychain_set", 5),
  keychain_get: notImpl("keychain_get", 5),
  keychain_delete: notImpl("keychain_delete", 5),
  list_env_files: notImpl("list_env_files", 5),
  save_env_file: notImpl("save_env_file", 5),
  load_todo_file: notImpl("load_todo_file", 5),
  save_todo_file: notImpl("save_todo_file", 5),
  pick_css_file: notImpl("pick_css_file", 5),
  read_css_file: notImpl("read_css_file", 5),
  write_css_file: notImpl("write_css_file", 5),
  skills_list: notImpl("skills_list", 5),
  discover_localhost_services: notImpl("discover_localhost_services", 5),

  // ── AI CLI (Phase 7) ──────────────────────────────────────
  ai_cli_check: notImpl("ai_cli_check", 7),
  ai_cli_is_authenticated: notImpl("ai_cli_is_authenticated", 7),
  ai_cli_cancel: notImpl("ai_cli_cancel", 7),
  ai_cli_run_login: notImpl("ai_cli_run_login", 7),
  claude_spawn: notImpl("claude_spawn", 7),
  codex_spawn: notImpl("codex_spawn", 7),

  // ── Agent transcript persistence (Phase 0 step 4) ─────────
  agent_history_append: notImpl("agent_history_append", 0),
  agent_history_window: notImpl("agent_history_window", 0),
  agent_history_clear_chat: notImpl("agent_history_clear_chat", 0),
  agent_history_set_chat_meta: notImpl("agent_history_set_chat_meta", 0),
  agent_history_get_chat_meta: notImpl("agent_history_get_chat_meta", 0),
  agent_history_list_chats: notImpl("agent_history_list_chats", 0),
};

export function listCommandNames(): string[] {
  return Object.keys(commandTable).sort();
}

/** Called from main.ts after app.whenReady. Idempotent — re-registering
 *  removes the previous handler first. */
export function registerIpcHandlers(): void {
  ipcMain.removeHandler(IPC_INVOKE_CHANNEL);
  ipcMain.handle(IPC_INVOKE_CHANNEL, async (event, raw: unknown) => {
    if (!raw || typeof raw !== "object") {
      throw new Error("[Zeros] IPC: payload must be an object");
    }
    const { cmd, args } = raw as { cmd?: string; args?: Record<string, unknown> };
    if (!cmd || typeof cmd !== "string") {
      throw new Error("[Zeros] IPC: missing 'cmd' string");
    }
    const handler = commandTable[cmd];
    if (!handler) {
      throw new Error(
        `[Zeros] IPC: unknown command "${cmd}". Expected one of ${
          Object.keys(commandTable).length
        } registered commands.`,
      );
    }
    return await handler(args ?? {}, event);
  });
}

/** Replace a single command's handler. Used by later phases to light up
 *  commands one at a time without touching the table above. */
export function setCommand(cmd: string, handler: CommandHandler): void {
  if (!(cmd in commandTable)) {
    // Allow new commands to be added (e.g., pty_* in Phase 6) but warn
    // on unexpected names so typos don't silently succeed.
    // eslint-disable-next-line no-console
    console.warn(`[Zeros] registering new command not in table: ${cmd}`);
  }
  commandTable[cmd] = handler;
}
