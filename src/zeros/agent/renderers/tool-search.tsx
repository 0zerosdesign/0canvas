// ──────────────────────────────────────────────────────────
// SearchCard — Grep / Glob / LS tool calls
// ──────────────────────────────────────────────────────────
//
// Renders any tool with kind="search". Today: Claude Grep,
// Glob, LS. Stage 7+ adds Cursor `codebase_search`, Gemini
// `search_file_content`, etc.
//
// Web search is its own kind ("web_search") and goes through
// FetchCard — search results from the open internet are URLs
// with titles + snippets, a different shape than file matches.
//
// Layout:
//   ┌────────────────────────────────────────────────────┐
//   │ [▶ search]  pattern: "useStickyBottom"  · 3 matches │  ← header
//   ├────────────────────────────────────────────────────┤
//   │ src/zeros/agent/use-sticky-bottom.ts                │  ← body
//   │   42  export function useStickyBottom(scrollEl…    │
//   │ src/zeros/agent/agent-chat.tsx                     │
//   │  238  const sticky = useStickyBottom(scrollEl, …)  │
//   └────────────────────────────────────────────────────┘
//
// Default-collapsed (cards are quiet by default in long runs).
// ──────────────────────────────────────────────────────────

import { memo, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import type { Renderer } from "./types";
import type { AgentToolMessage } from "../use-agent-session";

interface ParsedHit {
  path: string;
  line?: number;
  text?: string;
}

interface ParsedResult {
  hits: ParsedHit[];
  /** Hits the parser couldn't structure — rendered verbatim under
   *  the structured list so the user always sees the raw output. */
  trailing?: string;
}

export const SearchCard: Renderer<AgentToolMessage> = memo(function SearchCard({
  message,
}) {
  const tool = message;
  const queryInfo = useMemo(() => readQuery(tool.rawInput, tool.title), [
    tool.rawInput,
    tool.title,
  ]);
  const text = useMemo(() => readResultText(tool), [tool]);
  const parsed = useMemo(() => parseSearchOutput(text), [text]);
  const matchCount = parsed.hits.length;
  const durationMs = tool.updatedAt - tool.createdAt;

  const [expanded, setExpanded] = useState(() =>
    tool.status === "failed" || tool.status === "in_progress",
  );

  return (
    <div className="oc-agent-tool oc-agent-tool-search">
      <button
        type="button"
        className="oc-agent-tool-head oc-agent-search-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="oc-agent-tool-icon w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="oc-agent-tool-icon w-3.5 h-3.5" />
        )}
        <Search className="oc-agent-tool-icon w-3.5 h-3.5" />
        <div className="oc-agent-tool-body">
          <div className="oc-agent-search-query">
            <span className="oc-agent-search-tool">{queryInfo.tool}</span>
            <span className="oc-agent-search-pattern" title={queryInfo.pattern}>
              {queryInfo.pattern}
            </span>
            {queryInfo.scope && (
              <span className="oc-agent-search-scope">in {queryInfo.scope}</span>
            )}
          </div>
        </div>
        <div className="oc-agent-search-meta">
          <span className="oc-agent-search-count">
            {tool.status === "in_progress"
              ? "searching…"
              : matchCount === 0
              ? "0 matches"
              : `${matchCount} ${matchCount === 1 ? "match" : "matches"}`}
          </span>
          {durationMs > 250 && tool.status !== "in_progress" && (
            <span className="oc-agent-search-duration">
              {formatDuration(durationMs)}
            </span>
          )}
          <SearchStatusBadge status={tool.status} />
        </div>
      </button>
      {expanded && (
        <div className="oc-agent-search-content">
          {tool.status === "in_progress" && !text ? (
            <div className="oc-agent-search-empty">Running…</div>
          ) : matchCount === 0 ? (
            <div className="oc-agent-search-empty">
              {parsed.trailing
                ? parsed.trailing
                : tool.status === "failed"
                ? "Search failed."
                : "No matches."}
            </div>
          ) : (
            <SearchResultList parsed={parsed} pattern={queryInfo.pattern} />
          )}
        </div>
      )}
    </div>
  );
});

function SearchStatusBadge({ status }: { status: AgentToolMessage["status"] }) {
  const cls =
    status === "completed"
      ? "oc-agent-search-status oc-agent-search-status-ok"
      : status === "failed"
      ? "oc-agent-search-status oc-agent-search-status-fail"
      : "oc-agent-search-status oc-agent-search-status-run";
  const label =
    status === "completed"
      ? "done"
      : status === "failed"
      ? "failed"
      : status === "in_progress"
      ? "searching"
      : "queued";
  return <span className={cls}>{label}</span>;
}

function SearchResultList({
  parsed,
  pattern,
}: {
  parsed: ParsedResult;
  pattern: string;
}) {
  const groups = useMemo(() => groupByPath(parsed.hits), [parsed.hits]);
  return (
    <div className="oc-agent-search-list">
      {groups.map((g) => (
        <div key={g.path} className="oc-agent-search-group">
          <div className="oc-agent-search-path" title={g.path}>
            {g.path}
          </div>
          {g.hits.length > 0 && g.hits[0].line != null && (
            <div className="oc-agent-search-hits">
              {g.hits.map((h, i) => (
                <div key={i} className="oc-agent-search-hit">
                  <span className="oc-agent-search-line">{h.line}</span>
                  <span className="oc-agent-search-text">
                    {h.text ? <Highlighted text={h.text} pattern={pattern} /> : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {parsed.trailing && (
        <pre className="oc-agent-search-trailing">{parsed.trailing}</pre>
      )}
    </div>
  );
}

function Highlighted({ text, pattern }: { text: string; pattern: string }) {
  if (!pattern) return <>{text}</>;
  // Build a literal regex from the pattern — for non-regex tools (Glob,
  // LS) the pattern won't match anything sensible, but we never crash.
  const safe = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let re: RegExp | null = null;
  try {
    re = new RegExp(safe, "gi");
  } catch {
    return <>{text}</>;
  }
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) != null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <mark key={key++} className="oc-agent-search-match">
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++; // guard zero-length matches
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ──────────────────────────────────────────────────────────
// Parsing — tolerant to multiple Claude/Cursor output shapes
// ──────────────────────────────────────────────────────────
//
// Claude's Grep with `output_mode: "content"` emits:
//   <path>:<line>:<matched-line>
//   <path>:<line>:<matched-line>
//
// Claude's Grep with `output_mode: "files_with_matches"` (default):
//   <path>
//   <path>
//
// Claude's Glob:
//   <path>
//   <path>
//
// Claude's LS: indented tree-ish output. We treat that as trailing
// raw text — too noisy to structure usefully in a card.
//
// Other agents will land in this parser too — keep it permissive
// rather than build five parsers.

function parseSearchOutput(text: string): ParsedResult {
  if (!text) return { hits: [] };
  const lines = text.split("\n");
  const hits: ParsedHit[] = [];
  const unparsed: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;

    // Skip Grep's "Found N matches" header lines — we render the count
    // ourselves from the parsed array length.
    if (/^Found \d+ (matches?|files?)/i.test(line)) continue;
    if (/^No (files|matches) found/i.test(line)) continue;

    // path:line:matched-line  (Grep content mode)
    const contentMatch = line.match(/^([^:]+):(\d+):(.*)$/);
    if (contentMatch) {
      hits.push({
        path: contentMatch[1],
        line: Number(contentMatch[2]),
        text: contentMatch[3],
      });
      continue;
    }

    // path  (Grep files-with-matches / Glob)
    if (/^[\/.]/.test(line) || /\.[a-z0-9]+$/i.test(line)) {
      hits.push({ path: line });
      continue;
    }

    unparsed.push(raw);
  }

  return {
    hits,
    trailing: unparsed.length > 0 ? unparsed.join("\n").trim() || undefined : undefined,
  };
}

interface PathGroup {
  path: string;
  hits: ParsedHit[];
}

function groupByPath(hits: ParsedHit[]): PathGroup[] {
  const map = new Map<string, ParsedHit[]>();
  for (const h of hits) {
    const arr = map.get(h.path) ?? [];
    arr.push(h);
    map.set(h.path, arr);
  }
  return Array.from(map.entries()).map(([path, list]) => ({ path, hits: list }));
}

interface QueryInfo {
  tool: string;
  pattern: string;
  scope?: string;
}

function readQuery(input: unknown, title: string): QueryInfo {
  if (!isObj(input)) {
    return { tool: "Search", pattern: title };
  }
  const pattern =
    typeof input.pattern === "string"
      ? input.pattern
      : typeof input.query === "string"
      ? input.query
      : "";
  const scope =
    typeof input.path === "string"
      ? input.path
      : typeof input.scope === "string"
      ? input.scope
      : undefined;
  // Heuristic: a `pattern` paired with a `path` smells like Grep;
  // pattern alone smells like Glob. Title gives us the tool name
  // when we want to display it.
  let tool = "Search";
  if (/grep/i.test(title)) tool = "Grep";
  else if (/glob|search/i.test(title) || /^Searching for/i.test(title)) tool = "Glob";
  else if (/^Listing|^LS/i.test(title)) tool = "LS";
  return { tool, pattern: pattern || title, scope };
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
