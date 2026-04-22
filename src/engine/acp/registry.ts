// ──────────────────────────────────────────────────────────
// ACP Registry — fetch the canonical agent list from CDN
// ──────────────────────────────────────────────────────────
//
// Fetches https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json
// and exposes the shared list of agents (Claude, Codex, Gemini, etc.) that
// Zed, Fabriqa, JetBrains and others consume. Updates hourly upstream.
//
// We do NOT fork the registry, do NOT ship a parallel agent list, do NOT
// patch metadata. If an agent is added or bumped upstream, refetching the
// JSON surfaces it. This is the "zero custom agent code" contract.
// ──────────────────────────────────────────────────────────
//
// Spec: https://github.com/agentclientprotocol/registry
// ──────────────────────────────────────────────────────────

import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";

const REGISTRY_URL =
  "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export type Platform =
  | "darwin-aarch64"
  | "darwin-x86_64"
  | "linux-aarch64"
  | "linux-x86_64"
  | "windows-aarch64"
  | "windows-x86_64";

export interface NpxDistribution {
  package: string; // e.g. "@agentclientprotocol/claude-agent-acp@0.30.0"
  args?: string[];
  env?: Record<string, string>;
}

export interface UvxDistribution {
  package: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface BinaryTarget {
  archive: string;
  cmd: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface BinaryDistribution {
  [platform: string]: BinaryTarget;
}

export interface RegistryAgent {
  id: string;
  name: string;
  version: string;
  description: string;
  repository?: string;
  website?: string;
  authors?: string[];
  license?: string;
  icon?: string;
  distribution: {
    npx?: NpxDistribution;
    uvx?: UvxDistribution;
    binary?: BinaryDistribution;
  };
}

export interface Registry {
  version: string;
  agents: RegistryAgent[];
}

/**
 * A registry agent plus Zeros-side status fields. Mirrored on the bridge
 * as `BridgeRegistryAgent` — keep fields in sync.
 */
export interface EnrichedRegistryAgent extends RegistryAgent {
  /**
   * True when the vendor's CLI is already on PATH (e.g. user has Claude Code
   * installed). For npx/uvx agents that have no independent CLI, this stays
   * false — the agent will still run, it just spawns via npx on first use.
   */
  installed: boolean;
  /** Platform-resolved launch method. `"unavailable"` = no runnable dist on host. */
  launchKind: "npx" | "uvx" | "binary" | "unavailable";
  /**
   * Preferred CLI binary for auth-state probes and the "Login" Terminal
   * invocation. Pulled from the same hand-curated table as the PATH probe.
   * Undefined when we have no known binary (agent will still run via npx,
   * but the auth/login affordances don't apply).
   */
  authBinary?: string;
}

/**
 * Map of registry agent id → candidate CLI binary names to probe on PATH.
 * Hand-curated per MVP agent; unlisted agents fall through to
 * `installed: false` (fine — they still run via npx/uvx).
 *
 * This is the one and only per-agent table in the integration. Everything
 * else is driven by the upstream registry JSON.
 */
const AGENT_PATH_PROBES: Record<string, string[]> = {
  "claude-acp": ["claude"],
  "codex-acp": ["codex"],
  gemini: ["gemini"],
  "github-copilot-cli": ["copilot", "gh-copilot"],
  "amp-acp": ["amp"],
  "factory-droid": ["droid"],
  cursor: ["cursor-agent", "cursor"],
};

/**
 * Agents the UI should surface. The CDN registry includes ~27 entries; we
 * only expose the ones Zeros has tested end-to-end for the MVP. This is a
 * display-layer filter — the underlying registry still fetches everything,
 * so `findById()` continues to resolve if some other code path references
 * a non-MVP agent.
 *
 * To temporarily expose all agents for dogfooding, set localStorage key
 * `zeros.acp.showAllAgents = "1"` (read by the UI side; engine always
 * filters by default). No recompile needed.
 */
export const MVP_VISIBLE_AGENTS = new Set<string>([
  "claude-acp",
  "codex-acp",
  "amp-acp",
  "factory-droid",
  "cursor",
  "gemini",
  "github-copilot-cli",
]);

/** Detect the current host platform tag as used in the registry schema. */
export function currentPlatform(): Platform | null {
  const plat = process.platform;
  const arch = process.arch;
  if (plat === "darwin" && arch === "arm64") return "darwin-aarch64";
  if (plat === "darwin" && arch === "x64") return "darwin-x86_64";
  if (plat === "linux" && arch === "arm64") return "linux-aarch64";
  if (plat === "linux" && arch === "x64") return "linux-x86_64";
  if (plat === "win32" && arch === "arm64") return "windows-aarch64";
  if (plat === "win32" && arch === "x64") return "windows-x86_64";
  return null;
}

export class RegistryClient {
  private cachePath: string;
  private inFlight: Promise<Registry> | null = null;

  constructor(projectRoot: string) {
    this.cachePath = path.join(projectRoot, ".zeros", "acp", "registry.json");
  }

  /**
   * Return the current registry. Uses on-disk cache if fresh, falls back to
   * it if the network is down. A force refresh bypasses the freshness check.
   */
  async fetch(options?: { force?: boolean }): Promise<Registry> {
    if (!options?.force) {
      const cached = this.readCache();
      if (cached && this.isFresh(cached.fetchedAt)) return cached.registry;
    }

    if (this.inFlight) return this.inFlight;

    this.inFlight = (async () => {
      try {
        const res = await fetch(REGISTRY_URL, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Registry HTTP ${res.status}`);
        const registry = (await res.json()) as Registry;
        this.writeCache(registry);
        return registry;
      } catch (err) {
        // Offline / CDN blip — fall back to whatever we have on disk.
        const cached = this.readCache();
        if (cached) {
          console.warn(
            "[acp registry] refetch failed, serving cache:",
            err instanceof Error ? err.message : err,
          );
          return cached.registry;
        }
        throw err;
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }

  /** Narrow the registry to agents that can run on the current platform. */
  async listRunnable(): Promise<RegistryAgent[]> {
    const reg = await this.fetch();
    const plat = currentPlatform();
    return reg.agents.filter((a) => {
      if (a.distribution.npx) return true;
      if (a.distribution.uvx) return true;
      if (a.distribution.binary && plat) return !!a.distribution.binary[plat];
      return false;
    });
  }

  async findById(id: string): Promise<RegistryAgent | null> {
    const reg = await this.fetch();
    return reg.agents.find((a) => a.id === id) ?? null;
  }

  /**
   * Same as `listRunnable`, plus an `installed` flag per agent (PATH probe
   * for the vendor's own CLI) and a resolved `launchKind`. Runs the PATH
   * probes in parallel so the total cost is one `which` timeout.
   *
   * Filters to the MVP-visible set — non-MVP agents are present in the
   * cache (so `findById()` keeps working for any code path that references
   * them) but never surface in the UI.
   */
  async listEnriched(): Promise<EnrichedRegistryAgent[]> {
    const agents = (await this.listRunnable()).filter((a) =>
      MVP_VISIBLE_AGENTS.has(a.id),
    );
    const plat = currentPlatform();
    return Promise.all(
      agents.map(async (a) => ({
        ...a,
        installed: await detectInstalled(a),
        launchKind: resolveLaunchKind(a, plat),
        authBinary: AGENT_PATH_PROBES[a.id]?.[0],
      })),
    );
  }

  private isFresh(fetchedAt: number): boolean {
    return Date.now() - fetchedAt < CACHE_TTL_MS;
  }

  private readCache(): { registry: Registry; fetchedAt: number } | null {
    try {
      if (!fs.existsSync(this.cachePath)) return null;
      const raw = fs.readFileSync(this.cachePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (
        typeof parsed?.fetchedAt === "number" &&
        parsed.registry?.agents
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private writeCache(registry: Registry): void {
    try {
      fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
      fs.writeFileSync(
        this.cachePath,
        JSON.stringify({ fetchedAt: Date.now(), registry }, null, 2),
        "utf-8",
      );
    } catch (err) {
      console.warn(
        "[acp registry] cache write failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

/**
 * Resolve how to launch this agent on this host. Returns the concrete command
 * and arguments to spawn, plus any env the registry specifies. Throws when no
 * runnable distribution exists for the current platform.
 */
export function resolveLaunch(agent: RegistryAgent): {
  cmd: string;
  args: string[];
  env: Record<string, string>;
} {
  if (agent.distribution.npx) {
    const { package: pkg, args = [], env = {} } = agent.distribution.npx;
    return {
      cmd: process.platform === "win32" ? "npx.cmd" : "npx",
      args: ["--yes", pkg, ...args],
      env,
    };
  }

  if (agent.distribution.uvx) {
    const { package: pkg, args = [], env = {} } = agent.distribution.uvx;
    return { cmd: "uvx", args: [pkg, ...args], env };
  }

  if (agent.distribution.binary) {
    const plat = currentPlatform();
    const target = plat ? agent.distribution.binary[plat] : null;
    if (!target) {
      throw new Error(
        `Agent ${agent.id} has no binary distribution for ${plat ?? "unknown platform"}`,
      );
    }
    return {
      cmd: target.cmd,
      args: target.args ?? [],
      env: target.env ?? {},
    };
  }

  throw new Error(`Agent ${agent.id} has no supported distribution type`);
}

/**
 * Probe the user's PATH for this agent's CLI binary. Returns true only if
 * the binary was hand-installed by the user; npx-only agents always return
 * false here (they can still run on first use via the npm cache).
 */
export async function detectInstalled(agent: RegistryAgent): Promise<boolean> {
  const probes = AGENT_PATH_PROBES[agent.id] ?? [];
  if (probes.length === 0) return false;
  for (const bin of probes) {
    if (await resolveOnPath(bin)) return true;
  }
  return false;
}

/** Same as detectInstalled but returns the absolute path of the first
 *  probe hit, or null. Used to skip the adapter's bundled-binary download
 *  path by pointing it at the user's own install. */
export async function resolveInstalledPath(
  agent: RegistryAgent,
): Promise<string | null> {
  const probes = AGENT_PATH_PROBES[agent.id] ?? [];
  for (const bin of probes) {
    const full = await resolveFullPathOnPath(bin);
    if (full) return full;
  }
  return null;
}

function resolveOnPath(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = process.platform === "win32" ? "where" : "which";
    try {
      const child = spawn(cmd, [bin], { stdio: "ignore" });
      child.once("error", () => resolve(false));
      child.once("exit", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

function resolveFullPathOnPath(bin: string): Promise<string | null> {
  return new Promise((resolve) => {
    const cmd = process.platform === "win32" ? "where" : "which";
    try {
      const child = spawn(cmd, [bin], { stdio: ["ignore", "pipe", "ignore"] });
      let out = "";
      child.stdout.on("data", (b) => (out += String(b)));
      child.once("error", () => resolve(null));
      child.once("exit", (code) => {
        if (code !== 0) return resolve(null);
        const first = out.split(/\r?\n/).map((s) => s.trim()).find((s) => s);
        resolve(first ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

/** Per-agent env var that, when set, makes the adapter use the user's
 *  installed CLI instead of downloading its bundled binary. Absence
 *  means the agent doesn't support swapping (fall back to default). */
const INSTALLED_BINARY_ENV_VAR: Record<string, string> = {
  "claude-acp": "CLAUDE_CODE_EXECUTABLE",
};

/** Build an env-var overlay that points the adapter at the user's
 *  installed CLI when we detected one. Returns an empty object when
 *  no swap is possible — callers merge the result into their env map. */
export async function installedBinaryEnv(
  agent: RegistryAgent,
): Promise<Record<string, string>> {
  const envVar = INSTALLED_BINARY_ENV_VAR[agent.id];
  if (!envVar) return {};
  const full = await resolveInstalledPath(agent);
  if (!full) return {};
  return { [envVar]: full };
}

function resolveLaunchKind(
  agent: RegistryAgent,
  plat: Platform | null,
): EnrichedRegistryAgent["launchKind"] {
  if (agent.distribution.npx) return "npx";
  if (agent.distribution.uvx) return "uvx";
  if (agent.distribution.binary && plat && agent.distribution.binary[plat]) {
    return "binary";
  }
  return "unavailable";
}
