import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Terminal,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Radio,
  Settings,
} from "lucide-react";
import { useWorkspace, WSLogEntry, WSStatus } from "../store";
import { ScrollArea } from "./ui/scroll-area";

// ──────────────────────────────────────────────────────────
// MCP Protocol message types
// ──────────────────────────────────────────────────────────
type MCPMessage = {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message: string };
};

// ──────────────────────────────────────────────────────────
// WebSocket Bridge Hook
// ──────────────────────────────────────────────────────────
export function useWSBridge() {
  const { state, dispatch } = useWorkspace();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageIdRef = useRef(1);

  const log = useCallback(
    (
      direction: WSLogEntry["direction"],
      method: string,
      summary: string,
      payload?: any
    ) => {
      dispatch({
        type: "WS_LOG",
        entry: {
          id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          direction,
          method,
          summary,
          payload,
        },
      });
    },
    [dispatch]
  );

  const connect = useCallback(
    (port: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      dispatch({ type: "WS_STATUS_UPDATE", status: "connecting" });
      dispatch({ type: "WS_SET_PORT", port });
      log("system", "connect", `Connecting to ws://localhost:${port}...`);

      try {
        const ws = new WebSocket(`ws://localhost:${port}`);

        ws.onopen = () => {
          dispatch({ type: "WS_STATUS_UPDATE", status: "connected" });
          log("system", "connected", `WebSocket connected on port ${port}`);

          // Send MCP initialize handshake
          const initMsg: MCPMessage = {
            jsonrpc: "2.0",
            id: messageIdRef.current++,
            method: "initialize",
            params: {
              protocolVersion: "2025-03-26",
              capabilities: {
                tools: {},
                resources: { subscribe: true },
              },
              clientInfo: {
                name: "designdead",
                version: "1.0.0",
              },
            },
          };

          ws.send(JSON.stringify(initMsg));
          log("sent", "initialize", "MCP handshake sent", initMsg);
        };

        ws.onmessage = (event) => {
          try {
            const msg: MCPMessage = JSON.parse(event.data);

            if (msg.result) {
              log(
                "received",
                msg.method || "response",
                `Result: ${JSON.stringify(msg.result).slice(0, 100)}`,
                msg
              );

              // Handle specific MCP responses
              if (msg.result?.serverInfo) {
                log(
                  "system",
                  "initialized",
                  `Server: ${msg.result.serverInfo.name} v${msg.result.serverInfo.version}`
                );
                // Send initialized notification
                ws.send(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    method: "notifications/initialized",
                  })
                );
              }

              // Handle file mapping responses
              if (msg.result?.fileMappings) {
                dispatch({
                  type: "SET_FILE_MAPPINGS",
                  mappings: msg.result.fileMappings,
                });
              }
            }

            if (msg.error) {
              log(
                "received",
                "error",
                `Error ${msg.error.code}: ${msg.error.message}`,
                msg
              );
            }

            if (msg.method) {
              log(
                "received",
                msg.method,
                `Notification: ${msg.method}`,
                msg
              );

              // Handle server-initiated messages
              if (msg.method === "notifications/resources/updated") {
                log(
                  "system",
                  "resource-update",
                  "File changed in project, refreshing..."
                );
              }
            }
          } catch {
            log("received", "raw", event.data?.toString()?.slice(0, 200) || "");
          }
        };

        ws.onerror = () => {
          dispatch({ type: "WS_STATUS_UPDATE", status: "error" });
          log("system", "error", "WebSocket connection error");
        };

        ws.onclose = (e) => {
          dispatch({ type: "WS_STATUS_UPDATE", status: "disconnected" });
          log(
            "system",
            "disconnected",
            `Connection closed (code: ${e.code})`
          );
          wsRef.current = null;

          // Auto-reconnect after 5s
          if (e.code !== 1000) {
            reconnectTimer.current = setTimeout(() => {
              log("system", "reconnect", "Attempting reconnection...");
              connect(port);
            }, 5000);
          }
        };

        wsRef.current = ws;
      } catch (err) {
        dispatch({ type: "WS_STATUS_UPDATE", status: "error" });
        log("system", "error", `Failed to create WebSocket: ${err}`);
      }
    },
    [dispatch, log]
  );

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }
    dispatch({ type: "WS_STATUS_UPDATE", status: "disconnected" });
    log("system", "disconnect", "Manually disconnected");
  }, [dispatch, log]);

  const sendMCPRequest = useCallback(
    (method: string, params?: any) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        log("system", "error", "Cannot send: WebSocket not connected");
        return null;
      }

      const msg: MCPMessage = {
        jsonrpc: "2.0",
        id: messageIdRef.current++,
        method,
        params,
      };

      wsRef.current.send(JSON.stringify(msg));
      log("sent", method, `Request: ${method}`, msg);
      return msg.id;
    },
    [log]
  );

  // Send design changes to IDE via MCP tools/call
  const sendDesignChanges = useCallback(
    (changes: any[]) => {
      return sendMCPRequest("tools/call", {
        name: "apply_design_changes",
        arguments: {
          changes,
          timestamp: Date.now(),
          source: "designdead",
        },
      });
    },
    [sendMCPRequest]
  );

  // Request file mappings from IDE
  const requestFileMappings = useCallback(
    (selectors: string[]) => {
      return sendMCPRequest("tools/call", {
        name: "resolve_file_mappings",
        arguments: { selectors },
      });
    },
    [sendMCPRequest]
  );

  // Send annotations to IDE
  const sendAnnotations = useCallback(
    (annotations: any[]) => {
      return sendMCPRequest("tools/call", {
        name: "receive_annotations",
        arguments: {
          annotations,
          timestamp: Date.now(),
        },
      });
    },
    [sendMCPRequest]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close(1000);
    };
  }, []);

  return {
    connect,
    disconnect,
    sendMCPRequest,
    sendDesignChanges,
    requestFileMappings,
    sendAnnotations,
    status: state.wsStatus,
    logs: state.wsLogs,
    port: state.wsPort,
  };
}

// ──────────────────────────────────────────────────────────
// WebSocket Bridge Panel UI
// ──────────────────────────────────────────────────────────
function LogEntry({ entry }: { entry: WSLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const dirIcon =
    entry.direction === "sent" ? (
      <ArrowUpRight className="w-3 h-3 text-[#0070f3]" />
    ) : entry.direction === "received" ? (
      <ArrowDownLeft className="w-3 h-3 text-[#50e3c2]" />
    ) : (
      <Radio className="w-3 h-3 text-muted-foreground" />
    );

  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="border-b border-[#111111] last:border-0">
      <button
        className="w-full flex items-start gap-2 py-1.5 px-2 hover:bg-[#111111]/50 transition-colors text-left"
        onClick={() => entry.payload && setExpanded(!expanded)}
      >
        <span className="mt-0.5 shrink-0">{dirIcon}</span>
        <span
          className="text-[10px] text-muted-foreground shrink-0 mt-0.5"
          style={{ fontFamily: "'Geist Mono', monospace" }}
        >
          {time}
        </span>
        <div className="flex-1 min-w-0">
          <span
            className="text-[10px] text-[#0070f3] mr-1.5"
            style={{ fontFamily: "'Geist Mono', monospace" }}
          >
            {entry.method}
          </span>
          <span className="text-[10px] text-muted-foreground truncate block">
            {entry.summary}
          </span>
        </div>
        {entry.payload && (
          <span className="shrink-0 mt-0.5">
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </span>
        )}
      </button>
      {expanded && entry.payload && (
        <pre
          className="text-[10px] text-muted-foreground bg-[#080808] px-3 py-2 mx-2 mb-1.5 rounded overflow-x-auto max-h-[120px]"
          style={{ fontFamily: "'Geist Mono', monospace" }}
        >
          {JSON.stringify(entry.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function WSBridgePanel() {
  const { state, dispatch } = useWorkspace();
  const bridge = useWSBridge();
  const [portInput, setPortInput] = useState("9960");
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.wsLogs.length]);

  const statusColor: Record<WSStatus, string> = {
    disconnected: "#444444",
    connecting: "#f5a623",
    connected: "#50e3c2",
    error: "#ff4444",
  };

  const handleConnect = () => {
    const port = parseInt(portInput, 10);
    if (port > 0 && port <= 65535) {
      bridge.connect(port);
    }
  };

  const copyStartCmd = () => {
    navigator.clipboard.writeText(
      `npx designdead@latest serve --port ${portInput}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Connection controls */}
      <div className="p-3 border-b border-[#1a1a1a] space-y-2.5">
        {/* Status indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: statusColor[state.wsStatus],
                boxShadow:
                  state.wsStatus === "connected"
                    ? `0 0 6px ${statusColor.connected}`
                    : "none",
              }}
            />
            <span className="text-[11px] text-foreground capitalize">
              {state.wsStatus}
            </span>
            {state.wsPort > 0 && state.wsStatus === "connected" && (
              <span
                className="text-[10px] text-muted-foreground"
                style={{ fontFamily: "'Geist Mono', monospace" }}
              >
                :{state.wsPort}
              </span>
            )}
          </div>
          {state.wsStatus === "connected" && (
            <button
              onClick={bridge.disconnect}
              className="text-[10px] text-muted-foreground hover:text-[#ff4444] transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Port input + connect */}
        {state.wsStatus !== "connected" && (
          <>
            <div className="flex gap-1.5">
              <div className="flex-1 flex items-center bg-[#111111] border border-[#1a1a1a] rounded-lg h-[30px] px-2.5">
                <span
                  className="text-[10px] text-muted-foreground mr-1"
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                >
                  ws://localhost:
                </span>
                <input
                  type="text"
                  value={portInput}
                  onChange={(e) => setPortInput(e.target.value.replace(/\D/g, ""))}
                  className="w-14 bg-transparent text-[11px] text-foreground focus:outline-none"
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                  placeholder="9960"
                />
              </div>
              <button
                onClick={handleConnect}
                disabled={state.wsStatus === "connecting"}
                className="px-3 h-[30px] bg-foreground text-background rounded-lg text-[11px] hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1.5"
              >
                {state.wsStatus === "connecting" ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Wifi className="w-3 h-3" />
                )}
                Connect
              </button>
            </div>

            {/* Start command hint */}
            <button
              onClick={copyStartCmd}
              className="w-full flex items-center justify-between bg-[#080808] border border-[#1a1a1a] rounded-lg px-2.5 py-1.5 hover:border-[#333333] transition-colors group"
            >
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-muted-foreground" />
                <code
                  className="text-[10px] text-[#50e3c2]"
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                >
                  npx designdead serve --port {portInput}
                </code>
              </span>
              {copied ? (
                <Check className="w-3 h-3 text-[#50e3c2]" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </>
        )}

        {/* Quick actions when connected */}
        {state.wsStatus === "connected" && (
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                const changes = state.styleChanges.map((c) => ({
                  selector: c.elementId,
                  property: c.property,
                  from: c.oldValue,
                  to: c.newValue,
                }));
                bridge.sendDesignChanges(changes);
              }}
              disabled={state.styleChanges.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#0070f3] text-white rounded-lg text-[10px] hover:bg-[#0070f3]/90 transition-colors disabled:opacity-30"
            >
              <ArrowUpRight className="w-3 h-3" />
              Push Changes ({state.styleChanges.length})
            </button>
            <button
              onClick={() => {
                const selectors = state.elements
                  .slice(0, 50)
                  .map((el) => el.selector);
                bridge.requestFileMappings(selectors);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-[#1a1a1a] rounded-lg text-[10px] text-muted-foreground hover:text-foreground hover:border-[#333333] transition-colors"
            >
              <Settings className="w-3 h-3" />
              Map Files
            </button>
          </div>
        )}
      </div>

      {/* Protocol logs */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1a1a1a]">
        <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
          Protocol Log
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {state.wsLogs.length}
          </span>
          {state.wsLogs.length > 0 && (
            <button
              onClick={() => dispatch({ type: "WS_CLEAR_LOGS" })}
              className="p-0.5 hover:bg-[#1a1a1a] rounded transition-colors"
            >
              <Trash2 className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {state.wsLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Terminal className="w-8 h-8 text-[#1a1a1a] mb-3" />
            <p className="text-[11px] text-muted-foreground mb-1">
              No protocol messages
            </p>
            <p className="text-[10px] text-muted-foreground">
              Connect to a DesignDead MCP server to see live protocol traffic
            </p>
          </div>
        ) : (
          <div>
            {state.wsLogs.map((entry) => (
              <LogEntry key={entry.id} entry={entry} />
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}