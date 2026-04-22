// ──────────────────────────────────────────────────────────
// IPC commands: skills — port of src-tauri/src/skills.rs
// ──────────────────────────────────────────────────────────
//
// A "skill" is a markdown file under <project>/skills/ with YAML-
// ish frontmatter. Chat panel loads the list on mount and the user
// can prepend one to any prompt — the body becomes the system
// prompt for that turn.
//
// File format:
//   ---
//   name: Human label
//   description: One-line summary
//   icon: LucideIconName   (optional; defaults to "Sparkles")
//   ---
//   <body — becomes the system prompt>
// ──────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { currentRoot } from "../../sidecar";
import type { CommandHandler } from "../router";

interface SkillPayload {
  id: string;
  name: string;
  description: string;
  icon: string;
  body: string;
  path: string;
}

/** Split `--- <yaml> ---\n<body>` into a flat key→value map and the
 *  rest of the file. Matches split_frontmatter() in skills.rs: only
 *  top-level `key: value` lines on the yaml side, everything after
 *  the closing `---` (and one leading newline) is body. */
function splitFrontmatter(raw: string): { fm: Map<string, string>; body: string } {
  const fm = new Map<string, string>();
  const trimmed = raw.replace(/^\s+/, "");
  if (!trimmed.startsWith("---")) return { fm, body: raw };

  const firstNewline = trimmed.indexOf("\n");
  if (firstNewline < 0) return { fm, body: raw };
  const afterOpen = trimmed.slice(firstNewline + 1);

  const closingIdx = afterOpen.indexOf("\n---");
  if (closingIdx < 0) return { fm, body: raw };

  const fmText = afterOpen.slice(0, closingIdx);
  for (const line of fmText.split("\n")) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key) fm.set(key, value);
  }

  let body = afterOpen.slice(closingIdx + "\n---".length);
  // Strip a single leading newline after the closing delimiter,
  // matching Rust's trim_start_matches('\n') semantics.
  if (body.startsWith("\n")) body = body.slice(1);
  return { fm, body };
}

export const skillsList: CommandHandler = (args) => {
  void args;
  const root = currentRoot();
  if (!root) throw new Error("no project root");

  const skillsDir = path.join(root, "skills");
  if (!fs.existsSync(skillsDir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch (err) {
    throw new Error(
      `read_dir: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const out: SkillPayload[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (path.extname(entry.name) !== ".md") continue;

    const id = path.basename(entry.name, ".md");
    const abs = path.join(skillsDir, entry.name);
    let raw: string;
    try {
      raw = fs.readFileSync(abs, "utf-8");
    } catch {
      continue;
    }

    const { fm, body } = splitFrontmatter(raw);
    out.push({
      id,
      name: fm.get("name") ?? id,
      description: fm.get("description") ?? "",
      icon: fm.get("icon") ?? "Sparkles",
      body,
      path: abs,
    });
  }

  // Stable lower-case sort so the picker doesn't shuffle between calls.
  out.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return out;
};
