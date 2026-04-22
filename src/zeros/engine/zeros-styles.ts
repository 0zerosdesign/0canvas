// ──────────────────────────────────────────────────────────
// Zeros — Runtime CSS Injection (v0.0.3)
// ──────────────────────────────────────────────────────────
//
// COMPLETE self-contained CSS for ALL Zeros components.
// Every Tailwind utility class used in any component file is
// defined here, scoped under [data-Zeros-root].
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
import { ZEROS_CSS as MODULAR_CSS } from "./styles/index";

const STYLE_ID = "Zeros-injected-styles";

// Helper: scope selector under [data-Zeros-root]
const S = "[data-Zeros-root]";

export const ZEROS_CSS = `
/* ============================================================
   Zeros — Complete Self-Contained Styles
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
  --text-on-surface: #FAFAFA;
  --surface-0: #171717;
  /* Semantic: Surface */
  --surface-floor: var(--grey-950);
  --surface-0: var(--grey-900);
  --surface-1: var(--grey-800);
  --surface-2: var(--grey-700);
  --surface-absolute: black;
  --surface-inverted: var(--grey-200);
  /* Semantic: Text */
  --text-on-surface: var(--grey-200);
  --text-on-surface-variant: var(--grey-400);
  --text-muted: var(--grey-500);
  --text-disabled: var(--grey-600);
  --text-hint: var(--grey-700);
  --text-on-primary: var(--grey-50);
  --text-primary: var(--blue-600);
  --text-primary-light: var(--blue-400);
  --text-primary: var(--blue-600);
  --status-info: var(--blue-500);
  --text-success: var(--green-500);
  --text-warning: var(--yellow-500);
  --text-critical: var(--red-500);
  --text-critical-light: var(--red-400);
  /* Semantic: Border */
  --border-subtle: var(--grey-800);
  --border-default: var(--grey-700);
  --border-strong: var(--grey-600);
  /* Semantic: Base / Primary */
  --primary: var(--blue-600);
  --primary-hover: var(--blue-700);
  --primary-light: var(--blue-500);
  /* Semantic: Status */
  --status-info: var(--blue-500);
  --status-success: var(--green-500);
  --status-warning: var(--yellow-500);
  --status-critical: var(--red-500);
  --status-connecting: var(--orange-500);
  /* Semantic: Outline */
  --ring: var(--blue-500);
  --primary: var(--blue-600);
  /* Semantic: Shadow */
  --tint-black-soft: rgba(0,0,0,0.25);
  --backdrop-weak: rgba(0,0,0,0.6);
  /* Semantic: Syntax */
  --syntax-comment: var(--grey-400);
  --syntax-selector: var(--green-500);
  --syntax-property: var(--blue-300);
  --syntax-value: var(--orange-400);
  /* Fonts */
  --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Fira Code', 'JetBrains Mono', 'Geist Mono', monospace;
  /* Font sizes */
  --text-10: 0.625rem; --text-12: 0.75rem;
  --text-13: 0.875rem; --text-13: 1rem;
  --text-15: 1.125rem; --text-18: 1.25rem;
  /* Font weights */
  --font-weight-light: 300; --weight-body: 400;
  --weight-control: 500; --weight-heading: 600;
  --font-weight-bold: 700;
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.25);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.25), 0 2px 4px -1px rgba(0,0,0,0.25);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.25), 0 4px 6px -2px rgba(0,0,0,0.25);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.25), 0 10px 10px -5px rgba(0,0,0,0.25);
}

/* ── Targeted reset: override inherited consumer styles ── */
${S} {
  font-family: var(--font-ui) !important;
  font-size: var(--text-13) !important;
  line-height: 1.5 !important;
  color: var(--text-on-surface) !important;
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
${S} ::-webkit-scrollbar-thumb { background: var(--surface-2); border-radius: 4px; }
${S} ::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }

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
${S} .border-border { border-color: var(--border-subtle); }
${S} .border-\\[\\#1a1a1a\\] { border-color: var(--border-subtle); }
${S} .border-\\[\\#222222\\] { border-color: var(--border-subtle); }
${S} .border-\\[\\#333333\\] { border-color: var(--border-default); }
${S} .border-\\[\\#444\\] { border-color: var(--border-default); }
${S} .border-foreground { border-color: var(--text-on-surface); }
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
${S} .bg-background { background-color: var(--surface-0); }
${S} .bg-foreground { background-color: var(--surface-inverted); }
${S} .bg-border { background-color: var(--surface-1); }
${S} .bg-transparent { background-color: transparent; }
${S} .bg-\\[\\#000000\\] { background-color: var(--surface-0); }
${S} .bg-\\[\\#080808\\] { background-color: var(--surface-0); }
${S} .bg-\\[\\#0a0a0a\\] { background-color: var(--surface-floor); }
${S} .bg-\\[var\\(--grey-950\\)\\] { background-color: var(--surface-floor); }
${S} .bg-\\[\\#111111\\] { background-color: var(--surface-1); }
${S} .bg-\\[\\#1a1a1a\\] { background-color: var(--surface-1); }
${S} .bg-\\[\\#222222\\] { background-color: var(--surface-1); }
${S} .bg-\\[\\#333333\\] { background-color: var(--surface-2); }
${S} .bg-\\[\\#444444\\] { background-color: var(--surface-2); }
${S} .bg-\\[\\#0070f3\\] { background-color: var(--primary); }
${S} .bg-\\[\\#50e3c2\\] { background-color: var(--status-success); }
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
${S} .text-foreground { color: var(--text-on-surface); }
${S} .text-background { color: var(--surface-0); }
${S} .text-muted-foreground { color: var(--text-muted); }
${S} .text-white { color: var(--text-on-primary); }
${S} .text-\\[\\#0070f3\\] { color: var(--text-primary); }
${S} .text-\\[\\#50e3c2\\] { color: var(--status-success); }
${S} .text-\\[\\#f5a623\\] { color: var(--status-warning); }
${S} .text-\\[\\#7928ca\\] { color: var(--blue-700); }
${S} .text-\\[\\#ff0080\\] { color: var(--blue-500); }
${S} .text-\\[\\#ff4444\\] { color: var(--status-critical); }
${S} .text-\\[\\#ff9800\\] { color: var(--yellow-600); }
${S} .text-\\[\\#4caf50\\] { color: var(--green-600); }
${S} .text-\\[\\#2196f3\\] { color: var(--blue-500); }
${S} .text-\\[\\#79b8ff\\] { color: var(--blue-300); }
${S} .text-\\[\\#444444\\] { color: var(--text-hint); }
${S} .text-\\[\\#888888\\] { color: var(--text-muted); }
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
${S} .placeholder\\:text-muted-foreground::placeholder { color: var(--text-muted); }

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
${S} .ring-1 { box-shadow: 0 0 0 1px var(--ring); }
${S} .ring-white\\/30 { box-shadow: 0 0 0 1px rgba(255,255,255,0.3); }
${S} .ring-white\\/40 { box-shadow: 0 0 0 1px rgba(255,255,255,0.4); }

/* ============================================================
   HOVER STATES
   ============================================================ */
${S} .hover\\:bg-\\[\\#1a1a1a\\]:hover { background-color: var(--surface-1); }
${S} .hover\\:bg-\\[\\#111111\\]:hover { background-color: var(--surface-1); }
${S} .hover\\:bg-\\[\\#ffffff06\\]:hover { background-color: rgba(255,255,255,0.024); }
${S} .hover\\:bg-\\[\\#ffffff08\\]:hover { background-color: rgba(255,255,255,0.031); }
${S} .hover\\:bg-\\[\\#ffffff10\\]:hover { background-color: rgba(255,255,255,0.063); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/10:hover { background-color: rgba(0,112,243,0.1); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/20:hover { background-color: rgba(0,112,243,0.2); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/90:hover { background-color: rgba(0,112,243,0.9); }
${S} .hover\\:bg-\\[\\#ff4444\\]\\/10:hover { background-color: rgba(255,68,68,0.1); }
${S} .hover\\:text-foreground:hover { color: var(--text-on-surface); }
${S} .hover\\:text-\\[\\#0070f3\\]:hover { color: var(--text-primary); }
${S} .hover\\:text-\\[\\#7928ca\\]:hover { color: var(--blue-700); }
${S} .hover\\:text-\\[\\#f5a623\\]:hover { color: var(--status-warning); }
${S} .hover\\:text-\\[\\#ff4444\\]:hover { color: var(--status-critical); }
${S} .hover\\:border-\\[\\#333333\\]:hover { border-color: var(--border-default); }
${S} .hover\\:border-foreground:hover { border-color: var(--text-on-surface); }
${S} .hover\\:underline:hover { text-decoration: underline; }
${S} .hover\\:opacity-90:hover { opacity: 0.9; }

/* ============================================================
   FOCUS STATES
   ============================================================ */
${S} .focus\\:outline-none:focus { outline: none; }
${S} .focus\\:border-\\[\\#333333\\]:focus { border-color: var(--border-default); }
${S} .focus\\:border-\\[\\#0070f3\\]:focus { border-color: var(--primary); }
${S} .focus-visible\\:ring-ring\\/50:focus-visible { box-shadow: 0 0 0 3px rgba(51,51,51,0.5); }
${S} .focus-visible\\:ring-\\[3px\\]:focus-visible { box-shadow: 0 0 0 3px var(--ring); }
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
  background: var(--surface-0); color: var(--text-muted);
  font-size: var(--text-13); font-family: var(--font-ui);
}
${S} .oc-toggle-btn {
  position: fixed; width: 44px; height: 44px; border-radius: 12px;
  border: 1px solid var(--border-subtle); background: var(--surface-floor);
  color: var(--text-on-surface); cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: all 0.2s ease; box-shadow: var(--shadow-lg);
  font-size: 0; padding: 0; outline: none;
}
${S} .oc-toggle-btn:hover { background: var(--surface-1); transform: scale(1.05); }
/* ── App Shell (page tabs + page) ──────────────────────────── */
${S} .oc-app-shell {
  height: 100%; display: flex; flex-direction: column; overflow: hidden;
}

/* ── Page tabs (horizontal — Design / Themes) ─────────────── */
${S} .oc-page-tabs {
  display: flex; align-items: center; gap: 2px;
  padding: 10px 10px 4px;
  flex-shrink: 0;
  background: var(--surface-floor);
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-page-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: transparent; border: none; border-radius: 6px;
  color: var(--text-muted);
  font-size: 12px; font-weight: 500;
  cursor: pointer; white-space: nowrap;
  font-family: inherit;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-page-tab:hover {
  color: var(--text-on-surface);
  background: rgba(255, 255, 255, 0.03);
}
${S} .oc-page-tab.is-active {
  color: var(--text-on-surface);
  background: rgba(255, 255, 255, 0.06);
}
${S} .oc-page-tab--close { margin-right: 4px; }

/* Settings-page rules live in engine/styles/settings.ts (modular barrel).
 * The legacy duplicates that lived here were removed in Pass 4 when
 * Settings moved into the 3-column shell. */

${S} .oc-workspace {
  flex: 1; height: 100%; display: flex; flex-direction: column;
  background: var(--surface-0); overflow: hidden;
}
${S} .oc-workspace-main { flex: 1; display: flex; overflow: hidden; }
${S} .oc-workspace-center { flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden; }
${S} .oc-panel-slot { flex-shrink: 0; height: 100%; overflow: hidden; }

/* ── Resizable Panel ─────────────────────────────────────── */
${S} .oc-resize-handle {
  width: 5px; flex-shrink: 0; height: 100%;
  cursor: ew-resize; z-index: 10; display: flex;
  align-items: stretch; justify-content: center;
  background: transparent;
}
${S} .oc-resize-handle .oc-resize-line {
  width: 1px; height: 100%; background: var(--border-default);
  transition: width 0.12s ease, background 0.12s ease;
  pointer-events: none;
}
${S} .oc-resize-handle:hover .oc-resize-line {
  width: 3px; background: var(--primary);
}

/* ── Toolbar ────────────────────────────────────────────────── */
${S} .oc-toolbar {
  height: 48px; display: flex; align-items: center;
  justify-content: space-between;
  padding: 0 16px; gap: 6px; flex-shrink: 0;
  background: var(--surface-floor); border-bottom: 1px solid var(--border-subtle);
  font-family: var(--font-ui); font-size: 13px;
  color: var(--text-on-surface); user-select: none;
}
${S} .oc-toolbar-section { display: flex; align-items: center; gap: 12px; }
${S} .oc-toolbar-section-actions { display: flex; align-items: center; gap: 8px; }
${S} .oc-toolbar-group { display: flex; align-items: center; gap: 2px; }
${S} .oc-toolbar-group.is-pill {
  background: var(--surface-0); border-radius: 8px;
  padding: 3px; border: 1px solid var(--border-subtle);
}
${S} .oc-toolbar-group.is-pill-sm {
  background: var(--surface-0); border-radius: 6px;
  padding: 3px; border: 1px solid var(--border-subtle);
}
${S} .oc-toolbar-divider { width: 1px; height: 20px; background: var(--border-subtle); }
${S} .oc-toolbar-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 6px;
  font-size: 12px; font-weight: 450; color: var(--text-muted);
  background: transparent; border: none; cursor: pointer;
  transition: all 0.15s ease; white-space: nowrap;
}
${S} .oc-toolbar-btn:hover { background: rgba(255,255,255,0.04); color: var(--text-on-surface); }
${S} .oc-toolbar-btn.is-active { background: var(--surface-1); color: var(--text-on-surface); }
${S} .oc-toolbar-badge {
  font-size: 10px; font-weight: 600;
  background: rgba(255,255,255,0.1); color: var(--text-on-surface);
  padding: 1px 5px; border-radius: 4px; line-height: 14px;
}
${S} .oc-toolbar-logo {
  display: flex; align-items: center; gap: 8px;
}
${S} .oc-toolbar-logo-icon {
  width: 26px; height: 26px; border-radius: 6px;
  background: var(--surface-inverted); display: flex;
  align-items: center; justify-content: center;
}
${S} .oc-toolbar-logo-text {
  font-size: 13px; font-weight: 500; letter-spacing: -0.01em;
}
${S} .oc-toolbar-conn-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--status-success);
}
${S} .oc-toolbar-dropdown {
  position: absolute; top: 100%; left: 0; margin-top: 6px;
  background: var(--surface-floor); border: 1px solid var(--border-subtle);
  border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,0.5);
  z-index: 100; overflow: hidden;
}
${S} .oc-toolbar-dropdown-inputrow {
  padding: 8px 10px; border-bottom: 1px solid var(--border-subtle);
  display: flex; gap: 6px;
}
${S} .oc-toolbar-dropdown-list { max-height: 180px; overflow-y: auto; }
${S} .oc-toolbar-dropdown-list.is-tall { max-height: 200px; }
${S} .oc-toolbar-dropdown-empty {
  padding: 16px; text-align: center; color: var(--text-disabled); font-size: 11px;
}
${S} .oc-toolbar-project-trigger {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 6px;
  background: var(--surface-0);
  border: 1px solid var(--border-subtle); cursor: pointer;
}
${S} .oc-toolbar-project-trigger:hover { border-color: var(--border-default); }
${S} .oc-toolbar-project-dot {
  width: 6px; height: 6px; border-radius: 50%;
}
${S} .oc-toolbar-project-dot.is-saved { background: var(--status-success); }
${S} .oc-toolbar-project-dot.is-unsaved { background: var(--status-warning); }
${S} .oc-toolbar-project-input {
  width: 100px; padding: 1px 4px;
  background: var(--surface-1); border: 1px solid var(--border-default);
  border-radius: 4px; color: var(--text-on-surface);
  font-size: 12px; outline: none;
}
${S} .oc-toolbar-project-name {
  font-size: 12px; max-width: 120px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; color: var(--text-on-surface);
}
${S} .oc-toolbar-project-unsaved {
  font-size: 10px; color: var(--status-warning); font-style: italic;
}
${S} .oc-toolbar-project-save-btn {
  flex: 1; display: flex; align-items: center; justify-content: center;
  gap: 5px; padding: 6px 0; background: var(--primary);
  border: none; border-radius: 6px; color: var(--text-on-primary);
  font-size: 11px; font-weight: 500; cursor: pointer;
}
${S} .oc-toolbar-project-save-btn:hover { background: var(--primary-hover); }
${S} .oc-toolbar-project-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; background: transparent;
  border-left: 2px solid transparent;
  cursor: pointer; transition: all 0.1s ease;
}
${S} .oc-toolbar-project-item:hover { background: rgba(255,255,255,0.03); }
${S} .oc-toolbar-project-item.is-active {
  background: rgba(37,99,235,0.07);
  border-left-color: var(--primary);
}
${S} .oc-toolbar-project-item-name {
  font-size: 12px; color: var(--text-on-surface);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-toolbar-project-item.is-active .oc-toolbar-project-item-name {
  color: var(--text-primary);
}
${S} .oc-toolbar-project-item-meta {
  font-size: 10px; color: var(--text-disabled); margin-top: 2px;
}
${S} .oc-toolbar-project-delete {
  background: none; border: none; cursor: pointer;
  padding: 2px; color: var(--status-critical);
  display: none;
}
${S} .oc-toolbar-project-item:hover .oc-toolbar-project-delete {
  display: block;
}

/* ── Panel (shared base) ───────────────────────────────────── */
${S} .oc-panel {
  height: 100%; display: flex; flex-direction: column;
  background: var(--surface-0); font-family: var(--font-ui);
  overflow: hidden;
}
${S} .oc-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px 8px;
  font-size: 12px; font-weight: 600; color: var(--text-on-surface);
}
${S} .oc-panel-title {
  font-size: 13px; font-weight: 600;
  letter-spacing: -0.01em; color: var(--text-on-surface);
  text-transform: none;
}
${S} .oc-panel-body { flex: 1; overflow-y: auto; overflow-x: auto; }
${S} .oc-panel-section {
  padding: 6px 10px;
}
${S} .oc-panel-empty {
  padding: 24px 14px; text-align: center;
  color: var(--text-muted); font-size: 12px;
}

/* ── Layers Panel ──────────────────────────────────────────── */

/* ── Style Panel ───────────────────────────────────────────── */
${S} .oc-style-tabs {
  display: flex; border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-style-tab {
  flex: 1; padding: 8px 0; font-size: 11px; font-weight: 500;
  text-align: center; color: var(--text-muted);
  background: transparent; border: none; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all 0.15s ease;
}
${S} .oc-style-tab:hover { color: var(--text-on-surface); }
${S} .oc-style-tab.is-active {
  color: var(--text-on-surface); border-bottom-color: var(--primary);
}
${S} .oc-style-property {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 10px; font-size: 11px; min-width: 0;
}
${S} .oc-style-property:hover { background: rgba(255,255,255,0.03); }
${S} .oc-style-prop-name {
  color: var(--text-muted); min-width: 70px; max-width: 80px; flex-shrink: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-swatch {
  width: 14px; height: 14px; border-radius: 4px;
  border: 1px solid var(--border-default); display: inline-block;
  vertical-align: middle; margin-right: 6px;
}
${S} .oc-style-input {
  background: var(--surface-1); border: 1px solid var(--border-default);
  border-radius: 4px; padding: 3px 6px; color: var(--text-on-surface);
  font-size: 11px; font-family: var(--font-mono); outline: none;
  width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box;
}
${S} .oc-style-input:focus { border-color: var(--ring); }
${S} .oc-style-tag-badge {
  font-size: 12px; color: var(--text-primary);
  background: rgba(37,99,235,0.09); padding: 2px 8px;
  border-radius: 4px; font-family: var(--font-mono);
}
${S} .oc-style-class-badge {
  font-size: 10px; color: var(--text-on-surface-variant);
  background: var(--surface-1); padding: 1px 5px;
  border-radius: 4px; border: 1px solid var(--border-subtle);
  font-family: var(--font-mono); max-width: 80px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-class-overflow { font-size: 10px; color: var(--text-muted); }
${S} .oc-style-prop-count { font-size: 11px; color: var(--text-on-surface-variant); }
${S} .oc-style-section-btn {
  display: flex; align-items: center; width: 100%;
  padding: 4px 0; background: transparent; border: none;
  cursor: pointer; color: var(--text-on-surface); font-size: 12px;
  transition: background 0.1s ease;
}
${S} .oc-style-section-btn:hover { background: rgba(255,255,255,0.02); }
${S} .oc-style-section-icon { margin-right: 6px; display: inline-flex; }
${S} .oc-style-section-name { font-size: 12px; font-weight: 450; }
${S} .oc-style-section-count { margin-left: auto; font-size: 10px; color: var(--text-muted); }
${S} .oc-style-code-block {
  font-size: 11px; color: var(--text-on-surface); background: var(--surface-1);
  padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);
  overflow-x: auto; white-space: pre; font-family: var(--font-mono);
}
${S} .oc-style-syntax-comment { color: var(--syntax-comment); }
${S} .oc-style-syntax-selector { color: var(--syntax-selector); }
${S} .oc-style-syntax-property { color: var(--syntax-property); }
${S} .oc-style-syntax-value { color: var(--syntax-value); }
${S} .oc-style-empty-icon { margin: 0 auto 12px; display: block; }
${S} .oc-style-prop-value-wrap {
  flex: 1; display: flex; align-items: center; gap: 4px;
  min-width: 0; overflow: hidden;
}
${S} .oc-style-click-value {
  flex: 1; color: var(--text-on-surface); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; cursor: text;
  min-width: 0; font-family: var(--font-mono); font-size: 11px;
}
${S} .oc-style-section-children { padding-bottom: 4px; }
${S} .oc-style-empty-centered {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 24px 14px; text-align: center; color: var(--text-muted); font-size: 12px;
}
${S} .oc-style-header-col {
  display: flex; flex-direction: column; align-items: stretch;
  padding: 8px 10px; border-bottom: 1px solid var(--border-subtle);
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
${S} .oc-style-chevron { margin-right: 6px; }

/* ── Focus Mode Toggle ───────────────────────────────────── */
${S} .oc-focus-toggle {
  position: relative;
  width: 24px; height: 24px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 4px; border: none; cursor: pointer;
  background: transparent; color: var(--text-muted);
  transition: all 0.15s ease;
}
${S} .oc-focus-toggle:hover {
  background: rgba(255,255,255,0.06); color: var(--text-on-surface);
}
${S} .oc-focus-toggle.is-active {
  color: var(--text-primary);
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
  accent-color: var(--text-primary);
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
  padding: 8px 12px; background: var(--surface-0);
  border-bottom: 1px solid var(--border-subtle);
  border-radius: 8px 10px 0 0; user-select: none;
}
${S} .oc-source-url {
  flex: 1; padding: 4px 10px; border-radius: 6px;
  background: var(--surface-1); color: var(--text-muted);
  font-size: 11px; font-family: var(--font-mono);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-source-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); transition: all 0.15s ease;
}
${S} .oc-source-btn:hover { background: var(--surface-1); color: var(--text-on-surface); }
${S} .oc-source-btn.is-active { background: var(--primary); color: var(--text-on-primary); }
${S} .oc-source-badge {
  position: absolute; top: -2px; right: -2px;
  display: flex; align-items: center; justify-content: center;
  min-width: 14px; height: 14px; padding: 0 3px;
  border-radius: 8px;
  background: var(--surface-floor); color: var(--text-on-surface);
  font-size: 6px; font-weight: 700; line-height: 1;
  pointer-events: none; box-sizing: border-box;
  transform-origin: center; transform: scale(0.85);
}
${S} .oc-source-btn-group {
  display: flex; align-items: center;
  border-radius: 6px;
}
${S} .oc-source-btn-group.has-items {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  gap: 0;
}
${S} .oc-source-btn-group.has-items .oc-source-btn {
  border-radius: 8px 0 0 7px;
}
${S} .oc-source-btn-group.has-items .oc-source-send-btn {
  border-radius: 0 7px 7px 0;
  border-left: 1px solid var(--border-subtle);
  color: var(--text-muted);
}
${S} .oc-source-btn-group.has-items .oc-source-send-btn:hover {
  color: var(--text-on-surface);
  background: var(--surface-2);
}
${S} .oc-source-preset {
  padding: 3px 8px; border-radius: 4px; font-size: 10px;
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); font-family: var(--font-mono);
  transition: all 0.15s ease;
}
${S} .oc-source-preset:hover { background: var(--surface-1); color: var(--text-on-surface); }
${S} .oc-source-preset.is-active { background: var(--primary); color: var(--text-on-primary); }

${S} .oc-variant-card {
  border-radius: 0; border: 1px solid var(--border-subtle);
  background: var(--surface-0); overflow: hidden;
  transition: border-color 0.2s ease;
}
${S} .oc-variant-card:hover { border-color: var(--border-default); }
${S} .oc-variant-card.is-selected { border-color: var(--primary); border-width: 2.5px; }

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
  border-radius: 4px;
  background: var(--border-default);
  pointer-events: none;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}
${S} .oc-resize-handle-left,
${S} .oc-resize-handle-left,
${S} .oc-resize-handle-left,
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
${S} .oc-resize-zone-left:hover .oc-resize-handle,
${S} .oc-resize-zone-left:hover .oc-resize-handle,
${S} .oc-resize-zone-left:hover .oc-resize-handle,
${S} .oc-resize-zone-right:hover .oc-resize-handle {
  background: var(--text-muted);
  transform: scaleY(1.4);
  box-shadow: 0 0 8px rgba(115,115,115,0.3);
}
${S} .oc-resize-zone-bottom:hover .oc-resize-handle {
  background: var(--text-muted);
  transform: scaleX(1.4);
  box-shadow: 0 0 8px rgba(115,115,115,0.3);
}

/* Active (dragging) */
${S} .oc-resize-zone.is-active .oc-resize-handle {
  background: var(--text-on-surface-variant) !important;
  box-shadow: 0 0 12px rgba(212,212,212,0.25) !important;
}
${S} .oc-resize-zone-left.is-active .oc-resize-handle,
${S} .oc-resize-zone-left.is-active .oc-resize-handle,
${S} .oc-resize-zone-left.is-active .oc-resize-handle,
${S} .oc-resize-zone-left.is-active .oc-resize-handle,
${S} .oc-resize-zone-right.is-active .oc-resize-handle {
  transform: scaleY(1.6) !important;
}
${S} .oc-resize-zone-bottom.is-active .oc-resize-handle {
  transform: scaleX(1.6) !important;
}
${S} .oc-variant-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; background: var(--surface-0);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px; user-select: none;
}
${S} .oc-variant-status {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
${S} .oc-variant-name {
  flex: 1; color: var(--text-on-surface); font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-variant-actions {
  display: flex; align-items: center; gap: 2px;
}
${S} .oc-variant-action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 4px;
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); transition: all 0.15s ease;
}
${S} .oc-variant-action-btn:hover { background: var(--surface-1); color: var(--text-on-surface); }

/* ── Agent Panel ──
   REMOVED: legacy per-feature classes (oc-agent-*) were
   replaced by the ACP-based <AgentsPanel/> which uses
   primitives (<Button/>, <Card/>) + oc-acp-* classes.
   Old block deleted in dead-CSS sweep. ── */

/* ── Command Palette ───────────────────────────────────────── */
${S} .oc-cmd-overlay {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 20vh; background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
}
${S} .oc-cmd-panel {
  width: 520px; max-height: 420px; border-radius: 12px;
  border: 1px solid var(--border-subtle); background: var(--surface-floor);
  box-shadow: var(--shadow-xl); overflow: hidden;
  display: flex; flex-direction: column;
}
${S} .oc-cmd-input {
  width: 100%; padding: 14px 16px; border: none;
  background: transparent; color: var(--text-on-surface);
  font-size: 15px; font-family: var(--font-ui); outline: none;
  flex-shrink: 0;
}
${S} .oc-cmd-input::placeholder { color: var(--text-disabled); }
${S} .oc-cmd-divider {
  height: 1px; background: var(--border-subtle); flex-shrink: 0;
}
${S} .oc-cmd-list {
  overflow-y: auto; padding: 6px 0; flex: 1; min-height: 0;
}
${S} .oc-cmd-category {
  padding: 8px 16px 4px; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-muted);
}
${S} .oc-cmd-item {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 8px 16px; cursor: pointer;
  color: var(--text-on-surface-variant); font-size: 13px;
  transition: background 0.1s ease;
}
${S} .oc-cmd-item:hover { background: var(--surface-1); color: var(--text-on-surface); }
${S} .oc-cmd-item.is-active { background: var(--surface-1); color: var(--text-on-surface); }
${S} .oc-cmd-label { flex: 1; }
${S} .oc-cmd-kbd {
  padding: 2px 6px; border-radius: 4px; font-size: 10px;
  background: var(--surface-1); color: var(--text-muted);
  font-family: var(--font-mono);
}
${S} .oc-cmd-empty {
  padding: 24px 16px; text-align: center;
  color: var(--text-disabled); font-size: 13px;
}

/* ── Inline Edit (Cmd+K) ──────────────────────────────────── */
${S} .oc-inline-edit {
  width: 360px; border-radius: 12px; z-index: 110;
  border: 1px solid var(--border-subtle);
  background: var(--surface-floor);
  box-shadow: var(--shadow-xl); overflow: hidden;
  animation: oc-inline-edit-in 0.15s ease-out;
}
@keyframes oc-inline-edit-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
${S} .oc-inline-edit-input-row {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
}
${S} .oc-inline-edit-icon { flex-shrink: 0; color: var(--text-muted); }
${S} .oc-inline-edit-input {
  flex: 1; border: none; background: transparent;
  color: var(--text-on-surface); font-size: 13px;
  font-family: var(--font-ui); outline: none;
}
${S} .oc-inline-edit-input::placeholder { color: var(--text-disabled); }
${S} .oc-inline-edit-kbd {
  flex-shrink: 0; padding: 2px 6px; border-radius: 4px;
  font-size: 10px; background: var(--surface-1);
  color: var(--text-muted); font-family: var(--font-mono);
}
@keyframes oc-spin { to { transform: rotate(360deg); } }

/* ── Visual Diff ──────────────────────────────────────────── */
${S} .oc-vdiff-overlay {
  position: fixed; inset: 0; z-index: 105;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
}
${S} .oc-vdiff-modal {
  width: 90vw; max-width: 1100px; height: 80vh;
  border-radius: 12px; overflow: hidden;
  border: 1px solid var(--border-subtle);
  background: var(--surface-floor);
  box-shadow: var(--shadow-xl);
  display: flex; flex-direction: column;
}
${S} .oc-vdiff-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
${S} .oc-vdiff-header-left { display: flex; align-items: center; gap: 10px; }
${S} .oc-vdiff-title { font-size: 15px; font-weight: 600; color: var(--text-on-surface); }
${S} .oc-vdiff-variant-name {
  font-size: 12px; color: var(--text-muted);
  padding: 2px 8px; border-radius: 4px; background: var(--surface-1);
}
${S} .oc-vdiff-body { flex: 1; position: relative; overflow: hidden; background: var(--surface-1); }
${S} .oc-vdiff-pane { position: absolute; inset: 0; }
${S} .oc-vdiff-label {
  position: absolute; top: 12px; z-index: 2;
  padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
}
${S} .oc-vdiff-label-before { left: 12px; background: var(--status-critical); color: #fff; }
${S} .oc-vdiff-label-after { right: 12px; background: var(--status-success); color: #fff; }
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
  background: var(--surface-1);
}
${S} .oc-vc-flow {
  background: var(--surface-1);
}
${S} .oc-vc-flow .react-flow__pane {
  background: var(--surface-1);
}
${S} .oc-vc-controls {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
}

/* ══════════════════════════════════════════════════════════
   Themes Page
   ══════════════════════════════════════════════════════════ */

${S} .oc-themes-page {
  flex: 1; height: 100%; display: flex; flex-direction: column;
  background: var(--surface-0);
  overflow: hidden;
}

/* ── Empty state ─────────────────────────────────────────── */
${S} .oc-themes-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; padding: 32px;
}
${S} .oc-themes-empty-icon {
  color: var(--text-disabled);
  margin-bottom: 8px;
}
${S} .oc-themes-empty-title {
  font-size: 18px; font-weight: 600;
  color: var(--text-on-surface);
}
${S} .oc-themes-empty-desc {
  font-size: 13px; color: var(--text-muted);
  text-align: center; max-width: 320px;
}

/* ── File bar ────────────────────────────────────────────── */
${S} .oc-themes-file-bar {
  display: flex; align-items: center; justify-content: space-between;
  height: 40px; padding: 0 8px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-floor);
  flex-shrink: 0;
}
${S} .oc-themes-file-tabs {
  display: flex; align-items: center; gap: 2px;
  overflow-x: auto;
}
${S} .oc-themes-file-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; border: none;
  background: transparent; color: var(--text-muted);
  font-size: 12px; border-radius: 6px;
  cursor: pointer; transition: all 0.15s ease;
  white-space: nowrap;
}
${S} .oc-themes-file-tab:hover {
  background: var(--surface-1);
  color: var(--text-on-surface);
}
${S} .oc-themes-file-tab.is-active {
  background: var(--surface-1);
  color: var(--text-on-surface);
}
${S} .oc-themes-file-tab-close {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border: none;
  background: transparent; color: var(--text-disabled);
  border-radius: 4px; cursor: pointer;
  opacity: 0; transition: opacity 0.1s ease;
}
${S} .oc-themes-file-tab:hover .oc-themes-file-tab-close { opacity: 1; }
${S} .oc-themes-file-tab-close:hover {
  background: var(--surface-2);
  color: var(--text-on-surface);
}
${S} .oc-themes-file-actions {
  display: flex; align-items: center; gap: 2px;
}

/* ── Paste bar ───────────────────────────────────────────── */
${S} .oc-themes-paste-bar {
  padding: 12px; border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-floor);
  flex-shrink: 0;
}
${S} .oc-themes-paste-input {
  width: 100%; padding: 8px 10px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-on-surface);
  font-family: 'Fira Code', monospace; font-size: 12px;
  resize: vertical; outline: none;
}
${S} .oc-themes-paste-input:focus {
  border-color: var(--primary);
}
${S} .oc-themes-paste-actions {
  display: flex; gap: 8px; justify-content: flex-end;
  margin-top: 8px;
}

/* ── Toolbar / Search ────────────────────────────────────── */
${S} .oc-themes-toolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
${S} .oc-themes-search {
  display: flex; align-items: center; gap: 6px;
  flex: 1; max-width: 400px;
  padding: 6px 10px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-muted);
}
${S} .oc-themes-search input {
  flex: 1; border: none; background: transparent;
  color: var(--text-on-surface); font-size: 13px;
  outline: none;
}
${S} .oc-themes-search input::placeholder { color: var(--text-disabled); }

/* ── Selection bar ───────────────────────────────────────── */
${S} .oc-themes-selection-bar {
  display: flex; align-items: center; gap: 4px;
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
  background: var(--surface-0);
}
${S} .oc-themes-table th {
  padding: 8px 12px; text-align: left;
  font-weight: 600; font-size: 12px;
  color: var(--text-on-surface);
  border-bottom: 1px solid var(--border-subtle);
  border-right: 1px solid var(--border-subtle);
  white-space: nowrap;
  vertical-align: middle;
}
${S} .oc-themes-table th:last-child {
  border-right: none;
}
${S} .oc-themes-table td {
  border-right: 1px solid var(--border-subtle);
}
${S} .oc-themes-table td:last-child {
  border-right: none;
}
${S} .oc-themes-th-check {
  width: 36px; text-align: center !important;
}
${S} .oc-themes-th-check input[type="checkbox"],
${S} .oc-themes-th-check input[type="checkbox"],
${S} .oc-themes-th-check input[type="checkbox"],
${S} .oc-themes-th-check input[type="checkbox"],
${S} .oc-themes-td-check input[type="checkbox"] {
  width: 14px; height: 14px;
  accent-color: var(--primary);
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
  background: var(--surface-2);
  color: var(--text-on-surface);
}

/* ── Header buttons ──────────────────────────────────────── */

/* ── Group row ───────────────────────────────────────────── */
${S} .oc-themes-group-row td {
  padding: 6px 12px;
  background: var(--surface-floor);
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-themes-group-label {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-muted);
}
${S} .oc-themes-group-count {
  margin-left: 6px; font-size: 10px;
  color: var(--text-disabled);
}

/* ── Token row ───────────────────────────────────────────── */
${S} .oc-themes-token-row td {
  padding: 0 12px; height: 40px;
  border-bottom: 1px solid var(--border-subtle);
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
  color: var(--text-on-surface);
}
${S} .oc-themes-td-value { position: relative; }

/* ── Value cell ──────────────────────────────────────────── */
${S} .oc-theme-value-cell {
  display: flex; align-items: center; gap: 8px;
  height: 100%;
}
${S} .oc-theme-color-swatch {
  width: 16px; height: 16px; flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid var(--border-default);
}
${S} .oc-theme-color-swatch.is-clickable {
  cursor: pointer;
}
${S} .oc-theme-color-swatch.is-clickable:hover {
  border-color: var(--primary);
}
${S} .oc-theme-value-text {
  font-size: 12px;
  color: var(--text-on-surface);
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; cursor: default;
}
${S} .oc-theme-value-empty {
  color: var(--text-disabled);
}
${S} .oc-theme-value-input {
  flex: 1; border: 1px solid var(--primary);
  background: var(--surface-1);
  color: var(--text-on-surface);
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
  padding: 1px 5px; border-radius: 4px;
  background: var(--surface-2);
  color: var(--text-on-surface-variant);
}

/* ── Add variable dropdown ───────────────────────────────── */
${S} .oc-theme-add-var { position: relative; }
${S} .oc-theme-add-dropdown {
  position: absolute; top: 100%; left: 0; z-index: 50;
  min-width: 180px; padding: 4px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  box-shadow: 0 8px 24px var(--backdrop-weak);
  margin-top: 4px;
}
${S} .oc-theme-add-dropdown-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px; border: none;
  background: transparent; color: var(--text-on-surface);
  font-size: 13px; border-radius: 6px;
  cursor: pointer; text-align: left;
}
${S} .oc-theme-add-dropdown-item:hover {
  background: var(--surface-2);
}

/* ── Group hint ──────────────────────────────────────────── */
${S} .oc-themes-group-hint {
  padding: 24px; text-align: center;
  font-size: 12px; color: var(--text-disabled);
  line-height: 1.6;
}

/* ══════════════════════════════════════════════════════════
   Color Picker
   ══════════════════════════════════════════════════════════ */

${S} .oc-color-picker {
  width: 240px; padding: 10px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  box-shadow: 0 12px 32px var(--backdrop-weak);
}
${S} .oc-color-picker-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
${S} .oc-color-picker-name {
  font-size: 12px; font-weight: 600;
  color: var(--text-on-surface);
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap;
}
${S} .oc-color-picker-hex-row {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 8px;
}
${S} .oc-color-picker-swatch {
  width: 24px; height: 24px; flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid var(--border-default);
}
${S} .oc-color-picker-hex-input {
  flex: 1; padding: 4px 8px;
  background: var(--surface-0);
  border: 1px solid var(--border-default);
  border-radius: 4px; color: var(--text-on-surface);
  font-family: 'Fira Code', monospace; font-size: 12px;
  outline: none;
}
${S} .oc-color-picker-hex-input:focus {
  border-color: var(--primary);
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
  font-size: 10px; color: var(--text-muted);
}
${S} .oc-color-picker-value-group input {
  width: 100%; padding: 3px 6px;
  background: var(--surface-0);
  border: 1px solid var(--border-default);
  border-radius: 4px; color: var(--text-on-surface);
  font-size: 12px; outline: none;
}
${S} .oc-color-picker-value-group input:focus {
  border-color: var(--primary);
}

/* ══════════════════════════════════════════════════════════
   Variable Detail Panel
   ══════════════════════════════════════════════════════════ */

${S} .oc-themes-detail-slot {
  width: 280px; flex-shrink: 0;
  border-left: 1px solid var(--border-subtle);
  overflow-y: auto;
}
${S} .oc-theme-detail-panel {
  display: flex; flex-direction: column;
  height: 100%;
}
${S} .oc-theme-detail-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-theme-detail-title {
  flex: 1; font-size: 13px; font-weight: 600;
  color: var(--text-on-surface);
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap;
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
  color: var(--text-muted);
}
${S} .oc-theme-detail-field input {
  padding: 6px 10px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-on-surface);
  font-size: 13px; outline: none;
}
${S} .oc-theme-detail-field input:focus {
  border-color: var(--primary);
}
${S} .oc-theme-detail-select {
  position: relative; display: flex;
  align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-on-surface);
  font-size: 13px; cursor: pointer;
}
${S} .oc-theme-detail-dropdown {
  position: absolute; top: 100%; left: 0; right: 0;
  z-index: 50; margin-top: 4px; padding: 4px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  box-shadow: 0 8px 24px var(--backdrop-weak);
}
${S} .oc-theme-detail-dropdown-item {
  display: block; width: 100%;
  padding: 6px 10px; border: none;
  background: transparent; color: var(--text-on-surface);
  font-size: 13px; border-radius: 6px;
  cursor: pointer; text-align: left;
}
${S} .oc-theme-detail-dropdown-item:hover {
  background: var(--surface-2);
}
${S} .oc-theme-detail-dropdown-item.is-active {
  background: rgba(37, 99, 235, 0.12);
  color: var(--text-primary-light);
}
${S} .oc-theme-detail-divider {
  font-size: 12px; font-weight: 700;
  color: var(--text-on-surface);
  padding: 6px 0; border-top: 1px solid var(--border-subtle);
  margin-top: 2px;
}
${S} .oc-theme-detail-initial {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 6px; font-size: 13px;
  color: var(--text-on-surface);
}
${S} .oc-theme-detail-checkbox {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--border-default);
  border-radius: 4px; background: transparent;
  color: white; cursor: pointer;
  transition: all 0.15s ease;
}
${S} .oc-theme-detail-checkbox.is-checked {
  background: var(--primary);
  border-color: var(--primary);
}
${S} .oc-theme-detail-footer {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 8px; padding: 12px 14px;
  border-top: 1px solid var(--border-subtle);
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
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: 0 20px 60px var(--backdrop-weak);
}
${S} .oc-theme-dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  font-size: 15px; font-weight: 600;
  color: var(--text-on-surface);
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-theme-dialog-header button {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: none;
  background: transparent; color: var(--text-muted);
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
  color: var(--text-muted);
}
${S} .oc-theme-dialog-field input {
  padding: 8px 12px;
  background: var(--surface-0);
  border: 1px solid var(--border-default);
  border-radius: 8px; color: var(--text-on-surface);
  font-size: 13px; outline: none;
}
${S} .oc-theme-dialog-field input:focus {
  border-color: var(--primary);
}
${S} .oc-theme-dialog-preview {
  font-size: 13px; color: var(--text-muted);
  padding: 10px 14px;
  background: var(--surface-0);
  border-radius: 8px;
}
${S} .oc-theme-dialog-preview code {
  color: var(--text-on-surface);
  font-family: 'Fira Code', monospace;
}
${S} .oc-theme-dialog-actions {
  display: flex; gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-subtle);
}

/* ══════════════════════════════════════════════════════════
   Theme Mode Panel (right sidebar)
   ══════════════════════════════════════════════════════════ */

${S} .oc-theme-mode-panel {
  height: 100%; display: flex; flex-direction: column;
  background: var(--surface-0);
  overflow: hidden; min-width: 0;
}
${S} .oc-theme-mode-header-info {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600;
  color: var(--text-on-surface);
}
${S} .oc-theme-mode-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 6px;
  border-radius: 9999px; font-size: 10px; font-weight: 700;
  background: var(--primary); color: var(--text-on-primary);
}
${S} .oc-theme-mode-body {
  flex: 1; height: 0;
}
${S} .oc-theme-mode-section {
  padding: 10px 12px; min-width: 0; overflow: hidden;
}
${S} .oc-theme-mode-section + .oc-theme-mode-section {
  border-top: 1px solid var(--border-subtle);
}
${S} .oc-theme-mode-section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
${S} .oc-theme-mode-section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-muted);
  margin-bottom: 8px;
}
${S} .oc-theme-mode-section-header .oc-theme-mode-section-title {
  margin-bottom: 0;
}

/* ── Search ── */
${S} .oc-theme-mode-search {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 8px; margin-bottom: 8px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-muted);
}
${S} .oc-theme-mode-search input {
  flex: 1; border: none; background: transparent;
  color: var(--text-on-surface); font-size: 11px; outline: none;
}
${S} .oc-theme-mode-search input::placeholder { color: var(--text-disabled); }

/* ── Token list ── */
${S} .oc-theme-mode-token-list {
  max-height: 280px; overflow-y: auto;
}
${S} .oc-theme-mode-group-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-disabled);
  padding: 4px 0 2px;
}
${S} .oc-theme-mode-token-row {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 4px; border-radius: 4px;
  cursor: default; transition: background 0.1s;
}
${S} .oc-theme-mode-token-row:hover {
  background: var(--surface-1);
}
${S} .oc-theme-mode-token-swatch {
  width: 14px; height: 14px; flex-shrink: 0;
  border-radius: 4px; border: 1px solid var(--border-default);
}
${S} .oc-theme-mode-token-swatch.is-small {
  width: 10px; height: 10px; border-radius: 4px;
}
${S} .oc-theme-mode-token-name {
  font-family: 'Fira Code', monospace;
  font-size: 10px; color: var(--text-on-surface);
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-theme-mode-token-value {
  font-size: 10px; color: var(--text-disabled);
  font-family: 'Fira Code', monospace; flex-shrink: 0;
}

/* ── Empty state ── */
${S} .oc-theme-mode-empty {
  padding: 16px 0; text-align: center;
}
${S} .oc-theme-mode-empty-text {
  font-size: 11px; color: var(--text-muted);
  line-height: 1.5; padding: 8px 0;
}
${S} .oc-theme-mode-empty-text.is-small {
  font-size: 10px; color: var(--text-disabled);
  padding: 4px 0;
}
${S} .oc-theme-mode-empty-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 14px; border: none; margin-top: 8px;
  background: var(--surface-1); color: var(--text-on-surface);
  border-radius: 6px; font-size: 11px; cursor: pointer;
}
${S} .oc-theme-mode-empty-btn:hover {
  background: var(--surface-2);
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
  background: var(--surface-1);
}
${S} .oc-theme-mode-change-num {
  display: flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; flex-shrink: 0;
  border-radius: 50%; font-size: 10px; font-weight: 700;
  background: var(--primary); color: var(--text-on-primary);
}
${S} .oc-theme-mode-change-info {
  flex: 1; min-width: 0; overflow: hidden;
}
${S} .oc-theme-mode-change-selector {
  font-size: 11px; font-weight: 600;
  color: var(--text-on-surface);
  font-family: 'Fira Code', monospace;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-theme-mode-change-detail {
  display: flex; align-items: center; gap: 4px;
  margin-top: 2px; min-width: 0; overflow: hidden;
}
${S} .oc-theme-mode-change-prop {
  font-size: 10px; color: var(--text-muted);
  font-family: 'Fira Code', monospace;
}
${S} .oc-theme-mode-change-token {
  font-size: 10px; color: var(--text-primary-light);
  font-family: 'Fira Code', monospace;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Footer ── */
${S} .oc-theme-mode-footer {
  padding: 10px 12px;
  border-top: 1px solid var(--border-subtle);
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
  padding: 6px 10px; border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-style-search-icon { color: var(--text-muted); flex-shrink: 0; }
${S} .oc-style-search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--text-on-surface); font-size: 11px;
  font-family: var(--font-mono); padding: 2px 0;
}
${S} .oc-style-search-input::placeholder { color: var(--text-muted); }

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
  padding: 1px 5px; border-radius: 4px; font-size: 10px;
  font-family: var(--font-mono); background: var(--surface-1);
  border: 1px solid var(--border-default);
  color: var(--text-on-surface);
}
${S} .oc-tw-chip-custom { opacity: 0.6; }
${S} .oc-tw-chip-text { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${S} .oc-tw-chip-remove {
  display: flex; align-items: center; justify-content: center;
  width: 12px; height: 12px; border: none; background: transparent;
  color: var(--text-muted); cursor: pointer; border-radius: 4px;
  padding: 0;
}
${S} .oc-tw-chip-remove:hover { background: rgba(239,68,68,0.2); color: #ef4444; }

${S} .oc-tw-add-area { margin-top: 4px; }
${S} .oc-tw-search-row {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 6px; border: 1px solid var(--border-default);
  border-radius: 4px; background: var(--surface-1);
}
${S} .oc-tw-search-icon { color: var(--text-muted); flex-shrink: 0; }
${S} .oc-tw-search-input {
  flex: 1; border: none; outline: none; background: transparent;
  color: var(--text-on-surface); font-size: 10px;
  font-family: var(--font-mono);
}
${S} .oc-tw-search-input::placeholder { color: var(--text-muted); }
${S} .oc-tw-suggestions {
  border: 1px solid var(--border-default); border-top: none;
  border-radius: 0 0 4px 4px; background: var(--surface-1);
  max-height: 160px; overflow-y: auto;
}
${S} .oc-tw-suggestion {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 4px 8px; border: none; background: transparent;
  color: var(--text-on-surface); font-size: 10px;
  font-family: var(--font-mono); cursor: pointer; text-align: left;
}
${S} .oc-tw-suggestion:hover { background: rgba(255,255,255,0.04); }
${S} .oc-tw-suggestion-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
${S} .oc-tw-suggestion-prop {
  margin-left: auto; font-size: 10px; color: var(--text-muted);
}

${S} .oc-breakpoint-badge {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  padding: 1px 6px; border-radius: 4px; letter-spacing: 0.3px;
  background: rgba(234,179,8,0.15); color: #eab308;
}
${S} .oc-style-swatch-clickable { cursor: pointer; }
${S} .oc-style-swatch-clickable:hover { box-shadow: 0 0 0 2px var(--ring); }

/* ── Color Editor ── */
${S} .oc-color-editor {
  border-bottom: 1px solid var(--border-subtle);
  padding: 8px 12px;
}
${S} .oc-color-editor-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
${S} .oc-color-editor-label {
  font-size: 11px; font-family: var(--font-mono);
  color: var(--text-on-surface-variant);
}
${S} .oc-color-editor-status {
  display: flex; align-items: center; gap: 6px;
}
${S} .oc-color-editor-badge {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
}
${S} .oc-badge-writing { color: var(--text-on-surface-variant); }
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
${S}$ {S}
${S}$ {S}
${S} .oc-spacing-middle {
  display: flex; align-items: stretch; justify-content: center;
}
${S} .oc-spacing-value {
  cursor: pointer; padding: 1px 4px; border-radius: 4px;
  transition: background 0.15s;
}
${S} .oc-spacing-value:hover { background: rgba(255,255,255,0.08); }
${S} .oc-spacing-input {
  width: 36px; text-align: center; padding: 1px 2px;
  background: var(--surface-0); border: 1px solid var(--ring);
  border-radius: 4px; color: var(--text-on-surface);
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
  font-size: 10px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.5px;
}
${S} .oc-typo-select {
  background: var(--surface-1); border: 1px solid var(--border-default);
  border-radius: 4px; padding: 4px 6px; color: var(--text-on-surface);
  font-size: 11px; font-family: var(--font-mono); outline: none;
  cursor: pointer; width: 100%;
}
${S} .oc-typo-select:focus { border-color: var(--ring); }
${S} .oc-typo-input {
  background: var(--surface-1); border: 1px solid var(--border-default);
  border-radius: 4px; padding: 4px 6px; color: var(--text-on-surface);
  font-size: 11px; font-family: var(--font-mono); outline: none;
  width: 100%;
}
${S} .oc-typo-input:focus { border-color: var(--ring); }
${S} .oc-typo-value {
  cursor: pointer; padding: 4px 6px; border-radius: 4px;
  font-size: 11px; font-family: var(--font-mono);
  color: var(--text-on-surface);
  background: var(--surface-1); border: 1px solid transparent;
  transition: border-color 0.15s;
}
${S} .oc-typo-value:hover { border-color: var(--border-default); }
${S} .oc-typo-align-group {
  display: flex; gap: 2px;
}
${S} .oc-typo-align-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: 1px solid var(--border-default);
  border-radius: 4px; background: var(--surface-1);
  color: var(--text-on-surface-variant); cursor: pointer;
  transition: all 0.15s;
}
${S} .oc-typo-align-btn:hover {
  background: var(--surface-2);
  color: var(--text-on-surface);
}
${S} .oc-typo-align-btn.is-active {
  background: var(--primary);
  color: var(--text-on-primary);
  border-color: var(--primary);
}
${S} .oc-typo-color-row {
  display: flex; align-items: center; gap: 6px;
}

/* ── Feedback Panel ── */
${S} .oc-feedback-item {
  padding: 8px 0; border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-feedback-item-header {
  display: flex; gap: 4px; margin-bottom: 4px;
}
${S} .oc-feedback-badge {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  padding: 1px 6px; border-radius: 4px; letter-spacing: 0.3px;
  background: var(--surface-2); color: var(--text-on-surface-variant);
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
  color: var(--text-muted);
}
${S} .oc-feedback-comment {
  font-size: 12px; color: var(--text-on-surface);
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
  font-size: 10px; color: var(--text-muted);
  min-width: 50px; flex-shrink: 0;
}
${S} .oc-editor-inline { display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0; }
${S} .oc-editor-value {
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-on-surface-variant);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Segmented Control ── */
${S} .oc-segmented {
  display: inline-flex; border-radius: 6px; overflow: hidden;
  border: 1px solid var(--border-default);
  background: var(--surface-1);
}
${S} .oc-segmented-btn {
  border: none; background: transparent;
  color: var(--text-on-surface-variant);
  cursor: pointer; transition: all 0.12s;
  display: flex; align-items: center; justify-content: center;
  white-space: nowrap; font-weight: 500;
}
${S} .oc-segmented-btn:hover {
  color: var(--text-on-surface);
  background: rgba(255,255,255,0.04);
}
${S} .oc-segmented-btn.is-active {
  background: var(--primary);
  color: var(--text-on-primary);
}

/* ── NumberInputWithUnit ── */
${S} .oc-num-field { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
${S} .oc-num-label {
  font-size: 10px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.4px;
}
${S} .oc-num-row { display: flex; align-items: center; gap: 2px; }
${S} .oc-num-input {
  flex: 1; min-width: 0; width: 100%;
  background: var(--surface-0); border: 1px solid var(--ring);
  border-radius: 4px; padding: 2px 4px;
  color: var(--text-on-surface);
  font-size: 10px; font-family: var(--font-mono); outline: none;
  text-align: center;
}
${S} .oc-num-value {
  flex: 1; text-align: center; cursor: pointer;
  padding: 2px 4px; border-radius: 4px;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-on-surface);
  background: var(--surface-1);
  border: 1px solid transparent; transition: border-color 0.12s;
}
${S} .oc-num-value:hover { border-color: var(--border-default); }
${S} .oc-num-unit {
  background: var(--surface-1); border: 1px solid var(--border-default);
  border-radius: 4px; padding: 2px 2px;
  color: var(--text-muted); font-size: 10px; outline: none;
  cursor: pointer;
}
${S} .oc-num-unit-label {
  font-size: 10px; color: var(--text-muted); padding: 0 2px;
}

/* ── SliderInput ── */
${S} .oc-slider-field { display: flex; flex-direction: column; gap: 2px; }
${S} .oc-slider-label {
  font-size: 10px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.4px;
}
${S} .oc-slider-row { display: flex; align-items: center; gap: 6px; }
${S} .oc-slider-track {
  flex: 1; height: 4px; -webkit-appearance: none; appearance: none;
  border-radius: 4px; outline: none; cursor: pointer;
}
${S} .oc-slider-track::-webkit-slider-thumb {
  -webkit-appearance: none; width: 12px; height: 12px;
  border-radius: 50%; background: var(--text-on-surface);
  border: 2px solid var(--surface-0); cursor: grab;
}
${S} .oc-slider-value {
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-on-surface-variant);
  min-width: 32px; text-align: right;
}

/* ── Toggle button (small) ── */
${S} .oc-toggle-btn-sm {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: 1px solid var(--border-default);
  border-radius: 4px; background: var(--surface-1);
  color: var(--text-on-surface-variant); cursor: pointer;
  transition: all 0.12s;
}
${S} .oc-toggle-btn-sm:hover { background: var(--surface-2); }
${S} .oc-toggle-btn-sm.is-active {
  background: var(--primary);
  color: var(--text-on-primary);
  border-color: var(--primary);
}

/* ── 9-dot Alignment Grid ── */
${S} .oc-align-grid {
  display: flex; flex-direction: column; gap: 3px;
  padding: 6px; border: 1px solid var(--border-default);
  border-radius: 6px; background: var(--surface-1);
  width: fit-content;
}
${S} .oc-align-grid-row { display: flex; gap: 3px; }
${S} .oc-align-dot {
  width: 16px; height: 16px; border-radius: 4px;
  border: 1.5px solid var(--border-default);
  background: transparent; cursor: pointer;
  transition: all 0.12s; position: relative;
}
${S} .oc-align-dot::after {
  content: ""; position: absolute; inset: 3px;
  border-radius: 4px; background: var(--text-muted);
  opacity: 0.3;
}
${S} .oc-align-dot:hover { border-color: var(--text-on-surface-variant); }
${S} .oc-align-dot:hover::after { opacity: 0.6; }
${S} .oc-align-dot.is-active {
  border-color: var(--primary);
  background: rgba(37,99,235,0.1);
}
${S} .oc-align-dot.is-active::after {
  background: var(--primary); opacity: 1;
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
  border: 1.5px solid var(--border-default);
  background: var(--surface-1);
  display: flex; align-items: center; justify-content: center;
}
${S} .oc-radius-preview-label {
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-muted);
}
${S} .oc-radius-value {
  cursor: pointer; padding: 2px 6px; border-radius: 4px;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-on-surface);
  background: var(--surface-1);
  border: 1px solid transparent; transition: border-color 0.12s;
}
${S} .oc-radius-value:hover { border-color: var(--border-default); }
${S} .oc-radius-input {
  width: 36px; text-align: center; padding: 2px;
  background: var(--surface-0); border: 1px solid var(--ring);
  border-radius: 4px; color: var(--text-on-surface);
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

${S} .oc-ai-messages {
  display: flex; flex-direction: column; gap: 14px;
  padding: 16px; min-height: 100px;
}

${S} .oc-ai-msg {
  display: flex; gap: 10px; align-items: flex-start;
}
${S} .oc-ai-msg-icon {
  width: 22px; height: 22px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 11px; font-weight: 600;
}
${S} .oc-ai-msg-content {
  font-size: 13px; line-height: 1.55;
  color: var(--text-on-surface);
  flex: 1; min-width: 0;
  padding-top: 2px;
}

${S} .oc-ai-pending {
  display: flex; align-items: center; gap: 6px;
  color: var(--text-muted); font-style: italic;
}
${S} .oc-ai-spinner { animation: oc-spin 1s linear infinite; }
@keyframes oc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

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
  color: var(--text-on-surface);
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
  border: none; border-radius: 9999px;
  color: var(--text-on-surface);
  font-family: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease;
}
${S} .oc-chat-headerbtn:hover { background: rgba(255,255,255,0.07); }
${S} .oc-chat-headerbtn-caret { color: var(--text-muted); }

/* ── Body + empty state ────────────────────────────────── */
${S} .oc-chat-body { padding: 0; }
${S} .oc-chat-empty {
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  padding: 64px 24px;
}
${S} .oc-chat-empty-title {
  margin: 0; font-size: 15px; font-weight: 500;
  color: var(--text-muted);
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
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  padding: 6px;
  display: flex; flex-direction: column; gap: 1px;
  max-height: 360px; overflow-y: auto;
  z-index: 25;
}
${S} .oc-slash-item {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 10px;
  background: transparent; border: none;
  border-radius: 6px;
  color: var(--text-on-surface);
  font-family: inherit; font-size: 12px;
  text-align: left; cursor: pointer;
}
${S} .oc-slash-item:hover,
${S} .oc-slash-item:hover,
${S} .oc-slash-item:hover,
${S} .oc-slash-item:hover,
${S} .oc-slash-item.is-active {
  background: rgba(255, 255, 255, 0.06);
}
${S} .oc-slash-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-on-surface);
  min-width: 80px;
  padding: 0; background: none;
}
${S} .oc-slash-desc {
  color: var(--text-muted);
  font-size: 11px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-slash-footer {
  display: flex; gap: 12px;
  padding: 6px 10px 2px;
  border-top: 1px solid var(--border-subtle);
  margin-top: 4px;
  font-size: 10px; color: var(--text-muted);
}

${S} .oc-chat-composer-card {
  background: var(--surface-1);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  transition: border-color 120ms ease;
  /* Intentionally not overflow:hidden — the toolbar's dropdown
   * menus (Effort / Permission / Model) anchor inside the card and
   * need to escape its bounds to render fully. */
}
${S} .oc-chat-composer-card:focus-within {
  border-color: rgba(59,130,246,0.35);
}
${S} .oc-chat-composer-input {
  width: 100%; box-sizing: border-box;
  background: transparent; border: none;
  padding: 12px 14px 4px;
  color: var(--text-on-surface);
  font-family: inherit; font-size: 13px; line-height: 1.5;
  outline: none; resize: none;
  min-height: 20px; max-height: 200px;
}
${S} .oc-chat-composer-input::placeholder { color: var(--text-muted); }
${S} .oc-chat-composer-input:disabled { opacity: 0.6; }

${S} .oc-chat-composer-toolbar {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 8px 8px;
  flex-wrap: wrap;
}
${S} .oc-chat-toolbar-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px;
  background: transparent; border: none; border-radius: 8px;
  color: var(--text-on-surface-variant);
  font-family: inherit; font-size: 11px; font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-chat-toolbar-pill:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text-on-surface);
}
${S} .oc-chat-toolbar-pill.is-skill {
  padding-left: 5px; gap: 6px;
}
${S} .oc-chat-toolbar-caret {
  color: var(--text-muted);
  opacity: 0.7;
}
${S} .oc-chat-skill-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 6px;
  background: rgba(59,130,246,0.18);
  color: var(--text-primary-light);
  font-size: 10px; font-weight: 700;
  font-family: var(--font-mono);
}
${S} .oc-chat-toolbar-spacer { flex: 1; }

/* ── Skill picker dropdown (Phase 4-H) ─────────────────── */
${S} .oc-chat-skill-root { position: relative; }
${S} .oc-chat-skill-menu {
  position: absolute;
  bottom: calc(100% + 6px); left: 0;
  min-width: 260px; max-width: 340px;
  z-index: 30;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 8px;
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
  color: var(--text-on-surface);
  font-family: inherit; text-align: left;
  cursor: pointer;
}
${S} .oc-chat-skill-item:hover,
${S} .oc-chat-skill-item:hover,
${S} .oc-chat-skill-item:hover,
${S} .oc-chat-skill-item:hover,
${S} .oc-chat-skill-item.is-active {
  background: rgba(255, 255, 255, 0.06);
}
${S} .oc-chat-skill-item.is-active {
  color: var(--text-primary-light);
}
${S} .oc-chat-skill-item-name {
  font-size: 13px; font-weight: 500;
}
${S} .oc-chat-skill-item-desc {
  font-size: 11px; color: var(--text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-chat-skill-empty {
  margin: 0; padding: 10px 12px;
  font-size: 12px; color: var(--text-muted); line-height: 1.4;
}
${S} .oc-chat-skill-empty code {
  padding: 1px 5px;
  background: var(--surface-0);
  border-radius: 4px;
  font-family: var(--font-mono); font-size: 10px;
}

/* ── Generic chat dropdown pill (Stream 5) ───────────────── */
/* Direction modifiers on the root control which side of the trigger
 * the menu opens on. Default = upward (good for composer/footer
 * pills). .is-top opens downward (chat-header buttons). .is-right
 * aligns to the trigger's right edge (buttons on the right side of
 * their container). */
${S} .oc-chat-dropdown-root { position: relative; }
${S} .oc-chat-dropdown-menu {
  position: absolute;
  bottom: calc(100% + 6px); left: 0;
  min-width: 200px; max-width: 320px;
  max-height: 60vh; overflow-y: auto;
  z-index: 30;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  padding: 4px;
  display: flex; flex-direction: column; gap: 1px;
}
${S} .oc-chat-dropdown-root.is-footer .oc-chat-dropdown-menu {
  bottom: calc(100% + 6px); left: 0; right: auto;
}
${S} .oc-chat-dropdown-root.is-top .oc-chat-dropdown-menu {
  bottom: auto; top: calc(100% + 6px);
}
${S} .oc-chat-dropdown-root.is-right .oc-chat-dropdown-menu {
  left: auto; right: 0;
}
${S} .oc-chat-dropdown-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 6px 10px;
  background: transparent; border: none;
  border-radius: 6px;
  color: var(--text-on-surface);
  font-family: inherit; text-align: left;
  cursor: pointer;
  position: relative;
  padding-right: 24px;
}
${S} .oc-chat-dropdown-item:hover { background: rgba(255, 255, 255, 0.06); }
${S} .oc-chat-dropdown-item.is-active {
  background: rgba(59, 130, 246, 0.12);
  color: var(--text-primary-light);
}
${S} .oc-chat-dropdown-item-label { font-size: 12px; font-weight: 500; line-height: 1.3; }
${S} .oc-chat-dropdown-item-hint {
  font-size: 11px; color: var(--text-muted); line-height: 1.3;
}
${S} .oc-chat-dropdown-item-check {
  position: absolute; right: 8px; top: 8px;
  color: var(--text-primary-light);
}
${S} .oc-chat-dropdown-item-row {
  display: inline-flex; align-items: center; gap: 8px;
  min-width: 0;
}
${S} .oc-chat-dropdown-divider {
  height: 1px; background: var(--border-subtle);
  margin: 4px 2px;
}
${S} .oc-chat-dropdown-section-label {
  padding: 4px 10px;
  font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-muted);
}
${S} .oc-chat-dropdown-badge {
  display: inline-flex; align-items: center;
  padding: 1px 5px; border-radius: 4px;
  background: var(--status-warning);
  color: var(--text-on-primary);
  font-size: 10px; font-weight: 700; letter-spacing: 0.03em;
}
${S} .oc-chat-model-menu {
  min-width: 240px;
}
${S} .oc-chat-dropdown-empty {
  padding: 10px 12px;
  font-size: 11px; color: var(--text-muted); line-height: 1.4;
}

/* ── Footer: branch + plan + token meter ──────────────── */
${S} .oc-chat-footer {
  display: flex; align-items: center; gap: 2px;
  padding: 6px 12px 10px;
}
${S} .oc-chat-footer-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 8px;
  background: transparent; border: none; border-radius: 6px;
  color: var(--text-muted);
  font-family: inherit; font-size: 11px; font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-chat-footer-pill:hover {
  background: rgba(255,255,255,0.04);
  color: var(--text-on-surface);
}
${S} .oc-chat-footer-spacer { flex: 1; }
${S} .oc-chat-token-meter {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 500;
  color: var(--text-muted);
  padding: 0 4px;
}
${S} .oc-chat-token-dot {
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--text-muted);
  opacity: 0.6;
}

/* ── AI Applied Changes ── */
${S} .oc-ai-applied {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
  margin-top: 8px; padding: 6px 8px; border-radius: 6px;
  background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2);
  font-size: 10px; color: #22c55e;
}

/* ── AI Diff View (C2: Accept/Reject Per Property) ── */
${S} .oc-ai-diff {
  margin: 8px 0; padding: 8px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--surface-1);
  font-size: 11px;
}
${S} .oc-ai-diff-title {
  font-size: 10px; font-weight: 600;
  color: var(--text-on-surface-variant);
  text-transform: uppercase; letter-spacing: 0.3px;
  margin-bottom: 6px; padding-bottom: 4px;
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-ai-diff-row {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 0; cursor: pointer;
  font-family: var(--font-mono); font-size: 10px;
  line-height: 1.4; min-width: 0;
}
${S} .oc-ai-diff-row:hover {
  background: var(--surface-2); border-radius: 4px;
}
${S} .oc-ai-diff-check {
  width: 12px; height: 12px; flex-shrink: 0;
  accent-color: var(--primary);
  cursor: pointer; margin: 0;
}
${S} .oc-ai-diff-prop {
  color: var(--text-on-surface);
  white-space: nowrap; flex-shrink: 0;
  font-weight: 500;
}
${S} .oc-ai-diff-old {
  color: #ef4444; text-decoration: line-through;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 70px;
}
${S} .oc-ai-diff-arrow {
  color: var(--text-muted); flex-shrink: 0;
}
${S} .oc-ai-diff-new {
  color: #22c55e; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 80px;
}
${S} .oc-ai-diff-actions {
  display: flex; gap: 4px; margin-top: 8px;
  padding-top: 6px; border-top: 1px solid var(--border-subtle);
}

/* ── AI Settings ── */
/* The scroll wrapper owns horizontal padding (oc-settings-scroll) —
 * don't double it up here. */
${S} .oc-ai-settings { padding: 0; }
${S} .oc-settings-section-title {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--text-on-surface);
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
  color: var(--text-on-surface);
}

${S} .oc-ai-hint {
  font-size: 11px; color: var(--text-muted);
  line-height: 1.5; margin-bottom: 10px;
}
${S} .oc-ai-hint code {
  font-family: var(--font-mono); font-size: 10px;
  background: var(--surface-2); padding: 1px 5px;
  border-radius: 4px;
}

${S} .oc-ai-field {
  display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px;
}
${S} .oc-ai-field-label {
  font-size: 11px; color: var(--text-on-surface-variant); font-weight: 500;
}

/* ── Phase 2-E settings panels ── */
${S} .oc-settings-panel { padding: 16px; }
${S} .oc-settings-panel p.oc-ai-hint { margin-top: 0; }

${S} .oc-ai-field-hint {
  display: block; margin-top: 4px;
  font-size: 11px; color: var(--text-muted);
  line-height: 1.4;
}

${S} .oc-api-keys__row {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-api-keys__row:last-of-type { border-bottom: none; }
${S} .oc-api-keys__row .oc-ai-field { flex: 1; margin-bottom: 0; }
${S} .oc-api-keys__row-actions {
  display: flex; flex-direction: column; align-items: flex-end;
  gap: 4px; padding-top: 20px;
}
${S} .oc-api-keys__notice {
  font-size: 10px; color: var(--text-muted);
}

${S} .oc-debug-table {
  width: 100%; border-collapse: collapse; margin-top: 12px;
  font-size: 12px;
}
${S} .oc-debug-table th,
${S} .oc-debug-table th,
${S} .oc-debug-table th,
${S} .oc-debug-table th,
${S} .oc-debug-table td {
  padding: 6px 10px; text-align: left;
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-debug-table th {
  font-weight: 500; color: var(--text-muted); width: 150px;
}
${S} .oc-debug-table td code {
  font-family: var(--font-mono); font-size: 11px;
  background: var(--surface-1); padding: 2px 6px;
  border-radius: 4px;
}

/* ── Token Suggestions Dropdown ── */
${S} .oc-token-suggest {
  position: relative; display: inline-flex; align-items: center; flex-shrink: 0;
}
${S} .oc-token-suggest-trigger {
  background: none; border: 1px solid var(--border-default);
  border-radius: 4px; width: 16px; height: 16px; display: flex;
  align-items: center; justify-content: center; cursor: pointer;
  color: var(--text-muted); padding: 0;
  transition: border-color 0.15s, color 0.15s;
}
${S} .oc-token-suggest-trigger:hover {
  border-color: var(--ring);
  color: var(--text-on-surface);
}
${S} .oc-token-suggest-dropdown {
  position: absolute; top: 100%; left: -4px; z-index: 100;
  margin-top: 4px; min-width: 160px; max-width: 200px;
  background: var(--surface-0); border: 1px solid var(--border-default);
  border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.35);
  overflow: hidden;
}
${S} .oc-token-suggest-header {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--text-muted);
  padding: 6px 8px 4px; border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-token-suggest-list {
  max-height: 156px; overflow-y: auto;
}
${S} .oc-token-suggest-item {
  display: flex; align-items: center; gap: 6px;
  width: 100%; padding: 4px 8px; border: none;
  background: none; cursor: pointer; text-align: left;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-on-surface);
  transition: background 0.1s;
}
${S} .oc-token-suggest-item:hover {
  background: var(--surface-1);
}
${S} .oc-token-suggest-swatch {
  width: 12px; height: 12px; border-radius: 4px; flex-shrink: 0;
  border: 1px solid var(--border-default);
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
  margin-top: 2px; background: var(--surface-0);
  border: 1px solid var(--border-default);
  border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.35);
  overflow: hidden; max-height: 156px; overflow-y: auto;
}
${S} .oc-autocomplete-item {
  display: block; width: 100%; padding: 4px 8px; border: none;
  background: none; cursor: pointer; text-align: left;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-on-surface);
  transition: background 0.08s;
}
${S} .oc-autocomplete-item:hover,
${S} .oc-autocomplete-item:hover,
${S} .oc-autocomplete-item:hover,
${S} .oc-autocomplete-item:hover,
${S} .oc-autocomplete-item.is-highlighted {
  background: var(--surface-1);
  color: var(--text-on-surface);
}

/* ── Effects Editor ── */
${S} .oc-effects-editor {
  padding: 6px 10px 8px; display: flex; flex-direction: column; gap: 6px;
}
${S} .oc-effects-row {
  display: flex; align-items: center; gap: 6px; min-height: 24px;
}
${S} .oc-effects-label {
  font-size: 11px; color: var(--text-muted);
  min-width: 44px; flex-shrink: 0;
}
${S} .oc-effects-select {
  flex: 1; min-width: 0; background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 4px; padding: 3px 6px; color: var(--text-on-surface);
  font-size: 10px; font-family: var(--font-mono);
  outline: none; cursor: pointer; appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%23737373' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  padding-right: 20px;
}
${S} .oc-effects-select:focus {
  border-color: var(--ring);
}
${S} .oc-effects-select option {
  background: var(--surface-0); color: var(--text-on-surface);
}

/* ── Toggle Switch ── */

/* ── Auto-send Notification ── */
@keyframes oc-notification-in {
  from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* ═══════════════════════════════════════════════════════════
   ACP (Agent Client Protocol) Beta surface — Phase 2f polish
   ═══════════════════════════════════════════════════════════
   Styles for the ACP chat, agents picker, auth modal, tool cards,
   receipts, permission bar, and mention menu. Rides the same design
   tokens as the legacy oc-chat-* surface so the two modes feel like
   parts of one product, not two bolted-together UIs. Wraps any Tailwind
   utility classes inside the component — structural layout is still
   Tailwind, colors and typography sit on tokens here. */

${S} .oc-acp-surface {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  background: #141414;
  color: var(--text-on-surface);
  font-size: 13px;
}
${S} .oc-acp-subheader {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-acp-subheader-title {
  font-size: 12px; font-weight: 600;
  color: var(--text-on-surface);
  letter-spacing: -0.005em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-acp-subheader-sub {
  font-size: 10.5px;
  color: var(--text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: flex; align-items: center; gap: 6px;
}
${S} .oc-acp-subheader-agent {
  color: var(--text-on-surface-variant);
  font-weight: 500;
}
${S} .oc-acp-subheader-agent + .oc-acp-subheader-status:not(:empty)::before {
  content: "·"; margin: 0 2px 0 -2px; color: var(--text-muted);
}
${S} .oc-acp-subheader-status:empty { display: none; }
${S} .oc-acp-body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 12px;
}

/* ── Plan panel — rendered when the agent emits session/update plan ─ */
${S} .oc-acp-plan {
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(168, 85, 247, 0.04);
}
${S} .oc-acp-plan-head {
  all: unset;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  width: 100%; box-sizing: border-box;
  font-size: 11px; color: var(--text-muted);
}
${S} .oc-acp-plan-head:hover { background: rgba(168, 85, 247, 0.08); }
${S} .oc-acp-plan-title {
  font-weight: 600;
  color: rgba(216, 180, 254, 0.9);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  font-size: 10px;
}
${S} .oc-acp-plan-count {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  color: var(--text-hint);
}
${S} .oc-acp-plan-list {
  list-style: none; margin: 0; padding: 0 12px 10px;
  display: flex; flex-direction: column; gap: 4px;
}
${S} .oc-acp-plan-item {
  display: flex; gap: 8px; align-items: flex-start;
  font-size: 12px; line-height: 1.45;
  color: var(--text-on-surface);
  padding: 3px 0;
}
${S} .oc-acp-plan-bullet {
  flex-shrink: 0;
  width: 14px; display: inline-block;
  color: var(--text-hint);
  font-variant-numeric: tabular-nums;
}
${S} .oc-acp-plan-item-completed { color: var(--text-muted); }
${S} .oc-acp-plan-item-completed .oc-acp-plan-desc {
  text-decoration: line-through;
  text-decoration-color: var(--border-subtle);
}
${S} .oc-acp-plan-item-completed .oc-acp-plan-bullet { color: var(--text-success); }
${S} .oc-acp-plan-item-in_progress .oc-acp-plan-bullet { color: rgba(216,180,254,0.9); }
${S} .oc-acp-plan-desc { flex: 1; min-width: 0; word-break: break-word; }

/* ── Messages (ACP variant of oc-ai-msg) ───────────────── */
${S} .oc-acp-messages {
  display: flex; flex-direction: column; gap: 12px;
}
${S} .oc-acp-msg { display: flex; gap: 10px; align-items: flex-start; }
${S} .oc-acp-msg-icon {
  width: 22px; height: 22px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; color: var(--text-muted);
}
${S} .oc-acp-msg-content {
  font-size: 13px; line-height: 1.55;
  color: var(--text-on-surface);
  flex: 1; min-width: 0; padding-top: 2px;
  white-space: pre-wrap; word-break: break-word;
}
${S} .oc-acp-msg-queued { opacity: 0.72; }
${S} .oc-acp-msg-queued-hint {
  margin-top: 6px;
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px;
  color: var(--text-hint);
  font-style: italic;
}

/* ── Tool card ─────────────────────────────────────────── */
${S} .oc-acp-tool {
  border: 1px solid var(--border-subtle);
  background: rgba(255,255,255,0.02);
  border-radius: 10px; overflow: hidden;
}
${S} .oc-acp-tool-design {
  border-color: rgba(34,197,94,0.22);
  background: rgba(34,197,94,0.04);
}
${S} .oc-acp-tool-subagent {
  border-color: rgba(168,85,247,0.3);
  background: rgba(168,85,247,0.05);
}
${S} .oc-acp-tool-subagent .oc-acp-tool-icon { color: rgba(216,180,254,0.9); }
${S} .oc-acp-tool-subagent .oc-acp-tool-vendor {
  color: rgba(216,180,254,0.9);
}
${S} .oc-acp-tool-head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
}
${S} .oc-acp-tool-icon { flex-shrink: 0; color: var(--text-muted); }
${S} .oc-acp-tool-design .oc-acp-tool-icon { color: var(--text-success); }
${S} .oc-acp-tool-body { min-width: 0; flex: 1; }
${S} .oc-acp-tool-title {
  font-size: 11.5px; font-weight: 500;
  color: var(--text-on-surface);
  display: flex; align-items: center; gap: 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-acp-tool-vendor {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-success);
  font-weight: 400;
}
${S} .oc-acp-tool-summary {
  font-size: 10.5px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  margin-top: 2px;
}
${S} .oc-acp-tool-kind {
  font-size: 10px; color: var(--text-hint); margin-top: 2px;
}
${S} .oc-acp-tool-status { flex-shrink: 0; }

/* ── Tool content payload (pre-receipt) ────────────────── */
${S} .oc-acp-tool-content {
  border-top: 1px solid var(--border-subtle);
  padding: 8px 10px;
  font-size: 11px; color: var(--text-on-surface-variant);
}
${S} .oc-acp-tool-content pre {
  font-family: var(--font-mono); font-size: 10.5px;
  color: var(--text-on-surface-variant);
  max-height: 160px; overflow: auto;
  white-space: pre-wrap; word-break: break-word;
  margin: 0;
}
${S} .oc-acp-tool-content-diff {
  font-size: 10.5px; color: var(--text-muted);
}
${S} .oc-acp-tool-content-diff .oc-acp-mono {
  font-family: var(--font-mono); color: var(--text-hint);
  margin-right: 6px;
}

/* ── Apply-change receipt ──────────────────────────────── */
${S} .oc-acp-receipt {
  border-top: 1px solid var(--border-subtle);
  background: rgba(0,0,0,0.22);
}
${S} .oc-acp-receipt-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  font-size: 10px; color: var(--text-muted);
  gap: 8px;
}
${S} .oc-acp-receipt-selector {
  font-family: var(--font-mono);
  color: var(--text-on-surface);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-acp-receipt-tag {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-hint);
  flex-shrink: 0;
}
${S} .oc-acp-receipt-diff {
  font-family: var(--font-mono); font-size: 10.5px;
  border-top: 1px solid var(--border-subtle);
}
${S} .oc-acp-receipt-row {
  display: flex; gap: 8px;
  padding: 5px 10px;
}
${S} .oc-acp-receipt-row-before { color: var(--text-critical-light); }
${S} .oc-acp-receipt-row-before .oc-acp-receipt-sign {
  color: rgba(248,113,113,0.6); flex-shrink: 0;
}
${S} .oc-acp-receipt-row-after { color: var(--text-success); }
${S} .oc-acp-receipt-row-after .oc-acp-receipt-sign {
  color: rgba(34,197,94,0.7); flex-shrink: 0;
}
${S} .oc-acp-receipt-row-failed {
  color: var(--text-disabled);
  text-decoration: line-through;
}
${S} .oc-acp-receipt-row-failed .oc-acp-receipt-sign {
  color: var(--text-hint); text-decoration: none; flex-shrink: 0;
}
${S} .oc-acp-receipt-value {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
${S} .oc-acp-receipt-value-unset {
  font-style: italic; color: var(--text-hint); text-decoration: none;
}
${S} .oc-acp-receipt-source {
  padding: 5px 10px;
  font-size: 9.5px; font-family: var(--font-mono);
  color: var(--text-hint);
  border-top: 1px solid var(--border-subtle);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Permission bar (low / high risk) ──────────────────── */
${S} .oc-acp-perm {
  border-top: 1px solid var(--border-subtle);
  padding: 12px;
}
${S} .oc-acp-perm-head {
  display: flex; align-items: flex-start; gap: 8px;
}
${S} .oc-acp-perm-icon { margin-top: 2px; flex-shrink: 0; }
${S} .oc-acp-perm-title {
  font-size: 12px; font-weight: 500;
}
${S} .oc-acp-perm-body {
  font-size: 11px; color: var(--text-on-surface-variant);
  margin-top: 2px;
}
${S} .oc-acp-perm-diff {
  margin-top: 6px;
  border: 1px solid var(--border-subtle);
  background: rgba(0,0,0,0.3);
  border-radius: 6px; overflow: hidden;
  font-family: var(--font-mono); font-size: 10.5px;
}
${S} .oc-acp-perm-actions {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 10px;
}
${S} .oc-acp-perm-btn {
  font-size: 11px; padding: 5px 10px; border-radius: 6px;
  border: none; cursor: pointer; font-family: inherit;
  transition: background 120ms ease;
}
${S} .oc-acp-perm-btn-cancel {
  margin-left: auto;
  background: rgba(255,255,255,0.04);
  color: var(--text-muted);
}
${S} .oc-acp-perm-btn-cancel:hover { background: rgba(255,255,255,0.07); }

/* ── Composer (3-row card: input + toolbar + footer) ───── */
${S} .oc-acp-composer {
  border-top: 1px solid var(--border-subtle);
  padding: 10px 12px 12px;
  flex-shrink: 0;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* The card wraps textarea + toolbar together with one border that
   lights up on focus-within — the whole affordance highlights when
   the user is typing. */
${S} .oc-acp-composer-card {
  position: relative;
  display: flex; flex-direction: column;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  transition: border-color 120ms ease, background 120ms ease,
              box-shadow 120ms ease;
  padding: 4px 6px 4px 10px;
}
${S} .oc-acp-composer-card:focus-within {
  border-color: var(--ring);
  background: var(--surface-0);
  box-shadow: 0 0 0 2px var(--tint-primary-soft);
}
${S} .oc-acp-composer-input {
  width: 100%;
  min-height: 26px;
  max-height: 280px;
  resize: none;
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  padding: 6px 0 !important;
  box-shadow: none !important;
  color: var(--text-on-surface);
  font-size: 13px; font-family: inherit;
  outline: none;
  line-height: 1.5;
}
${S} .oc-acp-composer-input:focus,
${S} .oc-acp-composer-input:focus-visible {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
  background: transparent !important;
}
${S} .oc-acp-composer-input::placeholder { color: var(--text-muted); }
${S} .oc-acp-composer-input:disabled { opacity: 0.5; }

${S} .oc-acp-composer-toolbar {
  display: flex; align-items: center;
  gap: 4px;
  padding: 4px 0 2px;
  min-width: 0;
}

${S} .oc-acp-attachments {
  display: flex; flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
${S} .oc-acp-attachment {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 8px 3px 6px;
  background: var(--tint-primary-soft);
  color: var(--text-primary-light);
  border: 1px solid var(--tint-primary-border);
  border-radius: 999px;
  font-size: 11px;
  max-width: 220px;
}
${S} .oc-acp-attachment-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  min-width: 0;
}
${S} .oc-acp-attachment-x {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px;
  background: transparent;
  border: none;
  color: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
  padding: 0;
  border-radius: 50%;
  transition: opacity 120ms, background 120ms;
}
${S} .oc-acp-attachment-x:hover {
  opacity: 1;
  background: var(--tint-border-hover);
}
${S} .oc-acp-toolbar-spacer { flex: 1; }
${S} .oc-acp-toolbar-sep {
  width: 1px;
  height: 14px;
  background: var(--border-subtle);
  margin: 0 4px;
  flex-shrink: 0;
}

/* Footer row — branch / permissions / context — lives OUTSIDE
   the card so the pills read as "chat metadata", not composer
   inputs. Same type scale as the toolbar pills for visual parity. */
${S} .oc-acp-composer-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 2px 0;
  min-width: 0;
  flex-wrap: wrap;
}

/* Right-anchored variant of .oc-chat-dropdown-root.is-footer — for
   pills at the right edge (context %) so the menu doesn't clip. */
${S} .oc-chat-dropdown-root.is-footer.is-right .oc-chat-dropdown-menu {
  left: auto;
  right: 0;
}

/* Branch pill — ahead/behind counters inline with the branch name.
   Mirrors Cursor's pattern of showing sync state at a glance. */
${S} .oc-chat-branch-pill-counters {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 2px;
  padding: 0 5px;
  background: var(--tint-hover-strong);
  border-radius: 999px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-on-surface-variant);
}

/* Usage popover — breakdown of input/output/cache tokens. */
${S} .oc-chat-usage-popover {
  min-width: 240px;
  padding: 6px;
}
${S} .oc-chat-usage-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 6px;
  font-size: 11.5px;
  color: var(--text-on-surface-variant);
  font-family: var(--font-mono);
}
${S} .oc-chat-usage-row.is-primary {
  color: var(--text-on-surface);
  font-weight: 600;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 2px;
  padding-bottom: 6px;
}

/* Padded variant of dropdown hint for standalone hint rows (no item). */
${S} .oc-chat-dropdown-item-hint--padded {
  padding: 6px 10px;
  display: block;
}

/* Meta row in a dropdown (e.g. "Refresh catalog") — dimmer, separator
   above, sits at the footer of the menu. */
${S} .oc-chat-dropdown-separator {
  height: 1px;
  background: var(--border-subtle);
  margin: 4px 0;
}
${S} .oc-chat-dropdown-item--meta {
  color: var(--text-on-surface-variant);
}
${S} .oc-chat-dropdown-item--meta:disabled {
  opacity: 0.6;
  cursor: default;
}
${S} .oc-chat-dropdown-item--meta .oc-chat-dropdown-item-hint {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 10px;
  white-space: nowrap;
}
${S} .oc-spin { animation: oc-spin 1s linear infinite; }

/* Phase 5 — Design-audits quick-launch strip + subagent tool cards */
${S} .oc-acp-quicks {
  display: flex; align-items: center; gap: 6px;
  padding: 0 4px 8px;
  flex-wrap: wrap;
}
${S} .oc-acp-quicks-label {
  font-size: 9.5px; text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-hint);
  margin-right: 2px;
}
${S} .oc-acp-quick-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px;
  font-size: 10.5px; font-family: inherit;
  color: rgba(216,180,254,0.9);
  background: rgba(168,85,247,0.08);
  border: 1px solid rgba(168,85,247,0.22);
  border-radius: 999px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-acp-quick-chip:hover {
  background: rgba(168,85,247,0.18);
  color: rgba(233,213,255,1);
}
${S} .oc-acp-quick-chip[disabled] {
  opacity: 0.4; cursor: not-allowed;
}

/* ── Mention picker (ACP variant of oc-slash-menu) ─────── */
${S} .oc-acp-menu {
  position: absolute;
  left: 0; right: 0; bottom: calc(100% + 6px);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  box-shadow: var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.5));
  overflow: hidden;
  z-index: 25;
}
${S} .oc-acp-menu-head {
  padding: 6px 12px; font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-acp-menu-list { max-height: 220px; overflow-y: auto; }
${S} .oc-acp-menu-item {
  width: 100%;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  background: transparent; border: none;
  color: var(--text-on-surface);
  cursor: pointer; text-align: left;
  transition: background 120ms ease;
}
${S} .oc-acp-menu-item:hover { background: rgba(255,255,255,0.05); }
${S} .oc-acp-menu-item-active {
  background: rgba(255,255,255,0.08) !important;
}
${S} .oc-acp-menu-item-icon {
  flex-shrink: 0; color: var(--text-muted);
}
${S} .oc-acp-menu-item-active .oc-acp-menu-item-icon {
  color: var(--text-success);
}
${S} .oc-acp-menu-item-label {
  font-size: 11px; color: var(--text-on-surface);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-acp-menu-item-hint {
  font-size: 10px; color: var(--text-muted);
  font-family: var(--font-mono);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  margin-top: 1px;
}
${S} .oc-acp-menu-item-kind {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-hint);
  flex-shrink: 0;
}
${S} .oc-acp-menu-empty {
  padding: 12px; font-size: 11px;
  color: var(--text-muted);
}

/* ── Registry picker ───────────────────────────────────── */
${S} .oc-acp-reg-search {
  flex: 1; min-width: 0;
  position: relative;
}
${S} .oc-acp-reg-search-icon {
  position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
  color: var(--text-hint); pointer-events: none;
}
${S} .oc-acp-reg-search-input {
  width: 100%;
  padding: 6px 10px 6px 28px;
  background: var(--surface-1);
  border: 1px solid transparent; border-radius: 6px;
  font-size: 11.5px; font-family: inherit;
  color: var(--text-on-surface);
  outline: none;
  transition: border-color 120ms ease, background 120ms ease;
}
${S} .oc-acp-reg-search-input:focus {
  border-color: var(--ring);
  background: var(--surface-0);
}
${S} .oc-acp-reg-search-input::placeholder { color: var(--text-muted); }
${S} .oc-acp-reg-list { flex: 1; min-height: 0; overflow-y: auto; }
${S} .oc-acp-reg-row {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background 120ms ease;
}
${S} .oc-acp-reg-row:hover { background: rgba(255,255,255,0.03); }
${S} .oc-acp-reg-row-active { background: rgba(255,255,255,0.06); }
${S} .oc-acp-reg-avatar {
  width: 28px; height: 28px; border-radius: 6px;
  background: rgba(255,255,255,0.06);
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); font-size: 11px; font-weight: 600;
}
${S} .oc-acp-reg-body { min-width: 0; flex: 1; }
${S} .oc-acp-reg-title {
  display: flex; align-items: baseline; gap: 6px;
}
${S} .oc-acp-reg-name {
  font-size: 12px; font-weight: 500;
  color: var(--text-on-surface);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-acp-reg-version {
  font-size: 10px; color: var(--text-hint); flex-shrink: 0;
}
${S} .oc-acp-reg-dist {
  font-size: 10px; color: var(--text-hint);
  text-transform: uppercase; letter-spacing: 0.04em;
  flex-shrink: 0;
}
${S} .oc-acp-reg-desc {
  font-size: 11px; color: var(--text-on-surface-variant);
  margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-acp-reg-id {
  font-size: 10px; color: var(--text-hint);
  font-family: var(--font-mono); margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-acp-reg-cta {
  font-size: 10px; padding: 4px 8px; border-radius: 6px;
  border: none; cursor: pointer; font-family: inherit;
  background: rgba(255,255,255,0.06); color: var(--text-on-surface);
  flex-shrink: 0;
  transition: background 120ms ease;
}
${S} .oc-acp-reg-cta:hover { background: rgba(255,255,255,0.1); }
${S} .oc-acp-reg-cta-active {
  background: rgba(34,197,94,0.18); color: rgba(187,247,208,0.95);
}
${S} .oc-acp-reg-cta-active:hover { background: rgba(34,197,94,0.28); }

/* Installed-state chip. Dual purpose: shows state AND acts as the
   "set as default" click target (row click also works). The is-default
   variant gets the green tint so the current default is obvious. */
${S} .oc-acp-reg-cta-installed {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; padding: 4px 8px; border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: transparent; color: var(--text-muted);
  cursor: pointer; flex-shrink: 0; user-select: none;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
${S} .oc-acp-reg-cta-installed:hover {
  background: rgba(255,255,255,0.04);
  color: var(--text-on-surface);
  border-color: var(--border-default);
}
${S} .oc-acp-reg-cta-installed.is-default {
  background: rgba(34,197,94,0.14);
  border-color: rgba(34,197,94,0.32);
  color: rgba(187,247,208,0.95);
}
${S} .oc-acp-reg-cta-installed.is-default:hover {
  background: rgba(34,197,94,0.22);
}
${S} .oc-acp-reg-footer {
  border-top: 1px solid var(--border-subtle);
  padding: 6px 12px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 10px; color: var(--text-hint);
}
${S} .oc-acp-reg-footer a {
  color: var(--text-muted);
  text-decoration: none;
  display: inline-flex; align-items: center; gap: 4px;
}
${S} .oc-acp-reg-footer a:hover { color: var(--text-on-surface); }

/* Phase 3 — tabs, install-state pills, per-row resource links */
${S} .oc-acp-reg-tabs {
  display: flex; gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-acp-reg-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  font-size: 11px; font-family: inherit;
  color: var(--text-muted);
  background: transparent; border: none; border-radius: 6px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-acp-reg-tab:hover { color: var(--text-on-surface); background: rgba(255,255,255,0.04); }
${S} .oc-acp-reg-tab-active {
  color: var(--text-on-surface);
  background: rgba(255,255,255,0.06);
}
${S} .oc-acp-reg-tab-count {
  font-size: 10px; color: var(--text-hint);
}
${S} .oc-acp-reg-tab-active .oc-acp-reg-tab-count { color: var(--text-on-surface-variant); }

${S} .oc-acp-reg-pill {
  font-size: 9.5px;
  text-transform: uppercase; letter-spacing: 0.04em;
  padding: 1px 6px; border-radius: 999px;
  border: 1px solid transparent;
  flex-shrink: 0;
}
${S} .oc-acp-reg-pill-installed {
  color: var(--text-success);
  background: rgba(34,197,94,0.08);
  border-color: rgba(34,197,94,0.24);
}
${S} .oc-acp-reg-pill-available {
  color: var(--text-on-surface-variant);
  background: rgba(255,255,255,0.04);
  border-color: var(--border-subtle);
}
${S} .oc-acp-reg-pill-unavailable {
  color: var(--text-hint);
  background: rgba(255,255,255,0.02);
  border-color: var(--border-subtle);
}

${S} .oc-acp-reg-meta {
  display: flex; align-items: center; gap: 10px;
  margin-top: 4px;
  font-size: 10px; color: var(--text-hint);
}
${S} .oc-acp-reg-meta a {
  display: inline-flex; align-items: center; gap: 3px;
  color: var(--text-muted);
  text-decoration: none;
}
${S} .oc-acp-reg-meta a:hover { color: var(--text-on-surface); }
${S} .oc-acp-reg-meta-license {
  display: inline-flex; align-items: center; gap: 3px;
  color: var(--text-hint);
}

/* ── Auth modal (method picker + key input) ────────────── */
${S} .oc-acp-auth-body { padding: 12px; }
${S} .oc-acp-auth-card {
  width: 100%;
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px;
  text-align: left;
  border: 1px solid var(--border-subtle);
  background: rgba(255,255,255,0.02);
  border-radius: 8px; cursor: pointer; font-family: inherit;
  transition: border-color 120ms ease, background 120ms ease;
  margin-bottom: 10px;
}
${S} .oc-acp-auth-card:hover {
  background: rgba(255,255,255,0.04);
}
${S} .oc-acp-auth-card-active {
  border-color: rgba(34,197,94,0.4);
  background: rgba(34,197,94,0.06);
}
${S} .oc-acp-auth-icon {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 6px;
  background: rgba(255,255,255,0.05); color: var(--text-muted);
  display: flex; align-items: center; justify-content: center;
}
${S} .oc-acp-auth-card-active .oc-acp-auth-icon {
  background: rgba(34,197,94,0.18);
  color: var(--text-success);
}
${S} .oc-acp-auth-body-text { min-width: 0; flex: 1; }
${S} .oc-acp-auth-title {
  font-size: 12px; font-weight: 500;
  color: var(--text-on-surface);
}
${S} .oc-acp-auth-desc {
  font-size: 11px; color: var(--text-on-surface-variant);
  margin-top: 2px;
  line-height: 1.45;
}
${S} .oc-acp-auth-radio {
  flex-shrink: 0; width: 14px; height: 14px;
  border: 1px solid var(--border-strong);
  border-radius: 50%; margin-top: 2px;
}
${S} .oc-acp-auth-card-active .oc-acp-auth-radio {
  border-color: var(--text-success);
  background: var(--text-success);
}
${S} .oc-acp-auth-field {
  margin-top: 4px; padding: 12px;
  border: 1px solid var(--border-subtle);
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
}
${S} .oc-acp-auth-label {
  font-size: 11px; color: var(--text-on-surface-variant);
  margin-bottom: 6px;
}
${S} .oc-acp-auth-field-meta {
  margin-top: 6px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
}
${S} .oc-acp-auth-field-meta a {
  font-size: 10px; color: var(--text-muted);
  text-decoration: none;
}
${S} .oc-acp-auth-field-meta a:hover { color: var(--text-on-surface); }
${S} .oc-acp-auth-field-meta-badge {
  font-size: 10px; color: var(--text-hint);
  display: inline-flex; align-items: center; gap: 4px;
}
${S} .oc-acp-auth-disclaimer {
  padding: 10px 12px;
  border: 1px solid rgba(234,179,8,0.2);
  background: rgba(234,179,8,0.06);
  border-radius: 8px;
  font-size: 11px;
  color: rgba(254,240,138,0.85);
  line-height: 1.5;
  display: flex; gap: 8px;
}
${S} .oc-acp-auth-disclaimer-title {
  font-weight: 500; color: rgba(254,240,138,0.95);
  margin-bottom: 2px;
}
${S} .oc-acp-auth-error {
  font-size: 11px; color: var(--text-critical-light);
  margin-top: 8px;
}
${S} .oc-acp-auth-actions {
  border-top: 1px solid var(--border-subtle);
  padding: 10px 12px;
  display: flex; align-items: center; gap: 8px;
}
${S} .oc-acp-auth-actions-spacer { flex: 1; }

/* ── Misc small states ─────────────────────────────────── */
${S} .oc-acp-error {
  margin: 8px 12px 0;
  padding: 8px;
  border: 1px solid rgba(239,68,68,0.3);
  background: rgba(239,68,68,0.06);
  border-radius: 6px;
  display: flex; gap: 8px; align-items: flex-start;
  font-size: 11px; color: var(--text-critical-light);
}
${S} .oc-acp-error-title { font-weight: 500; }
${S} .oc-acp-empty-muted {
  padding: 12px; font-size: 11px; color: var(--text-muted);
  display: flex; align-items: center; gap: 6px;
}
${S} .oc-acp-loading {
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: var(--text-muted);
  gap: 6px;
}
`;

export function injectStyles(): void {
  if (typeof document === "undefined") return;
  // Concatenate the legacy monolithic stylesheet (ZEROS_CSS in
  // this file) with the modular barrel so Phase 4's tiles / auth
  // tabs / effort selector actually reach the DOM. Keep the legacy
  // string for rollback safety.
  const content = `${ZEROS_CSS}\n${MODULAR_CSS}`;
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