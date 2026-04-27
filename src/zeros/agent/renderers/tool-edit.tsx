// ──────────────────────────────────────────────────────────
// EditCard — file edit / write tool calls
// ──────────────────────────────────────────────────────────
//
// Renders any tool with kind="edit". Today: Claude `Edit` and
// `Write`. Stage 7+ adds Codex `apply_patch`, Cursor edit, etc.
//
// Layout:
//   ┌────────────────────────────────────────────────────┐
//   │ [▶ pencil]  src/foo/bar.ts        +12 −3   [✓] 18ms │  ← header
//   ├────────────────────────────────────────────────────┤
//   │ unified diff, syntax highlighted                   │  ← body
//   │ side-by-side ≥800px panel; stacked otherwise       │
//   └────────────────────────────────────────────────────┘
//
// Two render modes (driven by adapter, not by agent):
//   - **Patch mode** (Codex apply_patch, Droid ApplyPatch):
//     adapter feeds the unified diff directly via tool.content
//     (`{ type: "diff", path, oldText, newText }`).
//   - **Replacement mode** (Claude Edit/Write, Cursor editTool,
//     Gemini replace/write_file, Droid Edit): adapter feeds raw
//     before+after via rawInput; renderer computes a diff.
//
// Default-collapsed (matches Stage 3 §2.4 "highest-volume cards
// ship first, default-collapsed"); +N/-M counts always visible
// in the header so the user can scan a turn at a glance.
// ──────────────────────────────────────────────────────────

import { memo, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileEdit } from "lucide-react";
import { diffLines, structuredPatch } from "diff";

import type { Renderer } from "./types";
import type { AgentToolMessage } from "../use-agent-session";
import { highlightCode, getLang } from "./syntax";
import { DurationChip } from "./live-duration";

interface DiffSource {
  /** File path the diff applies to. */
  path: string;
  /** Pre-edit content (empty string for Write/new-file cases). */
  before: string;
  /** Post-edit content. */
  after: string;
  /** True when patch mode (i.e. adapter pre-built the diff text); we
   *  preserve `after` as the rendered side and skip recomputing the
   *  unified hunks. Today nothing flips this on; reserved for Codex. */
  patchPrebuilt?: boolean;
}

export const EditCard: Renderer<AgentToolMessage> = memo(function EditCard({
  message,
  ctx,
}) {
  const tool = message;
  const source = useMemo(() => extractDiffSource(tool), [tool]);
  const counts = useMemo(() => countLineDelta(source), [source]);
  const durationMs = tool.updatedAt - tool.createdAt;
  const [expanded, setExpanded] = useState(() => tool.status === "failed");
  // Stage 4.2 — predecessors with the same mergeKey collapse into this
  // primary card; user can expand "+N more changes" to see history.
  const predecessors = ctx.mergeSiblings.get(tool.toolCallId) ?? [];
  const [historyOpen, setHistoryOpen] = useState(false);

  const path = source?.path ?? readPath(tool.rawInput) ?? tool.title;
  const isNewFile = source?.before === "";

  return (
    <div className="oc-agent-tool oc-agent-tool-edit">
      <button
        type="button"
        className="oc-agent-tool-head oc-agent-edit-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="oc-agent-tool-icon w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="oc-agent-tool-icon w-3.5 h-3.5" />
        )}
        <FileEdit className="oc-agent-tool-icon w-3.5 h-3.5" />
        <div className="oc-agent-tool-body">
          <div className="oc-agent-edit-path" title={path}>
            {path}
            {isNewFile && predecessors.length === 0 && (
              <span className="oc-agent-edit-newfile">new file</span>
            )}
          </div>
        </div>
        <div className="oc-agent-edit-meta">
          {counts && (
            <span className="oc-agent-edit-counts">
              <span className="oc-agent-edit-add">+{counts.added}</span>
              <span className="oc-agent-edit-rem">−{counts.removed}</span>
            </span>
          )}
          <DurationChip
            status={tool.status}
            startedAt={tool.createdAt}
            durationMs={durationMs}
            className="oc-agent-edit-duration"
          />
          <EditStatusBadge status={tool.status} />
        </div>
      </button>
      {expanded && (
        <div className="oc-agent-edit-content">
          {source ? (
            <DiffView source={source} />
          ) : (
            <div className="oc-agent-edit-empty">
              No diff available — adapter did not provide before/after content.
            </div>
          )}
        </div>
      )}
      {predecessors.length > 0 && (
        <EditHistory
          predecessors={predecessors}
          open={historyOpen}
          onToggle={() => setHistoryOpen((v) => !v)}
        />
      )}
    </div>
  );
});

// ──────────────────────────────────────────────────────────
// Merged-edit history: "+N more changes" chevron + per-edit list.
// Each predecessor renders as a single line: timestamp + +N/-M counts.
// Click on an item later to expand its individual diff (deferred —
// for now we keep this list compact; full per-edit diffs would
// rebuild the cumulative card stack we just collapsed).
// ──────────────────────────────────────────────────────────

function EditHistory({
  predecessors,
  open,
  onToggle,
}: {
  predecessors: AgentToolMessage[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="oc-agent-edit-history">
      <button
        type="button"
        className="oc-agent-edit-history-head"
        onClick={onToggle}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span>
          +{predecessors.length} more change{predecessors.length === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <ul className="oc-agent-edit-history-list">
          {predecessors.map((p) => {
            const src = extractDiffSource(p);
            const cnt = countLineDelta(src);
            const ago = relativeTime(p.createdAt);
            return (
              <li key={p.id} className="oc-agent-edit-history-item">
                <span className="oc-agent-edit-history-time">{ago}</span>
                {cnt && (
                  <span className="oc-agent-edit-counts">
                    <span className="oc-agent-edit-add">+{cnt.added}</span>
                    <span className="oc-agent-edit-rem">−{cnt.removed}</span>
                  </span>
                )}
                <EditStatusBadge status={p.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function EditStatusBadge({ status }: { status: AgentToolMessage["status"] }) {
  const cls =
    status === "completed"
      ? "oc-agent-edit-status oc-agent-edit-status-ok"
      : status === "failed"
      ? "oc-agent-edit-status oc-agent-edit-status-fail"
      : "oc-agent-edit-status oc-agent-edit-status-run";
  const label =
    status === "completed"
      ? "applied"
      : status === "failed"
      ? "failed"
      : status === "in_progress"
      ? "applying"
      : "queued";
  return <span className={cls}>{label}</span>;
}

// ──────────────────────────────────────────────────────────
// DiffView — syntax-highlighted unified diff
// ──────────────────────────────────────────────────────────
//
// Container query @ 800px swaps stacked → side-by-side. We tag the
// outermost div with `oc-agent-edit-diffroot` and the CSS does the
// rest — no JS resize observer needed.
//
// Per-line highlighting: shiki-highlight the ENTIRE before/after
// blobs once each, then split on `\n` and overlay +/-/context
// classes. Highlighting per line individually loses cross-line
// state (string spanning multiple lines, JSDoc continuation) so
// this whole-blob approach is required for correct colors.

function DiffView({ source }: { source: DiffSource }) {
  const lang = useMemo(() => getLang(source.path), [source.path]);
  const [beforeHTML, setBeforeHTML] = useState<string | null>(null);
  const [afterHTML, setAfterHTML] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [b, a] = await Promise.all([
        highlightCode(source.before, lang),
        highlightCode(source.after, lang),
      ]);
      if (cancelled) return;
      setBeforeHTML(b);
      setAfterHTML(a);
    })();
    return () => {
      cancelled = true;
    };
  }, [source.before, source.after, lang]);

  const hunks = useMemo(() => {
    if (source.patchPrebuilt) return [];
    return buildUnifiedHunks(source.before, source.after);
  }, [source.before, source.after, source.patchPrebuilt]);

  const beforeLineHTML = useMemo(
    () => splitHighlightedLines(beforeHTML),
    [beforeHTML],
  );
  const afterLineHTML = useMemo(
    () => splitHighlightedLines(afterHTML),
    [afterHTML],
  );

  if (hunks.length === 0) {
    return (
      <div className="oc-agent-edit-diffroot oc-agent-edit-diffroot-empty">
        no changes
      </div>
    );
  }

  return (
    <div className="oc-agent-edit-diffroot">
      {hunks.map((hunk, i) => (
        <Hunk
          key={i}
          hunk={hunk}
          beforeLineHTML={beforeLineHTML}
          afterLineHTML={afterLineHTML}
        />
      ))}
    </div>
  );
}

function Hunk({
  hunk,
  beforeLineHTML,
  afterLineHTML,
}: {
  hunk: UnifiedHunk;
  beforeLineHTML: string[] | null;
  afterLineHTML: string[] | null;
}) {
  return (
    <div className="oc-agent-edit-hunk">
      <div className="oc-agent-edit-hunk-head">
        @@ −{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      </div>
      <div className="oc-agent-edit-hunk-body">
        {hunk.lines.map((line, i) => (
          <DiffLine
            key={i}
            line={line}
            beforeLineHTML={beforeLineHTML}
            afterLineHTML={afterLineHTML}
          />
        ))}
      </div>
    </div>
  );
}

function DiffLine({
  line,
  beforeLineHTML,
  afterLineHTML,
}: {
  line: UnifiedLine;
  beforeLineHTML: string[] | null;
  afterLineHTML: string[] | null;
}) {
  const sideClass =
    line.kind === "add"
      ? "oc-agent-edit-line-add"
      : line.kind === "remove"
      ? "oc-agent-edit-line-rem"
      : "oc-agent-edit-line-ctx";
  const sign = line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " ";
  const lineNumOld = line.kind === "add" ? "" : String(line.oldLine ?? "");
  const lineNumNew = line.kind === "remove" ? "" : String(line.newLine ?? "");

  // Pull the highlighted HTML for the line if available; fall back to
  // the raw text. shiki wraps each line in a <span class="line">…</span>
  // so we splice that into the row's text cell.
  let html: string | null = null;
  if (line.kind === "add" && line.newLine != null && afterLineHTML) {
    html = afterLineHTML[line.newLine - 1] ?? null;
  } else if (line.kind === "remove" && line.oldLine != null && beforeLineHTML) {
    html = beforeLineHTML[line.oldLine - 1] ?? null;
  } else if (line.kind === "context" && line.newLine != null && afterLineHTML) {
    html = afterLineHTML[line.newLine - 1] ?? null;
  }

  return (
    <div className={`oc-agent-edit-line ${sideClass}`}>
      <span className="oc-agent-edit-gutter">{lineNumOld}</span>
      <span className="oc-agent-edit-gutter">{lineNumNew}</span>
      <span className="oc-agent-edit-sign">{sign}</span>
      {html ? (
        <span
          className="oc-agent-edit-text"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <span className="oc-agent-edit-text">{line.text || " "}</span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Diff machinery
// ──────────────────────────────────────────────────────────

interface UnifiedHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: UnifiedLine[];
}

interface UnifiedLine {
  kind: "add" | "remove" | "context";
  text: string;
  oldLine?: number;
  newLine?: number;
}

function buildUnifiedHunks(before: string, after: string): UnifiedHunk[] {
  // structuredPatch context defaults to 4 — that's a reasonable
  // chunk for an inline diff. Using newlineIsToken=false so we get
  // line-grain hunks (cheaper than character-grain for inline edit
  // cards which are usually small replacements).
  const patch = structuredPatch("a", "b", before, after, "", "", { context: 3 });
  return patch.hunks.map((h) => {
    const lines: UnifiedLine[] = [];
    let oldLine = h.oldStart;
    let newLine = h.newStart;
    for (const raw of h.lines) {
      // diff package uses " ", "+", "-", "\\ No newline at end of file"
      if (raw.startsWith("\\")) continue; // skip the no-newline marker
      const sigil = raw[0];
      const text = raw.slice(1);
      if (sigil === "+") {
        lines.push({ kind: "add", text, newLine });
        newLine++;
      } else if (sigil === "-") {
        lines.push({ kind: "remove", text, oldLine });
        oldLine++;
      } else {
        lines.push({ kind: "context", text, oldLine, newLine });
        oldLine++;
        newLine++;
      }
    }
    return {
      oldStart: h.oldStart,
      oldLines: h.oldLines,
      newStart: h.newStart,
      newLines: h.newLines,
      lines,
    };
  });
}

/** Count `+`/`-` lines for the header chip. Cheap line-grain count;
 *  uses `diffLines` directly because we only need totals, not hunks. */
function countLineDelta(source: DiffSource | null): {
  added: number;
  removed: number;
} | null {
  if (!source) return null;
  let added = 0;
  let removed = 0;
  const parts = diffLines(source.before, source.after);
  for (const p of parts) {
    if (p.added) added += p.count ?? p.value.split("\n").length - 1;
    else if (p.removed) removed += p.count ?? p.value.split("\n").length - 1;
  }
  return { added, removed };
}

/** Pull a highlighted shiki HTML blob apart into per-line spans.
 *  Shiki wraps each rendered line in `<span class="line">…</span>`;
 *  we yank those out so DiffLine can splice the right one into the
 *  row by line number. */
function splitHighlightedLines(html: string | null): string[] | null {
  if (!html) return null;
  // Match the inside of every `<span class="line">…</span>`. Shiki's
  // output shape: `<pre class="shiki"><code><span class="line">…</span>\n…</code></pre>`.
  const matches = html.match(/<span class="line">[\s\S]*?<\/span>(?=\n|<\/code>)/g);
  if (!matches) return null;
  return matches.map((m) =>
    m.replace(/^<span class="line">/, "").replace(/<\/span>$/, ""),
  );
}

// ──────────────────────────────────────────────────────────
// Source extraction
// ──────────────────────────────────────────────────────────
//
// Adapters can deliver before/after in three shapes:
//
// 1. Replacement mode (Claude Edit, Cursor edit):
//    rawInput.{old_string, new_string} (Edit) or
//    rawInput.{content} for Write (no old_string → new file).
//    The full-file delta isn't sent; we diff old_string ⇄ new_string
//    directly.
//
// 2. Patch mode (Codex apply_patch, Droid ApplyPatch):
//    tool.content[i] = { type: "diff", path, oldText, newText }
//    — Stage 7 will fill this branch in. For now this branch is
//    here for forward-compatibility.
//
// 3. Tool-result diff (some adapters mirror the diff into the
//    output text). We don't try to parse those.

function extractDiffSource(tool: AgentToolMessage): DiffSource | null {
  // Path 2 — adapter pre-built diff payload.
  if (tool.content) {
    for (const block of tool.content) {
      if (block.type === "diff") {
        return {
          path: block.path,
          before: block.oldText ?? "",
          after: block.newText,
          patchPrebuilt: true,
        };
      }
    }
  }

  // Path 1 — replacement mode from rawInput.
  const inp = tool.rawInput;
  if (!isObj(inp)) return null;
  const path = readPath(inp);
  if (!path) return null;

  const oldStr = typeof inp.old_string === "string" ? inp.old_string : null;
  const newStr = typeof inp.new_string === "string" ? inp.new_string : null;
  const fullContent = typeof inp.content === "string" ? inp.content : null;

  if (oldStr !== null && newStr !== null) {
    return { path, before: oldStr, after: newStr };
  }
  if (fullContent !== null) {
    // Write tool — the adapter doesn't have the prior file content,
    // so before is empty and the diff renders as one big +block.
    return { path, before: "", after: fullContent };
  }
  return null;
}

function readPath(input: unknown): string | null {
  if (!isObj(input)) return null;
  const p = input.file_path ?? input.path ?? input.filePath;
  return typeof p === "string" ? p : null;
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
