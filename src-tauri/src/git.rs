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
// Out of scope for this phase (Phase 3):
//   - clone from URL
//   - create + push new branch with --set-upstream
//   - conflict resolution UI
//   - worktree commands (Phase 4)
// ──────────────────────────────────────────────────────────

use git2::{
    build::CheckoutBuilder, BranchType, Config, Cred, FetchOptions, PushOptions,
    RemoteCallbacks, Repository, Status, StatusOptions, Time,
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
pub fn git_status(state: tauri::State<'_, SidecarState>) -> Result<GitStatus, String> {
    let root = root_from_state(&state)?;
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
    path: String,
) -> Result<(), String> {
    let root = root_from_state(&state)?;
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
    path: String,
) -> Result<(), String> {
    let root = root_from_state(&state)?;
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
pub fn git_stage_all(state: tauri::State<'_, SidecarState>) -> Result<(), String> {
    let root = root_from_state(&state)?;
    let repo = open_repo(&root)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("add_all: {}", e))?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage_all(state: tauri::State<'_, SidecarState>) -> Result<(), String> {
    let root = root_from_state(&state)?;
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
    message: String,
) -> Result<CommitResult, String> {
    let root = root_from_state(&state)?;
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
pub fn git_push(state: tauri::State<'_, SidecarState>) -> Result<(), String> {
    let root = root_from_state(&state)?;
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
pub fn git_pull(state: tauri::State<'_, SidecarState>) -> Result<(), String> {
    let root = root_from_state(&state)?;
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
    path: String,
    staged: bool,
) -> Result<DiffResult, String> {
    let root = root_from_state(&state)?;
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
    limit: Option<usize>,
) -> Result<Vec<CommitLog>, String> {
    let root = root_from_state(&state)?;
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
) -> Result<Vec<BranchInfo>, String> {
    let root = root_from_state(&state)?;
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
    name: String,
) -> Result<(), String> {
    let root = root_from_state(&state)?;
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
