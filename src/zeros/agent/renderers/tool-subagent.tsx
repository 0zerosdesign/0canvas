// ──────────────────────────────────────────────────────────
// SubagentCard — parent agent delegating to a child
// ──────────────────────────────────────────────────────────
//
// Renders any tool with kind="subagent". Today: Claude Task.
// Stage 8 wires Amp Task to the same kind.
//
// Roadmap §2.4.7 calls for an indented nested transcript driven
// by parent_tool_id — that requires the canonical event taxonomy
// to carry a parent_tool_id field, which we don't surface from
// any adapter yet. For Stage 4.3 we ship the header + collapsible
// prompt + final-result body. The nested-transcript view stays a
// Stage 5 follow-up; this card is shaped to swap that view in
// without breaking callers.
// ──────────────────────────────────────────────────────────

import { memo, useState } from "react";
import { ChevronDown, ChevronRight, GitBranch } from "lucide-react";

import type { Renderer } from "./types";
import type { AgentToolMessage } from "../use-agent-session";
import { matchSubagent } from "./subagent";

export const SubagentCard: Renderer<AgentToolMessage> = memo(
  function SubagentCard({ message }) {
    const tool = message;
    const info = matchSubagent(tool) ?? {
      subagentType: undefined,
      description: undefined,
    };
    const subagentType = info.subagentType ?? "subagent";
    const description = info.description ?? readPrompt(tool.rawInput);
    const result = readResultText(tool);
    const durationMs = tool.updatedAt - tool.createdAt;
    const [expanded, setExpanded] = useState(() => tool.status === "failed");

    return (
      <div className="oc-agent-tool oc-agent-tool-subagent2">
        <button
          type="button"
          className="oc-agent-tool-head oc-agent-subagent-head"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="oc-agent-tool-icon w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="oc-agent-tool-icon w-3.5 h-3.5" />
          )}
          <GitBranch className="oc-agent-tool-icon w-3.5 h-3.5" />
          <div className="oc-agent-tool-body">
            <div className="oc-agent-subagent-title">
              <span className="oc-agent-subagent-tag">subagent</span>
              <span className="oc-agent-subagent-type">{subagentType}</span>
            </div>
            {description && !expanded && (
              <div className="oc-agent-subagent-desc">{description}</div>
            )}
          </div>
          <div className="oc-agent-subagent-meta">
            {durationMs > 250 && tool.status !== "in_progress" && (
              <span className="oc-agent-subagent-duration">
                {formatDuration(durationMs)}
              </span>
            )}
            <SubagentStatusBadge status={tool.status} />
          </div>
        </button>
        {expanded && (
          <div className="oc-agent-subagent-content">
            {description && (
              <div className="oc-agent-subagent-section">
                <div className="oc-agent-subagent-section-label">Task</div>
                <div className="oc-agent-subagent-task">{description}</div>
              </div>
            )}
            {result && (
              <div className="oc-agent-subagent-section">
                <div className="oc-agent-subagent-section-label">Result</div>
                <pre className="oc-agent-subagent-result">{result}</pre>
              </div>
            )}
            {!description && !result && (
              <div className="oc-agent-subagent-empty">
                {tool.status === "in_progress"
                  ? "Subagent running…"
                  : "(no payload)"}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

function SubagentStatusBadge({ status }: { status: AgentToolMessage["status"] }) {
  const cls =
    status === "completed"
      ? "oc-agent-subagent-status oc-agent-subagent-status-ok"
      : status === "failed"
      ? "oc-agent-subagent-status oc-agent-subagent-status-fail"
      : "oc-agent-subagent-status oc-agent-subagent-status-run";
  const label =
    status === "completed"
      ? "done"
      : status === "failed"
      ? "failed"
      : status === "in_progress"
      ? "running"
      : "queued";
  return <span className={cls}>{label}</span>;
}

function readPrompt(input: unknown): string | undefined {
  if (!isObj(input)) return undefined;
  const p = input.prompt ?? input.task ?? input.description;
  if (typeof p === "string") return p;
  return undefined;
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
