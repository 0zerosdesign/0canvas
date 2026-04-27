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
   Zeros — Legacy Monolithic Component Styles
   ------------------------------------------------------------
   Tokens, overlay isolation reset, and element-level resets
   have moved out of this file:
     styles/tokens.css    — tokens (primitives +
                                       semantic + compat)
     src/zeros/engine/styles/
       engine-scope.ts               — [data-Zeros-overlay]
                                       host-isolation reset +
                                       element-level resets
                                       under [data-Zeros-root]
   What's left below is ~4k lines of legacy oc-* class rules
   that Phase 3 will chip away at module-by-module.
   ============================================================ */

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
${S} .border-foreground { border-color: var(--text-primary); }
${S} .border-l-transparent { border-left-color: transparent; }
${S} .border-t-transparent { border-top-color: transparent; }
${S} .border-dashed { border-style: dashed; }
${S} .border-\\[\\#0070f3\\]\\/20 { border-color: var(--tint-accent-soft); }
${S} .border-\\[\\#0070f3\\]\\/30 { border-color: var(--tint-accent-border); }
${S} .border-\\[\\#0070f3\\]\\/40 { border-color: var(--tint-accent-border); }
${S} .border-\\[\\#50e3c2\\]\\/20 { border-color: var(--tint-success-border); }
${S} .border-\\[\\#ff0080\\]\\/20 { border-color: var(--tint-critical-border); }
${S} .border-\\[\\#ff4444\\]\\/20 { border-color: var(--tint-critical-border); }
${S} .border-\\[\\#ff980040\\] { border-color: var(--tint-warning-border); }
${S} .border-\\[\\#4caf5040\\] { border-color: var(--tint-success-border); }
${S} .border-\\[\\#2196f340\\] { border-color: var(--tint-accent-border); }
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
${S} .bg-\\[\\#0070f3\\] { background-color: var(--accent); }
${S} .bg-\\[\\#50e3c2\\] { background-color: var(--text-success); }
${S} .bg-\\[\\#0070f3\\]\\/5 { background-color: var(--tint-accent-weak); }
${S} .bg-\\[\\#0070f3\\]\\/10 { background-color: var(--tint-accent-weak); }
${S} .bg-\\[\\#0070f3\\]\\/15 { background-color: var(--tint-accent-soft); }
${S} .bg-\\[\\#0070f3\\]\\/20 { background-color: var(--tint-accent-soft); }
${S} .bg-\\[\\#50e3c2\\]\\/10 { background-color: var(--tint-success-weak); }
${S} .bg-\\[\\#50e3c2\\]\\/20 { background-color: var(--tint-success-soft); }
${S} .bg-\\[\\#f5a623\\]\\/10 { background-color: var(--tint-warning-soft); }
${S} .bg-\\[\\#f5a623\\]\\/15 { background-color: var(--tint-warning-soft); }
${S} .bg-\\[\\#7928ca\\]\\/15 { background-color: var(--tint-accent-soft); }
${S} .bg-\\[\\#7928ca\\]\\/20 { background-color: var(--tint-accent-soft); }
${S} .bg-\\[\\#ff0080\\]\\/15 { background-color: var(--tint-critical-soft); }
${S} .bg-\\[\\#ff0080\\]\\/20 { background-color: var(--tint-critical-soft); }
${S} .bg-\\[\\#ff4444\\]\\/10 { background-color: var(--tint-critical-soft); }
${S} .bg-\\[\\#ff980020\\] { background-color: var(--tint-warning-soft); }
${S} .bg-\\[\\#4caf5020\\] { background-color: var(--tint-success-soft); }
${S} .bg-\\[\\#2196f320\\] { background-color: var(--tint-accent-soft); }
${S} .bg-black\\/60 { background-color: var(--backdrop-strong); }
${S} .bg-\\[\\#0a0a0a\\]\\/95 { background-color: var(--backdrop-weak); }
${S} .bg-\\[\\#ffffff06\\] { background-color: var(--tint-hover); }
${S} .bg-\\[\\#ffffff08\\] { background-color: var(--tint-hover); }
${S} .bg-\\[\\#ffffff10\\] { background-color: var(--tint-hover-strong); }

/* ============================================================
   TEXT COLORS
   ============================================================ */
${S} .text-foreground { color: var(--text-primary); }
${S} .text-background { color: var(--surface-0); }
${S} .text-muted-foreground { color: var(--text-muted); }
${S} .text-white { color: var(--text-primary); }
${S} .text-\\[\\#0070f3\\] { color: var(--accent); }
${S} .text-\\[\\#50e3c2\\] { color: var(--text-success); }
${S} .text-\\[\\#f5a623\\] { color: var(--text-warning); }
${S} .text-\\[\\#7928ca\\] { color: var(--text-info); }
${S} .text-\\[\\#ff0080\\] { color: var(--text-critical); }
${S} .text-\\[\\#ff4444\\] { color: var(--text-critical); }
${S} .text-\\[\\#ff9800\\] { color: var(--text-warning); }
${S} .text-\\[\\#4caf50\\] { color: var(--text-success); }
${S} .text-\\[\\#2196f3\\] { color: var(--accent); }
${S} .text-\\[\\#79b8ff\\] { color: var(--text-connecting); }
${S} .text-\\[\\#444444\\] { color: var(--text-placeholder); }
${S} .text-\\[\\#888888\\] { color: var(--text-muted); }
${S} .text-blue-300 { color: var(--text-info); }
${S} .text-blue-400 { color: var(--accent-hover); }
${S} .text-blue-500 { color: var(--accent); }
${S} .text-purple-400 { color: var(--text-info); }
${S} .text-indigo-200 { color: var(--text-info); }
${S} .text-indigo-300 { color: var(--text-info); }
${S} .text-indigo-400 { color: var(--accent); }
${S} .text-green-300 { color: var(--text-success); }
${S} .text-green-400 { color: var(--text-success); }
${S} .text-orange-300 { color: var(--text-warning); }
${S} .text-orange-400 { color: var(--text-warning); }
${S} .text-yellow-300 { color: var(--text-warning); }
${S} .text-yellow-400 { color: var(--text-warning); }
${S} .text-cyan-400 { color: var(--text-connecting); }
${S} .text-teal-400 { color: var(--text-success); }
${S} .text-pink-400 { color: var(--text-critical); }
${S} .text-red-400 { color: var(--text-critical); }

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
${S} .transition-colors { transition-property: color,background-color,border-color,text-decoration-color,fill,stroke; transition-timing-function: var(--ease-emphasized); transition-duration: var(--dur-fast); }
${S} .transition-all { transition-property: all; transition-timing-function: var(--ease-emphasized); transition-duration: var(--dur-fast); }
${S} .transition-opacity { transition-property: opacity; transition-timing-function: var(--ease-emphasized); transition-duration: var(--dur-fast); }
${S} .transition-transform { transition-property: transform; transition-timing-function: var(--ease-emphasized); transition-duration: var(--dur-fast); }
${S} .transition-\\[color\\,box-shadow\\] { transition-property: color,box-shadow; transition-timing-function: var(--ease-emphasized); transition-duration: var(--dur-fast); }
${S} .opacity-0 { opacity: 0; }
${S} .opacity-30 { opacity: 0.3; }
${S} .opacity-40 { opacity: 0.4; }
${S} .opacity-50 { opacity: 0.5; }
${S} .opacity-60 { opacity: 0.6; }
${S} .shadow-xl { box-shadow: var(--shadow-lg); }
${S} .shadow-2xl { box-shadow: var(--shadow-xl); }
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
${S} .ring-1 { box-shadow: 0 0 0 1px var(--ring-focus); }
${S} .ring-white\\/30 { box-shadow: 0 0 0 1px var(--tint-border-hover); }
${S} .ring-white\\/40 { box-shadow: 0 0 0 1px var(--tint-border-hover); }

/* ============================================================
   HOVER STATES
   ============================================================ */
${S} .hover\\:bg-\\[\\#1a1a1a\\]:hover { background-color: var(--surface-1); }
${S} .hover\\:bg-\\[\\#111111\\]:hover { background-color: var(--surface-1); }
${S} .hover\\:bg-\\[\\#ffffff06\\]:hover { background-color: var(--tint-hover); }
${S} .hover\\:bg-\\[\\#ffffff08\\]:hover { background-color: var(--tint-hover); }
${S} .hover\\:bg-\\[\\#ffffff10\\]:hover { background-color: var(--tint-hover-strong); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/10:hover { background-color: var(--tint-accent-weak); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/20:hover { background-color: var(--tint-accent-soft); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/90:hover { background-color: var(--accent-hover); }
${S} .hover\\:bg-\\[\\#ff4444\\]\\/10:hover { background-color: var(--tint-critical-soft); }
${S} .hover\\:text-foreground:hover { color: var(--text-primary); }
${S} .hover\\:text-\\[\\#0070f3\\]:hover { color: var(--accent); }
${S} .hover\\:text-\\[\\#7928ca\\]:hover { color: var(--text-info); }
${S} .hover\\:text-\\[\\#f5a623\\]:hover { color: var(--text-warning); }
${S} .hover\\:text-\\[\\#ff4444\\]:hover { color: var(--text-critical); }
${S} .hover\\:border-\\[\\#333333\\]:hover { border-color: var(--border-default); }
${S} .hover\\:border-foreground:hover { border-color: var(--text-primary); }
${S} .hover\\:underline:hover { text-decoration: underline; }
${S} .hover\\:opacity-90:hover { opacity: 0.9; }

/* ============================================================
   FOCUS STATES
   ============================================================ */
${S} .focus\\:outline-none:focus { outline: none; }
${S} .focus\\:border-\\[\\#333333\\]:focus { border-color: var(--border-default); }
${S} .focus\\:border-\\[\\#0070f3\\]:focus { border-color: var(--accent); }
${S} .focus-visible\\:ring-ring\\/50:focus-visible { box-shadow: 0 0 0 3px var(--ring-focus); }
${S} .focus-visible\\:ring-\\[3px\\]:focus-visible { box-shadow: 0 0 0 3px var(--ring-focus); }
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
  color: var(--text-primary); cursor: pointer; display: flex;
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
  color: var(--text-primary);
  background: var(--surface-2);
}
${S} .oc-page-tab.is-active {
  color: var(--text-primary);
  background: var(--surface-3);
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
  width: 3px; background: var(--accent);
}

/* ── Toolbar ────────────────────────────────────────────────── */
${S} .oc-toolbar {
  height: 48px; display: flex; align-items: center;
  justify-content: space-between;
  padding: 0 16px; gap: 6px; flex-shrink: 0;
  background: var(--surface-floor); border-bottom: 1px solid var(--border-subtle);
  font-family: var(--font-ui); font-size: 13px;
  color: var(--text-primary); user-select: none;
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
${S} .oc-toolbar-btn:hover { background: var(--surface-2); color: var(--text-primary); }
${S} .oc-toolbar-btn.is-active { background: var(--surface-1); color: var(--text-primary); }
${S} .oc-toolbar-badge {
  font-size: 10px; font-weight: 600;
  background: var(--tint-active); color: var(--text-primary);
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
  background: var(--text-success);
}
${S} .oc-toolbar-dropdown {
  position: absolute; top: 100%; left: 0; margin-top: 6px;
  background: var(--surface-floor); border: 1px solid var(--border-subtle);
  border-radius: 8px; box-shadow: var(--shadow-lg);
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
${S} .oc-toolbar-project-dot.is-saved { background: var(--text-success); }
${S} .oc-toolbar-project-dot.is-unsaved { background: var(--text-warning); }
${S} .oc-toolbar-project-input {
  width: 100px; padding: 1px 4px;
  background: var(--surface-1); border: 1px solid var(--border-default);
  border-radius: 4px; color: var(--text-primary);
  font-size: 12px; outline: none;
}
${S} .oc-toolbar-project-name {
  font-size: 12px; max-width: 120px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary);
}
${S} .oc-toolbar-project-unsaved {
  font-size: 10px; color: var(--text-warning); font-style: italic;
}
${S} .oc-toolbar-project-save-btn {
  flex: 1; display: flex; align-items: center; justify-content: center;
  gap: 5px; padding: 6px 0; background: var(--accent);
  border: none; border-radius: 6px; color: var(--text-on-accent);
  font-size: 11px; font-weight: 500; cursor: pointer;
}
${S} .oc-toolbar-project-save-btn:hover { background: var(--accent-hover); }
${S} .oc-toolbar-project-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; background: transparent;
  border-left: 2px solid transparent;
  cursor: pointer; transition: all 0.1s ease;
}
${S} .oc-toolbar-project-item:hover { background: var(--surface-2); }
${S} .oc-toolbar-project-item.is-active {
  background: var(--tint-accent-weak);
  border-left-color: var(--accent);
}
${S} .oc-toolbar-project-item-name {
  font-size: 12px; color: var(--text-primary);
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
  padding: 2px; color: var(--text-critical);
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
  font-size: 12px; font-weight: 600; color: var(--text-primary);
}
${S} .oc-panel-title {
  font-size: 13px; font-weight: 600;
  letter-spacing: -0.01em; color: var(--text-primary);
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
${S} .oc-style-tab:hover { color: var(--text-primary); }
${S} .oc-style-tab.is-active {
  color: var(--text-primary); border-bottom-color: var(--accent);
}
${S} .oc-style-property {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 10px; font-size: 11px; min-width: 0;
}
${S} .oc-style-property:hover { background: var(--surface-2); }
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
  border-radius: 4px; padding: 3px 6px; color: var(--text-primary);
  font-size: 11px; font-family: var(--font-mono); outline: none;
  width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box;
}
${S} .oc-style-input:focus { border-color: var(--ring-focus); }
${S} .oc-style-tag-badge {
  font-size: 12px; color: var(--text-primary);
  background: var(--tint-accent-soft); padding: 2px 8px;
  border-radius: 4px; font-family: var(--font-mono);
}
${S} .oc-style-class-badge {
  font-size: 10px; color: var(--text-muted);
  background: var(--surface-1); padding: 1px 5px;
  border-radius: 4px; border: 1px solid var(--border-subtle);
  font-family: var(--font-mono); max-width: 80px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-style-class-overflow { font-size: 10px; color: var(--text-muted); }
${S} .oc-style-prop-count { font-size: 11px; color: var(--text-muted); }
${S} .oc-style-section-btn {
  display: flex; align-items: center; width: 100%;
  padding: 4px 0; background: transparent; border: none;
  cursor: pointer; color: var(--text-primary); font-size: 12px;
  transition: background 0.1s ease;
}
${S} .oc-style-section-btn:hover { background: var(--surface-2); }
${S} .oc-style-section-icon { margin-right: 6px; display: inline-flex; }
${S} .oc-style-section-name { font-size: 12px; font-weight: 450; }
${S} .oc-style-section-count { margin-left: auto; font-size: 10px; color: var(--text-muted); }
${S} .oc-style-code-block {
  font-size: 11px; color: var(--text-primary); background: var(--surface-1);
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
  flex: 1; color: var(--text-primary); overflow: hidden;
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
  background: var(--tint-hover-strong); color: var(--text-primary);
}
${S} .oc-focus-toggle.is-active {
  color: var(--text-primary);
  background: var(--tint-accent-weak);
}
${S} .oc-focus-toggle.is-active:hover {
  background: var(--tint-accent-soft);
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
${S} .oc-source-btn:hover { background: var(--surface-1); color: var(--text-primary); }
${S} .oc-source-btn.is-active { background: var(--accent); color: var(--text-on-accent); }
${S} .oc-source-badge {
  position: absolute; top: -2px; right: -2px;
  display: flex; align-items: center; justify-content: center;
  min-width: 14px; height: 14px; padding: 0 3px;
  border-radius: 8px;
  background: var(--surface-floor); color: var(--text-primary);
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
  color: var(--text-primary);
  background: var(--surface-2);
}
${S} .oc-source-preset {
  padding: 3px 8px; border-radius: 4px; font-size: 10px;
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); font-family: var(--font-mono);
  transition: all 0.15s ease;
}
${S} .oc-source-preset:hover { background: var(--surface-1); color: var(--text-primary); }
${S} .oc-source-preset.is-active { background: var(--accent); color: var(--text-on-accent); }

${S} .oc-variant-card {
  border-radius: 0; border: 1px solid var(--border-subtle);
  background: var(--surface-0); overflow: hidden;
  transition: border-color 0.2s ease;
}
${S} .oc-variant-card:hover { border-color: var(--border-default); }
${S} .oc-variant-card.is-selected { border-color: var(--accent); border-width: 2.5px; }

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
  box-shadow: var(--shadow-sm);
}
${S} .oc-resize-zone-bottom:hover .oc-resize-handle {
  background: var(--text-muted);
  transform: scaleX(1.4);
  box-shadow: var(--shadow-sm);
}

/* Active (dragging) */
${S} .oc-resize-zone.is-active .oc-resize-handle {
  background: var(--text-muted) !important;
  box-shadow: var(--shadow-md) !important;
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
  flex: 1; color: var(--text-primary); font-weight: 500;
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
${S} .oc-variant-action-btn:hover { background: var(--surface-1); color: var(--text-primary); }

/* ── Agent Panel ──
   REMOVED: legacy per-feature classes (oc-agent-*) were
   replaced by the agent-based <AgentsPanel/> which uses
   primitives (<Button/>, <Card/>) + legacy oc-agent-* classes.
   Old block deleted in dead-CSS sweep. ── */

/* ── Command Palette ───────────────────────────────────────── */
${S} .oc-cmd-overlay {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 20vh; background: var(--backdrop-weak);
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
  background: transparent; color: var(--text-primary);
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
  color: var(--text-muted); font-size: 13px;
  transition: background 0.1s ease;
}
${S} .oc-cmd-item:hover { background: var(--surface-1); color: var(--text-primary); }
${S} .oc-cmd-item.is-active { background: var(--surface-1); color: var(--text-primary); }
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
  color: var(--text-primary); font-size: 13px;
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
  background: var(--backdrop-strong); backdrop-filter: blur(4px);
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
${S} .oc-vdiff-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
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
${S} .oc-vdiff-label-before { left: 12px; background: var(--text-critical); color: var(--surface-absolute-inverted); }
${S} .oc-vdiff-label-after { right: 12px; background: var(--text-success); color: var(--surface-absolute-inverted); }
${S} .oc-vdiff-slider {
  position: absolute; top: 0; bottom: 0; width: 3px; z-index: 3;
  transform: translateX(-50%); cursor: ew-resize;
}
${S} .oc-vdiff-slider-line {
  position: absolute; inset: 0; background: var(--surface-absolute-inverted);
  box-shadow: var(--shadow-sm);
}
${S} .oc-vdiff-slider-handle {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--surface-absolute-inverted); color: var(--text-on-inverted);
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-md);
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
  color: var(--text-primary);
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
  color: var(--text-primary);
}
${S} .oc-themes-file-tab.is-active {
  background: var(--surface-1);
  color: var(--text-primary);
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
  color: var(--text-primary);
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
  border-radius: 6px; color: var(--text-primary);
  font-family: 'Fira Code', monospace; font-size: 12px;
  resize: vertical; outline: none;
}
${S} .oc-themes-paste-input:focus {
  border-color: var(--accent);
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
  color: var(--text-primary); font-size: 13px;
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
  color: var(--text-primary);
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
  accent-color: var(--accent);
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
  color: var(--text-primary);
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
  background: var(--surface-2);
}
${S} .oc-themes-token-row.is-selected td {
  background: var(--tint-accent-weak);
}
${S} .oc-themes-td-check { text-align: center; width: 36px; }
${S} .oc-themes-td-name {
  cursor: pointer;
}
${S} .oc-themes-token-name {
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text-primary);
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
  border-color: var(--accent);
}
${S} .oc-theme-value-text {
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; cursor: default;
}
${S} .oc-theme-value-empty {
  color: var(--text-disabled);
}
${S} .oc-theme-value-input {
  flex: 1; border: 1px solid var(--accent);
  background: var(--surface-1);
  color: var(--text-primary);
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
  color: var(--text-muted);
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
  background: transparent; color: var(--text-primary);
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
  color: var(--text-primary);
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
  border-radius: 4px; color: var(--text-primary);
  font-family: 'Fira Code', monospace; font-size: 12px;
  outline: none;
}
${S} .oc-color-picker-hex-input:focus {
  border-color: var(--accent);
}
${S} .oc-color-picker-area {
  position: relative; width: 100%; height: 140px;
  border-radius: 6px; cursor: crosshair;
  margin-bottom: 8px;
}
${S} .oc-color-picker-thumb {
  position: absolute; width: 14px; height: 14px;
  border: 2px solid var(--surface-absolute-inverted); border-radius: 50%;
  box-shadow: var(--shadow-sm);
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
  border: 2px solid var(--surface-absolute-inverted); border-radius: 50%;
  box-shadow: var(--shadow-sm);
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
  border-radius: 4px; color: var(--text-primary);
  font-size: 12px; outline: none;
}
${S} .oc-color-picker-value-group input:focus {
  border-color: var(--accent);
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
  color: var(--text-primary);
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
  border-radius: 6px; color: var(--text-primary);
  font-size: 13px; outline: none;
}
${S} .oc-theme-detail-field input:focus {
  border-color: var(--accent);
}
${S} .oc-theme-detail-select {
  position: relative; display: flex;
  align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-primary);
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
  background: transparent; color: var(--text-primary);
  font-size: 13px; border-radius: 6px;
  cursor: pointer; text-align: left;
}
${S} .oc-theme-detail-dropdown-item:hover {
  background: var(--surface-2);
}
${S} .oc-theme-detail-dropdown-item.is-active {
  background: var(--tint-accent-soft);
  color: var(--accent-hover);
}
${S} .oc-theme-detail-divider {
  font-size: 12px; font-weight: 700;
  color: var(--text-primary);
  padding: 6px 0; border-top: 1px solid var(--border-subtle);
  margin-top: 2px;
}
${S} .oc-theme-detail-initial {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 6px; font-size: 13px;
  color: var(--text-primary);
}
${S} .oc-theme-detail-checkbox {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--border-default);
  border-radius: 4px; background: transparent;
  color: var(--text-on-accent); cursor: pointer;
  transition: all 0.15s ease;
}
${S} .oc-theme-detail-checkbox.is-checked {
  background: var(--accent);
  border-color: var(--accent);
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
  background: var(--backdrop-weak);
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
  color: var(--text-primary);
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
  border-radius: 8px; color: var(--text-primary);
  font-size: 13px; outline: none;
}
${S} .oc-theme-dialog-field input:focus {
  border-color: var(--accent);
}
${S} .oc-theme-dialog-preview {
  font-size: 13px; color: var(--text-muted);
  padding: 10px 14px;
  background: var(--surface-0);
  border-radius: 8px;
}
${S} .oc-theme-dialog-preview code {
  color: var(--text-primary);
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
  color: var(--text-primary);
}
${S} .oc-theme-mode-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 6px;
  border-radius: 9999px; font-size: 10px; font-weight: 700;
  background: var(--accent); color: var(--text-on-accent);
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
  color: var(--text-primary); font-size: 11px; outline: none;
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
  font-size: 10px; color: var(--text-primary);
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
  background: var(--surface-1); color: var(--text-primary);
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
  background: var(--accent); color: var(--text-on-accent);
}
${S} .oc-theme-mode-change-info {
  flex: 1; min-width: 0; overflow: hidden;
}
${S} .oc-theme-mode-change-selector {
  font-size: 11px; font-weight: 600;
  color: var(--text-primary);
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
  font-size: 10px; color: var(--accent-hover);
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
  color: var(--text-primary); font-size: 11px;
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
  color: var(--text-primary);
}
${S} .oc-tw-chip-custom { opacity: 0.6; }
${S} .oc-tw-chip-text { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${S} .oc-tw-chip-remove {
  display: flex; align-items: center; justify-content: center;
  width: 12px; height: 12px; border: none; background: transparent;
  color: var(--text-muted); cursor: pointer; border-radius: 4px;
  padding: 0;
}
${S} .oc-tw-chip-remove:hover { background: var(--tint-critical-soft); color: var(--text-critical); }

${S} .oc-tw-add-area { margin-top: 4px; }
${S} .oc-tw-search-row {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 6px; border: 1px solid var(--border-default);
  border-radius: 4px; background: var(--surface-1);
}
${S} .oc-tw-search-icon { color: var(--text-muted); flex-shrink: 0; }
${S} .oc-tw-search-input {
  flex: 1; border: none; outline: none; background: transparent;
  color: var(--text-primary); font-size: 10px;
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
  color: var(--text-primary); font-size: 10px;
  font-family: var(--font-mono); cursor: pointer; text-align: left;
}
${S} .oc-tw-suggestion:hover { background: var(--surface-2); }
${S} .oc-tw-suggestion-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
${S} .oc-tw-suggestion-prop {
  margin-left: auto; font-size: 10px; color: var(--text-muted);
}

${S} .oc-breakpoint-badge {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  padding: 1px 6px; border-radius: 4px; letter-spacing: 0.3px;
  background: var(--tint-warning-soft); color: var(--text-warning);
}
${S} .oc-style-swatch-clickable { cursor: pointer; }
${S} .oc-style-swatch-clickable:hover { box-shadow: 0 0 0 2px var(--ring-focus); }

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
  color: var(--text-muted);
}
${S} .oc-color-editor-status {
  display: flex; align-items: center; gap: 6px;
}
${S} .oc-color-editor-badge {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
}
${S} .oc-badge-writing { color: var(--text-muted); }
${S} .oc-badge-error { color: var(--text-critical); }
${S} .oc-color-editor-icon { flex-shrink: 0; }
${S} .oc-icon-success { color: var(--text-success); }

/* ── Spacing Editor (box model) ── */
${S} .oc-spacing-editor {
  padding: 8px 0;
}
${S} .oc-spacing-box {
  text-align: center; font-family: var(--font-mono); font-size: 11px;
  position: relative;
}
${S} .oc-spacing-margin-box {
  background: var(--tint-warning-soft); border: 1px solid var(--tint-warning-border);
  border-radius: 8px; padding: 6px;
}
${S} .oc-spacing-padding-box {
  background: var(--tint-success-soft); border: 1px solid var(--tint-success-border);
  border-radius: 6px; padding: 6px;
}
${S} .oc-spacing-content {
  background: var(--tint-accent-soft); border: 1px solid var(--tint-accent-border);
  border-radius: 4px; padding: 8px 4px;
  min-width: 60px;
}
${S} .oc-spacing-content-label { font-size: 10px; color: var(--accent); }
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
${S} .oc-spacing-value:hover { background: var(--tint-hover-strong); }
${S} .oc-spacing-input {
  width: 36px; text-align: center; padding: 1px 2px;
  background: var(--surface-0); border: 1px solid var(--ring-focus);
  border-radius: 4px; color: var(--text-primary);
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
  border-radius: 4px; padding: 4px 6px; color: var(--text-primary);
  font-size: 11px; font-family: var(--font-mono); outline: none;
  cursor: pointer; width: 100%;
}
${S} .oc-typo-select:focus { border-color: var(--ring-focus); }
${S} .oc-typo-input {
  background: var(--surface-1); border: 1px solid var(--border-default);
  border-radius: 4px; padding: 4px 6px; color: var(--text-primary);
  font-size: 11px; font-family: var(--font-mono); outline: none;
  width: 100%;
}
${S} .oc-typo-input:focus { border-color: var(--ring-focus); }
${S} .oc-typo-value {
  cursor: pointer; padding: 4px 6px; border-radius: 4px;
  font-size: 11px; font-family: var(--font-mono);
  color: var(--text-primary);
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
  color: var(--text-muted); cursor: pointer;
  transition: all 0.15s;
}
${S} .oc-typo-align-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}
${S} .oc-typo-align-btn.is-active {
  background: var(--accent);
  color: var(--text-on-accent);
  border-color: var(--accent);
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
  background: var(--surface-2); color: var(--text-muted);
}
${S} .oc-feedback-badge[data-intent="fix"] { background: var(--tint-critical-soft); color: var(--text-critical); }
${S} .oc-feedback-badge[data-intent="change"] { background: var(--tint-warning-soft); color: var(--text-warning); }
${S} .oc-feedback-badge[data-intent="question"] { background: var(--tint-accent-soft); color: var(--text-info); }
${S} .oc-feedback-badge[data-intent="approve"] { background: var(--tint-success-soft); color: var(--text-success); }
${S} .oc-feedback-badge[data-severity="blocking"] { background: var(--tint-critical-soft); color: var(--text-critical); }
${S} .oc-feedback-badge[data-severity="important"] { background: var(--tint-warning-soft); color: var(--text-warning); }
${S} .oc-feedback-badge[data-severity="suggestion"] { background: var(--tint-accent-soft); color: var(--text-info); }
${S} .oc-feedback-selector {
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-muted);
}
${S} .oc-feedback-comment {
  font-size: 12px; color: var(--text-primary);
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
  color: var(--text-muted);
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
  color: var(--text-muted);
  cursor: pointer; transition: all 0.12s;
  display: flex; align-items: center; justify-content: center;
  white-space: nowrap; font-weight: 500;
}
${S} .oc-segmented-btn:hover {
  color: var(--text-primary);
  background: var(--tint-hover);
}
${S} .oc-segmented-btn.is-active {
  background: var(--accent);
  color: var(--text-on-accent);
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
  background: var(--surface-0); border: 1px solid var(--ring-focus);
  border-radius: 4px; padding: 2px 4px;
  color: var(--text-primary);
  font-size: 10px; font-family: var(--font-mono); outline: none;
  text-align: center;
}
${S} .oc-num-value {
  flex: 1; text-align: center; cursor: pointer;
  padding: 2px 4px; border-radius: 4px;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-primary);
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
  border-radius: 50%; background: var(--text-primary);
  border: 2px solid var(--surface-0); cursor: grab;
}
${S} .oc-slider-value {
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-muted);
  min-width: 32px; text-align: right;
}

/* ── Toggle button (small) ── */
${S} .oc-toggle-btn-sm {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: 1px solid var(--border-default);
  border-radius: 4px; background: var(--surface-1);
  color: var(--text-muted); cursor: pointer;
  transition: all 0.12s;
}
${S} .oc-toggle-btn-sm:hover { background: var(--surface-2); }
${S} .oc-toggle-btn-sm.is-active {
  background: var(--accent);
  color: var(--text-on-accent);
  border-color: var(--accent);
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
${S} .oc-align-dot:hover { border-color: var(--text-muted); }
${S} .oc-align-dot:hover::after { opacity: 0.6; }
${S} .oc-align-dot.is-active {
  border-color: var(--accent);
  background: var(--tint-accent-weak);
}
${S} .oc-align-dot.is-active::after {
  background: var(--accent); opacity: 1;
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
  color: var(--text-primary);
  background: var(--surface-1);
  border: 1px solid transparent; transition: border-color 0.12s;
}
${S} .oc-radius-value:hover { border-color: var(--border-default); }
${S} .oc-radius-input {
  width: 36px; text-align: center; padding: 2px;
  background: var(--surface-0); border: 1px solid var(--ring-focus);
  border-radius: 4px; color: var(--text-primary);
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
  color: var(--text-primary);
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

${S} .oc-chat { background: var(--surface-1); }

/* ── Header: title + open + menu ───────────────────────── */
${S} .oc-chat-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px 10px;
}
${S} .oc-chat-title {
  flex: 1; font-size: 15px; font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-chat-header-actions {
  display: flex; align-items: center; gap: 2px;
}
${S} .oc-chat-headerbtn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 8px 4px 10px;
  background: var(--tint-hover);
  border: none; border-radius: 9999px;
  color: var(--text-primary);
  font-family: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease;
}
${S} .oc-chat-headerbtn:hover { background: var(--tint-hover-strong); }
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
  color: var(--text-primary);
  font-family: inherit; font-size: 12px;
  text-align: left; cursor: pointer;
}
${S} .oc-slash-item:hover,
${S} .oc-slash-item:hover,
${S} .oc-slash-item:hover,
${S} .oc-slash-item:hover,
${S} .oc-slash-item.is-active {
  background: var(--surface-2);
}
${S} .oc-slash-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
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
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  transition: border-color 120ms ease;
  /* Intentionally not overflow:hidden — the toolbar's dropdown
   * menus (Effort / Permission / Model) anchor inside the card and
   * need to escape its bounds to render fully. */
}
${S} .oc-chat-composer-card:focus-within {
  border-color: var(--tint-accent-border);
}
${S} .oc-chat-composer-input {
  width: 100%; box-sizing: border-box;
  background: transparent; border: none;
  padding: 12px 14px 4px;
  color: var(--text-primary);
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
  color: var(--text-muted);
  font-family: inherit; font-size: 11px; font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-chat-toolbar-pill:hover {
  background: var(--tint-hover);
  color: var(--text-primary);
}
${S} .oc-chat-toolbar-pill.is-skill {
  padding-left: 5px; gap: 6px;
}
${S} .oc-chat-toolbar-pill.is-readonly {
  cursor: default;
}
${S} .oc-chat-toolbar-pill.is-readonly:hover {
  background: transparent;
  color: var(--text-muted);
}
${S} .oc-chat-toolbar-caret {
  color: var(--text-muted);
  opacity: 0.7;
}
${S} .oc-chat-skill-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 6px;
  background: var(--tint-accent-soft);
  color: var(--accent-hover);
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
  color: var(--text-primary);
  font-family: inherit; text-align: left;
  cursor: pointer;
}
${S} .oc-chat-skill-item:hover,
${S} .oc-chat-skill-item:hover,
${S} .oc-chat-skill-item:hover,
${S} .oc-chat-skill-item:hover,
${S} .oc-chat-skill-item.is-active {
  background: var(--surface-2);
}
${S} .oc-chat-skill-item.is-active {
  color: var(--accent-hover);
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
  color: var(--text-primary);
  font-family: inherit; text-align: left;
  cursor: pointer;
  position: relative;
  padding-right: 24px;
}
${S} .oc-chat-dropdown-item:hover { background: var(--surface-2); }
${S} .oc-chat-dropdown-item.is-active {
  background: var(--tint-accent-soft);
  color: var(--accent-hover);
}

/* Agent-picker row: override the default column stack so the logo
   and agent name sit side-by-side (Cursor-style). Flex row with
   center alignment; the trailing slot holds either a check (active
   selected) or a red dot (inactive). */
${S} .oc-chat-dropdown-item.is-agent {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  padding-right: 24px;
}
${S} .oc-chat-dropdown-item.is-agent.is-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
${S} .oc-chat-dropdown-item.is-agent.is-disabled:hover {
  background: transparent;
}

/* Agent logo — inline-SVG renderer (AgentIcon) injects branded fills
   via the agent-brands palette. The container is a flex box; the
   inner SVG stretches to its bounds. */
${S} .oc-chat-agent-pill-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
${S} .oc-chat-agent-pill-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* Compact trigger — logo-only, with a small warm/cold dot sitting
   at the bottom-right corner of the logo. Shown in both empty
   composer and active chat footers. */
${S} .oc-agent-trigger--compact {
  padding: 4px 6px;
  gap: 4px;
}
${S} .oc-agent-trigger__logo {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}
${S} .oc-agent-trigger__dot {
  position: absolute;
  right: -1px; bottom: -1px;
  width: 7px; height: 7px;
  border-radius: 50%;
  border: 1.5px solid var(--surface-1);
  flex-shrink: 0;
}
${S} .oc-agent-trigger__dot.is-warm {
  background: var(--text-success, #22c55e);
}
${S} .oc-agent-trigger__dot.is-cold {
  background: var(--text-muted);
  opacity: 0.55;
}

/* Dropdown-row warm/cold dot — sits before the "new tab" arrow,
   same green as the trigger. */
${S} .oc-agent-row-dot {
  margin-left: auto;
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
${S} .oc-agent-row-dot.is-warm {
  background: var(--text-success, #22c55e);
}
${S} .oc-agent-row-dot.is-cold {
  background: var(--text-muted);
  opacity: 0.4;
}

/* Hover-only "opens in new tab" arrow on dropdown rows in chat view. */
${S} .oc-agent-row-newtab {
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 120ms ease;
  flex-shrink: 0;
}
${S} .oc-chat-dropdown-item:hover .oc-agent-row-newtab {
  opacity: 0.75;
}

/* Non-signed-in agents in the composer dropdown get a subtle "Sign
   in" chip on the right instead of a red dot — less alarming, more
   actionable. Click routes to Settings → Agents. */
${S} .oc-chat-dropdown-item.is-inactive {
  opacity: 0.85;
}
${S} .oc-chat-dropdown-item.is-inactive .oc-chat-dropdown-item-label {
  color: var(--text-muted);
}
${S} .oc-chat-agent-inactive-hint {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--text-muted);
  background: var(--surface-2);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
${S} .oc-chat-dropdown-item.is-inactive:hover .oc-chat-agent-inactive-hint {
  color: var(--text-primary);
  background: var(--surface-3);
}
${S} .oc-chat-dropdown-item-hint--clickable {
  cursor: pointer;
  text-align: left;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-muted);
}
${S} .oc-chat-dropdown-item-hint--clickable:hover {
  color: var(--text-primary);
}
${S} .oc-chat-dropdown-item-label { font-size: 12px; font-weight: 500; line-height: 1.3; }
${S} .oc-chat-dropdown-item-hint {
  font-size: 11px; color: var(--text-muted); line-height: 1.3;
}
${S} .oc-chat-dropdown-item-check {
  position: absolute; right: 8px; top: 8px;
  color: var(--accent-hover);
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
  padding: 1px 5px; border-radius: var(--radius-xs);
  background: var(--tint-warning-soft);
  color: var(--text-warning);
  font-size: var(--text-10); font-weight: var(--weight-heading); letter-spacing: 0.03em;
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
  background: var(--tint-hover);
  color: var(--text-primary);
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
  background: var(--tint-success-soft); border: 1px solid var(--tint-success-border);
  font-size: 10px; color: var(--text-success);
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
  color: var(--text-muted);
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
  accent-color: var(--accent);
  cursor: pointer; margin: 0;
}
${S} .oc-ai-diff-prop {
  color: var(--text-primary);
  white-space: nowrap; flex-shrink: 0;
  font-weight: 500;
}
${S} .oc-ai-diff-old {
  color: var(--text-critical); text-decoration: line-through;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 70px;
}
${S} .oc-ai-diff-arrow {
  color: var(--text-muted); flex-shrink: 0;
}
${S} .oc-ai-diff-new {
  color: var(--text-success); font-weight: 500;
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
  letter-spacing: 0.5px; color: var(--text-primary);
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
  color: var(--text-primary);
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
  font-size: 11px; color: var(--text-muted); font-weight: 500;
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
  border-color: var(--ring-focus);
  color: var(--text-primary);
}
${S} .oc-token-suggest-dropdown {
  position: absolute; top: 100%; left: -4px; z-index: 100;
  margin-top: 4px; min-width: 160px; max-width: 200px;
  background: var(--surface-0); border: 1px solid var(--border-default);
  border-radius: 6px; box-shadow: var(--shadow-md);
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
  color: var(--text-primary);
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
  border-radius: 6px; box-shadow: var(--shadow-md);
  overflow: hidden; max-height: 156px; overflow-y: auto;
}
${S} .oc-autocomplete-item {
  display: block; width: 100%; padding: 4px 8px; border: none;
  background: none; cursor: pointer; text-align: left;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-primary);
  transition: background 0.08s;
}
${S} .oc-autocomplete-item:hover,
${S} .oc-autocomplete-item:hover,
${S} .oc-autocomplete-item:hover,
${S} .oc-autocomplete-item:hover,
${S} .oc-autocomplete-item.is-highlighted {
  background: var(--surface-1);
  color: var(--text-primary);
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
  border-radius: 4px; padding: 3px 6px; color: var(--text-primary);
  font-size: 10px; font-family: var(--font-mono);
  outline: none; cursor: pointer; appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%23737373' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  padding-right: 20px;
}
${S} .oc-effects-select:focus {
  border-color: var(--ring-focus);
}
${S} .oc-effects-select option {
  background: var(--surface-0); color: var(--text-primary);
}

/* ── Toggle Switch ── */

/* ── Auto-send Notification ── */
@keyframes oc-notification-in {
  from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* ═══════════════════════════════════════════════════════════
   Agent chat surface — legacy oc-agent-* class namespace
   ═══════════════════════════════════════════════════════════
   Styles for the agent chat, agents picker, auth modal, tool cards,
   receipts, permission bar, and mention menu. Rides the same design
   tokens as the legacy oc-chat-* surface so the two modes feel like
   parts of one product, not two bolted-together UIs. Wraps any Tailwind
   utility classes inside the component — structural layout is still
   Tailwind, colors and typography sit on tokens here. */

${S} .oc-agent-surface {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
}
${S} .oc-agent-subheader {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-agent-subheader-title {
  font-size: 12px; font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.005em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-agent-subheader-sub {
  font-size: 10.5px;
  color: var(--text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: flex; align-items: center; gap: 6px;
}
${S} .oc-agent-subheader-agent {
  color: var(--text-muted);
  font-weight: 500;
}
${S} .oc-agent-subheader-agent + .oc-agent-subheader-status:not(:empty)::before {
  content: "·"; margin: 0 2px 0 -2px; color: var(--text-muted);
}
${S} .oc-agent-subheader-status:empty { display: none; }
${S} .oc-agent-body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 12px;
  background: transparent;
}

/* ── Plan panel — rendered when the agent emits session/update plan ─ */
${S} .oc-agent-plan {
  border-bottom: 1px solid var(--border-subtle);
  background: var(--tint-accent-weak);
}
${S} .oc-agent-plan-head {
  all: unset;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  width: 100%; box-sizing: border-box;
  font-size: 11px; color: var(--text-muted);
}
${S} .oc-agent-plan-head:hover { background: var(--tint-accent-soft); }
${S} .oc-agent-plan-title {
  font-weight: 600;
  color: var(--text-info);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  font-size: 10px;
}
${S} .oc-agent-plan-count {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  color: var(--text-placeholder);
}
${S} .oc-agent-plan-list {
  list-style: none; margin: 0; padding: 0 12px 10px;
  display: flex; flex-direction: column; gap: 4px;
}
${S} .oc-agent-plan-item {
  display: flex; gap: 8px; align-items: flex-start;
  font-size: 12px; line-height: 1.45;
  color: var(--text-primary);
  padding: 3px 0;
}
${S} .oc-agent-plan-bullet {
  flex-shrink: 0;
  width: 14px; display: inline-block;
  color: var(--text-placeholder);
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-plan-item-completed { color: var(--text-muted); }
${S} .oc-agent-plan-item-completed .oc-agent-plan-desc {
  text-decoration: line-through;
  text-decoration-color: var(--border-subtle);
}
${S} .oc-agent-plan-item-completed .oc-agent-plan-bullet { color: var(--text-success); }
${S} .oc-agent-plan-item-in_progress .oc-agent-plan-bullet { color: var(--text-info); }
${S} .oc-agent-plan-desc { flex: 1; min-width: 0; word-break: break-word; }

/* ── Messages (agent chat variant of oc-ai-msg) ─────────── */
${S} .oc-agent-messages {
  display: flex; flex-direction: column; gap: 14px;
}

/* ── Turn container — Phase 1 §2.5.1 ─────────────────────── */
/* Each turn (user prompt + subsequent agent events until the
   next user prompt) is wrapped in a turn container so the
   active turn's prompt can sticky-pin to the viewport top. */
${S} .oc-agent-turn {
  display: flex; flex-direction: column; gap: 14px;
}
${S} .oc-agent-turn + .oc-agent-turn {
  margin-top: 6px;
}
/* The .oc-agent-turn-active modifier (applied to the most
   recent turn) establishes the layout context for the sticky
   prompt header. position: relative is what scopes z-index
   without affecting layout. */
${S} .oc-agent-turn-active {
  position: relative;
}
/* Sticky-positioned wrapper for the active turn's user prompt.
   Sticks to the top of the .oc-agent-body scroll container
   while the user is anywhere within the active turn. Once a
   new turn starts (the user sends a new prompt), the previous
   turn drops the .oc-agent-turn-active class and this wrapper
   is no longer rendered around its prompt; it scrolls naturally. */
${S} .oc-agent-turn-prompt-sticky {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--surface-1, var(--surface-2));
  /* Subtle separator so the pinned prompt visually detaches
     from the streaming content scrolling under it. */
  padding-bottom: 8px;
  margin-bottom: -2px;
  border-bottom: 1px solid var(--border-subtle);
  /* Slight backdrop blur catches any text that lands behind the
     sticky bubble during fast scroll without a hard fill flash. */
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
${S} .oc-agent-turn-prompt-sticky .oc-agent-msg {
  margin: 0;
}

/* ── Jump pills — Phase 1 §2.5.2 ─────────────────────────── */
/* Floating affordances for "jump to your prompt" (top-right)
   and "jump to latest" (bottom-right). Positioned absolutely
   over the scroll container; fade in/out via opacity. */
${S} .oc-agent-jump-pill {
  position: absolute;
  right: 14px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--surface-2, rgba(0, 0, 0, 0.7));
  color: var(--text-primary, #fff);
  border: 1px solid var(--border-subtle);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  /* Fade in. The pills only mount when their show-condition is
     true, so the fade is one-direction (in). Unmount snaps
     out — fine since the show-condition flips once the user
     has clicked. */
  animation: ocAgentJumpPillIn 140ms ease-out;
}
${S} .oc-agent-jump-pill:hover {
  background: var(--surface-3, rgba(0, 0, 0, 0.85));
}
${S} .oc-agent-jump-pill-top { top: 12px; }
${S} .oc-agent-jump-pill-bottom { bottom: 16px; }
@keyframes ocAgentJumpPillIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* No avatar column — messages are distinguished by layout +
   bubble only (Cursor pattern). The role modifiers below own
   alignment, background and max-width. */
${S} .oc-agent-msg {
  display: flex;
  align-items: flex-start;
}
${S} .oc-agent-msg-icon { display: none; }
${S} .oc-agent-msg-content {
  font-size: 13px; line-height: 1.55;
  color: var(--text-primary);
  min-width: 0;
  max-width: 100%;
  white-space: pre-wrap; word-break: break-word;
}

/* User bubble — right-aligned, subtle surface-0 card with tight
   padding so a one-line prompt reads as a distinct message. */
${S} .oc-agent-msg-user {
  justify-content: flex-end;
}
${S} .oc-agent-msg-user .oc-agent-msg-content {
  background: var(--surface-0);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 8px 12px;
  max-width: min(78%, 640px);
}

/* Assistant + system + thought — flat text, no bubble. */
${S} .oc-agent-msg-assistant .oc-agent-msg-content,
${S} .oc-agent-msg-system .oc-agent-msg-content,
${S} .oc-agent-msg-thought .oc-agent-msg-content {
  max-width: 100%;
  padding: 0;
}
${S} .oc-agent-msg-system .oc-agent-msg-content {
  color: var(--text-muted);
  font-size: 12px;
}
${S} .oc-agent-msg-thought .oc-agent-msg-content {
  color: var(--text-muted);
  font-style: italic;
  border-left: 2px solid var(--border-subtle);
  padding-left: 10px;
}

${S} .oc-agent-msg-queued { opacity: 0.72; }
${S} .oc-agent-msg-queued-hint {
  margin-top: 6px;
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px;
  color: var(--text-placeholder);
  font-style: italic;
}

/* ── Tool card ─────────────────────────────────────────── */
${S} .oc-agent-tool {
  border: 1px solid var(--border-subtle);
  background: var(--surface-2);
  border-radius: 10px; overflow: hidden;
}
${S} .oc-agent-tool-design {
  border-color: var(--tint-success-border);
  background: var(--tint-success-weak);
}
${S} .oc-agent-tool-subagent {
  border-color: var(--tint-accent-border);
  background: var(--tint-accent-weak);
}
${S} .oc-agent-tool-subagent .oc-agent-tool-icon { color: var(--text-info); }
${S} .oc-agent-tool-subagent .oc-agent-tool-vendor {
  color: var(--text-info);
}
${S} .oc-agent-tool-head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
}
${S} .oc-agent-tool-icon { flex-shrink: 0; color: var(--text-muted); }
${S} .oc-agent-tool-design .oc-agent-tool-icon { color: var(--text-success); }
${S} .oc-agent-tool-body { min-width: 0; flex: 1; }
${S} .oc-agent-tool-title {
  font-size: 11.5px; font-weight: 500;
  color: var(--text-primary);
  display: flex; align-items: center; gap: 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-agent-tool-vendor {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-success);
  font-weight: 400;
}
${S} .oc-agent-tool-summary {
  font-size: 10.5px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  margin-top: 2px;
}
${S} .oc-agent-tool-kind {
  font-size: 10px; color: var(--text-placeholder); margin-top: 2px;
}
${S} .oc-agent-tool-status { flex-shrink: 0; }

/* ── Tool content payload (pre-receipt) ────────────────── */
${S} .oc-agent-tool-content {
  border-top: 1px solid var(--border-subtle);
  padding: 8px 10px;
  font-size: 11px; color: var(--text-muted);
}
${S} .oc-agent-tool-content pre {
  font-family: var(--font-mono); font-size: 10.5px;
  color: var(--text-muted);
  max-height: 160px; overflow: auto;
  white-space: pre-wrap; word-break: break-word;
  margin: 0;
}
${S} .oc-agent-tool-content-diff {
  font-size: 10.5px; color: var(--text-muted);
}
${S} .oc-agent-tool-content-diff .oc-agent-mono {
  font-family: var(--font-mono); color: var(--text-placeholder);
  margin-right: 6px;
}

/* ── Apply-change receipt ──────────────────────────────── */
${S} .oc-agent-receipt {
  border-top: 1px solid var(--border-subtle);
  background: var(--tint-black-soft);
}
${S} .oc-agent-receipt-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  font-size: 10px; color: var(--text-muted);
  gap: 8px;
}
${S} .oc-agent-receipt-selector {
  font-family: var(--font-mono);
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-agent-receipt-tag {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-placeholder);
  flex-shrink: 0;
}
${S} .oc-agent-receipt-diff {
  font-family: var(--font-mono); font-size: 10.5px;
  border-top: 1px solid var(--border-subtle);
}
${S} .oc-agent-receipt-row {
  display: flex; gap: 8px;
  padding: 5px 10px;
}
${S} .oc-agent-receipt-row-before { color: var(--text-critical); }
${S} .oc-agent-receipt-row-before .oc-agent-receipt-sign {
  color: var(--text-critical); flex-shrink: 0; opacity: 0.6;
}
${S} .oc-agent-receipt-row-after { color: var(--text-success); }
${S} .oc-agent-receipt-row-after .oc-agent-receipt-sign {
  color: var(--text-success); flex-shrink: 0; opacity: 0.7;
}
${S} .oc-agent-receipt-row-failed {
  color: var(--text-disabled);
  text-decoration: line-through;
}
${S} .oc-agent-receipt-row-failed .oc-agent-receipt-sign {
  color: var(--text-placeholder); text-decoration: none; flex-shrink: 0;
}
${S} .oc-agent-receipt-value {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
${S} .oc-agent-receipt-value-unset {
  font-style: italic; color: var(--text-placeholder); text-decoration: none;
}
${S} .oc-agent-receipt-source {
  padding: 5px 10px;
  font-size: 9.5px; font-family: var(--font-mono);
  color: var(--text-placeholder);
  border-top: 1px solid var(--border-subtle);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Stage 3: Shell card ──────────────────────────────── */
${S} .oc-agent-tool-shell {
  container-type: inline-size;
}
${S} .oc-agent-shell-head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  background: transparent; border: 0; width: 100%;
  text-align: left; cursor: pointer;
  color: inherit;
}
${S} .oc-agent-shell-head:hover { background: var(--tint-black-soft); }
${S} .oc-agent-tool-shell .oc-agent-tool-icon { color: var(--text-muted); }
${S} .oc-agent-shell-cmd {
  font-family: var(--font-mono); font-size: 11.5px;
  color: var(--text-primary);
  display: flex; align-items: center; gap: 6px;
  overflow: hidden; min-width: 0;
}
${S} .oc-agent-shell-prompt {
  color: var(--text-placeholder); flex-shrink: 0;
}
${S} .oc-agent-shell-cmd-text {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
${S} .oc-agent-shell-preview {
  font-family: var(--font-mono); font-size: 10.5px;
  color: var(--text-muted);
  margin-top: 3px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-agent-shell-meta {
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
${S} .oc-agent-shell-duration {
  font-size: 10px; color: var(--text-placeholder);
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-shell-status {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 2px 6px; border-radius: 4px;
  font-family: var(--font-mono);
}
${S} .oc-agent-shell-status-ok {
  background: var(--tint-success-weak); color: var(--text-success);
}
${S} .oc-agent-shell-status-fail {
  background: var(--tint-critical-weak); color: var(--text-critical);
}
${S} .oc-agent-shell-status-run {
  background: var(--tint-info-weak); color: var(--text-info);
}
${S} .oc-agent-shell-content {
  border-top: 1px solid var(--border-subtle);
  background: #0d1117;
}
${S} .oc-agent-shell-cwd {
  display: flex; gap: 6px; align-items: center;
  padding: 4px 10px;
  font-size: 9.5px; font-family: var(--font-mono);
  color: rgba(230, 237, 243, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
${S} .oc-agent-shell-cwd-label {
  text-transform: uppercase; letter-spacing: 0.04em;
  opacity: 0.7;
}
${S} .oc-agent-shell-cwd-path {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
${S} .oc-agent-shell-empty {
  padding: 10px 12px;
  color: rgba(230, 237, 243, 0.5);
  font-family: var(--font-mono); font-size: 11px;
}
${S} .oc-agent-shell-large {
  display: block; width: 100%;
  padding: 12px; background: transparent; border: 0;
  color: rgba(230, 237, 243, 0.7);
  font-family: var(--font-mono); font-size: 11px;
  cursor: pointer; text-align: center;
}
${S} .oc-agent-shell-large:hover { background: rgba(255, 255, 255, 0.04); }
${S} .oc-agent-shell-xterm {
  padding: 6px 8px;
}

/* ── Stage 3: Edit card ───────────────────────────────── */
${S} .oc-agent-tool-edit {
  container-type: inline-size;
}
${S} .oc-agent-edit-head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  background: transparent; border: 0; width: 100%;
  text-align: left; cursor: pointer;
  color: inherit;
}
${S} .oc-agent-edit-head:hover { background: var(--tint-black-soft); }
${S} .oc-agent-edit-path {
  font-family: var(--font-mono); font-size: 11.5px;
  color: var(--text-primary);
  display: flex; align-items: center; gap: 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
${S} .oc-agent-edit-newfile {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-success);
  padding: 1px 5px; border-radius: 3px;
  background: var(--tint-success-weak);
  flex-shrink: 0;
}
${S} .oc-agent-edit-meta {
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
${S} .oc-agent-edit-counts {
  display: flex; gap: 4px;
  font-family: var(--font-mono); font-size: 10px;
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-edit-add { color: var(--text-success); }
${S} .oc-agent-edit-rem { color: var(--text-critical); }
${S} .oc-agent-edit-duration {
  font-size: 10px; color: var(--text-placeholder);
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-edit-status {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 2px 6px; border-radius: 4px;
  font-family: var(--font-mono);
}
${S} .oc-agent-edit-status-ok {
  background: var(--tint-success-weak); color: var(--text-success);
}
${S} .oc-agent-edit-status-fail {
  background: var(--tint-critical-weak); color: var(--text-critical);
}
${S} .oc-agent-edit-status-run {
  background: var(--tint-info-weak); color: var(--text-info);
}
${S} .oc-agent-edit-content {
  border-top: 1px solid var(--border-subtle);
  background: #0d1117;
}
${S} .oc-agent-edit-empty {
  padding: 10px 12px;
  color: rgba(230, 237, 243, 0.5);
  font-family: var(--font-mono); font-size: 11px;
}
${S} .oc-agent-edit-diffroot {
  font-family: var(--font-mono); font-size: 11px;
  color: #e6edf3;
  max-height: 480px; overflow: auto;
}
${S} .oc-agent-edit-diffroot-empty {
  padding: 12px; color: rgba(230, 237, 243, 0.5);
}
${S} .oc-agent-edit-hunk + .oc-agent-edit-hunk {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
${S} .oc-agent-edit-hunk-head {
  padding: 4px 12px;
  font-size: 10px; color: rgba(139, 148, 158, 0.9);
  background: rgba(255, 255, 255, 0.02);
}
${S} .oc-agent-edit-line {
  display: flex; align-items: stretch;
  white-space: pre;
}
${S} .oc-agent-edit-line-ctx { color: rgba(230, 237, 243, 0.7); }
${S} .oc-agent-edit-line-add {
  background: rgba(46, 160, 67, 0.18);
}
${S} .oc-agent-edit-line-rem {
  background: rgba(248, 81, 73, 0.18);
}
${S} .oc-agent-edit-gutter {
  flex-shrink: 0;
  display: inline-block;
  width: 38px; padding: 0 6px;
  text-align: right;
  color: rgba(139, 148, 158, 0.5);
  font-size: 10px;
  user-select: none;
  border-right: 1px solid rgba(255, 255, 255, 0.04);
}
${S} .oc-agent-edit-line-add .oc-agent-edit-gutter:first-child {
  background: rgba(46, 160, 67, 0.10);
}
${S} .oc-agent-edit-line-rem .oc-agent-edit-gutter:first-child {
  background: rgba(248, 81, 73, 0.10);
}
${S} .oc-agent-edit-sign {
  flex-shrink: 0;
  display: inline-block;
  width: 14px; text-align: center;
  color: rgba(139, 148, 158, 0.7);
}
${S} .oc-agent-edit-line-add .oc-agent-edit-sign { color: rgba(46, 160, 67, 1); }
${S} .oc-agent-edit-line-rem .oc-agent-edit-sign { color: rgba(248, 81, 73, 1); }
${S} .oc-agent-edit-text {
  flex: 1;
  padding: 0 8px;
  overflow-wrap: anywhere;
}
${S} .oc-agent-edit-text .shiki,
${S} .oc-agent-edit-text pre,
${S} .oc-agent-edit-text code {
  background: transparent !important;
  margin: 0; padding: 0;
  display: inline;
}

/* ── Stage 3: Read card ───────────────────────────────── */
${S} .oc-agent-tool-read { container-type: inline-size; }
${S} .oc-agent-read-head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  background: transparent; border: 0; width: 100%;
  text-align: left; cursor: pointer;
  color: inherit;
}
${S} .oc-agent-read-head:hover { background: var(--tint-black-soft); }
${S} .oc-agent-read-path {
  font-family: var(--font-mono); font-size: 11.5px;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
${S} .oc-agent-read-meta {
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
${S} .oc-agent-read-range {
  font-size: 10px; color: var(--text-placeholder);
  font-family: var(--font-mono); font-variant-numeric: tabular-nums;
}
${S} .oc-agent-read-duration {
  font-size: 10px; color: var(--text-placeholder);
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-read-status {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 2px 6px; border-radius: 4px;
  font-family: var(--font-mono);
}
${S} .oc-agent-read-status-ok {
  background: var(--tint-success-weak); color: var(--text-success);
}
${S} .oc-agent-read-status-fail {
  background: var(--tint-critical-weak); color: var(--text-critical);
}
${S} .oc-agent-read-status-run {
  background: var(--tint-info-weak); color: var(--text-info);
}
${S} .oc-agent-read-content {
  border-top: 1px solid var(--border-subtle);
  background: #0d1117;
}
${S} .oc-agent-read-empty {
  padding: 10px 12px;
  color: rgba(230, 237, 243, 0.5);
  font-family: var(--font-mono); font-size: 11px;
}
${S} .oc-agent-read-preview {
  max-height: 480px; overflow: auto;
}
${S} .oc-agent-read-code,
${S} .oc-agent-read-code-fallback {
  margin: 0;
  font-family: var(--font-mono); font-size: 11px;
}
${S} .oc-agent-read-code .shiki {
  margin: 0; padding: 8px 12px;
  background: transparent !important;
}
${S} .oc-agent-read-code-fallback {
  padding: 8px 12px;
  color: #e6edf3;
  white-space: pre;
}
${S} .oc-agent-read-more {
  display: block; width: 100%;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 0; border-top: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(230, 237, 243, 0.7);
  font-family: var(--font-mono); font-size: 10.5px;
  cursor: pointer;
}
${S} .oc-agent-read-more:hover { background: rgba(255, 255, 255, 0.05); }

/* ── Stage 4.1: Search card ───────────────────────────── */
${S} .oc-agent-tool-search { container-type: inline-size; }
${S} .oc-agent-search-head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  background: transparent; border: 0; width: 100%;
  text-align: left; cursor: pointer; color: inherit;
}
${S} .oc-agent-search-head:hover { background: var(--tint-black-soft); }
${S} .oc-agent-search-query {
  display: flex; align-items: baseline; gap: 6px;
  overflow: hidden; min-width: 0;
}
${S} .oc-agent-search-tool {
  font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-placeholder);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
${S} .oc-agent-search-pattern {
  font-family: var(--font-mono); font-size: 11.5px;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
${S} .oc-agent-search-scope {
  font-size: 10px; color: var(--text-muted);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
${S} .oc-agent-search-meta {
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
${S} .oc-agent-search-count {
  font-size: 10px; color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-search-duration {
  font-size: 10px; color: var(--text-placeholder);
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-search-status {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 2px 6px; border-radius: 4px;
  font-family: var(--font-mono);
}
${S} .oc-agent-search-status-ok {
  background: var(--tint-success-weak); color: var(--text-success);
}
${S} .oc-agent-search-status-fail {
  background: var(--tint-critical-weak); color: var(--text-critical);
}
${S} .oc-agent-search-status-run {
  background: var(--tint-info-weak); color: var(--text-info);
}
${S} .oc-agent-search-content {
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-1);
}
${S} .oc-agent-search-empty {
  padding: 10px 12px;
  font-size: 11px; color: var(--text-muted);
  font-family: var(--font-mono);
}
${S} .oc-agent-search-list {
  max-height: 360px; overflow: auto;
  padding: 4px 0;
}
${S} .oc-agent-search-group + .oc-agent-search-group {
  margin-top: 6px;
  border-top: 1px solid var(--border-subtle);
  padding-top: 6px;
}
${S} .oc-agent-search-path {
  padding: 4px 12px;
  font-family: var(--font-mono); font-size: 11px;
  color: var(--text-primary);
  background: var(--tint-black-soft);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-agent-search-hits {
  padding: 2px 0;
}
${S} .oc-agent-search-hit {
  display: flex; gap: 8px;
  padding: 2px 12px;
  font-family: var(--font-mono); font-size: 10.5px;
  color: var(--text-muted);
}
${S} .oc-agent-search-line {
  flex-shrink: 0;
  width: 32px;
  text-align: right;
  color: var(--text-placeholder);
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-search-text {
  flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--text-primary);
}
${S} mark.oc-agent-search-match {
  background: var(--tint-warning-weak);
  color: var(--text-primary);
  padding: 0 1px;
  border-radius: 2px;
}
${S} .oc-agent-search-trailing {
  margin: 6px 12px 0;
  padding: 6px 8px;
  background: var(--tint-black-soft);
  border-radius: 4px;
  font-family: var(--font-mono); font-size: 10px;
  color: var(--text-muted);
  white-space: pre-wrap; word-break: break-word;
  max-height: 120px; overflow: auto;
}

/* ── Stage 4.1: Fetch + WebSearch card ────────────────── */
${S} .oc-agent-tool-fetch { container-type: inline-size; }
${S} .oc-agent-fetch-head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  background: transparent; border: 0; width: 100%;
  text-align: left; cursor: pointer; color: inherit;
}
${S} .oc-agent-fetch-head:hover { background: var(--tint-black-soft); }
${S} .oc-agent-fetch-url {
  display: flex; gap: 6px;
  overflow: hidden; min-width: 0;
  font-family: var(--font-mono); font-size: 11.5px;
}
${S} .oc-agent-fetch-host {
  color: var(--text-primary);
  flex-shrink: 0;
}
${S} .oc-agent-fetch-path {
  color: var(--text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
${S} .oc-agent-fetch-query {
  display: flex; align-items: baseline; gap: 6px;
  overflow: hidden; min-width: 0;
}
${S} .oc-agent-fetch-tool {
  font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-placeholder);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
${S} .oc-agent-fetch-querytext {
  font-family: var(--font-mono); font-size: 11.5px;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
${S} .oc-agent-fetch-meta {
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
${S} .oc-agent-fetch-count {
  font-size: 10px; color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-fetch-duration {
  font-size: 10px; color: var(--text-placeholder);
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-fetch-status {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 2px 6px; border-radius: 4px;
  font-family: var(--font-mono);
}
${S} .oc-agent-fetch-status-ok {
  background: var(--tint-success-weak); color: var(--text-success);
}
${S} .oc-agent-fetch-status-fail {
  background: var(--tint-critical-weak); color: var(--text-critical);
}
${S} .oc-agent-fetch-status-run {
  background: var(--tint-info-weak); color: var(--text-info);
}
${S} .oc-agent-fetch-content {
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-1);
  max-height: 480px; overflow: auto;
}
${S} .oc-agent-fetch-empty {
  padding: 10px 12px;
  font-size: 11px; color: var(--text-muted);
  font-family: var(--font-mono);
}
${S} .oc-agent-fetch-body {
  margin: 0;
  padding: 8px 12px;
  font-family: var(--font-mono); font-size: 10.5px;
  color: var(--text-muted);
  white-space: pre-wrap; word-break: break-word;
}
${S} .oc-agent-fetch-hits {
  list-style: none; margin: 0; padding: 0;
}
${S} .oc-agent-fetch-hit {
  padding: 8px 12px;
  border-top: 1px solid var(--border-subtle);
}
${S} .oc-agent-fetch-hit:first-child { border-top: 0; }
${S} .oc-agent-fetch-hit-title {
  font-size: 11.5px; font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}
${S} .oc-agent-fetch-hit-url {
  font-family: var(--font-mono); font-size: 10px;
  color: var(--text-info);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-agent-fetch-hit-snippet {
  font-size: 11px; color: var(--text-muted);
  margin-top: 3px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Stage 4.1: Thinking block ────────────────────────── */
${S} .oc-agent-thinking {
  margin: 4px 0;
  border-radius: 6px;
  background: var(--tint-black-soft);
  border: 1px solid transparent;
  transition: border-color 0.2s ease, background 0.2s ease;
}
/* In-flight wrapper — same chrome as the resting state, no border /
 * no background tint / no glow. The shimmer + icon pulse + ticking
 * duration carry the "thinking right now" signal on their own. */
${S} .oc-agent-thinking-flight {
  border-color: transparent;
  background: var(--tint-black-soft);
}
${S} .oc-agent-thinking-head {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: transparent; border: 0; width: 100%;
  text-align: left; cursor: pointer; color: inherit;
  font-size: 11px;
}
${S} .oc-agent-thinking-head:hover { background: var(--tint-black-strong); }
${S} .oc-agent-thinking-head:disabled {
  cursor: default;
  opacity: 0.7;
}
${S} .oc-agent-thinking-chev {
  color: var(--text-placeholder);
  flex-shrink: 0;
}
${S} .oc-agent-thinking-icon {
  color: var(--text-placeholder);
  flex-shrink: 0;
}
${S} .oc-agent-thinking-flight .oc-agent-thinking-icon {
  color: var(--text-muted);
  animation: ocAgentThinkingIconPulse 1.6s ease-in-out infinite;
}
@keyframes ocAgentThinkingIconPulse {
  0%, 100% { transform: scale(1);    opacity: 0.8; }
  50%      { transform: scale(1.12); opacity: 1;   }
}
${S} .oc-agent-thinking-label {
  color: var(--text-muted);
  font-style: italic;
}
${S} .oc-agent-thinking-shimmer {
  font-style: italic;
  font-weight: 500;
  background: linear-gradient(
    90deg,
    var(--text-muted) 0%,
    var(--text-primary) 50%,
    var(--text-muted) 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ocAgentThinkingShimmer 2s linear infinite;
}
@keyframes ocAgentThinkingShimmer {
  0%   { background-position: 200% 0%; }
  100% { background-position: -200% 0%; }
}
${S} .oc-agent-thinking-count {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-placeholder);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-thinking-elapsed {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
${S} .oc-agent-thinking-body {
  padding: 0 12px 10px 32px;
  font-size: 11.5px;
  font-style: italic;
  color: var(--text-muted);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Permission bar (low / high risk) ──────────────────── */
${S} .oc-agent-perm {
  border-top: 1px solid var(--border-subtle);
  padding: 12px;
}
${S} .oc-agent-perm-head {
  display: flex; align-items: flex-start; gap: 8px;
}
${S} .oc-agent-perm-icon { margin-top: 2px; flex-shrink: 0; }
${S} .oc-agent-perm-title {
  font-size: 12px; font-weight: 500;
}
${S} .oc-agent-perm-body {
  font-size: 11px; color: var(--text-muted);
  margin-top: 2px;
}
${S} .oc-agent-perm-diff {
  margin-top: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--tint-black-soft);
  border-radius: 6px; overflow: hidden;
  font-family: var(--font-mono); font-size: 10.5px;
}
${S} .oc-agent-perm-actions {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 10px;
}
${S} .oc-agent-perm-btn {
  font-size: 11px; padding: 5px 10px; border-radius: 6px;
  border: none; cursor: pointer; font-family: inherit;
  transition: background 120ms ease;
}
${S} .oc-agent-perm-btn-cancel {
  margin-left: auto;
  background: var(--tint-hover);
  color: var(--text-muted);
}
${S} .oc-agent-perm-btn-cancel:hover { background: var(--tint-hover-strong); }

/* ── Composer (single card: input + toolbar) ──────────── */
${S} .oc-agent-composer {
  /* Background stays transparent so it sits on the column's
     surface-floor. The visible card is the inner composer-card
     (surface-2, with focus ring). */
  background: transparent;
  border-top: none;
  padding: 10px 12px 14px;
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
${S} .oc-agent-composer-card {
  position: relative;
  display: flex; flex-direction: column;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  transition: border-color 120ms ease, background 120ms ease,
              box-shadow 120ms ease;
  padding: 6px 8px 6px 12px;
}
${S} .oc-agent-composer-card:focus-within {
  border-color: var(--ring-focus);
  box-shadow: 0 0 0 2px var(--accent-soft-bg);
}
${S} .oc-agent-composer-input {
  width: 100%;
  min-height: 26px;
  max-height: 280px;
  resize: none;
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  padding: 6px 0 !important;
  box-shadow: none !important;
  color: var(--text-primary);
  font-size: 13px; font-family: inherit;
  outline: none;
  line-height: 1.5;
}
${S} .oc-agent-composer-input:focus,
${S} .oc-agent-composer-input:focus-visible {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
  background: transparent !important;
}
${S} .oc-agent-composer-input::placeholder { color: var(--text-muted); }
${S} .oc-agent-composer-input:disabled { opacity: 0.5; }

${S} .oc-agent-composer-toolbar {
  display: flex; align-items: center;
  gap: 4px;
  padding: 4px 0 2px;
  min-width: 0;
}

${S} .oc-agent-attachments {
  display: flex; flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
${S} .oc-agent-attachment {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 8px 3px 6px;
  background: var(--accent-soft-bg);
  color: var(--accent-hover);
  border: 1px solid var(--tint-accent-border);
  border-radius: 999px;
  font-size: 11px;
  max-width: 220px;
}
${S} .oc-agent-attachment-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  min-width: 0;
}
${S} .oc-agent-attachment-x {
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
${S} .oc-agent-attachment-x:hover {
  opacity: 1;
  background: var(--tint-border-hover);
}
${S} .oc-agent-toolbar-spacer { flex: 1; }
${S} .oc-agent-toolbar-sep {
  width: 1px;
  height: 14px;
  background: var(--border-subtle);
  margin: 0 4px;
  flex-shrink: 0;
}

/* Footer row — project label + branch chip — lives OUTSIDE the
   composer card so it reads as "chat metadata", not composer
   inputs. Workspace is read-only (scope is pinned to the chat's
   folder for the whole conversation); branch stays switchable via
   the BranchPill. */
${S} .oc-agent-composer-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px 0;
  min-width: 0;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--text-muted);
}
${S} .oc-agent-chat-workspace {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  color: var(--text-muted);
}
${S} .oc-agent-chat-workspace span {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  color: var(--text-muted);
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
  color: var(--text-muted);
  font-family: var(--font-mono);
}
${S} .oc-chat-usage-row.is-primary {
  color: var(--text-primary);
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
  color: var(--text-muted);
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
${S} .oc-agent-quicks {
  display: flex; align-items: center; gap: 6px;
  padding: 0 4px 8px;
  flex-wrap: wrap;
}
${S} .oc-agent-quicks-label {
  font-size: 9.5px; text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-placeholder);
  margin-right: 2px;
}
${S} .oc-agent-quick-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px;
  font-size: 10.5px; font-family: inherit;
  color: var(--text-info);
  background: var(--tint-accent-weak);
  border: 1px solid var(--tint-accent-border);
  border-radius: 999px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-agent-quick-chip:hover {
  background: var(--tint-accent-soft);
  color: var(--accent-hover);
}
${S} .oc-agent-quick-chip[disabled] {
  opacity: 0.4; cursor: not-allowed;
}

/* ── Mention picker (agent variant of oc-slash-menu) ─────── */
${S} .oc-agent-menu {
  position: absolute;
  left: 0; right: 0; bottom: calc(100% + 6px);
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 25;
}
${S} .oc-agent-menu-head {
  padding: 6px 12px; font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-agent-menu-list { max-height: 220px; overflow-y: auto; }
${S} .oc-agent-menu-item {
  width: 100%;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  background: transparent; border: none;
  color: var(--text-primary);
  cursor: pointer; text-align: left;
  transition: background 120ms ease;
}
${S} .oc-agent-menu-item:hover { background: var(--surface-2); }
${S} .oc-agent-menu-item-active {
  background: var(--surface-3) !important;
}
${S} .oc-agent-menu-item-icon {
  flex-shrink: 0; color: var(--text-muted);
}
${S} .oc-agent-menu-item-active .oc-agent-menu-item-icon {
  color: var(--text-success);
}
${S} .oc-agent-menu-item-label {
  font-size: 11px; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-agent-menu-item-hint {
  font-size: 10px; color: var(--text-muted);
  font-family: var(--font-mono);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  margin-top: 1px;
}
${S} .oc-agent-menu-item-kind {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-placeholder);
  flex-shrink: 0;
}
${S} .oc-agent-menu-empty {
  padding: 12px; font-size: 11px;
  color: var(--text-muted);
}

/* ── Registry picker ───────────────────────────────────── */
${S} .oc-agent-reg-search {
  flex: 1; min-width: 0;
  position: relative;
}
${S} .oc-agent-reg-search-icon {
  position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
  color: var(--text-placeholder); pointer-events: none;
}
${S} .oc-agent-reg-search-input {
  width: 100%;
  padding: 6px 10px 6px 28px;
  background: var(--surface-1);
  border: 1px solid transparent; border-radius: 6px;
  font-size: 11.5px; font-family: inherit;
  color: var(--text-primary);
  outline: none;
  transition: border-color 120ms ease, background 120ms ease;
}
${S} .oc-agent-reg-search-input:focus {
  border-color: var(--ring-focus);
  background: var(--surface-0);
}
${S} .oc-agent-reg-search-input::placeholder { color: var(--text-muted); }
${S} .oc-agent-reg-list { flex: 1; min-height: 0; overflow-y: auto; }
${S} .oc-agent-reg-row {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background 120ms ease;
}
${S} .oc-agent-reg-row:hover { background: var(--surface-2); }
${S} .oc-agent-reg-row-active { background: var(--surface-3); }
${S} .oc-agent-reg-avatar {
  width: 28px; height: 28px; border-radius: 6px;
  background: var(--surface-2);
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); font-size: 11px; font-weight: 600;
}
${S} .oc-agent-reg-avatar--icon {
  background: var(--surface-1);
}
${S} .oc-agent-reg-avatar svg {
  width: 100%; height: 100%; display: block;
}
${S} .oc-agent-reg-status-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 2px;
  align-self: center;
}
${S} .oc-agent-reg-status-dot.is-active {
  background: var(--text-success, #22c55e);
}
${S} .oc-agent-reg-status-dot.is-inactive {
  background: var(--text-muted);
  opacity: 0.5;
}

/* Composer state chip — compact session-status indicator that sits
   next to the agent pill. Only renders for non-ready states. Distinct
   styling per state so the user can tell auth-required (actionable)
   apart from warming (passive) without reading. */
${S} .oc-composer-state-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1;
  border: 1px solid transparent;
  background: transparent;
  cursor: default;
  white-space: nowrap;
}
${S} .oc-composer-state-chip.is-warming {
  color: var(--text-muted);
}
${S} .oc-composer-state-chip.is-auth {
  color: var(--accent-hover, #4aa3ff);
  background: var(--surface-2);
  border-color: var(--border-subtle);
  cursor: pointer;
}
${S} .oc-composer-state-chip.is-auth:hover {
  background: var(--surface-3);
  color: var(--accent, #60b5ff);
}
${S} .oc-composer-state-chip.is-failed {
  color: var(--text-critical, #ef4444);
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.25);
  cursor: pointer;
}
${S} .oc-composer-state-chip.is-failed:hover {
  background: rgba(239, 68, 68, 0.14);
}
${S} .oc-composer-state-chip__spinner {
  width: 8px; height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--text-muted);
  border-top-color: transparent;
  animation: oc-composer-state-spin 0.9s linear infinite;
}
@keyframes oc-composer-state-spin {
  to { transform: rotate(360deg); }
}

/* Summary handoff pill — shown at the top of a chat spawned via
   agent-switch. Single chip + dismiss; clicking inserts a compact
   transcript of the prior conversation into the composer. */
${S} .oc-summary-handoff {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 11.5px;
  color: var(--text-muted);
  flex-wrap: wrap;
}
${S} .oc-summary-handoff__label {
  color: var(--text-muted);
}
${S} .oc-summary-handoff__chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  max-width: 280px;
  transition: background 120ms ease, border-color 120ms ease;
}
${S} .oc-summary-handoff__chip:hover {
  background: var(--surface-3);
  border-color: var(--border-strong, var(--border-subtle));
}
${S} .oc-summary-handoff__chip-title {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-summary-handoff__dismiss {
  margin-left: auto;
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-summary-handoff__dismiss:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}
${S} .oc-agent-reg-body { min-width: 0; flex: 1; }
${S} .oc-agent-reg-title {
  display: flex; align-items: baseline; gap: 6px;
}
${S} .oc-agent-reg-name {
  font-size: 12px; font-weight: 500;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-agent-reg-version {
  font-size: 10px; color: var(--text-placeholder); flex-shrink: 0;
}
${S} .oc-agent-reg-dist {
  font-size: 10px; color: var(--text-placeholder);
  text-transform: uppercase; letter-spacing: 0.04em;
  flex-shrink: 0;
}
${S} .oc-agent-reg-desc {
  font-size: 11px; color: var(--text-muted);
  margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
${S} .oc-agent-reg-id {
  font-size: 10px; color: var(--text-placeholder);
  font-family: var(--font-mono); margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* Per-row right-hand cluster: Login button + enable toggle. */
${S} .oc-agent-reg-actions {
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
${S} .oc-agent-reg-login {
  font-size: 10px; padding: 4px 8px; border-radius: 6px;
  display: inline-flex; align-items: center; gap: 4px;
}

/* Enable/disable toggle. Off = muted grey track, knob left; on = green
   track, knob right. Stops propagation on click so it doesn't also
   fire the row's select handler. */
${S} .oc-agent-reg-toggle {
  position: relative;
  width: 28px; height: 16px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-2);
  cursor: pointer; padding: 0;
  transition: background 120ms ease, border-color 120ms ease;
  flex-shrink: 0;
}
${S} .oc-agent-reg-toggle.is-on {
  background: var(--tint-success-border);
  border-color: var(--tint-success-border);
}
${S} .oc-agent-reg-toggle.is-on:hover {
  background: var(--text-success);
}
${S} .oc-agent-reg-toggle.is-off:hover {
  background: var(--tint-active);
}
${S} .oc-agent-reg-toggle-knob {
  position: absolute; top: 1px; left: 1px;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--text-primary);
  transition: transform 120ms ease;
}
${S} .oc-agent-reg-toggle.is-on .oc-agent-reg-toggle-knob {
  transform: translateX(12px);
  background: var(--surface-absolute-inverted);
}
${S} .oc-agent-reg-footer {
  border-top: 1px solid var(--border-subtle);
  padding: 6px 12px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 10px; color: var(--text-placeholder);
}
${S} .oc-agent-reg-footer a {
  color: var(--text-muted);
  text-decoration: none;
  display: inline-flex; align-items: center; gap: 4px;
}
${S} .oc-agent-reg-footer a:hover { color: var(--text-primary); }

/* Phase 3 — tabs, install-state pills, per-row resource links */
${S} .oc-agent-reg-tabs {
  display: flex; gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-subtle);
}
${S} .oc-agent-reg-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  font-size: 11px; font-family: inherit;
  color: var(--text-muted);
  background: transparent; border: none; border-radius: 6px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
${S} .oc-agent-reg-tab:hover { color: var(--text-primary); background: var(--surface-2); }
${S} .oc-agent-reg-tab-active {
  color: var(--text-primary);
  background: var(--surface-3);
}
${S} .oc-agent-reg-tab-count {
  font-size: 10px; color: var(--text-placeholder);
}
${S} .oc-agent-reg-tab-active .oc-agent-reg-tab-count { color: var(--text-muted); }

${S} .oc-agent-reg-pill {
  font-size: 9.5px;
  text-transform: uppercase; letter-spacing: 0.04em;
  padding: 1px 6px; border-radius: 999px;
  border: 1px solid transparent;
  flex-shrink: 0;
}
${S} .oc-agent-reg-pill-installed {
  color: var(--text-success);
  background: var(--tint-success-soft);
  border-color: var(--tint-success-border);
}
${S} .oc-agent-reg-pill-available {
  color: var(--text-muted);
  background: var(--tint-hover);
  border-color: var(--border-subtle);
}
${S} .oc-agent-reg-pill-unavailable {
  color: var(--text-placeholder);
  background: var(--tint-hover);
  border-color: var(--border-subtle);
}

${S} .oc-agent-reg-meta {
  display: flex; align-items: center; gap: 10px;
  margin-top: 4px;
  font-size: 10px; color: var(--text-placeholder);
}
${S} .oc-agent-reg-meta a {
  display: inline-flex; align-items: center; gap: 3px;
  color: var(--text-muted);
  text-decoration: none;
}
${S} .oc-agent-reg-meta a:hover { color: var(--text-primary); }
${S} .oc-agent-reg-meta-license {
  display: inline-flex; align-items: center; gap: 3px;
  color: var(--text-placeholder);
}

/* ── Auth modal (method picker + key input) ────────────── */
${S} .oc-agent-auth-body { padding: 12px; }
${S} .oc-agent-auth-card {
  width: 100%;
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px;
  text-align: left;
  border: 1px solid var(--border-subtle);
  background: var(--surface-2);
  border-radius: 8px; cursor: pointer; font-family: inherit;
  transition: border-color 120ms ease, background 120ms ease;
  margin-bottom: 10px;
}
${S} .oc-agent-auth-card:hover {
  background: var(--surface-3);
}
${S} .oc-agent-auth-card-active {
  border-color: var(--tint-success-border);
  background: var(--tint-success-weak);
}
${S} .oc-agent-auth-icon {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 6px;
  background: var(--tint-hover); color: var(--text-muted);
  display: flex; align-items: center; justify-content: center;
}
${S} .oc-agent-auth-card-active .oc-agent-auth-icon {
  background: var(--tint-success-soft);
  color: var(--text-success);
}
${S} .oc-agent-auth-body-text { min-width: 0; flex: 1; }
${S} .oc-agent-auth-title {
  font-size: 12px; font-weight: 500;
  color: var(--text-primary);
}
${S} .oc-agent-auth-desc {
  font-size: 11px; color: var(--text-muted);
  margin-top: 2px;
  line-height: 1.45;
}
${S} .oc-agent-auth-radio {
  flex-shrink: 0; width: 14px; height: 14px;
  border: 1px solid var(--border-strong);
  border-radius: 50%; margin-top: 2px;
}
${S} .oc-agent-auth-card-active .oc-agent-auth-radio {
  border-color: var(--text-success);
  background: var(--text-success);
}
${S} .oc-agent-auth-field {
  margin-top: 4px; padding: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-2);
  border-radius: 8px;
}
${S} .oc-agent-auth-label {
  font-size: 11px; color: var(--text-muted);
  margin-bottom: 6px;
}
${S} .oc-agent-auth-field-meta {
  margin-top: 6px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
}
${S} .oc-agent-auth-field-meta a {
  font-size: 10px; color: var(--text-muted);
  text-decoration: none;
}
${S} .oc-agent-auth-field-meta a:hover { color: var(--text-primary); }
${S} .oc-agent-auth-field-meta-badge {
  font-size: 10px; color: var(--text-placeholder);
  display: inline-flex; align-items: center; gap: 4px;
}
${S} .oc-agent-auth-disclaimer {
  padding: 10px 12px;
  border: 1px solid var(--tint-warning-border);
  background: var(--tint-warning-soft);
  border-radius: 8px;
  font-size: 11px;
  color: var(--text-warning);
  line-height: 1.5;
  display: flex; gap: 8px;
}
${S} .oc-agent-auth-disclaimer-title {
  font-weight: 500; color: var(--text-warning);
  margin-bottom: 2px;
}
${S} .oc-agent-auth-error {
  font-size: 11px; color: var(--text-critical);
  margin-top: 8px;
}
${S} .oc-agent-auth-actions {
  border-top: 1px solid var(--border-subtle);
  padding: 10px 12px;
  display: flex; align-items: center; gap: 8px;
}
${S} .oc-agent-auth-actions-spacer { flex: 1; }

/* ── Misc small states ─────────────────────────────────── */
${S} .oc-agent-error {
  margin: 8px 12px 0;
  padding: 8px;
  border: 1px solid var(--tint-critical-border);
  background: var(--tint-critical-soft);
  border-radius: 6px;
  display: flex; gap: 8px; align-items: flex-start;
  font-size: 11px; color: var(--text-critical);
}
${S} .oc-agent-error-title { font-weight: 500; }
${S} .oc-agent-empty-muted {
  padding: 12px; font-size: 11px; color: var(--text-muted);
  display: flex; align-items: center; gap: 6px;
}
${S} .oc-agent-loading {
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