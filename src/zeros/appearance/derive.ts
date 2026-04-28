// ──────────────────────────────────────────────────────────
// applyTheme — write the runtime CSS variables to <html>
// ──────────────────────────────────────────────────────────
//
// Single function. Takes user prefs + the system prefers-dark hint,
// computes the OKLCH accent, sets a handful of root-level CSS
// variables. CSS does the rest (see styles/tokens.css and the
// derived semantic tokens that read --zeros-accent via `color-mix`
// and `oklch(from …)`).
//
// What we set on <html>:
//   data-theme               "dark" | "light" | "high-contrast"
//   data-reduce-transparency "1" when on, absent otherwise
//   --zeros-hue              numeric, exposed for any consumer that
//                              wants the raw hue (rare; most just read
//                              --zeros-accent)
//   --zeros-intensity        0–1
//   --zeros-accent           oklch(L C H) string — the canonical accent
//
// Why a string and not three separate vars: components use
// `oklch(from var(--zeros-accent) … h)` to derive shades. Passing one
// composite string lets the relative-color syntax work; three split
// channels would need each consumer to recompose them.
// ──────────────────────────────────────────────────────────

import {
  MAX_CHROMA,
  NEUTRAL_PALETTES,
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
  const chroma = Math.min(palette.accentMaxChroma * intensity, MAX_CHROMA);
  const hue = wrapHue(prefs.hue);
  const accent = `oklch(${palette.accentL.toFixed(4)} ${chroma.toFixed(4)} ${hue.toFixed(2)})`;

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
  root.style.setProperty("--zeros-accent", accent);

  if (variantChanged && typeof window !== "undefined") {
    // Two rAFs: the first lets the browser commit the new vars +
    // attribute, the second removes the suppression so the next
    // hover/focus animates normally. One rAF would race with the
    // commit on some Chromium builds.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        root.classList.remove("zeros-no-transitions");
      });
    });
  }
  lastVariant = variant;
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
