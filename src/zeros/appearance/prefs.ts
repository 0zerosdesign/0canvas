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

/** Per-mode chroma caps for surfaces and borders.
 *
 *  Each surface is built as `oklch(L_def  intensity*cap*surface_scale  user_hue)`
 *  so its lightness is preserved and only chroma + hue change. The
 *  surface_scale is per-surface (see SURFACE_DEFS).
 *
 *  Caps are *asymmetric per mode* and follow the Tailwind v4 / Radix
 *  cardinal rule: **chroma must DECREASE as L approaches 1.0** because
 *  perception amplifies chroma at high lightness. Tailwind v4 ramp
 *  encodes this exactly:
 *    L 0.984 → chroma 0.003
 *    L 0.929 → chroma 0.013
 *    L 0.869 → chroma 0.022
 *
 *  JND (just-noticeable-difference) for OKLCH chroma against neutral
 *  is ~0.004. Practical thresholds for tinted-white surfaces:
 *    chroma 0.001–0.003 → "warmth/coolness" only (Apple system grays)
 *    chroma 0.003–0.008 → "barely tinted" (Radix Slate/Mauve)
 *    chroma 0.010–0.020 → "obviously tinted" (Tailwind sky-50/blue-50)
 *    chroma > 0.025 at L > 0.95 → reads as "alert tint" not chrome
 *
 *  Tuned values (LIGHT cap is intentionally LOW — light surfaces
 *  amplify chroma, so we stay in the JND "barely tinted" zone even
 *  at 100% intensity. The whole point of light mode is that subtle,
 *  airy "feels light" reading; an obviously-tinted chrome at full
 *  intensity defeats that):
 *    Dark          surface 0.040  border 0.050
 *    Light         surface 0.007  border 0.012
 *    High-contrast surface 0.005  border 0.008
 *
 *  Light surface cap 0.007 sits at the top of the "barely tinted"
 *  band (0.003–0.008) — Radix Slate / Cursor live here. Border cap
 *  0.012 is just above so 1px borders still read tinted (thin lines
 *  need more chroma than fills to register). Every light surface uses
 *  chromaScale=1, so chrome/canvas/cards all wash uniformly at this
 *  low chroma — matches Cursor's actual behavior at 100% (uniform
 *  faint wash, not "card pops off tinted page"). */
export const NEUTRAL_PALETTES: Record<
  ThemeVariant,
  { maxSurfaceChroma: number; maxBorderChroma: number }
> = {
  dark: {
    maxSurfaceChroma: 0.040,
    maxBorderChroma: 0.050,
  },
  light: {
    maxSurfaceChroma: 0.007,
    maxBorderChroma: 0.012,
  },
  "high-contrast": {
    maxSurfaceChroma: 0.005,
    maxBorderChroma: 0.008,
  },
};

/** OKLCH lightness + chroma used for the swatch preview only — the
 *  little circle next to the hue slider. Surfaces no longer mix this
 *  color in; they use --zeros-tint-c-surface directly at their own
 *  lightness. The swatch wants a single, vivid representation of
 *  "what hue did I pick", so it stays a fixed saturated mid-tone. */
export const TINT_LIGHTNESS = 0.55;
export const TINT_CHROMA = 0.22;

/** Surface definition: each --surface-N / --border-N has its own
 *  lightness AND its own intensity-scaled chroma multiplier.
 *
 *  Why a per-surface chroma multiplier (not a single per-mode cap):
 *  Cursor's light theme intentionally tints chrome (titlebar, sidebar,
 *  page bg) but leaves cards / inputs / raised content pure white —
 *  cards "pop" off the tinted page. To replicate this, the chrome
 *  surfaces have chromaScale=1 (full tint), the canvas is half-tinted,
 *  and elevated surfaces are pure neutral (chromaScale=0). Borders
 *  carry a smaller share so they read cohesive without dominating.
 *
 *  Dark mode keeps the original simple ladder where every surface
 *  takes the full tint — the user already confirmed that mode reads
 *  well, so we leave it alone (chromaScale=1 across the board).
 *
 *  CRITICAL: dark surface Ls must stay in sync with tokens.css
 *  `--grey-N` hexes. If a grey hex changes, recompute the L here. */
export interface SurfaceDef {
  /** OKLCH lightness 0–1, fixed per variant. */
  L: number;
  /** Multiplier on the per-mode chroma cap, 0–1. */
  chromaScale: number;
}

export interface SurfaceDefs {
  surfaces: {
    floor: SurfaceDef;
    s0: SurfaceDef;
    s1: SurfaceDef;
    s2: SurfaceDef;
    s3: SurfaceDef;
  };
  borders: {
    bSubtle: SurfaceDef;
    bDefault: SurfaceDef;
    bStrong: SurfaceDef;
  };
}

export const SURFACE_DEFS: Record<ThemeVariant, SurfaceDefs> = {
  /* Dark: monotonic ladder (floor darkest, s3 lightest), uniform tint
     across all surfaces. Matches Radix slate dark + the user's
     confirmed-good chrome at full tint. Ls correspond to the OKLCH
     lightness of grey-0..4 hexes in tokens.css (kept in sync). */
  // check:ui ignore-next
  // (hex literals below are documentation references, not usage)
  dark: {
    surfaces: {
      floor: { L: 0.166, chromaScale: 1 }, /* L of grey-0 */
      s0:    { L: 0.180, chromaScale: 1 }, /* L of grey-1 */
      s1:    { L: 0.220, chromaScale: 1 }, /* L of grey-2 */
      s2:    { L: 0.262, chromaScale: 1 }, /* L of grey-3 */
      s3:    { L: 0.295, chromaScale: 1 }, /* L of grey-4 */
    },
    borders: {
      bSubtle:  { L: 0.262, chromaScale: 1 },
      bDefault: { L: 0.328, chromaScale: 1 },
      bStrong:  { L: 0.422, chromaScale: 1 },
    },
  },
  /* Light: same elevation pattern as dark mode (lower = darker, higher
     = lighter / closer to white) so the visual hierarchy is consistent
     across themes. Every surface tints uniformly when intensity > 0
     (chromaScale=1 across the board) so the whole UI reads as one
     coherent tinted state — chrome/canvas/cards/hover/active all
     share the user's hue.

     Elevation ladder (low → high):
       floor (chrome / titlebar / sidebar) — clearly gray; the "frame"
                                             of the app at L=0.935
       s0    (canvas / page body)          — paper feel; near-white but
                                             distinct from cards
       s1    (raised: cards/inputs/popovers/composer) — effectively
                                             white; pops above canvas
                                             so chat input + dropdowns
                                             don't blend in
       s2    (hover state)                 — press-in darken from s0/s1
       s3    (active / selected)           — clearly pressed

     L values chosen for in-gamut safety across the full hue spectrum.
     L=0.992 for cards is the sweet spot: visually "white" but allows
     chroma 0.018 for any hue (including yellow which has the tightest
     gamut at high L). */
  light: {
    surfaces: {
      floor: { L: 0.935, chromaScale: 1.0 }, // chrome — clear gray frame
      s0:    { L: 0.968, chromaScale: 1.0 }, // canvas — paper feel
      s1:    { L: 0.992, chromaScale: 1.0 }, // raised — pops above canvas
      s2:    { L: 0.945, chromaScale: 1.0 }, // hover — press-in from canvas
      s3:    { L: 0.918, chromaScale: 1.0 }, // active — clearly pressed
    },
    borders: {
      bSubtle:  { L: 0.905, chromaScale: 1.0 },
      bDefault: { L: 0.870, chromaScale: 1.0 }, // visible card edges
      bStrong:  { L: 0.810, chromaScale: 1.0 }, // emphasis / focus rings
    },
  },
  /* High-contrast: legibility wins. Same Ls as dark mode, minimal
     chroma scaling so the chrome stays close to neutral. */
  "high-contrast": {
    surfaces: {
      floor: { L: 0.166, chromaScale: 1 },
      s0:    { L: 0.180, chromaScale: 1 },
      s1:    { L: 0.220, chromaScale: 1 },
      s2:    { L: 0.262, chromaScale: 1 },
      s3:    { L: 0.295, chromaScale: 1 },
    },
    borders: {
      bSubtle:  { L: 0.262, chromaScale: 1 },
      bDefault: { L: 0.328, chromaScale: 1 },
      bStrong:  { L: 0.422, chromaScale: 1 },
    },
  },
};

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
