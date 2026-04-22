// ──────────────────────────────────────────────────────────
// React hooks for the Zeros engine connection
// ──────────────────────────────────────────────────────────
//
// Provides:
//   - BridgeProvider       — mounts at root, manages connection lifecycle
//   - useBridge            — access the client instance
//   - useBridgeStatus      — reactive connection status
//   - useExtensionConnected — whether engine is ready
//   - useStyleChange       — send a style change and await ACK
//
// ──────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { CanvasBridgeClient, type ConnectionStatus } from "./ws-client";
import type { StyleChangeAckMessage } from "./messages";

// ── Context ──────────────────────────────────────────────

const BridgeContext = createContext<CanvasBridgeClient | null>(null);

export function BridgeProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<CanvasBridgeClient | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const client = new CanvasBridgeClient();
    clientRef.current = client;
    client.connect().catch((err) => {
      console.warn("[Zeros] initial connect failed:", err);
    });
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

/** Whether the engine is connected and ready. */
export function useExtensionConnected(): boolean {
  const bridge = useBridge();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!bridge) return;

    const onEngineReady = () => setConnected(true);
    const unsub = bridge.on("ENGINE_READY", onEngineReady);

    // Check current state
    setConnected(bridge.extensionConnected);

    // Also track disconnection via status changes
    const unsubStatus = bridge.onStatusChange((status) => {
      if (status === "disconnected") setConnected(false);
    });

    return () => {
      unsub();
      unsubStatus();
    };
  }, [bridge]);

  return connected;
}

/**
 * Returns a function that sends a STYLE_CHANGE message and awaits ACK.
 * The engine resolves the CSS source and writes the change to disk.
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
