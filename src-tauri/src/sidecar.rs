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

/// Resolve the Bun-compiled engine binary at runtime.
///
/// Layout differs between the dev tree and the bundled .app:
///
/// Dev:     `<repo>/src-tauri/binaries/0canvas-engine-<triple>`
///          (kept with the triple suffix — `pnpm build:sidecar` writes
///          the exact name Tauri expects to find for `externalBin`)
///
/// Release: `<App>.app/Contents/MacOS/0canvas-engine`
///          (Tauri STRIPS the `-<triple>` suffix during bundling on macOS
///          and Linux; Windows keeps it plus `.exe`. Ask me how I learned
///          this the hard way.)
///
/// We try every reasonable combination in release-first, dev-fallback
/// order so a mis-located binary fails with a clear error rather than
/// a silent "engine never connects" bug.
fn locate_engine_binary() -> Result<PathBuf, String> {
    let triple = match std::env::consts::ARCH {
        "aarch64" => "aarch64-apple-darwin",
        "x86_64" => "x86_64-apple-darwin",
        other => return Err(format!("unsupported arch: {}", other)),
    };

    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {}", e))?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| "current_exe has no parent".to_string())?
        .to_path_buf();

    // Order matters: check the release layout first because in a bundled
    // .app the dev path happens to NOT exist (exe_dir is inside the .app,
    // walking up doesn't reach <repo>/src-tauri/binaries).
    let candidates: [PathBuf; 3] = [
        // Release: .app/Contents/MacOS/0canvas-engine  (triple stripped)
        exe_dir.join("0canvas-engine"),
        // Also handle the pre-strip name in case Tauri behavior changes
        exe_dir.join(format!("0canvas-engine-{}", triple)),
        // Dev: <repo>/src-tauri/binaries/0canvas-engine-<triple>
        //      exe_dir is <repo>/src-tauri/target/debug → pop twice to src-tauri
        {
            let mut d = exe_dir.clone();
            d.pop();
            d.pop();
            d.push("binaries");
            d.push(format!("0canvas-engine-{}", triple));
            d
        },
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.clone());
        }
    }

    Err(format!(
        "engine binary not found. Tried:\n{}\nRun `pnpm build:sidecar` first.",
        candidates
            .iter()
            .map(|p| format!("  {:?}", p))
            .collect::<Vec<_>>()
            .join("\n")
    ))
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

    let engine_bin = locate_engine_binary()?;

    // Remove any stale port file so we know the new one is genuinely written.
    let port_file = project_root.join(".0canvas").join(".port");
    let _ = fs::remove_file(&port_file);

    let child = Command::new(&engine_bin)
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
