// ──────────────────────────────────────────────────────────
// applyTheme — write the runtime CSS variables to <html>
// ──────────────────────────────────────────────────────────
//
// Emits four CSS variables on <html>:
//   --zeros-tint-color       oklch(L C H) — the user's hue at fixed L+C
//   --zeros-tint-mix-surface percent — how much tint to mix into surfaces
//   --zeros-tint-mix-border  percent — how much tint to mix into borders
//   --zeros-hue              numeric (raw, in case any consumer wants it)
//
// Plus the data-theme attribute for the variant block in tokens.css.
//
// Intentionally does NOT touch --zeros-accent. The accent is the
// brand color (buttons, focus rings, link text) and stays stable
// regardless of hue + intensity, which match Cursor / DPCode's
// behavior: tint the chrome, not the brand. Accent will become
// user-configurable later via a separate `accent` field on prefs.
//
// CSS does the rest: surface and border tokens use color-mix with
// these vars to produce their tinted values.
// ──────────────────────────────────────────────────────────

import {
  ACCENT_CHROMA,
  ACCENT_LIGHTNESS,
  NEUTRAL_PALETTES,
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

  const intensity = clamp01(prefs.intensity);
  const hue = wrapHue(prefs.hue);
  const accentHue = wrapHue(prefs.accent);

  const tintColor = `oklch(${TINT_LIGHTNESS} ${TINT_CHROMA} ${hue.toFixed(2)})`;
  const surfaceMix = (intensity * palette.maxSurfaceTintPct).toFixed(3);
  const borderMix = (intensity * palette.maxBorderTintPct).toFixed(3);
  const accent = `oklch(${ACCENT_LIGHTNESS} ${ACCENT_CHROMA} ${accentHue.toFixed(2)})`;

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
  root.style.setProperty("--zeros-tint-mix-surface", `${surfaceMix}%`);
  root.style.setProperty("--zeros-tint-mix-border", `${borderMix}%`);
  root.style.setProperty("--zeros-accent", accent);

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
      lastTintColor: string;
      lastSurfaceMix: string;
      lastAccent: string;
      lastVariant: string;
    };
    const w = window as unknown as { __zerosThemeDiag?: Diag };
    w.__zerosThemeDiag = {
      calls: (w.__zerosThemeDiag?.calls ?? 0) + 1,
      lastTintColor: tintColor,
      lastSurfaceMix: `${surfaceMix}%`,
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
