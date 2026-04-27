// ──────────────────────────────────────────────────────────
// ExitPlanModeCard — "approve this plan + pick next mode"
// ──────────────────────────────────────────────────────────
//
// Stage 6.3. Claude's `ExitPlanMode` tool is the agent's signal
// "I've drafted a plan, please approve it and pick the next
// mode". It's a permissioned tool, so a permission request
// arrives alongside the tool_call — but unlike a regular
// Allow/Deny prompt, the user's answer here is two-axis:
//
//   1. Do you approve the plan? (yes implies allow_once on the
//      permission; no implies reject_once / cancel)
//   2. Continue in which mode?  (default / acceptEdits / auto)
//
// Rather than try to bend the generic InlinePermissionCluster,
// we render a dedicated card that shows the proposed plan as
// markdown and offers three approve-and-continue buttons +
// a "Stay in Plan" reject button.
//
// Wire flow on a button click:
//   - approve: respondToPermission(allow_once); setMode(modeId)
//   - reject:  respondToPermission(reject_once or cancelled)
//
// MessageView SHOULD NOT render the generic permission cluster
// for switch_mode tools — this card has its own. The suppression
// lives in MessageView's match-detect logic.
// ──────────────────────────────────────────────────────────

import { memo, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GitBranch,
} from "lucide-react";

import type { Renderer } from "./types";
import type { AgentToolMessage } from "../use-agent-session";
import type { PermissionOption } from "../../bridge/agent-events";
import { renderMarkdown } from "../markdown";

interface ModeChoice {
  modeId: string;
  label: string;
  description: string;
}

/** Mode-pick options shown for Claude after approving a plan.
 *  Order = the user's typical preference: most-restrictive first
 *  (so a fast Enter doesn't auto-pick yolo). */
const CLAUDE_MODE_CHOICES: ModeChoice[] = [
  {
    modeId: "default",
    label: "Default",
    description: "Prompt before each write or shell command",
  },
  {
    modeId: "accept-edits",
    label: "Accept Edits",
    description: "Auto-approve safe writes; prompt risky ones",
  },
  {
    modeId: "auto",
    label: "Auto",
    description: "Classifier-gated — minimal prompts",
  },
];

export const ExitPlanModeCard: Renderer<AgentToolMessage> = memo(
  function ExitPlanModeCard({ message, ctx }) {
    const tool = message;
    const planText = readPlan(tool.rawInput);
    const planHtml = useMemo(
      () => (planText ? renderMarkdown(planText) : null),
      [planText],
    );
    const [expanded, setExpanded] = useState(true);

    // Find a permission request matching this tool. Drives whether
    // the mode-pick UI shows or just the static "approved/rejected"
    // chrome.
    const pending =
      ctx.pendingPermission &&
      ctx.pendingPermission.request.toolCall.toolCallId === tool.toolCallId
        ? ctx.pendingPermission
        : null;

    const status: "pending" | "approved" | "rejected" =
      pending != null
        ? "pending"
        : tool.status === "completed"
        ? "approved"
        : tool.status === "failed"
        ? "rejected"
        : "pending";

    const onApprove = (modeId: string) => {
      if (!pending) return;
      const allowOnce = pickOption(pending.request.options, [
        "allow_once",
        "allow_always",
      ]);
      if (!allowOnce) return;
      ctx.respondToPermission({
        outcome: { outcome: "selected", optionId: allowOnce.optionId },
      });
      // Apply mode after approving so the next turn runs in the
      // chosen mode. Adapter no-ops gracefully if it doesn't
      // expose modes (non-Claude agents won't fire ExitPlanMode in
      // the first place; this is defensive).
      ctx.setMode?.(modeId);
    };

    const onReject = () => {
      if (!pending) return;
      const rejectOnce = pickOption(pending.request.options, [
        "reject_once",
        "reject_always",
      ]);
      if (rejectOnce) {
        ctx.respondToPermission({
          outcome: { outcome: "selected", optionId: rejectOnce.optionId },
        });
      } else {
        ctx.respondToPermission({ outcome: { outcome: "cancelled" } });
      }
    };

    return (
      <div
        className={`oc-agent-tool oc-agent-tool-exitplan oc-agent-tool-exitplan-${status}`}
      >
        <button
          type="button"
          className="oc-agent-tool-head oc-agent-exitplan-head"
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
            <div className="oc-agent-exitplan-title">
              {status === "pending"
                ? "Plan ready for review"
                : status === "approved"
                ? "Plan approved"
                : "Plan rejected"}
            </div>
          </div>
          <ExitPlanStatusBadge status={status} />
        </button>

        {expanded && (
          <div className="oc-agent-exitplan-content">
            {planHtml ? (
              <div
                className="oc-agent-exitplan-plan oc-agent-md"
                dangerouslySetInnerHTML={{ __html: planHtml }}
              />
            ) : (
              <div className="oc-agent-exitplan-empty">
                (the agent invoked ExitPlanMode without a plan body)
              </div>
            )}

            {status === "pending" && pending && (
              <div className="oc-agent-exitplan-decision">
                <div className="oc-agent-exitplan-decision-head">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Approve and continue in which mode?</span>
                </div>
                <div className="oc-agent-exitplan-modes">
                  {CLAUDE_MODE_CHOICES.map((c) => (
                    <button
                      key={c.modeId}
                      type="button"
                      className="oc-agent-exitplan-mode"
                      onClick={() => onApprove(c.modeId)}
                    >
                      <span className="oc-agent-exitplan-mode-label">
                        {c.label}
                      </span>
                      <span className="oc-agent-exitplan-mode-desc">
                        {c.description}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="oc-agent-exitplan-reject-row">
                  <button
                    type="button"
                    className="oc-agent-exitplan-reject"
                    onClick={onReject}
                  >
                    Stay in Plan mode
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

function ExitPlanStatusBadge({
  status,
}: {
  status: "pending" | "approved" | "rejected";
}) {
  const cls = `oc-agent-exitplan-status oc-agent-exitplan-status-${status}`;
  const label =
    status === "pending"
      ? "awaiting"
      : status === "approved"
      ? "approved"
      : "rejected";
  return <span className={cls}>{label}</span>;
}

function readPlan(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const v = (input as Record<string, unknown>).plan;
  return typeof v === "string" ? v : null;
}

function pickOption(
  options: PermissionOption[],
  prefer: string[],
): PermissionOption | null {
  for (const k of prefer) {
    const opt = options.find((o) => o.kind === k);
    if (opt) return opt;
  }
  return null;
}
