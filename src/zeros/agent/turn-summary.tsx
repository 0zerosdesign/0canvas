// ──────────────────────────────────────────────────────────
// TurnSummary — one-line roll-up for finalized turns
// ──────────────────────────────────────────────────────────
//
// Stage 5.3. When a turn finalizes (a new user prompt arrives
// or the session ends), the per-turn container collapses to a
// one-line roll-up:
//
//   📝 4 edits · 💻 3 commands · 🔍 1 search · 4m 12s    [▾ expand]
//
// Click the chevron to expand back to the full event stream.
// Active (in-flight) turns never collapse — the summary only
// shows on terminated turns.
//
// summarizeTurn() is a pure derivation from a turn's events.
// It scans for tool kinds and counts them; the renderer picks
// the top non-zero counters so the summary stays compact even
// on busy turns. Line-delta totals are deferred to Stage 5.4
// (would require walking mergeKey predecessors and re-running
// the diff for accurate cumulative numbers).
// ──────────────────────────────────────────────────────────

import { memo } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileEdit,
  FileText,
  GitBranch,
  Globe,
  Plug,
  Search as SearchIcon,
  Terminal,
} from "lucide-react";

import type { AgentMessage, AgentToolMessage } from "./use-agent-session";

export interface TurnSummaryStats {
  /** Number of unique files touched by edit-kind tools. mergeKey
   *  collapse means each file shows up once. */
  edits: number;
  /** Count of execute-kind tools (bash, shell, etc.). */
  shells: number;
  /** Count of read-kind tools. Usually high; we keep it but the
   *  renderer only surfaces it on otherwise-empty summaries. */
  reads: number;
  /** Count of code searches (Grep / Glob / LS). */
  searches: number;
  /** Count of web fetches and web searches combined — both bring
   *  in external content, the user usually thinks of them together. */
  webOps: number;
  /** Count of MCP tool calls. */
  mcpOps: number;
  /** Count of subagent (Task) invocations. */
  subagents: number;
  /** Total wall time covered by the turn's events in ms. From the
   *  first event's createdAt to the last event's updatedAt. */
  durationMs: number;
  /** Count of agent text bubbles. Used to detect "all I got was
   *  text" turns where we still want a row but no tool stats. */
  textBubbles: number;
}

export function summarizeTurn(events: AgentMessage[]): TurnSummaryStats {
  let edits = 0;
  let shells = 0;
  let reads = 0;
  let searches = 0;
  let webOps = 0;
  let mcpOps = 0;
  let subagents = 0;
  let textBubbles = 0;
  let firstAt = Number.POSITIVE_INFINITY;
  let lastAt = 0;

  for (const m of events) {
    if (m.createdAt < firstAt) firstAt = m.createdAt;
    if (m.kind === "tool") {
      const tool = m as AgentToolMessage;
      if (tool.updatedAt > lastAt) lastAt = tool.updatedAt;
      switch (tool.toolKind) {
        case "edit":
          edits++;
          break;
        case "execute":
          shells++;
          break;
        case "read":
          reads++;
          break;
        case "search":
          searches++;
          break;
        case "fetch":
        case "web_search":
          webOps++;
          break;
        case "mcp":
          mcpOps++;
          break;
        case "subagent":
          subagents++;
          break;
        default:
          break;
      }
    } else if (m.kind === "text" && m.role === "agent") {
      textBubbles++;
      if (m.createdAt > lastAt) lastAt = m.createdAt;
    }
  }

  const durationMs = firstAt === Number.POSITIVE_INFINITY ? 0 : lastAt - firstAt;
  return {
    edits,
    shells,
    reads,
    searches,
    webOps,
    mcpOps,
    subagents,
    durationMs: Math.max(0, durationMs),
    textBubbles,
  };
}

interface TurnSummaryProps {
  stats: TurnSummaryStats;
  expanded: boolean;
  onToggle: () => void;
  /** Number of events being summarised. Surfaces in the chevron
   *  label as "expand · 47 events" so the user knows how much is
   *  hidden. */
  eventCount: number;
}

export const TurnSummary = memo(function TurnSummary({
  stats,
  expanded,
  onToggle,
  eventCount,
}: TurnSummaryProps) {
  const chips = buildChips(stats);
  const Chev = expanded ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      className="oc-agent-turn-summary"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      <Chev className="oc-agent-turn-summary-chev w-3.5 h-3.5" />
      <div className="oc-agent-turn-summary-chips">
        {chips.length === 0 ? (
          <span className="oc-agent-turn-summary-empty">
            {stats.textBubbles > 0 ? "Reply only" : "(empty turn)"}
          </span>
        ) : (
          chips.map((c, i) => (
            <span key={i} className="oc-agent-turn-summary-chip">
              <c.Icon className="w-3 h-3" />
              <span>{c.label}</span>
            </span>
          ))
        )}
      </div>
      {stats.durationMs > 0 && (
        <span className="oc-agent-turn-summary-time">
          {formatDuration(stats.durationMs)}
        </span>
      )}
      <span className="oc-agent-turn-summary-count">
        {expanded ? "hide" : `${eventCount} events`}
      </span>
    </button>
  );
});

interface ChipDescriptor {
  Icon: typeof Terminal;
  label: string;
}

function buildChips(stats: TurnSummaryStats): ChipDescriptor[] {
  const out: ChipDescriptor[] = [];
  if (stats.edits > 0) {
    out.push({
      Icon: FileEdit,
      label: `${stats.edits} ${stats.edits === 1 ? "edit" : "edits"}`,
    });
  }
  if (stats.shells > 0) {
    out.push({
      Icon: Terminal,
      label: `${stats.shells} ${stats.shells === 1 ? "command" : "commands"}`,
    });
  }
  if (stats.searches > 0) {
    out.push({
      Icon: SearchIcon,
      label: `${stats.searches} ${stats.searches === 1 ? "search" : "searches"}`,
    });
  }
  if (stats.webOps > 0) {
    out.push({
      Icon: Globe,
      label: `${stats.webOps} ${stats.webOps === 1 ? "web call" : "web calls"}`,
    });
  }
  if (stats.subagents > 0) {
    out.push({
      Icon: GitBranch,
      label: `${stats.subagents} ${stats.subagents === 1 ? "subagent" : "subagents"}`,
    });
  }
  if (stats.mcpOps > 0) {
    out.push({
      Icon: Plug,
      label: `${stats.mcpOps} MCP`,
    });
  }
  // Reads only surface on quiet turns (no other tool activity). On a
  // busy turn 50 reads is just noise; on a "look at three files and
  // explain" turn the read count IS the summary.
  if (out.length === 0 && stats.reads > 0) {
    out.push({
      Icon: FileText,
      label: `${stats.reads} ${stats.reads === 1 ? "read" : "reads"}`,
    });
  }
  return out;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}
