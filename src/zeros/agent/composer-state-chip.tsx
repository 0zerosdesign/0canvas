// ──────────────────────────────────────────────────────────
// ComposerStateChip — compact session-state indicator
// ──────────────────────────────────────────────────────────
//
// Tiny pill that sits in the composer's footer row alongside
// AgentPill / Workspace / Branch. Renders the current session
// status (warming / ready / reconnecting / auth-required / failed)
// with a colored dot and a short label, so the user gets a single
// glance-level signal without a body-level banner.
//
// Only renders something when the session needs attention — for
// `ready` and `streaming` it returns null so the toolbar stays quiet.
// ──────────────────────────────────────────────────────────

import React from "react";
import { LogIn, AlertCircle } from "lucide-react";
import type { SessionStatus } from "./use-agent-session";

interface Props {
  status: SessionStatus;
  /** Human-friendly agent name for the "Sign in to {agent}" label. */
  agentName?: string | null;
  /** Called when the user clicks the chip in `auth-required` or
   *  `failed` state. Typically opens Settings → Agents. */
  onAction?: () => void;
}

export function ComposerStateChip({ status, agentName, onAction }: Props) {
  // Actionable states only — warming / reconnecting are rendered by
  // ComposerConnectingOverlay inside the composer card so the user
  // gets a single prominent indicator instead of a small footer chip.
  if (status === "auth-required") {
    return (
      <button
        type="button"
        className="oc-composer-state-chip is-auth"
        onClick={onAction}
        title={`Sign in to ${agentName ?? "the agent"}`}
      >
        <LogIn size={11} />
        <span>Sign in{agentName ? ` to ${agentName}` : ""}</span>
      </button>
    );
  }

  if (status === "failed") {
    return (
      <button
        type="button"
        className="oc-composer-state-chip is-failed"
        onClick={onAction}
        title="Agent error — click for details"
      >
        <AlertCircle size={11} />
        <span>Agent error</span>
      </button>
    );
  }

  return null;
}
