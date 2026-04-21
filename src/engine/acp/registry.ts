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
    this.cachePath = path.join(projectRoot, ".0canvas", "acp", "registry.json");
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
