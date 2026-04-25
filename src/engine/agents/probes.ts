// ──────────────────────────────────────────────────────────
// CLI install + auth probes (existence-only, never reads contents)
// ──────────────────────────────────────────────────────────
//
// Replaces the existence checks that lived in
// electron/ipc/commands/ai-cli.ts and the CDN-backed PATH probes in
// src/engine/acp/registry.ts. Everything here is:
//   1. Does the user have `<binary>` on PATH?
//   2. Does the credential file / keychain entry exist?
//
// We never read credential contents. Zero tokens cross this boundary.
//
// ──────────────────────────────────────────────────────────

import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { AuthProbe } from "./registry";

const execFileP = promisify(execFile);

// ── PATH lookup ──────────────────────────────────────────

function pathExtensions(): string[] {
  if (process.platform !== "win32") return [""];
  const raw = process.env.PATHEXT ?? ".EXE;.BAT;.CMD";
  return raw.split(";").map((x) => x.toLowerCase());
}

async function isFileExecutable(full: string): Promise<boolean> {
  try {
    const stat = await fsp.stat(full);
    return stat.isFile();
  } catch {
    return false;
  }
}

/** Is `binary` on PATH on this machine? Does not execute it. */
export async function isOnPath(binary: string): Promise<boolean> {
  const paths = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const exts = pathExtensions();
  for (const dir of paths) {
    for (const ext of exts) {
      const candidate = path.join(dir, binary + ext);
      if (await isFileExecutable(candidate)) return true;
    }
  }
  return false;
}

/** Probe several binaries in parallel; returns the set present. */
export async function probeCliInstalled(binaries: string[]): Promise<Set<string>> {
  const results = await Promise.all(
    binaries.map(async (b) => [b, await isOnPath(b)] as const),
  );
  return new Set(results.filter(([, ok]) => ok).map(([b]) => b));
}

// ── Version probing ──────────────────────────────────────
//
// `<bin> --version` is the near-universal convention. Two hard-won
// defaults below:
//
//   1. `killSignal: 'SIGKILL'`. Heavy Node-based CLIs (Droid, Amp,
//      Gemini, Cursor Agent) take 5–15s on first run because they
//      eagerly import their full runtime even for `--version`. The
//      previous SIGTERM was being IGNORED during the Node import
//      phase — the Promise rejected on timeout but the child kept
//      running for 15+ seconds. With listAgents getting called every
//      few seconds, those orphaned children piled up to 200+ live
//      processes consuming ~10GB of RAM. SIGKILL can't be ignored.
//
//   2. 8s timeout (was 2s). Even with SIGKILL, a 2s budget made the
//      probe return null for any CLI that legitimately needs longer
//      to print its version. 8s is the observed worst case for these
//      CLIs on a cold disk + heavy concurrent IDE workload.
//
//   3. In-process result cache (5min TTL). Versions don't change
//      mid-session, and `listAgents` fires often (Settings auto-poll,
//      composer agent picker, every chat-thread mount). Without a
//      cache, every call re-spawns 5+ subprocesses per agent.

const VERSION_PROBE_TIMEOUT_MS = 8_000;
const VERSION_CACHE_TTL_MS = 5 * 60_000;

interface VersionCacheEntry {
  value: string | null;
  at: number;
  inFlight?: Promise<string | null>;
}
const versionCache = new Map<string, VersionCacheEntry>();

/** Run `<bin> --version` and return the first semver-ish substring.
 *  Returns null on timeout, non-zero exit, or unparseable output.
 *  Cached for 5min and de-duped across concurrent callers. */
export async function probeCliVersion(binary: string): Promise<string | null> {
  const now = Date.now();
  const cached = versionCache.get(binary);
  if (cached && now - cached.at < VERSION_CACHE_TTL_MS && !cached.inFlight) {
    return cached.value;
  }
  if (cached?.inFlight) return cached.inFlight;

  const inFlight = (async () => {
    try {
      const { stdout } = await execFileP(binary, ["--version"], {
        timeout: VERSION_PROBE_TIMEOUT_MS,
        killSignal: "SIGKILL",
      });
      const trimmed = stdout.trim();
      const match = trimmed.match(/\b\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?\b/);
      const value = match?.[0] ?? (trimmed || null);
      versionCache.set(binary, { value, at: Date.now() });
      return value;
    } catch {
      // Cache the failure too — repeating it spawns more processes
      // on every listAgents call. 5 min is short enough that an
      // upgrade gets picked up reasonably soon.
      versionCache.set(binary, { value: null, at: Date.now() });
      return null;
    }
  })();
  versionCache.set(binary, { value: cached?.value ?? null, at: cached?.at ?? 0, inFlight });
  return inFlight;
}

/** Compare two semver-ish strings. Returns -1/0/1. Non-numeric tails
 *  are ignored beyond major.minor.patch (pre-release precedence is
 *  NOT SemVer-accurate — we don't need it; compatibility decisions
 *  are major.minor only). */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const core = v.replace(/-.*$/, ""); // strip pre-release tail
    return core.split(".").slice(0, 3).map((n) => {
      const x = Number.parseInt(n, 10);
      return Number.isFinite(x) ? x : 0;
    });
  };
  const [aa, bb] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    const av = aa[i] ?? 0;
    const bv = bb[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

export interface VersionCompatibility {
  /** Raw version string we got from `<bin> --version`. */
  version: string | null;
  /** True when the installed version falls inside [min, max]. Null
   *  means we couldn't probe — default to allowing the user to try,
   *  the adapter's stream-json parser will raise if the schema has
   *  moved and the translator can't follow. */
  compatible: boolean | null;
}

/** Check the installed version against a compatibility range. Either
 *  bound is optional. */
export async function probeCliCompatibility(args: {
  binary: string;
  minVersion?: string;
  maxVersion?: string;
}): Promise<VersionCompatibility> {
  const version = await probeCliVersion(args.binary);
  if (!version) return { version: null, compatible: null };
  if (args.minVersion && compareVersions(version, args.minVersion) < 0) {
    return { version, compatible: false };
  }
  if (args.maxVersion && compareVersions(version, args.maxVersion) > 0) {
    return { version, compatible: false };
  }
  return { version, compatible: true };
}

// ── Auth probes ──────────────────────────────────────────

function expandHome(p: string): string {
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  if (p === "~") return os.homedir();
  return p;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fsp.stat(p);
    return true;
  } catch {
    return false;
  }
}

/** macOS keychain probe. `security find-generic-password` returns 0 if
 *  the entry exists, non-zero otherwise. We don't pass `-w` (which
 *  would print the secret); we only care about the exit code. */
async function keychainEntryExists(service: string): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  try {
    await execFileP("security", ["find-generic-password", "-s", service], {
      timeout: 1500,
    });
    return true;
  } catch {
    return false;
  }
}

async function commandExitsZero(
  binary: string,
  args: string[],
): Promise<boolean> {
  try {
    await execFileP(binary, args, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** Evaluate a single probe spec. Never reads credential contents. */
export async function evaluateAuthProbe(probe: AuthProbe): Promise<boolean> {
  switch (probe.kind) {
    case "file": {
      for (const raw of probe.paths) {
        if (await exists(expandHome(raw))) return true;
      }
      return false;
    }
    case "keychain":
      return keychainEntryExists(probe.service);
    case "command":
      return commandExitsZero(probe.binary, probe.args);
    case "any-of": {
      for (const inner of probe.probes) {
        if (await evaluateAuthProbe(inner)) return true;
      }
      return false;
    }
  }
}
