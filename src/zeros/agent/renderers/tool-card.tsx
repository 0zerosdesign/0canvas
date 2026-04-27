// ──────────────────────────────────────────────────────────
// ToolCard — generic tool call rendering
// ──────────────────────────────────────────────────────────
//
// Phase 0 extraction of the ToolCallCard from agent-chat.tsx.
// Same CSS classes, same status icons, same layout — moved
// into the renderers/ folder so per-toolKind variants (bash,
// edit, read, …) can land in Phase 1 as sibling files plus a
// single registry entry, with no churn in the chat shell.
//
// Splits cleanly in three:
//   ToolCard            — the card chrome (icon, title, status)
//   ApplyChangeReceipt  — the persistent diff for `apply_change`
//   ToolContentView     — the streamed content blocks (text/diff)
//
// ──────────────────────────────────────────────────────────

import { memo } from "react";
import {
  CheckCircle2,
  Clock,
  GitBranch,
  Loader2,
  Wrench,
  XCircle,
} from "lucide-react";
import type { AgentToolMessage } from "../use-agent-session";
import type { ApplyReceipt, Renderer } from "./types";
import { matchDesignTool } from "./design-tools";
import { matchSubagent } from "./subagent";

export const ToolCard: Renderer<AgentToolMessage> = memo(function ToolCard({
  message,
  ctx,
}) {
  const tool = message;
  const receipt = ctx.applyReceipts[tool.toolCallId] ?? null;
  const design = matchDesignTool(tool.title);
  const subagent = !design ? matchSubagent(tool) : null;
  const Icon = design?.icon ?? (subagent ? GitBranch : Wrench);
  const label =
    design?.label ??
    (subagent
      ? subagent.subagentType
        ? `Delegated to ${subagent.subagentType}`
        : "Subagent delegation"
      : tool.title);
  const summary =
    design?.summarize?.(tool.rawInput) ?? subagent?.description ?? null;
  // Persistent receipt only for apply_change that has both a captured before
  // snapshot and a completed/failed status — pending cards stay clean.
  const hasReceipt =
    !!receipt &&
    /apply_change/.test(tool.title) &&
    (tool.status === "completed" || tool.status === "failed");
  const sourcePath = tool.locations?.[0]?.path;
  const sourceLine = tool.locations?.[0]?.line;
  const cardClass = design
    ? "oc-agent-tool oc-agent-tool-design"
    : subagent
    ? "oc-agent-tool oc-agent-tool-subagent"
    : "oc-agent-tool";
  const vendorLabel = design ? "Zeros" : subagent ? "Subagent" : null;

  return (
    <div className={cardClass}>
      <div className="oc-agent-tool-head">
        <Icon className="oc-agent-tool-icon w-3.5 h-3.5" />
        <div className="oc-agent-tool-body">
          <div className="oc-agent-tool-title">
            {label}
            {vendorLabel && (
              <span className="oc-agent-tool-vendor">{vendorLabel}</span>
            )}
          </div>
          {!hasReceipt && summary ? (
            <div className="oc-agent-tool-summary">{summary}</div>
          ) : !hasReceipt && tool.toolKind ? (
            <div className="oc-agent-tool-kind">{tool.toolKind}</div>
          ) : null}
        </div>
        <div className="oc-agent-tool-status">
          <ToolStatusIcon status={tool.status} />
        </div>
      </div>
      {hasReceipt && receipt && (
        <ApplyChangeReceipt
          receipt={receipt}
          status={tool.status}
          sourcePath={sourcePath}
          sourceLine={sourceLine}
        />
      )}
      {!hasReceipt && tool.content && tool.content.length > 0 && (
        <div className="oc-agent-tool-content">
          <ToolContentView content={tool.content} />
        </div>
      )}
    </div>
  );
});

function ToolStatusIcon({ status }: { status: AgentToolMessage["status"] }) {
  if (status === "completed") {
    return (
      <CheckCircle2
        className="w-3.5 h-3.5"
        style={{ color: "var(--text-success)" }}
      />
    );
  }
  if (status === "failed") {
    return (
      <XCircle
        className="w-3.5 h-3.5"
        style={{ color: "var(--text-critical)" }}
      />
    );
  }
  if (status === "in_progress") {
    return (
      <Loader2
        className="w-3.5 h-3.5 animate-spin"
        style={{ color: "var(--text-muted)" }}
      />
    );
  }
  return (
    <Clock
      className="w-3.5 h-3.5"
      style={{ color: "var(--text-placeholder)" }}
    />
  );
}

function ApplyChangeReceipt({
  receipt,
  status,
  sourcePath,
  sourceLine,
}: {
  receipt: ApplyReceipt;
  status: AgentToolMessage["status"];
  sourcePath?: string;
  sourceLine?: number | null;
}) {
  const failed = status === "failed";
  return (
    <div className="oc-agent-receipt">
      <div className="oc-agent-receipt-head">
        <span className="oc-agent-receipt-selector">{receipt.selector}</span>
        <span className="oc-agent-receipt-tag">
          {failed ? "not applied" : "updated"}
        </span>
      </div>
      <div className="oc-agent-receipt-diff">
        <div className="oc-agent-receipt-row oc-agent-receipt-row-before">
          <span className="oc-agent-receipt-sign">−</span>
          <span className="oc-agent-receipt-value">
            {receipt.before !== null && receipt.before !== "" ? (
              `${receipt.property}: ${receipt.before};`
            ) : (
              <span className="oc-agent-receipt-value-unset">(unset)</span>
            )}
          </span>
        </div>
        <div
          className={`oc-agent-receipt-row ${
            failed ? "oc-agent-receipt-row-failed" : "oc-agent-receipt-row-after"
          }`}
        >
          <span className="oc-agent-receipt-sign">+</span>
          <span className="oc-agent-receipt-value">
            {receipt.property}: {receipt.after};
          </span>
        </div>
      </div>
      {sourcePath && (
        <div className="oc-agent-receipt-source">
          {sourcePath}
          {sourceLine ? `:${sourceLine}` : ""}
        </div>
      )}
    </div>
  );
}

function ToolContentView({
  content,
}: {
  content: NonNullable<AgentToolMessage["content"]>;
}) {
  return (
    <div>
      {content.map((block, i) => {
        if (block.type === "content" && block.content.type === "text") {
          return <pre key={i}>{block.content.text}</pre>;
        }
        if (block.type === "diff") {
          return (
            <div key={i} className="oc-agent-tool-content-diff">
              <span className="oc-agent-mono">diff:</span>
              {block.path}
            </div>
          );
        }
        return (
          <div key={i} className="oc-agent-tool-content-diff">
            [{block.type} block]
          </div>
        );
      })}
    </div>
  );
}
