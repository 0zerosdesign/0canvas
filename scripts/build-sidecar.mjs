#!/usr/bin/env node
// ──────────────────────────────────────────────────────────
// Build the 0canvas engine as a Bun single-file executable
// and place it at the path Tauri expects for sidecar binaries.
// ──────────────────────────────────────────────────────────
//
// Output: src-tauri/binaries/0canvas-engine-<rustc-host-triple>
//
// Why this layout:
//   Tauri's `externalBin` feature appends the active Rust host
//   target triple when looking for the sidecar binary at both
//   build time (for bundling) and runtime (for spawn). So on
//   an Apple-Silicon Mac we need
//   `0canvas-engine-aarch64-apple-darwin` next to the app.
//
// Known caveats (documented in the Tauri plan):
//   @parcel/watcher's native `.node` binary does not bundle
//   into Bun --compile; the engine falls back to polling. This
//   costs a little CPU but every other engine feature works.
// ──────────────────────────────────────────────────────────

import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Map Node's `process.arch` to the Rust host triple + Bun target flag.
const archMap = {
  arm64: { rustTriple: "aarch64-apple-darwin", bunTarget: "bun-darwin-arm64" },
  x64: { rustTriple: "x86_64-apple-darwin", bunTarget: "bun-darwin-x64" },
};

const platform = process.platform;
if (platform !== "darwin") {
  console.error(
    `build-sidecar: currently only macOS is supported (got ${platform}). ` +
      "Windows/Linux builds land in a later phase per the plan.",
  );
  process.exit(1);
}

const mapping = archMap[process.arch];
if (!mapping) {
  console.error(`build-sidecar: unsupported macOS arch ${process.arch}`);
  process.exit(1);
}

const entry = resolve(repoRoot, "src/cli.ts");
if (!existsSync(entry)) {
  console.error(`build-sidecar: entry not found at ${entry}`);
  process.exit(1);
}

const binariesDir = resolve(repoRoot, "src-tauri/binaries");
mkdirSync(binariesDir, { recursive: true });

const outfile = resolve(binariesDir, `0canvas-engine-${mapping.rustTriple}`);

const cmd = [
  "bun",
  "build",
  entry,
  "--compile",
  `--target=${mapping.bunTarget}`,
  "--outfile",
  outfile,
].join(" ");

console.log(`[build-sidecar] ${cmd}`);
execSync(cmd, { stdio: "inherit", cwd: repoRoot });

// Bun writes 755 already; chmod defensively in case of umask weirdness.
execSync(`chmod +x ${outfile}`, { stdio: "inherit" });

console.log(`[build-sidecar] wrote ${outfile}`);
