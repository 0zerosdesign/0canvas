// ──────────────────────────────────────────────────────────
// Target — Shared mutable state for the inspection target
// ──────────────────────────────────────────────────────────
//
// "Target document" = the document being inspected.
// Either iframe.contentDocument (package mode) or
// window.document (dev mode).

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
