// ──────────────────────────────────────────────────────────
// 0canvas — Tauri Rust core (Phase 1A-1 scaffold)
// ──────────────────────────────────────────────────────────
//
// This file currently only boots a webview pointing at the
// Vite dev server (dev) or the bundled frontend (release).
// In subsequent sub-phases this module gains:
//
//   1A-2   sidecar spawn for the Node/Bun engine
//          (tauri::async_runtime + Command::sidecar)
//   1A-3   file dialog, open folder, project switching
//   Phase 1C  tauri-plugin-pty registration + terminal sessions
//   Phase 2   macOS keychain via security-framework
//   Phase 3   git2-rs IPC commands
//   Phase 4   shell::spawn for claude-code / codex / gh
//
// ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            // Phase 1A-2 will: start the Node sidecar here, discover its
            // actual port (retry range 24193–24200), and inject
            // window.__0CANVAS_PORT__ into the webview via
            // app.get_webview_window("main").eval(...) before show.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running 0canvas");
}
