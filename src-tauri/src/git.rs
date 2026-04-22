// ──────────────────────────────────────────────────────────
// Git — libgit2 via git2-rs
// ──────────────────────────────────────────────────────────
//
// Phase 1C-Git scope. Goal: a designer can stage changes,
// commit with a message, and push to origin without ever
// touching a CLI. A developer can do the same plus switch
// branches, view a file diff, and read recent commits.
//
// Auth: uses git's own credential helper via
// `Cred::credential_helper` — whatever the user's existing
// `git push` config is (osxkeychain, SSH agent keys, PAT in
// ~/.git-credentials), we inherit it. Phase 3 adds GitHub
// Device-Flow OAuth for the "I don't have git set up" path.
//
// Phase 3 additions layered on top of the Phase 1C plumbing:
//   - commit message auto-suggest
//   - remote URL + "Open PR" helper
//   - discard file changes (Safety Affordances)
//   - file contents at HEAD (Visual Diff v2)
//   - clone from URL
//   - worktree add / list / remove
//   - conflict listing + keep-mine / keep-theirs resolve
//   - revert / reset-hard commit actions
// ──────────────────────────────────────────────────────────

use git2::{
    build::{CheckoutBuilder, RepoBuilder},
    BranchType, Config, Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository, ResetType,
    Status, StatusOptions, Time,
};
use serde::Serialize;
use std::path::{Path, PathBuf};

use crate::sidecar::SidecarState;

// ── Shared helpers ─────────────────────────────────────────

fn open_repo(root: &Path) -> Result<Repository, String> {
    Repository::discover(root).map_err(|e| format!("not a git repo: {}", e))
}

fn root_from_state(state: &SidecarState) -> Result<PathBuf, String> {
    state
        .current_root()
        .ok_or_else(|| "no project root".to_string())
}

/// Resolve the project root for a git op. When the frontend supplies
/// `cwd` (the active chat's folder), use that; otherwise fall back to
/// the engine's global root. Lets per-chat git ops work without
/// reloading the whole project.
fn resolve_root(state: &SidecarState, cwd: Option<String>) -> Result<PathBuf, String> {
    match cwd {
        Some(s) if !s.is_empty() => Ok(PathBuf::from(s)),
        _ => root_from_state(state),
    }
}

/// RemoteCallbacks wired up to fall through to whatever git credential
/// helper the user already has configured for the remote. This mirrors
/// what `git push` / `git pull` would do themselves.
fn make_remote_callbacks() -> RemoteCallbacks<'static> {
    let mut cb = RemoteCallbacks::new();
    cb.credentials(|url, username_from_url, allowed| {
        // Try SSH key from agent first (covers `git@github.com:...` remotes)
        if allowed.contains(git2::CredentialType::SSH_KEY) {
            if let Some(user) = username_from_url {
                if let Ok(cred) = Cred::ssh_key_from_agent(user) {
                    return Ok(cred);
                }
            }
        }
        // Fall through to the user's git credential helper for HTTPS.
        if let Ok(config) = Config::open_default() {
            if let Ok(cred) = Cred::credential_helper(&config, url, username_from_url) {
                return Ok(cred);
            }
        }
        // Last resort: default() asks libgit2 to try its built-in helpers.
        Cred::default()
    });
    cb
}

// ── Status ─────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub path: String,
    /// Primary change type: `added`, `modified`, `deleted`, `renamed`,
    /// `typechange`, `conflicted`, or `untracked`.
    pub kind: String,
    /// True when the change is already in the index (staged).
    pub staged: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: Option<String>,
    pub head_sha: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub has_upstream: bool,
    pub unstaged: Vec<FileStatus>,
    pub staged: Vec<FileStatus>,
}

fn categorise(status: Status) -> (Option<(&'static str, bool)>, Option<(&'static str, bool)>) {
    // Returns (unstaged_view, staged_view).
    let mut unstaged: Option<(&'static str, bool)> = None;
    let mut staged: Option<(&'static str, bool)> = None;

    if status.is_conflicted() {
        unstaged = Some(("conflicted", false));
        return (unstaged, staged);
    }

    // Index (staged) view
    if status.contains(Status::INDEX_NEW) {
        staged = Some(("added", true));
    } else if status.contains(Status::INDEX_MODIFIED) {
        staged = Some(("modified", true));
    } else if status.contains(Status::INDEX_DELETED) {
        staged = Some(("deleted", true));
    } else if status.contains(Status::INDEX_RENAMED) {
        staged = Some(("renamed", true));
    } else if status.contains(Status::INDEX_TYPECHANGE) {
        staged = Some(("typechange", true));
    }

    // Working tree (unstaged) view
    if status.contains(Status::WT_NEW) {
        unstaged = Some(("untracked", false));
    } else if status.contains(Status::WT_MODIFIED) {
        unstaged = Some(("modified", false));
    } else if status.contains(Status::WT_DELETED) {
        unstaged = Some(("deleted", false));
    } else if status.contains(Status::WT_RENAMED) {
        unstaged = Some(("renamed", false));
    } else if status.contains(Status::WT_TYPECHANGE) {
        unstaged = Some(("typechange", false));
    }

    (unstaged, staged)
}

#[tauri::command]
pub fn git_status(state: tauri::State<'_, SidecarState>, cwd: Option<String>) -> Result<GitStatus, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;

    // Current branch + HEAD SHA
    let (branch, head_sha) = match repo.head() {
        Ok(reference) => {
            let name = reference
                .shorthand()
                .map(|s| s.to_string());
            let sha = reference
                .target()
                .map(|oid| oid.to_string());
            (name, sha)
        }
        Err(_) => (None, None),
    };

    // Ahead / behind counts (best-effort; 0/0 when no upstream).
    let mut ahead = 0usize;
    let mut behind = 0usize;
    let mut has_upstream = false;
    if let Ok(local_ref) = repo.head() {
        if let Some(local_oid) = local_ref.target() {
            if let Ok(local_branch) = repo.find_branch(
                local_ref.shorthand().unwrap_or(""),
                BranchType::Local,
            ) {
                if let Ok(upstream) = local_branch.upstream() {
                    has_upstream = true;
                    if let Some(up_oid) = upstream.get().target() {
                        if let Ok((a, b)) = repo.graph_ahead_behind(local_oid, up_oid) {
                            ahead = a;
                            behind = b;
                        }
                    }
                }
            }
        }
    }

    // File statuses
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("statuses: {}", e))?;

    let mut unstaged = Vec::new();
    let mut staged = Vec::new();
    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let (u, s) = categorise(entry.status());
        if let Some((kind, _)) = u {
            unstaged.push(FileStatus {
                path: path.clone(),
                kind: kind.to_string(),
                staged: false,
            });
        }
        if let Some((kind, _)) = s {
            staged.push(FileStatus {
                path,
                kind: kind.to_string(),
                staged: true,
            });
        }
    }

    Ok(GitStatus {
        branch,
        head_sha,
        ahead,
        behind,
        has_upstream,
        unstaged,
        staged,
    })
}

// ── Stage / Unstage ────────────────────────────────────────

#[tauri::command]
pub fn git_stage_file(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    path: String,
) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_path(Path::new(&path))
        .map_err(|e| format!("add_path({}): {}", path, e))?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage_file(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    path: String,
) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    // `reset` against the current HEAD for a single path: this un-indexes
    // the change so it becomes unstaged. Falls back to removing the path
    // from the index when there's no HEAD yet (fresh repo, initial commit).
    match repo.head() {
        Ok(head_ref) => {
            let obj = head_ref.peel(git2::ObjectType::Any).map_err(|e| e.to_string())?;
            repo.reset_default(Some(&obj), [Path::new(&path)].iter())
                .map_err(|e| format!("reset_default({}): {}", path, e))?;
        }
        Err(_) => {
            let mut index = repo.index().map_err(|e| e.to_string())?;
            let _ = index.remove_path(Path::new(&path));
            index.write().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn git_stage_all(state: tauri::State<'_, SidecarState>, cwd: Option<String>) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("add_all: {}", e))?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage_all(state: tauri::State<'_, SidecarState>, cwd: Option<String>) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    if let Ok(head_ref) = repo.head() {
        let obj = head_ref.peel(git2::ObjectType::Any).map_err(|e| e.to_string())?;
        // `reset --mixed` with no paths argument resets the entire index to
        // match HEAD but leaves the working tree alone.
        repo.reset(&obj, git2::ResetType::Mixed, Some(CheckoutBuilder::new().force()))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Commit ─────────────────────────────────────────────────

#[derive(Serialize)]
pub struct CommitResult {
    pub sha: String,
    pub summary: String,
}

#[tauri::command]
pub fn git_commit(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    message: String,
) -> Result<CommitResult, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;

    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err("commit message is empty".into());
    }

    let sig = repo
        .signature()
        .map_err(|e| format!("missing git user.name/user.email: {}", e))?;

    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    let parents: Vec<_> = match repo.head() {
        Ok(head_ref) => vec![head_ref.peel_to_commit().map_err(|e| e.to_string())?],
        Err(_) => Vec::new(), // initial commit
    };
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, trimmed, &tree, &parent_refs)
        .map_err(|e| format!("commit: {}", e))?;

    Ok(CommitResult {
        sha: oid.to_string(),
        summary: trimmed.lines().next().unwrap_or(trimmed).to_string(),
    })
}

// ── Push / Pull (fast-forward only) ────────────────────────

fn current_branch_name(repo: &Repository) -> Result<String, String> {
    let head = repo.head().map_err(|e| e.to_string())?;
    if !head.is_branch() {
        return Err("HEAD is detached; check out a branch first".into());
    }
    head.shorthand()
        .map(|s| s.to_string())
        .ok_or_else(|| "could not resolve current branch".into())
}

#[tauri::command]
pub fn git_push(state: tauri::State<'_, SidecarState>, cwd: Option<String>) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let branch = current_branch_name(&repo)?;
    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| format!("find_remote origin: {}", e))?;

    let mut opts = PushOptions::new();
    opts.remote_callbacks(make_remote_callbacks());

    let refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);
    remote
        .push(&[refspec.as_str()], Some(&mut opts))
        .map_err(|e| format!("push: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn git_pull(state: tauri::State<'_, SidecarState>, cwd: Option<String>) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let branch = current_branch_name(&repo)?;
    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| format!("find_remote origin: {}", e))?;

    // Fetch
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(make_remote_callbacks());
    remote
        .fetch(&[&branch], Some(&mut fetch_opts), None)
        .map_err(|e| format!("fetch: {}", e))?;

    // Fast-forward merge only. Anything more complex surfaces an error and
    // the user can drop into Terminal for a real merge / rebase.
    let fetch_head = repo
        .find_reference("FETCH_HEAD")
        .map_err(|e| format!("FETCH_HEAD: {}", e))?;
    let fetch_commit = repo
        .reference_to_annotated_commit(&fetch_head)
        .map_err(|e| e.to_string())?;
    let analysis = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| e.to_string())?;

    if analysis.0.is_up_to_date() {
        return Ok(());
    }
    if !analysis.0.is_fast_forward() {
        return Err(
            "pull would require a merge or rebase; resolve in the Terminal tab".into(),
        );
    }

    let refname = format!("refs/heads/{}", branch);
    let mut reference = repo
        .find_reference(&refname)
        .map_err(|e| format!("find_reference: {}", e))?;
    reference
        .set_target(fetch_commit.id(), "0canvas: fast-forward pull")
        .map_err(|e| format!("set_target: {}", e))?;
    repo.set_head(&refname).map_err(|e| e.to_string())?;
    repo.checkout_head(Some(CheckoutBuilder::new().force()))
        .map_err(|e| format!("checkout_head: {}", e))?;
    Ok(())
}

// ── Diff ───────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub path: String,
    pub text: String,
    pub truncated: bool,
}

#[tauri::command]
pub fn git_diff_file(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    path: String,
    staged: bool,
) -> Result<DiffResult, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;

    let mut opts = git2::DiffOptions::new();
    opts.pathspec(&path).context_lines(3);

    let diff = if staged {
        let head_tree = match repo.head() {
            Ok(head_ref) => Some(head_ref.peel_to_tree().map_err(|e| e.to_string())?),
            Err(_) => None,
        };
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))
            .map_err(|e| e.to_string())?
    } else {
        repo.diff_index_to_workdir(None, Some(&mut opts))
            .map_err(|e| e.to_string())?
    };

    let mut text = String::new();
    let max_bytes = 200_000usize;
    let mut truncated = false;
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        if truncated {
            return true;
        }
        let origin = line.origin();
        if origin == '+' || origin == '-' || origin == ' ' {
            text.push(origin);
        }
        text.push_str(&String::from_utf8_lossy(line.content()));
        if text.len() >= max_bytes {
            truncated = true;
        }
        true
    })
    .map_err(|e| e.to_string())?;

    Ok(DiffResult {
        path,
        text,
        truncated,
    })
}

// ── Log ────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitLog {
    pub sha: String,
    pub short_sha: String,
    pub summary: String,
    pub author: String,
    pub timestamp: i64,
}

fn time_seconds(t: Time) -> i64 {
    t.seconds()
}

#[tauri::command]
pub fn git_log_recent(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<CommitLog>, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let limit = limit.unwrap_or(10).min(100);

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    // Ignore errors from revwalk.push_head (empty repo) — return empty list.
    if revwalk.push_head().is_err() {
        return Ok(Vec::new());
    }

    let mut out = Vec::new();
    for (i, oid) in revwalk.enumerate() {
        if i >= limit {
            break;
        }
        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        let sha = oid.to_string();
        let short_sha = sha.chars().take(7).collect();
        let summary = commit.summary().unwrap_or("").to_string();
        let author = commit.author().name().unwrap_or("").to_string();
        let timestamp = time_seconds(commit.time());
        out.push(CommitLog {
            sha,
            short_sha,
            summary,
            author,
            timestamp,
        });
    }
    Ok(out)
}

// ── Branches ───────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub is_remote: bool,
}

#[tauri::command]
pub fn git_branch_list(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
) -> Result<Vec<BranchInfo>, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let mut out = Vec::new();
    let branches = repo
        .branches(None)
        .map_err(|e| format!("branches: {}", e))?;
    for item in branches {
        let (branch, btype) = item.map_err(|e| e.to_string())?;
        let name = branch.name().map_err(|e| e.to_string())?.unwrap_or("").to_string();
        if name.is_empty() {
            continue;
        }
        out.push(BranchInfo {
            name,
            is_head: branch.is_head(),
            is_remote: matches!(btype, BranchType::Remote),
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[tauri::command]
pub fn git_branch_switch(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    name: String,
) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let refname = format!("refs/heads/{}", name);
    let obj = repo
        .revparse_single(&refname)
        .map_err(|e| format!("revparse({}): {}", refname, e))?;
    repo.checkout_tree(&obj, Some(CheckoutBuilder::new().safe()))
        .map_err(|e| format!("checkout: {}", e))?;
    repo.set_head(&refname).map_err(|e| e.to_string())?;
    Ok(())
}

/// Create a new local branch at HEAD. If `checkout` is true, also switches
/// to the new branch (mirrors `git checkout -b`). Errors if the branch
/// already exists.
#[tauri::command]
pub fn git_branch_create(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    name: String,
    checkout: bool,
) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("branch name is empty".into());
    }
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let head_commit = repo
        .head()
        .map_err(|e| format!("head: {}", e))?
        .peel_to_commit()
        .map_err(|e| format!("peel_to_commit: {}", e))?;
    repo.branch(trimmed, &head_commit, false)
        .map_err(|e| format!("branch({}): {}", trimmed, e))?;
    if checkout {
        let refname = format!("refs/heads/{}", trimmed);
        let obj = repo
            .revparse_single(&refname)
            .map_err(|e| format!("revparse({}): {}", refname, e))?;
        repo.checkout_tree(&obj, Some(CheckoutBuilder::new().safe()))
            .map_err(|e| format!("checkout: {}", e))?;
        repo.set_head(&refname).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Delete a local branch. Refuses if the branch is the current HEAD.
#[tauri::command]
pub fn git_branch_delete(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    name: String,
) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let mut branch = repo
        .find_branch(&name, BranchType::Local)
        .map_err(|e| format!("find_branch({}): {}", name, e))?;
    if branch.is_head() {
        return Err("cannot delete the currently checked-out branch".into());
    }
    branch.delete().map_err(|e| format!("delete: {}", e))?;
    Ok(())
}

// ── Phase 3-A · Commit message auto-suggest ────────────────
//
// Heuristic: summarise the staged changes in one line (verb + top
// paths + count), leave blank lines, then bullet each file. The UI
// still lets the user edit before commit — this is a starting point,
// not a decision.

/// Group paths by their first segment, e.g.:
///   src/shell/git-panel.tsx          → "src"
///   docs/TAURI_MAC_APP_PLAN.md       → "docs"
///   theme.css                        → "theme.css"
fn top_segment(path: &str) -> &str {
    path.split('/').next().unwrap_or(path)
}

#[tauri::command]
pub fn git_suggest_commit_message(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
) -> Result<String, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;

    // Staged files only — that's what's actually about to be committed.
    let mut opts = StatusOptions::new();
    opts.include_untracked(false);
    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("statuses: {}", e))?;

    let mut added: Vec<String> = Vec::new();
    let mut modified: Vec<String> = Vec::new();
    let mut deleted: Vec<String> = Vec::new();
    let mut renamed: Vec<String> = Vec::new();

    for entry in statuses.iter() {
        let s = entry.status();
        let path = entry.path().unwrap_or("").to_string();
        if path.is_empty() {
            continue;
        }
        if s.contains(Status::INDEX_NEW) {
            added.push(path);
        } else if s.contains(Status::INDEX_MODIFIED) {
            modified.push(path);
        } else if s.contains(Status::INDEX_DELETED) {
            deleted.push(path);
        } else if s.contains(Status::INDEX_RENAMED) {
            renamed.push(path);
        }
    }

    let total = added.len() + modified.len() + deleted.len() + renamed.len();
    if total == 0 {
        return Ok(String::new());
    }

    // Verb: prefer the dominant kind, fall back to "Update".
    let verb = if added.len() == total {
        "Add"
    } else if deleted.len() == total {
        "Remove"
    } else if modified.len() == total {
        "Update"
    } else {
        "Update"
    };

    // Subject line: verb + up to 3 top-level segments.
    let all: Vec<&String> = added
        .iter()
        .chain(modified.iter())
        .chain(deleted.iter())
        .chain(renamed.iter())
        .collect();
    let mut segments: Vec<&str> = all.iter().map(|p| top_segment(p)).collect();
    segments.sort();
    segments.dedup();
    let segment_str = if segments.len() > 3 {
        format!("{} and more", segments[..3].join(", "))
    } else {
        segments.join(", ")
    };

    let subject = if total == 1 {
        let only = all[0];
        format!("{} {}", verb, only)
    } else {
        format!("{} {} ({} files)", verb, segment_str, total)
    };

    // Body: bullet list of files, grouped.
    let mut body = String::new();
    let groups: &[(&str, &Vec<String>)] = &[
        ("Added", &added),
        ("Modified", &modified),
        ("Deleted", &deleted),
        ("Renamed", &renamed),
    ];
    for (label, paths) in groups {
        if paths.is_empty() {
            continue;
        }
        body.push_str(&format!("\n{}:\n", label));
        for p in *paths {
            body.push_str(&format!("- {}\n", p));
        }
    }

    if body.is_empty() {
        Ok(subject)
    } else {
        Ok(format!("{}\n{}", subject, body))
    }
}

// ── Phase 3-B · Remote URL ─────────────────────────────────
//
// Returns the normalised https URL of `origin`, or None when there
// is no remote. SSH URLs (git@github.com:owner/repo.git) are
// rewritten to https form so the UI can build `/compare/...` links
// directly.

fn normalise_remote_url(raw: &str) -> String {
    let trimmed = raw.trim();
    let stripped = trimmed.strip_suffix(".git").unwrap_or(trimmed);
    if let Some(rest) = stripped.strip_prefix("git@") {
        // git@github.com:owner/repo  →  https://github.com/owner/repo
        if let Some((host, path)) = rest.split_once(':') {
            return format!("https://{}/{}", host, path);
        }
    }
    if let Some(rest) = stripped.strip_prefix("ssh://git@") {
        // ssh://git@github.com/owner/repo
        return format!("https://{}", rest);
    }
    stripped.to_string()
}

#[tauri::command]
pub fn git_remote_url(state: tauri::State<'_, SidecarState>, cwd: Option<String>) -> Result<Option<String>, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let remote = match repo.find_remote("origin") {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };
    Ok(remote.url().map(normalise_remote_url))
}

// ── Phase 3-C · Discard file changes ───────────────────────
//
// "Discard changes" for a single path — checks out HEAD's version.
// For untracked files we just delete them from disk.

#[tauri::command]
pub fn git_discard_file(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    path: String,
) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;

    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);
    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("statuses: {}", e))?;

    let is_untracked = statuses
        .iter()
        .any(|e| e.path() == Some(path.as_str()) && e.status().contains(Status::WT_NEW));

    if is_untracked {
        let abs = root.join(&path);
        if abs.exists() {
            std::fs::remove_file(&abs)
                .map_err(|e| format!("remove {}: {}", path, e))?;
        }
        return Ok(());
    }

    let mut builder = CheckoutBuilder::new();
    builder.force().path(&path);
    repo.checkout_head(Some(&mut builder))
        .map_err(|e| format!("checkout_head({}): {}", path, e))?;
    Ok(())
}

// ── Phase 3-E · File contents at HEAD (for Visual Diff v2) ──

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileVersion {
    pub path: String,
    pub exists: bool,
    pub content: Option<String>,
}

#[tauri::command]
pub fn git_file_at_head(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    path: String,
) -> Result<FileVersion, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;

    let head_tree = match repo.head() {
        Ok(r) => r.peel_to_tree().map_err(|e| e.to_string())?,
        Err(_) => {
            return Ok(FileVersion {
                path,
                exists: false,
                content: None,
            })
        }
    };

    let entry = match head_tree.get_path(Path::new(&path)) {
        Ok(e) => e,
        Err(_) => {
            return Ok(FileVersion {
                path,
                exists: false,
                content: None,
            })
        }
    };
    let obj = entry.to_object(&repo).map_err(|e| e.to_string())?;
    let blob = obj.as_blob().ok_or_else(|| "not a blob".to_string())?;
    let content = String::from_utf8_lossy(blob.content()).to_string();
    Ok(FileVersion {
        path,
        exists: true,
        content: Some(content),
    })
}

// ── Phase 3-F · Clone ──────────────────────────────────────

#[tauri::command]
pub fn git_clone(url: String, destination: String) -> Result<String, String> {
    let dest = PathBuf::from(&destination);
    if dest.exists() {
        return Err(format!("destination already exists: {}", destination));
    }
    if let Some(parent) = dest.parent() {
        if !parent.exists() {
            return Err(format!("parent folder does not exist: {}", parent.display()));
        }
    }

    let mut cb = make_remote_callbacks();
    // Progress is best-effort; ignore transfer_progress failures.
    cb.transfer_progress(|_| true);

    let mut fo = FetchOptions::new();
    fo.remote_callbacks(cb);

    let mut builder = RepoBuilder::new();
    builder.fetch_options(fo);
    builder
        .clone(&url, &dest)
        .map_err(|e| format!("clone: {}", e))?;
    Ok(dest.to_string_lossy().into_owned())
}

// ── Phase 3-G · Worktrees ──────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub name: String,
    pub path: String,
    pub is_current: bool,
}

#[tauri::command]
pub fn git_worktree_list(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
) -> Result<Vec<WorktreeInfo>, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let names = repo
        .worktrees()
        .map_err(|e| format!("worktrees: {}", e))?;
    let current = repo.workdir().map(|p| p.to_path_buf());
    let mut out = Vec::new();
    for name in names.iter().flatten() {
        let wt = match repo.find_worktree(name) {
            Ok(w) => w,
            Err(_) => continue,
        };
        let path = wt.path().to_path_buf();
        let is_current = current.as_ref().map(|c| c == &path).unwrap_or(false);
        out.push(WorktreeInfo {
            name: name.to_string(),
            path: path.to_string_lossy().into_owned(),
            is_current,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn git_worktree_add(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    name: String,
    path: String,
    branch: Option<String>,
) -> Result<String, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let dest = PathBuf::from(&path);
    if dest.exists() {
        return Err(format!("path already exists: {}", path));
    }

    // Attach to an existing branch when given, else libgit2 creates one
    // named after the worktree at the current HEAD.
    let mut opts = git2::WorktreeAddOptions::new();
    let reference = branch
        .as_ref()
        .and_then(|b| repo.find_reference(&format!("refs/heads/{}", b)).ok());
    if let Some(ref r) = reference {
        opts.reference(Some(r));
    }
    repo.worktree(&name, &dest, Some(&opts))
        .map_err(|e| format!("worktree add: {}", e))?;
    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn git_worktree_remove(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    name: String,
) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let wt = repo
        .find_worktree(&name)
        .map_err(|e| format!("find_worktree({}): {}", name, e))?;
    // Best-effort pruning. libgit2's prune refuses if the worktree is
    // still considered valid; remove the directory first, then prune.
    let path = wt.path().to_path_buf();
    if path.exists() {
        std::fs::remove_dir_all(&path)
            .map_err(|e| format!("remove_dir_all({}): {}", path.display(), e))?;
    }
    let mut prune = git2::WorktreePruneOptions::new();
    prune.valid(true).working_tree(true);
    wt.prune(Some(&mut prune))
        .map_err(|e| format!("prune: {}", e))?;
    Ok(())
}

// ── Phase 3-H · Conflicts ──────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFile {
    pub path: String,
    pub has_ours: bool,
    pub has_theirs: bool,
}

#[tauri::command]
pub fn git_conflict_list(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
) -> Result<Vec<ConflictFile>, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let index = repo.index().map_err(|e| e.to_string())?;
    if !index.has_conflicts() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    let conflicts = index
        .conflicts()
        .map_err(|e| format!("conflicts: {}", e))?;
    for entry in conflicts {
        let c = entry.map_err(|e| e.to_string())?;
        let pick_path = c
            .our
            .as_ref()
            .or(c.their.as_ref())
            .or(c.ancestor.as_ref());
        let Some(p) = pick_path else { continue };
        let path = String::from_utf8_lossy(&p.path).to_string();
        out.push(ConflictFile {
            path,
            has_ours: c.our.is_some(),
            has_theirs: c.their.is_some(),
        });
    }
    Ok(out)
}

fn resolve_conflict(repo: &Repository, path: &str, theirs: bool) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let mut blob_oid: Option<git2::Oid> = None;
    {
        let conflicts = index
            .conflicts()
            .map_err(|e| format!("conflicts: {}", e))?;
        for entry in conflicts {
            let c = entry.map_err(|e| e.to_string())?;
            let pick = if theirs { c.their.as_ref() } else { c.our.as_ref() };
            if let Some(e) = pick {
                let entry_path = String::from_utf8_lossy(&e.path);
                if entry_path == path {
                    blob_oid = Some(e.id);
                    break;
                }
            }
        }
    }
    let oid = blob_oid.ok_or_else(|| {
        format!(
            "no {} version found for {}",
            if theirs { "theirs" } else { "ours" },
            path
        )
    })?;
    let blob = repo.find_blob(oid).map_err(|e| e.to_string())?;
    let root = repo.workdir().ok_or_else(|| "no workdir".to_string())?;
    let abs = root.join(path);
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("create_dir_all: {}", e))?;
    }
    std::fs::write(&abs, blob.content())
        .map_err(|e| format!("write {}: {}", abs.display(), e))?;

    index
        .remove_path(Path::new(path))
        .map_err(|e| format!("remove_path: {}", e))?;
    index
        .add_path(Path::new(path))
        .map_err(|e| format!("add_path: {}", e))?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_resolve_file_ours(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    path: String,
) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    resolve_conflict(&repo, &path, false)
}

#[tauri::command]
pub fn git_resolve_file_theirs(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    path: String,
) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    resolve_conflict(&repo, &path, true)
}

// ── Phase 3-D · Right-click commit actions ─────────────────

#[tauri::command]
pub fn git_revert_commit(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    sha: String,
) -> Result<String, String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let oid = git2::Oid::from_str(&sha).map_err(|e| format!("bad sha: {}", e))?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    repo.revert(&commit, None)
        .map_err(|e| format!("revert: {}", e))?;
    Ok(format!("Reverted {}", &sha[..sha.len().min(7)]))
}

#[tauri::command]
pub fn git_reset_hard(
    state: tauri::State<'_, SidecarState>,
    cwd: Option<String>,
    sha: String,
) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let oid = git2::Oid::from_str(&sha).map_err(|e| format!("bad sha: {}", e))?;
    let obj = repo
        .find_object(oid, None)
        .map_err(|e| format!("find_object: {}", e))?;
    repo.reset(&obj, ResetType::Hard, Some(CheckoutBuilder::new().force()))
        .map_err(|e| format!("reset --hard: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn git_push_force(state: tauri::State<'_, SidecarState>, cwd: Option<String>) -> Result<(), String> {
    let root = resolve_root(&state, cwd)?;
    let repo = open_repo(&root)?;
    let branch = current_branch_name(&repo)?;
    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| format!("find_remote origin: {}", e))?;

    let mut opts = PushOptions::new();
    opts.remote_callbacks(make_remote_callbacks());

    let refspec = format!("+refs/heads/{}:refs/heads/{}", branch, branch);
    remote
        .push(&[refspec.as_str()], Some(&mut opts))
        .map_err(|e| format!("force push: {}", e))?;
    Ok(())
}
