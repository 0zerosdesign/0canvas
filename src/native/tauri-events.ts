// ──────────────────────────────────────────────────────────
// Native shell façade (Tauri + Electron)
// ──────────────────────────────────────────────────────────
//
// Thin adapter over the desktop-shell IPC. Every function routes
// through `nativeInvoke()` / `nativeListen()` in runtime.ts so the
// same call lands on either Tauri commands (src-tauri/src/*.rs) or
// Electron IPC handlers (electron/ipc/router.ts) without branching.
//
// In browser-only dev (`pnpm dev` without Electron), read-style
// functions resolve to empty / null; write-style ones throw so the
// caller sees a clear "requires the Mac app" error instead of silent
// failure. The legacy Tauri import sites still work because the
// function NAMES here are unchanged — only the internals moved.
// ──────────────────────────────────────────────────────────

import { isElectron, isNativeRuntime, isTauri, nativeInvoke, nativeListen } from "./runtime";

// Re-export so call sites can import from either module.
export { isElectron, isNativeRuntime, isTauri, runtimeName } from "./runtime";

export type ProjectChangedPayload = {
  root: string;
  port: number;
};

export type LocalhostService = {
  port: number;
  url: string;
  kind: "dev-server" | "database" | "engine" | "unknown";
  label: string;
};

/**
 * Probe common dev-server / database / engine ports on 127.0.0.1 and
 * return whatever responded. Safe to call repeatedly; each call takes
 * roughly 100–200 ms even on a cold machine (closed TCP ports return
 * "connection refused" instantly; open ones complete the connect).
 */
export async function discoverLocalhostServices(): Promise<LocalhostService[]> {
  if (!isNativeRuntime()) return [];
  return nativeInvoke<LocalhostService[]>("discover_localhost_services");
}

// ── .env file editor ──────────────────────────────────────

export type EnvVar = { key: string; value: string };

export type EnvFile = {
  /** Absolute path to the file. */
  path: string;
  /** Filename only (e.g. ".env.local"). */
  filename: string;
  /** Ordered KEY=VALUE pairs. Comments + blanks are kept server-side. */
  variables: EnvVar[];
  /** True when the file is covered by a .gitignore rule. */
  gitignored: boolean;
};

export async function listEnvFiles(cwd?: string): Promise<EnvFile[]> {
  if (!isNativeRuntime()) return [];
  return nativeInvoke<EnvFile[]>("list_env_files", { cwd });
}

export async function saveEnvFile(
  path: string,
  variables: EnvVar[],
  cwd?: string,
): Promise<void> {
  if (!isNativeRuntime()) throw new Error("Env editing requires the Mac app");
  return nativeInvoke<void>("save_env_file", { cwd, path, variables });
}

// ── Todo list ─────────────────────────────────────────────

export type TodoItem = {
  /** 0-based source line; useful for toggling without reparsing. */
  line: number;
  done: boolean;
  text: string;
};

export type TodoFile = {
  path: string;
  /** Raw markdown, source of truth. */
  raw: string;
  items: TodoItem[];
};

export async function loadTodoFile(cwd?: string): Promise<TodoFile | null> {
  if (!isNativeRuntime()) return null;
  return nativeInvoke<TodoFile>("load_todo_file", { cwd });
}

export async function saveTodoFile(raw: string, cwd?: string): Promise<void> {
  if (!isNativeRuntime()) throw new Error("Todo editing requires the Mac app");
  return nativeInvoke<void>("save_todo_file", { cwd, raw });
}

// ── Git ───────────────────────────────────────────────────

export type GitFileStatus = {
  path: string;
  kind:
    | "added"
    | "modified"
    | "deleted"
    | "renamed"
    | "typechange"
    | "conflicted"
    | "untracked";
  staged: boolean;
};

export type GitStatus = {
  branch: string | null;
  headSha: string | null;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  unstaged: GitFileStatus[];
  staged: GitFileStatus[];
};

export type GitCommit = {
  sha: string;
  shortSha: string;
  summary: string;
  author: string;
  timestamp: number;
};

export type GitBranch = {
  name: string;
  isHead: boolean;
  isRemote: boolean;
};

export type GitDiff = {
  path: string;
  text: string;
  truncated: boolean;
};

async function gitInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isNativeRuntime()) throw new Error("Git requires the Mac app");
  return nativeInvoke<T>(cmd, args);
}

// ── CSS file picker / read / write (Themes page two-way sync) ──

export type CssFile = {
  path: string;
  name: string;
  content: string;
};

export async function pickCssFile(): Promise<CssFile | null> {
  if (!isNativeRuntime()) return null;
  return nativeInvoke<CssFile | null>("pick_css_file");
}

export async function readCssFile(path: string): Promise<string> {
  if (!isNativeRuntime()) throw new Error("Native fs requires the Mac app");
  return nativeInvoke<string>("read_css_file", { path });
}

export async function writeCssFile(path: string, content: string): Promise<void> {
  if (!isNativeRuntime()) throw new Error("Native fs requires the Mac app");
  return nativeInvoke<void>("write_css_file", { path, content });
}

export type GitFileVersion = {
  path: string;
  exists: boolean;
  content: string | null;
};

export type GitConflict = {
  path: string;
  hasOurs: boolean;
  hasTheirs: boolean;
};

export type GitWorktree = {
  name: string;
  path: string;
  isCurrent: boolean;
};

/** Every git op takes an optional `cwd`. When provided, the shell uses
 *  that path instead of the global engine root. The frontend passes
 *  the active chat's folder so each chat's Git panel is scoped to its
 *  own project — multiple projects can be live at once. */
export const git = {
  status: (cwd?: string) => gitInvoke<GitStatus>("git_status", { cwd }),
  stageFile: (path: string, cwd?: string) =>
    gitInvoke<void>("git_stage_file", { cwd, path }),
  unstageFile: (path: string, cwd?: string) =>
    gitInvoke<void>("git_unstage_file", { cwd, path }),
  stageAll: (cwd?: string) => gitInvoke<void>("git_stage_all", { cwd }),
  unstageAll: (cwd?: string) => gitInvoke<void>("git_unstage_all", { cwd }),
  commit: (message: string, cwd?: string) =>
    gitInvoke<{ sha: string; summary: string }>("git_commit", { cwd, message }),
  push: (cwd?: string) => gitInvoke<void>("git_push", { cwd }),
  pull: (cwd?: string) => gitInvoke<void>("git_pull", { cwd }),
  pushForce: (cwd?: string) => gitInvoke<void>("git_push_force", { cwd }),
  diffFile: (path: string, staged: boolean, cwd?: string) =>
    gitInvoke<GitDiff>("git_diff_file", { cwd, path, staged }),
  logRecent: (limit = 10, cwd?: string) =>
    gitInvoke<GitCommit[]>("git_log_recent", { cwd, limit }),
  branchList: (cwd?: string) =>
    gitInvoke<GitBranch[]>("git_branch_list", { cwd }),
  branchSwitch: (name: string, cwd?: string) =>
    gitInvoke<void>("git_branch_switch", { cwd, name }),
  branchCreate: (name: string, checkout: boolean, cwd?: string) =>
    gitInvoke<void>("git_branch_create", { cwd, name, checkout }),
  branchDelete: (name: string, cwd?: string) =>
    gitInvoke<void>("git_branch_delete", { cwd, name }),
  suggestCommitMessage: (cwd?: string) =>
    gitInvoke<string>("git_suggest_commit_message", { cwd }),
  remoteUrl: (cwd?: string) =>
    gitInvoke<string | null>("git_remote_url", { cwd }),
  discardFile: (path: string, cwd?: string) =>
    gitInvoke<void>("git_discard_file", { cwd, path }),
  fileAtHead: (path: string, cwd?: string) =>
    gitInvoke<GitFileVersion>("git_file_at_head", { cwd, path }),
  clone: (url: string, destination: string) =>
    gitInvoke<string>("git_clone", { url, destination }),
  worktreeList: (cwd?: string) =>
    gitInvoke<GitWorktree[]>("git_worktree_list", { cwd }),
  worktreeAdd: (
    name: string,
    path: string,
    branch: string | null,
    cwd?: string,
  ) => gitInvoke<string>("git_worktree_add", { cwd, name, path, branch }),
  worktreeRemove: (name: string, cwd?: string) =>
    gitInvoke<void>("git_worktree_remove", { cwd, name }),
  conflictList: (cwd?: string) =>
    gitInvoke<GitConflict[]>("git_conflict_list", { cwd }),
  resolveOurs: (path: string, cwd?: string) =>
    gitInvoke<void>("git_resolve_file_ours", { cwd, path }),
  resolveTheirs: (path: string, cwd?: string) =>
    gitInvoke<void>("git_resolve_file_theirs", { cwd, path }),
  revertCommit: (sha: string, cwd?: string) =>
    gitInvoke<string>("git_revert_commit", { cwd, sha }),
  resetHard: (sha: string, cwd?: string) =>
    gitInvoke<void>("git_reset_hard", { cwd, sha }),
};

/** Returns a `git`-shaped namespace where every call is pre-bound to
 *  `cwd`. Panels call this once per active chat, then use the result
 *  without threading cwd through every call site. */
export function gitForCwd(cwd: string | undefined) {
  return {
    status: () => git.status(cwd),
    stageFile: (path: string) => git.stageFile(path, cwd),
    unstageFile: (path: string) => git.unstageFile(path, cwd),
    stageAll: () => git.stageAll(cwd),
    unstageAll: () => git.unstageAll(cwd),
    commit: (message: string) => git.commit(message, cwd),
    push: () => git.push(cwd),
    pull: () => git.pull(cwd),
    pushForce: () => git.pushForce(cwd),
    diffFile: (path: string, staged: boolean) =>
      git.diffFile(path, staged, cwd),
    logRecent: (limit = 10) => git.logRecent(limit, cwd),
    branchList: () => git.branchList(cwd),
    branchSwitch: (name: string) => git.branchSwitch(name, cwd),
    branchCreate: (name: string, checkout: boolean) =>
      git.branchCreate(name, checkout, cwd),
    branchDelete: (name: string) => git.branchDelete(name, cwd),
    suggestCommitMessage: () => git.suggestCommitMessage(cwd),
    remoteUrl: () => git.remoteUrl(cwd),
    discardFile: (path: string) => git.discardFile(path, cwd),
    fileAtHead: (path: string) => git.fileAtHead(path, cwd),
    worktreeList: () => git.worktreeList(cwd),
    worktreeAdd: (name: string, path: string, branch: string | null) =>
      git.worktreeAdd(name, path, branch, cwd),
    worktreeRemove: (name: string) => git.worktreeRemove(name, cwd),
    conflictList: () => git.conflictList(cwd),
    resolveOurs: (path: string) => git.resolveOurs(path, cwd),
    resolveTheirs: (path: string) => git.resolveTheirs(path, cwd),
    revertCommit: (sha: string) => git.revertCommit(sha, cwd),
    resetHard: (sha: string) => git.resetHard(sha, cwd),
  };
}

// ── Skills (Phase 4) ─────────────────────────────────────

export type Skill = {
  id: string;
  name: string;
  description: string;
  icon: string;
  body: string;
  path: string;
};

export async function listSkills(): Promise<Skill[]> {
  if (!isNativeRuntime()) return [];
  try {
    return await nativeInvoke<Skill[]>("skills_list");
  } catch {
    return [];
  }
}

/** Open an external http(s) URL in the user's default browser. */
export async function shellOpenUrl(url: string): Promise<void> {
  if (!isNativeRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await nativeInvoke<void>("shell_open_url", { url });
}

/** Reveal a path in macOS Finder. */
export async function revealInFinder(path: string): Promise<void> {
  if (!isNativeRuntime()) return;
  await nativeInvoke<void>("reveal_in_finder", { path });
}

/** Launch macOS Terminal.app at the given directory. */
export async function openInTerminal(path: string): Promise<void> {
  if (!isNativeRuntime()) return;
  await nativeInvoke<void>("open_in_terminal", { path });
}

/** Phase 3-F: finalize a clone by handing the destination to the sidecar. */
export async function openClonedProject(
  path: string,
): Promise<ProjectChangedPayload> {
  if (!isNativeRuntime()) throw new Error("Clone requires the Mac app");
  return nativeInvoke<ProjectChangedPayload>("open_cloned_project", { path });
}

/**
 * Subscribe to the main-process `project-changed` event (fired when
 * the user picks a new folder via File > Open Folder). Returns an
 * unsubscribe function; safe to call in all three modes.
 */
export async function onProjectChanged(
  handler: (payload: ProjectChangedPayload) => void,
): Promise<() => void> {
  if (!isNativeRuntime()) return () => {};
  return nativeListen<ProjectChangedPayload>("project-changed", handler);
}

/**
 * Invoke the main-process `open_project_folder` command. The native
 * File menu already fires the same command on click; this is the
 * webview-initiated path (Workspace Manager, "Open Folder" button).
 */
export async function openProjectFolder(): Promise<ProjectChangedPayload | null> {
  if (!isNativeRuntime()) {
    // No native runtime available; treat as a soft cancel.
    return null;
  }
  return nativeInvoke<ProjectChangedPayload | null>("open_project_folder");
}

/**
 * Phase 2-D: open a known folder by path (no dialog). Used by the
 * recent-projects list. Throws if the path no longer exists so the UI
 * can prune stale entries.
 */
export async function openProjectFolderPath(
  path: string,
): Promise<ProjectChangedPayload> {
  if (!isNativeRuntime()) throw new Error("Opening by path requires the Mac app");
  return nativeInvoke<ProjectChangedPayload>("open_project_folder_path", { path });
}

// ── Native notifications ──────────────────────────────────
//
// Tauri uses `@tauri-apps/plugin-notification` (requests permission
// lazily). Electron uses the main-process `notify_send` IPC command
// (wired in Phase 8). Both end up showing a native macOS notification
// via the NSUserNotificationCenter.

let tauriNotificationPermission: "granted" | "denied" | "default" | null = null;

export async function notify(title: string, body?: string): Promise<void> {
  if (isElectron()) {
    try {
      await nativeInvoke<void>("notify_send", { title, body });
    } catch {
      // Phase 1: `notify_send` isn't in the router yet — swallow so
      // callers aren't forced to guard. Real implementation lands Phase 8.
    }
    return;
  }

  if (isTauri()) {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import("@tauri-apps/plugin-notification");

    if (tauriNotificationPermission === null) {
      const granted = await isPermissionGranted();
      if (granted) {
        tauriNotificationPermission = "granted";
      } else {
        const result = await requestPermission();
        tauriNotificationPermission = result;
      }
    }

    if (tauriNotificationPermission !== "granted") return;
    sendNotification({ title, body });
    return;
  }

  // browser-only: no-op.
}

// ── Deep links ────────────────────────────────────────────
//
// The main process handles zeros://open?path=... directly and emits
// a `deep-link` event for any other routes so React can handle them
// without a native rebuild.

export async function onDeepLink(
  handler: (url: string) => void,
): Promise<() => void> {
  if (!isNativeRuntime()) return () => {};
  return nativeListen<string>("deep-link", handler);
}
