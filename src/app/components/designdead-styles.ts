// ──────────────────────────────────────────────────────────
// DesignDead — Runtime CSS Injection
// ──────────────────────────────────────────────────────────
//
// All CSS DesignDead needs: variables, reset, AND every Tailwind
// utility class used by components — scoped under
// [data-designdead-root] so they never leak into the consumer's app.
// ──────────────────────────────────────────────────────────

const STYLE_ID = "designdead-injected-styles";

export const DESIGNDEAD_CSS = `
/* DesignDead — Complete Scoped Styles */

[data-designdead-root] {
  --dd-background: #000000;
  --dd-foreground: #ededed;
  --dd-card: #0a0a0a;
  --dd-muted: #111111;
  --dd-muted-foreground: #888888;
  --dd-border: #222222;
  --dd-ring: #333333;
  font-family: 'Geist Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--dd-foreground);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

[data-designdead-root] *,
[data-designdead-root] *::before,
[data-designdead-root] *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border-width: 0;
  border-style: solid;
  border-color: var(--dd-border);
}

[data-designdead-root] button {
  background: transparent;
  border: none;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

[data-designdead-root] input,
[data-designdead-root] textarea {
  font: inherit;
}

[data-designdead-root] *:focus-visible {
  outline: 2px solid var(--dd-ring);
  outline-offset: 2px;
}

[data-designdead-root] ::-webkit-scrollbar { width: 6px; height: 6px; }
[data-designdead-root] ::-webkit-scrollbar-track { background: transparent; }
[data-designdead-root] ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
[data-designdead-root] ::-webkit-scrollbar-thumb:hover { background: #444; }

@keyframes dd-pulse { 50% { opacity: .5; } }
@keyframes dd-spin { to { transform: rotate(360deg); } }
[data-designdead-root] .animate-pulse { animation: dd-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite; }
[data-designdead-root] .animate-spin { animation: dd-spin 1s linear infinite; }

/* === LAYOUT === */
[data-designdead-root] .flex { display: flex; }
[data-designdead-root] .inline-flex { display: inline-flex; }
[data-designdead-root] .block { display: block; }
[data-designdead-root] .inline { display: inline; }
[data-designdead-root] .hidden { display: none; }
[data-designdead-root] .flex-col { flex-direction: column; }
[data-designdead-root] .flex-row { flex-direction: row; }
[data-designdead-root] .flex-1 { flex: 1 1 0%; }
[data-designdead-root] .flex-wrap { flex-wrap: wrap; }
[data-designdead-root] .shrink-0 { flex-shrink: 0; }
[data-designdead-root] .items-center { align-items: center; }
[data-designdead-root] .items-start { align-items: flex-start; }
[data-designdead-root] .items-end { align-items: flex-end; }
[data-designdead-root] .justify-center { justify-content: center; }
[data-designdead-root] .justify-between { justify-content: space-between; }
[data-designdead-root] .justify-start { justify-content: flex-start; }
[data-designdead-root] .gap-0\\.5 { gap: 0.125rem; }
[data-designdead-root] .gap-1 { gap: 0.25rem; }
[data-designdead-root] .gap-1\\.5 { gap: 0.375rem; }
[data-designdead-root] .gap-2 { gap: 0.5rem; }
[data-designdead-root] .gap-2\\.5 { gap: 0.625rem; }
[data-designdead-root] .gap-3 { gap: 0.75rem; }
[data-designdead-root] .gap-4 { gap: 1rem; }
[data-designdead-root] .relative { position: relative; }
[data-designdead-root] .absolute { position: absolute; }
[data-designdead-root] .fixed { position: fixed; }
[data-designdead-root] .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
[data-designdead-root] .overflow-hidden { overflow: hidden; }
[data-designdead-root] .overflow-x-auto { overflow-x: auto; }
[data-designdead-root] .overflow-y-auto { overflow-y: auto; }
[data-designdead-root] .overflow-y-scroll { overflow-y: scroll; }
[data-designdead-root] .isolate { isolation: isolate; }
[data-designdead-root] .text-left { text-align: left; }
[data-designdead-root] .text-center { text-align: center; }
[data-designdead-root] .text-right { text-align: right; }

/* === SIZING === */
[data-designdead-root] .w-full { width: 100%; }
[data-designdead-root] .w-px { width: 1px; }
[data-designdead-root] .w-1\\.5 { width: 0.375rem; }
[data-designdead-root] .w-2 { width: 0.5rem; }
[data-designdead-root] .w-2\\.5 { width: 0.625rem; }
[data-designdead-root] .w-3 { width: 0.75rem; }
[data-designdead-root] .w-3\\.5 { width: 0.875rem; }
[data-designdead-root] .w-4 { width: 1rem; }
[data-designdead-root] .w-5 { width: 1.25rem; }
[data-designdead-root] .w-6 { width: 1.5rem; }
[data-designdead-root] .w-8 { width: 2rem; }
[data-designdead-root] .w-12 { width: 3rem; }
[data-designdead-root] .w-48 { width: 12rem; }
[data-designdead-root] .w-\\[120px\\] { width: 120px; }
[data-designdead-root] .w-\\[520px\\] { width: 520px; }
[data-designdead-root] .h-full { height: 100%; }
[data-designdead-root] .h-px { height: 1px; }
[data-designdead-root] .h-1\\.5 { height: 0.375rem; }
[data-designdead-root] .h-2 { height: 0.5rem; }
[data-designdead-root] .h-2\\.5 { height: 0.625rem; }
[data-designdead-root] .h-3 { height: 0.75rem; }
[data-designdead-root] .h-3\\.5 { height: 0.875rem; }
[data-designdead-root] .h-4 { height: 1rem; }
[data-designdead-root] .h-5 { height: 1.25rem; }
[data-designdead-root] .h-6 { height: 1.5rem; }
[data-designdead-root] .h-7 { height: 1.75rem; }
[data-designdead-root] .h-8 { height: 2rem; }
[data-designdead-root] .h-9 { height: 2.25rem; }
[data-designdead-root] .h-12 { height: 3rem; }
[data-designdead-root] .h-20 { height: 5rem; }
[data-designdead-root] .h-\\[28px\\] { height: 28px; }
[data-designdead-root] .size-full { width: 100%; height: 100%; }
[data-designdead-root] .min-h-0 { min-height: 0; }
[data-designdead-root] .max-w-\\[140px\\] { max-width: 140px; }
[data-designdead-root] .max-w-\\[360px\\] { max-width: 360px; }
[data-designdead-root] .max-h-\\[300px\\] { max-height: 300px; }

/* === SPACING === */
[data-designdead-root] .p-0\\.5 { padding: 0.125rem; }
[data-designdead-root] .p-1 { padding: 0.25rem; }
[data-designdead-root] .p-1\\.5 { padding: 0.375rem; }
[data-designdead-root] .p-2 { padding: 0.5rem; }
[data-designdead-root] .p-3 { padding: 0.75rem; }
[data-designdead-root] .p-4 { padding: 1rem; }
[data-designdead-root] .p-6 { padding: 1.5rem; }
[data-designdead-root] .p-px { padding: 1px; }
[data-designdead-root] .px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
[data-designdead-root] .px-1\\.5 { padding-left: 0.375rem; padding-right: 0.375rem; }
[data-designdead-root] .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
[data-designdead-root] .px-2\\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
[data-designdead-root] .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
[data-designdead-root] .px-4 { padding-left: 1rem; padding-right: 1rem; }
[data-designdead-root] .py-0 { padding-top: 0; padding-bottom: 0; }
[data-designdead-root] .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
[data-designdead-root] .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
[data-designdead-root] .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
[data-designdead-root] .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
[data-designdead-root] .py-2\\.5 { padding-top: 0.625rem; padding-bottom: 0.625rem; }
[data-designdead-root] .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
[data-designdead-root] .pt-3 { padding-top: 0.75rem; }
[data-designdead-root] .pt-16 { padding-top: 4rem; }
[data-designdead-root] .pt-\\[20vh\\] { padding-top: 20vh; }
[data-designdead-root] .pb-1 { padding-bottom: 0.25rem; }
[data-designdead-root] .m-0 { margin: 0; }
[data-designdead-root] .ml-0\\.5 { margin-left: 0.125rem; }
[data-designdead-root] .ml-1 { margin-left: 0.25rem; }
[data-designdead-root] .ml-1\\.5 { margin-left: 0.375rem; }
[data-designdead-root] .ml-4 { margin-left: 1rem; }
[data-designdead-root] .ml-auto { margin-left: auto; }
[data-designdead-root] .mr-1 { margin-right: 0.25rem; }
[data-designdead-root] .mr-1\\.5 { margin-right: 0.375rem; }
[data-designdead-root] .mr-2 { margin-right: 0.5rem; }
[data-designdead-root] .mr-3 { margin-right: 0.75rem; }
[data-designdead-root] .mt-0\\.5 { margin-top: 0.125rem; }
[data-designdead-root] .mt-1 { margin-top: 0.25rem; }
[data-designdead-root] .mt-2 { margin-top: 0.5rem; }
[data-designdead-root] .mt-3 { margin-top: 0.75rem; }
[data-designdead-root] .mt-4 { margin-top: 1rem; }
[data-designdead-root] .mt-5 { margin-top: 1.25rem; }
[data-designdead-root] .mb-1 { margin-bottom: 0.25rem; }
[data-designdead-root] .mb-2 { margin-bottom: 0.5rem; }
[data-designdead-root] .mb-2\\.5 { margin-bottom: 0.625rem; }
[data-designdead-root] .mb-3 { margin-bottom: 0.75rem; }
[data-designdead-root] .mb-4 { margin-bottom: 1rem; }
[data-designdead-root] .mx-1 { margin-left: 0.25rem; margin-right: 0.25rem; }
[data-designdead-root] .mx-auto { margin-left: auto; margin-right: auto; }
[data-designdead-root] .pl-5\\.5 { padding-left: 1.375rem; }
[data-designdead-root] .space-y-0 > * + * { margin-top: 0; }
[data-designdead-root] .space-y-1 > * + * { margin-top: 0.25rem; }
[data-designdead-root] .space-y-2 > * + * { margin-top: 0.5rem; }
[data-designdead-root] .space-y-3 > * + * { margin-top: 0.75rem; }

/* === BORDERS === */
[data-designdead-root] .border { border-width: 1px; }
[data-designdead-root] .border-b { border-bottom-width: 1px; }
[data-designdead-root] .border-l { border-left-width: 1px; }
[data-designdead-root] .border-r { border-right-width: 1px; }
[data-designdead-root] .border-t { border-top-width: 1px; }
[data-designdead-root] .border-border { border-color: var(--dd-border); }
[data-designdead-root] .border-\\[\\#1a1a1a\\] { border-color: #1a1a1a; }
[data-designdead-root] .border-\\[\\#222222\\] { border-color: #222222; }
[data-designdead-root] .border-\\[\\#333333\\] { border-color: #333333; }
[data-designdead-root] .border-\\[\\#444\\] { border-color: #444; }
[data-designdead-root] .border-foreground { border-color: var(--dd-foreground); }
[data-designdead-root] .border-l-transparent { border-left-color: transparent; }
[data-designdead-root] .border-t-transparent { border-top-color: transparent; }
[data-designdead-root] .border-dashed { border-style: dashed; }
[data-designdead-root] .border-\\[\\#0070f3\\]\\/20 { border-color: rgba(0,112,243,0.2); }
[data-designdead-root] .border-\\[\\#0070f3\\]\\/30 { border-color: rgba(0,112,243,0.3); }
[data-designdead-root] .border-\\[\\#0070f3\\]\\/40 { border-color: rgba(0,112,243,0.4); }
[data-designdead-root] .border-\\[\\#50e3c2\\]\\/20 { border-color: rgba(80,227,194,0.2); }
[data-designdead-root] .border-\\[\\#ff0080\\]\\/20 { border-color: rgba(255,0,128,0.2); }
[data-designdead-root] .border-\\[\\#ff980040\\] { border-color: #ff980040; }
[data-designdead-root] .border-\\[\\#4caf5040\\] { border-color: #4caf5040; }
[data-designdead-root] .border-\\[\\#2196f340\\] { border-color: #2196f340; }
[data-designdead-root] .rounded { border-radius: 0.25rem; }
[data-designdead-root] .rounded-sm { border-radius: 0.125rem; }
[data-designdead-root] .rounded-md { border-radius: 0.375rem; }
[data-designdead-root] .rounded-lg { border-radius: 0.5rem; }
[data-designdead-root] .rounded-xl { border-radius: 0.75rem; }
[data-designdead-root] .rounded-2xl { border-radius: 1rem; }
[data-designdead-root] .rounded-full { border-radius: 9999px; }
[data-designdead-root] .rounded-\\[inherit\\] { border-radius: inherit; }

/* === BACKGROUNDS === */
[data-designdead-root] .bg-background { background-color: var(--dd-background); }
[data-designdead-root] .bg-foreground { background-color: var(--dd-foreground); }
[data-designdead-root] .bg-border { background-color: var(--dd-border); }
[data-designdead-root] .bg-transparent { background-color: transparent; }
[data-designdead-root] .bg-\\[\\#000000\\] { background-color: #000000; }
[data-designdead-root] .bg-\\[\\#080808\\] { background-color: #080808; }
[data-designdead-root] .bg-\\[\\#0a0a0a\\] { background-color: #0a0a0a; }
[data-designdead-root] .bg-\\[\\#111111\\] { background-color: #111111; }
[data-designdead-root] .bg-\\[\\#1a1a1a\\] { background-color: #1a1a1a; }
[data-designdead-root] .bg-\\[\\#222222\\] { background-color: #222222; }
[data-designdead-root] .bg-\\[\\#333333\\] { background-color: #333333; }
[data-designdead-root] .bg-\\[\\#0070f3\\] { background-color: #0070f3; }
[data-designdead-root] .bg-\\[\\#50e3c2\\] { background-color: #50e3c2; }
[data-designdead-root] .bg-\\[\\#0070f3\\]\\/5 { background-color: rgba(0,112,243,0.05); }
[data-designdead-root] .bg-\\[\\#0070f3\\]\\/10 { background-color: rgba(0,112,243,0.1); }
[data-designdead-root] .bg-\\[\\#0070f3\\]\\/15 { background-color: rgba(0,112,243,0.15); }
[data-designdead-root] .bg-\\[\\#0070f3\\]\\/20 { background-color: rgba(0,112,243,0.2); }
[data-designdead-root] .bg-\\[\\#50e3c2\\]\\/10 { background-color: rgba(80,227,194,0.1); }
[data-designdead-root] .bg-\\[\\#50e3c2\\]\\/20 { background-color: rgba(80,227,194,0.2); }
[data-designdead-root] .bg-\\[\\#f5a623\\]\\/10 { background-color: rgba(245,166,35,0.1); }
[data-designdead-root] .bg-\\[\\#f5a623\\]\\/15 { background-color: rgba(245,166,35,0.15); }
[data-designdead-root] .bg-\\[\\#7928ca\\]\\/15 { background-color: rgba(121,40,202,0.15); }
[data-designdead-root] .bg-\\[\\#7928ca\\]\\/20 { background-color: rgba(121,40,202,0.2); }
[data-designdead-root] .bg-\\[\\#ff0080\\]\\/15 { background-color: rgba(255,0,128,0.15); }
[data-designdead-root] .bg-\\[\\#ff0080\\]\\/20 { background-color: rgba(255,0,128,0.2); }
[data-designdead-root] .bg-\\[\\#ff4444\\]\\/10 { background-color: rgba(255,68,68,0.1); }
[data-designdead-root] .bg-\\[\\#ff980020\\] { background-color: #ff980020; }
[data-designdead-root] .bg-\\[\\#4caf5020\\] { background-color: #4caf5020; }
[data-designdead-root] .bg-\\[\\#2196f320\\] { background-color: #2196f320; }
[data-designdead-root] .bg-black\\/60 { background-color: rgba(0,0,0,0.6); }
[data-designdead-root] .bg-\\[\\#ffffff06\\] { background-color: rgba(255,255,255,0.024); }
[data-designdead-root] .bg-\\[\\#ffffff08\\] { background-color: rgba(255,255,255,0.031); }
[data-designdead-root] .bg-\\[\\#ffffff10\\] { background-color: rgba(255,255,255,0.063); }

/* === TEXT COLORS === */
[data-designdead-root] .text-foreground { color: var(--dd-foreground); }
[data-designdead-root] .text-background { color: var(--dd-background); }
[data-designdead-root] .text-muted-foreground { color: var(--dd-muted-foreground); }
[data-designdead-root] .text-white { color: #ffffff; }
[data-designdead-root] .text-\\[\\#0070f3\\] { color: #0070f3; }
[data-designdead-root] .text-\\[\\#50e3c2\\] { color: #50e3c2; }
[data-designdead-root] .text-\\[\\#f5a623\\] { color: #f5a623; }
[data-designdead-root] .text-\\[\\#7928ca\\] { color: #7928ca; }
[data-designdead-root] .text-\\[\\#ff0080\\] { color: #ff0080; }
[data-designdead-root] .text-\\[\\#ff4444\\] { color: #ff4444; }
[data-designdead-root] .text-\\[\\#ff9800\\] { color: #ff9800; }
[data-designdead-root] .text-\\[\\#4caf50\\] { color: #4caf50; }
[data-designdead-root] .text-\\[\\#2196f3\\] { color: #2196f3; }
[data-designdead-root] .text-\\[\\#79b8ff\\] { color: #79b8ff; }
[data-designdead-root] .text-\\[\\#444444\\] { color: #444444; }
[data-designdead-root] .text-\\[\\#888888\\] { color: #888888; }
[data-designdead-root] .text-blue-300 { color: #93c5fd; }
[data-designdead-root] .text-blue-400 { color: #60a5fa; }
[data-designdead-root] .text-blue-500 { color: #3b82f6; }
[data-designdead-root] .text-purple-400 { color: #c084fc; }
[data-designdead-root] .text-indigo-200 { color: #c7d2fe; }
[data-designdead-root] .text-indigo-300 { color: #a5b4fc; }
[data-designdead-root] .text-indigo-400 { color: #818cf8; }
[data-designdead-root] .text-green-300 { color: #86efac; }
[data-designdead-root] .text-green-400 { color: #4ade80; }
[data-designdead-root] .text-orange-300 { color: #fdba74; }
[data-designdead-root] .text-orange-400 { color: #fb923c; }
[data-designdead-root] .text-yellow-300 { color: #fde047; }
[data-designdead-root] .text-yellow-400 { color: #facc15; }
[data-designdead-root] .text-cyan-400 { color: #22d3ee; }
[data-designdead-root] .text-teal-400 { color: #2dd4bf; }
[data-designdead-root] .text-pink-400 { color: #f472b6; }
[data-designdead-root] .text-red-400 { color: #f87171; }

/* === TYPOGRAPHY === */
[data-designdead-root] .text-\\[9px\\] { font-size: 9px; }
[data-designdead-root] .text-\\[10px\\] { font-size: 10px; }
[data-designdead-root] .text-\\[11px\\] { font-size: 11px; }
[data-designdead-root] .text-\\[12px\\] { font-size: 12px; }
[data-designdead-root] .text-\\[13px\\] { font-size: 13px; }
[data-designdead-root] .text-\\[14px\\] { font-size: 14px; }
[data-designdead-root] .text-\\[15px\\] { font-size: 15px; }
[data-designdead-root] .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-designdead-root] .whitespace-pre { white-space: pre; }
[data-designdead-root] .whitespace-pre-wrap { white-space: pre-wrap; }
[data-designdead-root] .break-all { word-break: break-all; }
[data-designdead-root] .uppercase { text-transform: uppercase; }
[data-designdead-root] .tracking-wider { letter-spacing: 0.05em; }
[data-designdead-root] .tracking-tight { letter-spacing: -0.025em; }
[data-designdead-root] .resize-none { resize: none; }
[data-designdead-root] .placeholder\\:text-muted-foreground::placeholder { color: var(--dd-muted-foreground); }

/* === EFFECTS & TRANSITIONS === */
[data-designdead-root] .transition-colors { transition-property: color,background-color,border-color,text-decoration-color,fill,stroke; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
[data-designdead-root] .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
[data-designdead-root] .transition-opacity { transition-property: opacity; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
[data-designdead-root] .transition-transform { transition-property: transform; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
[data-designdead-root] .transition-\\[color\\,box-shadow\\] { transition-property: color,box-shadow; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
[data-designdead-root] .opacity-0 { opacity: 0; }
[data-designdead-root] .opacity-30 { opacity: 0.3; }
[data-designdead-root] .opacity-40 { opacity: 0.4; }
[data-designdead-root] .opacity-50 { opacity: 0.5; }
[data-designdead-root] .opacity-60 { opacity: 0.6; }
[data-designdead-root] .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1); }
[data-designdead-root] .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
[data-designdead-root] .backdrop-blur-sm { backdrop-filter: blur(4px); }
[data-designdead-root] .-translate-x-1\\/2 { transform: translateX(-50%); }
[data-designdead-root] .scale-125 { transform: scale(1.25); }
[data-designdead-root] .top-3 { top: 0.75rem; }
[data-designdead-root] .left-1\\/2 { left: 50%; }

/* === INTERACTIVITY === */
[data-designdead-root] .cursor-pointer { cursor: pointer; }
[data-designdead-root] .cursor-text { cursor: text; }
[data-designdead-root] .cursor-default { cursor: default; }
[data-designdead-root] .cursor-crosshair { cursor: crosshair; }
[data-designdead-root] .select-none { user-select: none; }
[data-designdead-root] .touch-none { touch-action: none; }
[data-designdead-root] .pointer-events-none { pointer-events: none; }
[data-designdead-root] .pointer-events-auto { pointer-events: auto; }
[data-designdead-root] .outline-none { outline: none; }

/* === RINGS === */
[data-designdead-root] .ring-1 { box-shadow: 0 0 0 1px var(--dd-ring); }
[data-designdead-root] .ring-white\\/30 { box-shadow: 0 0 0 1px rgba(255,255,255,0.3); }
[data-designdead-root] .ring-white\\/40 { box-shadow: 0 0 0 1px rgba(255,255,255,0.4); }

/* === Z-INDEX === */
[data-designdead-root] .z-20 { z-index: 20; }
[data-designdead-root] .z-30 { z-index: 30; }
[data-designdead-root] .z-40 { z-index: 40; }
[data-designdead-root] .z-\\[100\\] { z-index: 100; }

/* === HOVER STATES === */
[data-designdead-root] .hover\\:bg-\\[\\#1a1a1a\\]:hover { background-color: #1a1a1a; }
[data-designdead-root] .hover\\:bg-\\[\\#111111\\]:hover { background-color: #111111; }
[data-designdead-root] .hover\\:bg-\\[\\#ffffff06\\]:hover { background-color: rgba(255,255,255,0.024); }
[data-designdead-root] .hover\\:bg-\\[\\#ffffff08\\]:hover { background-color: rgba(255,255,255,0.031); }
[data-designdead-root] .hover\\:bg-\\[\\#ffffff10\\]:hover { background-color: rgba(255,255,255,0.063); }
[data-designdead-root] .hover\\:bg-\\[\\#0070f3\\]\\/10:hover { background-color: rgba(0,112,243,0.1); }
[data-designdead-root] .hover\\:bg-\\[\\#0070f3\\]\\/20:hover { background-color: rgba(0,112,243,0.2); }
[data-designdead-root] .hover\\:bg-\\[\\#0070f3\\]\\/90:hover { background-color: rgba(0,112,243,0.9); }
[data-designdead-root] .hover\\:bg-\\[\\#ff4444\\]\\/10:hover { background-color: rgba(255,68,68,0.1); }
[data-designdead-root] .hover\\:text-foreground:hover { color: var(--dd-foreground); }
[data-designdead-root] .hover\\:text-\\[\\#0070f3\\]:hover { color: #0070f3; }
[data-designdead-root] .hover\\:text-\\[\\#7928ca\\]:hover { color: #7928ca; }
[data-designdead-root] .hover\\:text-\\[\\#f5a623\\]:hover { color: #f5a623; }
[data-designdead-root] .hover\\:text-\\[\\#ff4444\\]:hover { color: #ff4444; }
[data-designdead-root] .hover\\:border-\\[\\#333333\\]:hover { border-color: #333333; }
[data-designdead-root] .hover\\:border-foreground:hover { border-color: var(--dd-foreground); }
[data-designdead-root] .hover\\:underline:hover { text-decoration: underline; }
[data-designdead-root] .hover\\:opacity-90:hover { opacity: 0.9; }

/* === FOCUS STATES === */
[data-designdead-root] .focus\\:outline-none:focus { outline: none; }
[data-designdead-root] .focus\\:border-\\[\\#333333\\]:focus { border-color: #333333; }
[data-designdead-root] .focus\\:border-\\[\\#0070f3\\]:focus { border-color: #0070f3; }
[data-designdead-root] .focus-visible\\:ring-ring\\/50:focus-visible { box-shadow: 0 0 0 3px rgba(51,51,51,0.5); }
[data-designdead-root] .focus-visible\\:ring-\\[3px\\]:focus-visible { box-shadow: 0 0 0 3px var(--dd-ring); }
[data-designdead-root] .focus-visible\\:outline-1:focus-visible { outline-width: 1px; }

/* === GROUP HOVER === */
[data-designdead-root] .group:hover .group-hover\\:flex { display: flex; }
[data-designdead-root] .group:hover .group-hover\\:opacity-100 { opacity: 1; }

/* === DISABLED === */
[data-designdead-root] .disabled\\:opacity-30:disabled { opacity: 0.3; }

/* === LAST-CHILD === */
[data-designdead-root] .last\\:border-0:last-child { border-width: 0; }

/* === RADIX SCROLL AREA === */
[data-designdead-root] [data-slot="scroll-area"] { position: relative; }
[data-designdead-root] [data-slot="scroll-area-viewport"] {
  width: 100%; height: 100%; border-radius: inherit; overflow-y: scroll;
}
[data-designdead-root] [data-slot="scroll-area-scrollbar"] {
  display: flex; touch-action: none; padding: 1px;
  transition-property: color,background-color,border-color;
  transition-timing-function: cubic-bezier(0.4,0,0.2,1);
  transition-duration: 150ms; user-select: none;
}
[data-designdead-root] [data-slot="scroll-area-scrollbar"][data-orientation="vertical"] {
  height: 100%; width: 10px; border-left: 1px solid transparent;
}
[data-designdead-root] [data-slot="scroll-area-scrollbar"][data-orientation="horizontal"] {
  height: 10px; flex-direction: column; border-top: 1px solid transparent;
}
[data-designdead-root] [data-slot="scroll-area-thumb"] {
  background: var(--dd-border); position: relative; flex: 1 1 0%; border-radius: 9999px;
}
`;

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = DESIGNDEAD_CSS;
  document.head.appendChild(style);
}

export function removeStyles(): void {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
}
