// ──────────────────────────────────────────────────────────
// agents-cache.ts — shared ACP registry snapshot
// ──────────────────────────────────────────────────────────
//
// Both the Settings → Agents panel and the composer's agent pill
// read the same agent list (via `sessions.listAgents()`). Without
// a shared cache each component keeps its own copy and the two
// drift: logging in from Settings leaves the composer with a stale
// `installed: false` for that agent until its local load fires.
//
// This module keeps a single snapshot, lets any consumer subscribe,
// and exposes `refresh()` + `forceRefresh()` that re-hit the engine
// and broadcast the new list. Both panels invalidate this cache on
// window focus so returning from an external terminal `<agent> login`
// flips the state without a manual click.
// ──────────────────────────────────────────────────────────

import { useSyncExternalStore } from "react";
import type { BridgeRegistryAgent } from "../bridge/messages";

type LoadFn = (force?: boolean) => Promise<BridgeRegistryAgent[]>;

let agents: BridgeRegistryAgent[] | null = null;
let lastLoadedAt = 0;
let inFlight: Promise<BridgeRegistryAgent[]> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function getAgentsSnapshot(): BridgeRegistryAgent[] | null {
  return agents;
}

export function subscribeAgents(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Fetch the registry if we don't have one yet, or if the cached
 * snapshot is older than `maxAgeMs`. A concurrent caller with an
 * in-flight load receives the same promise rather than spawning
 * duplicate IPCs.
 */
export async function loadAgents(
  loadFn: LoadFn,
  maxAgeMs: number = 30_000,
): Promise<BridgeRegistryAgent[]> {
  const fresh = agents && Date.now() - lastLoadedAt < maxAgeMs;
  if (fresh && agents) return agents;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const next = await loadFn(false);
      agents = next;
      lastLoadedAt = Date.now();
      emit();
      return next;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * Force a fresh fetch, bypassing the TTL. Used by the heading
 * refresh icon and on window focus to pick up external login.
 */
export async function refreshAgents(
  loadFn: LoadFn,
): Promise<BridgeRegistryAgent[]> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const next = await loadFn(true);
      agents = next;
      lastLoadedAt = Date.now();
      emit();
      return next;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * Invalidate without refetching — forces the next `loadAgents` call
 * to actually hit the engine. Useful when we know state changed but
 * don't want to pay for the IPC right now.
 */
export function invalidateAgentsCache(): void {
  lastLoadedAt = 0;
}

/** React hook — returns the current snapshot (null until first load). */
export function useAgentsSnapshot(): BridgeRegistryAgent[] | null {
  return useSyncExternalStore(subscribeAgents, getAgentsSnapshot, getAgentsSnapshot);
}
