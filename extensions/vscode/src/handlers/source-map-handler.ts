// ──────────────────────────────────────────────────────────
// Source Map Handler
// ──────────────────────────────────────────────────────────
//
// Handles REQUEST_SOURCE_MAP messages: resolves a CSS selector
// to its source file location and sends the result back.
//
// ──────────────────────────────────────────────────────────

import type { BridgeWebSocket } from "../websocket-client";
import type { CSSSourceResolver } from "../css-source-resolver";
import type { RequestSourceMapMessage, BridgeMessage } from "../messages";
import { createMessage } from "../messages";

export function registerSourceMapHandler(
  bridge: BridgeWebSocket,
  resolver: CSSSourceResolver
): void {
  bridge.on("REQUEST_SOURCE_MAP", async (msg) => {
    const mapMsg = msg as RequestSourceMapMessage;
    const location = await resolver.resolve(mapMsg.selector, mapMsg.property);

    if (location) {
      bridge.send(
        createMessage<BridgeMessage>({
          type: "SOURCE_MAP_RESULT",
          source: "extension",
          requestId: mapMsg.id,
          selector: mapMsg.selector,
          file: location.file,
          line: location.line,
          column: location.column,
        })
      );
    } else {
      bridge.send(
        createMessage<BridgeMessage>({
          type: "ERROR",
          source: "extension",
          code: "SOURCE_NOT_FOUND",
          message: `Could not resolve source for "${mapMsg.selector}"`,
          requestId: mapMsg.id,
        })
      );
    }
  });
}
