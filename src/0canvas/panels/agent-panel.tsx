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
import { useWorkspace, IDEConnection, WSLogEntry } from "../store/store";
import { copyToClipboard } from "../utils/clipboard";
import { syncFeedbackToBridge } from "../utils/sync-feedback";

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
      ? "claude mcp add 0canvas -- npx @zerosdesign/0canvas mcp"
      : ide.type === "cursor"
      ? "npx @zerosdesign/0canvas mcp"
      : `npx @zerosdesign/0canvas mcp --${ide.type}`;

  const statusClass =
    ide.status === "connected" ? "is-connected" : ide.status === "connecting" ? "is-connecting" : "is-disconnected";
  const statusLabel =
    ide.status === "connected" ? "Connected" : ide.status === "connecting" ? "Connecting" : "Offline";

  return (
    <div className="oc-agent-ide-card">
      <div className="oc-agent-card-header">
        <div className="oc-agent-card-info">
          <div className="oc-agent-card-icon" style={{ background: ide.color }}>
            {ide.icon}
          </div>
          <div>
            <div className="oc-agent-card-name">{ide.name}</div>
            <div className="oc-agent-card-desc">{ide.description}</div>
          </div>
        </div>
        <span className={`oc-agent-status-badge ${statusClass}`}>
          <span className={`oc-agent-status-dot ${statusClass}`} />
          {statusLabel}
        </span>
      </div>

      {ide.lastSync && (
        <div className="oc-agent-last-sync">
          <Clock size={12} />
          Last synced {formatTimeAgo(ide.lastSync)}
        </div>
      )}

      {ide.status === "disconnected" && (
        <button className="oc-agent-code-block" onClick={() => handleCopy(setupCmd)}>
          <code>{setupCmd}</code>
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      )}

      <div className="oc-agent-btn-row">
        {ide.status === "connected" ? (
          <button
            className="oc-agent-btn-secondary"
            onClick={() => dispatch({ type: "UPDATE_IDE_STATUS", id: ide.id, status: "disconnected" })}
          >
            <WifiOff size={12} />
            Disconnect
          </button>
        ) : (
          <button
            className="oc-agent-btn-primary"
            onClick={() => dispatch({ type: "UPDATE_IDE_STATUS", id: ide.id, status: "connected" })}
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
    const result = await syncFeedbackToBridge(state.feedbackItems, state.variants, state.ocProject, mcpPort);
    if (result.ok && result.sentCount > 0) {
      const entry: WSLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        direction: "sent",
        method: "sync",
        summary: `Synced ${result.sentCount} feedback items and ${state.variants.length} variants`,
      };
      dispatch({ type: "WS_LOG", entry });
    }
  }, [mcpStatus, mcpPort, state.feedbackItems, state.variants, state.ocProject, dispatch]);

  const mcpStatusClass =
    mcpStatus === "online" ? "is-connected" : mcpStatus === "checking" ? "is-connecting" : "is-disconnected";
  const mcpStatusLabel =
    mcpStatus === "online" ? "Online" : mcpStatus === "checking" ? "Checking..." : "Offline";

  const tabs = ["ides", "mcp", "activity"] as const;
  const tabLabels = { ides: "IDE", mcp: "MCP Server", activity: "Activity" };

  return (
    <div className="oc-panel">
      <div className="oc-panel-header">
        <div className="oc-agent-card-info">
          <Zap size={16} />
          <span>IDE &amp; Agents</span>
          {connectedCount > 0 && (
            <span className="oc-agent-active-badge">
              {connectedCount} active
            </span>
          )}
        </div>
      </div>

      <div className="oc-style-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={`oc-style-tab ${tab === t ? "is-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      <div className="oc-panel-body" style={{ padding: 12 }}>
        {tab === "ides" && state.ides.map((ide) => <IDECard key={ide.id} ide={ide} />)}

        {tab === "mcp" && (
          <div>
            <div className="oc-agent-mcp-card">
              <div className="oc-agent-card-header">
                <div className="oc-agent-card-info">
                  <Server size={16} />
                  <span>MCP Server</span>
                </div>
                <span className={`oc-agent-status-badge ${mcpStatusClass}`}>
                  <Circle size={6} fill="currentColor" stroke="none" />
                  {mcpStatusLabel}
                </span>
              </div>

              <div className="oc-agent-mcp-url">
                URL: <code>http://127.0.0.1:{mcpPort}</code>
              </div>

              <div className="oc-agent-mcp-desc">
                The MCP server bridges ZeroCanvas with AI agents like Cursor and Claude Code.
                Feedback and variants are synced automatically when the server is running.
              </div>

              <div className="oc-agent-btn-row">
                <button className="oc-agent-btn-secondary" onClick={checkMcpHealth}>
                  <RefreshCw size={12} />
                  Refresh
                </button>
                <button
                  className={`oc-agent-btn-primary ${mcpStatus === "online" ? "is-accent" : "is-disabled"}`}
                  onClick={syncFeedbackToMcp}
                  disabled={mcpStatus !== "online"}
                >
                  <Send size={12} />
                  Sync Now
                </button>
              </div>
            </div>

            <div className="oc-agent-setup-card">
              <div className="oc-agent-setup-title">Quick Setup</div>
              <div className="oc-agent-setup-hint">
                Run the MCP server in your terminal:
              </div>
              <button
                className="oc-agent-code-block"
                onClick={() => {
                  copyToClipboard("npx @zerosdesign/0canvas mcp");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <code>npx @zerosdesign/0canvas mcp</code>
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
              <div className="oc-agent-setup-hint">
                Or add to your MCP config:
              </div>
              <pre className="oc-agent-setup-pre">
{`{
  "0canvas": {
    "command": "npx",
    "args": ["@zerosdesign/0canvas", "mcp"]
  }
}`}
              </pre>
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div>
            {state.wsLogs.length === 0 ? (
              <div className="oc-panel-empty">
                No activity yet. Sync feedback or connect an agent to see events here.
              </div>
            ) : (
              state.wsLogs.slice().reverse().map((log) => (
                <div key={log.id} className="oc-agent-log-entry">
                  <span className="oc-agent-log-time">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <div>
                    <div className={`oc-agent-log-summary ${
                      log.direction === "sent" ? "is-sent" : log.direction === "received" ? "is-received" : "is-default"
                    }`}>
                      {log.summary}
                    </div>
                    {log.method && (
                      <span className="oc-agent-log-method">{log.method}</span>
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
