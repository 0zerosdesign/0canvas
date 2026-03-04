// ──────────────────────────────────────────────────────────
// DesignDead — Runtime CSS Injection
// ──────────────────────────────────────────────────────────
//
// When DesignDead runs as an npm package inside a consumer's app,
// the consumer might use ANY CSS framework (or none). They won't
// have our Tailwind config, CSS variables, or base styles.
//
// This module injects a scoped <style> block at runtime that
// provides all the CSS variables and utility classes DesignDead
// needs, scoped under [data-designdead-root] so they never
// leak into the consumer's app.
//
// Strategy:
//   1. CSS custom properties (colors, radii) scoped to our root
//   2. Minimal Tailwind-like utility classes prefixed with dd- scope
//   3. Reset styles inside our root so consumer CSS can't break us
//   4. Injected once, cleaned up on unmount
// ──────────────────────────────────────────────────────────

const STYLE_ID = "designdead-injected-styles";

/**
 * Core CSS variables and scoped reset for DesignDead's UI.
 * These are injected inside [data-designdead-root] so they
 * never affect the consumer's app.
 */
export const DESIGNDEAD_CSS = `
/* ── DesignDead Scoped Styles ────────────────────────── */

[data-designdead-root] {
  /* Color tokens (Vercel Geist dark theme) */
  --background: #000000;
  --foreground: #ededed;
  --card: #0a0a0a;
  --card-foreground: #ededed;
  --popover: #0a0a0a;
  --popover-foreground: #ededed;
  --primary: #ffffff;
  --primary-foreground: #000000;
  --secondary: #1a1a1a;
  --secondary-foreground: #ededed;
  --muted: #111111;
  --muted-foreground: #888888;
  --accent: #1a1a1a;
  --accent-foreground: #ededed;
  --destructive: #ff4444;
  --destructive-foreground: #ffffff;
  --border: #222222;
  --input: transparent;
  --input-background: #111111;
  --switch-background: #333333;
  --ring: #333333;
  --radius: 0.5rem;

  /* Tailwind v4 color mappings */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-input-background: var(--input-background);
  --color-ring: var(--ring);

  /* Scoped reset */
  font-family: 'Geist Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* Ensure DesignDead sits on top of everything */
  position: fixed;
  inset: 0;
  z-index: 2147483640;
  pointer-events: auto;
}

/* Reset all elements inside DesignDead root */
[data-designdead-root] *,
[data-designdead-root] *::before,
[data-designdead-root] *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

[data-designdead-root] *:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Border default */
[data-designdead-root] * {
  border-color: var(--border);
}

/* Scrollbar styling */
[data-designdead-root] ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
[data-designdead-root] ::-webkit-scrollbar-track {
  background: transparent;
}
[data-designdead-root] ::-webkit-scrollbar-thumb {
  background: #333333;
  border-radius: 3px;
}
[data-designdead-root] ::-webkit-scrollbar-thumb:hover {
  background: #444444;
}

/* Animations */
@keyframes dd-pulse {
  50% { opacity: .5; }
}
@keyframes dd-spin {
  to { transform: rotate(360deg); }
}
[data-designdead-root] .animate-pulse {
  animation: dd-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
[data-designdead-root] .animate-spin {
  animation: dd-spin 1s linear infinite;
}
`;

/**
 * Inject DesignDead's scoped CSS into the document head.
 * Safe to call multiple times — only injects once.
 */
export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = DESIGNDEAD_CSS;
  document.head.appendChild(style);
}

/**
 * Remove DesignDead's injected CSS from the document.
 */
export function removeStyles(): void {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
}
