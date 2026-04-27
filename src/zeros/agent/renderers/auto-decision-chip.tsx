// ──────────────────────────────────────────────────────────
// AutoDecisionChip — "auto-allowed by policy · revoke"
// ──────────────────────────────────────────────────────────
//
// Stage 6.2. When a tool call's permission was auto-resolved
// by a Zeros sticky policy ("Always allow Bash" etc.), the
// tool card gets a tiny chip below it explaining what fired
// and a click-to-revoke affordance.
//
// Two reasons to render this rather than silently auto-
// allow:
//   1. The user can mistake an auto-allow for the agent
//      acting without permission. Surfacing the policy
//      attribution removes the surprise.
//   2. Stage 6.2 doesn't ship a Settings page for policies.
//      The chip's revoke link is the only way to clear a
//      sticky decision today.
//
// Compact by design — single line, dim text, on hover the
// revoke turns into a button. The card body is always more
// important than the chip.
// ──────────────────────────────────────────────────────────

import { memo } from "react";
import { Shield, X as XIcon } from "lucide-react";

interface AutoDecisionChipProps {
  decision: "allow" | "reject";
  onRevoke: () => void;
}

export const AutoDecisionChip = memo(function AutoDecisionChip({
  decision,
  onRevoke,
}: AutoDecisionChipProps) {
  const verb = decision === "allow" ? "allowed" : "blocked";
  return (
    <div
      className={`oc-agent-auto-decision oc-agent-auto-decision-${decision}`}
    >
      <Shield className="oc-agent-auto-decision-icon w-3 h-3" />
      <span className="oc-agent-auto-decision-text">
        Auto-{verb} by policy
      </span>
      <button
        type="button"
        className="oc-agent-auto-decision-revoke"
        onClick={onRevoke}
        title="Revoke this policy — future calls of this tool will prompt again"
      >
        <XIcon className="w-3 h-3" />
        <span>Revoke</span>
      </button>
    </div>
  );
});
