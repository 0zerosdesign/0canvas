// ──────────────────────────────────────────────────────────
// ReadCard — file read tool calls
// ──────────────────────────────────────────────────────────
//
// Renders any tool with kind="read". Today: Claude `Read`.
// Stage 7+ adds Cursor `read_file`, Gemini `read_file`, etc.
// (Codex / Droid don't expose a Read tool — `cat foo.ts` from
// those agents falls through to the Shell card.)
//
// Layout:
//   ┌────────────────────────────────────────────────────┐
//   │ [▶ file]  src/foo.ts  L1-200/4520  [✓] 4ms          │  ← header
//   ├────────────────────────────────────────────────────┤
//   │ syntax-highlighted preview                          │  ← body
//   └────────────────────────────────────────────────────┘
//
// Default-collapsed (read calls are the highest-volume tool
// after shell on a debug-heavy run; collapsing keeps the
// transcript compact). Expand shows up to 200 lines; longer
// reads get a "Show full" button.
// ──────────────────────────────────────────────────────────

import { memo, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";

import type { Renderer } from "./types";
import type { AgentToolMessage } from "../use-agent-session";
import { highlightCode, getLang } from "./syntax";
import { DurationChip } from "./live-duration";

const MAX_PREVIEW_LINES = 200;

export const ReadCard: Renderer<AgentToolMessage> = memo(function ReadCard({
  message,
}) {
  const tool = message;
  const path = readPath(tool.rawInput) ?? tool.title;
  const range = useMemo(() => readRange(tool.rawInput), [tool.rawInput]);
  const text = useMemo(() => readText(tool), [tool]);
  const totalLines = useMemo(() => text.split("\n").length, [text]);
  const showFull = useMemo(() => totalLines <= MAX_PREVIEW_LINES, [totalLines]);
  const durationMs = tool.updatedAt - tool.createdAt;

  const [expanded, setExpanded] = useState(() => tool.status === "failed");
  const [overflowExpanded, setOverflowExpanded] = useState(false);

  const lang = useMemo(() => getLang(path), [path]);

  return (
    <div className="oc-agent-tool oc-agent-tool-read">
      <button
        type="button"
        className="oc-agent-tool-head oc-agent-read-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="oc-agent-tool-icon w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="oc-agent-tool-icon w-3.5 h-3.5" />
        )}
        <FileText className="oc-agent-tool-icon w-3.5 h-3.5" />
        <div className="oc-agent-tool-body">
          <div className="oc-agent-read-path" title={path}>
            {path}
          </div>
        </div>
        <div className="oc-agent-read-meta">
          {range && (
            <span className="oc-agent-read-range">
              L{range.start}-{range.end}
              {range.total ? `/${range.total}` : ""}
            </span>
          )}
          {!range && totalLines > 1 && (
            <span className="oc-agent-read-range">{totalLines} lines</span>
          )}
          <DurationChip
            status={tool.status}
            startedAt={tool.createdAt}
            durationMs={durationMs}
            className="oc-agent-read-duration"
          />
          <ReadStatusBadge status={tool.status} />
        </div>
      </button>
      {expanded && (
        <div className="oc-agent-read-content">
          {!text ? (
            <div className="oc-agent-read-empty">
              {tool.status === "in_progress" ? "Reading…" : "(empty)"}
            </div>
          ) : (
            <ReadPreview
              text={text}
              lang={lang}
              full={showFull || overflowExpanded}
              totalLines={totalLines}
              onShowFull={() => setOverflowExpanded(true)}
            />
          )}
        </div>
      )}
    </div>
  );
});

function ReadStatusBadge({ status }: { status: AgentToolMessage["status"] }) {
  const cls =
    status === "completed"
      ? "oc-agent-read-status oc-agent-read-status-ok"
      : status === "failed"
      ? "oc-agent-read-status oc-agent-read-status-fail"
      : "oc-agent-read-status oc-agent-read-status-run";
  const label =
    status === "completed"
      ? "read"
      : status === "failed"
      ? "failed"
      : status === "in_progress"
      ? "reading"
      : "queued";
  return <span className={cls}>{label}</span>;
}

function ReadPreview({
  text,
  lang,
  full,
  totalLines,
  onShowFull,
}: {
  text: string;
  lang: string;
  full: boolean;
  totalLines: number;
  onShowFull: () => void;
}) {
  const visibleText = useMemo(() => {
    if (full) return text;
    return text.split("\n").slice(0, MAX_PREVIEW_LINES).join("\n");
  }, [text, full]);
  const [html, setHTML] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const out = await highlightCode(visibleText, lang);
      if (!cancelled) setHTML(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [visibleText, lang]);

  return (
    <div className="oc-agent-read-preview">
      {html ? (
        <div
          className="oc-agent-read-code"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="oc-agent-read-code-fallback">{visibleText}</pre>
      )}
      {!full && (
        <button
          type="button"
          className="oc-agent-read-more"
          onClick={onShowFull}
        >
          Show all {totalLines.toLocaleString()} lines
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────

function readPath(input: unknown): string | null {
  if (!isObj(input)) return null;
  const p = input.file_path ?? input.path ?? input.filePath;
  return typeof p === "string" ? p : null;
}

interface ReadRange {
  start: number;
  end: number;
  total?: number;
}

function readRange(input: unknown): ReadRange | null {
  if (!isObj(input)) return null;
  const offset =
    typeof input.offset === "number"
      ? input.offset
      : typeof input.start_line === "number"
      ? input.start_line
      : null;
  const limit =
    typeof input.limit === "number"
      ? input.limit
      : typeof input.line_count === "number"
      ? input.line_count
      : null;
  if (offset === null && limit === null) return null;
  const start = offset ?? 1;
  const end = (offset ?? 1) + (limit ?? 0) - 1;
  return { start, end: Math.max(end, start) };
}

/** Strip Claude's `Read` line-number gutter (` 123→content`) so the
 *  text is real source ready for syntax highlighting. The format
 *  is `\s*\d+\t<content>` — Claude formats the gutter as space-
 *  padded digits + tab. Idempotent on text that has no gutter. */
function stripLineNumberGutter(raw: string): string {
  const lines = raw.split("\n");
  let stripped = 0;
  const out = lines.map((l) => {
    const m = l.match(/^\s*\d+\t(.*)$/);
    if (m) {
      stripped++;
      return m[1];
    }
    return l;
  });
  // Only strip if the majority of lines had the gutter — guards
  // against false positives on actual numbered content.
  if (stripped > 0 && stripped / lines.length > 0.6) return out.join("\n");
  return raw;
}

function readText(tool: AgentToolMessage): string {
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
  return stripLineNumberGutter(parts.join(""));
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

