// ──────────────────────────────────────────────────────────
// Zeros — Tauri Rust core
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

mod ai_cli;
mod css_files;
mod env_files;
mod git;
mod localhost;
mod secrets;
mod sidecar;
mod skills;
mod todo;

use ai_cli::AiCliState;
use sidecar::SidecarState;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_deep_link::DeepLinkExt;
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

/// Open an external URL in the user's default browser. Used by Phase 3's
/// "Open PR on GitHub" button and similar affordances. Scoped to http(s)
/// only so a rogue caller can't spawn `open -a ...` style actions.
#[tauri::command]
fn shell_open_url(url: String) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return Err("only http(s) URLs are allowed".into());
    }
    std::process::Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| format!("open: {}", e))?;
    Ok(())
}

/// Open macOS Finder with the given path selected.
#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("path does not exist: {}", path));
    }
    std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("open: {}", e))?;
    Ok(())
}

/// Launch macOS Terminal.app at the given directory.
#[tauri::command]
fn open_in_terminal(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("path does not exist: {}", path));
    }
    if !p.is_dir() {
        return Err(format!("not a directory: {}", path));
    }
    std::process::Command::new("open")
        .arg("-a")
        .arg("Terminal")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("open: {}", e))?;
    Ok(())
}

/// Spawn the engine sidecar against a freshly-cloned repository and emit
/// `project-changed`. Used by the Phase 3-F clone flow — the UI invokes
/// `git_clone`, then hands the path here to finalise.
#[tauri::command]
async fn open_cloned_project(
    app: AppHandle,
    path: String,
) -> Result<ProjectChanged, String> {
    open_project_folder_path(app, path).await
}

#[tauri::command]
fn get_engine_root(state: tauri::State<'_, SidecarState>) -> Option<String> {
    state
        .current_root()
        .map(|p| p.to_string_lossy().into_owned())
}

/// Run an agent-install shell command in the user's Terminal app. We don't
/// spawn `npm install -g` directly — it may need the user's shell env
/// (nvm, homebrew paths) and they want to see the output. Opening a real
/// terminal window is both reliable and transparent.
///
/// The caller passes the raw shell line (e.g. `npm install -g <pkg>`).
/// We don't parse or rewrite it — this runs exactly what the registry
/// metadata suggests. Rejected if the command contains shell metacharacters
/// beyond what's needed for known install recipes, so a compromised
/// registry can't exfil data via `; curl ...`.
#[tauri::command]
fn open_install_terminal(command: String) -> Result<(), String> {
    // Allow-list the set of characters that show up in legitimate install
    // commands: `npm install -g @scope/pkg`, `uv tool install …`,
    // `curl -fsSL https://… | sh`, `brew install …`. Reject anything else.
    if command.is_empty() || command.len() > 512 {
        return Err("invalid install command".into());
    }
    let allowed = |c: char| {
        c.is_ascii_alphanumeric()
            || matches!(
                c,
                ' ' | '-'
                    | '_'
                    | '.'
                    | '/'
                    | ':'
                    | '@'
                    | '='
                    | '|'
                    | '+'
                    | ','
            )
    };
    if !command.chars().all(allowed) {
        return Err("install command contains disallowed characters".into());
    }

    #[cfg(target_os = "macos")]
    {
        // Escape double-quotes for AppleScript embedding.
        let escaped = command.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            r#"tell application "Terminal"
    activate
    do script "{cmd}"
end tell"#,
            cmd = escaped
        );
        std::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .spawn()
            .map_err(|e| format!("osascript: {}", e))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        for term in &["gnome-terminal", "konsole", "xterm"] {
            if std::process::Command::new(term)
                .arg("--")
                .arg("bash")
                .arg("-lc")
                .arg(&command)
                .spawn()
                .is_ok()
            {
                return Ok(());
            }
        }
        return Err("no supported terminal emulator found".into());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "cmd", "/K", &command])
            .spawn()
            .map_err(|e| format!("cmd start: {}", e))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("unsupported platform".into())
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

/// Phase 2-D — open a specific folder path without showing the dialog.
/// Used by the Workspace Manager's "recent projects" list. Emits the
/// same `project-changed` event as `open_project_folder` so downstream
/// wiring stays uniform.
#[tauri::command]
async fn open_project_folder_path(
    app: AppHandle,
    path: String,
) -> Result<ProjectChanged, String> {
    let folder_path = PathBuf::from(&path);
    if !folder_path.exists() {
        return Err(format!("folder does not exist: {}", path));
    }
    if !folder_path.is_dir() {
        return Err(format!("not a directory: {}", path));
    }

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
    Ok(payload)
}

/// Parse a `zeros://…` URL and trigger the matching action.
/// Supported forms today:
///   zeros://open?path=/absolute/path/to/project
///
/// Unknown actions are forwarded to the webview as `deep-link` events
/// so frontend code can handle them without a Rust-side rebuild.
fn handle_deep_link(app: &AppHandle, url: tauri::Url) {
    println!("[Zeros] deep link: {}", url);
    let host = url.host_str().unwrap_or("");
    // tauri::Url exposes url.path() too but the "open" action lives
    // in host (zeros://open?...) because there's no //user part.
    let action = if !host.is_empty() {
        host.to_string()
    } else {
        url.path().trim_matches('/').to_string()
    };

    if action == "open" {
        // Pull path= from the query string.
        let path = url
            .query_pairs()
            .find(|(k, _)| k == "path")
            .map(|(_, v)| v.into_owned());
        if let Some(path) = path {
            let app_clone = app.clone();
            let spawn_path = PathBuf::from(path.clone());
            tauri::async_runtime::spawn(async move {
                let state_app = app_clone.clone();
                let result = tauri::async_runtime::spawn_blocking(move || {
                    let state = state_app.state::<SidecarState>();
                    sidecar::spawn_engine(&state, &spawn_path)
                })
                .await;
                match result {
                    Ok(Ok(port)) => {
                        let payload = ProjectChanged {
                            root: path,
                            port,
                        };
                        let _ = app_clone.emit("project-changed", payload);
                    }
                    Ok(Err(err)) => eprintln!("[Zeros] deep-link spawn failed: {}", err),
                    Err(err) => eprintln!("[Zeros] deep-link join failed: {}", err),
                }
            });
            return;
        }
    }

    // Fallback: emit to webview.
    let _ = app.emit("deep-link", url.to_string());
}

/// Resolve the initial project root. Cases in priority order:
///
/// 1. `cargo tauri dev` launches with CWD = `<repo>/src-tauri`; walk up one
///    so the engine operates on the repo itself (Phase 1A-1/1A-2 workflow).
/// 2. `open Zeros.app` from Finder launches with CWD = `/`; indexing `/`
///    is useless and slow. Fall back to `$HOME` — the user will replace it
///    via Cmd+O on first use.
/// 3. Anywhere else (e.g. `./Zeros.app/Contents/MacOS/zeros`), use
///    the CWD as-is because the launcher probably meant something by it.
fn default_project_root() -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    // Dev-tree heuristic
    if cwd.file_name().map(|n| n == "src-tauri").unwrap_or(false) {
        return cwd.parent().map(|p| p.to_path_buf()).unwrap_or(cwd);
    }

    // Launched from Finder / Dock → CWD is filesystem root, which is
    // never a sensible project directory. Fall back to $HOME so the
    // engine has a bounded, readable tree until the user opens a folder.
    if cwd == PathBuf::from("/") {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home);
        }
    }

    cwd
}

fn build_app_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    // macOS app menu: Zeros (app name), File, Edit, View, Window, Help
    // All standard PredefinedMenuItems; dynamic items (Open Folder, Toggle
    // Columns) land in Phase 1A-2c / 1B with their own handlers.

    let app_menu = Submenu::with_items(
        app,
        "Zeros",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Zeros"), None)?,
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
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(SidecarState::new())
        .manage(AiCliState::new())
        .invoke_handler(tauri::generate_handler![
            get_engine_port,
            get_engine_root,
            open_install_terminal,
            open_project_folder,
            open_project_folder_path,
            localhost::discover_localhost_services,
            env_files::list_env_files,
            env_files::save_env_file,
            todo::load_todo_file,
            todo::save_todo_file,
            css_files::pick_css_file,
            css_files::read_css_file,
            css_files::write_css_file,
            git::git_status,
            git::git_stage_file,
            git::git_unstage_file,
            git::git_stage_all,
            git::git_unstage_all,
            git::git_commit,
            git::git_push,
            git::git_pull,
            git::git_diff_file,
            git::git_log_recent,
            git::git_branch_list,
            git::git_branch_switch,
            git::git_branch_create,
            git::git_branch_delete,
            git::git_suggest_commit_message,
            git::git_remote_url,
            git::git_discard_file,
            git::git_file_at_head,
            git::git_clone,
            git::git_worktree_list,
            git::git_worktree_add,
            git::git_worktree_remove,
            git::git_conflict_list,
            git::git_resolve_file_ours,
            git::git_resolve_file_theirs,
            git::git_revert_commit,
            git::git_reset_hard,
            git::git_push_force,
            shell_open_url,
            reveal_in_finder,
            open_in_terminal,
            open_cloned_project,
            ai_cli::ai_cli_check,
            ai_cli::ai_cli_is_authenticated,
            ai_cli::ai_cli_cancel,
            ai_cli::ai_cli_run_login,
            ai_cli::claude_spawn,
            ai_cli::codex_spawn,
            skills::skills_list,
            secrets::keychain_set,
            secrets::keychain_get,
            secrets::keychain_delete,
        ])
        .setup(|app| {
            // Spawn the engine before the webview tries to connect. If it
            // fails we log and continue — the webview will simply show a
            // disconnected state, which is a better error than a blank app.
            let state = app.state::<SidecarState>();
            let root = default_project_root();
            match sidecar::spawn_engine(&state, &root) {
                Ok(port) => println!("[Zeros] engine spawned on port {} at {:?}", port, root),
                Err(err) => eprintln!("[Zeros] engine spawn failed: {}", err),
            }

            // Crash watchdog: polls the engine's TCP port and respawns
            // after three consecutive failed probes. Lives for the life
            // of the process; `sidecar::shutdown` sets the stop flag so
            // it doesn't race against the clean-quit shutdown.
            sidecar::start_watchdog(&state, app.handle().clone());

            // Phase 2-F: listen for zeros:// deep links. We support
            // `zeros://open?path=/Users/...` (open a known folder)
            // and pass everything else through to the webview as-is via
            // the `deep-link` event, in case JS wants to handle custom
            // paths later.
            let deep_link_app = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    handle_deep_link(&deep_link_app, url);
                }
            });

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
                            eprintln!("[Zeros] open_folder menu error: {}", err);
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
        .expect("error while running Zeros");
}
