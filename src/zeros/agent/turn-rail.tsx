// ──────────────────────────────────────────────────────────
// TurnRail — vertical activity rail in the left gutter
// ──────────────────────────────────────────────────────────
//
// Stage 5.4. A high-density skim affordance: one mark per
// event in the turn, stacked vertically in the left gutter
// of the turn container.
//
// Marks:
//   - tool calls   → filled dot, status-coloured
//                    (pending grey, running blue, success
//                     green, failed red)
//   - thinking     → short horizontal bar (visually distinct
//                    from a tool dot so the eye can spot
//                    "this turn was mostly thinking" at a
//                    glance)
//
// Native `title` tooltip carries the tool name + duration on
// hover. We deliberately skip click-to-scroll for v1 — that
// requires every renderer to expose a stable DOM id, which is
// invasive enough to defer.
//
// Visibility: the rail hides itself when the chat panel is
// narrower than ~360px (a CSS container query in zeros-styles).
// Below that breakpoint the run-summary roll-up (§2.5.5)
// carries the skim affordance instead.
// ──────────────────────────────────────────────────────────

import { memo, useMemo } from "react";

import type { AgentMessage, AgentToolMessage } from "./use-agent-session";
import { formatElapsed } from "./renderers/live-duration";

interface TurnRailProps {
  events: AgentMessage[];
}

interface RailMark {
  key: string;
  kind: "tool" | "thinking";
  status: "pending" | "in_progress" | "completed" | "failed";
  label: string;
}

export const TurnRail = memo(function TurnRail({ events }: TurnRailProps) {
  const marks = useMemo(() => buildMarks(events), [events]);
  if (marks.length === 0) return null;
  return (
    <div className="oc-agent-turn-rail" aria-hidden>
      {marks.map((m) => (
        <span
          key={m.key}
          className={`oc-agent-turn-rail-mark oc-agent-turn-rail-mark-${m.kind} oc-agent-turn-rail-mark-${m.status}`}
          title={m.label}
        />
      ))}
    </div>
  );
});

function buildMarks(events: AgentMessage[]): RailMark[] {
  const marks: RailMark[] = [];
  for (const m of events) {
    if (m.kind === "tool") {
      const tool = m as AgentToolMessage;
      marks.push({
        key: m.id,
        kind: "tool",
        status: tool.status,
        label: railLabelForTool(tool),
      });
    } else if (m.kind === "text" && m.role === "thought") {
      marks.push({
        key: m.id,
        kind: "thinking",
        // Thinking has no per-message status — treat completed as the
        // visual default; the in-flight signal is already carried by
        // the ThinkingBlock shimmer itself.
        status: "completed",
        label: "Thinking",
      });
    }
    // Skip text "agent" replies and other timeline kinds (mode_switch,
    // plan, error_notice). The rail is the activity skim — text is
    // already its own visual block in the main column.
  }
  return marks;
}

function railLabelForTool(tool: AgentToolMessage): string {
  const head = describeTool(tool);
  if (tool.status === "in_progress" || tool.status === "pending") {
    return `${head} · running…`;
  }
  const dur = tool.updatedAt - tool.createdAt;
  if (dur > 250) {
    return `${head} · ${formatElapsed(dur)}${
      tool.status === "failed" ? " · failed" : ""
    }`;
  }
  return tool.status === "failed" ? `${head} · failed` : head;
}

function describeTool(tool: AgentToolMessage): string {
  const input =
    tool.rawInput && typeof tool.rawInput === "object"
      ? (tool.rawInput as Record<string, unknown>)
      : {};
  switch (tool.toolKind) {
    case "execute": {
      const cmd = typeof input.command === "string" ? input.command : null;
      return cmd ? `$ ${truncate(cmd, 64)}` : tool.title;
    }
    case "edit": {
      const path = pickString(input.file_path, input.path);
      return path ? `Edit ${path}` : tool.title;
    }
    case "read": {
      const path = pickString(input.file_path, input.path);
      return path ? `Read ${path}` : tool.title;
    }
    case "search": {
      const pattern = pickString(input.pattern, input.query);
      return pattern ? `Search "${truncate(pattern, 48)}"` : tool.title;
    }
    case "fetch": {
      const url = pickString(input.url, input.URL);
      return url ? `Fetch ${truncate(url, 64)}` : tool.title;
    }
    case "web_search": {
      const q = pickString(input.query, input.q);
      return q ? `Web search "${truncate(q, 48)}"` : tool.title;
    }
    case "subagent": {
      const desc = pickString(input.description, input.subagent_type);
      return desc ? `Subagent · ${truncate(desc, 56)}` : "Subagent";
    }
    case "mcp":
      return tool.title;
    case "question":
      return "Question";
    default:
      return tool.title;
  }
}

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
