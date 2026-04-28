// ──────────────────────────────────────────────────────────
// Appearance prefs — types + defaults + neutral palettes
// ──────────────────────────────────────────────────────────
//
// The user-facing appearance system (Cursor-style):
//
//   Chrome tint (the "filter on top of the UI" feel):
//     - mode       light/dark/system/high-contrast → neutral palette
//     - hue        0–360°, hue of the chrome tint
//     - intensity  0–1, scales the surface tint mix percentage
//
//   Brand accent (separate slot — buttons, focus rings, links):
//     - accent     0–360°, hue ONLY. We fix L + C ourselves so the
//                  accent stays in a "tasteful brand" range no matter
//                  what hue the user picks.
//
//   Accessibility:
//     - reduceTransparency
//
// Why this split: in Cursor, dragging the hue slider tints the
// chrome but leaves the upgrade button blue. We replicate exactly:
// (hue, intensity) drive only --zeros-tint-color/-mix-* (consumed by
// surface + border color-mix recipes); accent drives --zeros-accent
// (consumed by the entire button/link/ring family).
//
// We deliberately do NOT expose surface/ink/contrast/accent-L/
// accent-C to the user. Those are locked so the UI is guaranteed-
// readable AND the accent stays in a sensible saturation range no
// matter what hue the user picks. Personality (any chrome hue +
// any intensity + any accent hue) without the ability to break the
// UI or pick a sickly olive-green button.
// ──────────────────────────────────────────────────────────

export type ThemeMode = "system" | "light" | "dark" | "high-contrast";

/** Resolved variant after `system` is decided via prefers-color-scheme.
 *  This is what gets written to the document's data-theme attribute. */
export type ThemeVariant = "light" | "dark" | "high-contrast";

export interface AppearancePrefs {
  mode: ThemeMode;
  /** OKLCH hue (0–360) for the chrome tint — surfaces and borders.
   *  Does NOT change the brand accent. */
  hue: number;
  /** 0–1, scales the chrome tint mix percentage (capped per mode). */
  intensity: number;
  /** OKLCH hue (0–360) for the brand accent — buttons, focus rings,
   *  link text, selection. L and C are fixed (see ACCENT_LIGHTNESS /
   *  ACCENT_CHROMA below) so the accent stays at a consistent visual
   *  weight regardless of which hue the user picks. */
  accent: number;
  reduceTransparency: boolean;
}

export const DEFAULT_PREFS: AppearancePrefs = {
  mode: "dark",
  hue: 252.9,
  intensity: 1.0,
  accent: 252.9,
  reduceTransparency: false,
};

/** Per-mode tint mix ceilings. Surfaces and borders mix the user's
 *  tint color into the base neutral grey; these constants set how
 *  much tint shows at intensity=1.
 *
 *  Bumped from earlier (5%/3% → 8%/5% for dark) so the "filter feel"
 *  is visible at full intensity rather than barely-detectable. The
 *  difference between 0% and 100% should read as "yes, the chrome
 *  is tinted" rather than "did anything change?".
 *
 *  Light mode stays smaller because tint reads heavier on white
 *  surfaces. High-contrast stays minimal because legibility wins.
 *
 *  Surface gets the headline tint amount. Borders get a smaller
 *  share — they sit at the boundary between surface and content, so
 *  they shouldn't compete with the text/foreground contrast. */
export const NEUTRAL_PALETTES: Record<
  ThemeVariant,
  { maxSurfaceTintPct: number; maxBorderTintPct: number }
> = {
  dark: {
    maxSurfaceTintPct: 8,
    maxBorderTintPct: 5,
  },
  light: {
    maxSurfaceTintPct: 5,
    maxBorderTintPct: 3,
  },
  "high-contrast": {
    maxSurfaceTintPct: 2,
    maxBorderTintPct: 1,
  },
};

/** OKLCH lightness + chroma for the chrome tint color (NOT accent).
 *  Mid-tone saturated so the color-mix has obvious hue character
 *  without shifting surface lightness much at low percentages. */
export const TINT_LIGHTNESS = 0.55;
export const TINT_CHROMA = 0.22;

/** OKLCH lightness + chroma for the brand accent. We fix these and
 *  let the user pick only the hue — guaranteed in-gamut, guaranteed
 *  visually consistent across every hue choice. Matches the previous
 *  static blue (#3B9EFF ≈ oklch(0.665 0.150 252.9)) so the default
 *  accent looks unchanged from before the picker existed. */
export const ACCENT_LIGHTNESS = 0.665;
export const ACCENT_CHROMA = 0.15;

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
