// ──────────────────────────────────────────────────────────
// Engine sidecar — spawn, track, shutdown, crash watchdog
// ──────────────────────────────────────────────────────────
//
// The Node.js Zeros engine runs as a child process of the
// Tauri shell. It binds a local WebSocket + HTTP server on
// 127.0.0.1:24193 (retries up to 24200) and writes the actual
// port to `<project_root>/.zeros/.port` after binding.
//
// Crash recovery: a lightweight watchdog task polls a TCP
// connection against the bound port every 2 s. If the port
// stops responding for three consecutive probes, we respawn
// the engine with the last-known project root and emit an
// `engine-restarted { port }` event so the webview can drop
// cached state that assumed the old process.
//
// `shutdown()` MUST be called from the window-destroy handler,
// otherwise the Node child outlives the Tauri window and eats
// port 24193 on the next launch.
//
// ──────────────────────────────────────────────────────────

use std::fs;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};

struct SidecarInner {
    child: Mutex<Option<Child>>,
    port: Mutex<Option<u16>>,
    root: Mutex<Option<PathBuf>>,
    /// Set to true by `shutdown()` so the watchdog stops respawning.
    shutting_down: Mutex<bool>,
    /// Bumped every successful spawn. The watchdog captures it at launch
    /// and bails if the counter moves — that means another spawn replaced
    /// the child this task was watching.
    spawn_generation: Mutex<u64>,
}

pub struct SidecarState {
    inner: Arc<SidecarInner>,
}

impl SidecarState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(SidecarInner {
                child: Mutex::new(None),
                port: Mutex::new(None),
                root: Mutex::new(None),
                shutting_down: Mutex::new(false),
                spawn_generation: Mutex::new(0),
            }),
        }
    }

    pub fn current_port(&self) -> Option<u16> {
        *self.inner.port.lock().unwrap()
    }

    pub fn current_root(&self) -> Option<PathBuf> {
        self.inner.root.lock().unwrap().clone()
    }
}

/// Resolve the Bun-compiled engine binary at runtime.
///
/// Layout differs between the dev tree and the bundled .app:
///
/// Dev:     `<repo>/src-tauri/binaries/zeros-engine-<triple>`
/// Release: `<App>.app/Contents/MacOS/zeros-engine`
///          (Tauri STRIPS the `-<triple>` suffix on macOS/Linux.)
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

    let candidates: [PathBuf; 3] = [
        exe_dir.join("zeros-engine"),
        exe_dir.join(format!("zeros-engine-{}", triple)),
        {
            let mut d = exe_dir.clone();
            d.pop();
            d.pop();
            d.push("binaries");
            d.push(format!("zeros-engine-{}", triple));
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

fn port_reachable(port: u16) -> bool {
    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), port);
    TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
}

/// Spawn the engine with `project_root` as its working directory.
/// Kills any previous child first, then polls for `<root>/.zeros/.port`.
pub fn spawn_engine(state: &SidecarState, project_root: &Path) -> Result<u16, String> {
    spawn_engine_impl(&state.inner, project_root)
}

fn spawn_engine_impl(inner: &Arc<SidecarInner>, project_root: &Path) -> Result<u16, String> {
    // Kill any previous engine owned by this state.
    if let Some(mut prev) = inner.child.lock().unwrap().take() {
        let _ = prev.kill();
        let _ = prev.wait();
    }
    *inner.port.lock().unwrap() = None;

    let engine_bin = locate_engine_binary()?;

    let port_file = project_root.join(".zeros").join(".port");
    let _ = fs::remove_file(&port_file);

    let child = Command::new(&engine_bin)
        .arg("serve")
        .arg("--root")
        .arg(project_root)
        .arg("--port")
        .arg("24193")
        .current_dir(project_root)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("spawn failed: {}", e))?;

    *inner.child.lock().unwrap() = Some(child);
    *inner.root.lock().unwrap() = Some(project_root.to_path_buf());
    // Bumping the generation invalidates any in-flight watchdog loop that
    // was watching a previous spawn.
    {
        let mut gen = inner.spawn_generation.lock().unwrap();
        *gen = gen.wrapping_add(1);
    }

    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        if let Ok(content) = fs::read_to_string(&port_file) {
            if let Ok(port) = content.trim().parse::<u16>() {
                *inner.port.lock().unwrap() = Some(port);
                println!("[Zeros] engine ready on port {}", port);
                return Ok(port);
            }
        }
        thread::sleep(Duration::from_millis(100));
    }
    Err("engine did not bind within 10 seconds".into())
}

/// Kill the engine child cleanly. Idempotent. Flips `shutting_down` so the
/// watchdog stops respawning.
pub fn shutdown(state: &SidecarState) {
    *state.inner.shutting_down.lock().unwrap() = true;
    if let Some(mut child) = state.inner.child.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
        println!("[Zeros] engine stopped");
    }
    *state.inner.port.lock().unwrap() = None;
    *state.inner.root.lock().unwrap() = None;
}

/// Start the watchdog task. Call once from setup; it runs for the life of
/// the process. Every 2 s it probes the bound port over TCP; three
/// consecutive failures trigger a respawn at the last known project root
/// and an `engine-restarted` event with the new port.
pub fn start_watchdog(state: &SidecarState, app: AppHandle) {
    let inner = state.inner.clone();

    thread::spawn(move || {
        // How many consecutive unreachable probes trigger a respawn.
        const FAIL_THRESHOLD: u32 = 3;
        const POLL_INTERVAL: Duration = Duration::from_secs(2);

        let mut fails: u32 = 0;

        loop {
            thread::sleep(POLL_INTERVAL);
            if *inner.shutting_down.lock().unwrap() {
                return;
            }

            let port = *inner.port.lock().unwrap();
            let Some(port) = port else {
                // No port recorded — probably never spawned, nothing to
                // monitor yet.
                fails = 0;
                continue;
            };

            if port_reachable(port) {
                fails = 0;
                continue;
            }

            fails += 1;
            if fails < FAIL_THRESHOLD {
                continue;
            }

            // Three strikes — respawn at the recorded root.
            let root = inner.root.lock().unwrap().clone();
            let Some(root) = root else {
                // No root recorded, can't respawn. Back off.
                fails = 0;
                continue;
            };

            eprintln!(
                "[Zeros] engine unreachable on port {} after {} probes; respawning",
                port, FAIL_THRESHOLD
            );
            fails = 0;
            match spawn_engine_impl(&inner, &root) {
                Ok(new_port) => {
                    println!("[Zeros] watchdog respawned engine on port {}", new_port);
                    let _ = app.emit("engine-restarted", new_port);
                }
                Err(err) => {
                    eprintln!("[Zeros] watchdog respawn failed: {}", err);
                }
            }
        }
    });
}
