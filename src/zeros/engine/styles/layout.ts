// ──────────────────────────────────────────────────────────
// Layout utilities — minimal Tailwind shims still used in Zeros
// ──────────────────────────────────────────────────────────
//
// Zeros components are authored with `oc-*` class names defined
// in the sibling partials. Only a few bare Tailwind utilities leak
// in via shared code (lucide icon sizing, flex helpers). This file
// keeps JUST those — every legacy alias mapping to dead hex/rgba
// tints was deleted in the Phase 3 token sweep.
//
// If a new bare utility is needed, add it here with a token-backed
// value (never a raw color / raw rgba / primitive ramp ref).

export const layoutCSS = (S: string) => `
/* ── Animations (keyframes are token-agnostic) ── */
@keyframes oc-pulse { 50% { opacity: .5; } }
@keyframes oc-spin { to { transform: rotate(360deg); } }
${S} .animate-pulse { animation: oc-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite; }
${S} .animate-spin { animation: oc-spin 1s linear infinite; }

/* ── Layout helpers (icon sizing + flex in shared components) ── */
${S} .relative { position: relative; }
${S} .flex-1 { flex: 1 1 0%; }
${S} .flex-shrink-0 { flex-shrink: 0; }
${S} .min-h-0 { min-height: 0; }
${S} .min-w-0 { min-width: 0; }
${S} .w-3 { width: 0.75rem; }
${S} .w-3\\.5 { width: 0.875rem; }
${S} .h-3 { height: 0.75rem; }
${S} .h-3\\.5 { height: 0.875rem; }
`;
