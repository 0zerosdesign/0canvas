// ──────────────────────────────────────────────────────────
// Appearance store — useSyncExternalStore + localStorage
// ──────────────────────────────────────────────────────────
//
// Why useSyncExternalStore and not Context/Zustand:
//   - Theme reads happen on every render of every theme-aware
//     component. useSyncExternalStore is the React-blessed way to
//     read external state without re-render storms.
//   - Theme application has to happen BEFORE first paint to avoid
//     a flash of wrong colors. We apply on module load (synchronous
//     localStorage read) and again whenever prefs change.
//   - Cross-tab / cross-window sync via the StorageEvent listener
//     keeps multiple Zeros windows aligned without IPC plumbing.
//
// The store is a singleton — there's only one document, and multiple
// providers would race on setProperty. Provider mounts the listener,
// store does the heavy lifting.
// ──────────────────────────────────────────────────────────

import { applyTheme } from "./derive";
import {
  DEFAULT_PREFS,
  STORAGE_KEY,
  type AppearancePrefs,
} from "./prefs";

let prefs: AppearancePrefs = readStoredPrefs();
const subscribers = new Set<() => void>();

function readStoredPrefs(): AppearancePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>;
    if (!parsed || typeof parsed !== "object") return DEFAULT_PREFS;
    return {
      mode:
        parsed.mode === "system" ||
        parsed.mode === "light" ||
        parsed.mode === "dark" ||
        parsed.mode === "high-contrast"
          ? parsed.mode
          : DEFAULT_PREFS.mode,
      hue:
        typeof parsed.hue === "number" && Number.isFinite(parsed.hue)
          ? parsed.hue
          : DEFAULT_PREFS.hue,
      intensity:
        typeof parsed.intensity === "number" && Number.isFinite(parsed.intensity)
          ? parsed.intensity
          : DEFAULT_PREFS.intensity,
      accent:
        typeof parsed.accent === "number" && Number.isFinite(parsed.accent)
          ? parsed.accent
          : DEFAULT_PREFS.accent,
      reduceTransparency:
        typeof parsed.reduceTransparency === "boolean"
          ? parsed.reduceTransparency
          : DEFAULT_PREFS.reduceTransparency,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function persist(next: AppearancePrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — fall through, next read returns defaults */
  }
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function emit(): void {
  for (const fn of subscribers) fn();
}

/** Apply current prefs to the document. Called on module load (so
 *  first paint has the right tokens) and on every prefs / system
 *  variant change. */
function flush(): void {
  applyTheme(prefs, { systemPrefersDark: systemPrefersDark() });
}

export function getPrefs(): AppearancePrefs {
  return prefs;
}

export function setPrefs(patch: Partial<AppearancePrefs>): void {
  prefs = { ...prefs, ...patch };
  persist(prefs);
  flush();
  emit();
}

export function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

// Apply on module load — runs before React mounts so first paint has
// the user's last-saved prefs (no flash of default theme).
if (typeof document !== "undefined") {
  flush();
}

// Console-accessible API for ad-hoc theme testing without shipping a
// settings UI yet. Bundled paths in packaged builds make
// `import("/src/zeros/appearance/store.ts")` from the DevTools console
// fail (the .ts file doesn't exist on disk), so we attach the public
// surface to `window.zerosAppearance` instead. Same hook works in dev
// and prod. Phase 4 will add the proper Settings → Appearance UI.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).zerosAppearance = {
    getPrefs,
    setPrefs,
    subscribe,
  };
}

// Cross-tab + system-mode reactivity. Only wired in a browser-ish env
// (window must exist). Listeners live for the lifetime of the page.
if (typeof window !== "undefined") {
  // Reflect system theme changes when mode === "system".
  if (window.matchMedia) {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (prefs.mode === "system") {
        flush();
        emit();
      }
    };
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onSystemChange);
    } else if (typeof mql.addListener === "function") {
      mql.addListener(onSystemChange);
    }
  }

  // Cross-window sync — when another Zeros window writes prefs, mirror
  // them here so both windows stay aligned without IPC plumbing.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const next = JSON.parse(e.newValue) as Partial<AppearancePrefs>;
      prefs = { ...DEFAULT_PREFS, ...prefs, ...next };
      flush();
      emit();
    } catch {
      /* malformed payload — ignore */
    }
  });
}
