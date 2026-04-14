// ──────────────────────────────────────────────────────────
// Tailwind Class Change Handler
// ──────────────────────────────────────────────────────────
//
// Handles TAILWIND_CLASS_CHANGE messages: adds or removes
// Tailwind classes in JSX/TSX source files.
//
// ──────────────────────────────────────────────────────────

import type { BridgeWebSocket } from "../websocket-client";
import type { TailwindWriter } from "../tailwind-writer";

export function registerTailwindHandler(
  bridge: BridgeWebSocket,
  twWriter: TailwindWriter
): void {
  bridge.on("TAILWIND_CLASS_CHANGE", async (msg) => {
    const twMsg = msg as any;
    console.log(`[0canvas] TAILWIND_CLASS_CHANGE: ${twMsg.action} "${twMsg.className}" on ${twMsg.selector}`);
    const result = await twWriter.writeClassChange(twMsg.selector, twMsg.action, twMsg.className);
    if (result.success) {
      console.log(`[0canvas] Tailwind written: ${result.file}`);
    } else {
      console.warn(`[0canvas] Tailwind write failed: ${result.error}`);
    }
  });
}
