// ──────────────────────────────────────────────────────────
// Style Change Handler
// ──────────────────────────────────────────────────────────
//
// Handles STYLE_CHANGE messages: resolves the CSS source
// location, writes the new value, and sends an ACK.
//
// ──────────────────────────────────────────────────────────

import type { BridgeWebSocket } from "../websocket-client";
import type { CSSSourceResolver } from "../css-source-resolver";
import type { CSSFileWriter } from "../css-file-writer";
import type { StyleChangeMessage, BridgeMessage } from "../messages";
import { createMessage } from "../messages";

export function registerStyleHandler(
  bridge: BridgeWebSocket,
  resolver: CSSSourceResolver,
  writer: CSSFileWriter
): void {
  bridge.on("STYLE_CHANGE", async (msg) => {
    const styleMsg = msg as StyleChangeMessage;
    console.log(`[0canvas] STYLE_CHANGE: ${styleMsg.selector} { ${styleMsg.property}: ${styleMsg.value} }`);

    // 1. Find where this selector + property lives
    const location = await resolver.resolve(styleMsg.selector, styleMsg.property);

    if (!location) {
      // Property not found in any CSS file — send failure ACK
      bridge.send(
        createMessage<BridgeMessage>({
          type: "STYLE_CHANGE_ACK",
          source: "extension",
          requestId: styleMsg.id,
          success: false,
          error: `Could not find "${styleMsg.property}" for selector "${styleMsg.selector}" in any CSS file`,
        })
      );
      return;
    }

    // 2. Write the new value
    const result = writer.write(location.file, location.line, styleMsg.property, styleMsg.value);

    // 3. Send ACK
    bridge.send(
      createMessage<BridgeMessage>({
        type: "STYLE_CHANGE_ACK",
        source: "extension",
        requestId: styleMsg.id,
        success: result.success,
        file: result.file,
        line: result.line,
        error: result.error,
      })
    );

    if (result.success) {
      console.log(`[0canvas] Written: ${result.file}:${result.line}`);
    } else {
      console.warn(`[0canvas] Write failed: ${result.error}`);
    }
  });
}
