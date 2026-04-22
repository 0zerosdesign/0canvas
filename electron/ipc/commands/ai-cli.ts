// ──────────────────────────────────────────────────────────
// IPC commands: AI CLI subprocess — port of src-tauri/src/ai_cli.rs
// ──────────────────────────────────────────────────────────
//
// Spawns the user's locally-installed `claude` or `codex` CLI and
// streams its NDJSON stdout back to the renderer as `ai-stream-event`
// events. The user is responsible for their own `claude login` /
// `codex login` — we never touch OAuth tokens directly. Matches the
// Rust path that survived Anthropic's April 2026 third-party cutoff.
//
// Event shape mirrors Rust's AiStreamEvent with camelCase serde:
//   { sessionId: string, kind: "text"|"tool"|"error"|"session"|
//                        "end"|"claude:raw"|"codex:raw",
//     content?: string, data?: unknown }
//
// Anything streamCli (src/zeros/lib/ai-cli.ts) expects is produced
// here byte-for-byte: text deltas, tool_use blocks, stderr as error
// events, session-resume ids, and the terminating `end` marker.
// ──────────────────────────────────────────────────────────

import { spawn as spawnChild, type ChildProcess, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { app } from "electron";
import { currentRoot } from "../../sidecar";
import { emitEvent } from "../events";
import type { CommandHandler } from "../router";

// ── Session registry ──────────────────────────────────────

const sessions = new Map<string, ChildProcess>();

interface AiStreamEventPayload {
  sessionId: string;
  kind: string;
  content?: string | null;
  data?: unknown;
}

function emit(payload: AiStreamEventPayload): void {
  emitEvent("ai-stream-event", payload);
}

// ── which-style binary lookup ─────────────────────────────

/** Rust uses the `which` crate; Node has no built-in, so shell out
 *  to the POSIX `which`. Returns absolute path on success, null when
 *  not on PATH. PATH is inherited from the parent Electron process —
 *  the user's shell env (nvm, homebrew) would need to have been in
 *  the parent env when Electron launched. */
function whichBinary(binary: string): string | null {
  try {
    const result = spawnSync("which", [binary], { encoding: "utf-8" });
    if (result.status !== 0) return null;
    const p = (result.stdout ?? "").trim();
    return p || null;
  } catch {
    return null;
  }
}

export const aiCliCheck: CommandHandler = (args) => {
  const binary = String(args.binary ?? "");
  if (!binary) return null;
  return whichBinary(binary);
};

// ── Auth probe (filesystem evidence, never reads tokens) ──
//
// Per-binary marker paths under $HOME. "Authenticated" means the user
// has run the CLI at least once and it wrote an auth artefact — we
// don't read tokens, only existence. Any marker hit = true.
//
// For binaries not in this table we fall back to a generic heuristic:
// `~/.<binary>/` OR `~/.config/<binary>/` exists. Most ACP agents
// scaffold a dotdir on first login, so this catches them without us
// having to hand-curate every entry.

const AUTH_MARKERS: Record<string, string[]> = {
  claude: [
    ".claude/.credentials.json",
    ".claude/settings.json",
    ".claude/sessions",
    ".claude/projects",
    ".claude/history.jsonl",
  ],
  codex: [".codex/auth.json"],
  gemini: [
    ".gemini/auth.json",
    ".gemini/credentials.json",
    ".config/gemini/auth.json",
  ],
  amp: [".amp/config.json", ".amp/credentials.json", ".config/amp/config.json"],
  copilot: [".config/gh-copilot/hosts.yml"],
  "gh-copilot": [".config/gh-copilot/hosts.yml"],
  droid: [".factory/auth.json", ".factory/credentials.json"],
  cursor: [".cursor/auth.json", ".cursor/credentials.json"],
  "cursor-agent": [".cursor/auth.json", ".cursor/credentials.json"],
};

function probeAuth(binary: string, home: string): boolean {
  const explicit = AUTH_MARKERS[binary];
  if (explicit) {
    return explicit.some((m) => existsSync(path.join(home, m)));
  }
  return (
    existsSync(path.join(home, `.${binary}`)) ||
    existsSync(path.join(home, ".config", binary))
  );
}

export const aiCliIsAuthenticated: CommandHandler = (args) => {
  const binary = String(args.binary ?? "");
  if (!binary) return false;
  const home = process.env.HOME;
  if (!home) return false;
  return probeAuth(binary, home);
};

// ── Login trigger — opens Terminal running `<bin> login` ──
//
// `<binary> login` is the convention Claude, Codex, Gemini, and most
// other agent CLIs follow. For agents that diverge (e.g. `gh auth
// login`), the user still lands in a terminal with the right binary
// name ready to hand — they can edit the command before pressing enter.

export const aiCliRunLogin: CommandHandler = async (args) => {
  const binary = String(args.binary ?? "").trim();
  if (!binary) throw new Error("ai_cli_run_login: missing binary");
  // Allow-list regex — no spaces or shell metachars escape into osascript.
  if (!/^[a-zA-Z0-9_.-]+$/.test(binary)) {
    throw new Error(`ai_cli_run_login: invalid binary name '${binary}'`);
  }
  const script = `tell application "Terminal" to do script "${binary} login"`;
  await new Promise<void>((resolve, reject) => {
    const child = spawnChild("osascript", ["-e", script], {
      stdio: "ignore",
      detached: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
};

// ── Cancel an in-flight session ───────────────────────────

export const aiCliCancel: CommandHandler = (args) => {
  const sessionId = String(args.sessionId ?? args.session_id ?? "");
  if (!sessionId) return;
  const child = sessions.get(sessionId);
  if (!child) return;
  sessions.delete(sessionId);
  try {
    child.kill("SIGTERM");
  } catch {
    /* already dead */
  }
};

// ── Line reader with NDJSON dispatch ──────────────────────

/** Mirrors emit_parsed() in ai_cli.rs. Accepts three common claude
 *  stream-json shapes and falls back to `{hint}:raw` data passthrough
 *  so diagnostics aren't swallowed. */
function emitParsed(sessionId: string, hint: string, v: unknown): void {
  if (!v || typeof v !== "object") {
    emit({ sessionId, kind: `${hint}:raw`, content: null, data: v });
    return;
  }
  const obj = v as Record<string, unknown>;

  // Shape 1: { type: "assistant", message: { content: [{type:"text"|"tool_use", ...}] } }
  const message = obj.message;
  if (message && typeof message === "object") {
    const content = (message as Record<string, unknown>).content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item || typeof item !== "object") continue;
        const it = item as Record<string, unknown>;
        if (it.type === "text" && typeof it.text === "string") {
          emit({ sessionId, kind: "text", content: it.text });
        } else if (it.type === "tool_use") {
          const name = typeof it.name === "string" ? it.name : "tool";
          emit({ sessionId, kind: "tool", content: name, data: it.input ?? null });
        }
      }
      return;
    }
  }

  // Shape 2: { type: "text_delta", delta: "..." } — token stream.
  if (obj.type === "text_delta" && typeof obj.delta === "string") {
    emit({ sessionId, kind: "text", content: obj.delta });
    return;
  }

  // Shape 3: { session_id: "..." } — final result with resume id.
  if (typeof obj.session_id === "string") {
    emit({ sessionId, kind: "session", content: obj.session_id });
    // Fall through so unknown additional fields still get the raw hint
    // below? Rust returns early here. Match Rust exactly.
    return;
  }

  // Unknown shape — pass raw JSON through tagged by CLI.
  emit({ sessionId, kind: `${hint}:raw`, content: null, data: v });
}

function attachStdoutReader(
  child: ChildProcess,
  sessionId: string,
  hint: "claude" | "codex",
): void {
  if (!child.stdout) return;
  const rl = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  });
  rl.on("line", (raw) => {
    const line = raw.trim();
    if (!line) return;
    try {
      const parsed = JSON.parse(line);
      emitParsed(sessionId, hint, parsed);
    } catch {
      // Not JSON — forward as plain text so the chat still renders it.
      emit({ sessionId, kind: "text", content: line });
    }
  });
  rl.once("close", () => {
    // End-of-stream marker. Frontend uses this to flip "streaming"
    // off and release the input lock. Rust emits this after stdout
    // closes regardless of exit code.
    emit({ sessionId, kind: "end" });
    sessions.delete(sessionId);
  });
}

function attachStderrReader(child: ChildProcess, sessionId: string): void {
  if (!child.stderr) return;
  const rl = readline.createInterface({
    input: child.stderr,
    crlfDelay: Infinity,
  });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    emit({ sessionId, kind: "error", content: line });
  });
}

// ── Spawn commands ────────────────────────────────────────
//
// The renderer calls with the args nested under `args:` to match
// the Tauri shape (Rust derives ClaudeSpawnArgs/CodexSpawnArgs from
// a single JSON object). We unwrap here and tolerate either calling
// convention so older / newer callers both work.

interface SpawnArgsShape {
  sessionId?: string;
  session_id?: string;
  prompt?: string;
  model?: string | null;
  resumeId?: string | null;
  resume_id?: string | null;
  effort?: string | null;
  systemPrompt?: string | null;
  system_prompt?: string | null;
}

function unwrapSpawnArgs(args: Record<string, unknown>): SpawnArgsShape {
  // Prefer nested args when present (Tauri-style call), else the
  // flat shape.
  const nested =
    args.args && typeof args.args === "object"
      ? (args.args as Record<string, unknown>)
      : args;
  return nested as SpawnArgsShape;
}

function requireCwd(): string {
  const root = currentRoot();
  if (!root) throw new Error("no project root");
  return root;
}

export const claudeSpawn: CommandHandler = (rawArgs) => {
  const args = unwrapSpawnArgs(rawArgs);
  const sessionId = String(args.sessionId ?? args.session_id ?? "");
  const prompt = String(args.prompt ?? "");
  if (!sessionId) throw new Error("claude_spawn: missing sessionId");
  if (!prompt) throw new Error("claude_spawn: missing prompt");

  const cwd = requireCwd();

  const cliArgs: string[] = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
  ];
  if (args.model) cliArgs.push("--model", String(args.model));
  const resume = args.resumeId ?? args.resume_id;
  if (resume) cliArgs.push("--resume", String(resume));
  const sys = args.systemPrompt ?? args.system_prompt;
  if (sys) cliArgs.push("--system-prompt", String(sys));
  if (args.effort) cliArgs.push("--effort", String(args.effort));

  let child: ChildProcess;
  try {
    child = spawnChild("claude", cliArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
  } catch (err) {
    throw new Error(
      `spawn claude: ${
        err instanceof Error ? err.message : String(err)
      } (is the claude CLI installed?)`,
    );
  }

  // Node emits ENOENT asynchronously on `error` instead of throwing
  // on spawn — map that to the same Rust-style message so the UI
  // treatment stays identical.
  child.once("error", (err) => {
    emit({
      sessionId,
      kind: "error",
      content: `spawn claude: ${err.message} (is the claude CLI installed?)`,
    });
    emit({ sessionId, kind: "end" });
    sessions.delete(sessionId);
  });

  sessions.set(sessionId, child);
  attachStdoutReader(child, sessionId, "claude");
  attachStderrReader(child, sessionId);
};

export const codexSpawn: CommandHandler = (rawArgs) => {
  const args = unwrapSpawnArgs(rawArgs);
  const sessionId = String(args.sessionId ?? args.session_id ?? "");
  const prompt = String(args.prompt ?? "");
  if (!sessionId) throw new Error("codex_spawn: missing sessionId");
  if (!prompt) throw new Error("codex_spawn: missing prompt");

  const cwd = requireCwd();

  const cliArgs: string[] = [];
  const resume = args.resumeId ?? args.resume_id;
  if (resume) {
    cliArgs.push("exec", "resume", String(resume));
  } else {
    cliArgs.push("exec");
  }
  cliArgs.push(prompt, "--json");
  if (args.model) cliArgs.push("--model", String(args.model));
  if (args.effort) cliArgs.push("--effort", String(args.effort));

  let child: ChildProcess;
  try {
    child = spawnChild("codex", cliArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
  } catch (err) {
    throw new Error(
      `spawn codex: ${
        err instanceof Error ? err.message : String(err)
      } (is the codex CLI installed?)`,
    );
  }

  child.once("error", (err) => {
    emit({
      sessionId,
      kind: "error",
      content: `spawn codex: ${err.message} (is the codex CLI installed?)`,
    });
    emit({ sessionId, kind: "end" });
    sessions.delete(sessionId);
  });

  sessions.set(sessionId, child);
  attachStdoutReader(child, sessionId, "codex");
  attachStderrReader(child, sessionId);
};

// Kill every live AI CLI subprocess before Electron exits so we
// don't leak orphaned claude/codex processes when the user quits
// mid-generation.
app.on("before-quit", () => {
  for (const [sid, child] of sessions.entries()) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    sessions.delete(sid);
  }
});
