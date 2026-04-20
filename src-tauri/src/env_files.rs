// ──────────────────────────────────────────────────────────
// .env file editor — Tauri commands
// ──────────────────────────────────────────────────────────
//
// Dedicated commands instead of tauri-plugin-fs because:
//   - Env files live at predictable paths relative to the engine
//     root; we can scope writes without exposing a general fs
//     surface to the webview.
//   - Parsing + serialising stays server-side so the frontend
//     doesn't need to know about comments, blank lines, quotes.
//   - A later "variable is a secret" masking decision can live
//     here without round-tripping to Rust.
//
// File format: standard KEY=VALUE per line. Lines starting with
// `#` are comments; blank lines preserved on round-trip.
// ──────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::sidecar::SidecarState;

#[derive(Serialize, Deserialize, Clone)]
pub struct EnvVar {
    pub key: String,
    pub value: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EnvFile {
    /// Absolute path to the file.
    pub path: String,
    /// Filename only, e.g. ".env.local".
    pub filename: String,
    /// Ordered list of KEY=VALUE pairs. Comments + blanks are
    /// preserved during round-trip via `raw_lines`, but they
    /// are NOT in this list — the frontend only edits variables.
    pub variables: Vec<EnvVar>,
    /// True when the file is covered by a .gitignore rule.
    /// Best-effort: checks for a literal line match in any
    /// .gitignore between the file and the project root.
    pub gitignored: bool,
    /// Raw original lines, used to preserve comments + ordering
    /// that aren't represented in `variables`.
    pub raw_lines: Vec<String>,
}

fn parse_env_line(line: &str) -> Option<EnvVar> {
    let trimmed = line.trim_start();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }
    let (key, value) = trimmed.split_once('=')?;
    let key = key.trim().to_string();
    if key.is_empty() || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return None;
    }
    // Strip a single pair of surrounding quotes if present; otherwise keep
    // the raw value verbatim (including trailing whitespace stripped).
    let raw = value.trim_end_matches('\r');
    let stripped = if (raw.starts_with('"') && raw.ends_with('"') && raw.len() >= 2)
        || (raw.starts_with('\'') && raw.ends_with('\'') && raw.len() >= 2)
    {
        &raw[1..raw.len() - 1]
    } else {
        raw
    };
    Some(EnvVar {
        key,
        value: stripped.to_string(),
    })
}

fn is_gitignored(file: &Path, root: &Path) -> bool {
    let filename = match file.file_name().and_then(|n| n.to_str()) {
        Some(f) => f,
        None => return false,
    };
    // Walk from the file upwards looking for .gitignore files; return true
    // on first literal match. Doesn't try to be a full gitignore parser —
    // 99% of the time `.env.local` appears verbatim.
    let mut dir = file.parent();
    while let Some(d) = dir {
        let gi = d.join(".gitignore");
        if let Ok(content) = fs::read_to_string(&gi) {
            for raw in content.lines() {
                let line = raw.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                if line == filename
                    || line == format!(".env*")
                    || line == format!("*.env")
                    || line == format!("/{}", filename)
                {
                    return true;
                }
            }
        }
        if d == root {
            break;
        }
        dir = d.parent();
    }
    false
}

fn read_env_file(path: PathBuf, root: &Path) -> Option<EnvFile> {
    let filename = path.file_name()?.to_str()?.to_string();
    let content = fs::read_to_string(&path).ok()?;
    let raw_lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    let variables: Vec<EnvVar> = raw_lines
        .iter()
        .filter_map(|line| parse_env_line(line))
        .collect();
    Some(EnvFile {
        path: path.to_string_lossy().into_owned(),
        filename,
        variables,
        gitignored: is_gitignored(&path, root),
        raw_lines,
    })
}

#[tauri::command]
pub fn list_env_files(state: tauri::State<'_, SidecarState>) -> Result<Vec<EnvFile>, String> {
    let root = match state.current_root() {
        Some(r) => r,
        None => return Ok(Vec::new()),
    };
    let mut out = Vec::new();
    let entries = fs::read_dir(&root).map_err(|e| format!("read_dir: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        if !(name == ".env" || name.starts_with(".env.")) {
            continue;
        }
        if let Some(file) = read_env_file(path, &root) {
            out.push(file);
        }
    }
    out.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(out)
}

/// Replace the variable values for the file at `path` while preserving
/// any comments and blank lines from the original. Appends new
/// variables at the end. Writes atomically via a temp-file rename.
#[tauri::command]
pub fn save_env_file(
    state: tauri::State<'_, SidecarState>,
    path: String,
    variables: Vec<EnvVar>,
) -> Result<(), String> {
    let root = state
        .current_root()
        .ok_or_else(|| "no project root".to_string())?;
    let target = PathBuf::from(&path);
    // Safety: only allow writes within the open project root.
    let canon_root = root.canonicalize().map_err(|e| e.to_string())?;
    let canon_target = target
        .parent()
        .and_then(|p| p.canonicalize().ok())
        .ok_or_else(|| "invalid path".to_string())?;
    if !canon_target.starts_with(&canon_root) {
        return Err(format!(
            "refusing to write outside project root: {:?}",
            canon_target
        ));
    }

    // Read existing lines to preserve comments + key ordering.
    let existing = fs::read_to_string(&target).unwrap_or_default();
    let lines: Vec<String> = existing.lines().map(|s| s.to_string()).collect();

    // Build a map of the desired state for quick lookup.
    let mut desired: std::collections::BTreeMap<String, String> = variables
        .iter()
        .map(|v| (v.key.clone(), v.value.clone()))
        .collect();

    let mut out_lines: Vec<String> = Vec::new();
    for line in &lines {
        match parse_env_line(line) {
            Some(var) => {
                if let Some(new_val) = desired.remove(&var.key) {
                    out_lines.push(format!("{}={}", var.key, new_val));
                }
                // If key was removed from desired map, drop the line entirely.
            }
            None => out_lines.push(line.clone()),
        }
    }

    // Any keys left in `desired` are new — append at end.
    for (k, v) in desired {
        out_lines.push(format!("{}={}", k, v));
    }

    let mut final_content = out_lines.join("\n");
    if !final_content.ends_with('\n') {
        final_content.push('\n');
    }

    // Atomic write: temp file + rename.
    let tmp = target.with_extension(format!(
        "{}.0canvas-tmp",
        target
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("env")
    ));
    fs::write(&tmp, &final_content).map_err(|e| format!("write tmp: {}", e))?;
    fs::rename(&tmp, &target).map_err(|e| format!("rename: {}", e))?;
    Ok(())
}
