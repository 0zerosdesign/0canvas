// ──────────────────────────────────────────────────────────
// Tauri ↔ Webview event bridge
// ──────────────────────────────────────────────────────────
//
// A thin adapter that wires Tauri's event system to the React
// app without forcing every component to know about Tauri. If
// we're running in `pnpm dev` (plain Vite, no Tauri), these
// functions no-op silently so the same code runs in both modes.
//
// ──────────────────────────────────────────────────────────

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

function isTauriWebview(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Probe common dev-server / database / engine ports on 127.0.0.1 and
 * return whatever responded. Safe to call repeatedly; each call takes
 * roughly 100–200 ms even on a cold machine (closed TCP ports return
 * "connection refused" instantly; open ones complete the connect).
 */
export async function discoverLocalhostServices(): Promise<LocalhostService[]> {
  if (!isTauriWebview()) return [];
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LocalhostService[]>("discover_localhost_services");
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

export async function listEnvFiles(): Promise<EnvFile[]> {
  if (!isTauriWebview()) return [];
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<EnvFile[]>("list_env_files");
}

export async function saveEnvFile(path: string, variables: EnvVar[]): Promise<void> {
  if (!isTauriWebview()) throw new Error("Env editing requires the Mac app");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<void>("save_env_file", { path, variables });
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

export async function loadTodoFile(): Promise<TodoFile | null> {
  if (!isTauriWebview()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TodoFile>("load_todo_file");
}

export async function saveTodoFile(raw: string): Promise<void> {
  if (!isTauriWebview()) throw new Error("Todo editing requires the Mac app");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<void>("save_todo_file", { raw });
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
  if (!isTauriWebview()) throw new Error("Git requires the Mac app");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// ── CSS file picker / read / write (Themes page two-way sync) ──

export type CssFile = {
  path: string;
  name: string;
  content: string;
};

export async function pickCssFile(): Promise<CssFile | null> {
  if (!isTauriWebview()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<CssFile | null>("pick_css_file");
}

export async function readCssFile(path: string): Promise<string> {
  if (!isTauriWebview()) throw new Error("Native fs requires the Mac app");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("read_css_file", { path });
}

export async function writeCssFile(path: string, content: string): Promise<void> {
  if (!isTauriWebview()) throw new Error("Native fs requires the Mac app");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<void>("write_css_file", { path, content });
}

export const git = {
  status: () => gitInvoke<GitStatus>("git_status"),
  stageFile: (path: string) => gitInvoke<void>("git_stage_file", { path }),
  unstageFile: (path: string) => gitInvoke<void>("git_unstage_file", { path }),
  stageAll: () => gitInvoke<void>("git_stage_all"),
  unstageAll: () => gitInvoke<void>("git_unstage_all"),
  commit: (message: string) =>
    gitInvoke<{ sha: string; summary: string }>("git_commit", { message }),
  push: () => gitInvoke<void>("git_push"),
  pull: () => gitInvoke<void>("git_pull"),
  diffFile: (path: string, staged: boolean) =>
    gitInvoke<GitDiff>("git_diff_file", { path, staged }),
  logRecent: (limit = 10) =>
    gitInvoke<GitCommit[]>("git_log_recent", { limit }),
  branchList: () => gitInvoke<GitBranch[]>("git_branch_list"),
  branchSwitch: (name: string) =>
    gitInvoke<void>("git_branch_switch", { name }),
};

/**
 * Subscribe to the Rust-emitted `project-changed` event (fired when the
 * user picks a new folder via File > Open Folder). Returns an unsubscribe
 * function; safe to call in both Tauri and plain-browser builds.
 */
export async function onProjectChanged(
  handler: (payload: ProjectChangedPayload) => void,
): Promise<() => void> {
  if (!isTauriWebview()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<ProjectChangedPayload>("project-changed", (e) => {
    handler(e.payload);
  });
  return unlisten;
}

/**
 * Invoke the Rust `open_project_folder` command from the webview. Phase 1B's
 * Workspace Manager route will call this from its "Open Folder" button; the
 * native File menu already calls the same command on click.
 */
export async function openProjectFolder(): Promise<ProjectChangedPayload | null> {
  if (!isTauriWebview()) {
    // No Tauri API available in the browser-only Vite harness; treat as a
    // soft cancel rather than an error.
    return null;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ProjectChangedPayload | null>("open_project_folder");
}
