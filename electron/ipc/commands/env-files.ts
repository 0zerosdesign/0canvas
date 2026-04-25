// ──────────────────────────────────────────────────────────
// IPC commands: .env editor
// ──────────────────────────────────────────────────────────
//
// Dedicated commands (instead of a generic fs plugin) because:
//   - Env files live at predictable paths under the engine root;
//     writes stay scoped without exposing arbitrary fs.
//   - Parsing + serialising stays main-side so the renderer never
//     deals with comments, blanks, quote stripping.
//
// Format: standard KEY=VALUE per line. `#`-prefixed lines are
// comments; blank lines preserved on round-trip via raw_lines.
// ──────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { currentRoot } from "../../sidecar";
import type { CommandHandler } from "../router";

interface EnvVar {
  key: string;
  value: string;
}

interface EnvFilePayload {
  path: string;
  filename: string;
  variables: EnvVar[];
  gitignored: boolean;
  rawLines: string[];
}

function resolveRoot(args: Record<string, unknown>): string | null {
  const explicit = typeof args.cwd === "string" ? args.cwd.trim() : "";
  if (explicit) return explicit;
  return currentRoot();
}

/** Parse one KEY=VALUE line. Mirrors parse_env_line() in env_files.rs:
 *  skip blank + comment lines, require alphanumeric/underscore keys,
 *  strip a single pair of surrounding quotes if present. */
function parseEnvLine(line: string): EnvVar | null {
  const trimmed = line.replace(/^\s+/, "");
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq < 0) return null;
  const key = trimmed.slice(0, eq).trim();
  if (!key || !/^[A-Za-z0-9_]+$/.test(key)) return null;

  const raw = trimmed.slice(eq + 1).replace(/\r$/, "");
  const quoted =
    (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
    (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2);
  const value = quoted ? raw.slice(1, -1) : raw;
  return { key, value };
}

/** Best-effort gitignore check: literal-match the filename (or
 *  common env globs) against every .gitignore between file and
 *  project root. */
function isGitignored(filePath: string, root: string): boolean {
  const filename = path.basename(filePath);
  let dir = path.dirname(filePath);
  const rootResolved = path.resolve(root);

  while (true) {
    const gi = path.join(dir, ".gitignore");
    if (fs.existsSync(gi)) {
      try {
        const content = fs.readFileSync(gi, "utf-8");
        for (const raw of content.split("\n")) {
          const line = raw.trim();
          if (!line || line.startsWith("#")) continue;
          if (
            line === filename ||
            line === ".env*" ||
            line === "*.env" ||
            line === `/${filename}`
          ) {
            return true;
          }
        }
      } catch {
        /* unreadable .gitignore — skip */
      }
    }
    if (path.resolve(dir) === rootResolved) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}

function readEnvFile(filePath: string, root: string): EnvFilePayload | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  const rawLines = content.split("\n");
  // split("\n") keeps a trailing empty string when content ends with
  // a newline; strip it so the editor sees the same logical rows.
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }
  const variables: EnvVar[] = [];
  for (const line of rawLines) {
    const v = parseEnvLine(line);
    if (v) variables.push(v);
  }
  return {
    path: filePath,
    filename: path.basename(filePath),
    variables,
    gitignored: isGitignored(filePath, root),
    rawLines,
  };
}

export const listEnvFiles: CommandHandler = (args) => {
  const root = resolveRoot(args);
  if (!root) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (err) {
    throw new Error(
      `read_dir: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const out: EnvFilePayload[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!(name === ".env" || name.startsWith(".env."))) continue;
    const abs = path.join(root, name);
    const file = readEnvFile(abs, root);
    if (file) out.push(file);
  }
  out.sort((a, b) => a.filename.localeCompare(b.filename));
  return out;
};

export const saveEnvFile: CommandHandler = (args) => {
  const root = resolveRoot(args);
  if (!root) throw new Error("no project root");
  const target = String(args.path ?? "");
  if (!target) throw new Error("save_env_file: missing path");
  const variables = Array.isArray(args.variables)
    ? (args.variables as Array<{ key?: unknown; value?: unknown }>)
    : [];

  // Containment check: canonicalize target's parent and project
  // root, refuse writes outside. Use canonicalize+
  // starts_with gate.
  const canonRoot = fs.realpathSync.native(path.resolve(root));
  const parentDir = path.dirname(target);
  let canonParent: string;
  try {
    canonParent = fs.realpathSync.native(path.resolve(parentDir));
  } catch {
    throw new Error("invalid path");
  }
  if (!canonParent.startsWith(canonRoot)) {
    throw new Error(`refusing to write outside project root: ${canonParent}`);
  }

  // Read existing file (may not exist) to preserve comments + order.
  let existing = "";
  try {
    existing = fs.readFileSync(target, "utf-8");
  } catch {
    /* doesn't exist → treat as empty */
  }
  const lines = existing.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  // Map of desired state — consumed as we rewrite lines, leftovers
  // append at the end.
  const desired = new Map<string, string>();
  for (const v of variables) {
    if (typeof v.key === "string" && typeof v.value === "string") {
      desired.set(v.key, v.value);
    }
  }

  const outLines: string[] = [];
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (parsed) {
      if (desired.has(parsed.key)) {
        const newVal = desired.get(parsed.key)!;
        outLines.push(`${parsed.key}=${newVal}`);
        desired.delete(parsed.key);
      }
      // key removed from desired → drop the line entirely
    } else {
      outLines.push(line);
    }
  }
  // New keys — append sorted so diffs stay stable turn-to-turn.
  const leftover = [...desired.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [k, v] of leftover) outLines.push(`${k}=${v}`);

  let finalContent = outLines.join("\n");
  if (!finalContent.endsWith("\n")) finalContent += "\n";

  // Atomic write: temp file + rename.
  const ext = path.extname(target).replace(/^\./, "") || "env";
  const tmp = target.replace(/\.[^.]+$/, "") + `.${ext}.zeros-tmp`;
  fs.writeFileSync(tmp, finalContent);
  fs.renameSync(tmp, target);
};
