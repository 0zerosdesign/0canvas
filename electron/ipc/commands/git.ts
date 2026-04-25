// ──────────────────────────────────────────────────────────
// IPC commands: git — Electron/native implementation of Git operations
// ──────────────────────────────────────────────────────────
//
// Uses simple-git, which shells out to the user's system `git` binary — so credential
// helpers (osxkeychain, ssh-agent, ~/.git-credentials, PATs via
// credential.helper) inherit verbatim. No credential code here.
//
// Output shapes stay compatible with the renderer's native facade types
// (GitStatus, GitCommit, GitBranch, GitDiff, GitConflict, GitWorktree,
// GitFileVersion).
//
// Every op takes an optional `cwd` string. When absent, falls back to
// the engine's currentRoot().
// ──────────────────────────────────────────────────────────

import { existsSync, mkdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";
import { currentRoot } from "../../sidecar";
import type { CommandHandler } from "../router";

// ── Shared helpers ─────────────────────────────────────────

function resolveCwd(args: Record<string, unknown>): string {
  const explicit = typeof args.cwd === "string" ? args.cwd.trim() : "";
  if (explicit) return explicit;
  const fallback = currentRoot();
  if (!fallback) throw new Error("no project root");
  return fallback;
}

function gitAt(cwd: string): SimpleGit {
  return simpleGit({ baseDir: cwd, binary: "git", maxConcurrentProcesses: 6 });
}

async function requireBranch(git: SimpleGit): Promise<string> {
  const br = await git.branch();
  if (!br.current) {
    throw new Error("HEAD is detached; check out a branch first");
  }
  return br.current;
}

// ── Status ─────────────────────────────────────────────────

interface FileStatus {
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
}

interface GitStatusPayload {
  branch: string | null;
  headSha: string | null;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  unstaged: FileStatus[];
  staged: FileStatus[];
}

/** Categorise a single porcelain-v1 status row into the unstaged and
 *  staged views used by the renderer. A single file can
 *  appear in BOTH lists when it has both staged and unstaged
 *  changes — that's intentional. */
function categorise(
  filePath: string,
  index: string,
  workingDir: string,
  out: { unstaged: FileStatus[]; staged: FileStatus[] },
): void {
  // Conflicted markers (porcelain v1): U in either column, or the
  // collision pairs DD / AA (both sides deleted / both added).
  const isConflicted =
    index === "U" ||
    workingDir === "U" ||
    (index === "A" && workingDir === "A") ||
    (index === "D" && workingDir === "D");
  if (isConflicted) {
    out.unstaged.push({ path: filePath, kind: "conflicted", staged: false });
    return;
  }

  // Staged (index column)
  switch (index) {
    case "A":
      out.staged.push({ path: filePath, kind: "added", staged: true });
      break;
    case "M":
      out.staged.push({ path: filePath, kind: "modified", staged: true });
      break;
    case "D":
      out.staged.push({ path: filePath, kind: "deleted", staged: true });
      break;
    case "R":
      out.staged.push({ path: filePath, kind: "renamed", staged: true });
      break;
    case "T":
      out.staged.push({ path: filePath, kind: "typechange", staged: true });
      break;
    default:
      // ' ', '?', '!' — not staged
      break;
  }

  // Unstaged (working_dir column)
  switch (workingDir) {
    case "M":
      out.unstaged.push({ path: filePath, kind: "modified", staged: false });
      break;
    case "D":
      out.unstaged.push({ path: filePath, kind: "deleted", staged: false });
      break;
    case "R":
      out.unstaged.push({ path: filePath, kind: "renamed", staged: false });
      break;
    case "T":
      out.unstaged.push({ path: filePath, kind: "typechange", staged: false });
      break;
    case "?":
      out.unstaged.push({ path: filePath, kind: "untracked", staged: false });
      break;
    default:
      break;
  }
}

export const gitStatus: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const git = gitAt(cwd);

  const st = await git.status(["--renames"]);

  const branch = st.current ?? null;
  let headSha: string | null = null;
  try {
    headSha = (await git.revparse(["HEAD"])).trim();
  } catch {
    // Empty repo (no HEAD yet) — stays null.
  }

  const hasUpstream = !!st.tracking;
  const ahead = st.ahead ?? 0;
  const behind = st.behind ?? 0;

  const out: { unstaged: FileStatus[]; staged: FileStatus[] } = {
    unstaged: [],
    staged: [],
  };
  for (const f of st.files) {
    categorise(f.path, f.index, f.working_dir, out);
  }

  const payload: GitStatusPayload = {
    branch,
    headSha,
    ahead,
    behind,
    hasUpstream,
    unstaged: out.unstaged,
    staged: out.staged,
  };
  return payload;
};

// ── Stage / Unstage ────────────────────────────────────────

export const gitStageFile: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const filePath = String(args.path ?? "");
  if (!filePath) throw new Error("git_stage_file: missing path");
  await gitAt(cwd).add([filePath]);
};

export const gitUnstageFile: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const filePath = String(args.path ?? "");
  if (!filePath) throw new Error("git_unstage_file: missing path");
  const git = gitAt(cwd);
  // Prefer `reset HEAD <path>`.
  // Falls back to `rm --cached <path>` for the fresh-repo path (no
  // HEAD yet) where reset has nothing to reset against.
  try {
    await git.raw(["reset", "HEAD", "--", filePath]);
  } catch (err) {
    try {
      await git.raw(["rm", "--cached", filePath]);
    } catch {
      throw err;
    }
  }
};

export const gitStageAll: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  await gitAt(cwd).add(["-A"]);
};

export const gitUnstageAll: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const git = gitAt(cwd);
  // `git reset` (no args, no paths) un-indexes everything.
  try {
    await git.raw(["reset"]);
  } catch {
    // Fresh repo with no HEAD — ignore.
  }
};

// ── Commit ─────────────────────────────────────────────────

interface CommitResultPayload {
  sha: string;
  summary: string;
}

export const gitCommit: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const message = String(args.message ?? "");
  const trimmed = message.trim();
  if (!trimmed) throw new Error("commit message is empty");

  const git = gitAt(cwd);
  const result = await git.commit(trimmed);
  const sha = (result.commit ?? "").replace(/^HEAD\s+/, "").trim();
  // `result.commit` may be the short sha (e.g. "abcdef1" or "main abcdef1").
  // Expand to full sha; simple-git may return a short sha.
  let fullSha = sha;
  try {
    fullSha = (await git.revparse(["HEAD"])).trim();
  } catch {
    // shouldn't happen right after a successful commit
  }
  const summary = trimmed.split("\n")[0] ?? trimmed;
  const payload: CommitResultPayload = { sha: fullSha, summary };
  return payload;
};

// ── Push / Pull ───────────────────────────────────────────

export const gitPush: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const git = gitAt(cwd);
  const branch = await requireBranch(git);
  try {
    await git.push("origin", branch);
  } catch (err) {
    throw new Error(
      `push: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

export const gitPushForce: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const git = gitAt(cwd);
  const branch = await requireBranch(git);
  try {
    await git.push("origin", branch, { "--force": null });
  } catch (err) {
    throw new Error(
      `force push: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

export const gitPull: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const git = gitAt(cwd);
  const branch = await requireBranch(git);
  // Fast-forward only. If the pull would require a merge, git exits
  // non-zero and we surface a designer-friendly message.
  try {
    await git.raw(["pull", "--ff-only", "origin", branch]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Not possible to fast-forward|non-fast-forward|diverged/i.test(msg)) {
      throw new Error(
        "pull would require a merge or rebase; resolve in the Terminal tab",
      );
    }
    throw new Error(`fetch: ${msg}`);
  }
};

// ── Diff ───────────────────────────────────────────────────

interface DiffResultPayload {
  path: string;
  text: string;
  truncated: boolean;
}

const DIFF_MAX_BYTES = 200_000;

export const gitDiffFile: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const filePath = String(args.path ?? "");
  const staged = Boolean(args.staged);
  if (!filePath) throw new Error("git_diff_file: missing path");

  const git = gitAt(cwd);
  const baseArgs = ["diff", "-U3"];
  if (staged) baseArgs.push("--cached");
  baseArgs.push("--", filePath);

  const text = await git.raw(baseArgs);
  let truncated = false;
  let out = text ?? "";
  if (Buffer.byteLength(out, "utf-8") >= DIFF_MAX_BYTES) {
    // Truncate at the byte boundary closest to the cap; git diff
    // output is ASCII-ish so this is safe.
    out = out.slice(0, DIFF_MAX_BYTES);
    truncated = true;
  }
  const payload: DiffResultPayload = { path: filePath, text: out, truncated };
  return payload;
};

// ── Log ────────────────────────────────────────────────────

interface CommitLogPayload {
  sha: string;
  shortSha: string;
  summary: string;
  author: string;
  timestamp: number;
}

export const gitLogRecent: CommitLogHandler = async (args) => {
  const cwd = resolveCwd(args);
  const limitRaw = typeof args.limit === "number" ? args.limit : 10;
  const limit = Math.max(1, Math.min(100, Math.floor(limitRaw)));

  const git = gitAt(cwd);
  try {
    const log = await git.log({ maxCount: limit });
    return log.all.map((c): CommitLogPayload => {
      const sha = c.hash;
      return {
        sha,
        shortSha: sha.slice(0, 7),
        summary: c.message ?? "",
        author: c.author_name ?? "",
        // `c.date` is an ISO string; convert to seconds for the renderer.
        timestamp: Math.floor(new Date(c.date).getTime() / 1000),
      };
    });
  } catch {
    // Empty repo (no HEAD) — return empty list.
    return [];
  }
};

type CommitLogHandler = CommandHandler;

// ── Branches ───────────────────────────────────────────────

interface BranchInfoPayload {
  name: string;
  isHead: boolean;
  isRemote: boolean;
}

export const gitBranchList: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const git = gitAt(cwd);
  const br = await git.branch(["-a"]);

  const out: BranchInfoPayload[] = [];
  for (const name of br.all) {
    const isRemote = name.startsWith("remotes/");
    // Strip "remotes/" prefix so the renderer receives "origin/main",
    // not "remotes/origin/main".
    const cleanName = isRemote ? name.slice("remotes/".length) : name;
    if (!cleanName || cleanName === "origin/HEAD") continue;
    out.push({
      name: cleanName,
      isHead: !isRemote && cleanName === br.current,
      isRemote,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
};

export const gitBranchSwitch: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const name = String(args.name ?? "");
  if (!name) throw new Error("git_branch_switch: missing name");
  await gitAt(cwd).checkout(name);
};

export const gitBranchCreate: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const name = String(args.name ?? "").trim();
  const checkout = Boolean(args.checkout);
  if (!name) throw new Error("branch name is empty");
  const git = gitAt(cwd);
  if (checkout) {
    await git.checkoutLocalBranch(name);
  } else {
    await git.branch([name]);
  }
};

export const gitBranchDelete: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const name = String(args.name ?? "");
  if (!name) throw new Error("git_branch_delete: missing name");
  const git = gitAt(cwd);
  const br = await git.branch();
  if (br.current === name) {
    throw new Error("cannot delete the currently checked-out branch");
  }
  await git.deleteLocalBranch(name);
};

// ── Commit-message auto-suggest ────────────────────────────
//
// Heuristic commit-message suggestion: verb from dominant change kind,
// subject = verb + up to 3 top-level
// segments ("src, docs and more (N files)"), body = grouped bullets.
// Untracked files are excluded — only staged changes contribute.

function topSegment(p: string): string {
  const slash = p.indexOf("/");
  return slash === -1 ? p : p.slice(0, slash);
}

export const gitSuggestCommitMessage: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const git = gitAt(cwd);
  const st = await git.status(["--renames"]);

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const renamed: string[] = [];

  for (const f of st.files) {
    // Staged column only (index). Untracked is excluded because
    // Only staged/index changes contribute; untracked files are excluded.
    switch (f.index) {
      case "A":
        added.push(f.path);
        break;
      case "M":
        modified.push(f.path);
        break;
      case "D":
        deleted.push(f.path);
        break;
      case "R":
        renamed.push(f.path);
        break;
      default:
        break;
    }
  }

  const total = added.length + modified.length + deleted.length + renamed.length;
  if (total === 0) return "";

  const verb =
    added.length === total
      ? "Add"
      : deleted.length === total
        ? "Remove"
        : modified.length === total
          ? "Update"
          : "Update";

  const allPaths = [...added, ...modified, ...deleted, ...renamed];
  const segments = [...new Set(allPaths.map(topSegment))].sort();
  const segmentStr =
    segments.length > 3
      ? `${segments.slice(0, 3).join(", ")} and more`
      : segments.join(", ");

  const subject =
    total === 1
      ? `${verb} ${allPaths[0]}`
      : `${verb} ${segmentStr} (${total} files)`;

  const groups: [string, string[]][] = [
    ["Added", added],
    ["Modified", modified],
    ["Deleted", deleted],
    ["Renamed", renamed],
  ];
  let body = "";
  for (const [label, paths] of groups) {
    if (paths.length === 0) continue;
    body += `\n${label}:\n`;
    for (const p of paths) body += `- ${p}\n`;
  }

  return body ? `${subject}\n${body}` : subject;
};

// ── Remote URL ─────────────────────────────────────────────

function normaliseRemoteUrl(raw: string): string {
  const trimmed = raw.trim();
  const stripped = trimmed.endsWith(".git")
    ? trimmed.slice(0, -".git".length)
    : trimmed;
  // git@github.com:owner/repo  →  https://github.com/owner/repo
  if (stripped.startsWith("git@")) {
    const rest = stripped.slice("git@".length);
    const colonIdx = rest.indexOf(":");
    if (colonIdx >= 0) {
      const host = rest.slice(0, colonIdx);
      const p = rest.slice(colonIdx + 1);
      return `https://${host}/${p}`;
    }
  }
  // ssh://git@github.com/owner/repo  →  https://github.com/owner/repo
  if (stripped.startsWith("ssh://git@")) {
    return `https://${stripped.slice("ssh://git@".length)}`;
  }
  return stripped;
}

export const gitRemoteUrl: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const git = gitAt(cwd);
  try {
    const url = (await git.raw(["remote", "get-url", "origin"])).trim();
    return url ? normaliseRemoteUrl(url) : null;
  } catch {
    // No `origin` remote configured.
    return null;
  }
};

// ── Discard file changes ───────────────────────────────────

export const gitDiscardFile: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const filePath = String(args.path ?? "");
  if (!filePath) throw new Error("git_discard_file: missing path");
  const git = gitAt(cwd);
  const st = await git.status();

  const row = st.files.find((f) => f.path === filePath);
  const isUntracked = row?.working_dir === "?";

  if (isUntracked) {
    const abs = path.join(cwd, filePath);
    if (existsSync(abs)) {
      try {
        unlinkSync(abs);
      } catch (err) {
        throw new Error(
          `remove ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return;
  }

  // Tracked file: checkout HEAD's version (force overwrite).
  await git.raw(["checkout", "HEAD", "--", filePath]);
};

// ── File contents at HEAD (Visual Diff v2) ─────────────────

interface FileVersionPayload {
  path: string;
  exists: boolean;
  content: string | null;
}

export const gitFileAtHead: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const filePath = String(args.path ?? "");
  if (!filePath) throw new Error("git_file_at_head: missing path");

  const git = gitAt(cwd);
  try {
    // `git show HEAD:<path>` returns the blob content verbatim. If
    // HEAD doesn't exist (empty repo) or the path isn't in the tree,
    // git exits non-zero -> return exists:false.
    const content = await git.raw(["show", `HEAD:${filePath}`]);
    const payload: FileVersionPayload = {
      path: filePath,
      exists: true,
      content,
    };
    return payload;
  } catch {
    const payload: FileVersionPayload = {
      path: filePath,
      exists: false,
      content: null,
    };
    return payload;
  }
};

// ── Clone ──────────────────────────────────────────────────

export const gitClone: CommandHandler = async (args) => {
  const url = String(args.url ?? "");
  const destination = String(args.destination ?? "");
  if (!url) throw new Error("git_clone: missing url");
  if (!destination) throw new Error("git_clone: missing destination");

  if (existsSync(destination)) {
    throw new Error(`destination already exists: ${destination}`);
  }
  const parent = path.dirname(destination);
  if (!existsSync(parent)) {
    throw new Error(`parent folder does not exist: ${parent}`);
  }

  const git = simpleGit({ baseDir: parent });
  await git.clone(url, destination);
  return destination;
};

// ── Worktrees ──────────────────────────────────────────────

interface WorktreeInfoPayload {
  name: string;
  path: string;
  isCurrent: boolean;
}

/** Parse `git worktree list --porcelain` output into (name, path, isCurrent).
 *  Each worktree block looks like:
 *    worktree /abs/path
 *    HEAD <sha>
 *    branch refs/heads/main
 *    (blank)
 *  The name is inferred from the last path segment — libgit2 names
 *  worktrees by directory basename by default, so this is consistent. */
function parseWorktreePorcelain(raw: string, currentDir: string): WorktreeInfoPayload[] {
  const out: WorktreeInfoPayload[] = [];
  const blocks = raw.split(/\n(?=worktree )/);
  for (const block of blocks) {
    const line = block.split("\n").find((l) => l.startsWith("worktree "));
    if (!line) continue;
    const p = line.slice("worktree ".length).trim();
    if (!p) continue;
    out.push({
      name: path.basename(p),
      path: p,
      isCurrent: path.resolve(p) === path.resolve(currentDir),
    });
  }
  return out;
}

export const gitWorktreeList: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const git = gitAt(cwd);
  const raw = await git.raw(["worktree", "list", "--porcelain"]);
  // Return only linked worktrees, not the main checkout. `git worktree
  // list` includes the main one first; skip whichever block matches the
  // main repo dir.
  const toplevel = (await git.raw(["rev-parse", "--show-toplevel"])).trim();
  const all = parseWorktreePorcelain(raw, cwd);
  return all.filter((wt) => path.resolve(wt.path) !== path.resolve(toplevel));
};

export const gitWorktreeAdd: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const name = String(args.name ?? "");
  const dest = String(args.path ?? "");
  const branch = typeof args.branch === "string" ? args.branch : null;
  if (!name) throw new Error("git_worktree_add: missing name");
  if (!dest) throw new Error("git_worktree_add: missing path");
  if (existsSync(dest)) throw new Error(`path already exists: ${dest}`);

  const git = gitAt(cwd);
  // `git worktree add [-b newbranch] <path> [branchref]`. When a branch
  // ref is supplied we attach to it (no -b); when it isn't, create a
  // fresh branch from HEAD named after the worktree.
  const cmd = ["worktree", "add"];
  if (branch) {
    cmd.push(dest, branch);
  } else {
    cmd.push("-b", name, dest);
  }
  await git.raw(cmd);
  return dest;
};

export const gitWorktreeRemove: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const name = String(args.name ?? "");
  if (!name) throw new Error("git_worktree_remove: missing name");

  const git = gitAt(cwd);
  // Look up the worktree path by name (basename match) from the
  // porcelain list, so users can reference worktrees by label rather
  // than full path from the UI.
  const raw = await git.raw(["worktree", "list", "--porcelain"]);
  const entries = parseWorktreePorcelain(raw, cwd);
  const target = entries.find((w) => w.name === name);
  if (!target) throw new Error(`find_worktree(${name}): not found`);

  // Best-effort rm -rf + prune because Git refuses to prune a still-valid
  // tree.
  if (existsSync(target.path)) {
    try {
      rmSync(target.path, { recursive: true, force: true });
    } catch (err) {
      throw new Error(
        `remove_dir_all(${target.path}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  await git.raw(["worktree", "prune"]);
};

// ── Conflicts ──────────────────────────────────────────────

interface ConflictFilePayload {
  path: string;
  hasOurs: boolean;
  hasTheirs: boolean;
}

/** `git ls-files -u` outputs lines like:
 *    100644 <sha> 1\t<path>
 *    100644 <sha> 2\t<path>
 *    100644 <sha> 3\t<path>
 *  Stage 1 = ancestor, 2 = ours, 3 = theirs. We fold into one row per
 *  path with the stage-2/stage-3 presence flags. */
function parseLsFilesConflict(raw: string): ConflictFilePayload[] {
  const byPath = new Map<string, { ours: boolean; theirs: boolean }>();
  for (const line of raw.split("\n")) {
    if (!line) continue;
    // Split on tab to separate metadata from filename.
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const meta = line.slice(0, tab).trim().split(/\s+/);
    if (meta.length < 3) continue;
    const stage = meta[2];
    const filePath = line.slice(tab + 1);
    const bucket = byPath.get(filePath) ?? { ours: false, theirs: false };
    if (stage === "2") bucket.ours = true;
    if (stage === "3") bucket.theirs = true;
    byPath.set(filePath, bucket);
  }
  const out: ConflictFilePayload[] = [];
  for (const [p, b] of byPath) {
    out.push({ path: p, hasOurs: b.ours, hasTheirs: b.theirs });
  }
  return out;
}

export const gitConflictList: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const git = gitAt(cwd);
  const raw = await git.raw(["ls-files", "-u"]);
  if (!raw.trim()) return [];
  return parseLsFilesConflict(raw);
};

async function resolveConflict(
  git: SimpleGit,
  cwd: string,
  filePath: string,
  theirs: boolean,
): Promise<void> {
  // `git checkout --ours|--theirs <path>` writes the chosen side to
  // the working tree. Then `git add <path>` marks the conflict
  // resolved in the index.
  const flag = theirs ? "--theirs" : "--ours";
  // `checkout <flag>` won't create parent dirs automatically if the
  // path is new; make sure they exist first.
  const abs = path.join(cwd, filePath);
  const parent = path.dirname(abs);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
  try {
    await git.raw(["checkout", flag, "--", filePath]);
  } catch (err) {
    throw new Error(
      `no ${theirs ? "theirs" : "ours"} version found for ${filePath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  await git.add([filePath]);
  // Touch the file if checkout didn't create it (extremely rare, but
  // guarantees the staged path exists.
  if (!existsSync(abs)) {
    writeFileSync(abs, "");
    await git.add([filePath]);
  }
}

export const gitResolveFileOurs: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const filePath = String(args.path ?? "");
  if (!filePath) throw new Error("git_resolve_file_ours: missing path");
  await resolveConflict(gitAt(cwd), cwd, filePath, false);
};

export const gitResolveFileTheirs: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const filePath = String(args.path ?? "");
  if (!filePath) throw new Error("git_resolve_file_theirs: missing path");
  await resolveConflict(gitAt(cwd), cwd, filePath, true);
};

// ── Right-click commit actions ─────────────────────────────

export const gitRevertCommit: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const sha = String(args.sha ?? "");
  if (!sha) throw new Error("git_revert_commit: missing sha");
  // Validate the sha ref — `git rev-parse --verify` throws on bad input.
  const git = gitAt(cwd);
  try {
    await git.raw(["rev-parse", "--verify", sha]);
  } catch (err) {
    throw new Error(
      `bad sha: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  await git.raw(["revert", "--no-edit", sha]);
  return `Reverted ${sha.slice(0, Math.min(7, sha.length))}`;
};

export const gitResetHard: CommandHandler = async (args) => {
  const cwd = resolveCwd(args);
  const sha = String(args.sha ?? "");
  if (!sha) throw new Error("git_reset_hard: missing sha");
  const git = gitAt(cwd);
  try {
    await git.raw(["rev-parse", "--verify", sha]);
  } catch (err) {
    throw new Error(
      `bad sha: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  await git.raw(["reset", "--hard", sha]);
};

// Silence the unused-import warning for statSync (kept for future
// validators — resolveCwd doesn't call it but discardFile does).
void statSync;
