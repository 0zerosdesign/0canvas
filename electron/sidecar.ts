// ──────────────────────────────────────────────────────────
// Engine sidecar — spawn, track, shutdown, crash watchdog
// ──────────────────────────────────────────────────────────
//
// Direct port of src-tauri/src/sidecar.rs. The Node.js Zeros engine
// runs as a child process of the Electron shell. It binds a local
// WebSocket + HTTP server on 127.0.0.1:24193 (retries up to 24200)
// and writes the actual port to `<project_root>/.zeros/.port` once
// bound.
//
// Crash recovery: a lightweight watchdog polls TCP against the bound
// port every 2 s. Three consecutive failures → respawn with the
// last-known root and emit `engine-restarted` so the renderer can
// reconnect.
//
// `shutdown()` MUST be called from app.on("before-quit") — otherwise
// the Node child outlives the Electron window and eats port 24193
// on the next launch.
// ──────────────────────────────────────────────────────────

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import { emitEvent } from "./ipc/events";

interface SidecarStateShape {
  child: ChildProcess | null;
  port: number | null;
  root: string | null;
  /** Flipped true by `shutdown()` so the watchdog stops respawning. */
  shuttingDown: boolean;
  /** Bumped every successful spawn; invalidates stale watchdog races
   *  so a post-respawn reachable probe doesn't respawn again. */
  spawnGeneration: number;
  watchdogTimer: NodeJS.Timeout | null;
}

const state: SidecarStateShape = {
  child: null,
  port: null,
  root: null,
  shuttingDown: false,
  spawnGeneration: 0,
  watchdogTimer: null,
};

function archTriple(): string {
  if (process.arch === "arm64") return "aarch64-apple-darwin";
  if (process.arch === "x64") return "x86_64-apple-darwin";
  throw new Error(`unsupported arch: ${process.arch}`);
}

/** Find the bun-compiled engine binary. Two layouts:
 *    Dev:     <repo>/binaries/zeros-engine-<triple>   (pnpm build:sidecar)
 *    Release: <App>.app/Contents/Resources/zeros-engine
 *             (electron-builder extraResources rewrites the filename). */
function locateEngineBinary(): string {
  const triple = archTriple();
  const candidates: string[] = [];

  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, "zeros-engine"));
    candidates.push(path.join(process.resourcesPath, `zeros-engine-${triple}`));
  } else {
    // __dirname is <repo>/dist-electron/, so repo root is one up.
    const repoRoot = path.resolve(__dirname, "..");
    candidates.push(
      path.join(repoRoot, "binaries", `zeros-engine-${triple}`),
    );
  }

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  throw new Error(
    `engine binary not found. Tried:\n${candidates
      .map((p) => `  ${p}`)
      .join("\n")}\nRun \`pnpm build:sidecar\` first.`,
  );
}

/** Tiny TCP probe (500ms timeout) — matches the Rust port_reachable. */
function portReachable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 500);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
}

function killCurrentChild(): void {
  const current = state.child;
  if (current && !current.killed) {
    try {
      current.kill("SIGTERM");
    } catch {
      /* best-effort; child might already be dying */
    }
  }
  state.child = null;
  state.port = null;
}

/**
 * Spawn the engine with `projectRoot` as its working directory. Kills
 * any previous child first, then polls for `<root>/.zeros/.port` (up
 * to 10 s) to discover the actually-bound port. Matches the Rust
 * spawn_engine_impl byte-for-byte in behaviour.
 */
export async function spawnEngine(projectRoot: string): Promise<number> {
  killCurrentChild();

  const engineBin = locateEngineBinary();
  const portFile = path.join(projectRoot, ".zeros", ".port");
  try {
    unlinkSync(portFile);
  } catch {
    /* file may not exist; fine */
  }

  // In packaged builds we must pipe stdio and forward to a log file —
  // `inherit` sends to the parent's stdout which is detached for a
  // macOS GUI bundle, so engine logs (including bind failures) vanish.
  // In dev we can keep `inherit` so logs reach the terminal.
  const isPackaged = app.isPackaged;
  const stdioMode = isPackaged ? "pipe" : "inherit";
  const child = spawn(
    engineBin,
    ["serve", "--root", projectRoot, "--port", "24193"],
    {
      cwd: projectRoot,
      stdio: stdioMode as "pipe" | "inherit",
    },
  );

  if (isPackaged) {
    // Mirror the engine's output into a rotating log alongside the
    // main log. Easiest path to diagnose engine-side crashes in a
    // shipped build.
    const engineLogPath = path.join(
      os.homedir(),
      "Library",
      "Logs",
      "Zeros",
      "engine.log",
    );
    try {
      const logStream = require("node:fs").createWriteStream(engineLogPath, {
        flags: "a",
      });
      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);
    } catch {
      /* unable to create log stream — engine just runs dark */
    }
  }

  state.child = child;
  state.root = projectRoot;
  // Wrapping add — matches Rust semantics; JS numbers are safe up to 2^53.
  state.spawnGeneration = (state.spawnGeneration + 1) & 0xffffffff;

  child.once("exit", (code, signal) => {
    // Only clear the child reference if this is still the active one
    // (a newer spawn may have already replaced it). CRITICAL: do NOT
    // clear `state.port` here — the watchdog needs the port to stay
    // set so its TCP probe can fail, accumulate 3 strikes, and
    // trigger a respawn. Clearing port on exit made the watchdog
    // treat a dead engine as "nothing to monitor" and skip respawn.
    if (state.child === child) {
      state.child = null;
    }
    // eslint-disable-next-line no-console
    console.log(`[Zeros] engine exited code=${code} signal=${signal ?? ""}`);
  });

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const raw = readFileSync(portFile, "utf-8").trim();
      const port = Number.parseInt(raw, 10);
      if (Number.isFinite(port) && port > 0 && port <= 65535) {
        state.port = port;
        // eslint-disable-next-line no-console
        console.log(`[Zeros] engine ready on port ${port}`);
        return port;
      }
    } catch {
      /* port file not written yet; keep polling */
    }
    await new Promise<void>((r) => setTimeout(r, 100));
  }

  throw new Error("engine did not bind within 10 seconds");
}

/** Idempotent engine shutdown. Flips the shutting-down flag so the
 *  watchdog stops respawning. Called from app.on("before-quit"). */
export function shutdown(): void {
  state.shuttingDown = true;
  if (state.watchdogTimer) {
    clearInterval(state.watchdogTimer);
    state.watchdogTimer = null;
  }
  const child = state.child;
  if (child && !child.killed) {
    try {
      child.kill("SIGTERM");
      // eslint-disable-next-line no-console
      console.log("[Zeros] engine stopped");
    } catch {
      /* best-effort */
    }
  }
  state.child = null;
  state.port = null;
  state.root = null;
}

export function currentPort(): number | null {
  return state.port;
}

export function currentRoot(): string | null {
  return state.root;
}

/** Starts a 2-second TCP heartbeat against the engine's bound port.
 *  Three consecutive unreachable probes trigger a respawn and emit
 *  `engine-restarted { port: <new> }` so the renderer reconnects. */
export function startWatchdog(): void {
  if (state.watchdogTimer) return; // already running; idempotent

  const FAIL_THRESHOLD = 3;
  const POLL_INTERVAL_MS = 2000;
  let fails = 0;

  state.watchdogTimer = setInterval(async () => {
    if (state.shuttingDown) return;

    const port = state.port;
    if (port === null) {
      // No recorded port — never spawned successfully, or a respawn is
      // mid-flight. Nothing to monitor.
      fails = 0;
      return;
    }

    if (await portReachable(port)) {
      fails = 0;
      return;
    }

    fails += 1;
    if (fails < FAIL_THRESHOLD) return;

    const root = state.root;
    if (!root) {
      fails = 0;
      return;
    }

    // eslint-disable-next-line no-console
    console.error(
      `[Zeros] engine unreachable on port ${port} after ${FAIL_THRESHOLD} probes; respawning`,
    );
    fails = 0;

    try {
      const newPort = await spawnEngine(root);
      // eslint-disable-next-line no-console
      console.log(`[Zeros] watchdog respawned engine on port ${newPort}`);
      emitEvent("engine-restarted", newPort);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[Zeros] watchdog respawn failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }, POLL_INTERVAL_MS);
}

// ──────────────────────────────────────────────────────────
// Initial project root resolution
// ──────────────────────────────────────────────────────────
//
// The engine's file watcher indexes every file under its root. That's
// fine for a user repo (~thousands of files) but catastrophic for
// $HOME (~millions) or / (entire filesystem). When the watcher exceeds
// macOS's EMFILE ceiling the engine crashes on every fs event and the
// IPC bridge stalls indefinitely — the exact "Fetching ACP registry..."
// hang users hit when the packaged app is launched from Finder (CWD=/)
// or from a shell where the cwd isn't a real project.
//
// Strategy: refuse to root at anything that doesn't look like a user
// project. Use a dedicated empty sentinel at
//   ~/.zeros/default-project/
// The user then opens their real project via File → Open Folder,
// which respawns the engine rooted there.

const SENTINEL_DIR_NAME = "default-project";

function sentinelRoot(): string {
  const home = process.env.HOME ?? "/tmp";
  const dir = path.join(home, ".zeros", SENTINEL_DIR_NAME);
  try {
    if (!existsSync(dir)) {
      require("node:fs").mkdirSync(dir, { recursive: true });
    }
  } catch {
    /* falls back to the unwritable path — spawn surfaces the error */
  }
  return dir;
}

/** A directory is a "plausible project" when it has a .git, a
 *  package.json, or an existing .zeros subdir. Anything else is
 *  treated as "not a project" and redirected to the sentinel. */
function isPlausibleProject(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    if (!statSync(dir).isDirectory()) return false;
  } catch {
    return false;
  }
  return (
    existsSync(path.join(dir, ".git")) ||
    existsSync(path.join(dir, "package.json")) ||
    existsSync(path.join(dir, ".zeros")) ||
    existsSync(path.join(dir, "pyproject.toml")) ||
    existsSync(path.join(dir, "Cargo.toml")) ||
    existsSync(path.join(dir, "go.mod"))
  );
}

/** Bail-out directories we KNOW aren't projects even if they happen
 *  to contain a git/package.json accidentally. $HOME, /, system dirs. */
function isSystemDir(dir: string): boolean {
  if (!dir) return true;
  const home = process.env.HOME;
  if (home && path.resolve(dir) === path.resolve(home)) return true;
  // Any of the Unix system root dirs (/tmp, /private/tmp, /var, /etc,
  // /usr, /bin, /Applications, /Library, etc.) or the filesystem
  // root itself. Match by leading segment rather than a hardcoded
  // list so new macOS volumes don't slip through.
  if (/^\/(?:private\/)?(?:tmp|var|etc|usr|bin|sbin|opt|System|Library|Volumes|Applications|Network|cores|dev)(?:\/|$)/.test(dir)) {
    return true;
  }
  return dir === "/" || dir.includes(".app/Contents/");
}

export function defaultProjectRoot(): string {
  const cwd = process.cwd();

  // Legacy dev-tree tolerance (harmless to keep).
  if (path.basename(cwd) === "src-tauri") {
    return path.dirname(cwd);
  }

  // Is the CWD actually a user project we can safely index?
  if (!isSystemDir(cwd) && isPlausibleProject(cwd)) {
    return cwd;
  }

  // Otherwise: sentinel. The user picks a real project next.
  return sentinelRoot();
}

/** Validate a path exists and is a directory before we spawn into it.
 *  Used by open_project_folder_path / open_cloned_project so the UI
 *  gets a clear error for stale recent-projects entries. */
export function assertIsDirectory(p: string): void {
  if (!existsSync(p)) {
    throw new Error(`folder does not exist: ${p}`);
  }
  if (!statSync(p).isDirectory()) {
    throw new Error(`not a directory: ${p}`);
  }
}
