// ──────────────────────────────────────────────────────────
// Model catalog — agent-driven + remote-updated + bundled fallback
// ──────────────────────────────────────────────────────────
//
// The agent itself is our source of truth — the composer model pill
// prefers whatever the agent advertises. When the agent says nothing,
// we consult a remote catalog file (hot-updatable without app
// releases). When even that's unreachable we fall back to the
// bundled catalog that shipped with the app.
//
// Resolution order per agent family:
//   1. Agent's InitializeResponse._meta.models          (agent wins)
//   2. Remote catalog fetched from REMOTE_CATALOG_URL   (hot updates)
//   3. Bundled `catalogs/models-v1.json`                (offline-safe)
//
// Why three layers?
//   - Agents adopt the spec incrementally. Until every agent wrapper
//     populates _meta.models we need a central place to patch.
//   - The remote catalog lets us ship a model-list update without
//     cutting a new app release — users get it on next boot (24h
//     cache) or immediately via the Refresh button in the pill.
//   - The bundled copy guarantees the app works offline and gives
//     a sane default on day zero.
// ──────────────────────────────────────────────────────────

import type { InitializeResponse } from "../bridge/agent-events";
import bundledCatalog from "../../../catalogs/models-v1.json";

export type ModelOption = {
  value: string;
  label: string;
  badge?: string;
};

export interface CatalogFile {
  version: number;
  updatedAt: string;
  families: Record<string, ModelOption[]>;
  modelEnvVars: Record<string, string>;
}

/** Default remote URL. Served from GitHub Pages, published on every
 *  merge to `main` by `.github/workflows/publish-catalogs.yml`.
 *
 *  Why GitHub Pages over jsDelivr / CloudFront / our own S3?
 *   - Zero infra to maintain beyond "ship a workflow".
 *   - Cache-busting is automatic on merge; no 7-day jsDelivr lag.
 *   - The source JSON lives in THIS repo, versioned next to the
 *     adapter code that consumes it — one PR updates both.
 *
 *  Override in Settings → Agents → Model catalog for self-hosting
 *  or to point at a staging branch during a catalog experiment. */
const DEFAULT_REMOTE_URL =
  "https://withso.github.io/zeros/catalogs/models-v1.json";

const CACHE_KEY = "model-catalog-v1-cache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 5_000;

type CachedCatalog = {
  fetchedAt: number;
  url: string;
  catalog: CatalogFile;
};

export type CatalogSource = "remote" | "cache" | "bundled";

// Module-scoped promise so concurrent callers share one fetch.
let loadingPromise: Promise<CatalogFile> | null = null;
let activeCatalog: CatalogFile = bundledCatalog as CatalogFile;
let lastSource: CatalogSource = "bundled";

export function catalogSource(): CatalogSource {
  return lastSource;
}

/** Prefix-match agent id → family. Wrapper variants (claude-acp,
 *  claude, @anthropic-ai/claude-code, etc.) all resolve here. */
export function agentFamily(agentId: string | null): string {
  if (!agentId) return "";
  const id = agentId.toLowerCase();
  if (id.includes("claude")) return "claude";
  if (id.includes("codex") || id.includes("openai")) return "codex";
  if (id.includes("gemini")) return "gemini";
  if (id.includes("amp")) return "amp";
  if (id.includes("auggie") || id.includes("augment")) return "augment";
  return "";
}

// ── Remote-catalog load + cache ──────────────────────────

function readCache(): CachedCatalog | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    if (
      !parsed ||
      typeof parsed.fetchedAt !== "number" ||
      !parsed.catalog ||
      typeof parsed.catalog.version !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(url: string, catalog: CatalogFile): void {
  if (typeof window === "undefined") return;
  const entry: CachedCatalog = {
    fetchedAt: Date.now(),
    url,
    catalog,
  };
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* quota or private browsing — next fetch will retry */
  }
}

function isCacheFresh(entry: CachedCatalog, url: string): boolean {
  return entry.url === url && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

function validateCatalog(x: unknown): x is CatalogFile {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.version === "number" &&
    typeof o.families === "object" &&
    o.families !== null &&
    typeof o.modelEnvVars === "object" &&
    o.modelEnvVars !== null
  );
}

async function fetchRemote(url: string): Promise<CatalogFile | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as unknown;
    if (!validateCatalog(json)) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function getRemoteUrl(): string {
  // Look in localStorage for a user-configured override (settings page
  // writes here). Falls back to the default CDN URL.
  if (typeof window !== "undefined") {
    try {
      const override = window.localStorage.getItem(
        "model-catalog-remote-url",
      );
      if (override) return override;
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_REMOTE_URL;
}

/** Idempotent — kicks off a remote fetch the first time it's called.
 *  Subsequent calls within the cache TTL reuse the cached result. */
export async function loadCatalog(options?: {
  force?: boolean;
}): Promise<CatalogFile> {
  const url = getRemoteUrl();

  if (!options?.force) {
    const cached = readCache();
    if (cached && isCacheFresh(cached, url)) {
      activeCatalog = cached.catalog;
      lastSource = "cache";
      return cached.catalog;
    }
  }

  if (loadingPromise && !options?.force) return loadingPromise;

  loadingPromise = (async () => {
    const remote = await fetchRemote(url);
    if (remote) {
      writeCache(url, remote);
      activeCatalog = remote;
      lastSource = "remote";
      return remote;
    }
    // Network fail — if we had ANY cache (stale or otherwise), use it.
    const cached = readCache();
    if (cached) {
      activeCatalog = cached.catalog;
      lastSource = "cache";
      return cached.catalog;
    }
    activeCatalog = bundledCatalog as CatalogFile;
    lastSource = "bundled";
    return bundledCatalog as CatalogFile;
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

/** Sync accessor used by React components that already have catalog
 *  data (post-load). Returns the latest catalog we've seen this
 *  session (falls back to bundled before any load runs). */
export function currentCatalog(): CatalogFile {
  return activeCatalog;
}

/** Clear cache and refetch. Called from the pill's Refresh button
 *  and from Settings → Agents → Refresh models. */
export async function refreshCatalog(): Promise<CatalogFile> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
  return loadCatalog({ force: true });
}

// ── Meta type guards ──────────────────────────────────────

function isModelOption(x: unknown): x is ModelOption {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.value === "string" && typeof o.label === "string";
}

function extractMetaModels(
  initialize: InitializeResponse | null,
): ModelOption[] | null {
  const meta = initialize?._meta as
    | { models?: unknown; modelEnvVar?: unknown }
    | undefined;
  if (!meta || !Array.isArray(meta.models)) return null;
  const valid = meta.models.filter(isModelOption);
  return valid.length > 0 ? valid : null;
}

// ── Public API ────────────────────────────────────────────

/** Resolve the model catalog for the given agent. Prefers the agent's
 *  own `initialize._meta.models`; falls back to the active catalog's
 *  family map (remote-fetched or bundled). */
export function modelsForAgent(
  agentId: string | null,
  initialize: InitializeResponse | null,
): ModelOption[] {
  const advertised = extractMetaModels(initialize);
  if (advertised) return advertised;
  return activeCatalog.families[agentFamily(agentId)] ?? [];
}

/** Resolve the env var name for a model override. Agent's
 *  `_meta.modelEnvVar` wins when provided. */
export function modelEnvVarForAgent(
  agentId: string | null,
  initialize: InitializeResponse | null,
): string | undefined {
  const meta = initialize?._meta as { modelEnvVar?: unknown } | undefined;
  if (typeof meta?.modelEnvVar === "string") return meta.modelEnvVar;
  return activeCatalog.modelEnvVars[agentFamily(agentId)];
}

/** Env var for thinking effort. Zeros convention, not agent spec. */
export const EFFORT_ENV_VAR = "ZEROS_THINKING_EFFORT";

/** Build env map from a chat's composer settings. */
export function envForChatSettings(args: {
  agentId: string | null;
  initialize: InitializeResponse | null;
  model: string | null;
  effort: string;
}): Record<string, string> {
  const env: Record<string, string> = {};
  const modelEnv = modelEnvVarForAgent(args.agentId, args.initialize);
  if (args.model && modelEnv) env[modelEnv] = args.model;
  env[EFFORT_ENV_VAR] = args.effort;
  return env;
}

/** Human-readable "updated" metadata for the Refresh button. */
export function catalogUpdatedAt(): string {
  return activeCatalog.updatedAt;
}
