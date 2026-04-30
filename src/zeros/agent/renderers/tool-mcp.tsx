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
// Stage 11 polish (2026-04-29): image and resource content
// blocks render as actual <img>/preview rather than raw JSON,
// so MCP servers that return screenshots or attachments are
// usable instead of dumping a base64 wall. Goose-style rich
// MCP-UI widgets are still deferred — those need a separate
// component library and aren't part of the MCP core spec.
// ──────────────────────────────────────────────────────────

import { memo, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileDown, Plug } from "lucide-react";

import type { Renderer } from "./types";
import type { AgentToolMessage } from "../use-agent-session";
import type { ContentBlock, ToolCallContent } from "../../bridge/agent-events";
import { DurationChip } from "./live-duration";

export const MCPCard: Renderer<AgentToolMessage> = memo(function MCPCard({
  message,
}) {
  const tool = message;
  const { server, toolName } = useMemo(() => splitMCPName(tool.title), [
    tool.title,
  ]);
  const inputJson = useMemo(() => safeStringify(tool.rawInput), [tool.rawInput]);
  // Stage 11 — split content blocks into rich (image/resource) vs
  // text. Rich blocks render as real widgets; text concatenates into
  // a single output preview the way the original card did.
  const { textOutput, mediaBlocks } = useMemo(
    () => splitContentBlocks(tool),
    [tool],
  );
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
          {mediaBlocks.length > 0 && (
            <div className="oc-agent-mcp-section">
              <div className="oc-agent-mcp-section-label">Attachments</div>
              <div className="oc-agent-mcp-media">
                {mediaBlocks.map((b, i) => (
                  <MCPMediaBlock key={i} block={b} />
                ))}
              </div>
            </div>
          )}
          {textOutput && (
            <div className="oc-agent-mcp-section">
              <div className="oc-agent-mcp-section-label">
                {tool.status === "failed" ? "Error" : "Output"}
              </div>
              <pre className="oc-agent-mcp-json">{textOutput}</pre>
            </div>
          )}
          {!inputJson && !textOutput && mediaBlocks.length === 0 && (
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

function splitContentBlocks(
  tool: AgentToolMessage,
): { textOutput: string; mediaBlocks: ContentBlock[] } {
  if (!tool.content) return { textOutput: "", mediaBlocks: [] };
  const textParts: string[] = [];
  const mediaBlocks: ContentBlock[] = [];
  for (const wrapper of tool.content as ToolCallContent[]) {
    if (wrapper.type !== "content") continue;
    const block = wrapper.content;
    switch (block.type) {
      case "text":
        if (typeof block.text === "string") textParts.push(block.text);
        break;
      case "image":
      case "audio":
      case "resource":
      case "resource_link":
        mediaBlocks.push(block);
        break;
      default:
        // Unknown content type — fall back to JSON dump in text section
        // so the user at least sees something rather than silent loss.
        try {
          textParts.push(JSON.stringify(block, null, 2));
        } catch {
          /* skip */
        }
    }
  }
  return { textOutput: textParts.join(""), mediaBlocks };
}

/** Renders a single non-text MCP content block. Image data renders
 *  as an actual <img> with a data URL; resources show file metadata
 *  + open-link affordance; audio/blob fall back to a download badge. */
function MCPMediaBlock({ block }: { block: ContentBlock }) {
  if (block.type === "image") {
    const src = `data:${block.mimeType};base64,${block.data}`;
    return (
      <div className="oc-agent-mcp-media-row">
        <img
          src={src}
          alt="MCP image attachment"
          className="oc-agent-mcp-media-image"
        />
      </div>
    );
  }
  if (block.type === "resource_link") {
    return (
      <div className="oc-agent-mcp-media-row">
        <FileDown className="w-3.5 h-3.5" />
        <a
          href={block.uri}
          target="_blank"
          rel="noopener noreferrer"
          className="oc-agent-mcp-media-link"
        >
          {block.title ?? block.name}
        </a>
        {block.description && (
          <span className="oc-agent-mcp-media-desc">
            — {block.description}
          </span>
        )}
      </div>
    );
  }
  if (block.type === "resource") {
    const r = block.resource;
    if ("text" in r) {
      return (
        <div className="oc-agent-mcp-media-row">
          <div className="oc-agent-mcp-media-resource">
            <div className="oc-agent-mcp-media-resource-uri">{r.uri}</div>
            <pre className="oc-agent-mcp-json">{r.text}</pre>
          </div>
        </div>
      );
    }
    // Blob — try to render as image when the mime type suggests it,
    // else surface as a download badge with the blob's URI.
    const mime = r.mimeType ?? "";
    if (mime.startsWith("image/")) {
      const src = `data:${mime};base64,${r.blob}`;
      return (
        <div className="oc-agent-mcp-media-row">
          <img
            src={src}
            alt={`MCP resource ${r.uri}`}
            className="oc-agent-mcp-media-image"
          />
        </div>
      );
    }
    return (
      <div className="oc-agent-mcp-media-row">
        <FileDown className="w-3.5 h-3.5" />
        <span className="oc-agent-mcp-media-resource-uri">{r.uri}</span>
        <span className="oc-agent-mcp-media-desc">
          ({mime || "binary"})
        </span>
      </div>
    );
  }
  if (block.type === "audio") {
    const src = `data:${block.mimeType};base64,${block.data}`;
    return (
      <div className="oc-agent-mcp-media-row">
        <audio controls src={src} className="oc-agent-mcp-media-audio" />
      </div>
    );
  }
  return null;
}

