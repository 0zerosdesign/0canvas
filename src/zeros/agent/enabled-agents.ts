// ──────────────────────────────────────────────────────────
// useEnabledAgents — universal (per-user, not per-project) state
// ──────────────────────────────────────────────────────────
//
// Which agents appear in the chat-composer picker. Toggled-on
// agents show up; off ones are hidden. Persists across projects and
// relaunches via localStorage.
//
// State is held in a module-level store so every consumer sees the
// same snapshot — a toggle in Settings → Agents propagates to an
// already-mounted composer pill in the same render cycle.
//
// First-run semantics: if the key is absent we treat ALL registry
// agents as enabled (so upgrading users don't suddenly see an empty
// picker). The first explicit toggle writes the full concrete list
// — from then on enabled ≠ disabled is a real distinction and new
// registry entries do NOT auto-enable.
// ──────────────────────────────────────────────────────────

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "zeros.agent.enabledAgents";
/** Pre-rename key. Read once on first hit and migrated forward;
 *  removed from localStorage afterwards so we don't keep two copies. */
const LEGACY_STORAGE_KEY = "zeros.acp.enabledAgents";

type PersistedShape = { ids: string[] } | null;

function readPersisted(): PersistedShape {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Backward-compat: migrate any pre-rename data forward, then
      // drop the legacy key so subsequent reads stay on the new key.
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        try {
          localStorage.setItem(STORAGE_KEY, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          /* storage quota / private mode — fall back to read-only */
        }
        raw = legacy;
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { ids?: unknown }).ids)
    ) {
      return {
        ids: (parsed as { ids: string[] }).ids.filter(
          (x) => typeof x === "string",
        ),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writePersisted(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids }));
  } catch {
    /* storage quota / private mode — non-fatal */
  }
}

// ── Shared module-level store ───────────────────────────
let current: PersistedShape = readPersisted();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: PersistedShape): void {
  current = next;
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): PersistedShape {
  return current;
}

// Cross-tab sync — in Electron this covers devtools-in-a-separate-
// window and any future multi-window setup. Watches both the new key
// and the legacy one so a stale tab writing the old key still
// triggers a refresh while migration is in progress.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY && e.key !== LEGACY_STORAGE_KEY) return;
    setState(readPersisted());
  });
}

export interface UseEnabledAgentsApi {
  isEnabled: (id: string) => boolean;
  toggle: (id: string, allKnownIds: string[]) => void;
  hasExplicitChoice: boolean;
}

export function useEnabledAgents(): UseEnabledAgentsApi {
  const persisted = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const isEnabled = useCallback(
    (id: string): boolean => {
      if (!persisted) return true; // first-run: all on
      return persisted.ids.includes(id);
    },
    [persisted],
  );

  const toggle = useCallback((id: string, allKnownIds: string[]) => {
    const base = current ? current.ids.slice() : allKnownIds.slice();
    const idx = base.indexOf(id);
    if (idx >= 0) base.splice(idx, 1);
    else base.push(id);
    writePersisted(base);
    setState({ ids: base });
  }, []);

  // No-op effect kept for API symmetry — the module-level listener
  // already handles cross-tab sync. Including it keeps the hook from
  // being called-then-uncalled in StrictMode mount sequences without
  // registering cleanup logic.
  useEffect(() => {}, []);

  return {
    isEnabled,
    toggle,
    hasExplicitChoice: persisted !== null,
  };
}
