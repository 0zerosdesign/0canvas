// ──────────────────────────────────────────────────────────
// Empty-state composer — Column 2 landing when no chat active
// ──────────────────────────────────────────────────────────
//
// Cursor-style: a centered composer card invites the user to
// start a new chat instead of showing a "click New Chat" hint.
// Hitting Enter creates a chat bound to the current workspace
// folder and the default agent, then enqueues the text for the
// freshly-mounted AcpChat to pick up and send.
//
// Kept intentionally light — the full composer (pills, mentions,
// branch chip) lives inside AcpChat and takes over the moment a
// chat exists. This surface only needs to get the user from
// "no chat" to "sending first message".
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Send, Sparkles } from "lucide-react";
import { Button, Textarea } from "../zeros/ui";
import { useWorkspace, type ChatThread } from "../zeros/store/store";
import { useBridge } from "../zeros/bridge/use-bridge";
import { useAcpSessions } from "../zeros/acp/sessions-provider";
import { getDefaultAgentId } from "../zeros/panels/settings-page";
import type { BridgeRegistryAgent } from "../zeros/bridge/messages";

function folderBasename(path: string): string {
  if (!path) return "No project";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

async function resolveCurrentFolder(): Promise<string> {
  const { isNativeRuntime, nativeInvoke } = await import("../native/runtime");
  if (!isNativeRuntime()) return "";
  try {
    const root = await nativeInvoke<string | null>("get_engine_root");
    return root ?? "";
  } catch {
    return "";
  }
}

function newChatId(): string {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function pendingId(): string {
  return `pend-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function EmptyComposer() {
  const { dispatch } = useWorkspace();
  const bridge = useBridge();
  const sessions = useAcpSessions();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [input, setInput] = useState("");
  const [folder, setFolder] = useState<string>("");
  const [planMode, setPlanMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noAgentHint, setNoAgentHint] = useState(false);

  useEffect(() => {
    resolveCurrentFolder().then(setFolder);
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const pickAgent = useCallback(async (): Promise<BridgeRegistryAgent | null> => {
    // Prefer the user's configured default; fall back to any installed
    // agent from the registry; fall back to null and let the chat's
    // NoAgentView prompt the user to pick one. Same resolution order as
    // Column 1's "New Chat" button.
    const configuredId = getDefaultAgentId();
    try {
      const list = await sessions.listAgents();
      const found =
        (configuredId && list.find((a) => a.id === configuredId)) ||
        list.find((a) => a.installed) ||
        null;
      return found;
    } catch {
      return null;
    }
  }, [sessions]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || submitting) return;
    setSubmitting(true);

    const agent = await pickAgent();
    if (!agent) {
      // No installed agent. Creating a chat + enqueuing a submission here
      // would orphan the user's text — the chat would land in NoAgentView,
      // the submission would never flush (no session ever reaches ready).
      // Preserve input and surface a hint instead.
      setNoAgentHint(true);
      setSubmitting(false);
      return;
    }
    setNoAgentHint(false);

    const chat: ChatThread = {
      id: newChatId(),
      folder,
      agentId: agent.id,
      agentName: agent.name,
      model: null,
      effort: "medium",
      permissionMode: planMode ? "plan-only" : "ask",
      // Seed title from the first message so the sidebar label reflects
      // intent immediately — AcpChat's auto-title hook will no-op since
      // the title is no longer the sentinel "New chat".
      title: text.length > 40 ? `${text.slice(0, 40).trimEnd()}…` : text,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: "ADD_CHAT", chat });

    // ADD_CHAT flips activeChatId to this chat, which remounts Column 2's
    // body onto AcpChat for this thread. AcpChat's pending-submission
    // effect picks this up once the session reaches "ready".
    dispatch({
      type: "ENQUEUE_CHAT_SUBMISSION",
      submission: { id: pendingId(), text, source: "manual" },
    });

    setInput("");
    setSubmitting(false);
  };

  const handleGoToAgentSettings = () => {
    dispatch({ type: "SET_ACTIVE_PAGE", page: "settings" });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const canSend = input.trim().length > 0 && !submitting;

  return (
    <div className="oc-empty-composer-wrap">
      <div className="oc-empty-composer" role="region" aria-label="Start a new chat">
        <div className="oc-empty-composer__meta">
          <span className="oc-empty-composer__folder">
            <FolderOpen size={12} />
            <span>{folderBasename(folder)}</span>
          </span>
        </div>
        <div className="oc-empty-composer__box">
          <Textarea
            ref={textareaRef}
            className="oc-empty-composer__input"
            placeholder="Plan, Build, / for commands, @ for context"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            aria-label="Message"
          />
          <div className="oc-empty-composer__actions">
            <div className="oc-empty-composer__actions-left" />
            <Button
              variant="primary"
              size="icon-sm"
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSend}
              title="Send (Enter)"
            >
              <Send size={14} />
            </Button>
          </div>
        </div>
        <div className="oc-empty-composer__chips">
          <Button
            variant="ghost"
            className={`oc-empty-composer__chip ${planMode ? "is-active" : ""}`}
            onClick={() => setPlanMode((v) => !v)}
            title="Plan a new idea without executing"
          >
            <Sparkles size={12} />
            <span>Plan New Idea</span>
          </Button>
        </div>
        {noAgentHint && (
          <div className="oc-empty-composer__hint" role="status">
            <span>
              No agent installed. Install one from Settings → Agents to send
              this message.
            </span>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleGoToAgentSettings}
            >
              Open Agent Settings
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
