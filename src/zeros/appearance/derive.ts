// ──────────────────────────────────────────────────────────
// applyTheme — write the runtime CSS variables to <html>
// ──────────────────────────────────────────────────────────
//
// Emits these CSS variables on <html>:
//   --zeros-hue              raw number 0–360 — used in oklch() at use site
//   --zeros-intensity        raw 0–1 — for any consumer that needs the scalar
//   --zeros-tint-c-surface   chroma for surfaces (intensity × per-mode cap)
//   --zeros-tint-c-border    chroma for borders  (intensity × per-mode cap)
//   --zeros-tint-color       swatch-only preview (oklch L C H) — NOT used
//                            by surfaces; surfaces compute their own tint
//                            from hue + tint-c-* at their own lightness.
//   --zeros-accent           oklch(L C H) — brand accent, independent of hue
//
// Plus the data-theme attribute for the variant block in tokens.css.
//
// Why per-channel chroma instead of color-mix into a tint color:
// mixing shifts surface lightness toward the tint's L (=0.55), which
// compressed the dark-mode surface ladder at any meaningful tint
// percentage. The new recipe sets each --surface-* / --border-*
// directly to `oklch(L_def  intensity*cap*surface_scale  user_hue)` —
// every surface keeps its own lightness, only chroma + hue change.
// Ladder is preserved at any intensity.
//
// Per-surface chromaScale lets light mode follow Cursor's pattern:
// chrome (floor) gets full tint while cards (s1) stay pure neutral
// white, so cards "pop" off the tinted page. Dark mode keeps every
// surface at scale=1 (uniform tint).
//
// Surface defs live in SURFACE_DEFS in prefs.ts. Dark-mode L values
// must stay in sync with the --grey-N hex values in tokens.css;
// light-mode Ls are independent (Cursor-style ladder, see prefs.ts).
//
// Intentionally does NOT touch --zeros-accent except via the accent
// field. Buttons, focus rings, link text follow the user's accent
// hue but are independent of the chrome hue (Cursor's model).
// ──────────────────────────────────────────────────────────

import {
  ACCENT_CHROMA,
  ACCENT_LIGHTNESS,
  NEUTRAL_PALETTES,
  SURFACE_DEFS,
  TINT_CHROMA,
  TINT_LIGHTNESS,
  resolveVariant,
  type AppearancePrefs,
} from "./prefs";

export interface ApplyThemeContext {
  systemPrefersDark: boolean;
}

/** When the variant changes (dark↔light↔high-contrast) we suppress
 *  transitions for one frame so the swap lands instantly instead of
 *  every component chasing the new colors over its own duration.
 *  Tracked here so subsequent same-variant updates (hue / intensity
 *  slider drags) don't trigger the suppression. */
let lastVariant: string | null = null;

export function applyTheme(
  prefs: AppearancePrefs,
  ctx: ApplyThemeContext,
  root: HTMLElement = document.documentElement,
): void {
  const variant = resolveVariant(prefs.mode, ctx.systemPrefersDark);
  const palette = NEUTRAL_PALETTES[variant];
  const defs = SURFACE_DEFS[variant];

  const intensity = clamp01(prefs.intensity);
  const hue = wrapHue(prefs.hue);
  const accentHue = wrapHue(prefs.accent);

  const tintColor = `oklch(${TINT_LIGHTNESS} ${TINT_CHROMA} ${hue.toFixed(2)})`;
  const surfaceChroma = +(intensity * palette.maxSurfaceChroma).toFixed(4);
  const borderChroma = +(intensity * palette.maxBorderChroma).toFixed(4);
  const accent = `oklch(${ACCENT_LIGHTNESS} ${ACCENT_CHROMA} ${accentHue.toFixed(2)})`;

  /** Build a lightness-anchored OKLCH value with a per-surface chroma
   *  scale. Each token keeps its own L; chroma is intensity * mode-cap
   *  * surface-scale. Light-mode cards (chromaScale=0) come out pure
   *  neutral; chrome (chromaScale=1) gets the full hue tint. */
  const tintAt = (def: { L: number; chromaScale: number }, capC: number): string => {
    const c = +(capC * def.chromaScale).toFixed(4);
    return `oklch(${def.L} ${c} ${hue.toFixed(2)})`;
  };

  const variantChanged = lastVariant !== null && lastVariant !== variant;
  if (variantChanged) {
    root.classList.add("zeros-no-transitions");
  }

  root.setAttribute("data-theme", variant);
  if (prefs.reduceTransparency) {
    root.setAttribute("data-reduce-transparency", "1");
  } else {
    root.removeAttribute("data-reduce-transparency");
  }

  root.style.setProperty("--zeros-hue", String(hue));
  root.style.setProperty("--zeros-intensity", String(intensity));
  root.style.setProperty("--zeros-tint-color", tintColor);
  root.style.setProperty("--zeros-tint-c-surface", String(surfaceChroma));
  root.style.setProperty("--zeros-tint-c-border", String(borderChroma));
  root.style.setProperty("--zeros-accent", accent);

  /* Per-surface tinting: each --surface-* / --border-* keeps its own
     L from SURFACE_DEFS and gets chroma = capC * surface.chromaScale.
     Avoids `oklch(from var(--grey-N) …)` because var() in channel
     position has been unreliable across browsers (see commit 4bf4928). */
  root.style.setProperty("--surface-floor", tintAt(defs.surfaces.floor, surfaceChroma));
  root.style.setProperty("--surface-0",     tintAt(defs.surfaces.s0,    surfaceChroma));
  root.style.setProperty("--surface-1",     tintAt(defs.surfaces.s1,    surfaceChroma));
  root.style.setProperty("--surface-2",     tintAt(defs.surfaces.s2,    surfaceChroma));
  root.style.setProperty("--surface-3",     tintAt(defs.surfaces.s3,    surfaceChroma));
  root.style.setProperty("--border-subtle",  tintAt(defs.borders.bSubtle,  borderChroma));
  root.style.setProperty("--border-default", tintAt(defs.borders.bDefault, borderChroma));
  root.style.setProperty("--border-strong",  tintAt(defs.borders.bStrong,  borderChroma));

  if (variantChanged && typeof window !== "undefined") {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        root.classList.remove("zeros-no-transitions");
      });
    });
  }
  lastVariant = variant;

  // Diagnostic — log every applyTheme call to a window-scoped counter
  // so the DevTools console can verify slider drags reach the engine
  // end-to-end (counter goes up, tint string changes).
  if (typeof window !== "undefined") {
    type Diag = {
      calls: number;
      lastHue: number;
      lastSurfaceChroma: number;
      lastBorderChroma: number;
      lastAccent: string;
      lastVariant: string;
    };
    const w = window as unknown as { __zerosThemeDiag?: Diag };
    w.__zerosThemeDiag = {
      calls: (w.__zerosThemeDiag?.calls ?? 0) + 1,
      lastHue: hue,
      lastSurfaceChroma: surfaceChroma,
      lastBorderChroma: borderChroma,
      lastAccent: accent,
      lastVariant: variant,
    };
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function wrapHue(h: number): number {
  if (!Number.isFinite(h)) return 0;
  const wrapped = h % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}
