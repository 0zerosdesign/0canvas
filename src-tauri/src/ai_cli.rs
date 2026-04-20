// ──────────────────────────────────────────────────────────
// Phase 4 — AI CLI subprocess bridge
// ──────────────────────────────────────────────────────────
//
// Spawn the user's officially-installed `claude` or `codex`
// CLI and stream its stdout back to the webview. The user is
// responsible for having run `claude login` / `codex login`
// themselves — we never touch their OAuth tokens, never spoof
// the harness user-agent. This is the Zed / Xcode pattern and
// the only path that survived Anthropic's April 2026 third-
// party cutoff.
//
// Output is NDJSON (one JSON object per line). We parse each
// line into a discriminated "ai-stream-event" that the React
// chat panel subscribes to.
// ──────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

use crate::sidecar::SidecarState;

// ── Session registry ──────────────────────────────────────
//
// Each chat turn gets a session id so the frontend can cancel
// in-flight generation. We hold the Child in a Mutex so kill()
// can be called from any command handler.

#[derive(Default)]
pub struct AiCliState {
    sessions: Mutex<HashMap<String, Child>>,
}

impl AiCliState {
    pub fn new() -> Self {
        Self::default()
    }
}

// ── Event shape ────────────────────────────────────────────
//
// What the webview receives for every streamed chunk. `kind`
// is a discriminator the frontend switches on.

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiStreamEvent {
    pub session_id: String,
    pub kind: String,
    /// Text delta (when kind == "text"), tool name (when "tool"),
    /// error message (when "error"), resume session id (when "session").
    pub content: Option<String>,
    /// JSON blob for tool inputs / arbitrary metadata — passed
    /// through as-is so the frontend can inspect without another
    /// round-trip.
    pub data: Option<serde_json::Value>,
}

fn emit(app: &AppHandle, ev: AiStreamEvent) {
    let _ = app.emit("ai-stream-event", ev);
}

// ── Claude CLI ─────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ClaudeSpawnArgs {
    pub session_id: String,
    pub prompt: String,
    pub model: Option<String>,
    pub resume_id: Option<String>,
    /// low / medium / high / xhigh — maps to Claude's --effort flag.
    pub effort: Option<String>,
    pub system_prompt: Option<String>,
}

/// `which`-style probe for the user's installed CLI. Returns the
/// absolute path when present, None otherwise. The frontend uses
/// this to show "claude not installed — run `brew install anthropic/…`"
/// style hints before the user hits send.
#[tauri::command]
pub fn ai_cli_check(binary: String) -> Option<String> {
    which::which(&binary)
        .ok()
        .map(|p| p.to_string_lossy().into_owned())
}

/// Best-effort check for whether the user has completed `<cli> login`.
/// We never read the tokens — only look for filesystem evidence that
/// the official CLI has been authenticated. Safe to poll on a short
/// interval.
///
/// Storage differs between the two CLIs:
///
///   * Claude Code stores the OAuth token in the macOS keychain under
///     service "Claude Code-credentials", not a file. What it *does*
///     put on disk after a successful login is ~/.claude/settings.json
///     (plus sessions, history, projects). We treat the settings file
///     or a non-empty sessions/ as the "signed in" signal.
///
///   * codex writes ~/.codex/auth.json with the cached token, so the
///     presence of that file is a tight signal.
#[tauri::command]
pub fn ai_cli_is_authenticated(binary: String) -> bool {
    let Ok(home) = std::env::var("HOME") else {
        return false;
    };
    let home = std::path::PathBuf::from(home);
    match binary.as_str() {
        "claude" => {
            let dir = home.join(".claude");
            // Newer claude-code: credentials live in macOS keychain;
            // the on-disk trail is settings.json / sessions/ / projects/.
            // Older builds did write .credentials.json, so keep both
            // paths covered.
            if dir.join(".credentials.json").exists() {
                return true;
            }
            if dir.join("settings.json").exists() {
                return true;
            }
            // Any non-empty sessions/ or projects/ directory means the
            // user has successfully run Claude Code at least once —
            // those dirs are only created post-auth.
            for sub in ["sessions", "projects", "history.jsonl"] {
                let p = dir.join(sub);
                if p.exists() {
                    return true;
                }
            }
            false
        }
        "codex" => {
            home.join(".codex").join("auth.json").exists()
        }
        _ => false,
    }
}

#[tauri::command]
pub async fn claude_spawn(
    app: AppHandle,
    state: tauri::State<'_, AiCliState>,
    sidecar: tauri::State<'_, SidecarState>,
    args: ClaudeSpawnArgs,
) -> Result<(), String> {
    let cwd = sidecar
        .current_root()
        .ok_or_else(|| "no project root".to_string())?;

    let mut cmd = Command::new("claude");
    cmd.arg("-p")
        .arg(&args.prompt)
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose")
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    if let Some(model) = &args.model {
        cmd.arg("--model").arg(model);
    }
    if let Some(resume) = &args.resume_id {
        cmd.arg("--resume").arg(resume);
    }
    if let Some(system) = &args.system_prompt {
        cmd.arg("--system-prompt").arg(system);
    }
    if let Some(effort) = &args.effort {
        // The flag is called --effort on newer Claude CLI builds.
        cmd.arg("--effort").arg(effort);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("spawn claude: {} (is the claude CLI installed?)", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "no stdout handle".to_string())?;
    let stderr = child.stderr.take();

    state
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .insert(args.session_id.clone(), child);

    spawn_stream_reader(app.clone(), args.session_id.clone(), stdout, "claude".into());
    if let Some(err) = stderr {
        spawn_stderr_reader(app, args.session_id, err);
    }
    Ok(())
}

// ── Codex CLI ──────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CodexSpawnArgs {
    pub session_id: String,
    pub prompt: String,
    pub model: Option<String>,
    pub resume_id: Option<String>,
    pub effort: Option<String>,
}

#[tauri::command]
pub async fn codex_spawn(
    app: AppHandle,
    state: tauri::State<'_, AiCliState>,
    sidecar: tauri::State<'_, SidecarState>,
    args: CodexSpawnArgs,
) -> Result<(), String> {
    let cwd = sidecar
        .current_root()
        .ok_or_else(|| "no project root".to_string())?;

    let mut cmd = Command::new("codex");
    if let Some(resume) = &args.resume_id {
        cmd.arg("exec").arg("resume").arg(resume);
    } else {
        cmd.arg("exec");
    }
    cmd.arg(&args.prompt)
        .arg("--json")
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    if let Some(model) = &args.model {
        cmd.arg("--model").arg(model);
    }
    if let Some(effort) = &args.effort {
        cmd.arg("--effort").arg(effort);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("spawn codex: {} (is the codex CLI installed?)", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "no stdout handle".to_string())?;
    let stderr = child.stderr.take();

    state
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .insert(args.session_id.clone(), child);

    spawn_stream_reader(app.clone(), args.session_id.clone(), stdout, "codex".into());
    if let Some(err) = stderr {
        spawn_stderr_reader(app, args.session_id, err);
    }
    Ok(())
}

// ── Cancel ────────────────────────────────────────────────

#[tauri::command]
pub async fn ai_cli_cancel(
    state: tauri::State<'_, AiCliState>,
    session_id: String,
) -> Result<(), String> {
    let mut map = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = map.remove(&session_id) {
        let _ = child.start_kill();
    }
    Ok(())
}

// ── Trigger login flows (opens in Terminal) ───────────────
//
// We don't hand-roll the OAuth ourselves — that's exactly the
// OpenClaw path that got banned. Instead, we shell out to the
// official CLI's login command in a new Terminal window so the
// user runs the flow in Anthropic/OpenAI's own UI.

#[tauri::command]
pub fn ai_cli_run_login(binary: String) -> Result<(), String> {
    let allowed = matches!(binary.as_str(), "claude" | "codex");
    if !allowed {
        return Err("only claude or codex are supported".into());
    }
    let script = format!(
        "tell application \"Terminal\" to do script \"{} login\"",
        binary
    );
    std::process::Command::new("osascript")
        .args(["-e", &script])
        .spawn()
        .map_err(|e| format!("osascript: {}", e))?;
    Ok(())
}

// ── stdout / stderr readers ───────────────────────────────
//
// Claude's stream-json emits one JSON object per line. We parse
// each line into an AiStreamEvent. Anything unrecognised passes
// through as raw-text so the UI can still show it.

fn spawn_stream_reader<R>(
    app: AppHandle,
    session_id: String,
    stream: R,
    kind_hint: String,
) where
    R: tokio::io::AsyncRead + Unpin + Send + 'static,
{
    tauri::async_runtime::spawn(async move {
        let reader = BufReader::new(stream);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            match serde_json::from_str::<serde_json::Value>(trimmed) {
                Ok(value) => emit_parsed(&app, &session_id, &kind_hint, &value),
                Err(_) => emit(
                    &app,
                    AiStreamEvent {
                        session_id: session_id.clone(),
                        kind: "text".into(),
                        content: Some(trimmed.to_string()),
                        data: None,
                    },
                ),
            }
        }
        // End-of-stream marker. Frontend uses this to flip "streaming"
        // state off and release the input lock.
        emit(
            &app,
            AiStreamEvent {
                session_id: session_id.clone(),
                kind: "end".into(),
                content: None,
                data: None,
            },
        );
    });
}

fn spawn_stderr_reader<R>(app: AppHandle, session_id: String, stream: R)
where
    R: tokio::io::AsyncRead + Unpin + Send + 'static,
{
    tauri::async_runtime::spawn(async move {
        let reader = BufReader::new(stream);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if line.trim().is_empty() {
                continue;
            }
            emit(
                &app,
                AiStreamEvent {
                    session_id: session_id.clone(),
                    kind: "error".into(),
                    content: Some(line),
                    data: None,
                },
            );
        }
    });
}

/// Map Claude stream-json event shapes into our flat AiStreamEvent.
/// Claude's format has evolved; we accept the two most common shapes
/// defensively and fall back to passing the whole JSON through as data.
fn emit_parsed(app: &AppHandle, session_id: &str, hint: &str, v: &serde_json::Value) {
    // Shape 1: { "type": "assistant", "message": { "content": [{ "type": "text", "text": "..." }] } }
    if let Some(msg) = v.get("message").and_then(|m| m.get("content")) {
        if let Some(arr) = msg.as_array() {
            for item in arr {
                if item.get("type").and_then(|t| t.as_str()) == Some("text") {
                    if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                        emit(
                            app,
                            AiStreamEvent {
                                session_id: session_id.to_string(),
                                kind: "text".into(),
                                content: Some(text.to_string()),
                                data: None,
                            },
                        );
                    }
                } else if item.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
                    let name = item
                        .get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("tool")
                        .to_string();
                    emit(
                        app,
                        AiStreamEvent {
                            session_id: session_id.to_string(),
                            kind: "tool".into(),
                            content: Some(name),
                            data: item.get("input").cloned(),
                        },
                    );
                }
            }
            return;
        }
    }
    // Shape 2: { "type": "text_delta", "delta": "..." } — token stream.
    if v.get("type").and_then(|t| t.as_str()) == Some("text_delta") {
        if let Some(delta) = v.get("delta").and_then(|d| d.as_str()) {
            emit(
                app,
                AiStreamEvent {
                    session_id: session_id.to_string(),
                    kind: "text".into(),
                    content: Some(delta.to_string()),
                    data: None,
                },
            );
            return;
        }
    }
    // Shape 3: a final "result" object with the session id for --resume.
    if let Some(sid) = v.get("session_id").and_then(|s| s.as_str()) {
        emit(
            app,
            AiStreamEvent {
                session_id: session_id.to_string(),
                kind: "session".into(),
                content: Some(sid.to_string()),
                data: None,
            },
        );
    }
    // Unknown shape — hand the raw JSON to the frontend so diagnostics
    // aren't swallowed. Kind hint identifies which CLI produced it.
    emit(
        app,
        AiStreamEvent {
            session_id: session_id.to_string(),
            kind: format!("{}:raw", hint),
            content: None,
            data: Some(v.clone()),
        },
    );
}
