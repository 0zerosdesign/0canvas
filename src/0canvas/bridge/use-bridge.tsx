// ──────────────────────────────────────────────────────────
// React hooks for the 0canvas WebSocket bridge
// ──────────────────────────────────────────────────────────
//
// Provides:
//   - BridgeProvider  — mounts at engine root, manages connection lifecycle
//   - useBridge       — access the bridge client instance
//   - useBridgeStatus — reactive connection status
//   - useStyleChange  — send a style change and await ACK
//
// ──────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { CanvasBridgeClient, type ConnectionStatus } from "./ws-client";
import type { StyleChangeAckMessage, BridgeMessage } from "./messages";

// ── Context ──────────────────────────────────────────────

const BridgeContext = createContext<CanvasBridgeClient | null>(null);

export function BridgeProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<CanvasBridgeClient | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const client = new CanvasBridgeClient();
    clientRef.current = client;
    client.connect();
    // Force a re-render so children can access the client
    forceUpdate((n) => n + 1);
    return () => {
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  return (
    <BridgeContext.Provider value={clientRef.current}>
      {children}
    </BridgeContext.Provider>
  );
}

// ── Hooks ────────────────────────────────────────────────

/** Access the bridge client instance. May be null during initial render. */
export function useBridge(): CanvasBridgeClient | null {
  return useContext(BridgeContext);
}

/** Reactive connection status. */
export function useBridgeStatus(): ConnectionStatus {
  const bridge = useBridge();
  const [status, setStatus] = useState<ConnectionStatus>(
    bridge?.status ?? "disconnected"
  );

  useEffect(() => {
    if (!bridge) return;
    setStatus(bridge.status);
    return bridge.onStatusChange(setStatus);
  }, [bridge]);

  return status;
}

/** Whether the VS Code extension is connected to the bridge. */
export function useExtensionConnected(): boolean {
  const bridge = useBridge();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!bridge) return;

    const onPeerConnect = (msg: BridgeMessage) => {
      if (msg.type === "PEER_CONNECTED" && msg.role === "extension") setConnected(true);
    };
    const onPeerDisconnect = (msg: BridgeMessage) => {
      if (msg.type === "PEER_DISCONNECTED" && msg.role === "extension") setConnected(false);
    };

    const unsub1 = bridge.on("PEER_CONNECTED", onPeerConnect);
    const unsub2 = bridge.on("PEER_DISCONNECTED", onPeerDisconnect);

    // Check current state
    setConnected(bridge.extensionConnected);

    return () => {
      unsub1();
      unsub2();
    };
  }, [bridge]);

  return connected;
}

/**
 * Returns a function that sends a STYLE_CHANGE message and awaits ACK.
 * The returned function applies the change locally first (instant feedback),
 * then sends to the extension for file write.
 */
export function useStyleChange() {
  const bridge = useBridge();

  return useCallback(
    async (
      selector: string,
      property: string,
      value: string,
      previousValue?: string
    ): Promise<StyleChangeAckMessage | null> => {
      if (!bridge || bridge.status !== "connected") return null;

      try {
        const result = await bridge.request<StyleChangeAckMessage>({
          type: "STYLE_CHANGE",
          selector,
          property,
          value,
          previousValue,
        });
        return result;
      } catch {
        return null;
      }
    },
    [bridge]
  );
}
