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
//   annotation-overlay.tsx, command-palette.tsx,
//   ui/scroll-area.tsx
//
// ──────────────────────────────────────────────────────────

// Phase 4 — the modular barrel holds new rules (tiles, auth tabs,
// effort selector, slash palette). Kept separate from the legacy
// monolithic string so we can migrate rules out incrementally.
import { ZEROCANVAS_CSS as MODULAR_CSS } from "./styles/index";

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
/* ── App Shell (page tabs + page) ──────────────────────────── */
${S} .oc-app-shell {
  height: 100%; display: flex; flex-direction: column; overflow: hidden;
}

/* ── Page tabs (horizontal — Design / Themes) ─────────────── */
${S} .oc-page-tabs {
  display: flex; align-items: center; gap: 2px;
  padding: 10px 10px 4px;
  flex-shrink: 0;
  background: var(--color--surface--floor);
  border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-page-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px;
  background: transparent; border: none; border-radius: 6px;
  color: var(--color--text--muted);
  font-size: 12px; font-weight: 500;
  cursor: pointer; white-space: nowrap;
  font-family: inherit;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-page-tab:hover {
  color: var(--color--text--on-surface);
  background: rgba(255, 255, 255, 0.03);
}
${S} .oc-page-tab.is-active {
  color: var(--color--text--on-surface);
  background: rgba(255, 255, 255, 0.06);
}
${S} .oc-page-tab--close { margin-right: 4px; }

/* ── Settings Page ────────────────────────────────────────── */
${S} .oc-settings-page {
  flex: 1; display: flex; height: 100%;
  background: var(--color--surface--0);
  overflow: hidden;
}
${S} .oc-settings-nav {
  width: 220px; flex-shrink: 0; height: 100%;
  border-right: 1px solid var(--color--border--on-surface-0);
  padding: 16px 0;
  overflow-y: auto;
}
${S} .oc-settings-nav-header {
  font-size: 18px; font-weight: 600;
  color: var(--color--text--on-surface);
  padding: 0 16px; margin-bottom: 16px;
}
${S} .oc-settings-nav-list {
  display: flex; flex-direction: column; gap: 2px;
  padding: 0 8px;
}
${S} .oc-settings-nav-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 8px 10px;
  border: none; background: transparent;
  border-radius: 8px; cursor: pointer;
  color: var(--color--text--muted);
  font-size: 13px; text-align: left;
  transition: all 0.15s ease;
}
${S} .oc-settings-nav-item:hover {
  background: var(--color--surface--1);
  color: var(--color--text--on-surface);
}
${S} .oc-settings-nav-item.is-active {
  background: var(--color--surface--2);
  color: var(--color--text--on-surface);
}
${S} .oc-settings-nav-icon {
  display: flex; align-items: center;
  color: inherit; flex-shrink: 0;
}
${S} .oc-settings-nav-label { flex: 1; }
${S} .oc-settings-nav-chevron {
  color: var(--color--text--disabled);
  flex-shrink: 0; opacity: 0;
  transition: opacity 0.15s ease;
}
${S} .oc-settings-nav-item:hover .oc-settings-nav-chevron,
${S} .oc-settings-nav-item.is-active .oc-settings-nav-chevron { opacity: 1; }
${S} .oc-settings-content {
  flex: 1; height: 100%; overflow: hidden;
}
${S} .oc-settings-scroll {
  height: 100%; max-width: 720px;
  margin: 0 auto; padding: 24px 32px;
}

${S} .oc-workspace {
  flex: 1; height: 100%; display: flex; flex-direction: column;
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
  font-size: 10px; font-weight: 600;
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
  font-size: 10px; padding: 2px 8px; border-radius: 4px;
}
${S} .oc-toolbar-mcp-badge.is-error {
  color: var(--color--status--error);
  background: rgba(239,68,68,0.1);
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
  font-size: 10px; color: var(--color--status--warning); font-style: italic;
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
  font-size: 10px; color: var(--color--text--disabled); margin-top: 2px;
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
  background: var(--color--surface--0); font-family: var(--font-sans);
  overflow: hidden;
}
${S} .oc-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px 8px;
  font-size: 12px; font-weight: 600; color: var(--color--text--on-surface);
}
${S} .oc-panel-title {
  font-size: 13px; font-weight: 600;
  letter-spacing: -0.01em; color: var(--color--text--on-surface);
  text-transform: none;
}
${S} .oc-panel-body { flex: 1; overflow-y: auto; overflow-x: auto; }
${S} .oc-panel-section {
  padding: 6px 10px;
}
${S} .oc-panel-empty {
  padding: 24px 14px; text-align: center;
  color: var(--color--text--muted); font-size: 12px;
}
${S} .oc-panel-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-radius: 5px;
  font-size: 11px; color: var(--color--text--muted);
  background: transparent; border: none; cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-panel-btn:hover { background: rgba(255,255,255,0.05); color: var(--color--text--on-surface); }

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
  font-size: 10px; font-weight: 700; border-radius: 3px;
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
  display: flex; align-items: center; gap: 6px;
  padding: 3px 10px; font-size: 11px; min-width: 0;
}
${S} .oc-style-property:hover { background: rgba(255,255,255,0.03); }
${S} .oc-style-prop-name {
  color: var(--color--text--muted); min-width: 70px; max-width: 80px; flex-shrink: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-prop-value {
  color: var(--color--text--on-surface); text-align: right; flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-swatch {
  width: 14px; height: 14px; border-radius: 3px;
  border: 1px solid var(--color--border--on-surface-1); display: inline-block;
  vertical-align: middle; margin-right: 6px;
}
${S} .oc-style-input {
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  border-radius: 4px; padding: 3px 6px; color: var(--color--text--on-surface);
  font-size: 11px; font-family: var(--font-mono); outline: none;
  width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box;
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
${S} .oc-style-boxmodel-dim { font-size: 10px; opacity: 0.6; margin-left: 4px; }
${S} .oc-style-tag-badge {
  font-size: 12px; color: var(--color--text--primary);
  background: rgba(37,99,235,0.09); padding: 2px 8px;
  border-radius: 4px; font-family: var(--font-mono);
}
${S} .oc-style-class-badge {
  font-size: 10px; color: var(--color--text--on-surface-variant);
  background: var(--color--surface--1); padding: 1px 5px;
  border-radius: 3px; border: 1px solid var(--color--border--on-surface-0);
  font-family: var(--font-mono); max-width: 80px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
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
  color: var(--color--text--muted); width: 85px; flex-shrink: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-syntax-comment { color: var(--color--syntax--comment); }
${S} .oc-style-syntax-selector { color: var(--color--syntax--selector); }
${S} .oc-style-syntax-property { color: var(--color--syntax--property); }
${S} .oc-style-syntax-value { color: var(--color--syntax--value); }
${S} .oc-style-empty-icon { margin: 0 auto 12px; display: block; }
${S} .oc-style-prop-value-wrap {
  flex: 1; display: flex; align-items: center; gap: 4px;
  min-width: 0; overflow: hidden;
}
${S} .oc-style-click-value {
  flex: 1; color: var(--color--text--on-surface); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; cursor: text;
  min-width: 0; font-family: var(--font-mono); font-size: 11px;
}
${S} .oc-style-section-children { padding-bottom: 4px; }
${S} .oc-style-empty-centered {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 24px 14px; text-align: center; color: var(--color--text--muted); font-size: 12px;
}
${S} .oc-style-header-col {
  display: flex; flex-direction: column; align-items: stretch;
  padding: 8px 10px; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-style-header-row {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;
}
${S} .oc-style-header-meta {
  display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
}
${S} .oc-style-class-list { display: flex; flex-wrap: wrap; gap: 3px; }
${S} .oc-style-tab-content { padding: 12px; }
${S} .oc-style-sub-hint { font-size: 11px; margin-top: 4px; }
${S} .oc-style-selector-block { margin-bottom: 12px; }
${S} .oc-style-chevron { margin-right: 6px; }

/* ── Focus Mode Toggle ───────────────────────────────────── */
${S} .oc-focus-toggle {
  position: relative;
  width: 24px; height: 24px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 4px; border: none; cursor: pointer;
  background: transparent; color: var(--color--text--muted);
  transition: all 0.15s ease;
}
${S} .oc-focus-toggle:hover {
  background: rgba(255,255,255,0.06); color: var(--color--text--on-surface);
}
${S} .oc-focus-toggle.is-active {
  color: var(--color--text--primary);
  background: rgba(37,99,235,0.1);
}
${S} .oc-focus-toggle.is-active:hover {
  background: rgba(37,99,235,0.16);
}

/* ── Property Toggle Checkbox ────────────────────────────── */
${S} .oc-style-prop-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 0; overflow: hidden; flex-shrink: 0;
  opacity: 0; cursor: pointer;
  transition: width 0.12s ease, opacity 0.12s ease;
}
${S} .oc-style-prop-check input[type="checkbox"] {
  width: 12px; height: 12px; margin: 0; cursor: pointer;
  accent-color: var(--color--text--primary);
}
${S} .oc-style-property:hover .oc-style-prop-check {
  width: 16px; opacity: 1;
}
/* Keep checkbox visible when property is disabled */
${S} .oc-style-property.is-disabled .oc-style-prop-check {
  width: 16px; opacity: 0.6;
}
/* Disabled property visual: strikethrough + reduced opacity */
${S} .oc-style-property.is-disabled .oc-style-prop-name {
  text-decoration: line-through; opacity: 0.4;
}
${S} .oc-style-property.is-disabled .oc-style-click-value {
  text-decoration: line-through; opacity: 0.4;
}
${S} .oc-style-property.is-disabled .oc-style-prop-value-wrap {
  opacity: 0.4;
}

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
${S} .oc-source-badge {
  position: absolute; top: -2px; right: -2px;
  display: flex; align-items: center; justify-content: center;
  min-width: 14px; height: 14px; padding: 0 3px;
  border-radius: 7px;
  background: var(--color--surface--floor); color: var(--color--text--on-surface);
  font-size: 6px; font-weight: 700; line-height: 1;
  pointer-events: none; box-sizing: border-box;
  transform-origin: center; transform: scale(0.85);
}
${S} .oc-source-btn-group {
  display: flex; align-items: center;
  border-radius: 6px;
}
${S} .oc-source-btn-group.has-items {
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-0);
  border-radius: 8px;
  gap: 0;
}
${S} .oc-source-btn-group.has-items .oc-source-btn {
  border-radius: 7px 0 0 7px;
}
${S} .oc-source-btn-group.has-items .oc-source-send-btn {
  border-radius: 0 7px 7px 0;
  border-left: 1px solid var(--color--border--on-surface-0);
  color: var(--color--text--muted);
}
${S} .oc-source-btn-group.has-items .oc-source-send-btn:hover {
  color: var(--color--text--on-surface);
  background: var(--color--surface--2);
}
${S} .oc-source-preset {
  padding: 3px 8px; border-radius: 4px; font-size: 10px;
  background: transparent; border: none; cursor: pointer;
  color: var(--color--text--muted); font-family: var(--font-mono);
  transition: all 0.15s ease;
}
${S} .oc-source-preset:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-source-preset.is-active { background: var(--color--base--primary); color: var(--color--text--on-primary); }

${S} .oc-variant-card {
  border-radius: 0; border: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--0); overflow: hidden;
  transition: border-color 0.2s ease;
}
${S} .oc-variant-card:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-variant-card.is-selected { border-color: var(--color--outline--on-background); border-width: 2.5px; }

/* ── Resize grab zones + visible handle bars (source node only) ── */

/* Grab zone — wide transparent area the user can grab */
${S} .oc-resize-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

/* Visible handle bar — thin bar inside the grab zone */
${S} .oc-resize-handle {
  border-radius: 3px;
  background: var(--color--border--on-surface-1);
  pointer-events: none;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}
${S} .oc-resize-handle-left,
${S} .oc-resize-handle-right {
  width: 4px;
  height: 48px;
}
${S} .oc-resize-handle-bottom {
  height: 4px;
  width: 48px;
}

/* Hover on the ZONE triggers the handle animation */
${S} .oc-resize-zone-left:hover .oc-resize-handle,
${S} .oc-resize-zone-right:hover .oc-resize-handle {
  background: var(--color--text--muted);
  transform: scaleY(1.4);
  box-shadow: 0 0 8px rgba(115,115,115,0.3);
}
${S} .oc-resize-zone-bottom:hover .oc-resize-handle {
  background: var(--color--text--muted);
  transform: scaleX(1.4);
  box-shadow: 0 0 8px rgba(115,115,115,0.3);
}

/* Active (dragging) */
${S} .oc-resize-zone.is-active .oc-resize-handle {
  background: var(--color--text--on-surface-variant) !important;
  box-shadow: 0 0 12px rgba(212,212,212,0.25) !important;
}
${S} .oc-resize-zone-left.is-active .oc-resize-handle,
${S} .oc-resize-zone-right.is-active .oc-resize-handle {
  transform: scaleY(1.6) !important;
}
${S} .oc-resize-zone-bottom.is-active .oc-resize-handle {
  transform: scaleX(1.6) !important;
}
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
${S} .oc-agent-log-method { font-size: 10px; color: var(--color--text--disabled); }

/* ── Command Palette ───────────────────────────────────────── */
${S} .oc-cmd-overlay {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 20vh; background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
}
${S} .oc-cmd-panel {
  width: 520px; max-height: 420px; border-radius: 12px;
  border: 1px solid var(--color--border--on-surface-0); background: var(--color--surface--floor);
  box-shadow: var(--shadow-2xl); overflow: hidden;
  display: flex; flex-direction: column;
}
${S} .oc-cmd-input {
  width: 100%; padding: 14px 16px; border: none;
  background: transparent; color: var(--color--text--on-surface);
  font-size: 15px; font-family: var(--font-sans); outline: none;
  flex-shrink: 0;
}
${S} .oc-cmd-input::placeholder { color: var(--color--text--disabled); }
${S} .oc-cmd-divider {
  height: 1px; background: var(--color--border--on-surface-0); flex-shrink: 0;
}
${S} .oc-cmd-list {
  overflow-y: auto; padding: 6px 0; flex: 1; min-height: 0;
}
${S} .oc-cmd-category {
  padding: 8px 16px 4px; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--color--text--muted);
}
${S} .oc-cmd-item {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 8px 16px; cursor: pointer;
  color: var(--color--text--on-surface-variant); font-size: 13px;
  transition: background 0.1s ease;
}
${S} .oc-cmd-item:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-cmd-item.is-active { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-cmd-label { flex: 1; }
${S} .oc-cmd-kbd {
  padding: 2px 6px; border-radius: 4px; font-size: 10px;
  background: var(--color--surface--1); color: var(--color--text--muted);
  font-family: var(--font-mono);
}
${S} .oc-cmd-empty {
  padding: 24px 16px; text-align: center;
  color: var(--color--text--disabled); font-size: 13px;
}

/* ── Inline Edit (Cmd+K) ──────────────────────────────────── */
${S} .oc-inline-edit {
  width: 360px; border-radius: 12px; z-index: 110;
  border: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--floor);
  box-shadow: var(--shadow-2xl); overflow: hidden;
  animation: oc-inline-edit-in 0.15s ease-out;
}
@keyframes oc-inline-edit-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
${S} .oc-inline-edit-input-row {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
}
${S} .oc-inline-edit-icon { flex-shrink: 0; color: var(--color--text--muted); }
${S} .oc-inline-edit-input {
  flex: 1; border: none; background: transparent;
  color: var(--color--text--on-surface); font-size: 13px;
  font-family: var(--font-sans); outline: none;
}
${S} .oc-inline-edit-input::placeholder { color: var(--color--text--disabled); }
${S} .oc-inline-edit-kbd {
  flex-shrink: 0; padding: 2px 6px; border-radius: 4px;
  font-size: 10px; background: var(--color--surface--1);
  color: var(--color--text--muted); font-family: var(--font-mono);
}
${S} .oc-inline-edit-status {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; color: var(--color--text--on-surface-variant); font-size: 13px;
}
${S} .oc-inline-edit-spinner {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid var(--color--border--on-surface-0);
  border-top-color: var(--color--text--on-surface);
  animation: oc-spin 0.6s linear infinite;
}
@keyframes oc-spin { to { transform: rotate(360deg); } }
${S} .oc-inline-edit-result {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; gap: 10px;
}
${S} .oc-inline-edit-result-info {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--color--text--on-surface);
}
${S} .oc-inline-edit-actions { display: flex; gap: 6px; }
${S} .oc-inline-edit-accept,
${S} .oc-inline-edit-reject {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-radius: 6px; border: none;
  font-size: 12px; cursor: pointer; font-family: var(--font-sans);
}
${S} .oc-inline-edit-accept { background: var(--color--status--success); color: #fff; }
${S} .oc-inline-edit-reject { background: var(--color--surface--1); color: var(--color--text--on-surface-variant); }
${S} .oc-inline-edit-action-kbd { font-size: 10px; opacity: 0.7; font-family: var(--font-mono); }
${S} .oc-inline-edit-error {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px; font-size: 13px;
}
${S} .oc-inline-edit-error-text { flex: 1; color: var(--color--status--critical); }
${S} .oc-inline-edit-retry {
  padding: 4px 10px; border-radius: 6px; border: none;
  background: var(--color--surface--1); color: var(--color--text--on-surface);
  font-size: 12px; cursor: pointer; font-family: var(--font-sans);
}
${S} .oc-inline-edit-apikey { padding: 12px 14px; }
${S} .oc-inline-edit-apikey-label { font-size: 12px; color: var(--color--text--muted); margin-bottom: 8px; }
${S} .oc-inline-edit-send {
  padding: 6px 12px; border-radius: 6px; border: none;
  background: var(--color--surface--1); color: var(--color--text--on-surface);
  font-size: 12px; cursor: pointer; font-family: var(--font-sans);
}
${S} .oc-inline-edit-send:disabled { opacity: 0.4; cursor: default; }

/* ── Visual Diff ──────────────────────────────────────────── */
${S} .oc-vdiff-overlay {
  position: fixed; inset: 0; z-index: 105;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
}
${S} .oc-vdiff-modal {
  width: 90vw; max-width: 1100px; height: 80vh;
  border-radius: 12px; overflow: hidden;
  border: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--floor);
  box-shadow: var(--shadow-2xl);
  display: flex; flex-direction: column;
}
${S} .oc-vdiff-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--color--border--on-surface-0);
  flex-shrink: 0;
}
${S} .oc-vdiff-header-left { display: flex; align-items: center; gap: 10px; }
${S} .oc-vdiff-title { font-size: 15px; font-weight: 600; color: var(--color--text--on-surface); }
${S} .oc-vdiff-variant-name {
  font-size: 12px; color: var(--color--text--muted);
  padding: 2px 8px; border-radius: 4px; background: var(--color--surface--1);
}
${S} .oc-vdiff-close {
  padding: 4px; border-radius: 6px; border: none; background: none;
  color: var(--color--text--muted); cursor: pointer;
}
${S} .oc-vdiff-close:hover { background: var(--color--surface--1); color: var(--color--text--on-surface); }
${S} .oc-vdiff-body { flex: 1; position: relative; overflow: hidden; background: var(--color--surface--1); }
${S} .oc-vdiff-pane { position: absolute; inset: 0; }
${S} .oc-vdiff-label {
  position: absolute; top: 12px; z-index: 2;
  padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
}
${S} .oc-vdiff-label-before { left: 12px; background: var(--color--status--critical); color: #fff; }
${S} .oc-vdiff-label-after { right: 12px; background: var(--color--status--success); color: #fff; }
${S} .oc-vdiff-slider {
  position: absolute; top: 0; bottom: 0; width: 3px; z-index: 3;
  transform: translateX(-50%); cursor: ew-resize;
}
${S} .oc-vdiff-slider-line {
  position: absolute; inset: 0; background: #fff;
  box-shadow: 0 0 6px rgba(0,0,0,0.4);
}
${S} .oc-vdiff-slider-handle {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 28px; height: 28px; border-radius: 50%;
  background: #fff; color: #333;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

/* ── Variant Canvas ────────────────────────── */
${S} .oc-vc-root {
  width: 100%; height: 100%;
  background: var(--color--surface--1);
}
${S} .oc-vc-flow {
  background: var(--color--surface--1);
}
${S} .oc-vc-flow .react-flow__pane {
  background: var(--color--surface--1);
}
${S} .oc-vc-controls {
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-0);
  border-radius: 8px;
}

/* ══════════════════════════════════════════════════════════
   Themes Page
   ══════════════════════════════════════════════════════════ */

${S} .oc-themes-page {
  flex: 1; height: 100%; display: flex; flex-direction: column;
  background: var(--color--surface--0);
  overflow: hidden;
}

/* ── Empty state ─────────────────────────────────────────── */
${S} .oc-themes-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; padding: 32px;
}
${S} .oc-themes-empty-icon {
  color: var(--color--text--disabled);
  margin-bottom: 8px;
}
${S} .oc-themes-empty-title {
  font-size: 18px; font-weight: 600;
  color: var(--color--text--on-surface);
}
${S} .oc-themes-empty-desc {
  font-size: 13px; color: var(--color--text--muted);
  text-align: center; max-width: 320px;
}
${S} .oc-themes-empty-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 20px; border: none;
  background: var(--color--base--primary);
  color: var(--color--text--on-primary);
  border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: background 0.15s ease;
}
${S} .oc-themes-empty-btn:hover {
  background: var(--color--base--primary-hover);
}

/* ── File bar ────────────────────────────────────────────── */
${S} .oc-themes-file-bar {
  display: flex; align-items: center; justify-content: space-between;
  height: 40px; padding: 0 8px;
  border-bottom: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--floor);
  flex-shrink: 0;
}
${S} .oc-themes-file-tabs {
  display: flex; align-items: center; gap: 2px;
  overflow-x: auto;
}
${S} .oc-themes-file-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; border: none;
  background: transparent; color: var(--color--text--muted);
  font-size: 12px; border-radius: 6px;
  cursor: pointer; transition: all 0.15s ease;
  white-space: nowrap;
}
${S} .oc-themes-file-tab:hover {
  background: var(--color--surface--1);
  color: var(--color--text--on-surface);
}
${S} .oc-themes-file-tab.is-active {
  background: var(--color--surface--1);
  color: var(--color--text--on-surface);
}
${S} .oc-themes-file-tab-close {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border: none;
  background: transparent; color: var(--color--text--disabled);
  border-radius: 4px; cursor: pointer;
  opacity: 0; transition: opacity 0.1s ease;
}
${S} .oc-themes-file-tab:hover .oc-themes-file-tab-close { opacity: 1; }
${S} .oc-themes-file-tab-close:hover {
  background: var(--color--surface--2);
  color: var(--color--text--on-surface);
}
${S} .oc-themes-file-add {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none;
  background: transparent; color: var(--color--text--muted);
  border-radius: 6px; cursor: pointer;
}
${S} .oc-themes-file-add:hover {
  background: var(--color--surface--1);
  color: var(--color--text--on-surface);
}
${S} .oc-themes-file-actions {
  display: flex; align-items: center; gap: 2px;
}
${S} .oc-themes-action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none;
  background: transparent; color: var(--color--text--muted);
  border-radius: 6px; cursor: pointer;
}
${S} .oc-themes-action-btn:hover {
  background: var(--color--surface--1);
  color: var(--color--text--on-surface);
}

/* ── Paste bar ───────────────────────────────────────────── */
${S} .oc-themes-paste-bar {
  padding: 12px; border-bottom: 1px solid var(--color--border--on-surface-0);
  background: var(--color--surface--floor);
  flex-shrink: 0;
}
${S} .oc-themes-paste-input {
  width: 100%; padding: 8px 10px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 6px; color: var(--color--text--on-surface);
  font-family: 'Fira Code', monospace; font-size: 12px;
  resize: vertical; outline: none;
}
${S} .oc-themes-paste-input:focus {
  border-color: var(--color--base--primary);
}
${S} .oc-themes-paste-actions {
  display: flex; gap: 8px; justify-content: flex-end;
  margin-top: 8px;
}

/* ── Toolbar / Search ────────────────────────────────────── */
${S} .oc-themes-toolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color--border--on-surface-0);
  flex-shrink: 0;
}
${S} .oc-themes-search {
  display: flex; align-items: center; gap: 6px;
  flex: 1; max-width: 400px;
  padding: 6px 10px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 6px; color: var(--color--text--muted);
}
${S} .oc-themes-search input {
  flex: 1; border: none; background: transparent;
  color: var(--color--text--on-surface); font-size: 13px;
  outline: none;
}
${S} .oc-themes-search input::placeholder { color: var(--color--text--disabled); }
${S} .oc-themes-search-clear {
  display: flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border: none;
  background: var(--color--surface--2); color: var(--color--text--muted);
  border-radius: 4px; cursor: pointer;
}

/* ── Selection bar ───────────────────────────────────────── */
${S} .oc-themes-selection-bar {
  display: flex; align-items: center; gap: 4px;
}
${S} .oc-themes-sel-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 10px; border: none;
  background: var(--color--surface--1);
  color: var(--color--text--on-surface);
  font-size: 12px; border-radius: 6px;
  cursor: pointer; transition: all 0.15s ease;
}
${S} .oc-themes-sel-btn:hover {
  background: var(--color--surface--2);
}
${S} .oc-themes-sel-btn.is-danger {
  color: var(--color--text--critical);
}
${S} .oc-themes-sel-btn.is-danger:hover {
  background: rgba(239, 68, 68, 0.15);
}

/* ── Main area ───────────────────────────────────────────── */
${S} .oc-themes-main {
  flex: 1; display: flex; overflow: hidden;
}
${S} .oc-themes-scroll {
  flex: 1; height: 100%;
}

/* ── Table ───────────────────────────────────────────────── */
${S} .oc-themes-table {
  width: 100%; border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;
}
${S} .oc-themes-table thead {
  position: sticky; top: 0; z-index: 2;
  background: var(--color--surface--0);
}
${S} .oc-themes-table th {
  padding: 8px 12px; text-align: left;
  font-weight: 600; font-size: 12px;
  color: var(--color--text--on-surface);
  border-bottom: 1px solid var(--color--border--on-surface-0);
  border-right: 1px solid var(--color--border--on-surface-0);
  white-space: nowrap;
  vertical-align: middle;
}
${S} .oc-themes-table th:last-child {
  border-right: none;
}
${S} .oc-themes-table td {
  border-right: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-themes-table td:last-child {
  border-right: none;
}
${S} .oc-themes-th-check {
  width: 36px; text-align: center !important;
}
${S} .oc-themes-th-check input[type="checkbox"],
${S} .oc-themes-td-check input[type="checkbox"] {
  width: 14px; height: 14px;
  accent-color: var(--color--base--primary);
  cursor: pointer;
}
${S} .oc-themes-th-name {
  min-width: 200px;
}
${S} .oc-themes-th-name-inner {
  display: flex; align-items: center; gap: 4px;
}
${S} .oc-themes-th-theme {
  min-width: 200px;
}
${S} .oc-themes-th-theme-inner {
  display: flex; align-items: center; gap: 6px;
}
${S} .oc-themes-th-add {
  width: 40px; text-align: center !important;
  border-right: none !important;
}
${S} .oc-themes-default-badge {
  display: inline-block;
  font-size: 10px; font-weight: 600;
  padding: 1px 6px; border-radius: 4px;
  background: var(--color--surface--2);
  color: var(--color--text--on-surface);
}
${S} .oc-themes-th-menu {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none;
  background: transparent; color: var(--color--text--disabled);
  border-radius: 4px; cursor: pointer;
  opacity: 0; transition: opacity 0.1s;
  vertical-align: middle;
}
${S} .oc-themes-th-theme:hover .oc-themes-th-menu { opacity: 1; }

/* ── Header buttons ──────────────────────────────────────── */
${S} .oc-theme-header-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: none;
  background: transparent; color: var(--color--text--muted);
  border-radius: 4px; cursor: pointer;
}
${S} .oc-theme-header-btn:hover {
  background: var(--color--surface--1);
  color: var(--color--text--on-surface);
}

/* ── Group row ───────────────────────────────────────────── */
${S} .oc-themes-group-row td {
  padding: 6px 12px;
  background: var(--color--surface--floor);
  border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-themes-group-label {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--color--text--muted);
}
${S} .oc-themes-group-count {
  margin-left: 6px; font-size: 10px;
  color: var(--color--text--disabled);
}

/* ── Token row ───────────────────────────────────────────── */
${S} .oc-themes-token-row td {
  padding: 0 12px; height: 40px;
  border-bottom: 1px solid var(--color--border--on-surface-0);
  vertical-align: middle;
}
${S} .oc-themes-token-row:hover td {
  background: rgba(255, 255, 255, 0.02);
}
${S} .oc-themes-token-row.is-selected td {
  background: rgba(37, 99, 235, 0.08);
}
${S} .oc-themes-td-check { text-align: center; width: 36px; }
${S} .oc-themes-td-name {
  cursor: pointer;
}
${S} .oc-themes-token-name {
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  color: var(--color--text--on-surface);
}
${S} .oc-themes-td-value { position: relative; }

/* ── Value cell ──────────────────────────────────────────── */
${S} .oc-theme-value-cell {
  display: flex; align-items: center; gap: 8px;
  height: 100%;
}
${S} .oc-theme-color-swatch {
  width: 16px; height: 16px; flex-shrink: 0;
  border-radius: 3px;
  border: 1px solid var(--color--border--on-surface-1);
}
${S} .oc-theme-color-swatch.is-clickable {
  cursor: pointer;
}
${S} .oc-theme-color-swatch.is-clickable:hover {
  border-color: var(--color--base--primary);
}
${S} .oc-theme-value-text {
  font-size: 12px;
  color: var(--color--text--on-surface);
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; cursor: default;
}
${S} .oc-theme-value-empty {
  color: var(--color--text--disabled);
}
${S} .oc-theme-value-input {
  flex: 1; border: 1px solid var(--color--base--primary);
  background: var(--color--surface--1);
  color: var(--color--text--on-surface);
  padding: 2px 6px; border-radius: 4px;
  font-size: 12px; outline: none;
  font-family: 'Fira Code', monospace;
}

/* ── Color picker wrap ───────────────────────────────────── */
${S} .oc-theme-color-picker-wrap {
  position: absolute; top: 100%; left: 0; z-index: 100;
  margin-top: 4px;
}

/* ── Syntax badge ────────────────────────────────────────── */
${S} .oc-theme-syntax-badge {
  display: inline-flex; align-items: center;
  font-size: 10px; font-weight: 600;
  padding: 1px 5px; border-radius: 3px;
  background: var(--color--surface--2);
  color: var(--color--text--on-surface-variant);
}

/* ── Add variable dropdown ───────────────────────────────── */
${S} .oc-theme-add-var { position: relative; }
${S} .oc-theme-add-dropdown {
  position: absolute; top: 100%; left: 0; z-index: 50;
  min-width: 180px; padding: 4px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 8px;
  box-shadow: 0 8px 24px var(--color--shadow--overlay);
  margin-top: 4px;
}
${S} .oc-theme-add-dropdown-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px; border: none;
  background: transparent; color: var(--color--text--on-surface);
  font-size: 13px; border-radius: 6px;
  cursor: pointer; text-align: left;
}
${S} .oc-theme-add-dropdown-item:hover {
  background: var(--color--surface--2);
}

/* ── Group hint ──────────────────────────────────────────── */
${S} .oc-themes-group-hint {
  padding: 24px; text-align: center;
  font-size: 12px; color: var(--color--text--disabled);
  line-height: 1.6;
}

/* ══════════════════════════════════════════════════════════
   Color Picker
   ══════════════════════════════════════════════════════════ */

${S} .oc-color-picker {
  width: 240px; padding: 10px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 10px;
  box-shadow: 0 12px 32px var(--color--shadow--overlay);
}
${S} .oc-color-picker-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
${S} .oc-color-picker-name {
  font-size: 12px; font-weight: 600;
  color: var(--color--text--on-surface);
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap;
}
${S} .oc-color-picker-close {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none;
  background: transparent; color: var(--color--text--muted);
  font-size: 16px; cursor: pointer; border-radius: 4px;
}
${S} .oc-color-picker-close:hover {
  background: var(--color--surface--2);
}
${S} .oc-color-picker-hex-row {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 8px;
}
${S} .oc-color-picker-swatch {
  width: 24px; height: 24px; flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid var(--color--border--on-surface-1);
}
${S} .oc-color-picker-hex-input {
  flex: 1; padding: 4px 8px;
  background: var(--color--surface--0);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 4px; color: var(--color--text--on-surface);
  font-family: 'Fira Code', monospace; font-size: 12px;
  outline: none;
}
${S} .oc-color-picker-hex-input:focus {
  border-color: var(--color--base--primary);
}
${S} .oc-color-picker-area {
  position: relative; width: 100%; height: 140px;
  border-radius: 6px; cursor: crosshair;
  margin-bottom: 8px;
}
${S} .oc-color-picker-thumb {
  position: absolute; width: 14px; height: 14px;
  border: 2px solid white; border-radius: 50%;
  box-shadow: 0 0 3px rgba(0,0,0,0.5);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
${S} .oc-color-picker-hue {
  position: relative; width: 100%; height: 12px;
  border-radius: 6px; cursor: pointer;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  margin-bottom: 6px;
}
${S} .oc-color-picker-alpha {
  position: relative; width: 100%; height: 12px;
  border-radius: 6px; cursor: pointer;
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
  margin-bottom: 10px;
}
${S} .oc-color-picker-slider-thumb {
  position: absolute; top: 50%;
  width: 14px; height: 14px;
  border: 2px solid white; border-radius: 50%;
  box-shadow: 0 0 3px rgba(0,0,0,0.4);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
${S} .oc-color-picker-values {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 6px;
}
${S} .oc-color-picker-value-group {
  display: flex; flex-direction: column; gap: 2px;
}
${S} .oc-color-picker-value-group label {
  font-size: 10px; color: var(--color--text--muted);
}
${S} .oc-color-picker-value-group input {
  width: 100%; padding: 3px 6px;
  background: var(--color--surface--0);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 4px; color: var(--color--text--on-surface);
  font-size: 12px; outline: none;
}
${S} .oc-color-picker-value-group input:focus {
  border-color: var(--color--base--primary);
}

/* ══════════════════════════════════════════════════════════
   Variable Detail Panel
   ══════════════════════════════════════════════════════════ */

${S} .oc-themes-detail-slot {
  width: 280px; flex-shrink: 0;
  border-left: 1px solid var(--color--border--on-surface-0);
  overflow-y: auto;
}
${S} .oc-theme-detail-panel {
  display: flex; flex-direction: column;
  height: 100%;
}
${S} .oc-theme-detail-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-theme-detail-title {
  flex: 1; font-size: 13px; font-weight: 600;
  color: var(--color--text--on-surface);
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap;
}
${S} .oc-theme-detail-close {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: none;
  background: transparent; color: var(--color--text--muted);
  border-radius: 4px; cursor: pointer;
}
${S} .oc-theme-detail-close:hover {
  background: var(--color--surface--2);
}
${S} .oc-theme-detail-body {
  flex: 1; padding: 14px; display: flex;
  flex-direction: column; gap: 14px;
}
${S} .oc-theme-detail-field {
  display: flex; flex-direction: column; gap: 4px;
}
${S} .oc-theme-detail-field.is-row {
  flex-direction: row; align-items: center;
  justify-content: space-between;
}
${S} .oc-theme-detail-field label {
  font-size: 12px; font-weight: 600;
  color: var(--color--text--muted);
}
${S} .oc-theme-detail-field input {
  padding: 6px 10px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 6px; color: var(--color--text--on-surface);
  font-size: 13px; outline: none;
}
${S} .oc-theme-detail-field input:focus {
  border-color: var(--color--base--primary);
}
${S} .oc-theme-detail-select {
  position: relative; display: flex;
  align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 6px; color: var(--color--text--on-surface);
  font-size: 13px; cursor: pointer;
}
${S} .oc-theme-detail-dropdown {
  position: absolute; top: 100%; left: 0; right: 0;
  z-index: 50; margin-top: 4px; padding: 4px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 8px;
  box-shadow: 0 8px 24px var(--color--shadow--overlay);
}
${S} .oc-theme-detail-dropdown-item {
  display: block; width: 100%;
  padding: 6px 10px; border: none;
  background: transparent; color: var(--color--text--on-surface);
  font-size: 13px; border-radius: 6px;
  cursor: pointer; text-align: left;
}
${S} .oc-theme-detail-dropdown-item:hover {
  background: var(--color--surface--2);
}
${S} .oc-theme-detail-dropdown-item.is-active {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color--text--primary-light);
}
${S} .oc-theme-detail-divider {
  font-size: 12px; font-weight: 700;
  color: var(--color--text--on-surface);
  padding: 6px 0; border-top: 1px solid var(--color--border--on-surface-0);
  margin-top: 2px;
}
${S} .oc-theme-detail-initial {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 6px; font-size: 13px;
  color: var(--color--text--on-surface);
}
${S} .oc-theme-detail-checkbox {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--color--border--on-surface-1);
  border-radius: 4px; background: transparent;
  color: white; cursor: pointer;
  transition: all 0.15s ease;
}
${S} .oc-theme-detail-checkbox.is-checked {
  background: var(--color--base--primary);
  border-color: var(--color--base--primary);
}
${S} .oc-theme-detail-footer {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 8px; padding: 12px 14px;
  border-top: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-theme-detail-action {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border: none;
  background: transparent; color: var(--color--text--muted);
  border-radius: 6px; cursor: pointer;
}
${S} .oc-theme-detail-action:hover {
  background: var(--color--surface--2);
}
${S} .oc-theme-detail-action.is-danger:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color--text--critical);
}

/* ══════════════════════════════════════════════════════════
   Rename Dialog
   ══════════════════════════════════════════════════════════ */

${S} .oc-theme-dialog-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center;
}
${S} .oc-theme-dialog {
  width: 420px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 12px;
  box-shadow: 0 20px 60px var(--color--shadow--overlay);
}
${S} .oc-theme-dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  font-size: 15px; font-weight: 600;
  color: var(--color--text--on-surface);
  border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-theme-dialog-header button {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: none;
  background: transparent; color: var(--color--text--muted);
  border-radius: 4px; cursor: pointer;
}
${S} .oc-theme-dialog-body {
  padding: 20px; display: flex;
  flex-direction: column; gap: 16px;
}
${S} .oc-theme-dialog-field {
  display: flex; flex-direction: column; gap: 4px;
}
${S} .oc-theme-dialog-field label {
  font-size: 13px; font-weight: 600;
  color: var(--color--text--muted);
}
${S} .oc-theme-dialog-field input {
  padding: 8px 12px;
  background: var(--color--surface--0);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 8px; color: var(--color--text--on-surface);
  font-size: 13px; outline: none;
}
${S} .oc-theme-dialog-field input:focus {
  border-color: var(--color--base--primary);
}
${S} .oc-theme-dialog-preview {
  font-size: 13px; color: var(--color--text--muted);
  padding: 10px 14px;
  background: var(--color--surface--0);
  border-radius: 8px;
}
${S} .oc-theme-dialog-preview code {
  color: var(--color--text--on-surface);
  font-family: 'Fira Code', monospace;
}
${S} .oc-theme-dialog-actions {
  display: flex; gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-theme-dialog-btn {
  flex: 1; padding: 10px 16px;
  border: none; border-radius: 8px;
  font-size: 13px; font-weight: 600;
  cursor: pointer; transition: background 0.15s ease;
}
${S} .oc-theme-dialog-btn.is-secondary {
  background: var(--color--surface--2);
  color: var(--color--text--on-surface);
}
${S} .oc-theme-dialog-btn.is-secondary:hover {
  background: var(--color--border--on-surface-2);
}
${S} .oc-theme-dialog-btn.is-primary {
  background: var(--color--base--primary);
  color: var(--color--text--on-primary);
}
${S} .oc-theme-dialog-btn.is-primary:hover {
  background: var(--color--base--primary-hover);
}

/* ══════════════════════════════════════════════════════════
   Theme Mode Panel (right sidebar)
   ══════════════════════════════════════════════════════════ */

${S} .oc-theme-mode-panel {
  height: 100%; display: flex; flex-direction: column;
  background: var(--color--surface--0);
  overflow: hidden; min-width: 0;
}
${S} .oc-theme-mode-header-info {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600;
  color: var(--color--text--on-surface);
}
${S} .oc-theme-mode-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9px; font-size: 10px; font-weight: 700;
  background: var(--color--base--primary); color: var(--color--text--on-primary);
}
${S} .oc-theme-mode-body {
  flex: 1; height: 0;
}
${S} .oc-theme-mode-section {
  padding: 10px 12px; min-width: 0; overflow: hidden;
}
${S} .oc-theme-mode-section + .oc-theme-mode-section {
  border-top: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-theme-mode-section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
${S} .oc-theme-mode-section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--color--text--muted);
  margin-bottom: 8px;
}
${S} .oc-theme-mode-section-header .oc-theme-mode-section-title {
  margin-bottom: 0;
}
${S} .oc-theme-mode-clear-btn {
  font-size: 10px; border: none; background: transparent;
  color: var(--color--text--critical); cursor: pointer;
  padding: 2px 6px; border-radius: 4px;
}
${S} .oc-theme-mode-clear-btn:hover {
  background: rgba(239, 68, 68, 0.12);
}

/* ── Search ── */
${S} .oc-theme-mode-search {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 8px; margin-bottom: 8px;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 6px; color: var(--color--text--muted);
}
${S} .oc-theme-mode-search input {
  flex: 1; border: none; background: transparent;
  color: var(--color--text--on-surface); font-size: 11px; outline: none;
}
${S} .oc-theme-mode-search input::placeholder { color: var(--color--text--disabled); }
${S} .oc-theme-mode-search-clear {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border: none;
  background: var(--color--surface--2); color: var(--color--text--muted);
  border-radius: 3px; cursor: pointer;
}

/* ── Token list ── */
${S} .oc-theme-mode-token-list {
  max-height: 280px; overflow-y: auto;
}
${S} .oc-theme-mode-group-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--color--text--disabled);
  padding: 4px 0 2px;
}
${S} .oc-theme-mode-token-row {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 4px; border-radius: 4px;
  cursor: default; transition: background 0.1s;
}
${S} .oc-theme-mode-token-row:hover {
  background: var(--color--surface--1);
}
${S} .oc-theme-mode-token-swatch {
  width: 14px; height: 14px; flex-shrink: 0;
  border-radius: 3px; border: 1px solid var(--color--border--on-surface-1);
}
${S} .oc-theme-mode-token-swatch.is-small {
  width: 10px; height: 10px; border-radius: 2px;
}
${S} .oc-theme-mode-token-name {
  font-family: 'Fira Code', monospace;
  font-size: 10px; color: var(--color--text--on-surface);
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-theme-mode-token-value {
  font-size: 10px; color: var(--color--text--disabled);
  font-family: 'Fira Code', monospace; flex-shrink: 0;
}

/* ── Empty state ── */
${S} .oc-theme-mode-empty {
  padding: 16px 0; text-align: center;
}
${S} .oc-theme-mode-empty-text {
  font-size: 11px; color: var(--color--text--muted);
  line-height: 1.5; padding: 8px 0;
}
${S} .oc-theme-mode-empty-text.is-small {
  font-size: 10px; color: var(--color--text--disabled);
  padding: 4px 0;
}
${S} .oc-theme-mode-empty-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 14px; border: none; margin-top: 8px;
  background: var(--color--surface--1); color: var(--color--text--on-surface);
  border-radius: 6px; font-size: 11px; cursor: pointer;
}
${S} .oc-theme-mode-empty-btn:hover {
  background: var(--color--surface--2);
}

/* ── Change list ── */
${S} .oc-theme-mode-change-list {
  display: flex; flex-direction: column; gap: 2px;
}
${S} .oc-theme-mode-change-row {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 6px 4px; border-radius: 6px;
  transition: background 0.1s;
}
${S} .oc-theme-mode-change-row:hover {
  background: var(--color--surface--1);
}
${S} .oc-theme-mode-change-num {
  display: flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; flex-shrink: 0;
  border-radius: 50%; font-size: 10px; font-weight: 700;
  background: var(--color--base--primary); color: var(--color--text--on-primary);
}
${S} .oc-theme-mode-change-info {
  flex: 1; min-width: 0; overflow: hidden;
}
${S} .oc-theme-mode-change-selector {
  font-size: 11px; font-weight: 600;
  color: var(--color--text--on-surface);
  font-family: 'Fira Code', monospace;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-theme-mode-change-detail {
  display: flex; align-items: center; gap: 4px;
  margin-top: 2px; min-width: 0; overflow: hidden;
}
${S} .oc-theme-mode-change-prop {
  font-size: 10px; color: var(--color--text--muted);
  font-family: 'Fira Code', monospace;
}
${S} .oc-theme-mode-change-token {
  font-size: 10px; color: var(--color--text--primary-light);
  font-family: 'Fira Code', monospace;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-theme-mode-change-remove {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; flex-shrink: 0;
  border: none; background: transparent;
  color: var(--color--text--disabled); border-radius: 4px;
  cursor: pointer; opacity: 0; transition: opacity 0.1s;
}
${S} .oc-theme-mode-change-row:hover .oc-theme-mode-change-remove { opacity: 1; }
${S} .oc-theme-mode-change-remove:hover {
  background: rgba(239, 68, 68, 0.12);
  color: var(--color--text--critical);
}

/* ── Footer ── */
${S} .oc-theme-mode-footer {
  padding: 10px 12px;
  border-top: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-theme-mode-send-btn {
  display: flex; align-items: center; justify-content: center;
  gap: 6px; width: 100%; padding: 8px 12px;
  border: none; border-radius: 8px;
  background: var(--color--base--primary); color: var(--color--text--on-primary);
  font-size: 12px; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
}
${S} .oc-theme-mode-send-btn:hover {
  background: var(--color--base--primary-hover);
}

/* ═══════════════════════════════════════════════════════════
   Phase 1 Editors — Color, Spacing, Typography
   ═══════════════════════════════════════════════════════════ */

${S} .oc-style-header-actions {
  display: flex; align-items: center; gap: 4px;
}
/* ── Style Panel Search ── */
${S} .oc-style-search {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-style-search-icon { color: var(--color--text--muted); flex-shrink: 0; }
${S} .oc-style-search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--color--text--on-surface); font-size: 11px;
  font-family: var(--font-mono); padding: 2px 0;
}
${S} .oc-style-search-input::placeholder { color: var(--color--text--muted); }

/* ── Tailwind Editor ── */
${S} .oc-tw-editor { padding: 4px 0; }
${S} .oc-tw-group { margin-bottom: 6px; }
${S} .oc-tw-group-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.4px; display: block; margin-bottom: 3px;
}
${S} .oc-tw-chips { display: flex; flex-wrap: wrap; gap: 3px; }
${S} .oc-tw-chip {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 1px 5px; border-radius: 3px; font-size: 10px;
  font-family: var(--font-mono); background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  color: var(--color--text--on-surface);
}
${S} .oc-tw-chip-custom { opacity: 0.6; }
${S} .oc-tw-chip-text { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${S} .oc-tw-chip-remove {
  display: flex; align-items: center; justify-content: center;
  width: 12px; height: 12px; border: none; background: transparent;
  color: var(--color--text--muted); cursor: pointer; border-radius: 2px;
  padding: 0;
}
${S} .oc-tw-chip-remove:hover { background: rgba(239,68,68,0.2); color: #ef4444; }

${S} .oc-tw-add-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 8px; margin-top: 4px; border: 1px dashed var(--color--border--on-surface-1);
  border-radius: 4px; background: transparent;
  color: var(--color--text--muted); font-size: 10px;
  cursor: pointer; transition: all 0.12s;
}
${S} .oc-tw-add-btn:hover { border-color: var(--color--base--primary); color: var(--color--base--primary); }

${S} .oc-tw-add-area { margin-top: 4px; }
${S} .oc-tw-search-row {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 6px; border: 1px solid var(--color--border--on-surface-1);
  border-radius: 4px; background: var(--color--surface--1);
}
${S} .oc-tw-search-icon { color: var(--color--text--muted); flex-shrink: 0; }
${S} .oc-tw-search-input {
  flex: 1; border: none; outline: none; background: transparent;
  color: var(--color--text--on-surface); font-size: 10px;
  font-family: var(--font-mono);
}
${S} .oc-tw-search-input::placeholder { color: var(--color--text--muted); }
${S} .oc-tw-suggestions {
  border: 1px solid var(--color--border--on-surface-1); border-top: none;
  border-radius: 0 0 4px 4px; background: var(--color--surface--1);
  max-height: 160px; overflow-y: auto;
}
${S} .oc-tw-suggestion {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 4px 8px; border: none; background: transparent;
  color: var(--color--text--on-surface); font-size: 10px;
  font-family: var(--font-mono); cursor: pointer; text-align: left;
}
${S} .oc-tw-suggestion:hover { background: rgba(255,255,255,0.04); }
${S} .oc-tw-suggestion-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
${S} .oc-tw-suggestion-prop {
  margin-left: auto; font-size: 10px; color: var(--color--text--muted);
}

${S} .oc-breakpoint-badge {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  padding: 1px 6px; border-radius: 3px; letter-spacing: 0.3px;
  background: rgba(234,179,8,0.15); color: #eab308;
}
${S} .oc-style-swatch-clickable { cursor: pointer; }
${S} .oc-style-swatch-clickable:hover { box-shadow: 0 0 0 2px var(--color--outline--focus); }

/* ── Color Editor ── */
${S} .oc-color-editor {
  border-bottom: 1px solid var(--color--border--on-surface-0);
  padding: 8px 12px;
}
${S} .oc-color-editor-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
${S} .oc-color-editor-label {
  font-size: 11px; font-family: var(--font-mono);
  color: var(--color--text--on-surface-variant);
}
${S} .oc-color-editor-status {
  display: flex; align-items: center; gap: 6px;
}
${S} .oc-color-editor-badge {
  font-size: 10px; padding: 1px 6px; border-radius: 3px;
}
${S} .oc-badge-writing { color: var(--color--text--on-surface-variant); }
${S} .oc-badge-error { color: #ef4444; }
${S} .oc-color-editor-icon { flex-shrink: 0; }
${S} .oc-icon-success { color: #22c55e; }

/* ── Spacing Editor (box model) ── */
${S} .oc-spacing-editor {
  padding: 8px 0;
}
${S} .oc-spacing-box {
  text-align: center; font-family: var(--font-mono); font-size: 11px;
  position: relative;
}
${S} .oc-spacing-margin-box {
  background: rgba(255,152,0,0.08); border: 1px solid rgba(255,152,0,0.2);
  border-radius: 8px; padding: 6px;
}
${S} .oc-spacing-padding-box {
  background: rgba(76,175,80,0.08); border: 1px solid rgba(76,175,80,0.2);
  border-radius: 6px; padding: 6px;
}
${S} .oc-spacing-content {
  background: rgba(33,150,243,0.08); border: 1px solid rgba(33,150,243,0.2);
  border-radius: 4px; padding: 8px 4px;
  min-width: 60px;
}
${S} .oc-spacing-content-label { font-size: 10px; color: #2196f3; }
${S} .oc-spacing-box-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
  position: absolute; top: 2px; left: 6px; opacity: 0.6;
}
${S} .oc-spacing-cell {
  display: flex; align-items: center; justify-content: center;
  min-height: 20px;
}
${S} .oc-spacing-top, ${S} .oc-spacing-bottom {
  padding: 2px 0;
}
${S} .oc-spacing-left, ${S} .oc-spacing-right {
  padding: 0 4px; min-width: 28px;
}
${S} .oc-spacing-middle {
  display: flex; align-items: stretch; justify-content: center;
}
${S} .oc-spacing-value {
  cursor: pointer; padding: 1px 4px; border-radius: 3px;
  transition: background 0.15s;
}
${S} .oc-spacing-value:hover { background: rgba(255,255,255,0.08); }
${S} .oc-spacing-margin { color: #ff9800; }
${S} .oc-spacing-padding { color: #4caf50; }
${S} .oc-spacing-input {
  width: 36px; text-align: center; padding: 1px 2px;
  background: var(--color--surface--0); border: 1px solid var(--color--outline--focus);
  border-radius: 3px; color: var(--color--text--on-surface);
  font-size: 11px; font-family: var(--font-mono); outline: none;
}

/* ── Typography Editor ── */
${S} .oc-typo-editor {
  padding: 4px 0;
  display: flex; flex-direction: column; gap: 6px;
}
${S} .oc-typo-row {
  display: flex; gap: 8px;
}
${S} .oc-typo-row > * { flex: 1; }
${S} .oc-typo-field {
  display: flex; flex-direction: column; gap: 3px;
}
${S} .oc-typo-field-label {
  font-size: 10px; color: var(--color--text--muted);
  text-transform: uppercase; letter-spacing: 0.5px;
}
${S} .oc-typo-select {
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  border-radius: 4px; padding: 4px 6px; color: var(--color--text--on-surface);
  font-size: 11px; font-family: var(--font-mono); outline: none;
  cursor: pointer; width: 100%;
}
${S} .oc-typo-select:focus { border-color: var(--color--outline--focus); }
${S} .oc-typo-input {
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  border-radius: 4px; padding: 4px 6px; color: var(--color--text--on-surface);
  font-size: 11px; font-family: var(--font-mono); outline: none;
  width: 100%;
}
${S} .oc-typo-input:focus { border-color: var(--color--outline--focus); }
${S} .oc-typo-value {
  cursor: pointer; padding: 4px 6px; border-radius: 4px;
  font-size: 11px; font-family: var(--font-mono);
  color: var(--color--text--on-surface);
  background: var(--color--surface--1); border: 1px solid transparent;
  transition: border-color 0.15s;
}
${S} .oc-typo-value:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-typo-align-group {
  display: flex; gap: 2px;
}
${S} .oc-typo-align-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: 1px solid var(--color--border--on-surface-1);
  border-radius: 4px; background: var(--color--surface--1);
  color: var(--color--text--on-surface-variant); cursor: pointer;
  transition: all 0.15s;
}
${S} .oc-typo-align-btn:hover {
  background: var(--color--surface--2);
  color: var(--color--text--on-surface);
}
${S} .oc-typo-align-btn.is-active {
  background: var(--color--base--primary);
  color: var(--color--text--on-primary);
  border-color: var(--color--base--primary);
}
${S} .oc-typo-color-row {
  display: flex; align-items: center; gap: 6px;
}

/* ── Feedback Panel ── */
${S} .oc-feedback-item {
  padding: 8px 0; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-feedback-item-header {
  display: flex; gap: 4px; margin-bottom: 4px;
}
${S} .oc-feedback-badge {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  padding: 1px 6px; border-radius: 3px; letter-spacing: 0.3px;
  background: var(--color--surface--2); color: var(--color--text--on-surface-variant);
}
${S} .oc-feedback-badge[data-intent="fix"] { background: rgba(239,68,68,0.15); color: #ef4444; }
${S} .oc-feedback-badge[data-intent="change"] { background: rgba(234,179,8,0.15); color: #eab308; }
${S} .oc-feedback-badge[data-intent="question"] { background: rgba(59,130,246,0.15); color: #3b82f6; }
${S} .oc-feedback-badge[data-intent="approve"] { background: rgba(34,197,94,0.15); color: #22c55e; }
${S} .oc-feedback-badge[data-severity="blocking"] { background: rgba(239,68,68,0.15); color: #ef4444; }
${S} .oc-feedback-badge[data-severity="important"] { background: rgba(234,179,8,0.15); color: #eab308; }
${S} .oc-feedback-badge[data-severity="suggestion"] { background: rgba(59,130,246,0.15); color: #3b82f6; }
${S} .oc-feedback-selector {
  font-size: 10px; font-family: var(--font-mono);
  color: var(--color--text--muted);
}
${S} .oc-feedback-comment {
  font-size: 12px; color: var(--color--text--on-surface);
  margin-top: 4px; line-height: 1.4;
}

/* ═══════════════════════════════════════════════════════════
   Phase 2 — Shared Controls + Layout/Border Editors
   ═══════════════════════════════════════════════════════════ */

/* ── Shared: Editor row ── */
${S} .oc-editor-row {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 0; min-width: 0;
}
${S} .oc-editor-label {
  font-size: 10px; color: var(--color--text--muted);
  min-width: 50px; flex-shrink: 0;
}
${S} .oc-editor-inline { display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0; }
${S} .oc-editor-value {
  font-size: 10px; font-family: var(--font-mono);
  color: var(--color--text--on-surface-variant);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Segmented Control ── */
${S} .oc-segmented {
  display: inline-flex; border-radius: 5px; overflow: hidden;
  border: 1px solid var(--color--border--on-surface-1);
  background: var(--color--surface--1);
}
${S} .oc-segmented-sm .oc-segmented-btn {
  padding: 3px 6px; font-size: 10px; min-width: 0;
}
${S} .oc-segmented-md .oc-segmented-btn {
  padding: 4px 8px; font-size: 10px;
}
${S} .oc-segmented-btn {
  border: none; background: transparent;
  color: var(--color--text--on-surface-variant);
  cursor: pointer; transition: all 0.12s;
  display: flex; align-items: center; justify-content: center;
  white-space: nowrap; font-weight: 500;
}
${S} .oc-segmented-btn:hover {
  color: var(--color--text--on-surface);
  background: rgba(255,255,255,0.04);
}
${S} .oc-segmented-btn.is-active {
  background: var(--color--base--primary);
  color: var(--color--text--on-primary);
}

/* ── NumberInputWithUnit ── */
${S} .oc-num-field { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
${S} .oc-num-label {
  font-size: 10px; color: var(--color--text--muted);
  text-transform: uppercase; letter-spacing: 0.4px;
}
${S} .oc-num-row { display: flex; align-items: center; gap: 2px; }
${S} .oc-num-input {
  flex: 1; min-width: 0; width: 100%;
  background: var(--color--surface--0); border: 1px solid var(--color--outline--focus);
  border-radius: 3px; padding: 2px 4px;
  color: var(--color--text--on-surface);
  font-size: 10px; font-family: var(--font-mono); outline: none;
  text-align: center;
}
${S} .oc-num-value {
  flex: 1; text-align: center; cursor: pointer;
  padding: 2px 4px; border-radius: 3px;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--color--text--on-surface);
  background: var(--color--surface--1);
  border: 1px solid transparent; transition: border-color 0.12s;
}
${S} .oc-num-value:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-num-unit {
  background: var(--color--surface--1); border: 1px solid var(--color--border--on-surface-1);
  border-radius: 3px; padding: 2px 2px;
  color: var(--color--text--muted); font-size: 10px; outline: none;
  cursor: pointer;
}
${S} .oc-num-unit-label {
  font-size: 10px; color: var(--color--text--muted); padding: 0 2px;
}

/* ── SliderInput ── */
${S} .oc-slider-field { display: flex; flex-direction: column; gap: 2px; }
${S} .oc-slider-label {
  font-size: 10px; color: var(--color--text--muted);
  text-transform: uppercase; letter-spacing: 0.4px;
}
${S} .oc-slider-row { display: flex; align-items: center; gap: 6px; }
${S} .oc-slider-track {
  flex: 1; height: 4px; -webkit-appearance: none; appearance: none;
  border-radius: 2px; outline: none; cursor: pointer;
}
${S} .oc-slider-track::-webkit-slider-thumb {
  -webkit-appearance: none; width: 12px; height: 12px;
  border-radius: 50%; background: var(--color--text--on-surface);
  border: 2px solid var(--color--surface--0); cursor: grab;
}
${S} .oc-slider-value {
  font-size: 10px; font-family: var(--font-mono);
  color: var(--color--text--on-surface-variant);
  min-width: 32px; text-align: right;
}

/* ── Toggle button (small) ── */
${S} .oc-toggle-btn-sm {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: 1px solid var(--color--border--on-surface-1);
  border-radius: 4px; background: var(--color--surface--1);
  color: var(--color--text--on-surface-variant); cursor: pointer;
  transition: all 0.12s;
}
${S} .oc-toggle-btn-sm:hover { background: var(--color--surface--2); }
${S} .oc-toggle-btn-sm.is-active {
  background: var(--color--base--primary);
  color: var(--color--text--on-primary);
  border-color: var(--color--base--primary);
}

/* ── 9-dot Alignment Grid ── */
${S} .oc-align-grid {
  display: flex; flex-direction: column; gap: 3px;
  padding: 6px; border: 1px solid var(--color--border--on-surface-1);
  border-radius: 6px; background: var(--color--surface--1);
  width: fit-content;
}
${S} .oc-align-grid-row { display: flex; gap: 3px; }
${S} .oc-align-dot {
  width: 16px; height: 16px; border-radius: 3px;
  border: 1.5px solid var(--color--border--on-surface-1);
  background: transparent; cursor: pointer;
  transition: all 0.12s; position: relative;
}
${S} .oc-align-dot::after {
  content: ""; position: absolute; inset: 3px;
  border-radius: 1px; background: var(--color--text--muted);
  opacity: 0.3;
}
${S} .oc-align-dot:hover { border-color: var(--color--text--on-surface-variant); }
${S} .oc-align-dot:hover::after { opacity: 0.6; }
${S} .oc-align-dot.is-active {
  border-color: var(--color--base--primary);
  background: rgba(37,99,235,0.1);
}
${S} .oc-align-dot.is-active::after {
  background: var(--color--base--primary); opacity: 1;
}

/* ── Layout Editor ── */
${S} .oc-layout-editor { padding: 4px 0; display: flex; flex-direction: column; gap: 4px; }

/* ── Border Editor ── */
${S} .oc-border-editor { padding: 4px 0; display: flex; flex-direction: column; gap: 4px; }

/* ── Radius diagram ── */
${S} .oc-radius-diagram {
  display: flex; flex-direction: column; gap: 2px;
  padding: 4px 0;
}
${S} .oc-radius-row { display: flex; justify-content: space-between; align-items: center; }
${S} .oc-radius-spacer { flex: 1; }
${S} .oc-radius-preview {
  width: 100%; height: 40px; margin: 2px 0;
  border: 1.5px solid var(--color--border--on-surface-1);
  background: var(--color--surface--1);
  display: flex; align-items: center; justify-content: center;
}
${S} .oc-radius-preview-label {
  font-size: 10px; font-family: var(--font-mono);
  color: var(--color--text--muted);
}
${S} .oc-radius-value {
  cursor: pointer; padding: 2px 6px; border-radius: 3px;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--color--text--on-surface);
  background: var(--color--surface--1);
  border: 1px solid transparent; transition: border-color 0.12s;
}
${S} .oc-radius-value:hover { border-color: var(--color--border--on-surface-1); }
${S} .oc-radius-input {
  width: 36px; text-align: center; padding: 2px;
  background: var(--color--surface--0); border: 1px solid var(--color--outline--focus);
  border-radius: 3px; color: var(--color--text--on-surface);
  font-size: 10px; font-family: var(--font-mono); outline: none;
}

/* ── Shadow grid ── */
${S} .oc-shadow-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
  padding: 4px 0;
}

/* ═══════════════════════════════════════════════════════════
   AI Chat Panel
   ═══════════════════════════════════════════════════════════ */

${S} .oc-ai-header {
  display: flex; align-items: center; gap: 8px; flex: 1;
}
${S} .oc-ai-header-actions { display: flex; align-items: center; gap: 4px; }
${S} .oc-ai-icon {
  color: var(--color--base--primary);
  flex-shrink: 0;
}

${S} .oc-ai-context {
  padding: 4px 16px 12px;
}
${S} .oc-ai-context-badge {
  font-size: 11px;
  color: var(--color--text--on-surface-variant);
  background: rgba(255,255,255,0.04);
  padding: 4px 10px;
  border-radius: 999px;
  border: none;
  display: inline-block; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 500;
}
${S} .oc-ai-context-variant {
  background: rgba(139,92,246,0.12);
  color: var(--purple-300);
}
${S} .oc-ai-context-none {
  color: var(--color--text--muted);
  font-weight: 400;
}

${S} .oc-ai-messages {
  display: flex; flex-direction: column; gap: 14px;
  padding: 16px; min-height: 100px;
}

${S} .oc-ai-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
  color: var(--color--text--muted);
  font-size: 13px;
}
${S} .oc-ai-empty-icon {
  color: var(--color--text--disabled);
  margin-bottom: 12px;
  opacity: 0.6;
}
${S} .oc-ai-empty-hint {
  font-size: 11px;
  color: var(--color--text--muted);
  margin-top: 8px;
  line-height: 1.55;
  max-width: 280px;
}
${S} .oc-ai-empty-hint code {
  font-family: var(--font-firacode); font-size: 10px;
  background: var(--color--surface--1); padding: 1px 6px;
  border-radius: 4px;
  color: var(--color--text--on-surface);
}

${S} .oc-ai-msg {
  display: flex; gap: 10px; align-items: flex-start;
}
${S} .oc-ai-msg-icon {
  width: 22px; height: 22px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 11px; font-weight: 600;
}
${S} .oc-ai-msg-user .oc-ai-msg-icon {
  background: rgba(255,255,255,0.06); color: var(--color--text--on-surface);
}
${S} .oc-ai-msg-assistant .oc-ai-msg-icon {
  background: rgba(37,99,235,0.14); color: var(--color--text--primary-light);
}
${S} .oc-ai-msg-content {
  font-size: 13px; line-height: 1.55;
  color: var(--color--text--on-surface);
  flex: 1; min-width: 0;
  padding-top: 2px;
}
${S} .oc-ai-msg-user .oc-ai-msg-content { font-weight: 500; }

${S} .oc-ai-pending {
  display: flex; align-items: center; gap: 6px;
  color: var(--color--text--muted); font-style: italic;
}
${S} .oc-ai-spinner { animation: oc-spin 1s linear infinite; }
@keyframes oc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

${S} .oc-ai-input-row {
  display: flex; gap: 6px; padding: 10px 12px 12px;
  align-items: flex-end;
}
${S} .oc-ai-input {
  flex: 1;
  background: var(--color--surface--1);
  border: 1px solid transparent;
  border-radius: 10px; padding: 10px 14px;
  color: var(--color--text--on-surface); font-size: 13px;
  outline: none; min-width: 0;
  transition: border-color 120ms ease, background 120ms ease;
  font-family: inherit;
}
${S} .oc-ai-input:focus {
  border-color: var(--color--outline--focus);
  background: var(--color--surface--0);
}
${S} .oc-ai-input::placeholder { color: var(--color--text--muted); }
${S} .oc-ai-input:disabled { opacity: 0.5; }

${S} .oc-ai-send-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border: none; border-radius: 10px;
  background: var(--color--base--primary);
  color: white;
  cursor: pointer; transition: background 120ms ease;
  flex-shrink: 0;
}
${S} .oc-ai-send-btn:hover:not(:disabled) { background: var(--color--base--primary-hover); }
${S} .oc-ai-send-btn:disabled {
  background: rgba(255,255,255,0.06);
  color: var(--color--text--disabled);
  cursor: default;
}
${S} .oc-ai-stop-btn { background: var(--red-500); }
${S} .oc-ai-stop-btn:hover:not(:disabled) { background: var(--red-600); }

/* ═══════════════════════════════════════════════════════════
   AI Chat Panel — Clonk-inspired layout (Phase 2 aesthetic)
   ═══════════════════════════════════════════════════════════ */

${S} .oc-chat { background: #141414; }

/* ── Header: title + open + menu ───────────────────────── */
${S} .oc-chat-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px 10px;
}
${S} .oc-chat-title {
  flex: 1; font-size: 15px; font-weight: 600;
  color: var(--color--text--on-surface);
  letter-spacing: -0.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-chat-header-actions {
  display: flex; align-items: center; gap: 2px;
}
${S} .oc-chat-headerbtn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 8px 4px 10px;
  background: rgba(255,255,255,0.04);
  border: none; border-radius: 999px;
  color: var(--color--text--on-surface);
  font-family: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease;
}
${S} .oc-chat-headerbtn:hover { background: rgba(255,255,255,0.07); }
${S} .oc-chat-headerbtn-caret { color: var(--color--text--muted); }
${S} .oc-chat-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 26px;
  background: transparent; border: none; border-radius: 7px;
  color: var(--color--text--muted);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-chat-iconbtn:hover {
  background: rgba(255,255,255,0.05);
  color: var(--color--text--on-surface);
}

/* ── Body + empty state ────────────────────────────────── */
${S} .oc-chat-body { padding: 0; }
${S} .oc-chat-empty {
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  padding: 64px 24px;
}
${S} .oc-chat-empty-title {
  margin: 0; font-size: 15px; font-weight: 500;
  color: var(--color--text--muted);
  letter-spacing: -0.005em;
}

/* ── Composer (input card with toolbar below) ─────────── */
${S} .oc-chat-composer {
  padding: 8px 12px 6px;
  position: relative;
}

/* ── Slash-command palette (Phase 4) ───────────────────── */
${S} .oc-slash-menu {
  position: absolute;
  left: 12px; right: 12px; bottom: calc(100% + 4px);
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  padding: 6px;
  display: flex; flex-direction: column; gap: 1px;
  max-height: 360px; overflow-y: auto;
  z-index: 25;
}
${S} .oc-slash-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  background: transparent; border: none;
  border-radius: 8px;
  color: var(--color--text--on-surface);
  font-family: inherit; font-size: 13px;
  text-align: left; cursor: pointer;
}
${S} .oc-slash-item:hover,
${S} .oc-slash-item.is-active {
  background: rgba(255, 255, 255, 0.06);
}
${S} .oc-slash-label {
  font-family: var(--font-firacode);
  font-weight: 600;
  color: var(--color--text--on-surface);
  min-width: 90px;
  padding: 0; background: none;
}
${S} .oc-slash-desc {
  color: var(--color--text--muted);
  font-size: 12px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-slash-footer {
  display: flex; gap: 12px;
  padding: 6px 10px 2px;
  border-top: 1px solid var(--color--border--on-surface-0);
  margin-top: 4px;
  font-size: 10px; color: var(--color--text--muted);
}

${S} .oc-chat-composer-card {
  background: var(--color--surface--1);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 14px;
  transition: border-color 120ms ease;
  overflow: hidden;
}
${S} .oc-chat-composer-card:focus-within {
  border-color: rgba(59,130,246,0.35);
}
${S} .oc-chat-composer-input {
  width: 100%; box-sizing: border-box;
  background: transparent; border: none;
  padding: 12px 14px 4px;
  color: var(--color--text--on-surface);
  font-family: inherit; font-size: 13px; line-height: 1.5;
  outline: none; resize: none;
  min-height: 20px; max-height: 200px;
}
${S} .oc-chat-composer-input::placeholder { color: var(--color--text--muted); }
${S} .oc-chat-composer-input:disabled { opacity: 0.6; }

${S} .oc-chat-composer-toolbar {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 8px 8px;
  flex-wrap: wrap;
}
${S} .oc-chat-toolbar-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px;
  background: transparent; border: none; border-radius: 7px;
  color: var(--color--text--on-surface-variant);
  font-family: inherit; font-size: 11px; font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-chat-toolbar-pill:hover {
  background: rgba(255,255,255,0.05);
  color: var(--color--text--on-surface);
}
${S} .oc-chat-toolbar-pill.is-skill {
  padding-left: 5px; gap: 6px;
}
${S} .oc-chat-toolbar-caret {
  color: var(--color--text--muted);
  opacity: 0.7;
}
${S} .oc-chat-toolbar-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 24px;
  background: transparent; border: none; border-radius: 6px;
  color: var(--color--text--muted);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-chat-toolbar-iconbtn:hover {
  background: rgba(255,255,255,0.05);
  color: var(--color--text--on-surface);
}
${S} .oc-chat-skill-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 5px;
  background: rgba(59,130,246,0.18);
  color: var(--color--text--primary-light);
  font-size: 10px; font-weight: 700;
  font-family: var(--font-firacode);
}
${S} .oc-chat-toolbar-spacer { flex: 1; }

/* ── Skill picker dropdown (Phase 4-H) ─────────────────── */
${S} .oc-chat-skill-root { position: relative; }
${S} .oc-chat-skill-menu {
  position: absolute;
  bottom: calc(100% + 6px); left: 0;
  min-width: 260px; max-width: 340px;
  z-index: 30;
  background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
  padding: 4px;
  display: flex; flex-direction: column; gap: 1px;
  max-height: 320px; overflow-y: auto;
}
${S} .oc-chat-skill-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 10px;
  background: transparent; border: none;
  border-radius: 6px;
  color: var(--color--text--on-surface);
  font-family: inherit; text-align: left;
  cursor: pointer;
}
${S} .oc-chat-skill-item:hover,
${S} .oc-chat-skill-item.is-active {
  background: rgba(255, 255, 255, 0.06);
}
${S} .oc-chat-skill-item.is-active {
  color: var(--color--text--primary-light);
}
${S} .oc-chat-skill-item-name {
  font-size: 13px; font-weight: 500;
}
${S} .oc-chat-skill-item-desc {
  font-size: 11px; color: var(--color--text--muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-chat-skill-empty {
  margin: 0; padding: 10px 12px;
  font-size: 12px; color: var(--color--text--muted); line-height: 1.4;
}
${S} .oc-chat-skill-empty code {
  padding: 1px 5px;
  background: var(--color--surface--0);
  border-radius: 4px;
  font-family: var(--font-firacode); font-size: 10px;
}

${S} .oc-chat-send {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  background: var(--color--text--on-surface);
  color: var(--color--surface--0);
  border: none; border-radius: 50%;
  cursor: pointer;
  transition: background 120ms ease, opacity 120ms ease;
  flex-shrink: 0;
}
${S} .oc-chat-send:hover:not(:disabled) { background: white; }
${S} .oc-chat-send:disabled {
  background: rgba(255,255,255,0.1);
  color: var(--color--text--disabled);
  cursor: default;
}
${S} .oc-chat-send.is-stop { background: var(--red-500); color: white; }
${S} .oc-chat-send.is-stop:hover:not(:disabled) { background: var(--red-600); }

/* ── Footer: branch + plan + token meter ──────────────── */
${S} .oc-chat-footer {
  display: flex; align-items: center; gap: 2px;
  padding: 6px 12px 10px;
}
${S} .oc-chat-footer-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 8px;
  background: transparent; border: none; border-radius: 6px;
  color: var(--color--text--muted);
  font-family: inherit; font-size: 11px; font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-chat-footer-pill:hover {
  background: rgba(255,255,255,0.04);
  color: var(--color--text--on-surface);
}
${S} .oc-chat-footer-spacer { flex: 1; }
${S} .oc-chat-token-meter {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 500;
  color: var(--color--text--muted);
  padding: 0 4px;
}
${S} .oc-chat-token-dot {
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--color--text--muted);
  opacity: 0.6;
}

/* ── AI Applied Changes ── */
${S} .oc-ai-applied {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
  margin-top: 8px; padding: 6px 8px; border-radius: 5px;
  background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2);
  font-size: 10px; color: #22c55e;
}
${S} .oc-ai-context-variant {
  background: rgba(37,99,235,0.1); border-color: rgba(37,99,235,0.2);
  color: var(--color--base--primary);
}
${S} .oc-ai-context-none { opacity: 0.5; }
${S} .oc-ai-applied-prop {
  font-family: var(--font-mono); font-size: 10px;
  background: rgba(34,197,94,0.1); padding: 1px 5px;
  border-radius: 3px; color: #22c55e;
}

/* ── AI Diff View (C2: Accept/Reject Per Property) ── */
${S} .oc-ai-diff {
  margin: 8px 0; padding: 8px;
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 6px;
  background: var(--color--surface--1);
  font-size: 11px;
}
${S} .oc-ai-diff-title {
  font-size: 10px; font-weight: 600;
  color: var(--color--text--on-surface-variant);
  text-transform: uppercase; letter-spacing: 0.3px;
  margin-bottom: 6px; padding-bottom: 4px;
  border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-ai-diff-row {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 0; cursor: pointer;
  font-family: var(--font-mono); font-size: 10px;
  line-height: 1.4; min-width: 0;
}
${S} .oc-ai-diff-row:hover {
  background: var(--color--surface--2); border-radius: 3px;
}
${S} .oc-ai-diff-check {
  width: 12px; height: 12px; flex-shrink: 0;
  accent-color: var(--color--base--primary);
  cursor: pointer; margin: 0;
}
${S} .oc-ai-diff-prop {
  color: var(--color--text--on-surface);
  white-space: nowrap; flex-shrink: 0;
  font-weight: 500;
}
${S} .oc-ai-diff-old {
  color: #ef4444; text-decoration: line-through;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 70px;
}
${S} .oc-ai-diff-arrow {
  color: var(--color--text--muted); flex-shrink: 0;
}
${S} .oc-ai-diff-new {
  color: #22c55e; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 80px;
}
${S} .oc-ai-diff-actions {
  display: flex; gap: 4px; margin-top: 8px;
  padding-top: 6px; border-top: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-ai-diff-btn {
  flex: 1; padding: 4px 6px; border: none;
  border-radius: 4px; font-size: 10px; font-weight: 500;
  cursor: pointer; transition: opacity 0.15s;
  text-align: center;
}
${S} .oc-ai-diff-btn:hover { opacity: 0.85; }
${S} .oc-ai-diff-btn:disabled { opacity: 0.4; cursor: not-allowed; }
${S} .oc-ai-diff-apply {
  background: var(--color--base--primary);
  color: var(--color--text--on-primary);
}
${S} .oc-ai-diff-all {
  background: rgba(34,197,94,0.15); color: #22c55e;
  border: 1px solid rgba(34,197,94,0.3);
}
${S} .oc-ai-diff-reject {
  background: rgba(239,68,68,0.1); color: #ef4444;
  border: 1px solid rgba(239,68,68,0.2);
}

${S} .oc-ai-provider-tag {
  font-size: 10px; padding: 3px 8px; border-radius: 999px;
  background: rgba(255,255,255,0.05);
  color: var(--color--text--on-surface-variant);
  font-weight: 500;
  font-family: var(--font-firacode);
  letter-spacing: 0.02em;
}

/* ── AI Settings ── */
/* The scroll wrapper owns horizontal padding (oc-settings-scroll) —
 * don't double it up here. */
${S} .oc-ai-settings { padding: 0; }
${S} .oc-settings-section-title {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--color--text--on-surface);
  margin-bottom: 10px; margin-top: 16px;
}
${S} .oc-ai-settings .oc-settings-section-title:first-child { margin-top: 0; }
/* Phase 4 — the Clonk-style AI Models panel uses headings in title
 * case rather than the 11px uppercase overline, so overall hierarchy
 * reads less technical. "Connect a provider" feels like a heading,
 * not a label. */
${S} .oc-ai-settings > .oc-settings-section-title {
  font-size: 15px; font-weight: 600;
  text-transform: none; letter-spacing: 0;
  margin-bottom: 0;
}
${S} .oc-ai-auth .oc-settings-section-title {
  font-size: 15px; font-weight: 500;
  text-transform: none; letter-spacing: 0;
  margin: 0;
  color: var(--color--text--on-surface);
}

${S} .oc-ai-provider-group {
  display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;
}
${S} .oc-ai-provider-btn {
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 12px; border-radius: 6px;
  border: 1.5px solid var(--color--border--on-surface-1);
  background: var(--color--surface--0); cursor: pointer;
  text-align: left; transition: all 0.12s;
}
${S} .oc-ai-provider-btn:hover {
  border-color: var(--color--text--on-surface-variant);
}
${S} .oc-ai-provider-btn.is-active {
  border-color: var(--color--base--primary);
  background: rgba(37,99,235,0.06);
}
${S} .oc-ai-provider-label {
  font-size: 13px; font-weight: 600; color: var(--color--text--on-surface);
}
${S} .oc-ai-provider-desc {
  font-size: 11px; color: var(--color--text--muted);
}

${S} .oc-ai-config-section { margin-bottom: 12px; }
${S} .oc-ai-hint {
  font-size: 11px; color: var(--color--text--muted);
  line-height: 1.5; margin-bottom: 10px;
}
${S} .oc-ai-hint code {
  font-family: var(--font-mono); font-size: 10px;
  background: var(--color--surface--2); padding: 1px 5px;
  border-radius: 3px;
}

${S} .oc-ai-field {
  display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px;
}
${S} .oc-ai-field-label {
  font-size: 11px; color: var(--color--text--on-surface-variant); font-weight: 500;
}
${S} .oc-ai-field-value {
  font-family: var(--font-mono); font-size: 10px;
  color: var(--color--text--muted); margin-left: 4px;
}
${S} .oc-ai-field-input {
  padding: 6px 10px; border-radius: 5px;
  border: 1px solid var(--color--border--on-surface-1);
  background: var(--color--surface--1); color: var(--color--text--on-surface);
  font-size: 12px; font-family: var(--font-mono); outline: none;
}
${S} .oc-ai-field-input:focus { border-color: var(--color--outline--focus); }
${S} .oc-ai-field-select {
  padding: 6px 10px; border-radius: 5px;
  border: 1px solid var(--color--border--on-surface-1);
  background: var(--color--surface--1); color: var(--color--text--on-surface);
  font-size: 12px; outline: none; cursor: pointer;
}
${S} .oc-ai-field-range {
  width: 100%; height: 4px; -webkit-appearance: none; appearance: none;
  background: var(--color--surface--2); border-radius: 2px; outline: none;
}
${S} .oc-ai-field-range::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px;
  border-radius: 50%; background: var(--color--base--primary);
  cursor: grab;
}

${S} .oc-ai-save-btn {
  width: 100%; padding: 8px 16px; border: none; border-radius: 6px;
  background: var(--color--base--primary); color: var(--color--text--on-primary);
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: opacity 0.15s; margin-top: 12px;
}
${S} .oc-ai-save-btn:hover { opacity: 0.85; }
${S} .oc-ai-save-btn:disabled { opacity: 0.55; cursor: default; }
${S} .oc-ai-save-btn.is-compact {
  width: auto; padding: 6px 14px; font-size: 11px; margin-top: 0;
}

/* ── Phase 2-E settings panels ── */
${S} .oc-settings-panel { padding: 16px; }
${S} .oc-settings-panel p.oc-ai-hint { margin-top: 0; }

${S} .oc-ai-field-hint {
  display: block; margin-top: 4px;
  font-size: 11px; color: var(--color--text--muted);
  line-height: 1.4;
}

${S} .oc-api-keys__row {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-api-keys__row:last-of-type { border-bottom: none; }
${S} .oc-api-keys__row .oc-ai-field { flex: 1; margin-bottom: 0; }
${S} .oc-api-keys__row-actions {
  display: flex; flex-direction: column; align-items: flex-end;
  gap: 4px; padding-top: 20px;
}
${S} .oc-api-keys__notice {
  font-size: 10px; color: var(--color--text--muted);
}

${S} .oc-debug-table {
  width: 100%; border-collapse: collapse; margin-top: 12px;
  font-size: 12px;
}
${S} .oc-debug-table th,
${S} .oc-debug-table td {
  padding: 6px 10px; text-align: left;
  border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-debug-table th {
  font-weight: 500; color: var(--color--text--muted); width: 150px;
}
${S} .oc-debug-table td code {
  font-family: var(--font-mono); font-size: 11px;
  background: var(--color--surface--1); padding: 2px 6px;
  border-radius: 3px;
}

/* ── Token Suggestions Dropdown ── */
${S} .oc-token-suggest {
  position: relative; display: inline-flex; align-items: center; flex-shrink: 0;
}
${S} .oc-token-suggest-trigger {
  background: none; border: 1px solid var(--color--border--on-surface-1);
  border-radius: 3px; width: 16px; height: 16px; display: flex;
  align-items: center; justify-content: center; cursor: pointer;
  color: var(--color--text--muted); padding: 0;
  transition: border-color 0.15s, color 0.15s;
}
${S} .oc-token-suggest-trigger:hover {
  border-color: var(--color--outline--focus);
  color: var(--color--text--on-surface);
}
${S} .oc-token-suggest-dropdown {
  position: absolute; top: 100%; left: -4px; z-index: 100;
  margin-top: 4px; min-width: 160px; max-width: 200px;
  background: var(--color--surface--0); border: 1px solid var(--color--border--on-surface-1);
  border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.35);
  overflow: hidden;
}
${S} .oc-token-suggest-header {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--color--text--muted);
  padding: 6px 8px 4px; border-bottom: 1px solid var(--color--border--on-surface-0);
}
${S} .oc-token-suggest-list {
  max-height: 156px; overflow-y: auto;
}
${S} .oc-token-suggest-item {
  display: flex; align-items: center; gap: 6px;
  width: 100%; padding: 4px 8px; border: none;
  background: none; cursor: pointer; text-align: left;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--color--text--on-surface);
  transition: background 0.1s;
}
${S} .oc-token-suggest-item:hover {
  background: var(--color--surface--1);
}
${S} .oc-token-suggest-swatch {
  width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0;
  border: 1px solid var(--color--border--on-surface-1);
}
${S} .oc-token-suggest-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  min-width: 0; flex: 1;
}

/* ── CSS Value Autocomplete ── */
${S} .oc-autocomplete-wrap {
  position: relative; flex: 1; min-width: 0;
}
${S} .oc-autocomplete-dropdown {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 100;
  margin-top: 2px; background: var(--color--surface--0);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 5px; box-shadow: 0 4px 12px rgba(0,0,0,0.35);
  overflow: hidden; max-height: 156px; overflow-y: auto;
}
${S} .oc-autocomplete-item {
  display: block; width: 100%; padding: 4px 8px; border: none;
  background: none; cursor: pointer; text-align: left;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--color--text--on-surface);
  transition: background 0.08s;
}
${S} .oc-autocomplete-item:hover,
${S} .oc-autocomplete-item.is-highlighted {
  background: var(--color--surface--1);
  color: var(--color--text--on-surface);
}

/* ── Effects Editor ── */
${S} .oc-effects-editor {
  padding: 6px 10px 8px; display: flex; flex-direction: column; gap: 6px;
}
${S} .oc-effects-row {
  display: flex; align-items: center; gap: 6px; min-height: 24px;
}
${S} .oc-effects-label {
  font-size: 11px; color: var(--color--text--muted);
  min-width: 44px; flex-shrink: 0;
}
${S} .oc-effects-select {
  flex: 1; min-width: 0; background: var(--color--surface--1);
  border: 1px solid var(--color--border--on-surface-1);
  border-radius: 4px; padding: 3px 6px; color: var(--color--text--on-surface);
  font-size: 10px; font-family: var(--font-mono);
  outline: none; cursor: pointer; appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%23737373' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  padding-right: 20px;
}
${S} .oc-effects-select:focus {
  border-color: var(--color--outline--focus);
}
${S} .oc-effects-select option {
  background: var(--color--surface--0); color: var(--color--text--on-surface);
}

/* ── Toggle Switch ── */
${S} .oc-ai-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 8px 0; cursor: pointer;
}
${S} .oc-ai-toggle-info {
  display: flex; flex-direction: column; gap: 2px; flex: 1;
}
${S} .oc-ai-toggle-label {
  font-size: 12px; font-weight: 500; color: var(--color--text--on-surface);
}
${S} .oc-ai-toggle-desc {
  font-size: 11px; color: var(--color--text--muted); line-height: 1.4;
}
${S} .oc-toggle-switch {
  position: relative; width: 36px; height: 20px; flex-shrink: 0;
  border-radius: 10px; border: 1px solid var(--color--border--on-surface-1);
  background: var(--color--surface--1); cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  padding: 0;
}
${S} .oc-toggle-switch.is-on {
  background: var(--color--base--primary);
  border-color: var(--color--base--primary);
}
${S} .oc-toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--color--text--on-surface);
  transition: transform 0.2s;
  pointer-events: none;
}
${S} .oc-toggle-switch.is-on .oc-toggle-thumb {
  transform: translateX(16px);
}

/* ── Auto-send Notification ── */
${S} .oc-auto-send-notification {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
  z-index: 2147483645;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; border-radius: 8px;
  background: var(--color--surface--1); color: var(--color--text--on-surface);
  border: 1px solid var(--color--base--primary);
  font-size: 12px; font-weight: 500;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  animation: oc-notification-in 0.3s ease-out;
  pointer-events: none;
}
${S} .oc-auto-send-icon {
  color: var(--color--text--primary-light); font-size: 14px;
}
@keyframes oc-notification-in {
  from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
`;

export function injectStyles(): void {
  if (typeof document === "undefined") return;
  // Concatenate the legacy monolithic stylesheet (ZEROCANVAS_CSS in
  // this file) with the modular barrel so Phase 4's tiles / auth
  // tabs / effort selector actually reach the DOM. Keep the legacy
  // string for rollback safety.
  const content = `${ZEROCANVAS_CSS}\n${MODULAR_CSS}`;
  const existing = document.getElementById(STYLE_ID);
  if (existing) {
    // HMR-safe: if the CSS source changed, swap the text in place so
    // the live page picks up edits without a full reload. Without this,
    // the first save after any style edit renders unstyled because
    // HMR re-runs this module but the stale <style> tag stays in <head>.
    if (existing.textContent !== content) existing.textContent = content;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = content;
  document.head.appendChild(style);
}

// Vite HMR: when any partial in styles/*.ts is edited, Vite bubbles the
// update up through styles/index.ts to this module. Re-run injectStyles
// so the <style> tag's textContent refreshes. Without an explicit
// accept, Vite may full-reload — also fine, but slower.
const _hot = (import.meta as unknown as { hot?: { accept: (cb: () => void) => void } }).hot;
if (_hot) {
  _hot.accept(() => {
    injectStyles();
  });
}

export function removeStyles(): void {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
}