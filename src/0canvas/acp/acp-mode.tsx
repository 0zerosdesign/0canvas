// ──────────────────────────────────────────────────────────
// AcpMode — orchestrates picker → auth → chat
// ──────────────────────────────────────────────────────────
//
// Owns the useAcpSession instance and the current "screen" inside the
// ACP surface. Three screens, linear flow:
//
//   picker   — user chooses an agent from the live registry
//   auth     — user picks an auth method (API key or subscription)
//              — skipped for agents without a known auth config
//   chat     — live session with the agent
//
// Back from auth returns to picker; back from chat calls session.reset()
// which kills the browser-side session state (the subprocess stays warm
// under the session-manager, amortizing spawn cost on the next session).
// ──────────────────────────────────────────────────────────

import React, { useCallback, useState } from "react";
import { useAcpSession } from "./use-acp-session";
import { AgentsPanel } from "./agents-panel";
import { AcpChat } from "./acp-chat";
import { AuthModal, AGENT_AUTH_CONFIG, type AuthChoice } from "./auth-modal";
import type { BridgeRegistryAgent } from "../bridge/messages";

type Screen = "picker" | "auth" | "chat";

export function AcpMode() {
  const session = useAcpSession();
  const [screen, setScreen] = useState<Screen>("picker");
  const [pendingAgent, setPendingAgent] = useState<BridgeRegistryAgent | null>(null);

  const handlePickAgent = useCallback((agent: BridgeRegistryAgent) => {
    setPendingAgent(agent);
    // Agents with no known auth config (e.g. auggie, qoder) get started
    // directly — they handle their own auth via the registry's env or
    // the agent's own interactive flow.
    if (!AGENT_AUTH_CONFIG[agent.id]) {
      session.startSession(agent.id, { agentName: agent.name }).catch(() => {
        /* surfaced via session.error */
      });
      setScreen("chat");
      return;
    }
    setScreen("auth");
  }, [session]);

  const handleAuthConfirm = useCallback(
    (choice: AuthChoice) => {
      if (!pendingAgent) return;
      session
        .startSession(pendingAgent.id, {
          agentName: pendingAgent.name,
          env: choice.env,
        })
        .catch(() => {
          /* surfaced via session.error */
        });
      setScreen("chat");
    },
    [pendingAgent, session],
  );

  const handleAuthBack = useCallback(() => {
    setPendingAgent(null);
    setScreen("picker");
  }, []);

  const handleChatBack = useCallback(() => {
    session.reset();
    setPendingAgent(null);
    setScreen("picker");
  }, [session]);

  if (screen === "auth" && pendingAgent) {
    return (
      <AuthModal
        agent={pendingAgent}
        onConfirm={handleAuthConfirm}
        onBack={handleAuthBack}
      />
    );
  }

  if (screen === "chat") {
    return <AcpChat session={session} onBack={handleChatBack} />;
  }

  return (
    <AgentsPanel
      listAgents={session.listAgents}
      onSelect={handlePickAgent}
      activeAgentId={session.agentId}
    />
  );
}
