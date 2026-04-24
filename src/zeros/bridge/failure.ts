// ──────────────────────────────────────────────────────────
// Failure classification — UI-side
// ──────────────────────────────────────────────────────────
//
// The engine now owns all failure classification (see
// src/engine/agents/adapters/base.ts). This module exists only for
// the handful of UI sites that still need to classify an error string
// they caught locally (e.g. a network round-trip that never reached
// the engine). Replaces the old src/engine/acp/failure.ts that was
// deleted in Phase 9.
//
// Keep in sync with BridgeAgentFailure in messages.ts — same kinds,
// same stages. When Phase 9b renames Acp* → Agent* we rename this too.
//
// ──────────────────────────────────────────────────────────

import type { BridgeAgentFailure } from "./messages";

/** Re-export for callers that imported `AgentFailure` from the old
 *  `engine/acp/failure` path. Identical shape to BridgeAgentFailure. */
export type AgentFailure = BridgeAgentFailure;

const AUTH_RX =
  /\b(login|signed?\s*in|credentials|unauthori[sz]ed|api[-\s]?key|oauth|authenticate|please\s+sign|access\s+token|permission\s+denied)\b/i;
const TIMEOUT_RX = /\btimed?\s*out\b/i;
const TRANSPORT_RX = /\bconnection\s*(?:closed|reset)|transport\s+closed|broken\s*pipe\b/i;

/** Classify an error that was raised in the browser (e.g. WebSocket
 *  request rejection, RPC-level timeout) into an AgentFailure. */
export function classifyRpcError(
  err: unknown,
  stage?: AgentFailure["stage"],
): AgentFailure {
  const message = err instanceof Error ? err.message : String(err);
  if (TIMEOUT_RX.test(message)) {
    return { kind: "timeout", message, stage };
  }
  if (TRANSPORT_RX.test(message)) {
    return { kind: "transport-closed", message, stage };
  }
  if (AUTH_RX.test(message)) {
    return { kind: "auth-required", message, stage };
  }
  return { kind: "protocol-error", message, stage };
}

/** Recoverable kinds are transient: the UI can silently retry once
 *  without user intervention. Terminal kinds surface immediately. */
export function isRecoverable(failure: AgentFailure): boolean {
  return failure.kind === "timeout" || failure.kind === "transport-closed";
}
