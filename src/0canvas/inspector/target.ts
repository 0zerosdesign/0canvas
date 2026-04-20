// ──────────────────────────────────────────────────────────
// Target — Shared mutable state for the inspection target
// ──────────────────────────────────────────────────────────
//
// "Target document" = the iframe document currently being
// inspected (source preview or a variant). In the Mac app
// there is always an iframe — the main window.document is
// the Tauri app chrome, never an inspection surface.
//
// Defaults to window.document as a safety fallback for early
// init races before any iframe has mounted; callers in that
// window do not try to inspect the chrome.

let targetDoc: Document = document;
let targetIframe: HTMLIFrameElement | null = null;

export function getTargetDoc(): Document {
  return targetDoc;
}

export function getTargetIframe(): HTMLIFrameElement | null {
  return targetIframe;
}

export function setTarget(
  doc: Document,
  iframe: HTMLIFrameElement | null = null
): void {
  targetDoc = doc;
  targetIframe = iframe;
}

export function resetTarget(): void {
  targetDoc = document;
  targetIframe = null;
}
