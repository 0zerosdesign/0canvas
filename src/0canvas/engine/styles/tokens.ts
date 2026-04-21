// ──────────────────────────────────────────────────────────
// Engine Design Tokens
// ------------------------------------------------------------
// Mirrors src/styles/design-tokens.css, scoped under
// [data-0canvas-root] so the engine stays self-contained
// when injected into a host page.
//
// IMPORTANT:
//   The naming MUST stay in sync with the shell tokens file.
//   If you change a token here, change it there too (or
//   better: change the shell file, then re-mirror here).
//
//   Components inside the engine should reference the
//   SEMANTIC names below (--surface-0, --text-on-surface,
//   --primary, --space-4, --radius-sm, --dur-fast, etc.)
//   NEVER the primitive scales (--grey-900, --blue-500).
//
//   Legacy --color--*, --font-size-*, --font-weight-* alias
//   family has been REMOVED; consumers use flat semantic names.
// ──────────────────────────────────────────────────────────

export const tokensCSS = (S: string) => `
/* ============================================================
   0canvas Engine Design Tokens
   Scoped to [data-0canvas-root] — do not leak to host page.
   ============================================================ */
${S} {
  /* ── 1. Primitive scales (internal only) ─────────────── */
  --grey-50:  #FAFAFA;
  --grey-100: #F5F5F5;
  --grey-200: #E5E5E5;
  --grey-300: #D4D4D4;
  --grey-400: #A3A3A3;
  --grey-500: #737373;
  --grey-600: #525252;
  --grey-700: #404040;
  --grey-800: #262626;
  --grey-900: #171717;
  --grey-950: #0a0a0a;

  --blue-300: #93C5FD;
  --blue-400: #60A5FA;
  --blue-500: #3B82F6;
  --blue-600: #2563EB;
  --blue-700: #1D4ED8;

  --green-300: #6EE7B7;
  --green-400: #34D399;
  --green-500: #10B981;
  --green-600: #059669;
  --red-300:   #FCA5A5;
  --red-400:   #F87171;
  --red-500:   #EF4444;
  --red-600:   #DC2626;
  --yellow-300: #FCD34D;
  --yellow-400: #FBBF24;
  --yellow-500: #F59E0B;
  --yellow-600: #D97706;
  --orange-300: #FDBA74;
  --orange-400: #FB923C;
  --orange-500: #F97316;
  --purple-400: #A78BFA;
  --purple-500: #8B5CF6;
  --pink-400:   #F472B6;
  --pink-500:   #EC4899;
  --teal-400:   #2DD4BF;
  --teal-500:   #14B8A6;
  --cyan-400:   #22D3EE;
  --cyan-500:   #06B6D4;
  --indigo-200: #C7D2FE;
  --indigo-300: #A5B4FC;
  --indigo-400: #818CF8;
  --indigo-500: #6366F1;

  /* ── 2. Surfaces ─────────────────────────────────────── */
  --surface-floor:             var(--grey-950);
  --surface-0:                 var(--grey-900);
  --surface-1:                 var(--grey-800);
  --surface-2:                 var(--grey-700);
  --surface-absolute:          #000000;
  --surface-absolute-inverted: #FFFFFF;
  --surface-inverted:          var(--grey-200);
  --background:                var(--surface-0);

  /* ── 3. Text ─────────────────────────────────────────── */
  --text-on-surface:         var(--grey-200);
  --text-on-surface-variant: var(--grey-400);
  --text-muted:              var(--grey-500);
  --text-disabled:           var(--grey-600);
  --text-hint:               var(--grey-700);
  --text-on-primary:         var(--grey-50);
  --text-primary:            var(--blue-600);
  --text-primary-light:      var(--blue-400);
  --text-success:            var(--green-500);
  --text-warning:            var(--yellow-500);
  --text-critical:           var(--red-500);
  --text-critical-light:     var(--red-400);
  --foreground:              var(--text-on-surface);
  --muted-foreground:        var(--text-muted);

  /* ── 4. Borders ──────────────────────────────────────── */
  --border-subtle:  var(--grey-800);
  --border-default: var(--grey-700);
  --border-strong:  var(--grey-600);
  --border:         var(--border-subtle);
  --input:          var(--border-default);

  /* ── 5. Status ───────────────────────────────────────── */
  --status-success:    var(--green-500);
  --status-info:       var(--blue-500);
  --status-warning:    var(--yellow-500);
  --status-critical:   var(--red-500);
  --status-connecting: var(--orange-500);

  /* ── 6. Primary / action ─────────────────────────────── */
  --primary:             var(--blue-600);
  --primary-hover:       var(--blue-700);
  --primary-light:       var(--blue-500);
  --primary-foreground:  var(--grey-50);
  --ring:                var(--blue-500);
  --destructive:             var(--red-600);
  --destructive-foreground:  #FEF2F2;

  /* ── 7. Typography ───────────────────────────────────── */
  --font-ui:
    -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono:
    ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "JetBrains Mono", "Liberation Mono", monospace;
  --text-10: 10px;
  --text-11: 11px;
  --text-12: 12px;
  --text-13: 13px;
  --text-15: 15px;
  --text-18: 18px;
  --weight-body:    400;
  --weight-control: 500;
  --weight-heading: 600;
  --leading-tight:  1.2;
  --leading-snug:   1.4;
  --leading-normal: 1.5;
  --tracking-overline: 0.05em;

  /* ── 8. Space ────────────────────────────────────────── */
  --space-1:  2px;
  --space-2:  4px;
  --space-3:  6px;
  --space-4:  8px;
  --space-5:  10px;
  --space-6:  12px;
  --space-7:  14px;
  --space-8:  16px;
  --space-10: 20px;
  --space-12: 24px;

  /* ── 9. Radius ───────────────────────────────────────── */
  --radius-xs:     4px;
  --radius-sm:     6px;
  --radius-md:     8px;
  --radius-lg:     12px;
  --radius-pill:   9999px;
  --radius-circle: 50%;
  --radius: var(--radius-sm);

  /* ── 10. Control heights ─────────────────────────────── */
  --h-control-sm: 24px;
  --h-control-md: 28px;
  --h-control-lg: 32px;

  /* ── 11. Icon sizes ──────────────────────────────────── */
  --icon-xs: 10px;
  --icon-sm: 12px;
  --icon-md: 14px;
  --icon-lg: 16px;

  /* ── 12. Motion ──────────────────────────────────────── */
  --dur-fast: 120ms;
  --dur-base: 160ms;
  --dur-slow: 240ms;
  --ease-standard:   cubic-bezier(0.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(0.4, 0, 0.2, 1);

  /* ── 13. Shadows ─────────────────────────────────────── */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.25);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.25),
               0 2px 4px -1px rgba(0, 0, 0, 0.25);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.25),
               0 4px 6px -2px rgba(0, 0, 0, 0.25);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.25),
               0 10px 10px -5px rgba(0, 0, 0, 0.25);

  /* ── 14. Z-index ─────────────────────────────────────── */
  --z-chrome:   5;
  --z-panel:    10;
  --z-dropdown: 25;
  --z-modal:    100;
  --z-toast:    200;

  /* ── 16. Tints (ONLY rgba allowed in engine CSS) ─────── */
  --tint-hover:          rgba(255, 255, 255, 0.03);
  --tint-hover-strong:   rgba(255, 255, 255, 0.05);
  --tint-active:         rgba(255, 255, 255, 0.06);
  --tint-border-hover:   rgba(255, 255, 255, 0.25);
  --tint-primary-weak:   rgba(37, 99, 235, 0.06);
  --tint-primary-soft:   rgba(37, 99, 235, 0.12);
  --tint-primary-hover:  rgba(37, 99, 235, 0.18);
  --tint-primary-border: rgba(37, 99, 235, 0.35);
  --tint-success-weak:    rgba(16, 185, 129, 0.05);
  --tint-success-soft:    rgba(16, 185, 129, 0.12);
  --tint-success-border:  rgba(16, 185, 129, 0.35);
  --tint-warning-soft:    rgba(245, 158, 11, 0.12);
  --tint-warning-border:  rgba(245, 158, 11, 0.35);
  --tint-accent-soft:     rgba(139, 92, 246, 0.12);
  --tint-accent-border:   rgba(139, 92, 246, 0.22);
  --tint-critical-soft:   rgba(239, 68, 68, 0.10);
  --tint-critical-border: rgba(239, 68, 68, 0.35);
  --backdrop-weak:       rgba(0, 0, 0, 0.6);
  --backdrop-strong:     rgba(0, 0, 0, 0.7);
  --tint-black-soft:     rgba(0, 0, 0, 0.25);
  --text-on-inverted:    var(--grey-800);

  /* ── 17. Syntax ──────────────────────────────────────── */
  --syntax-comment:  var(--grey-400);
  --syntax-selector: var(--green-500);
  --syntax-property: var(--blue-300);
  --syntax-value:    var(--orange-400);

  /* ============================================================
     18. LEGACY ALIASES — REMOVED
     ------------------------------------------------------------
     Consumers (layout.ts, panels.ts, toolbar.ts, etc.) have been
     migrated to the flat semantic tokens above. Do not reintroduce
     --color--*, --font-size-*, or --font-weight-* aliases here —
     add new semantic names in the appropriate section instead.
     ============================================================ */
}

/* ── Targeted reset: override inherited consumer styles ── */
${S} {
  font-family: var(--font-ui) !important;
  font-size:   var(--text-13) !important;
  line-height: var(--leading-snug) !important;
  color:       var(--text-on-surface) !important;
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

${S} *, ${S} *::before, ${S} *::after {
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
${S} *:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }

/* ── Scrollbar ── */
${S} ::-webkit-scrollbar { width: 6px; height: 6px; }
${S} ::-webkit-scrollbar-track { background: transparent; }
${S} ::-webkit-scrollbar-thumb {
  background: var(--surface-2);
  border-radius: var(--radius-xs);
}
${S} ::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }
`;
