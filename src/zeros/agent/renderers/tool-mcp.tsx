// ──────────────────────────────────────────────────────────
// MCPCard — Model Context Protocol tool calls
// ──────────────────────────────────────────────────────────
//
// Renders any tool with kind="mcp". Anthropic's convention for
// MCP tool names is `mcp__<server>__<tool>` — we split that
// out for the header (`<server>.<tool>`) and render the input
// + result as collapsible JSON.
//
// MCP tools are inherently agent-agnostic: every CLI exposes
// the same `mcp__*` namespace once an MCP server is registered.
// One card, one renderer, every agent.
//
// Goose-style rich `ui` content payloads (MCP-UI components)
// are deferred — for now we render the JSON. Phase 2 polish
// can detect a `ui` content block and embed the widget.
// ──────────────────────────────────────────────────────────

import { memo, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plug } from "lucide-react";

import type { Renderer } from "./types";
import type { AgentToolMessage } from "../use-agent-session";
import { DurationChip } from "./live-duration";

export const MCPCard: Renderer<AgentToolMessage> = memo(function MCPCard({
  message,
}) {
  const tool = message;
  const { server, toolName } = useMemo(() => splitMCPName(tool.title), [
    tool.title,
  ]);
  const inputJson = useMemo(() => safeStringify(tool.rawInput), [tool.rawInput]);
  const outputJson = useMemo(() => readOutputText(tool), [tool]);
  const durationMs = tool.updatedAt - tool.createdAt;
  const [expanded, setExpanded] = useState(() => tool.status === "failed");

  return (
    <div className="oc-agent-tool oc-agent-tool-mcp">
      <button
        type="button"
        className="oc-agent-tool-head oc-agent-mcp-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="oc-agent-tool-icon w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="oc-agent-tool-icon w-3.5 h-3.5" />
        )}
        <Plug className="oc-agent-tool-icon w-3.5 h-3.5" />
        <div className="oc-agent-tool-body">
          <div className="oc-agent-mcp-id">
            <span className="oc-agent-mcp-server">{server}</span>
            <span className="oc-agent-mcp-dot">.</span>
            <span className="oc-agent-mcp-tool">{toolName}</span>
          </div>
        </div>
        <div className="oc-agent-mcp-meta">
          <DurationChip
            status={tool.status}
            startedAt={tool.createdAt}
            durationMs={durationMs}
            className="oc-agent-mcp-duration"
          />
          <MCPStatusBadge status={tool.status} />
        </div>
      </button>
      {expanded && (
        <div className="oc-agent-mcp-content">
          {inputJson && (
            <div className="oc-agent-mcp-section">
              <div className="oc-agent-mcp-section-label">Input</div>
              <pre className="oc-agent-mcp-json">{inputJson}</pre>
            </div>
          )}
          {outputJson && (
            <div className="oc-agent-mcp-section">
              <div className="oc-agent-mcp-section-label">
                {tool.status === "failed" ? "Error" : "Output"}
              </div>
              <pre className="oc-agent-mcp-json">{outputJson}</pre>
            </div>
          )}
          {!inputJson && !outputJson && (
            <div className="oc-agent-mcp-empty">
              {tool.status === "in_progress" ? "Calling…" : "(no payload)"}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function MCPStatusBadge({ status }: { status: AgentToolMessage["status"] }) {
  const cls =
    status === "completed"
      ? "oc-agent-mcp-status oc-agent-mcp-status-ok"
      : status === "failed"
      ? "oc-agent-mcp-status oc-agent-mcp-status-fail"
      : "oc-agent-mcp-status oc-agent-mcp-status-run";
  const label =
    status === "completed"
      ? "ok"
      : status === "failed"
      ? "failed"
      : status === "in_progress"
      ? "calling"
      : "queued";
  return <span className={cls}>{label}</span>;
}

// ──────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────

function splitMCPName(title: string): { server: string; toolName: string } {
  // Anthropic format: `mcp__<server>__<tool>`
  const m = title.match(/^mcp__([^_]+(?:_[^_]+)*)__(.+)$/);
  if (m) return { server: m[1], toolName: m[2] };
  // Fallback: hand back the whole title under "tool" with a generic
  // "mcp" server label so the chrome still reads coherently.
  return { server: "mcp", toolName: title };
}

function safeStringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function readOutputText(tool: AgentToolMessage): string {
  if (!tool.content) return "";
  const parts: string[] = [];
  for (const block of tool.content) {
    if (block.type === "content") {
      const c = block.content as { type?: string; text?: string };
      if (c?.type === "text" && typeof c.text === "string") {
        parts.push(c.text);
      }
    }
  }
  return parts.join("");
}

