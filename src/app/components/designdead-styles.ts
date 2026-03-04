// ──────────────────────────────────────────────────────────
// DesignDead — Runtime CSS Injection (v0.0.3)
// ──────────────────────────────────────────────────────────
//
// COMPLETE self-contained CSS for ALL DesignDead components.
// Every Tailwind utility class used in any component file is
// defined here, scoped under [data-designdead-root].
//
// This file was built by auditing EVERY className in:
//   workspace-toolbar.tsx, layers-panel.tsx, style-panel.tsx,
//   live-canvas.tsx, agent-panel.tsx, brainstorm-panel.tsx,
//   annotation-overlay.tsx, command-palette.tsx, file-map-panel.tsx,
//   version-manager.tsx, ui/scroll-area.tsx
//
// ──────────────────────────────────────────────────────────

const STYLE_ID = "designdead-injected-styles";

// Helper: scope selector under [data-designdead-root]
const S = "[data-designdead-root]";

export const DESIGNDEAD_CSS = `
/* ============================================================
   DesignDead — Complete Self-Contained Styles
   ============================================================ */

/* ── CSS Variables ── */
${S} {
  --dd-bg: #000000;
  --dd-fg: #ededed;
  --dd-card: #0a0a0a;
  --dd-muted: #111111;
  --dd-muted-fg: #888888;
  --dd-border: #222222;
  --dd-ring: #333333;
  font-family: 'Geist Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--dd-fg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Reset ── */
${S} *, ${S} *::before, ${S} *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0 solid var(--dd-border);
}
${S} button { background: transparent; border: none; cursor: pointer; font: inherit; color: inherit; }
${S} input, ${S} textarea { font: inherit; }
${S} *:focus-visible { outline: 2px solid var(--dd-ring); outline-offset: 2px; }

/* ── Scrollbar ── */
${S} ::-webkit-scrollbar { width: 6px; height: 6px; }
${S} ::-webkit-scrollbar-track { background: transparent; }
${S} ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
${S} ::-webkit-scrollbar-thumb:hover { background: #444; }

/* ── Animations ── */
@keyframes dd-pulse { 50% { opacity: .5; } }
@keyframes dd-spin { to { transform: rotate(360deg); } }
${S} .animate-pulse { animation: dd-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite; }
${S} .animate-spin { animation: dd-spin 1s linear infinite; }

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
   PADDING
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
${S} .border-border { border-color: var(--dd-border); }
${S} .border-\\[\\#1a1a1a\\] { border-color: #1a1a1a; }
${S} .border-\\[\\#222222\\] { border-color: #222222; }
${S} .border-\\[\\#333333\\] { border-color: #333333; }
${S} .border-\\[\\#444\\] { border-color: #444; }
${S} .border-foreground { border-color: var(--dd-fg); }
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
${S} .bg-background { background-color: var(--dd-bg); }
${S} .bg-foreground { background-color: var(--dd-fg); }
${S} .bg-border { background-color: var(--dd-border); }
${S} .bg-transparent { background-color: transparent; }
${S} .bg-\\[\\#000000\\] { background-color: #000000; }
${S} .bg-\\[\\#080808\\] { background-color: #080808; }
${S} .bg-\\[\\#0a0a0a\\] { background-color: #0a0a0a; }
${S} .bg-\\[\\#111111\\] { background-color: #111111; }
${S} .bg-\\[\\#1a1a1a\\] { background-color: #1a1a1a; }
${S} .bg-\\[\\#222222\\] { background-color: #222222; }
${S} .bg-\\[\\#333333\\] { background-color: #333333; }
${S} .bg-\\[\\#444444\\] { background-color: #444444; }
${S} .bg-\\[\\#0070f3\\] { background-color: #0070f3; }
${S} .bg-\\[\\#50e3c2\\] { background-color: #50e3c2; }
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
${S} .bg-\\[\\#0a0a0a\\]\\/95 { background-color: rgba(10,10,10,0.95); }
${S} .bg-\\[\\#ffffff06\\] { background-color: rgba(255,255,255,0.024); }
${S} .bg-\\[\\#ffffff08\\] { background-color: rgba(255,255,255,0.031); }
${S} .bg-\\[\\#ffffff10\\] { background-color: rgba(255,255,255,0.063); }

/* ============================================================
   TEXT COLORS
   ============================================================ */
${S} .text-foreground { color: var(--dd-fg); }
${S} .text-background { color: var(--dd-bg); }
${S} .text-muted-foreground { color: var(--dd-muted-fg); }
${S} .text-white { color: #ffffff; }
${S} .text-\\[\\#0070f3\\] { color: #0070f3; }
${S} .text-\\[\\#50e3c2\\] { color: #50e3c2; }
${S} .text-\\[\\#f5a623\\] { color: #f5a623; }
${S} .text-\\[\\#7928ca\\] { color: #7928ca; }
${S} .text-\\[\\#ff0080\\] { color: #ff0080; }
${S} .text-\\[\\#ff4444\\] { color: #ff4444; }
${S} .text-\\[\\#ff9800\\] { color: #ff9800; }
${S} .text-\\[\\#4caf50\\] { color: #4caf50; }
${S} .text-\\[\\#2196f3\\] { color: #2196f3; }
${S} .text-\\[\\#79b8ff\\] { color: #79b8ff; }
${S} .text-\\[\\#444444\\] { color: #444444; }
${S} .text-\\[\\#888888\\] { color: #888888; }
${S} .text-blue-300 { color: #93c5fd; }
${S} .text-blue-400 { color: #60a5fa; }
${S} .text-blue-500 { color: #3b82f6; }
${S} .text-purple-400 { color: #c084fc; }
${S} .text-indigo-200 { color: #c7d2fe; }
${S} .text-indigo-300 { color: #a5b4fc; }
${S} .text-indigo-400 { color: #818cf8; }
${S} .text-green-300 { color: #86efac; }
${S} .text-green-400 { color: #4ade80; }
${S} .text-orange-300 { color: #fdba74; }
${S} .text-orange-400 { color: #fb923c; }
${S} .text-yellow-300 { color: #fde047; }
${S} .text-yellow-400 { color: #facc15; }
${S} .text-cyan-400 { color: #22d3ee; }
${S} .text-teal-400 { color: #2dd4bf; }
${S} .text-pink-400 { color: #f472b6; }
${S} .text-red-400 { color: #f87171; }

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
${S} .placeholder\\:text-muted-foreground::placeholder { color: var(--dd-muted-fg); }

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
${S} .ring-1 { box-shadow: 0 0 0 1px var(--dd-ring); }
${S} .ring-white\\/30 { box-shadow: 0 0 0 1px rgba(255,255,255,0.3); }
${S} .ring-white\\/40 { box-shadow: 0 0 0 1px rgba(255,255,255,0.4); }

/* ============================================================
   HOVER STATES
   ============================================================ */
${S} .hover\\:bg-\\[\\#1a1a1a\\]:hover { background-color: #1a1a1a; }
${S} .hover\\:bg-\\[\\#111111\\]:hover { background-color: #111111; }
${S} .hover\\:bg-\\[\\#ffffff06\\]:hover { background-color: rgba(255,255,255,0.024); }
${S} .hover\\:bg-\\[\\#ffffff08\\]:hover { background-color: rgba(255,255,255,0.031); }
${S} .hover\\:bg-\\[\\#ffffff10\\]:hover { background-color: rgba(255,255,255,0.063); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/10:hover { background-color: rgba(0,112,243,0.1); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/20:hover { background-color: rgba(0,112,243,0.2); }
${S} .hover\\:bg-\\[\\#0070f3\\]\\/90:hover { background-color: rgba(0,112,243,0.9); }
${S} .hover\\:bg-\\[\\#ff4444\\]\\/10:hover { background-color: rgba(255,68,68,0.1); }
${S} .hover\\:text-foreground:hover { color: var(--dd-fg); }
${S} .hover\\:text-\\[\\#0070f3\\]:hover { color: #0070f3; }
${S} .hover\\:text-\\[\\#7928ca\\]:hover { color: #7928ca; }
${S} .hover\\:text-\\[\\#f5a623\\]:hover { color: #f5a623; }
${S} .hover\\:text-\\[\\#ff4444\\]:hover { color: #ff4444; }
${S} .hover\\:border-\\[\\#333333\\]:hover { border-color: #333333; }
${S} .hover\\:border-foreground:hover { border-color: var(--dd-fg); }
${S} .hover\\:underline:hover { text-decoration: underline; }
${S} .hover\\:opacity-90:hover { opacity: 0.9; }

/* ============================================================
   FOCUS STATES
   ============================================================ */
${S} .focus\\:outline-none:focus { outline: none; }
${S} .focus\\:border-\\[\\#333333\\]:focus { border-color: #333333; }
${S} .focus\\:border-\\[\\#0070f3\\]:focus { border-color: #0070f3; }
${S} .focus-visible\\:ring-ring\\/50:focus-visible { box-shadow: 0 0 0 3px rgba(51,51,51,0.5); }
${S} .focus-visible\\:ring-\\[3px\\]:focus-visible { box-shadow: 0 0 0 3px var(--dd-ring); }
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
`;

export function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = DESIGNDEAD_CSS;
  document.head.appendChild(style);
}

export function removeStyles(): void {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
}