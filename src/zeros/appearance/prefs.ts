// ──────────────────────────────────────────────────────────
// Appearance prefs — types + defaults + neutral palettes
// ──────────────────────────────────────────────────────────
//
// The user-facing appearance system (Cursor-style):
//   - mode               picks the fixed neutral palette
//   - hue                accent color in OKLCH (0–360°)
//   - intensity          scales accent chroma (0–1, capped)
//   - reduceTransparency replaces translucent surfaces with opaque
//
// We deliberately do NOT expose surface/ink/contrast to the user.
// Those are locked per mode so the UI is guaranteed-readable
// regardless of what the user picks. Users get personality (any
// hue, any intensity) without the ability to break the UI.
//
// The 4-input system is the exact contract DPCode and Cursor settled
// on after years of theme-system iteration. See docs/themes.md for
// the math (Phase 1 ships the engine, the docs land in Phase 4).
// ──────────────────────────────────────────────────────────

export type ThemeMode = "system" | "light" | "dark" | "high-contrast";

/** Resolved variant after `system` is decided via prefers-color-scheme.
 *  This is what gets written to the document's data-theme attribute. */
export type ThemeVariant = "light" | "dark" | "high-contrast";

export interface AppearancePrefs {
  mode: ThemeMode;
  /** OKLCH hue, 0–360. Default 252.9 = the hue of the previous static
   *  Zeros accent (#3B9EFF) so the engine ships with visual identity
   *  to the pre-OKLCH state. */
  hue: number;
  /** 0–1, multiplied by the mode's max chroma to produce the accent's
   *  actual chroma. 1 = full saturation (capped per mode), 0 = neutral. */
  intensity: number;
  reduceTransparency: boolean;
}

export const DEFAULT_PREFS: AppearancePrefs = {
  mode: "dark",
  hue: 252.9,
  intensity: 1.0,
  reduceTransparency: false,
};

/** Per-mode palette anchors. The L (lightness) is fixed so the accent
 *  stays at the same perceived weight regardless of hue. The chroma
 *  ceiling is mode-dependent — light mode benefits from less chroma at
 *  L≈0.55 because the same C reads heavier on a white surface.
 *
 *  Phase 1 ships dark only as the active mode. Light + high-contrast
 *  values are pre-defined here so Phase 2 only has to wire the mode
 *  picker — no engine work. */
export const NEUTRAL_PALETTES: Record<
  ThemeVariant,
  { accentL: number; accentMaxChroma: number }
> = {
  dark: {
    accentL: 0.665,
    accentMaxChroma: 0.150,
  },
  light: {
    accentL: 0.55,
    accentMaxChroma: 0.140,
  },
  "high-contrast": {
    accentL: 0.75,
    accentMaxChroma: 0.180,
  },
};

/** Hard upper bound on chroma to keep the accent inside sRGB across
 *  every hue. Above ~0.2 chroma some hues clip at this lightness range,
 *  which the browser then gamut-maps — usually invisibly, but it can
 *  make the slider feel like it stops working past a point. Cap below
 *  the cliff. Per-mode caps in NEUTRAL_PALETTES sit under this. */
export const MAX_CHROMA = 0.2;

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
