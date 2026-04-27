// ──────────────────────────────────────────────────────────
// ErrorCard — session-level failure UI
// ──────────────────────────────────────────────────────────
//
// Replaces the plain-text rendering of `session.error` and
// `session.failure` with a tinted card carrying:
//   - the message body (collapsible if long)
//   - "View details" toggle for the structured AgentFailure
//   - "Reset session" (clears the error + re-establishes a
//     fresh session for this chat)
//   - "Dismiss" (hides the card locally; error stays in store
//     until a reset or new prompt clears it)
//
// Stage 4.3 surfaces session-level errors. Tool-level failures
// (status="failed" on a tool call) keep their per-card status
// badge — surfacing them as separate ErrorCards would be noisy
// and double-renders the same information.
// ──────────────────────────────────────────────────────────

import { memo, useState } from "react";
import { AlertCircle, RotateCcw, X as XIcon } from "lucide-react";

interface AgentFailureLike {
  /** Human-readable summary of what went wrong. Sometimes equal to
   *  the top-level `error` string; sometimes a richer reason from
   *  the bridge's structured failure. */
  message?: string;
  /** Stable code the user / future automation can match against. */
  code?: string;
  /** Optional native CLI / process detail (exit code, signal, raw
   *  stderr line). Surfaced under "View details". */
  details?: unknown;
}

interface ErrorCardProps {
  error: string;
  failure?: AgentFailureLike | null;
  onReset: () => void;
}

export const ErrorCard = memo(function ErrorCard({
  error,
  failure,
  onReset,
}: ErrorCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (dismissed) return null;

  const detail = failure?.details;
  const detailJson =
    detail !== undefined && detail !== null
      ? safeStringify(detail)
      : null;
  const code = failure?.code;

  return (
    <div className="oc-agent-errorcard">
      <div className="oc-agent-errorcard-head">
        <AlertCircle className="oc-agent-errorcard-icon w-3.5 h-3.5" />
        <div className="oc-agent-errorcard-body">
          <div className="oc-agent-errorcard-title">
            Agent error
            {code && <span className="oc-agent-errorcard-code">{code}</span>}
          </div>
          <div className="oc-agent-errorcard-message">{error}</div>
        </div>
        <button
          type="button"
          className="oc-agent-errorcard-dismiss"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      {detailJson && (
        <div className="oc-agent-errorcard-details">
          <button
            type="button"
            className="oc-agent-errorcard-detailtoggle"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? "Hide details" : "View details"}
          </button>
          {showDetails && (
            <pre className="oc-agent-errorcard-detailbody">{detailJson}</pre>
          )}
        </div>
      )}
      <div className="oc-agent-errorcard-actions">
        <button
          type="button"
          className="oc-agent-errorcard-action"
          onClick={onReset}
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset session</span>
        </button>
      </div>
    </div>
  );
});

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
