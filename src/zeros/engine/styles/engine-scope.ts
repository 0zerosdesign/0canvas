// ──────────────────────────────────────────────────────────
// Engine Scope — element-level resets + overlay host-isolation
// ------------------------------------------------------------
// Tokens no longer live here. They're loaded globally once from
// `styles/tokens.css` (the single source of truth for every
// color, typography, spacing, radius, shadow, motion, and z-index
// value in Zeros). [data-Zeros-root] inherits them for free.
//
// What's left in this file:
//   1. The `!important` typography+box-sizing reset, applied ONLY
//      to [data-Zeros-overlay] (reserved for browser-extension
//      injection into unknown host pages). The Electron shell
//      uses [data-Zeros-root] without this reset.
//   2. Element-level resets scoped to [data-Zeros-root] —
//      bare-style buttons/inputs, SVG/img alignment, list styling,
//      scrollbar theming, focus ring. These normalise browser
//      defaults within Zeros UI subtrees without touching
//      html/body (which the shell's own tokens.css owns).
// ──────────────────────────────────────────────────────────

export const engineScopeCSS = (S: string) => `
/* ── Host isolation: applied only to [data-Zeros-overlay] injections
       (browser-extension mode). The Electron shell uses [data-Zeros-root]
       without this reset since it owns the whole document. ── */
[data-Zeros-overlay] {
  font-family: var(--font-ui) !important;
  font-size:   var(--text-13) !important;
  line-height: var(--leading-snug) !important;
  color:       var(--text-primary) !important;
  letter-spacing: normal !important;
  font-weight: var(--weight-body) !important;
  text-transform: none !important;
  font-style: normal !important;
  text-decoration: none !important;
  word-spacing: normal !important;
  white-space: normal !important;
  direction: ltr !important;
  text-align: left !important;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

[data-Zeros-overlay] *, [data-Zeros-overlay] *::before, [data-Zeros-overlay] *::after {
  box-sizing: border-box !important;
  margin: 0;
  padding: 0;
  border: 0 solid var(--border-subtle);
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  color: inherit;
  letter-spacing: inherit !important;
  font-weight: inherit !important;
  text-transform: inherit !important;
  text-decoration: inherit !important;
  -webkit-font-smoothing: inherit;
}

/* ── Element-level resets inside Zeros UI subtrees ── */
${S} button {
  background: transparent;
  border: none;
  cursor: pointer;
  font: inherit;
  color: inherit;
  padding: 0;
  margin: 0;
  text-align: inherit;
  appearance: none;
  -webkit-appearance: none;
}
${S} input, ${S} textarea {
  font: inherit;
  color: inherit;
  background: transparent;
  appearance: none;
  -webkit-appearance: none;
}
${S} svg { display: inline-block; vertical-align: middle; }
${S} img { display: block; max-width: 100%; }
${S} a { color: inherit; text-decoration: none; }
${S} ul, ${S} ol { list-style: none; }
${S} *:focus-visible { outline: 2px solid var(--ring-focus); outline-offset: 2px; }

/* ── Scrollbar ── */
${S} ::-webkit-scrollbar { width: 6px; height: 6px; }
${S} ::-webkit-scrollbar-track { background: transparent; }
${S} ::-webkit-scrollbar-thumb {
  background: var(--surface-2);
  border-radius: var(--radius-xs);
}
${S} ::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }
`;
