// ──────────────────────────────────────────────────────────
// syntax.worker — shiki highlighter, off the main thread
// ──────────────────────────────────────────────────────────
//
// Phase 2 §2.11.2 — moves shiki's regex-heavy grammar work into a
// Web Worker so the main thread doesn't pin while a long response
// streams 10+ code blocks. Bundle import remains lazy (the worker
// module is only loaded when the first highlight is requested), so
// initial paint isn't slowed.
//
// Protocol (renderer ⇄ worker):
//   request : { id: number, code: string, lang: string }
//   response: { id: number, html: string | null, error?: string }
//
// `html === null` signals "language not loaded" — the renderer
// wraps the original `code` in a plain `<pre>` (mirrors the main-
// thread fallback in syntax.ts).
// ──────────────────────────────────────────────────────────

// Static import inside the worker — Vite bundles the worker as a
// single chunk, so dynamic `import()` would force code-splitting
// (which requires worker.format: "es" in vite.config). Static import
// keeps the worker self-contained and works with the default iife
// worker format.
import { createHighlighter, type HighlighterCore } from "shiki";

const LANGUAGES = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "bash",
  "shell",
  "css",
  "scss",
  "html",
  "markdown",
  "python",
  "rust",
  "go",
  "yaml",
  "toml",
  "sql",
  "sh",
] as const;

const THEME = "github-dark-default";

let highlighterPromise: Promise<HighlighterCore> | null = null;

function loadHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEME],
      langs: [...LANGUAGES],
    });
  }
  return highlighterPromise;
}

interface HighlightRequest {
  id: number;
  code: string;
  lang: string;
}

interface HighlightResponse {
  id: number;
  html: string | null;
  error?: string;
}

self.addEventListener("message", async (event: MessageEvent<HighlightRequest>) => {
  const { id, code, lang } = event.data;
  const reply = (msg: HighlightResponse) => self.postMessage(msg);
  try {
    const hl = await loadHighlighter();
    const loadedLangs = hl.getLoadedLanguages();
    if (!loadedLangs.includes(lang)) {
      reply({ id, html: null });
      return;
    }
    const html = hl.codeToHtml(code, { lang, theme: THEME });
    reply({ id, html });
  } catch (err) {
    reply({ id, html: null, error: String(err) });
  }
});

// Make this module a Worker (TypeScript needs an export so the file
// is treated as a module; Vite picks up the worker via `?worker` or
// `new Worker(new URL(...), { type: "module" })`).
export {};
