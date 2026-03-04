import React, { useState, useEffect, useCallback } from "react";
import {
  Zap,
  Wifi,
  WifiOff,
  RefreshCw,
  Check,
  Clock,
  Copy,
  Send,
  Activity,
  Server,
  Circle,
} from "lucide-react";
import { useWorkspace, IDEConnection, WSLogEntry } from "../store";
import { copyToClipboard } from "./clipboard";

const FONT = "'Geist Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const MONO = "'Geist Mono','SF Mono','Fira Code',monospace";
const C = {
  bg: "#0a0a0a",
  surface: "#111111",
  surfaceHover: "#1a1a1a",
  border: "#1e1e1e",
  fg: "#ededed",
  fgMuted: "#888888",
  fgDim: "#555555",
  accent: "#0070f3",
  green: "#50e3c2",
  orange: "#f5a623",
  red: "#ff4444",
};

const MCP_PORT = 24192;

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function IDECard({ ide }: { ide: IDEConnection }) {
  const { dispatch } = useWorkspace();
  const [copied, setCopied] = useState(false);

  const handleCopy = (cmd: string) => {
    copyToClipboard(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setupCmd =
    ide.type === "claude-code"
      ? "claude mcp add designdead -- npx @zerosdesign/design-dead mcp"
      : ide.type === "cursor"
      ? "npx @zerosdesign/design-dead mcp"
      : `npx @zerosdesign/design-dead mcp --${ide.type}`;

  const statusColor = ide.status === "connected" ? C.green : ide.status === "connecting" ? C.orange : "#444";
  const statusLabel = ide.status === "connected" ? "Connected" : ide.status === "connecting" ? "Connecting" : "Offline";

  return (
    <div
      style={{
        padding: 12,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        background: "#080808",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: ide.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              color: "#fff",
              fontFamily: FONT,
            }}
          >
            {ide.icon}
          </div>
          <div>
            <div style={{ fontSize: 13, color: C.fg, fontFamily: FONT }}>{ide.name}</div>
            <div style={{ fontSize: 10, color: C.fgMuted, fontFamily: FONT }}>{ide.description}</div>
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            color: statusColor,
            background: `${statusColor}15`,
            padding: "2px 8px",
            borderRadius: 4,
            fontFamily: FONT,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} />
          {statusLabel}
        </span>
      </div>

      {ide.lastSync && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.fgMuted, marginBottom: 10, fontFamily: FONT }}>
          <Clock size={12} />
          Last synced {formatTimeAgo(ide.lastSync)}
        </div>
      )}

      {ide.status === "disconnected" && (
        <button
          onClick={() => handleCopy(setupCmd)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "8px 12px",
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          <code style={{ fontSize: 10, color: C.green, fontFamily: MONO }}>{setupCmd}</code>
          {copied ? <Check size={12} color={C.green} /> : <Copy size={12} color={C.fgDim} />}
        </button>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {ide.status === "connected" ? (
          <button
            onClick={() => dispatch({ type: "UPDATE_IDE_STATUS", id: ide.id, status: "disconnected" })}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 0",
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              background: "transparent",
              color: C.fgMuted,
              fontSize: 11,
              fontFamily: FONT,
              cursor: "pointer",
            }}
          >
            <WifiOff size={12} />
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => dispatch({ type: "UPDATE_IDE_STATUS", id: ide.id, status: "connected" })}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 0",
              border: "none",
              borderRadius: 8,
              background: C.fg,
              color: C.bg,
              fontSize: 11,
              fontFamily: FONT,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Wifi size={12} />
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

export function AgentPanel() {
  const { state, dispatch } = useWorkspace();
  const [tab, setTab] = useState<"ides" | "mcp" | "activity">("ides");
  const [mcpStatus, setMcpStatus] = useState<"checking" | "online" | "offline">("checking");
  const [mcpPort, setMcpPort] = useState(MCP_PORT);
  const [copied, setCopied] = useState(false);

  const connectedCount = state.ides.filter((i) => i.status === "connected").length;

  const checkMcpHealth = useCallback(async () => {
    setMcpStatus("checking");
    try {
      const res = await fetch(`http://127.0.0.1:${mcpPort}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        setMcpStatus("online");
        dispatch({ type: "WS_STATUS_UPDATE", status: "connected" });
        dispatch({ type: "WS_SET_PORT", port: mcpPort });
      } else {
        setMcpStatus("offline");
        dispatch({ type: "WS_STATUS_UPDATE", status: "disconnected" });
      }
    } catch {
      setMcpStatus("offline");
      dispatch({ type: "WS_STATUS_UPDATE", status: "disconnected" });
    }
  }, [mcpPort, dispatch]);

  useEffect(() => {
    checkMcpHealth();
    const interval = setInterval(checkMcpHealth, 15000);
    return () => clearInterval(interval);
  }, [checkMcpHealth]);

  const syncFeedbackToMcp = useCallback(async () => {
    if (mcpStatus !== "online") return;
    const pendingItems = state.feedbackItems.filter((f) => f.status === "pending");
    try {
      await fetch(`http://127.0.0.1:${mcpPort}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: pendingItems }),
      });
      await fetch(`http://127.0.0.1:${mcpPort}/api/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variants: state.variants }),
      });
      await fetch(`http://127.0.0.1:${mcpPort}/api/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: state.ddProject }),
      });

      const now = new Date();
      const entry: WSLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        direction: "sent",
        method: "sync",
        summary: `Synced ${pendingItems.length} feedback items and ${state.variants.length} variants`,
      };
      dispatch({ type: "WS_LOG", entry });
    } catch {}
  }, [mcpStatus, mcpPort, state.feedbackItems, state.variants, state.ddProject, dispatch]);

  const mcpStatusColor = mcpStatus === "online" ? C.green : mcpStatus === "checking" ? C.orange : C.red;
  const mcpStatusLabel = mcpStatus === "online" ? "Online" : mcpStatus === "checking" ? "Checking..." : "Offline";

  const tabs = ["ides", "mcp", "activity"] as const;
  const tabLabels = { ides: "IDE", mcp: "MCP Server", activity: "Activity" };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg, fontFamily: FONT, color: C.fg }}>
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={16} color={C.orange} />
          <span style={{ fontSize: 13 }}>IDE & Agents</span>
          {connectedCount > 0 && (
            <span style={{ fontSize: 10, color: C.green, background: `${C.green}15`, padding: "2px 8px", borderRadius: 4 }}>
              {connectedCount} active
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "8px 0",
              fontSize: 11,
              fontFamily: FONT,
              background: "transparent",
              border: "none",
              borderBottom: tab === t ? `2px solid ${C.fg}` : "2px solid transparent",
              color: tab === t ? C.fg : C.fgMuted,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {tab === "ides" && state.ides.map((ide) => <IDECard key={ide.id} ide={ide} />)}

        {tab === "mcp" && (
          <div>
            <div style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: 10, background: "#080808", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Server size={16} color={mcpStatusColor} />
                  <span style={{ fontSize: 13 }}>MCP Server</span>
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    color: mcpStatusColor,
                    background: `${mcpStatusColor}15`,
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  <Circle size={6} fill={mcpStatusColor} stroke="none" />
                  {mcpStatusLabel}
                </span>
              </div>

              <div style={{ fontSize: 11, color: C.fgMuted, marginBottom: 8 }}>
                URL: <code style={{ fontFamily: MONO, color: C.fg }}>http://127.0.0.1:{mcpPort}</code>
              </div>

              <div style={{ fontSize: 11, color: C.fgMuted, marginBottom: 12 }}>
                The MCP server bridges DesignDead with AI agents like Cursor and Claude Code.
                Feedback and variants are synced automatically when the server is running.
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={checkMcpHealth}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "6px 0",
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    background: "transparent",
                    color: C.fgMuted,
                    fontSize: 11,
                    fontFamily: FONT,
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={12} />
                  Refresh
                </button>
                <button
                  onClick={syncFeedbackToMcp}
                  disabled={mcpStatus !== "online"}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "6px 0",
                    border: "none",
                    borderRadius: 8,
                    background: mcpStatus === "online" ? C.accent : "#222",
                    color: mcpStatus === "online" ? "#fff" : "#555",
                    fontSize: 11,
                    fontFamily: FONT,
                    fontWeight: 500,
                    cursor: mcpStatus === "online" ? "pointer" : "default",
                  }}
                >
                  <Send size={12} />
                  Sync Now
                </button>
              </div>
            </div>

            <div style={{ padding: 12, border: `1px solid ${C.border}`, borderRadius: 10, background: "#080808" }}>
              <div style={{ fontSize: 11, color: C.fgMuted, marginBottom: 8 }}>Quick Setup</div>
              <div style={{ fontSize: 10, color: C.fgDim, marginBottom: 8 }}>
                Run the MCP server in your terminal:
              </div>
              <button
                onClick={() => {
                  copyToClipboard("npx @zerosdesign/design-dead mcp");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                <code style={{ fontSize: 10, color: C.green, fontFamily: MONO }}>npx @zerosdesign/design-dead mcp</code>
                {copied ? <Check size={12} color={C.green} /> : <Copy size={12} color={C.fgDim} />}
              </button>
              <div style={{ fontSize: 10, color: C.fgDim }}>
                Or add to your MCP config:
              </div>
              <pre
                style={{
                  fontSize: 10,
                  fontFamily: MONO,
                  color: C.fg,
                  background: C.surface,
                  padding: 10,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  marginTop: 6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
{`{
  "designdead": {
    "command": "npx",
    "args": ["@zerosdesign/design-dead", "mcp"]
  }
}`}
              </pre>
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div>
            {state.wsLogs.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: C.fgDim, fontSize: 11 }}>
                No activity yet. Sync feedback or connect an agent to see events here.
              </div>
            ) : (
              state.wsLogs.slice().reverse().map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "6px 0",
                    borderBottom: `1px solid ${C.surface}`,
                  }}
                >
                  <span style={{ fontSize: 10, color: C.fgDim, fontFamily: MONO, flexShrink: 0, marginTop: 1 }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <div>
                    <div style={{ fontSize: 11, color: log.direction === "sent" ? C.accent : log.direction === "received" ? C.green : C.fgMuted }}>
                      {log.summary}
                    </div>
                    {log.method && (
                      <span style={{ fontSize: 9, color: C.fgDim }}>{log.method}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
