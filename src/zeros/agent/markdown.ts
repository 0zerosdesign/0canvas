// ──────────────────────────────────────────────────────────
// markdown — agent-text → safe HTML, streaming-friendly
// ──────────────────────────────────────────────────────────
//
// Stage 5.5 (§2.5.11). T3 Chat pattern: parse markdown on
// every render. Memoization at the renderer level (TextMessage
// + MessageView memo) ensures finalized messages parse exactly
// once; only the actively-streaming message re-parses on each
// chunk. Cost stays flat regardless of transcript length.
//
// Safety: marked output is run through DOMPurify before it
// reaches dangerouslySetInnerHTML. Agent replies sometimes
// contain HTML (intentional or not); sanitisation strips
// `<script>` / event handlers / javascript: URLs, leaving
// only the markdown-derived structure.
//
// Open code blocks (the `\`\`\`` fence hasn't closed yet on a
// streaming chunk) are tolerated by marked — it renders the
// in-flight content as an open code block which resolves
// cleanly once the closing fence lands.
// ──────────────────────────────────────────────────────────

import { marked } from "marked";
import DOMPurify from "dompurify";

// Configure marked once. GFM (tables, strikethrough, task lists)
// enabled because that's what most agent CLIs emit. `breaks: false`
// matches GitHub's behaviour — single newlines do NOT become <br>;
// agents rely on this for multi-line code/JSON without forced breaks.
marked.use({
  gfm: true,
  breaks: false,
});

// Hook DOMPurify to set safe link attributes — we want `target=_blank`
// + `rel=noopener noreferrer` on every <a>, and we want to keep the
// `target` attribute through sanitisation (DOMPurify strips it by
// default since `_blank` can be abused without `rel`). Configured
// once at module load.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeName === "A") {
    const a = node as HTMLAnchorElement;
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  }
});

/** Render markdown text to sanitised HTML. Returns a string suitable
 *  for `dangerouslySetInnerHTML`. The empty / undefined text shortcut
 *  avoids paying the parse cost on placeholder renders. */
export function renderMarkdown(text: string): string {
  if (!text) return "";
  // marked.parse can return Promise<string> when async extensions are
  // configured. We don't use any, but `async: false` makes the typing
  // explicit and avoids accidental misuse.
  const raw = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ["target"],
  });
}
