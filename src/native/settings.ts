// ──────────────────────────────────────────────────────────
// Native Settings API — single entry point for user prefs
// ──────────────────────────────────────────────────────────
//
// Phase 0: localStorage-backed (works in Vite dev harness).
// Phase 1: swap to Tauri fs (`~/Library/Application Support/
// zeros/settings.json`) — same call sites, same interface.
//
// ──────────────────────────────────────────────────────────

const PREFIX = "oc-";

export function getSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Legacy plain strings (pre-JSON) — return as-is if T is string-compatible
      return raw as unknown as T;
    }
  } catch {
    return fallback;
  }
}

export function setSetting<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore quota / privacy errors — settings are best-effort.
  }
}

export function removeSetting(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Ignore.
  }
}
