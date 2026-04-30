// ──────────────────────────────────────────────────────────
// SubagentCard — parent agent delegating to a child
// ──────────────────────────────────────────────────────────
//
// Renders any tool with kind="subagent". Today: Claude Task.
// Droid Task and OpenCode task wire to the same kind in their
// respective stages.
//
// Roadmap §2.4.7 — nested transcript: Claude stamps every event
// from inside a Task subagent with parent_tool_use_id pointing at
// the Task's tool_use_id. The translator forwards this as
// parentToolId on canonical events; agent-chat groups them under
// the parent's toolCallId in `ctx.subagentChildren`. We pull our
// bucket out and recursively render each child via MessageView,
// indented with a left-border accent so the user can see the
// nested execution as one unit.
// ──────────────────────────────────────────────────────────

import { memo, useState } from "react";
import { ChevronDown, ChevronRight, GitBranch } from "lucide-react";

import type { Renderer } from "./types";
import type { AgentToolMessage } from "../use-agent-session";
import { matchSubagent } from "./subagent";
import { DurationChip } from "./live-duration";
import { MessageView } from "./message-view";

export const SubagentCard: Renderer<AgentToolMessage> = memo(
  function SubagentCard({ message, ctx }) {
    const tool = message;
    const info = matchSubagent(tool) ?? {
      subagentType: undefined,
      description: undefined,
    };
    const subagentType = info.subagentType ?? "subagent";
    const description = info.description ?? readPrompt(tool.rawInput);
    const result = readResultText(tool);
    const durationMs = tool.updatedAt - tool.createdAt;
    const children = ctx.subagentChildren.get(tool.toolCallId) ?? [];
    // Default-collapsed when finished (the user can re-open to inspect),
    // default-expanded while running so the user sees progress live.
    const [expanded, setExpanded] = useState(
      () => tool.status === "failed" || tool.status === "in_progress",
    );

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
            <DurationChip
              status={tool.status}
              startedAt={tool.createdAt}
              durationMs={durationMs}
              className="oc-agent-subagent-duration"
            />
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
            {children.length > 0 && (
              <div className="oc-agent-subagent-section">
                <div className="oc-agent-subagent-section-label">
                  Nested events ({children.length})
                </div>
                <div className="oc-agent-subagent-nested">
                  {children.map((child) => (
                    <MessageView key={child.id} message={child} ctx={ctx} />
                  ))}
                </div>
              </div>
            )}
            {result && (
              <div className="oc-agent-subagent-section">
                <div className="oc-agent-subagent-section-label">Result</div>
                <pre className="oc-agent-subagent-result">{result}</pre>
              </div>
            )}
            {!description && !result && children.length === 0 && (
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

