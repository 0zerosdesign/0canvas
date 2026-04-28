// ──────────────────────────────────────────────────────────
// Appearance prefs — types + defaults + neutral palettes
// ──────────────────────────────────────────────────────────
//
// The user-facing appearance system (Cursor-style):
//   - mode               picks the fixed neutral palette
//   - hue                hue used to TINT the chrome (surfaces +
//                        borders) — NOT the accent
//   - intensity          0–1, scales how much tint mixes into the
//                        neutral surfaces (capped per mode so even
//                        100% looks tasteful, not loud)
//   - reduceTransparency replaces translucent surfaces with opaque
//
// Crucially, `hue` and `intensity` do NOT touch the brand accent
// (buttons, focus rings, links). That's what Cursor does: drag the
// hue slider and only the chrome warms/cools — the call-to-action
// blue stays branded. Accent gets its own picker later (separate
// `accent` field, defaults to brand blue).
//
// We deliberately do NOT expose surface/ink/contrast to the user.
// Those are locked per mode so the UI is guaranteed-readable
// regardless of what the user picks. Users get personality (any
// hue × any intensity) without the ability to break the UI.
// ──────────────────────────────────────────────────────────

export type ThemeMode = "system" | "light" | "dark" | "high-contrast";

/** Resolved variant after `system` is decided via prefers-color-scheme.
 *  This is what gets written to the document's data-theme attribute. */
export type ThemeVariant = "light" | "dark" | "high-contrast";

export interface AppearancePrefs {
  mode: ThemeMode;
  /** OKLCH hue, 0–360. The hue used to tint the chrome (surfaces +
   *  borders). Does NOT change the brand accent. Default 252.9 = the
   *  hue of the existing Zeros slate ramp so visuals are unchanged
   *  at default prefs. */
  hue: number;
  /** 0–1, multiplied by the mode's `maxTintMix` to produce the actual
   *  surface tint percentage. 0 = pure neutral (no hue visible),
   *  1 = full mix (capped per mode so it stays subtle). */
  intensity: number;
  reduceTransparency: boolean;
}

export const DEFAULT_PREFS: AppearancePrefs = {
  mode: "dark",
  hue: 252.9,
  intensity: 1.0,
  reduceTransparency: false,
};

/** Per-mode tint mix ceilings. Surfaces and borders mix the user's
 *  tint color into the base neutral grey; these constants set how
 *  much tint shows at intensity=1.
 *
 *  Light mode uses smaller percentages because tint reads heavier on
 *  white surfaces — 5% mix on dark slate is barely visible, the same
 *  5% on white is a colored cast. High-contrast keeps tint minimal so
 *  legibility wins.
 *
 *  Surface gets the headline tint amount. Borders get half — enough
 *  to feel cohesive with the surface without competing with the
 *  text/foreground contrast. */
export const NEUTRAL_PALETTES: Record<
  ThemeVariant,
  { maxSurfaceTintPct: number; maxBorderTintPct: number }
> = {
  dark: {
    maxSurfaceTintPct: 5,
    maxBorderTintPct: 3,
  },
  light: {
    maxSurfaceTintPct: 3,
    maxBorderTintPct: 2,
  },
  "high-contrast": {
    maxSurfaceTintPct: 1,
    maxBorderTintPct: 1,
  },
};

/** OKLCH lightness + chroma for the user's tint color. Mid-tone
 *  saturated so the mix has obvious hue character but not so vivid
 *  that low-percentage mixes shift the surface lightness much. */
export const TINT_LIGHTNESS = 0.55;
export const TINT_CHROMA = 0.22;

export const STORAGE_KEY = "zeros.appearance.v1";

/** Resolve `mode` to a concrete variant. `system` reads the OS prefer
 *  via the media query at the call site (the store owns the listener,
 *  so this helper takes the dark/light hint as an argument). */
export function resolveVariant(
  mode: ThemeMode,
  systemPrefersDark: boolean,
): ThemeVariant {
  if (mode === "system") return systemPrefersDark ? "dark" : "light";
  return mode;
}
