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
