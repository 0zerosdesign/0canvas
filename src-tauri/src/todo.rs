// ──────────────────────────────────────────────────────────
// Todo — markdown-backed list at .0canvas/todo.md
// ──────────────────────────────────────────────────────────
//
// Intentionally minimal. The source of truth is a plain
// markdown file the user (or an agent, once Phase 4 lands)
// can also edit directly. We parse `- [ ]` / `- [x]` lines
// as actionable items; every other line is preserved verbatim
// on round-trip so headings, blank lines, and notes survive.
// ──────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::sidecar::SidecarState;

#[derive(Serialize, Deserialize, Clone)]
pub struct TodoItem {
    /// 0-based index of the line in the source file.
    pub line: usize,
    /// True for `- [x]`, false for `- [ ]`.
    pub done: bool,
    pub text: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TodoFile {
    /// Absolute path to `.0canvas/todo.md`.
    pub path: String,
    pub raw: String,
    pub items: Vec<TodoItem>,
}

fn todo_path(root: &PathBuf) -> PathBuf {
    root.join(".0canvas").join("todo.md")
}

/// Very simple checkbox-line parser. Accepts:
///   "- [ ] task"   → { done:false, text:"task" }
///   "- [x] task"   → { done:true,  text:"task" }
///   "* [X] task"   → same as above (case-insensitive x, allows *)
/// Leading whitespace is preserved as-is when writing back but NOT
/// shown in the text field — the UI would otherwise drift indent on
/// every edit.
fn parse_todo_line(line: &str, idx: usize) -> Option<TodoItem> {
    let trimmed = line.trim_start();
    let bytes = trimmed.as_bytes();
    if bytes.len() < 6 {
        return None;
    }
    // `- ` or `* `
    let (_marker, rest) = if trimmed.starts_with("- ") {
        ("-", &trimmed[2..])
    } else if trimmed.starts_with("* ") {
        ("*", &trimmed[2..])
    } else {
        return None;
    };
    if !rest.starts_with('[') {
        return None;
    }
    // `[ ]` or `[x]` or `[X]`
    let inner = rest.chars().nth(1)?;
    let done = match inner {
        ' ' => false,
        'x' | 'X' => true,
        _ => return None,
    };
    if rest.chars().nth(2) != Some(']') {
        return None;
    }
    let after = rest[3..].trim_start();
    Some(TodoItem {
        line: idx,
        done,
        text: after.to_string(),
    })
}

#[tauri::command]
pub fn load_todo_file(state: tauri::State<'_, SidecarState>) -> Result<TodoFile, String> {
    let root = state
        .current_root()
        .ok_or_else(|| "no project root".to_string())?;
    let path = todo_path(&root);

    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => String::new(), // file doesn't exist yet; treat as empty
    };
    let items: Vec<TodoItem> = raw
        .lines()
        .enumerate()
        .filter_map(|(i, line)| parse_todo_line(line, i))
        .collect();

    Ok(TodoFile {
        path: path.to_string_lossy().into_owned(),
        raw,
        items,
    })
}

/// Write the full markdown back. The frontend sends the complete raw
/// content so we don't have to guess about whitespace / comments.
#[tauri::command]
pub fn save_todo_file(state: tauri::State<'_, SidecarState>, raw: String) -> Result<(), String> {
    let root = state
        .current_root()
        .ok_or_else(|| "no project root".to_string())?;
    let path = todo_path(&root);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create_dir_all: {}", e))?;
    }

    let mut content = raw;
    if !content.ends_with('\n') {
        content.push('\n');
    }

    let tmp = path.with_extension("md.0canvas-tmp");
    fs::write(&tmp, &content).map_err(|e| format!("write tmp: {}", e))?;
    fs::rename(&tmp, &path).map_err(|e| format!("rename: {}", e))?;
    Ok(())
}
