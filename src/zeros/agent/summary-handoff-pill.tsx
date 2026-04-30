// ──────────────────────────────────────────────────────────
// SummaryHandoffPill — Conductor-style "bring prior chat as context"
// ──────────────────────────────────────────────────────────
//
// Renders at the top of a new chat when the user arrived via an
// agent-switch (chatThread.sourceChatId set). Offers a single chip
// labelled with the source chat's title; clicking it pastes a
// compact transcript of the prior conversation into the composer
// as the first user message. Dismiss clears the sourceChatId so
// the pill never re-appears for this chat.
// ──────────────────────────────────────────────────────────

import React from "react";
import { FileText, X as XIcon } from "lucide-react";
import { useAgentSessions } from "./sessions-hooks";
import { useWorkspace } from "../store/store";
import type { AgentSessionState } from "./use-agent-session";

interface Props {
  chatId: string;
  sourceChatId: string;
  onInsert: (text: string) => void;
}

function buildTranscript(
  session: AgentSessionState | undefined,
  sourceAgentName: string | null,
): string {
  if (!session) return "";
  const lines: string[] = [];
  for (const m of session.messages) {
    if (m.kind !== "text") continue;
    const role = m.role === "user" ? "User" : "Assistant";
    const text = (m as { text?: string }).text?.trim();
    if (!text) continue;
    lines.push(`${role}: ${text}`);
  }
  const transcript = lines.join("\n\n");
  const frame = sourceAgentName
    ? `I was working with ${sourceAgentName} on this. Here's the prior conversation:\n\n${transcript}\n\nPlease continue from here.`
    : `Here's the prior conversation:\n\n${transcript}\n\nPlease continue from here.`;
  return frame;
}

export function SummaryHandoffPill({ chatId, sourceChatId, onInsert }: Props) {
  const sessions = useAgentSessions();
  const { state, dispatch } = useWorkspace();
  const sourceChat = state.chats.find((c) => c.id === sourceChatId) ?? null;
  // useAgentSessions().sessions used to be a direct field; it now flows
  // via getSession so the actions context can stay reference-stable
  // (was triggering 50+/sec AGENT_INIT_AGENT loops elsewhere).
  const sourceSession = sessions.getSession(sourceChatId);

  if (!sourceChat) return null;

  const title = sourceChat.title || "previous chat";

  const handleInsert = () => {
    const text = buildTranscript(sourceSession, sourceChat.agentName);
    if (text) onInsert(text);
    dispatch({
      type: "UPDATE_CHAT_SETTINGS",
      id: chatId,
      updates: { sourceChatId: undefined },
    });
  };

  const handleDismiss = () => {
    dispatch({
      type: "UPDATE_CHAT_SETTINGS",
      id: chatId,
      updates: { sourceChatId: undefined },
    });
  };

  return (
    <div className="oc-summary-handoff" role="status">
      <span className="oc-summary-handoff__label">Add chat summaries:</span>
      <button
        type="button"
        className="oc-summary-handoff__chip"
        onClick={handleInsert}
        title={`Paste summary of "${title}" into the first message`}
      >
        <FileText size={11} />
        <span className="oc-summary-handoff__chip-title">{title}</span>
      </button>
      <button
        type="button"
        className="oc-summary-handoff__dismiss"
        onClick={handleDismiss}
        title="Start fresh — no handoff"
        aria-label="Dismiss summary handoff"
      >
        <XIcon size={11} />
      </button>
    </div>
  );
}
