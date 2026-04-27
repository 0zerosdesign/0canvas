// ──────────────────────────────────────────────────────────
// AgentMode — orchestrates picker → auth → chat
// ──────────────────────────────────────────────────────────
//
// Owns the useAgentSession instance and the current "screen" inside the
// Agent setup surface. Four screens, linear flow:
//
//   picker   — user chooses an agent from the live registry
//   loading  — we spawn the agent subprocess + read its initialize response
//              so the auth screen can render advertised methods
//   auth     — user picks an auth method (API key / subscription / ...)
//              — skipped entirely when the agent advertises no interactive
//              methods (handles its own auth internally)
//   chat     — live session with the agent
//
// Back from auth returns to picker; back from chat calls session.reset()
// which kills the browser-side session state (the subprocess stays warm
// under the session-manager, amortizing spawn cost on the next session).
// ──────────────────────────────────────────────────────────

import React, { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import type { InitializeResponse } from "../bridge/agent-events";
import { useAgentSession } from "./use-agent-session";
import { AgentsPanel } from "./agents-panel";
import { AgentChat } from "./agent-chat";
import { AuthModal, type AuthChoice } from "./auth-modal";
import type { BridgeRegistryAgent } from "../bridge/messages";

type Screen = "picker" | "loading" | "auth" | "chat";

export function AgentMode() {
  const session = useAgentSession();
  const [screen, setScreen] = useState<Screen>("picker");
  const [pendingAgent, setPendingAgent] = useState<BridgeRegistryAgent | null>(null);
  const [initialize, setInitialize] = useState<InitializeResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handlePickAgent = useCallback(
    async (agent: BridgeRegistryAgent) => {
      setPendingAgent(agent);
      setInitialize(null);
      setLoadError(null);
      setScreen("loading");

      try {
        // Spawns the subprocess with empty env and reads initialize.authMethods.
        // If the agent advertises no interactive methods we auto-start a session
        // from inside AuthModal — so only two screens are visible here.
        const init = await session.initAgent(agent.id);
        setInitialize(init);
        setScreen("auth");
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err));
        setScreen("loading");
      }
    },
    [session],
  );

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
    setInitialize(null);
    setScreen("picker");
  }, []);

  const handleChatBack = useCallback(() => {
    session.reset();
    setPendingAgent(null);
    setInitialize(null);
    setScreen("picker");
  }, [session]);

  if (screen === "loading" && pendingAgent) {
    return (
      <div className="oc-agent-surface">
        <div className="oc-agent-loading">
          {loadError ? (
            <div className="oc-agent-error">
              <div className="min-w-0">
                <div className="oc-agent-error-title">
                  Couldn't reach {pendingAgent.name}
                </div>
                <div>{loadError}</div>
              </div>
            </div>
          ) : (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Starting {pendingAgent.name}...
            </>
          )}
        </div>
      </div>
    );
  }

  if (screen === "auth" && pendingAgent) {
    return (
      <AuthModal
        agent={pendingAgent}
        initialize={initialize}
        onConfirm={handleAuthConfirm}
        onBack={handleAuthBack}
      />
    );
  }

  if (screen === "chat") {
    return <AgentChat session={session} onBack={handleChatBack} />;
  }

  return (
    <AgentsPanel
      listAgents={session.listAgents}
      onSelect={handlePickAgent}
      activeAgentId={session.agentId}
    />
  );
}
