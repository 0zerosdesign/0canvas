// ──────────────────────────────────────────────────────────
// ZeroCanvas — Runtime CSS Injection (v0.0.3)
// ──────────────────────────────────────────────────────────
//
// COMPLETE self-contained CSS for ALL ZeroCanvas components.
// Every Tailwind utility class used in any component file is
// defined here, scoped under [data-0canvas-root].
//
// This file was built by auditing EVERY className in:
//   workspace-toolbar.tsx, layers-panel.tsx, style-panel.tsx,
//   variant-canvas.tsx, agent-panel.tsx, brainstorm-panel.tsx,
//   annotation-overlay.tsx, command-palette.tsx, file-map-panel.tsx,
//   ui/scroll-area.tsx
//
// ──────────────────────────────────────────────────────────

const STYLE_ID = "0canvas-injected-styles";

// Helper: scope selector under [data-0canvas-root]
const S = "[data-0canvas-root]";

export const ZEROCANVAS_CSS = `
/* ============================================================
   ZeroCanvas — Complete Self-Contained Styles
   ============================================================ */

/* ── Design Tokens (from variables.css) ── */
${S} {
  /* Grey */
  --grey-50: #FAFAFA; --grey-100: #F5F5F5; --grey-200: #E5E5E5;
  --grey-300: #D4D4D4; --grey-400: #A3A3A3; --grey-500: #737373;
  --grey-600: #525252; --grey-700: #404040; --grey-800: #262626;
  --grey-900: #171717; --grey-950: #0a0a0a;
  /* Blue (primary) */
  --blue-50: #EFF6FF; --blue-100: #DBEAFE; --blue-200: #BFDBFE;
  --blue-300: #93C5FD; --blue-400: #60A5FA; --blue-500: #3B82F6;
  --blue-600: #2563EB; --blue-700: #1D4ED8; --blue-800: #1E40AF;
  --blue-900: #1E3A8A;
  /* Red (error) */
  --red-50: #FEF2F2; --red-100: #FEE2E2; --red-200: #FECACA;
  --red-300: #FCA5A5; --red-400: #F87171; --red-500: #EF4444;
  --red-600: #DC2626; --red-700: #B91C1C; --red-800: #991B1B;
  --red-900: #7F1D1D;
  /* Green (success) */
  --green-50: #ECFDF5; --green-100: #D1FAE5; --green-200: #A7F3D0;
  --green-300: #6EE7B7; --green-400: #34D399; --green-500: #10B981;
  --green-600: #059669; --green-700: #047857; --green-800: #065F46;
  --green-900: #064E3B;
  /* Yellow (warning) */
  --yellow-50: #FFFBEB; --yellow-100: #FEF3C7; --yellow-200: #FDE68A;
  --yellow-300: #FCD34D; --yellow-400: #FBBF24; --yellow-500: #F59E0B;
  --yellow-600: #D97706; --yellow-700: #B45309; --yellow-800: #92400E;
  --yellow-900: #78350F;
  /* Orange */
  --orange-400: #FB923C; --orange-500: #F97316;
  /* Purple */
  --purple-400: #A78BFA; --purple-500: #8B5CF6;
  /* Pink */
  --pink-400: #F472B6; --pink-500: #EC4899;
  /* Teal */
  --teal-400: #2DD4BF; --teal-500: #14B8A6;
  /* Cyan */
  --cyan-400: #22D3EE;
  /* Indigo */
  --indigo-200: #C7D2FE; --indigo-300: #A5B4FC; --indigo-400: #818CF8;
  /* Defaults */
  --default-text-color: #FAFAFA;
  --default-bg-color: #171717;
  /* Semantic: Surface */
  --color--surface--floor: var(--grey-950);
  --color--surface--0: var(--grey-900);
  --color--surface--1: var(--grey-800);
  --color--surface--2: var(--grey-700);
  --color--surface--absolute: black;
  --color--surface--inverted: var(--grey-200);
  /* Semantic: Text */
  --color--text--on-surface: var(--grey-200);
  --color--text--on-surface-variant: var(--grey-400);
  --color--text--muted: var(--grey-500);
  --color--text--disabled: var(--grey-600);
  --color--text--hint: var(--grey-700);
  --color--text--on-primary: var(--grey-50);
  --color--text--primary: var(--blue-600);
  --color--text--primary-light: var(--blue-400);
  --color--text--link: var(--blue-600);
  --color--text--info: var(--blue-500);
  --color--text--success: var(--green-500);
  --color--text--warning: var(--yellow-500);
  --color--text--critical: var(--red-500);
  --color--text--critical-light: var(--red-400);
  /* Semantic: Border */
  --color--border--on-surface-0: var(--grey-800);
  --color--border--on-surface-1: var(--grey-700);
  --color--border--on-surface-2: var(--grey-600);
  /* Semantic: Base / Primary */
  --color--base--primary: var(--blue-600);
  --color--base--primary-hover: var(--blue-700);
  --color--base--primary-light: var(--blue-500);
  /* Semantic: Status */
  --color--status--info: var(--blue-500);
  --color--status--success: var(--green-500);
  --color--status--warning: var(--yellow-500);
  --color--status--critical: var(--red-500);
  --color--status--connecting: var(--orange-500);
  /* Semantic: Outline */
  --color--outline--focus: var(--blue-500);
  --color--outline--on-background: var(--blue-600);
  /* Semantic: Shadow */
  --color--shadow--surface: rgba(0,0,0,0.25);
  --color--shadow--overlay: rgba(0,0,0,0.6);
  /* Semantic: Syntax */
  --color--syntax--comment: var(--grey-400);
  --color--syntax--selector: var(--green-500);
  --color--syntax--property: var(--blue-300);
  --color--syntax--value: var(--orange-400);
  /* Fonts */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Fira Code', 'JetBrains Mono', 'Geist Mono', monospace;
  /* Font sizes */
  --font-size-xxs: 0.625rem; --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem; --font-size-base: 1rem;
  --font-size-lg: 1.125rem; --font-size-xl: 1.25rem;
  /* Font weights */
  --font-weight-light: 300; --font-weight-regular: 400;
  --font-weight-normal: 500; --font-weight-semi-bold: 600;
  --font-weight-bold: 700;
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.25);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.25), 0 2px 4px -1px rgba(0,0,0,0.25);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.25), 0 4px 6px -2px rgba(0,0,0,0.25);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.25), 0 10px 10px -5px rgba(0,0,0,0.25);
}

/* ── Targeted reset: override inherited consumer styles ── */
${S} {
  font-family: var(--font-sans) !important;
  font-size: var(--font-size-sm) !important;
  line-height: 1.5 !important;
  color: var(--color--text--on-surface) !important;
  letter-spacing: normal !important;
  font-weight: 400 !important;
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
  border: 0 solid var(--color--border--on-surface-0);
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
${S} *:focus-visible { outline: 2px solid var(--color--outline--focus); outline-offset: 2px; }

/* ── Scrollbar ── */
${S} ::-webkit-scrollbar { width: 6px; height: 6px; }
${S} ::-webkit-scrollbar-track { background: transparent; }
${S} ::-webkit-scrollbar-thumb { background: var(--color--surface--2); border-radius: 3px; }
${S} ::-webkit-scrollbar-thumb:hover { background: var(--color--border--on-surface-2); }

/* ── Animations ── */
@keyframes oc-pulse { 50% { opacity: .5; } }
@keyframes oc-spin { to { transform: rotate(360deg); } }
${S} .animate-pulse { animation: oc-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite; }
${S} .animate-spin { animation: oc-spin 1s linear infinite; }

/* ============================================================
   LAYOUT
   ============================================================ */
${S} .flex { display: flex; }
${S} .inline-flex { display: inline-flex; }
${S} .block { display: block; }
${S} .inline { display: inline; }
${S} .hidden { display: none; }
${S} .flex-col { flex-direction: column; }
${S} .flex-row { flex-direction: row; }
${S} .flex-1 { flex: 1 1 0%; }
${S} .flex-wrap { flex-wrap: wrap; }
${S} .shrink-0 { flex-shrink: 0; }
${S} .items-center { align-items: center; }
${S} .items-start { align-items: flex-start; }
${S} .items-end { align-items: flex-end; }
${S} .justify-center { justify-content: center; }
${S} .justify-between { justify-content: space-between; }
${S} .justify-start { justify-content: flex-start; }
${S} .relative { position: relative; }
${S} .absolute { position: absolute; }
${S} .fixed { position: fixed; }
${S} .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
${S} .overflow-hidden { overflow: hidden; }
${S} .overflow-x-auto { overflow-x: auto; }
${S} .overflow-y-auto { overflow-y: auto; }
${S} .overflow-y-scroll { overflow-y: scroll; }
${S} .isolate { isolation: isolate; }
${S} .text-left { text-align: left; }
${S} .text-center { text-align: center; }
${S} .text-right { text-align: right; }

/* ============================================================
   GAP
   ============================================================ */
${S} .gap-0\\.5 { gap: 0.125rem; }
${S} .gap-1 { gap: 0.25rem; }
${S} .gap-1\\.5 { gap: 0.375rem; }
${S} .gap-2 { gap: 0.5rem; }
${S} .gap-2\\.5 { gap: 0.625rem; }
${S} .gap-3 { gap: 0.75rem; }
${S} .gap-4 { gap: 1rem; }

/* ============================================================
   WIDTH
   ============================================================ */
${S} .w-full { width: 100%; }
${S} .w-px { width: 1px; }
${S} .w-1\\.5 { width: 0.375rem; }
${S} .w-2 { width: 0.5rem; }
${S} .w-2\\.5 { width: 0.625rem; }
${S} .w-3 { width: 0.75rem; }
${S} .w-3\\.5 { width: 0.875rem; }
${S} .w-4 { width: 1rem; }
${S} .w-5 { width: 1.25rem; }
${S} .w-6 { width: 1.5rem; }
${S} .w-8 { width: 2rem; }
${S} .w-12 { width: 3rem; }
${S} .w-48 { width: 12rem; }
${S} .w-\\[120px\\] { width: 120px; }
${S} .w-\\[520px\\] { width: 520px; }

/* ============================================================
   HEIGHT
   ============================================================ */
${S} .h-full { height: 100%; }
${S} .h-px { height: 1px; }
${S} .h-1\\.5 { height: 0.375rem; }
${S} .h-2 { height: 0.5rem; }
${S} .h-2\\.5 { height: 0.625rem; }
${S} .h-3 { height: 0.75rem; }
${S} .h-3\\.5 { height: 0.875rem; }
${S} .h-4 { height: 1rem; }
${S} .h-5 { height: 1.25rem; }
${S} .h-6 { height: 1.5rem; }
${S} .h-7 { height: 1.75rem; }
${S} .h-8 { height: 2rem; }
${S} .h-9 { height: 2.25rem; }
${S} .h-12 { height: 3rem; }
${S} .h-20 { height: 5rem; }
${S} .h-\\[28px\\] { height: 28px; }

/* ============================================================
   SIZE (w + h combined)
   ============================================================ */
${S} .size-full { width: 100%; height: 100%; }
${S} .min-h-0 { min-height: 0; }
${S} .max-w-\\[140px\\] { max-width: 140px; }
${S} .max-w-\\[360px\\] { max-width: 360px; }
${S} .max-h-\\[300px\\] { max-height: 300px; }

/* ============================================================
   PAOCING
   ============================================================ */
${S} .p-0\\.5 { padding: 0.125rem; }
${S} .p-1 { padding: 0.25rem; }
${S} .p-1\\.5 { padding: 0.375rem; }
${S} .p-2 { padding: 0.5rem; }
${S} .p-3 { padding: 0.75rem; }
${S} .p-4 { padding: 1rem; }
${S} .p-6 { padding: 1.5rem; }
${S} .p-px { padding: 1px; }
${S} .px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
${S} .px-1\\.5 { padding-left: 0.375rem; padding-right: 0.375rem; }
${S} .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
${S} .px-2\\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
${S} .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
${S} .px-4 { padding-left: 1rem; padding-right: 1rem; }
${S} .py-0 { padding-top: 0; padding-bottom: 0; }
${S} .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
${S} .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
${S} .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
${S} .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
${S} .py-2\\.5 { padding-top: 0.625rem; padding-bottom: 0.625rem; }
${S} .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
${S} .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
${S} .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
${S} .pt-3 { padding-top: 0.75rem; }
${S} .pt-16 { padding-top: 4rem; }
${S} .pt-\\[20vh\\] { padding-top: 20vh; }
${S} .pb-1 { padding-bottom: 0.25rem; }
${S} .pl-5\\.5 { padding-left: 1.375rem; }

/* ============================================================
   MARGIN
   ============================================================ */
${S} .m-0 { margin: 0; }
${S} .ml-0\\.5 { margin-left: 0.125rem; }
${S} .ml-1 { margin-left: 0.25rem; }
${S} .ml-1\\.5 { margin-left: 0.375rem; }
${S} .ml-4 { margin-left: 1rem; }
${S} .ml-auto { margin-left: auto; }
${S} .mr-1 { margin-right: 0.25rem; }
${S} .mr-1\\.5 { margin-right: 0.375rem; }
${S} .mr-2 { margin-right: 0.5rem; }
${S} .mr-3 { margin-right: 0.75rem; }
${S} .mt-0\\.5 { margin-top: 0.125rem; }
${S} .mt-1 { margin-top: 0.25rem; }
${S} .mt-2 { margin-top: 0.5rem; }
${S} .mt-3 { margin-top: 0.75rem; }
${S} .mt-4 { margin-top: 1rem; }
${S} .mt-5 { margin-top: 1.25rem; }
${S} .mb-1 { margin-bottom: 0.25rem; }
${S} .mb-2 { margin-bottom: 0.5rem; }
${S} .mb-2\\.5 { margin-bottom: 0.625rem; }
${S} .mb-3 { margin-bottom: 0.75rem; }
${S} .mb-4 { margin-bottom: 1rem; }
${S} .mx-1 { margin-left: 0.25rem; margin-right: 0.25rem; }
${S} .mx-auto { margin-left: auto; margin-right: auto; }

/* ── Space-Y (child margin) ── */
${S} .space-y-0 > * + * { margin-top: 0; }
${S} .space-y-1 > * + * { margin-top: 0.25rem; }
${S} .space-y-2 > * + * { margin-top: 0.5rem; }
${S} .space-y-3 > * + * { margin-top: 0.75rem; }

/* ============================================================
   BORDERS
   ============================================================ */
${S} .border { border-width: 1px; }
${S} .border-b { border-bottom-width: 1px; }
${S} .border-l { border-left-width: 1px; }
${S} .border-r { border-right-width: 1px; }
${S} .border-t { border-top-width: 1px; }
${S} .border-border { border-color: var(--color--border--on-surface-0); }
${S} .border-\\[\\#1a1a1a\\] { border-color: var(--color--border--on-surface-0); }
${S} .border-\\[\\#222222\\] { border-color: var(--color--border--on-surface-0); }
${S} .border-\\[\\#333333\\] { border-color: var(--color--border--on-surface-1); }
${S} .border-\\[\\#444\\] { border-color: var(--color--border--on-surface-1); }
${S} .border-foreground { border-color: var(--color--text--on-surface); }
${S} .border-l-transparent { border-left-color: transparent; }
${S} .border-t-transparent { border-top-color: transparent; }
${S} .border-dashed { border-style: dashed; }
${S} .border-\\[\\#0070f3\\]\\/20 { border-color: rgba(0,112,243,0.2); }
${S} .border-\\[\\#0070f3\\]\\/30 { border-color: rgba(0,112,243,0.3); }
${S} .border-\\[\\#0070f3\\]\\/40 { border-color: rgba(0,112,243,0.4); }
${S} .border-\\[\\#50e3c2\\]\\/20 { border-color: rgba(80,227,194,0.2); }
${S} .border-\\[\\#ff0080\\]\\/20 { border-color: rgba(255,0,128,0.2); }
${S} .border-\\[\\#ff4444\\]\\/20 { border-color: rgba(255,68,68,0.2); }
${S} .border-\\[\\#ff980040\\] { border-color: #ff980040; }
${S} .border-\\[\\#4caf5040\\] { border-color: #4caf5040; }
${S} .border-\\[\\#2196f340\\] { border-color: #2196f340; }
${S} .rounded { border-radius: 0.25rem; }
${S} .rounded-sm { border-radius: 0.125rem; }
${S} .rounded-md { border-radius: 0.375rem; }
${S} .rounded-lg { border-radius: 0.5rem; }
${S} .rounded-xl { border-radius: 0.75rem; }
${S} .rounded-2xl { border-radius: 1rem; }
${S} .rounded-full { border-radius: 9999px; }
${S} .rounded-\\[inherit\\] { border-radius: inherit; }

/* ============================================================
   BACKGROUNDS
   ============================================================ */
${S} .bg-background { background-color: var(--color--surface--0); }
${S} .bg-foreground { background-color: var(--color--surface--inverted); }
${S} .bg-border { background-color: var(--color--surface--1); }
${S} .bg-transparent { background-color: transparent; }
${S} .bg-\\[\\#000000\\] { background-color: var(--color--surface--0); }
${S} .bg-\\[\\#080808\\] { background-color: var(--color--surface--0); }
${S} .bg-\\[\\#0a0a0a\\] { background-color: var(--color--surface--floor); }
${S} .bg-\\[var\\(--grey-950\\)\\] { background-color: var(--color--surface--floor); }
${S} .bg-\\[\\#111111\\] { background-color: var(--color--surface--1); }
${S} .bg-\\[\\#1a1a1a\\] { background-color: var(--color--surface--1); }
${S} .bg-\\[\\#222222\\] { background-color: var(--color--surface--1); }
${S} .bg-\\[\\#333333\\] { background-color: var(--color--surface--2); }
${S} .bg-\\[\\#444444\\] { background-color: var(--color--surface--2); }
${S} .bg-\\[\\#0070f3\\] { background-color: var(--color--base--primary); }
${S} .bg-\\[\\#50e3c2\\] { background-color: var(--color--status--success); }
${S} .bg-\\[\\#0070f3\\]\\/5 { background-color: rgba(0,112,243,0.05); }
${S} .bg-\\[\\#0070f3\\]\\/10 { background-color: rgba(0,112,243,0.1); }
${S} .bg-\\[\\#0070f3\\]\\/15 { background-color: rgba(0,112,243,0.15); }
${S} .bg-\\[\\#0070f3\\]\\/20 { background-color: rgba(0,112,243,0.2); }
${S} .bg-\\[\\#50e3c2\\]\\/10 { background-color: rgba(80,227,194,0.1); }
${S} .bg-\\[\\#50e3c2\\]\\/20 { background-color: rgba(80,227,194,0.2); }
${S} .bg-\\[\\#f5a623\\]\\/10 { background-color: rgba(245,166,35,0.1); }
${S} .bg-\\[\\#f5a623\\]\\/15 { background-color: rgba(245,166,35,0.15); }
${S} .bg-\\[\\#7928ca\\]\\/15 { background-color: rgba(121,40,202,0.15); }
${S} .bg-\\[\\#7928ca\\]\\/20 { background-color: rgba(121,40,202,0.2); }
${S} .bg-\\[\\#ff0080\\]\\/15 { background-color: rgba(255,0,128,0.15); }
${S} .bg-\\[\\#ff0080\\]\\/20 { background-color: rgba(255,0,128,0.2); }
${S} .bg-\\[\\#ff4444\\]\\/10 { background-color: rgba(255,68,68,0.1); }
${S} .bg-\\[\\#ff980020\\] { background-color: #ff980020; }
${S} .bg-\\[\\#4caf5020\\] { background-color: #4caf5020; }
${S} .bg-\\[\\#2196f320\\] { background-color: #2196f320; }
${S} .bg-black\\/60 { background-color: rgba(0,0,0,0.6); }
${S} .bg-\\[\\#0a0a0a\\]\\/95 { background-color: rgba(10,10,10,0.95); } /* grey-950/95 */
${S} .bg-\\[\\#ffffff06\\] { background-color: rgba(255,255,255,0.024); }
${S} .bg-\\[\\#ffffff08\\] { background-color: rgba(255,255,255,0.031); }
${S} .bg-\\[\\#ffffff10\\] { background-color: rgba(255,255,255,0.063); }

/* ============================================================
   TEXT COLORS
   ============================================================ */
${S} .text-foreground { color: var(--color--text--on-surface); }
${S} .text-background { color: var(--color--surface--0); }
${S} .text-muted-foreground { color: var(--color--text--muted); }
${S} .text-white { color: var(--color--text--on-primary); }
${S} .text-\\[\\#0070f3\\] { color: var(--color--text--primary); }
${S} .text-\\[\\#50e3c2\\] { color: var(--color--status--success); }
${S} .text-\\[\\#f5a623\\] { color: var(--color--status--warning); }
${S} .text-\\[\\#7928ca\\] { color: var(--blue-700); }
${S} .text-\\[\\#ff0080\\] { color: var(--blue-500); }
${S} .text-\\[\\#ff4444\\] { color: var(--color--status--critical); }
${S} .text-\\[\\#ff9800\\] { color: var(--yellow-600); }
${S} .text-\\[\\#4caf50\\] { color: var(--green-600); }
${S} .text-\\[\\#2196f3\\] { color: var(--blue-500); }
${S} .text-\\[\\#79b8ff\\] { color: var(--blue-300); }
${S} .text-\\[\\#444444\\] { color: var(--color--text--hint); }
${S} .text-\\[\\#888888\\] { color: var(--color--text--muted); }
${S} .text-blue-300 { color: var(--blue-300); }
${S} .text-blue-400 { color: var(--blue-400); }
${S} .text-blue-500 { color: var(--blue-500); }
${S} .text-purple-400 { color: var(--purple-400); }
${S} .text-indigo-200 { color: var(--indigo-200); }
${S} .text-indigo-300 { color: var(--indigo-300); }
${S} .text-indigo-400 { color: var(--indigo-400); }
${S} .text-green-300 { color: var(--green-300); }
${S} .text-green-400 { color: var(--green-400); }
${S} .text-orange-300 { color: var(--orange-400); }
${S} .text-orange-400 { color: var(--orange-400); }
${S} .text-yellow-300 { color: var(--yellow-300); }
${S} .text-yellow-400 { color: var(--yellow-400); }
${S} .text-cyan-400 { color: var(--cyan-400); }
${S} .text-teal-400 { color: var(--teal-400); }
${S} .text-pink-400 { color: var(--pink-400); }
${S} .text-red-400 { color: var(--red-400); }

/* ============================================================
   TYPOGRAPHY
   ============================================================ */
${S} .text-\\[9px\\] { font-size: 9px; }
${S} .text-\\[10px\\] { font-size: 10px; }
${S} .text-\\[11px\\] { font-size: 11px; }
${S} .text-\\[12px\\] { font-size: 12px; }
${S} .text-\\[13px\\] { font-size: 13px; }
${S} .text-\\[14px\\] { font-size: 14px; }
${S} .text-\\[15px\\] { font-size: 15px; }
${S} .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${S} .whitespace-pre { white-space: pre; }
${S} .whitespace-pre-wrap { white-space: pre-wrap; }
${S} .break-all { word-break: break-all; }
${S} .uppercase { text-transform: uppercase; }
${S} .tracking-wider { letter-spacing: 0.05em; }
${S} .tracking-tight { letter-spacing: -0.025em; }
${S} .resize-none { resize: none; }
${S} .placeholder\\:text-muted-foreground::placeholder { color: var(--color--text--muted); }

/* ============================================================
   EFFECTS & TRANSITIONS
   ============================================================ */
${S} .transition-colors { transition-property: color,background-color,border-color,text-decoration-color,fill,stroke; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
${S} .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
${S} .transition-opacity { transition-property: opacity; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
${S} .transition-transform { transition-property: transform; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
${S} .transition-\\[color\\,box-shadow\\] { transition-property: color,box-shadow; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
${S} .opacity-0 { opacity: 0; }
${S} .opacity-30 { opacity: 0.3; }
${S} .opacity-40 { opacity: 0.4; }
${S} .opacity-50 { opacity: 0.5; }
${S} .opacity-60 { opacity: 0.6; }
${S} .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1); }
${S} .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
${S} .backdrop-blur-sm { backdrop-filter: blur(4px); }

/* ============================================================
   POSITION & TRANSFORM
   ============================================================ */
${S} .top-3 { top: 0.75rem; }
${S} .left-1\\/2 { left: 50%; }
${S} .-translate-x-1\\/2 { transform: translateX(-50%); }
${S} .scale-125 { transform: scale(1.25); }

/* ============================================================
   Z-INDEX
   ============================================================ */
${S} .z-20 { z-index: 20; }
${S} .z-30 { z-index: 30; }
${S} .z-40 { z-index: 40; }
${S} .z-\\[100\\] { z-index: 100; }

/* ============================================================
   INTERACTIVITY
   ============================================================ */
${S} .cursor-pointer { cursor: pointer; }
${S} .cursor-text { cursor: text; }
${S} .cursor-default { cursor: default; }
${S} .cursor-crosshair { cursor: crosshair; }
${S} .select-none { user-select: none; -webkit-user-select: none; }
${S} .touch-none { touch-action: none; }
${S} .pointer-events-none { pointer-events: none; }
${S} .pointer-events-auto { pointer-events: auto; }
${S} .outline-none { outline: none; }

/* ============================================================
   RINGS (box-shadow based)
   ============================================================ */
${S} .ring-1 { box-shadow: 0 0 0 1px var(--color--outline--focus); }
${S} .ring-white\\/30 { box-shadow: 0 0 0 1px rgba(255,255,255,0.3); }
${S} .ring-white\\/40 { box-shadow: 0 0 0 1px rgba(255,255,255,0.4); }

/* ============================================================
   HOVER STATES
   ============================================================ */
${S} .hover\\:bg-\\[\\#1a1a1a\\]:hover { background-color: var(--color--surface--1); }
${S} .hover\\:bg-\\[\\#111111\\]:hover { background-color: var(--color--surface--1); }
${S} .hover\\:bg-\\[\\#ffffff06\\]:hover { background-color: rgba(255,255,255,0.024); }
${S} .hover\\:bg-\\[\\#ffffff08\\]:hover { background-color: rgba(255,255,255,0.031); }
${S} .hover\\:bg-\\[\\#ffffff10\\]:hover { background-color: rgba(255,255,255,0.063); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/10:hover { background-color: rgba(0,112,243,0.1); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/20:hover { background-color: rgba(0,112,243,0.2); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/90:hover { background-color: rgba(0,112,243,0.9); }
${S} .hover\\:bg-\\[\\#ff4444\\]\\/10:hover { background-color: rgba(255,68,68,0.1); }
${S} .hover\\:text-foreground:hover { color: var(--color--text--on-surface); }
${S} .hover\\:text-\\[\\#0070f3\\]:hover { color: var(--color--text--primary); }
${S} .hover\\:text-\\[\\#7928ca\\]:hover { color: var(--blue-700); }
${S} .hover\\:text-\\[\\#f5a623\\]:hover { color: var(--color--status--warning); }
${S} .hover\\:text-\\[\\#ff4444\\]:hover { color: var(--color--status--critical); }
${S} .hover\\:border-\\[\\#333333\\]:hover { border-color: var(--color--border--on-surface-1); }
${S} .hover\\:border-foreground:hover { border-color: var(--color--text--on-surface); }
${S} .hover\\:underline:hover { text-decoration: underline; }
${S} .hover\\:opacity-90:hover { opacity: 0.9; }

/* ============================================================
   FOCUS STATES
   ============================================================ */
${S} .focus\\:outline-none:focus { outline: none; }
${S} .focus\\:border-\\[\\#333333\\]:focus { border-color: var(--color--border--on-surface-1); }
${S} .focus\\:border-\\[\\#0070f3\\]:focus { border-color: var(--color--outline--on-background); }
${S} .focus-visible\\:ring-ring\\/50:focus-visible { box-shadow: 0 0 0 3px rgba(51,51,51,0.5); }
${S} .focus-visible\\:ring-\\[3px\\]:focus-visible { box-shadow: 0 0 0 3px var(--color--outline--focus); }
${S} .focus-visible\\:outline-1:focus-visible { outline-width: 1px; }

/* ============================================================
   GROUP HOVER
   ============================================================ */
${S} .group:hover .group-hover\\:flex { display: flex; }
${S} .group:hover .group-hover\\:opacity-100 { opacity: 1; }

/* ============================================================
   DISABLED
   ============================================================ */
${S} .disabled\\:opacity-30:disabled { opacity: 0.3; }

/* ============================================================
   LAST-CHILD
   ============================================================ */
${S} .last\\:border-0:last-child { border-width: 0; }

/* ============================================================
   COMPONENT CLASSES
   All component-specific styles using design tokens.
   Naming: .oc-{component}-{element}
   States: .is-active, .is-selected, .when-expanded, .when-loading
   ============================================================ */

/* ── Engine ─────────────────────────────────────────────────── */
${S} .oc-engine-loading {
  height: 100%; display: flex; align-items: center; justify-content: center;
  background: var(--color--surface--0); color: var(--color--text--muted);
  font-size: var(--font-size-sm); font-family: var(--font-sans);
}
${S} .oc-toggle-btn {
  position: fixed; width: 44px; height: 44px; border-radius: 12px;
  border: 1px solid var(--color--border--on-surface-0); background: var(--color--surface--floor);
  color: var(--color--text--on-surface); cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: all 0.2s ease; box-shadow: var(--shadow-lg);
  font-size: 0; padding: 0; outline: none;
}
${S} .oc-toggle-btn:hover { background: var(--color--surface--1); transform: scale(1.05); }
${S} .oc-close-btn {
  position: absolute; top: 14px; right: 14px; width: 28px; height: 28px;
  border-radius: 8px; border: 1px solid var(--color--border--on-surface-1);
  background: var(--color--surface--1); color: var(--color--text--muted);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: var(--font-size-sm); transition: all 0.15s ease;
  padding: 0; outline: none;
}
${S} .oc-close-btn:hover { color: var(--color--text--on-surface); border-color: var(--color--border--on-surface-2); }
${S} .oc-workspace {
  height: 100%; display: flex; flex-direction: column;
  background: var(--color--surface--0); overflow: hidden;
}
${S} .oc-workspace-main { flex: 1; display: flex; overflow: hidden; }
${S} .oc-workspace-center { flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden; }
${S} .oc-panel-slot { flex-shrink: 0; height: 100%; overflow: hidden; }
${S} .oc-panel-slot-bordered { flex-shrink: 0; border-left: 1px solid var(--color--border--on-surface-0); }

/* ── Resizable Panel ─────────────────────────────────────── */
${S} .oc-resize-handle {
  width: 5px; flex-shrink: 0; height: 100%;
  cursor: ew-resize; z-index: 10; display: flex;
  align-items: stretch; justify-content: center;
  background: transparent;
}
${S} .oc-resize-handle .oc-resize-line {
  width: 1px; height: 100%; background: var(--color--border--on-surface-1);
  transition: width 0.12s ease, background 0.12s ease;
  pointer-events: none;
}
${S} .oc-resize-handle:hover .oc-resize-line {
  width: 3px; background: var(--color--base--primary);
}

/* ── Toolbar ────────────────────────────────────────────────── */
${S} .oc-toolbar {
  height: 48px; display: flex; align-items: center;
  justify-content: space-between;
  padding: 0 16px; gap: 6px; flex-shrink: 0;
  background: var(--color--surface--floor); border-bottom: 1px solid var(--color--border--on-surface-0);
  font-family: var(--font-sans); font-size: 13px;
  color: var(--color--text--on-surface); user-select: none;
}
${S} .oc-toolbar-section { display: flex; align-items: center; gap: 12px; }
${S} .oc-toolbar-section-actions { display: flex; align-items: center; gap: 8px; }
${S} .oc-toolbar-group { display: flex; align-items: center; gap: 2px; }
${S} .oc-toolbar-group.is-pill {
  background: var(--color--surface--0); border-radius: 8px;
  padding: 3px; border: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-toolbar-group.is-pill-sm {
  background: var(--color--surface--0); border-radius: 6px;
  padding: 3px; border: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-toolbar-divider { width: 1px; height: 20px; background: var(--color--border--on-surface-0); }
${S} .oc-toolbar-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: 6px;
  font-size: 12px; font-weight: 450; color: var(--color--text--muted);
  background: transparent; border: none; cursor: pointer;
  transition: all 0.15s ease; white-space: nowrap;
}
${S} .oc-toolbar-btn:hover { background: rgba(255,255,255,0.04); color: var(--color--text--on-surface); }
${S} .oc-toolbar-btn.is-active { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-toolbar-badge {
  font-size: 9px; font-weight: 600;
  background: rgba(255,255,255,0.1); color: var(--color--text--on-surface);
  padding: 1px 5px; border-radius: 4px; line-height: 14px;
}
${S} .oc-toolbar-logo {
  display: flex; align-items: center; gap: 8px;
}
${S} .oc-toolbar-logo-icon {
  width: 26px; height: 26px; border-radius: 6px;
  background: var(--color--surface--inverted); display: flex;
  align-items: center; justify-content: center;
}
${S} .oc-toolbar-logo-text {
  font-size: 13px; font-weight: 500; letter-spacing: -0.01em;
}
${S} .oc-toolbar-mcp-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; color: var(--color--status--success);
  background: rgba(16,185,129,0.1);
  padding: 2px 8px; border-radius: 4px;
}
${S} .oc-toolbar-mcp-dot {
  width: 7px; height: 7px; border-radius: 50%;
}
${S} .oc-toolbar-mcp-dot.is-connected { background: var(--color--status--success); }
${S} .oc-toolbar-mcp-dot.is-disconnected { background: var(--color--text--disabled); }
${S} .oc-toolbar-conn-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--color--status--success);
}
${S} .oc-toolbar-cmdk {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 6px;
  border: 1px solid var(--color--border--on-surface-0); background: transparent;
  cursor: pointer; color: var(--color--text--muted);
  font-size: 12px; transition: all 0.15s ease;
}
${S} .oc-toolbar-cmdk:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-toolbar-cmdk-key { font-size: 11px; font-weight: 500; }
${S} .oc-toolbar-route-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 6px; font-size: 12px;
  background: var(--color--surface--0);
  border: 1px solid var(--color--border--on-surface-0); color: var(--color--text--muted);
  cursor: pointer; transition: all 0.15s ease;
}
${S} .oc-toolbar-route-btn:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-toolbar-route-text {
  max-width: 100px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-toolbar-dropdown {
  position: absolute; top: 100%; left: 0; margin-top: 6px;
  background: var(--color--surface--floor); border: 1px solid var(--color--border--on-surface-0);
  border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.5);
  z-index: 100; overflow: hidden;
}
${S} .oc-toolbar-dropdown-inputrow {
  padding: 8px 10px; border-bottom: 1px solid var(--color--border--on-surface-0);
  display: flex; gap: 6px;
}
${S} .oc-toolbar-dropdown-input {
  flex: 1; padding: 6px 10px;
  background: var(--color--surface--0);
  border: 1px solid var(--color--border--on-surface-0); border-radius: 6px;
  color: var(--color--text--on-surface); font-size: 12px;
  font-family: var(--font-mono); outline: none;
}
${S} .oc-toolbar-dropdown-input:focus { border-color: var(--color--outline--focus); }
${S} .oc-toolbar-dropdown-action {
  padding: 6px 14px; background: var(--color--base--primary);
  border: none; border-radius: 6px; color: var(--color--text--on-primary);
  font-size: 11px; font-weight: 500; cursor: pointer;
}
${S} .oc-toolbar-dropdown-action:hover { background: var(--color--base--primary-hover); }
${S} .oc-toolbar-dropdown-list { max-height: 180px; overflow-y: auto; }
${S} .oc-toolbar-dropdown-list.is-tall { max-height: 200px; }
${S} .oc-toolbar-dropdown-empty {
  padding: 16px; text-align: center; color: var(--color--text--disabled); font-size: 11px;
}
${S} .oc-toolbar-route-item {
  display: block; width: 100%; padding: 8px 14px;
  background: transparent; border: none;
  border-left: 2px solid transparent;
  color: var(--color--text--muted); font-size: 12px;
  text-align: left; cursor: pointer;
  font-family: var(--font-mono); transition: all 0.1s ease;
}
${S} .oc-toolbar-route-item:hover { background: rgba(255,255,255,0.03); color: var(--color--text--on-surface); }
${S} .oc-toolbar-route-item.is-active {
  background: rgba(37,99,235,0.07);
  border-left-color: var(--color--outline--on-background); color: var(--color--text--primary);
}
${S} .oc-toolbar-project-trigger {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 6px;
  background: var(--color--surface--0);
  border: 1px solid var(--color--border--on-surface-0); cursor: pointer;
}
${S} .oc-toolbar-project-trigger:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-toolbar-project-dot {
  width: 6px; height: 6px; border-radius: 50%;
}
${S} .oc-toolbar-project-dot.is-saved { background: var(--color--status--success); }
${S} .oc-toolbar-project-dot.is-unsaved { background: var(--color--status--warning); }
${S} .oc-toolbar-project-input {
  width: 100px; padding: 1px 4px;
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  border-radius: 3px; color: var(--color--text--on-surface);
  font-size: 12px; outline: none;
}
${S} .oc-toolbar-project-name {
  font-size: 12px; max-width: 120px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; color: var(--color--text--on-surface);
}
${S} .oc-toolbar-project-unsaved {
  font-size: 9px; color: var(--color--status--warning); font-style: italic;
}
${S} .oc-toolbar-project-save-btn {
  flex: 1; display: flex; align-items: center; justify-content: center;
  gap: 5px; padding: 6px 0; background: var(--color--base--primary);
  border: none; border-radius: 6px; color: var(--color--text--on-primary);
  font-size: 11px; font-weight: 500; cursor: pointer;
}
${S} .oc-toolbar-project-save-btn:hover { background: var(--color--base--primary-hover); }
${S} .oc-toolbar-project-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; background: transparent;
  border-left: 2px solid transparent;
  cursor: pointer; transition: all 0.1s ease;
}
${S} .oc-toolbar-project-item:hover { background: rgba(255,255,255,0.03); }
${S} .oc-toolbar-project-item.is-active {
  background: rgba(37,99,235,0.07);
  border-left-color: var(--color--outline--on-background);
}
${S} .oc-toolbar-project-item-name {
  font-size: 12px; color: var(--color--text--on-surface);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-toolbar-project-item.is-active .oc-toolbar-project-item-name {
  color: var(--color--text--primary);
}
${S} .oc-toolbar-project-item-meta {
  font-size: 9px; color: var(--color--text--disabled); margin-top: 2px;
}
${S} .oc-toolbar-project-delete {
  background: none; border: none; cursor: pointer;
  padding: 2px; color: var(--color--status--critical);
  display: none;
}
${S} .oc-toolbar-project-item:hover .oc-toolbar-project-delete {
  display: block;
}

/* ── Panel (shared base) ───────────────────────────────────── */
${S} .oc-panel {
  height: 100%; display: flex; flex-direction: column;
  background: var(--color--surface--floor); font-family: var(--font-sans);
  overflow: hidden;
}
${S} .oc-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--color--border--on-surface-0);
  font-size: 12px; font-weight: 600; color: var(--color--text--on-surface);
}
${S} .oc-panel-title {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--color--text--on-surface-variant);
}
${S} .oc-panel-body { flex: 1; overflow-y: auto; overflow-x: auto; }
${S} .oc-panel-section {
  padding: 10px 14px; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-panel-empty {
  padding: 24px 14px; text-align: center;
  color: var(--color--text--muted); font-size: 12px;
}
${S} .oc-panel-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-radius: 4px;
  font-size: 11px; color: var(--color--text--muted);
  background: transparent; border: none; cursor: pointer;
  transition: all 0.15s ease;
}
${S} .oc-panel-btn:hover { background: rgba(255,255,255,0.04); color: var(--color--text--on-surface); }

/* ── Layers Panel ──────────────────────────────────────────── */
${S} .oc-layers-search {
  margin: 8px 10px; padding: 6px 10px;
  border-radius: 6px; border: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--0); color: var(--color--text--on-surface);
  font-size: 12px; width: calc(100% - 20px); outline: none;
}
${S} .oc-layers-search:focus { border-color: var(--color--outline--focus); }
${S} .oc-layers-search::placeholder { color: var(--color--text--disabled); }
${S} .oc-layers-row {
  display: flex; align-items: center; gap: 4px;
  height: 26px; padding: 0 10px; cursor: pointer;
  font-size: 12px; color: var(--color--text--on-surface-variant);
  transition: background 0.1s ease;
  min-width: max-content;
}
${S} .oc-layers-row:hover { background: rgba(255,255,255,0.03); }
${S} .oc-layers-row.is-selected {
  background: rgba(37,99,235,0.08);
  color: var(--color--text--on-surface);
}
${S} .oc-layers-row.is-hovered-element {
  background: rgba(37,99,235,0.05);
}
${S} .oc-layers-tag-icon {
  width: 14px; height: 14px; display: flex;
  align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; border-radius: 3px;
  flex-shrink: 0;
}
${S} .oc-layers-toggle {
  width: 14px; height: 14px; display: flex;
  align-items: center; justify-content: center;
  cursor: pointer; color: var(--color--text--disabled); flex-shrink: 0;
}
${S} .oc-layers-toggle:hover { color: var(--color--text--on-surface-variant); }
${S} .oc-layers-name { flex: 1; white-space: nowrap; }
${S} .oc-layers-actions {
  display: none; align-items: center; gap: 2px;
}
${S} .oc-layers-row:hover .oc-layers-actions { display: flex; }
${S} .oc-layers-action-btn {
  width: 18px; height: 18px; display: flex;
  align-items: center; justify-content: center;
  border-radius: 3px; cursor: pointer; color: var(--color--text--disabled);
  background: transparent; border: none;
}
${S} .oc-layers-action-btn:hover { background: rgba(255,255,255,0.06); color: var(--color--text--on-surface-variant); }

/* ── Style Panel ───────────────────────────────────────────── */
${S} .oc-style-tabs {
  display: flex; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-style-tab {
  flex: 1; padding: 8px 0; font-size: 11px; font-weight: 500;
  text-align: center; color: var(--color--text--muted);
  background: transparent; border: none; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all 0.15s ease;
}
${S} .oc-style-tab:hover { color: var(--color--text--on-surface); }
${S} .oc-style-tab.is-active {
  color: var(--color--text--on-surface); border-bottom-color: var(--color--outline--on-background);
}
${S} .oc-style-property {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 14px; font-size: 12px;
}
${S} .oc-style-property:hover { background: rgba(255,255,255,0.02); }
${S} .oc-style-prop-name { color: var(--color--text--muted); min-width: 100px; }
${S} .oc-style-prop-value {
  color: var(--color--text--on-surface); text-align: right; flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-swatch {
  width: 14px; height: 14px; border-radius: 3px;
  border: 1px solid var(--color--border--on-surface-1); display: inline-block;
  vertical-align: middle; margin-right: 6px;
}
${S} .oc-style-input {
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  border-radius: 4px; padding: 4px 8px; color: var(--color--text--on-surface);
  font-size: 12px; font-family: var(--font-mono); outline: none;
  width: 100%;
}
${S} .oc-style-input:focus { border-color: var(--color--outline--focus); }
${S} .oc-style-boxmodel {
  margin: 12px 14px; padding: 20px; border-radius: 8px;
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  font-family: var(--font-mono); font-size: 11px;
  color: var(--color--text--on-surface-variant); text-align: center;
}
${S} .oc-style-boxmodel-margin {
  background: rgba(255,152,0,0.13); border: 1px solid rgba(255,152,0,0.25);
  border-radius: 8px; padding: 12px; text-align: center;
}
${S} .oc-style-boxmodel-margin-label { font-size: 10px; color: #ff9800; margin-bottom: 4px; }
${S} .oc-style-boxmodel-padding {
  background: rgba(76,175,80,0.13); border: 1px solid rgba(76,175,80,0.25);
  border-radius: 6px; padding: 12px;
}
${S} .oc-style-boxmodel-padding-label { font-size: 10px; color: #4caf50; margin-bottom: 4px; }
${S} .oc-style-boxmodel-content {
  background: rgba(33,150,243,0.13); border: 1px solid rgba(33,150,243,0.25);
  border-radius: 4px; padding: 8px;
}
${S} .oc-style-boxmodel-content-label { font-size: 11px; color: #2196f3; }
${S} .oc-style-boxmodel-dim { font-size: 9px; opacity: 0.6; margin-left: 4px; }
${S} .oc-style-tag-badge {
  font-size: 12px; color: var(--color--text--primary);
  background: rgba(37,99,235,0.09); padding: 2px 8px;
  border-radius: 4px; font-family: var(--font-mono);
}
${S} .oc-style-class-badge {
  font-size: 10px; color: var(--color--text--on-surface-variant);
  background: var(--color--surface--1); padding: 2px 6px;
  border-radius: 3px; border: 1px solid var(--color--border--on-surface-0);
  font-family: var(--font-mono);
}
${S} .oc-style-class-overflow { font-size: 10px; color: var(--color--text--muted); }
${S} .oc-style-prop-count { font-size: 11px; color: var(--color--text--on-surface-variant); }
${S} .oc-style-section-btn {
  display: flex; align-items: center; width: 100%;
  padding: 4px 0; background: transparent; border: none;
  cursor: pointer; color: var(--color--text--on-surface); font-size: 12px;
  transition: background 0.1s ease;
}
${S} .oc-style-section-btn:hover { background: rgba(255,255,255,0.02); }
${S} .oc-style-section-icon { margin-right: 6px; display: inline-flex; }
${S} .oc-style-section-name { font-size: 12px; font-weight: 450; }
${S} .oc-style-section-count { margin-left: auto; font-size: 10px; color: var(--color--text--muted); }
${S} .oc-style-label {
  display: block; font-size: 11px; color: var(--color--text--muted); margin-bottom: 6px;
}
${S} .oc-style-code-block {
  font-size: 11px; color: var(--color--text--on-surface); background: var(--color--surface--1);
  padding: 12px; border-radius: 8px; border: 1px solid var(--color--border--on-surface-0);
  overflow-x: auto; white-space: pre; font-family: var(--font-mono);
}
${S} .oc-style-selector-code {
  font-size: 11px; color: var(--color--status--success); background: var(--color--surface--1);
  padding: 6px 10px; border-radius: 6px; display: block;
  border: 1px solid var(--color--border--on-surface-0); word-break: break-all;
  font-family: var(--font-mono);
}
${S} .oc-style-computed-row {
  display: flex; align-items: center; padding: 3px 0;
  font-size: 10px; border-bottom: 1px solid var(--color--border--on-surface-0);
  font-family: var(--font-mono);
}
${S} .oc-style-computed-name {
  color: var(--color--text--muted); width: 110px; flex-shrink: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-syntax-comment { color: var(--color--syntax--comment); }
${S} .oc-style-syntax-selector { color: var(--color--syntax--selector); }
${S} .oc-style-syntax-property { color: var(--color--syntax--property); }
${S} .oc-style-syntax-value { color: var(--color--syntax--value); }
${S} .oc-style-empty-icon { margin: 0 auto 12px; display: block; }
${S} .oc-style-prop-value-wrap {
  flex: 1; display: flex; align-items: center; gap: 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-click-value {
  flex: 1; color: var(--color--text--on-surface); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; cursor: text;
}
${S} .oc-style-section-children { padding-bottom: 4px; }
${S} .oc-style-empty-centered {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 24px 14px; text-align: center; color: var(--color--text--muted); font-size: 12px;
}
${S} .oc-style-header-col {
  display: flex; flex-direction: column; align-items: stretch;
  padding: 10px 14px; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-style-header-row {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
}
${S} .oc-style-header-meta {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
${S} .oc-style-class-list { display: flex; flex-wrap: wrap; gap: 4px; }
${S} .oc-style-tab-content { padding: 12px; }
${S} .oc-style-sub-hint { font-size: 11px; margin-top: 4px; }
${S} .oc-style-selector-block { margin-bottom: 12px; }
${S} .oc-style-chevron { margin-right: 6px; }

/* ── Canvas Nodes ──────────────────────────────────────────── */
${S} .oc-source-chrome {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: var(--color--surface--0);
  border-bottom: 1px solid var(--color--border--on-surface-0);
  border-radius: 10px 10px 0 0; user-select: none;
}
${S} .oc-source-traffic-dot { width: 10px; height: 10px; border-radius: 50%; }
${S} .oc-source-url {
  flex: 1; padding: 4px 10px; border-radius: 6px;
  background: var(--color--surface--1); color: var(--color--text--muted);
  font-size: 11px; font-family: var(--font-mono);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-source-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  background: transparent; border: none; cursor: pointer;
  color: var(--color--text--muted); transition: all 0.15s ease;
}
${S} .oc-source-btn:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-source-btn.is-active { background: var(--color--base--primary); color: var(--color--text--on-primary); }
${S} .oc-source-preset {
  padding: 3px 8px; border-radius: 4px; font-size: 10px;
  background: transparent; border: none; cursor: pointer;
  color: var(--color--text--muted); font-family: var(--font-mono);
  transition: all 0.15s ease;
}
${S} .oc-source-preset:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-source-preset.is-active { background: var(--color--base--primary); color: var(--color--text--on-primary); }

${S} .oc-variant-card {
  border-radius: 10px; border: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--0); overflow: hidden;
  transition: border-color 0.2s ease;
}
${S} .oc-variant-card:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-variant-card.is-selected { border-color: var(--color--outline--on-background); }
${S} .oc-variant-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; background: var(--color--surface--0);
  border-bottom: 1px solid var(--color--border--on-surface-0);
  font-size: 12px; user-select: none;
}
${S} .oc-variant-status {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
${S} .oc-variant-name {
  flex: 1; color: var(--color--text--on-surface); font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-variant-actions {
  display: flex; align-items: center; gap: 2px;
}
${S} .oc-variant-action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 4px;
  background: transparent; border: none; cursor: pointer;
  color: var(--color--text--muted); transition: all 0.15s ease;
}
${S} .oc-variant-action-btn:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }

/* ── Agent Panel ───────────────────────────────────────────── */
${S} .oc-agent-ide-card {
  padding: 12px; border-radius: 10px;
  border: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--0); margin-bottom: 8px;
  transition: border-color 0.15s ease;
}
${S} .oc-agent-ide-card:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-agent-card-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
${S} .oc-agent-card-info {
  display: flex; align-items: center; gap: 10px;
}
${S} .oc-agent-card-icon {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; color: var(--color--text--on-primary);
}
${S} .oc-agent-card-name { font-size: 13px; color: var(--color--text--on-surface); }
${S} .oc-agent-card-desc { font-size: 10px; color: var(--color--text--muted); }
${S} .oc-agent-status-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; padding: 2px 8px; border-radius: 4px;
}
${S} .oc-agent-status-badge.is-connected {
  color: var(--color--status--success); background: rgba(16,185,129,0.08);
}
${S} .oc-agent-status-badge.is-connecting {
  color: var(--color--status--connecting); background: rgba(249,115,22,0.08);
}
${S} .oc-agent-status-badge.is-disconnected {
  color: var(--color--text--disabled); background: rgba(82,82,82,0.08);
}
${S} .oc-agent-status-dot {
  width: 6px; height: 6px; border-radius: 50%;
}
${S} .oc-agent-status-dot.is-connected { background: var(--color--status--success); }
${S} .oc-agent-status-dot.is-connecting { background: var(--color--status--connecting); }
${S} .oc-agent-status-dot.is-disconnected { background: var(--color--text--disabled); }
${S} .oc-agent-last-sync {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; color: var(--color--text--muted); margin-bottom: 10px;
}
${S} .oc-agent-code-block {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-radius: 8px;
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  cursor: pointer; transition: border-color 0.15s ease; margin-bottom: 10px;
}
${S} .oc-agent-code-block:hover { border-color: var(--color--border--on-surface-2); }
${S} .oc-agent-code-block code {
  font-family: var(--font-mono); font-size: 10px; color: var(--color--status--success);
}
${S} .oc-agent-btn-row { display: flex; gap: 8px; }
${S} .oc-agent-btn-secondary {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 6px 0; border: 1px solid var(--color--border--on-surface-0); border-radius: 8px;
  background: transparent; color: var(--color--text--muted);
  font-size: 11px; font-family: var(--font-sans); cursor: pointer;
  transition: all 0.15s ease;
}
${S} .oc-agent-btn-secondary:hover { border-color: var(--color--border--on-surface-1); color: var(--color--text--on-surface-variant); }
${S} .oc-agent-btn-primary {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 6px 0; border: none; border-radius: 8px;
  background: var(--color--base--primary); color: var(--color--text--on-primary);
  font-size: 11px; font-weight: 500; font-family: var(--font-sans); cursor: pointer;
  transition: all 0.15s ease;
}
${S} .oc-agent-btn-primary:hover { background: var(--color--base--primary-light); }
${S} .oc-agent-btn-primary.is-accent {
  background: var(--color--base--primary); color: var(--color--text--on-primary);
}
${S} .oc-agent-btn-primary.is-accent:hover { background: var(--color--base--primary-light); }
${S} .oc-agent-btn-primary.is-disabled {
  background: var(--color--surface--1); color: var(--color--text--disabled); cursor: default;
}
${S} .oc-agent-mcp-card {
  padding: 16px; border: 1px solid var(--color--border--on-surface-0); border-radius: 10px;
  background: var(--color--surface--0); margin-bottom: 12px;
}
${S} .oc-agent-mcp-url {
  font-size: 11px; color: var(--color--text--muted); margin-bottom: 8px;
}
${S} .oc-agent-mcp-url code { font-family: var(--font-mono); color: var(--color--text--on-surface); }
${S} .oc-agent-mcp-desc {
  font-size: 11px; color: var(--color--text--muted); margin-bottom: 12px;
}
${S} .oc-agent-setup-card {
  padding: 12px; border: 1px solid var(--color--border--on-surface-0); border-radius: 10px;
  background: var(--color--surface--0);
}
${S} .oc-agent-setup-title { font-size: 11px; color: var(--color--text--muted); margin-bottom: 8px; }
${S} .oc-agent-setup-hint { font-size: 10px; color: var(--color--text--disabled); margin-bottom: 8px; }
${S} .oc-agent-setup-pre {
  font-size: 10px; font-family: var(--font-mono); color: var(--color--text--on-surface);
  background: var(--color--surface--1); padding: 10px; border-radius: 8px;
  border: 1px solid var(--color--border--on-surface-1); margin-top: 6px;
  white-space: pre-wrap; word-break: break-all;
}
${S} .oc-agent-active-badge {
  font-size: 10px; color: var(--color--status--success);
  background: rgba(16,185,129,0.08); padding: 2px 8px; border-radius: 4px;
}
${S} .oc-agent-log-entry {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 6px 0; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-agent-log-time {
  font-size: 10px; color: var(--color--text--disabled); font-family: var(--font-mono);
  flex-shrink: 0; margin-top: 1px;
}
${S} .oc-agent-log-summary { font-size: 11px; }
${S} .oc-agent-log-summary.is-sent { color: var(--color--text--primary); }
${S} .oc-agent-log-summary.is-received { color: var(--color--status--success); }
${S} .oc-agent-log-summary.is-default { color: var(--color--text--muted); }
${S} .oc-agent-log-method { font-size: 9px; color: var(--color--text--disabled); }

/* ── Element Chat ──────────────────────────────────────────── */
${S} .oc-chat-panel {
  position: absolute; z-index: 40;
  width: 320px; border-radius: 12px;
  border: 1px solid var(--color--border--on-surface-0); background: var(--color--surface--floor);
  box-shadow: var(--shadow-xl); overflow: hidden;
  animation: oc-slide-up 0.2s ease;
}
@keyframes oc-slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
${S} .oc-chat-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-chat-intent-btn {
  padding: 4px 10px; border-radius: 6px; font-size: 11px;
  background: transparent; border: 1px solid var(--color--border--on-surface-0);
  color: var(--color--text--on-surface-variant); cursor: pointer; transition: all 0.15s ease;
}
${S} .oc-chat-intent-btn:hover { border-color: var(--color--border--on-surface-1); color: var(--color--text--on-surface); }
${S} .oc-chat-intent-btn.is-active { border-color: var(--color--outline--on-background); color: var(--color--text--primary-light); background: rgba(37,99,235,0.1); }
${S} .oc-chat-textarea {
  width: 100%; min-height: 60px; padding: 10px 14px;
  background: transparent; border: none; color: var(--color--text--on-surface);
  font-size: 13px; font-family: var(--font-sans); resize: none; outline: none;
}
${S} .oc-chat-textarea::placeholder { color: var(--color--text--disabled); }
${S} .oc-chat-submit {
  padding: 6px 14px; border-radius: 6px;
  background: var(--color--base--primary); color: var(--color--text--on-primary);
  font-size: 12px; font-weight: 500; border: none; cursor: pointer;
  transition: background 0.15s ease;
}
${S} .oc-chat-submit:hover { background: var(--color--base--primary-hover); }
${S} .oc-chat-submit:disabled { background: var(--color--surface--1); color: var(--color--text--disabled); cursor: default; }
${S} .oc-chat-submit:disabled:hover { background: var(--color--surface--1); }
${S} .oc-chat-intent-btn.is-active.intent-fix { border-color: var(--color--status--critical); color: var(--color--text--critical-light); background: rgba(239,68,68,0.1); }
${S} .oc-chat-intent-btn.is-active.intent-change { border-color: var(--color--status--warning); color: var(--yellow-400); background: rgba(245,158,11,0.1); }
${S} .oc-chat-intent-btn.is-active.intent-question { border-color: var(--color--outline--on-background); color: var(--color--text--primary-light); background: rgba(37,99,235,0.1); }
${S} .oc-chat-intent-btn.is-active.intent-approve { border-color: var(--color--status--success); color: var(--green-400); background: rgba(16,185,129,0.1); }
${S} .oc-chat-severity-btn {
  padding: 3px 10px; border-radius: 6px; font-size: 11px;
  background: transparent; border: 1px solid var(--color--border--on-surface-0);
  color: var(--color--text--muted); cursor: pointer; transition: all 0.15s ease;
  font-family: inherit;
}
${S} .oc-chat-severity-btn:hover { border-color: var(--color--border--on-surface-1); color: var(--color--text--on-surface); }
${S} .oc-chat-severity-btn.is-active.severity-blocking { border-color: var(--color--status--critical); color: var(--color--text--critical-light); background: rgba(239,68,68,0.08); }
${S} .oc-chat-severity-btn.is-active.severity-important { border-color: var(--color--status--warning); color: var(--yellow-400); background: rgba(245,158,11,0.08); }
${S} .oc-chat-severity-btn.is-active.severity-suggestion { border-color: var(--color--outline--on-background); color: var(--color--text--primary-light); background: rgba(37,99,235,0.08); }
${S} .oc-chat-context {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 4px;
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-0);
  font-size: 10px; color: var(--color--text--muted);
  font-family: var(--font-mono);
}
${S} .oc-chat-context-tag { color: var(--color--text--primary); }
${S} .oc-chat-context-class { color: var(--color--text--disabled); }
${S} .oc-chat-context-variant { color: var(--color--text--info); margin-left: 4px; }
${S} .oc-chat-badge {
  background: var(--color--base--primary); color: var(--color--text--on-primary);
  border-radius: 10px; padding: 1px 7px;
  font-size: 10px; font-weight: 600;
}
${S} .oc-chat-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 14px 12px;
}
${S} .oc-chat-hint { font-size: 10px; color: var(--color--text--hint); }
${S} .oc-chat-row { display: flex; gap: 4px; padding: 8px 14px 4px; }
${S} .oc-chat-row-severity { display: flex; gap: 4px; padding: 4px 14px 8px; }
${S} .oc-chat-body { padding: 0 14px 10px; }
${S} .oc-chat-context-row { padding: 8px 14px 4px; }
${S} .oc-chat-header-left { display: flex; align-items: center; gap: 8px; }
${S} .oc-chat-header-title { color: var(--color--text--on-surface); font-size: 12px; font-weight: 500; }
${S} .oc-chat-header-icon { width: 14px; height: 14px; color: var(--color--text--primary); }

/* ── Waitlist / Feedback Queue ─────────────────────────────── */
${S} .oc-waitlist {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 50;
  font-family: 'Geist Sans', 'Inter', system-ui, sans-serif;
}
${S} .oc-waitlist-inner {
  background: var(--color--surface--floor); border-top: 1px solid var(--color--border--on-surface-0);
  transition: max-height 0.2s ease; overflow: hidden;
  display: flex; flex-direction: column;
}
${S} .oc-waitlist-inner.is-collapsed { max-height: 36px; }
${S} .oc-waitlist-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; height: 36px; flex-shrink: 0; cursor: pointer;
}
${S} .oc-waitlist-header.is-expanded { border-bottom: 1px solid var(--color--border--on-surface-0); }
${S} .oc-waitlist-header-left { display: flex; align-items: center; gap: 8px; }
${S} .oc-waitlist-title { font-size: 11px; color: var(--color--text--on-surface); font-weight: 500; }
${S} .oc-waitlist-badge {
  background: var(--color--base--primary); color: #fff; border-radius: 8px;
  padding: 0 6px; font-size: 9px; font-weight: 600;
}
${S} .oc-waitlist-header-right { display: flex; align-items: center; gap: 6px; }
${S} .oc-waitlist-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 5px;
  border: 1px solid var(--color--border--on-surface-0); background: var(--color--surface--1);
  color: var(--color--text--muted); cursor: pointer;
  font-size: 10px; font-family: inherit;
}
${S} .oc-waitlist-btn:hover { color: var(--color--text--on-surface); }
${S} .oc-waitlist-btn.is-send {
  background: var(--color--base--primary); color: #fff; border-color: var(--color--outline--on-background);
}
${S} .oc-waitlist-btn.is-sending {
  background: var(--color--surface--2); color: #fff; border-color: var(--color--surface--2); cursor: wait;
}
${S} .oc-waitlist-toast {
  padding: 8px 12px; display: flex; align-items: center; gap: 8px;
}
${S} .oc-waitlist-toast.is-bridge {
  background: rgba(16,185,129,0.08); border-bottom: 1px solid rgba(16,185,129,0.19);
}
${S} .oc-waitlist-toast.is-clipboard {
  background: rgba(245,158,11,0.08); border-bottom: 1px solid rgba(245,158,11,0.19);
}
${S} .oc-waitlist-toast-text { font-size: 10px; }
${S} .oc-waitlist-toast-code {
  font-family: 'SF Mono', monospace; background: var(--color--surface--1);
  padding: 1px 4px; border-radius: 3px;
}
${S} .oc-waitlist-list { flex: 1; overflow-y: auto; padding: 6px 0; }
${S} .oc-waitlist-empty {
  padding: 24px 16px; text-align: center;
  color: var(--color--text--hint); font-size: 11px;
}
${S} .oc-waitlist-group { margin-bottom: 2px; }
${S} .oc-waitlist-group-label {
  padding: 4px 12px; font-size: 9px; color: var(--color--text--disabled);
  text-transform: uppercase; letter-spacing: 0.05em;
}
${S} .oc-waitlist-item {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 6px 12px; border-left: 2px solid transparent;
  transition: background 0.1s ease;
}
${S} .oc-waitlist-item:hover { background: rgba(255,255,255,0.02); }
${S} .oc-waitlist-item.is-selected {
  background: rgba(37,99,235,0.03); border-left-color: var(--color--outline--on-background);
}
${S} .oc-waitlist-item-check {
  background: none; border: none; cursor: pointer;
  padding: 0; margin-top: 2px; color: var(--color--text--hint); flex-shrink: 0;
}
${S} .oc-waitlist-item-check.is-selected { color: var(--color--text--primary); }
${S} .oc-waitlist-item-body { flex: 1; min-width: 0; }
${S} .oc-waitlist-item-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
${S} .oc-waitlist-intent {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 1px 6px; border-radius: 4px;
  font-size: 9px; font-weight: 500;
}
${S} .oc-waitlist-severity {
  padding: 1px 5px; border-radius: 4px; font-size: 9px;
}
${S} .oc-waitlist-comment {
  color: var(--grey-300); font-size: 11px;
  line-height: 1.4; margin: 0; word-break: break-word;
}
${S} .oc-waitlist-item-delete {
  background: none; border: none; cursor: pointer;
  padding: 2px; color: var(--color--text--hint); flex-shrink: 0; margin-top: 2px;
}
${S} .oc-waitlist-item-delete:hover { color: var(--color--text--critical-light); }
${S} .oc-waitlist-chevron { color: var(--color--text--disabled); }

/* ── File Map Panel ────────────────────────────────────────── */
${S} .oc-filemap-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; font-size: 12px; cursor: pointer;
  color: var(--color--text--on-surface-variant); transition: background 0.1s ease;
}
${S} .oc-filemap-item:hover { background: rgba(255,255,255,0.03); }
${S} .oc-filemap-item.is-selected {
  background: rgba(37,99,235,0.08); color: var(--color--text--on-surface);
  border-left: 2px solid var(--color--outline--on-background);
}
${S} .oc-filemap-dir { color: var(--color--text--muted); font-weight: 500; }
${S} .oc-filemap-confidence {
  padding: 1px 5px; border-radius: 3px; font-size: 9px;
  font-weight: 600; color: var(--color--text--on-surface-variant);
}
${S} .oc-filemap-vscode-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-radius: 4px;
  background: var(--color--base--primary); color: var(--color--text--on-primary);
  font-size: 11px; border: none; cursor: pointer;
  transition: background 0.15s ease;
}
${S} .oc-filemap-vscode-btn:hover { background: var(--color--base--primary-hover); }

/* File tree row (file or dir row in the tree) */
${S} .oc-filemap-tree-row {
  display: flex; align-items: center; gap: 6px;
  height: 28px; padding-right: 8px; cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.1s ease;
}
${S} .oc-filemap-tree-row:hover { background: rgba(255,255,255,0.03); }
${S} .oc-filemap-tree-row.is-selected {
  background: rgba(37,99,235,0.08);
  border-left-color: var(--color--outline--on-background);
}

/* Filename text in tree */
${S} .oc-filemap-filename {
  font-size: 11px; color: var(--color--text--on-surface); flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* File badge count */
${S} .oc-filemap-badge {
  font-size: 9px; color: var(--color--text--disabled);
  background: var(--color--surface--1); padding: 1px 5px;
  border-radius: 3px; font-family: var(--font-mono);
}

/* Dir count (no background) */
${S} .oc-filemap-dir-count {
  font-size: 9px; color: var(--color--text--disabled);
  font-family: var(--font-mono);
}

/* Mapping item button (child of file node) */
${S} .oc-filemap-mapping {
  display: flex; align-items: center; gap: 6px;
  width: 100%; height: 26px; padding-right: 8px;
  background: transparent; border: none;
  border-left: 2px solid transparent;
  cursor: pointer; text-align: left;
  transition: background 0.1s ease;
}
${S} .oc-filemap-mapping:hover { background: rgba(255,255,255,0.03); }
${S} .oc-filemap-mapping.is-selected {
  background: rgba(37,99,235,0.08);
  border-left-color: var(--color--outline--on-background);
}
${S} .oc-filemap-mapping-name {
  font-size: 10px; color: var(--color--text--muted); flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-filemap-mapping-dot {
  width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
}
${S} .oc-filemap-mapping-eye {
  display: none; flex-shrink: 0;
}
${S} .oc-filemap-mapping:hover .oc-filemap-mapping-eye {
  display: block;
}

/* Confidence badge (inline) */
${S} .oc-filemap-conf-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 9px; padding: 1px 6px; border-radius: 4px;
}
${S} .oc-filemap-conf-dot {
  width: 4px; height: 4px; border-radius: 50%;
}

/* Selected element view */
${S} .oc-filemap-detail {
  padding: 12px;
}
${S} .oc-filemap-card {
  padding: 12px; background: var(--color--surface--1); border-radius: 10px;
  border: 1px solid var(--color--border--on-surface-0); margin-bottom: 12px;
}
${S} .oc-filemap-card-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
}
${S} .oc-filemap-card-tag {
  font-size: 12px; color: var(--color--text--primary); font-weight: 500;
}
${S} .oc-filemap-card-classes {
  font-size: 10px; color: var(--color--text--disabled); font-family: var(--font-mono);
}
${S} .oc-filemap-card-selector {
  font-size: 10px; color: var(--color--text--disabled);
  font-family: var(--font-mono); word-break: break-all;
}
${S} .oc-filemap-card-text {
  font-size: 10px; color: var(--color--text--muted); margin-top: 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Mapped file card (accent border) */
${S} .oc-filemap-mapped-card {
  padding: 12px; border-radius: 10px; margin-bottom: 12px;
  border: 1px solid rgba(37,99,235,0.19);
  background: rgba(37,99,235,0.03);
}
${S} .oc-filemap-mapped-name {
  font-size: 12px; color: var(--color--text--on-surface); font-weight: 500;
}
${S} .oc-filemap-mapped-path {
  font-size: 11px; color: var(--color--text--muted);
  font-family: var(--font-mono); margin-bottom: 4px;
}
${S} .oc-filemap-inferred-hint {
  display: flex; align-items: center; gap: 4px;
  font-size: 9px; color: var(--color--status--warning); margin-bottom: 8px;
}

/* Open in VS Code button (full-width) */
${S} .oc-filemap-open-btn {
  width: 100%; display: flex; align-items: center; justify-content: center;
  gap: 6px; padding: 7px 0; border-radius: 8px;
  border: 1px solid rgba(37,99,235,0.25);
  background: rgba(37,99,235,0.06);
  color: var(--color--text--primary); font-size: 11px; font-weight: 500;
  cursor: pointer; transition: all 0.15s ease;
}
${S} .oc-filemap-open-btn:hover {
  background: rgba(37,99,235,0.13);
}

/* No-mapping card */
${S} .oc-filemap-nomap-card {
  padding: 12px; border-radius: 10px; margin-bottom: 12px;
  border: 1px solid var(--color--border--on-surface-0); background: var(--color--surface--1);
}
${S} .oc-filemap-nomap-title {
  font-size: 12px; color: var(--color--text--muted);
}
${S} .oc-filemap-nomap-desc {
  font-size: 10px; color: var(--color--text--disabled); line-height: 1.5;
}

/* Child components section header */
${S} .oc-filemap-section-title {
  font-size: 10px; color: var(--color--text--disabled); text-transform: uppercase;
  letter-spacing: 0.05em; margin-bottom: 6px; font-weight: 500;
}
${S} .oc-filemap-children-list {
  border-radius: 8px; border: 1px solid var(--color--border--on-surface-0);
  overflow: hidden;
}
${S} .oc-filemap-child-btn {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 7px 10px;
  background: transparent; border: none;
  border-bottom: 1px solid var(--color--border--on-surface-0);
  cursor: pointer; text-align: left;
  transition: background 0.1s ease;
}
${S} .oc-filemap-child-btn:hover { background: rgba(255,255,255,0.03); }
${S} .oc-filemap-child-btn:last-child { border-bottom: none; }
${S} .oc-filemap-child-name {
  font-size: 11px; color: var(--color--text--on-surface);
}
${S} .oc-filemap-child-path {
  font-size: 9px; color: var(--color--text--disabled);
  font-family: var(--font-mono); flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Stats bar */
${S} .oc-filemap-stats {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 12px; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-filemap-stat {
  display: flex; align-items: center; gap: 4px;
}
${S} .oc-filemap-stat-label {
  font-size: 9px; color: var(--color--text--muted);
}
${S} .oc-filemap-stat-dots {
  display: flex; align-items: center; gap: 6px;
}
${S} .oc-filemap-stat-dot {
  display: flex; align-items: center; gap: 2px;
}
${S} .oc-filemap-dot {
  width: 4px; height: 4px; border-radius: 50%;
}
${S} .oc-filemap-dot-count {
  font-size: 9px; color: var(--color--text--disabled);
}

/* Tabs */
${S} .oc-filemap-tabs {
  display: flex; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-filemap-tab {
  flex: 1; padding: 8px 0; font-size: 11px; font-weight: 450;
  background: transparent; border: none; cursor: pointer;
  color: var(--color--text--disabled);
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
}
${S} .oc-filemap-tab:hover { color: var(--color--text--on-surface-variant); }
${S} .oc-filemap-tab.is-active {
  color: var(--color--text--on-surface);
  border-bottom-color: var(--color--text--on-surface);
}

/* Search wrapper */
${S} .oc-filemap-search-wrap {
  padding: 8px 10px; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-filemap-search-box {
  display: flex; align-items: center; gap: 8px;
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-0);
  border-radius: 8px; padding: 0 10px; height: 28px;
}
${S} .oc-filemap-search-input {
  flex: 1; background: transparent; border: none;
  font-size: 11px; color: var(--color--text--on-surface);
  outline: none;
}
${S} .oc-filemap-search-input::placeholder { color: var(--color--text--disabled); }

/* Empty state */
${S} .oc-filemap-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 48px 20px; text-align: center;
}
${S} .oc-filemap-empty-title {
  font-size: 12px; color: var(--color--text--muted); margin-bottom: 4px;
}
${S} .oc-filemap-empty-desc {
  font-size: 10px; color: var(--color--text--disabled); line-height: 1.5; max-width: 200px;
}

/* Header */
${S} .oc-filemap-header {
  padding: 10px 14px; border-bottom: 1px solid var(--color--border--on-surface-0);
  display: flex; align-items: center; justify-content: space-between;
}
${S} .oc-filemap-header-left {
  display: flex; align-items: center; gap: 8px;
}
${S} .oc-filemap-header-title {
  font-size: 13px; font-weight: 500;
}
${S} .oc-filemap-inferred-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 9px; color: var(--color--status--warning);
  background: rgba(245,158,11,0.08);
  padding: 1px 6px; border-radius: 4px;
}
${S} .oc-filemap-header-count {
  font-size: 10px; color: var(--color--text--disabled);
  font-family: var(--font-mono);
}

/* Footer / legend */
${S} .oc-filemap-footer {
  padding: 6px 12px; border-top: 1px solid var(--color--border--on-surface-0);
  display: flex; align-items: center; gap: 10px;
}
${S} .oc-filemap-footer-label {
  font-size: 9px; color: var(--color--text--disabled);
}
${S} .oc-filemap-legend-item {
  display: flex; align-items: center; gap: 3px;
}
${S} .oc-filemap-legend-dot {
  width: 4px; height: 4px; border-radius: 50%;
}
${S} .oc-filemap-legend-text {
  font-size: 9px; color: var(--color--text--disabled);
}

/* Content scroll area */
${S} .oc-filemap-content {
  flex: 1; overflow-y: auto; min-height: 0;
}
${S} .oc-filemap-tree-pad {
  padding-top: 4px; padding-bottom: 8px;
}

/* Spacer for icons that have no chevron */
${S} .oc-filemap-chevron-spacer { width: 10px; }

/* ── Command Palette ───────────────────────────────────────── */
${S} .oc-cmd-overlay {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 20vh; background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
}
${S} .oc-cmd-panel {
  width: 520px; border-radius: 12px;
  border: 1px solid var(--color--border--on-surface-0); background: var(--color--surface--floor);
  box-shadow: var(--shadow-2xl); overflow: hidden;
}
${S} .oc-cmd-input {
  width: 100%; padding: 14px 16px; border: none;
  background: transparent; color: var(--color--text--on-surface);
  font-size: 15px; font-family: var(--font-sans); outline: none;
}
${S} .oc-cmd-input::placeholder { color: var(--color--text--disabled); }
${S} .oc-cmd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; cursor: pointer;
  color: var(--color--text--on-surface-variant); font-size: 13px;
  transition: background 0.1s ease;
}
${S} .oc-cmd-item:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-cmd-item.is-active { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-cmd-kbd {
  padding: 2px 6px; border-radius: 4px; font-size: 10px;
  background: var(--color--surface--1); color: var(--color--text--muted);
  font-family: var(--font-mono);
}

/* ── Variant Canvas ────────────────────────── */
${S} .oc-vc-root {
  width: 100%; height: 100%;
  background: var(--color--surface--0);
}
${S} .oc-vc-flow {
  background: var(--color--surface--0);
}
${S} .oc-vc-controls {
  background: var(--color--surface--0);
  border: 1px solid var(--color--surface--0);
  border-radius: 8px;
}
${S} .oc-vc-minimap {
  background: var(--color--surface--0);
  border: 1px solid var(--color--surface--0);
  border-radius: 8px;
}
`;

export function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = ZEROCANVAS_CSS;
  document.head.appendChild(style);
}

export function removeStyles(): void {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
}