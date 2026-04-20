// ──────────────────────────────────────────────────────────
// Engine sidecar — spawn, track, shutdown
// ──────────────────────────────────────────────────────────
//
// The Node.js 0canvas engine runs as a child process of the
// Tauri shell. It binds a local WebSocket + HTTP server on
// 127.0.0.1:24193 (retries up to 24200) and writes the actual
// port to `<project_root>/.0canvas/.port` after binding.
//
// Phase 1A-2 implementation notes:
// - Uses std::process::Command to spawn `node dist-engine/cli.js`.
//   Phase 1A-3 swaps this for a Bun-compiled single-file binary
//   located in src-tauri/binaries/ for production bundles.
// - Port discovery polls `.0canvas/.port` for up to 10 seconds.
// - `shutdown()` MUST be called from the window-destroy handler,
//   otherwise the Node child outlives the Tauri window and eats
//   port 24193 on the next launch.
//
// ──────────────────────────────────────────────────────────

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

pub struct SidecarState {
    child: Mutex<Option<Child>>,
    port: Mutex<Option<u16>>,
    root: Mutex<Option<PathBuf>>,
}

impl SidecarState {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            port: Mutex::new(None),
            root: Mutex::new(None),
        }
    }

    pub fn current_port(&self) -> Option<u16> {
        *self.port.lock().unwrap()
    }

    pub fn current_root(&self) -> Option<PathBuf> {
        self.root.lock().unwrap().clone()
    }
}

/// Resolve where `dist-engine/cli.js` lives relative to the running binary.
///
/// Dev: `<repo>/src-tauri/target/debug/zerocanvas` → walk up 3 dirs → `<repo>/dist-engine/cli.js`.
/// Release (Phase 1A-3 replaces this logic with a bundled sidecar binary).
fn locate_engine_script() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {}", e))?;
    let mut dir = exe
        .parent()
        .ok_or_else(|| "current_exe has no parent".to_string())?
        .to_path_buf();
    // .../src-tauri/target/debug  ->  .../src-tauri/target  ->  .../src-tauri  ->  .../
    for _ in 0..3 {
        dir.pop();
    }
    let candidate = dir.join("dist-engine").join("cli.js");
    if candidate.exists() {
        Ok(candidate)
    } else {
        Err(format!(
            "dist-engine/cli.js not found at {:?}. Run `pnpm build:engine` first.",
            candidate
        ))
    }
}

/// Spawn the engine with `project_root` as its working directory.
/// Kills any previous child first, then polls for `<root>/.0canvas/.port`.
pub fn spawn_engine(state: &SidecarState, project_root: &Path) -> Result<u16, String> {
    // Kill any previous engine owned by this state.
    if let Some(mut prev) = state.child.lock().unwrap().take() {
        let _ = prev.kill();
        let _ = prev.wait();
    }
    *state.port.lock().unwrap() = None;

    let engine_js = locate_engine_script()?;

    // Remove any stale port file so we know the new one is genuinely written.
    let port_file = project_root.join(".0canvas").join(".port");
    let _ = fs::remove_file(&port_file);

    let child = Command::new("node")
        .arg(&engine_js)
        .arg("serve")
        .arg("--root")
        .arg(project_root)
        .arg("--port")
        .arg("24193")
        .current_dir(project_root)
        // Engine's startup logs go to the Tauri parent's stdout/stderr so they
        // surface in the `cargo tauri dev` terminal alongside Rust output.
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("spawn failed: {}", e))?;

    *state.child.lock().unwrap() = Some(child);
    *state.root.lock().unwrap() = Some(project_root.to_path_buf());

    // Poll for .0canvas/.port — engine writes it after binding.
    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        if let Ok(content) = fs::read_to_string(&port_file) {
            if let Ok(port) = content.trim().parse::<u16>() {
                *state.port.lock().unwrap() = Some(port);
                println!("[0canvas] engine ready on port {}", port);
                return Ok(port);
            }
        }
        thread::sleep(Duration::from_millis(100));
    }
    Err("engine did not bind within 10 seconds".into())
}

/// Kill the engine child cleanly. Idempotent.
pub fn shutdown(state: &SidecarState) {
    if let Some(mut child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
        println!("[0canvas] engine stopped");
    }
    *state.port.lock().unwrap() = None;
    *state.root.lock().unwrap() = None;
}
