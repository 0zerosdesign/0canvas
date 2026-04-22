// ──────────────────────────────────────────────────────────
// useEnabledAgents — universal (per-user, not per-project) state
// ──────────────────────────────────────────────────────────
//
// Which ACP agents appear in the chat-composer "new chat" picker.
// Everything the user sees in the Agents settings panel can be
// toggled on/off; toggled-on agents show up in the picker, off ones
// are hidden. Persists across projects and relaunches via
// localStorage.
//
// First-run semantics: if the key is absent we treat ALL registry
// agents as enabled (so upgrading users don't suddenly see an empty
// picker). The first explicit toggle writes the full concrete list
// — from then on, enabled ≠ disabled is a real distinction and new
// registry entries do NOT auto-enable (user picks them in Settings).
// ──────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "zeros.acp.enabledAgents";

type PersistedShape = { ids: string[] } | null;

function readPersisted(): PersistedShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { ids?: unknown }).ids)
    ) {
      return { ids: (parsed as { ids: string[] }).ids.filter((x) => typeof x === "string") };
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

export interface UseEnabledAgentsApi {
  /** Returns true when an agent id is enabled (accounting for first-run default-on). */
  isEnabled: (id: string) => boolean;
  /** Flip the enabled state for this id; seeds the explicit list on first call. */
  toggle: (id: string, allKnownIds: string[]) => void;
  /** True once the user has made any explicit choice — useful for UI affordances. */
  hasExplicitChoice: boolean;
}

export function useEnabledAgents(): UseEnabledAgentsApi {
  // Initial state read synchronously to avoid a flicker between "all
  // enabled" (default) and "persisted subset" on mount.
  const [persisted, setPersisted] = useState<PersistedShape>(() => readPersisted());

  // Cross-tab / multi-window sync. Electron typically only has one
  // renderer, but this costs nothing and prevents drift if the user
  // opens devtools + the app simultaneously writing to storage.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setPersisted(readPersisted());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isEnabled = useCallback(
    (id: string): boolean => {
      if (!persisted) return true; // first-run: all on
      return persisted.ids.includes(id);
    },
    [persisted],
  );

  const toggle = useCallback(
    (id: string, allKnownIds: string[]) => {
      setPersisted((prev) => {
        // Seed from "all known" on first toggle so the user's explicit
        // choice is preserved rather than silently diverging from the
        // default-on assumption.
        const base = prev ? prev.ids.slice() : allKnownIds.slice();
        const idx = base.indexOf(id);
        if (idx >= 0) base.splice(idx, 1);
        else base.push(id);
        writePersisted(base);
        return { ids: base };
      });
    },
    [],
  );

  return {
    isEnabled,
    toggle,
    hasExplicitChoice: persisted !== null,
  };
}
