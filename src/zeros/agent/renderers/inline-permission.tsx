// ──────────────────────────────────────────────────────────
// InlinePermissionCluster — Allow / Deny / Always-for-X
// rendered directly under the tool card needing permission
// ──────────────────────────────────────────────────────────
//
// Stage 6.1. Replaces the global PermissionBar (chrome between
// the message list and the composer) for any permission whose
// `toolCall.toolCallId` matches a rendered tool message. Same
// underlying respondToPermission hook the PermissionBar uses;
// just placed inline so a long Claude run with 14 prompts feels
// like 14 in-context micro-decisions instead of 14 modal-shaped
// interrupts in the chrome.
//
// Visual hierarchy:
//   - Tool card renders its normal body above
//   - This cluster appears below as a tinted strip
//   - Risk colour and headline come from the design-tool
//     describePermission() metadata when it matches; otherwise
//     a generic "Allow this tool call?" prompt
//   - Buttons render the wire `request.options[]` verbatim;
//     "Cancel turn" is always last
//
// Auth-style permissions (no matching toolCallId) keep the
// global PermissionBar — that surface is the fallback for
// requests we can't anchor to a specific card.
// ──────────────────────────────────────────────────────────

import { memo } from "react";
import { AlertCircle } from "lucide-react";

import type {
  PermissionOption,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from "../../bridge/agent-events";
import { Button } from "../../ui";
import { matchDesignTool } from "./design-tools";

interface InlinePermissionClusterProps {
  request: RequestPermissionRequest;
  onRespond: (response: RequestPermissionResponse) => void;
}

export const InlinePermissionCluster = memo(function InlinePermissionCluster({
  request,
  onRespond,
}: InlinePermissionClusterProps) {
  const rawTitle = request.toolCall.title ?? request.toolCall.kind ?? "Tool call";
  const matched = matchDesignTool(rawTitle);
  const prompt =
    matched?.describePermission?.(request.toolCall.rawInput, {
      // Inline cluster doesn't currently get a workspace-elements
      // snapshot — design-tool prompts that depend on "current value
      // for selector" lose their before/after diff in this surface.
      // The global PermissionBar still passes the workspace through;
      // this is the trade for in-context decisions.
      currentValueForSelector: () => undefined,
    }) ?? null;

  const risk = prompt?.risk ?? "high";
  const Icon = matched?.icon ?? AlertCircle;
  const headline =
    prompt?.headline ?? `Agent wants to run: ${rawTitle}`;
  const body = prompt?.body ?? null;

  return (
    <div className={`oc-agent-perm-inline oc-agent-perm-inline-${risk}`}>
      <div className="oc-agent-perm-inline-head">
        <Icon className="oc-agent-perm-inline-icon w-3.5 h-3.5" />
        <div className="oc-agent-perm-inline-text">
          <div className="oc-agent-perm-inline-title">{headline}</div>
          {body && (
            <div className="oc-agent-perm-inline-body">{body}</div>
          )}
        </div>
      </div>
      <div className="oc-agent-perm-inline-actions">
        {request.options.map((opt) => (
          <PermissionButton
            key={opt.optionId}
            option={opt}
            onClick={() =>
              onRespond({
                outcome: { outcome: "selected", optionId: opt.optionId },
              })
            }
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => onRespond({ outcome: { outcome: "cancelled" } })}
          className="oc-agent-perm-inline-btn oc-agent-perm-inline-btn-cancel"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
});

function PermissionButton({
  option,
  onClick,
}: {
  option: PermissionOption;
  onClick: () => void;
}) {
  const variant: "allow" | "reject" | "neutral" =
    option.kind === "allow_always" || option.kind === "allow_once"
      ? "allow"
      : option.kind === "reject_always" || option.kind === "reject_once"
      ? "reject"
      : "neutral";
  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      onClick={onClick}
      className={`oc-agent-perm-inline-btn oc-agent-perm-inline-btn-${variant}`}
    >
      {friendlyOptionLabel(option.name, option.kind)}
    </Button>
  );
}

/** Mirrors the helper in agent-chat.tsx's PermissionBar — agents
 *  produce option names with varying verbosity ("Allow once",
 *  "reject_once", "Yes, always"). Normalise the most common variants
 *  to a clean two-word designer label without dropping anything
 *  already clearer than our default. */
function friendlyOptionLabel(
  name: string,
  kind: string | null | undefined,
): string {
  const trimmed = name.trim();
  if (
    trimmed.length > 0 &&
    !/^allow_(once|always)$|^reject_(once|always)$/i.test(trimmed)
  ) {
    return trimmed;
  }
  switch (kind) {
    case "allow_once":
      return "Allow once";
    case "allow_always":
      return "Always allow";
    case "reject_once":
      return "Block";
    case "reject_always":
      return "Always block";
    default:
      return trimmed || "OK";
  }
}
