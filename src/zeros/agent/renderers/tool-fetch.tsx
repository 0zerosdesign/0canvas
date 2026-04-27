// ──────────────────────────────────────────────────────────
// FetchCard — WebFetch + WebSearch tool calls
// ──────────────────────────────────────────────────────────
//
// Renders any tool with kind="fetch" (URL fetch) or
// kind="web_search" (web search). Same card, two render
// modes — they're the only tools that bring in external
// content from the open internet.
//
// fetch mode:
//   ┌────────────────────────────────────────────────────┐
//   │ [▶ globe]  https://example.com/foo  · 200      [✓]  │
//   ├────────────────────────────────────────────────────┤
//   │ body preview (markdown / plain text)                │
//   └────────────────────────────────────────────────────┘
//
// web_search mode:
//   ┌────────────────────────────────────────────────────┐
//   │ [▶ search]  "kimi k2 release notes"  · 5 hits  [✓]  │
//   ├────────────────────────────────────────────────────┤
//   │ Hit 1 title                                         │
//   │   https://example.com/article — snippet             │
//   │ Hit 2 title                                         │
//   │   https://other.com/article — snippet               │
//   └────────────────────────────────────────────────────┘
//
// Default-collapsed.
// ──────────────────────────────────────────────────────────

import { memo, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Search as SearchIcon,
} from "lucide-react";

import type { Renderer } from "./types";
import type { AgentToolMessage } from "../use-agent-session";

export const FetchCard: Renderer<AgentToolMessage> = memo(function FetchCard({
  message,
}) {
  const tool = message;
  const isWebSearch = tool.toolKind === "web_search";
  const text = useMemo(() => readResultText(tool), [tool]);
  const durationMs = tool.updatedAt - tool.createdAt;
  const [expanded, setExpanded] = useState(() =>
    tool.status === "failed" || tool.status === "in_progress",
  );

  if (isWebSearch) {
    return (
      <WebSearchCard
        tool={tool}
        text={text}
        durationMs={durationMs}
        expanded={expanded}
        setExpanded={setExpanded}
      />
    );
  }

  return (
    <FetchURLCard
      tool={tool}
      text={text}
      durationMs={durationMs}
      expanded={expanded}
      setExpanded={setExpanded}
    />
  );
});

// ──────────────────────────────────────────────────────────
// fetch mode (single URL)
// ──────────────────────────────────────────────────────────

function FetchURLCard({
  tool,
  text,
  durationMs,
  expanded,
  setExpanded,
}: {
  tool: AgentToolMessage;
  text: string;
  durationMs: number;
  expanded: boolean;
  setExpanded: (fn: (v: boolean) => boolean) => void;
}) {
  const url = readURL(tool.rawInput) ?? tool.title;
  const host = useMemo(() => extractHost(url), [url]);
  return (
    <div className="oc-agent-tool oc-agent-tool-fetch">
      <button
        type="button"
        className="oc-agent-tool-head oc-agent-fetch-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="oc-agent-tool-icon w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="oc-agent-tool-icon w-3.5 h-3.5" />
        )}
        <Globe className="oc-agent-tool-icon w-3.5 h-3.5" />
        <div className="oc-agent-tool-body">
          <div className="oc-agent-fetch-url" title={url}>
            <span className="oc-agent-fetch-host">{host}</span>
            <span className="oc-agent-fetch-path">{stripHost(url, host)}</span>
          </div>
        </div>
        <div className="oc-agent-fetch-meta">
          {durationMs > 250 && tool.status !== "in_progress" && (
            <span className="oc-agent-fetch-duration">
              {formatDuration(durationMs)}
            </span>
          )}
          <FetchStatusBadge status={tool.status} variant="fetch" />
        </div>
      </button>
      {expanded && (
        <div className="oc-agent-fetch-content">
          {!text ? (
            <div className="oc-agent-fetch-empty">
              {tool.status === "in_progress"
                ? "Fetching…"
                : tool.status === "failed"
                ? "Fetch failed."
                : "(no body)"}
            </div>
          ) : (
            <pre className="oc-agent-fetch-body">{text}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// web_search mode
// ──────────────────────────────────────────────────────────

interface WebHit {
  title?: string;
  url: string;
  snippet?: string;
}

function WebSearchCard({
  tool,
  text,
  durationMs,
  expanded,
  setExpanded,
}: {
  tool: AgentToolMessage;
  text: string;
  durationMs: number;
  expanded: boolean;
  setExpanded: (fn: (v: boolean) => boolean) => void;
}) {
  const query = readQuery(tool.rawInput) ?? tool.title;
  const hits = useMemo(() => parseWebSearchHits(text), [text]);

  return (
    <div className="oc-agent-tool oc-agent-tool-fetch oc-agent-tool-websearch">
      <button
        type="button"
        className="oc-agent-tool-head oc-agent-fetch-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="oc-agent-tool-icon w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="oc-agent-tool-icon w-3.5 h-3.5" />
        )}
        <SearchIcon className="oc-agent-tool-icon w-3.5 h-3.5" />
        <div className="oc-agent-tool-body">
          <div className="oc-agent-fetch-query" title={query}>
            <span className="oc-agent-fetch-tool">Web search</span>
            <span className="oc-agent-fetch-querytext">"{query}"</span>
          </div>
        </div>
        <div className="oc-agent-fetch-meta">
          <span className="oc-agent-fetch-count">
            {tool.status === "in_progress"
              ? "searching…"
              : hits.length === 0
              ? "0 hits"
              : `${hits.length} ${hits.length === 1 ? "hit" : "hits"}`}
          </span>
          {durationMs > 250 && tool.status !== "in_progress" && (
            <span className="oc-agent-fetch-duration">
              {formatDuration(durationMs)}
            </span>
          )}
          <FetchStatusBadge status={tool.status} variant="search" />
        </div>
      </button>
      {expanded && (
        <div className="oc-agent-fetch-content">
          {hits.length > 0 ? (
            <ul className="oc-agent-fetch-hits">
              {hits.map((h, i) => (
                <li key={i} className="oc-agent-fetch-hit">
                  {h.title && (
                    <div className="oc-agent-fetch-hit-title">{h.title}</div>
                  )}
                  <div className="oc-agent-fetch-hit-url">{h.url}</div>
                  {h.snippet && (
                    <div className="oc-agent-fetch-hit-snippet">{h.snippet}</div>
                  )}
                </li>
              ))}
            </ul>
          ) : !text ? (
            <div className="oc-agent-fetch-empty">
              {tool.status === "in_progress" ? "Searching…" : "(no results)"}
            </div>
          ) : (
            <pre className="oc-agent-fetch-body">{text}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Status badge — same colors as Stage 3, slightly different
// labels because the action verbs differ for fetch vs search.
// ──────────────────────────────────────────────────────────

function FetchStatusBadge({
  status,
  variant,
}: {
  status: AgentToolMessage["status"];
  variant: "fetch" | "search";
}) {
  const cls =
    status === "completed"
      ? "oc-agent-fetch-status oc-agent-fetch-status-ok"
      : status === "failed"
      ? "oc-agent-fetch-status oc-agent-fetch-status-fail"
      : "oc-agent-fetch-status oc-agent-fetch-status-run";
  const label =
    status === "completed"
      ? variant === "fetch"
        ? "fetched"
        : "done"
      : status === "failed"
      ? "failed"
      : status === "in_progress"
      ? variant === "fetch"
        ? "fetching"
        : "searching"
      : "queued";
  return <span className={cls}>{label}</span>;
}

// ──────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────

function readURL(input: unknown): string | null {
  if (!isObj(input)) return null;
  const u = input.url ?? input.URL ?? input.target;
  return typeof u === "string" ? u : null;
}

function readQuery(input: unknown): string | null {
  if (!isObj(input)) return null;
  const q = input.query ?? input.q ?? input.search;
  return typeof q === "string" ? q : null;
}

function extractHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    // Probably not a real URL — return the front segment as a hint.
    const m = url.match(/^[a-z]+:\/\/([^/]+)/i);
    return m ? m[1] : url;
  }
}

function stripHost(url: string, host: string): string {
  if (!host) return url;
  const idx = url.indexOf(host);
  if (idx < 0) return url;
  return url.slice(idx + host.length);
}

function readResultText(tool: AgentToolMessage): string {
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

// Web search parser — Claude returns markdown-ish text with hits
// formatted variously across versions. We try a few patterns and
// fall back to the raw text if nothing structures cleanly.
//
// Common shapes seen on Claude Code WebSearch:
//   1. **Title**\n   URL\n   snippet
//   2. - [Title](url): snippet
//   3. Plain numbered list: `1. title — url — snippet`
//
// On no-match, the renderer shows the raw text so the user never
// loses information just because our parser missed a format change.

function parseWebSearchHits(text: string): WebHit[] {
  if (!text) return [];
  const hits: WebHit[] = [];

  // Pattern 1: markdown links `[title](url)`
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)([^\n]*)?/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(text)) != null) {
    hits.push({
      title: m[1].trim(),
      url: m[2],
      snippet: (m[3] || "").replace(/^[\s—:-]+/, "").trim() || undefined,
    });
  }
  if (hits.length > 0) return hits;

  // Pattern 2: bare URLs with a preceding title line
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const urlMatch = line.match(/(https?:\/\/\S+)/);
    if (urlMatch) {
      const titleLine = i > 0 ? lines[i - 1].trim() : "";
      const snippetLine = i + 1 < lines.length ? lines[i + 1].trim() : "";
      hits.push({
        title: titleLine && !titleLine.startsWith("http") ? titleLine : undefined,
        url: urlMatch[1].replace(/[.,;)\]]+$/, ""),
        snippet:
          snippetLine && !snippetLine.startsWith("http")
            ? snippetLine
            : undefined,
      });
    }
  }
  return hits;
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}
