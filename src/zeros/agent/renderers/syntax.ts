// ──────────────────────────────────────────────────────────
// Shared syntax highlighter — shiki singleton, lazy-loaded
// ──────────────────────────────────────────────────────────
//
// Stage 3 cards (Edit, Read) need code highlighting. Phase 1
// runs shiki on the main thread; Phase 2.3 swaps to a worker
// (the highlight() return is already async, so the swap is
// a one-liner that doesn't touch any callsite).
//
// Lazy-init pattern: shiki + grammars are big, so we don't
// import them on the initial paint of agent-chat.tsx. The
// first call to highlight() dynamic-imports shiki, builds a
// singleton highlighter pre-loaded with the langs we care
// about, and stashes it in a module-level promise. Subsequent
// calls await the same promise — single instance, no thrash.
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
 *  this is safe. */
export async function highlightCode(
  code: string,
  lang: string,
): Promise<string> {
  if (lang === "text") return wrapPlain(code);
  const hl = await loadHighlighter();
  const loadedLangs = hl.getLoadedLanguages();
  if (!loadedLangs.includes(lang)) return wrapPlain(code);
  return hl.codeToHtml(code, { lang, theme: THEME });
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
