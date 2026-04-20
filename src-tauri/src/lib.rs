// ──────────────────────────────────────────────────────────
// 0canvas — Tauri Rust core
// ──────────────────────────────────────────────────────────
//
// Phase 1A-2 wiring:
//   - Spawn the Node engine as a sidecar on app startup.
//   - Kill the engine when the main window is destroyed so we
//     never leak a background Node process.
//   - Expose `get_engine_port` as a Tauri command for the
//     webview's WebSocket bridge to call when it can't find the
//     port injected by Tauri (Phase 1A-3 replaces polling with
//     a proper initialization_script injection).
//
// Later phases layer on top without changing this file's shape:
//   1A-2c  Open Folder dialog → dispatch respawn with new root
//   1A-3   Bun-compiled engine sidecar + initialization_script
//   Phase 1C   tauri-plugin-pty + xterm.js
//   Phase 2    macOS keychain via security-framework
//   Phase 3    git2-rs IPC commands
//   Phase 4    shell::spawn for claude-code / codex / gh
//
// ──────────────────────────────────────────────────────────

mod sidecar;

use sidecar::SidecarState;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_dialog::DialogExt;

/// Shape emitted to the webview whenever the active project root changes.
/// The frontend's BridgeProvider listens for `project-changed` to reconnect
/// the WebSocket against the new engine (same port, different cwd/root).
#[derive(Clone, Serialize)]
struct ProjectChanged {
    root: String,
    port: u16,
}

#[tauri::command]
fn get_engine_port(state: tauri::State<'_, SidecarState>) -> Option<u16> {
    state.current_port()
}

#[tauri::command]
fn get_engine_root(state: tauri::State<'_, SidecarState>) -> Option<String> {
    state
        .current_root()
        .map(|p| p.to_string_lossy().into_owned())
}

/// Open the system directory picker; if the user picks a folder, restart the
/// engine rooted there and emit `project-changed` to the webview.
#[tauri::command]
async fn open_project_folder(app: AppHandle) -> Result<Option<ProjectChanged>, String> {
    // The dialog plugin's pick_folder is callback-based; bridge it to an
    // async channel so we can await the user's selection inside a command.
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |result| {
        let _ = tx.send(result);
    });
    let selection = rx.await.map_err(|e| e.to_string())?;

    let Some(folder) = selection else {
        // User cancelled the dialog — not an error, just nothing happened.
        return Ok(None);
    };
    let folder_path = folder
        .into_path()
        .map_err(|e| format!("invalid folder path: {}", e))?;

    // Run the (blocking) spawn_engine off the async runtime so we don't
    // stall the Tauri command worker while Node boots.
    let state_app = app.clone();
    let spawn_path = folder_path.clone();
    let port = tauri::async_runtime::spawn_blocking(move || {
        let state = state_app.state::<SidecarState>();
        sidecar::spawn_engine(&state, &spawn_path)
    })
    .await
    .map_err(|e| format!("spawn_blocking join: {}", e))??;

    let payload = ProjectChanged {
        root: folder_path.to_string_lossy().into_owned(),
        port,
    };
    app.emit("project-changed", payload.clone())
        .map_err(|e| format!("emit project-changed: {}", e))?;
    Ok(Some(payload))
}

/// Resolve the initial project root. In `cargo tauri dev` the CWD is
/// `<repo>/src-tauri`; we walk up one directory so the engine operates on
/// the repo itself. Phase 1A-2c replaces this with the folder the user
/// picks via the Open Folder dialog.
fn default_project_root() -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    if cwd.file_name().map(|n| n == "src-tauri").unwrap_or(false) {
        cwd.parent().map(|p| p.to_path_buf()).unwrap_or(cwd)
    } else {
        cwd
    }
}

fn build_app_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    // macOS app menu: 0canvas (app name), File, Edit, View, Window, Help
    // All standard PredefinedMenuItems; dynamic items (Open Folder, Toggle
    // Columns) land in Phase 1A-2c / 1B with their own handlers.

    let app_menu = Submenu::with_items(
        app,
        "0canvas",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About 0canvas"), None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(
                app,
                "open_folder",
                "Open Folder…",
                true,
                Some("CmdOrCtrl+O"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[&PredefinedMenuItem::fullscreen(app, None)?],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
        ],
    )?;

    Menu::with_items(
        app,
        &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu],
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(SidecarState::new())
        .invoke_handler(tauri::generate_handler![
            get_engine_port,
            get_engine_root,
            open_project_folder,
        ])
        .setup(|app| {
            // Spawn the engine before the webview tries to connect. If it
            // fails we log and continue — the webview will simply show a
            // disconnected state, which is a better error than a blank app.
            let state = app.state::<SidecarState>();
            let root = default_project_root();
            match sidecar::spawn_engine(&state, &root) {
                Ok(port) => println!("[0canvas] engine spawned on port {} at {:?}", port, root),
                Err(err) => eprintln!("[0canvas] engine spawn failed: {}", err),
            }

            let menu = build_app_menu(app.handle())?;
            app.set_menu(menu)?;

            // File > Open Folder… click → run the same command the webview
            // can invoke directly, so there's one code path for both entry
            // points.
            app.on_menu_event(|app_handle, event| {
                if event.id() == "open_folder" {
                    let handle = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(err) = open_project_folder(handle).await {
                            eprintln!("[0canvas] open_folder menu error: {}", err);
                        }
                    });
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Destroyed) {
                let state = window.state::<SidecarState>();
                sidecar::shutdown(&state);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running 0canvas");
}
