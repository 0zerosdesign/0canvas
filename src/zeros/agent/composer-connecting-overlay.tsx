// ──────────────────────────────────────────────────────────
// ComposerConnectingOverlay — in-input "Connecting to {agent}…"
// ──────────────────────────────────────────────────────────
//
// Absolutely-positioned pseudo-placeholder that sits on top of the
// empty textarea while the session is warming or reconnecting.
// Shows the agent's branded icon + a short status line, matching
// the reference UX (Claude/ChatGPT-style inline connecting state).
//
// pointer-events: none so the user can still click into the textarea
// and start typing. The overlay hides itself as soon as the user
// starts typing or the session reaches `ready`.
// ──────────────────────────────────────────────────────────

import React from "react";
import type { SessionStatus } from "./use-agent-session";
import { AgentIcon } from "./agent-icon";

interface Props {
  status: SessionStatus;
  agentId: string | null;
  agentName: string | null;
  agentIconUrl: string | null | undefined;
  /** Hide the overlay once the user types — we detect via input length. */
  hidden?: boolean;
}

export function ComposerConnectingOverlay({
  status,
  agentId,
  agentName,
  agentIconUrl,
  hidden,
}: Props) {
  if (hidden) return null;
  if (status !== "warming" && status !== "reconnecting") return null;

  const verb = status === "warming" ? "Connecting to" : "Reconnecting to";
  const label = agentName ?? agentId ?? "agent";

  return (
    <div className="oc-acp-composer-connecting" aria-live="polite">
      {agentId && (
        <AgentIcon
          agentId={agentId}
          iconUrl={agentIconUrl ?? null}
          size={14}
          className="oc-acp-composer-connecting__icon"
        />
      )}
      <span>
        {verb} {label}…
      </span>
    </div>
  );
}
