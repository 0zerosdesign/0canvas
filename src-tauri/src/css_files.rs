// ──────────────────────────────────────────────────────────
// CSS / Theme file I/O — bypasses the File System Access API
// for the Mac app's Themes page.
// ──────────────────────────────────────────────────────────
//
// Three Tauri commands that let themes-page.tsx:
//   - open a .css file via the native file picker,
//   - read its content on demand (triggered by engine's
//     CSS_FILE_CHANGED events so external edits propagate in),
//   - write back atomically when the user saves tokens.
//
// Path safety: read/write are refused for anything outside the
// currently-open project root. The picker itself respects macOS
// sandbox rules — the user explicitly grants access by picking
// a file — so we don't try to path-gate it.
// ──────────────────────────────────────────────────────────

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::sidecar::SidecarState;

#[derive(Serialize, Clone)]
pub struct CssFile {
    pub path: String,
    pub name: String,
    pub content: String,
}

fn path_inside_root(target: &Path, root: &Path) -> bool {
    match (target.canonicalize(), root.canonicalize()) {
        (Ok(t), Ok(r)) => t.starts_with(&r),
        _ => false,
    }
}

#[tauri::command]
pub async fn pick_css_file(app: AppHandle) -> Result<Option<CssFile>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("CSS files", &["css"])
        .pick_file(move |result| {
            let _ = tx.send(result);
        });
    let picked = rx.await.map_err(|e| e.to_string())?;
    let Some(file_path) = picked else {
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|e| format!("invalid path: {}", e))?;
    let content = fs::read_to_string(&path).map_err(|e| format!("read: {}", e))?;
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("theme.css")
        .to_string();
    Ok(Some(CssFile {
        path: path.to_string_lossy().into_owned(),
        name,
        content,
    }))
}

#[tauri::command]
pub fn read_css_file(
    state: tauri::State<'_, SidecarState>,
    path: String,
) -> Result<String, String> {
    let root = state
        .current_root()
        .ok_or_else(|| "no project root".to_string())?;
    let target = PathBuf::from(&path);
    if !path_inside_root(&target, &root) {
        return Err(format!("refusing to read outside project root: {}", path));
    }
    fs::read_to_string(&target).map_err(|e| format!("read: {}", e))
}

#[tauri::command]
pub fn write_css_file(
    state: tauri::State<'_, SidecarState>,
    path: String,
    content: String,
) -> Result<(), String> {
    let root = state
        .current_root()
        .ok_or_else(|| "no project root".to_string())?;
    let target = PathBuf::from(&path);
    if !path_inside_root(&target, &root) {
        return Err(format!("refusing to write outside project root: {}", path));
    }
    // Atomic write via sibling temp file + rename.
    let tmp = target.with_extension(format!(
        "{}.zeros-tmp",
        target
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("css")
    ));
    fs::write(&tmp, content).map_err(|e| format!("write tmp: {}", e))?;
    fs::rename(&tmp, &target).map_err(|e| format!("rename: {}", e))?;
    Ok(())
}
