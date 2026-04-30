// ──────────────────────────────────────────────────────────
// Shared syntax highlighter — shiki singleton, lazy-loaded
// ──────────────────────────────────────────────────────────
//
// Stage 3 cards (Edit, Read) need code highlighting. Phase 2 §2.11.2
// moves shiki off the main thread into a Web Worker (./syntax.worker.ts)
// so a long streaming response with many code blocks doesn't pin the
// main thread. The `highlightCode` async signature is unchanged so
// callers don't need to know.
//
// Fallback paths (in order):
//   1. Web Worker via `new Worker(new URL("./syntax.worker.ts", …))`
//      — primary path under Vite + Electron.
//   2. Main-thread shiki — if Worker construction fails (test
//      harness, jsdom, server-render). Same singleton pattern.
//   3. Plain `<pre>` — if the language isn't loaded or shiki
//      isn't available at all.
//
// Lazy-init pattern: shiki + grammars are big, so we don't import
// them on the initial paint of agent-chat.tsx. The first call to
// highlightCode() spawns the worker (or main-thread highlighter)
// and stashes the promise. Subsequent calls reuse it.
// ──────────────────────────────────────────────────────────

// `shiki` types are imported as type-only so the dynamic
// import below is the only thing that pulls in runtime code.
import type { HighlighterCore } from "shiki";

/** Languages we ship in the singleton. Adding more here costs
 *  bundle size (shiki grammars are TextMate JSON, ~30-100KB
 *  each gzipped). Keep this list tight and let `getLang()`
 *  fall back to `text` for anything we haven't pre-loaded. */
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

// ─── Worker path (primary) ────────────────────────────────

interface WorkerResponse {
  id: number;
  html: string | null;
  error?: string;
}

let workerPromise: Promise<Worker | null> | null = null;
const pendingWorkerCalls = new Map<
  number,
  { resolve: (html: string | null) => void; reject: (err: Error) => void }
>();
let nextWorkerCallId = 0;

/** Lazy-create the worker. Returns null when Worker isn't usable in
 *  this environment (tests, jsdom). The caller falls back to the
 *  main-thread path. */
function getWorker(): Promise<Worker | null> {
  if (!workerPromise) {
    workerPromise = (async () => {
      try {
        if (typeof Worker === "undefined") return null;
        const worker = new Worker(
          new URL("./syntax.worker.ts", import.meta.url),
          { type: "module" },
        );
        worker.addEventListener("message", (e: MessageEvent<WorkerResponse>) => {
          const { id, html, error } = e.data;
          const pending = pendingWorkerCalls.get(id);
          if (!pending) return;
          pendingWorkerCalls.delete(id);
          if (error) pending.reject(new Error(error));
          else pending.resolve(html);
        });
        worker.addEventListener("error", (e) => {
          // A worker-level error breaks all in-flight calls. Fail
          // them so callers can fall back to plain-pre rendering.
          const err = new Error(`syntax worker error: ${e.message}`);
          for (const [, pending] of pendingWorkerCalls) pending.reject(err);
          pendingWorkerCalls.clear();
        });
        return worker;
      } catch {
        // Worker construction failed (CSP, file URL, jsdom) — null
        // signals "use main-thread fallback".
        return null;
      }
    })();
  }
  return workerPromise;
}

// ─── Main-thread fallback ─────────────────────────────────

let highlighterPromise: Promise<HighlighterCore> | null = null;

function loadHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const shiki = await import("shiki");
      const hl = await shiki.createHighlighter({
        themes: [THEME],
        langs: [...LANGUAGES],
      });
      return hl;
    })();
  }
  return highlighterPromise;
}

/** Map a file path or extension to a shiki language id. Falls back
 *  to `text` (no highlighting, just `<pre>` output) for unknowns. */
export function getLang(pathOrExt: string | null | undefined): string {
  if (!pathOrExt) return "text";
  const lower = pathOrExt.toLowerCase();
  // Strip trailing slash + everything after a `?` (URL-like inputs).
  const ext = lower.split(".").pop() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "json":
    case "css":
    case "scss":
    case "html":
    case "md":
    case "py":
    case "rs":
    case "go":
    case "yaml":
    case "yml":
    case "toml":
    case "sql":
      return ext === "md"
        ? "markdown"
        : ext === "py"
        ? "python"
        : ext === "rs"
        ? "rust"
        : ext === "yml"
        ? "yaml"
        : ext;
    case "sh":
    case "zsh":
    case "bash":
      return "bash";
    default:
      return "text";
  }
}

/** Render `code` to HTML. Returns the original text wrapped in a
 *  `<pre>` if the language isn't loaded yet (first-paint case) or
 *  is `text`. The DOM consumer drops the HTML in via
 *  `dangerouslySetInnerHTML` — shiki escapes everything itself, so
 *  this is safe.
 *
 *  Phase 2 §2.11.2 — primary path runs through the Web Worker
 *  (off the main thread); falls back to main-thread shiki if the
 *  worker can't be created (test harness, etc.). */
export async function highlightCode(
  code: string,
  lang: string,
): Promise<string> {
  if (lang === "text") return wrapPlain(code);

  // Worker path (primary).
  try {
    const worker = await getWorker();
    if (worker) {
      const id = nextWorkerCallId++;
      const html = await new Promise<string | null>((resolve, reject) => {
        pendingWorkerCalls.set(id, { resolve, reject });
        worker.postMessage({ id, code, lang });
      });
      if (html === null) return wrapPlain(code); // language not loaded
      return html;
    }
  } catch {
    // Worker call failed mid-flight — fall through to main-thread.
  }

  // Main-thread fallback.
  try {
    const hl = await loadHighlighter();
    const loadedLangs = hl.getLoadedLanguages();
    if (!loadedLangs.includes(lang)) return wrapPlain(code);
    return hl.codeToHtml(code, { lang, theme: THEME });
  } catch {
    return wrapPlain(code);
  }
}

function wrapPlain(code: string): string {
  // Mirror shiki's wrapping shape so the parent's CSS targets work
  // identically whether highlighted or not.
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre class="shiki"><code>${escaped}</code></pre>`;
}
