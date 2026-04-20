// ──────────────────────────────────────────────────────────
// Phase 4 — Skills
// ──────────────────────────────────────────────────────────
//
// A "skill" is a markdown file with frontmatter living in
// `<project>/skills/`. The chat panel loads the list on mount
// and the user can pre-pend one to any prompt — the skill's
// body becomes the system prompt for that turn.
//
// File format:
//   ---
//   name: Human label
//   description: One-line summary
//   icon: LucideIconName   (optional; defaults to Sparkles)
//   ---
//   <body — becomes the system prompt>
// ──────────────────────────────────────────────────────────

use serde::Serialize;
use std::fs;

use crate::sidecar::SidecarState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub body: String,
    pub path: String,
}

/// Parse the `---` frontmatter block. Returns (map, body).
fn split_frontmatter(raw: &str) -> (std::collections::HashMap<String, String>, String) {
    let mut map = std::collections::HashMap::new();
    let trimmed = raw.trim_start();
    if !trimmed.starts_with("---") {
        return (map, raw.to_string());
    }
    // Skip the opening delimiter line.
    let after_open = match trimmed.find('\n') {
        Some(i) => &trimmed[i + 1..],
        None => return (map, raw.to_string()),
    };
    // Find the closing `---`.
    let end = match after_open.find("\n---") {
        Some(i) => i,
        None => return (map, raw.to_string()),
    };
    let fm_text = &after_open[..end];
    for line in fm_text.lines() {
        if let Some((k, v)) = line.split_once(':') {
            map.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    let body_start = end + "\n---".len();
    let body = after_open[body_start..]
        .trim_start_matches('\n')
        .to_string();
    (map, body)
}

#[tauri::command]
pub fn skills_list(state: tauri::State<'_, SidecarState>) -> Result<Vec<Skill>, String> {
    let root = state
        .current_root()
        .ok_or_else(|| "no project root".to_string())?;
    let skills_dir = root.join("skills");
    if !skills_dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    let entries = fs::read_dir(&skills_dir).map_err(|e| format!("read_dir: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("skill")
            .to_string();
        let raw = match fs::read_to_string(&path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let (fm, body) = split_frontmatter(&raw);
        out.push(Skill {
            id: id.clone(),
            name: fm.get("name").cloned().unwrap_or(id),
            description: fm.get("description").cloned().unwrap_or_default(),
            icon: fm.get("icon").cloned().unwrap_or_else(|| "Sparkles".into()),
            body,
            path: path.to_string_lossy().into_owned(),
        });
    }
    // Stable ordering by display name so the picker doesn't shuffle
    // between calls.
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}
