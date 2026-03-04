import React, { useState } from "react";
import {
  Zap,
  Wifi,
  WifiOff,
  RefreshCw,
  Check,
  Clock,
  Terminal,
  Copy,
  Code2,
  Send,
  FileCode,
  ArrowRight,
} from "lucide-react";
import { useWorkspace, IDEConnection } from "../store";
import { ScrollArea } from "./ui/scroll-area";
import { WSBridgePanel } from "./ws-bridge";

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

  const copyCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setupCmd =
    ide.type === "claude-code"
      ? "claude mcp add designdead"
      : `npx designdead@latest init --${ide.type}`;

  return (
    <div className="p-3 border border-[#1a1a1a] rounded-xl bg-[#080808] hover:border-[#333333] transition-colors">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] text-white"
            style={{ background: ide.color }}
          >
            {ide.icon}
          </div>
          <div>
            <span className="text-[13px] text-foreground block">{ide.name}</span>
            <span className="text-[10px] text-muted-foreground">{ide.description}</span>
          </div>
        </div>
        <div>
          {ide.status === "connected" ? (
            <span className="flex items-center gap-1 text-[10px] text-[#50e3c2] bg-[#50e3c2]/10 px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-[#50e3c2] animate-pulse" />
              Connected
            </span>
          ) : ide.status === "connecting" ? (
            <span className="flex items-center gap-1 text-[10px] text-[#f5a623] bg-[#f5a623]/10 px-1.5 py-0.5 rounded">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Connecting
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-[#1a1a1a] px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-[#444444]" />
              Offline
            </span>
          )}
        </div>
      </div>

      {ide.lastSync && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2.5">
          <Clock className="w-3 h-3" />
          Last synced {formatTimeAgo(ide.lastSync)}
        </div>
      )}

      {/* Setup command */}
      {ide.status === "disconnected" && (
        <button
          onClick={() => copyCmd(setupCmd)}
          className="w-full flex items-center justify-between bg-[#111111] border border-[#1a1a1a] rounded-lg px-3 py-2 hover:border-[#333333] transition-colors group mb-2.5"
        >
          <code
            className="text-[10px] text-[#50e3c2]"
            style={{ fontFamily: "'Geist Mono', monospace" }}
          >
            {setupCmd}
          </code>
          {copied ? (
            <Check className="w-3 h-3 text-[#50e3c2]" />
          ) : (
            <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      )}

      <div className="flex gap-2">
        {ide.status === "connected" ? (
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-[#1a1a1a] rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:border-[#333333] transition-colors"
            onClick={() =>
              dispatch({ type: "UPDATE_IDE_STATUS", id: ide.id, status: "disconnected" })
            }
          >
            <WifiOff className="w-3 h-3" />
            Disconnect
          </button>
        ) : (
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-foreground text-background rounded-lg text-[11px] hover:opacity-90 transition-opacity"
            onClick={() =>
              dispatch({ type: "UPDATE_IDE_STATUS", id: ide.id, status: "connected" })
            }
          >
            <Wifi className="w-3 h-3" />
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

export function AgentPanel() {
  const { state } = useWorkspace();
  const [tab, setTab] = useState<"ides" | "bridge" | "output" | "activity">("ides");
  const [copied, setCopied] = useState(false);

  const connectedCount = state.ides.filter((i) => i.status === "connected").length;

  // Generate structured output for agents
  const generateOutput = () => {
    const changes = state.styleChanges.map((c) => {
      const findSel = (els: typeof state.elements, id: string): string => {
        for (const el of els) {
          if (el.id === id) return el.selector;
          const found = findSel(el.children, id);
          if (found) return found;
        }
        return "";
      };
      return {
        selector: findSel(state.elements, c.elementId),
        property: c.property.replace(/([A-Z])/g, "-$1").toLowerCase(),
        from: c.oldValue,
        to: c.newValue,
      };
    });

    return `## Design Changes from designdead\n\n${changes
      .map(
        (c) =>
          `- **${c.selector}**: \`${c.property}\` changed from \`${c.from || "(none)"}\` to \`${c.to}\``
      )
      .join("\n")}\n\n---\n\nPlease apply these CSS changes to the codebase. Use \`grep\` to find the relevant selectors and update the styles accordingly.`;
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#f5a623]" />
          <span className="text-[13px] text-foreground">IDE & Agents</span>
          {connectedCount > 0 && (
            <span className="text-[10px] text-[#50e3c2] bg-[#50e3c2]/10 px-1.5 py-0.5 rounded">
              {connectedCount} active
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["ides", "bridge", "output", "activity"] as const).map((t) => (
          <button
            key={t}
            className={`flex-1 py-2 text-[11px] transition-colors ${
              tab === t
                ? "text-foreground border-b border-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "ides" ? "IDE" : t === "bridge" ? (
              <span className="flex items-center justify-center gap-1">
                MCP
                {state.wsStatus === "connected" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#50e3c2]" />
                )}
              </span>
            ) : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Bridge tab renders outside ScrollArea (has its own) */}
      {tab === "bridge" && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <WSBridgePanel />
        </div>
      )}

      {tab !== "bridge" && (
      <ScrollArea className="flex-1">
        {tab === "ides" && (
          <div className="p-3 space-y-2">
            {state.ides.map((ide) => (
              <IDECard key={ide.id} ide={ide} />
            ))}
          </div>
        )}

        {tab === "output" && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-muted-foreground">
                Structured output for AI agents
              </span>
              <button
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(generateOutput());
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? (
                  <Check className="w-3 h-3 text-[#50e3c2]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre
              className="text-[11px] text-foreground bg-[#111111] p-3 rounded-xl border border-[#1a1a1a] overflow-x-auto whitespace-pre-wrap"
              style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace" }}
            >
              {state.styleChanges.length > 0
                ? generateOutput()
                : "No style changes yet.\n\nEdit element styles in the Style panel to generate\nstructured instructions for your AI agent."}
            </pre>

            {state.styleChanges.length > 0 && connectedCount > 0 && (
              <button className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-foreground text-background rounded-lg text-[12px] hover:opacity-90 transition-opacity">
                <Send className="w-3.5 h-3.5" />
                Send to connected IDE
              </button>
            )}
          </div>
        )}

        {tab === "activity" && (
          <div className="p-3 space-y-1">
            {[
              { time: "12:45:02", msg: "Connected to Claude Code via MCP", type: "success" as const },
              { time: "12:45:05", msg: "Project detected: Next.js (localhost:3000)", type: "info" as const },
              { time: "12:46:12", msg: "3 style changes captured", type: "info" as const },
              { time: "12:46:14", msg: "Changes sent to Claude Code", type: "success" as const },
              { time: "12:47:30", msg: "Applied: src/components/Hero.tsx", type: "success" as const },
              { time: "12:48:01", msg: "Watching for new edits...", type: "info" as const },
            ].map((log, i) => (
              <div
                key={i}
                className="flex items-start gap-2 py-1.5 border-b border-[#111111] last:border-0"
              >
                <span
                  className="text-[10px] text-muted-foreground shrink-0 mt-0.5"
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                >
                  {log.time}
                </span>
                <span
                  className={`text-[11px] ${
                    log.type === "success" ? "text-[#50e3c2]" : "text-muted-foreground"
                  }`}
                >
                  {log.msg}
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      )}
    </div>
  );
}