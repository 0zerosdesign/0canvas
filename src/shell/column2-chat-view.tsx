// ──────────────────────────────────────────────────────────
// Column 2 — Chat view (per-chat ACP session)
// ──────────────────────────────────────────────────────────
//
// Replaces the Phase-0 AIChatPanel in Column 2's Chat tab. Each
// ChatThread in the store gets its own ACP session, scoped to
// the chat's folder and agent. When the user switches chats the
// outer Column2Workspace remounts this component (key=chatId)
// so state automatically flips.
//
// Three states:
//   - no active chat        → empty/start card
//   - chat w/o agent        → inline agent picker (set once)
//   - chat w/ agent         → AcpChat (messages + composer)
//
// Lazy start: the session isn't created until the view mounts
// with a chat that has an agentId — typing a prompt warms the
// subprocess at composer-focus time (handled by AcpChat).
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Plus, Bot as BotIcon } from "lucide-react";
import { Button } from "../0canvas/ui";
import { useWorkspace, type ChatThread } from "../0canvas/store/store";
import { useAcpSessions, useChatSession } from "../0canvas/acp/sessions-provider";
import { AcpChat } from "../0canvas/acp/acp-chat";
import { AgentsPanel } from "../0canvas/acp/agents-panel";
import { envForChat } from "../0canvas/acp/composer-pills";
import type { BridgeRegistryAgent } from "../0canvas/bridge/messages";
import { invoke } from "@tauri-apps/api/core";

function newChatId(): string {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

async function resolveCurrentFolder(): Promise<string> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return "";
  }
  try {
    const root = await invoke<string | null>("get_engine_root");
    return root ?? "";
  } catch {
    return "";
  }
}

export function Column2ChatView() {
  const { state, dispatch } = useWorkspace();
  const active = state.chats.find((c) => c.id === state.activeChatId);

  if (!active) {
    return (
      <div className="oc-chat-empty-state">
        <MessageSquarePlus size={24} />
        <p>
          Click <strong>New Chat</strong> in the sidebar to start a conversation.
        </p>
      </div>
    );
  }

  // Chat has no agent bound yet — show the registry picker. Bind the
  // first choice to this chat so future mounts go straight to AcpChat.
  if (!active.agentId) {
    return (
      <NoAgentView
        chatId={active.id}
        onPicked={(agent) => {
          dispatch({
            type: "UPDATE_CHAT_TITLE",
            id: active.id,
            title: active.title,
          });
          // Bind agent by replacing the chat thread in place. Using the
          // existing reducer actions means no schema churn — we rebuild
          // the chat with the new agentId/agentName via a splice.
          const next = state.chats.map((c) =>
            c.id === active.id
              ? { ...c, agentId: agent.id, agentName: agent.name, updatedAt: Date.now() }
              : c,
          );
          dispatch({ type: "HYDRATE_CHATS", chats: next, activeChatId: active.id });
        }}
      />
    );
  }

  return (
    <ChatBody
      chatId={active.id}
      agentId={active.agentId}
      agentName={active.agentName ?? active.agentId}
      cwd={active.folder}
    />
  );
}

function NoAgentView({
  chatId,
  onPicked,
}: {
  chatId: string;
  onPicked: (agent: BridgeRegistryAgent) => void;
}) {
  const session = useChatSession(chatId);
  return (
    <AgentsPanel
      listAgents={session.listAgents}
      onSelect={onPicked}
      activeAgentId={null}
    />
  );
}

function ChatBody({
  chatId,
  agentId,
  agentName,
  cwd,
}: {
  chatId: string;
  agentId: string;
  agentName: string;
  cwd: string;
}) {
  const { state } = useWorkspace();
  const session = useChatSession(chatId);
  const chat = state.chats.find((c) => c.id === chatId);

  // Serialize the env tuple so the effect only fires on a real
  // user-facing change, not on every store update.
  const envKey = chat
    ? `${chat.model ?? ""}|${chat.effort}`
    : "";
  const envKeyRef = useRef(envKey);

  // Initial spawn (idempotent). ensureSession short-circuits if the
  // same (chatId, agentId) pair is already ready.
  useEffect(() => {
    const env = chat ? envForChat(chat, session.initialize) : undefined;
    void session.ensureSession(agentId, {
      agentName,
      cwd: cwd || undefined,
      env,
    });
    envKeyRef.current = envKey;
    // We only want this to fire when the identity triple changes, not
    // on every render or when session internals shuffle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, agentId, cwd]);

  // Respawn when the user changes model/effort. The new env takes
  // effect on the next agent subprocess start; ensureSession with
  // force=true drops browser state so messages don't appear to stick
  // around under a different model.
  useEffect(() => {
    if (envKey === envKeyRef.current) return;
    envKeyRef.current = envKey;
    if (!chat) return;
    void session.ensureSession(agentId, {
      agentName,
      cwd: cwd || undefined,
      env: envForChat(chat, session.initialize),
      force: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envKey]);

  return (
    <AcpChat
      session={session}
      onBack={() => session.reset()}
      headerActions={<NewChatPicker />}
      chatId={chatId}
    />
  );
}

/** "+" dropdown in the chat header — opens a list of installed agents
 *  and creates a new chat bound to the picked one. Mirrors the behavior
 *  of Column 1's "New Chat" but lets the user pick the agent up front. */
function NewChatPicker() {
  const { dispatch } = useWorkspace();
  const sessions = useAcpSessions();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<BridgeRegistryAgent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside-click / Escape — same pattern as the profile menu.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await sessions.listAgents();
      setAgents(list);
    } finally {
      setLoading(false);
    }
  }, [sessions]);

  // Lazy-load the first time the dropdown opens so we don't hammer the
  // registry on every chat render.
  useEffect(() => {
    if (open && !agents && !loading) void loadAgents();
  }, [open, agents, loading, loadAgents]);

  const handlePick = async (agent: BridgeRegistryAgent) => {
    setOpen(false);
    const folder = await resolveCurrentFolder();
    const chat: ChatThread = {
      id: newChatId(),
      folder,
      agentId: agent.id,
      agentName: agent.name,
      model: null,
      effort: "medium",
      permissionMode: "ask",
      title: `New ${agent.name} chat`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: "ADD_CHAT", chat });
  };

  // Only show installed agents in the picker — running an uninstalled
  // agent via npx/uvx on every "+" would surprise the user. If nothing
  // installed, the menu shows a link to the full registry in settings.
  const installed = (agents ?? []).filter((a) => a.installed);

  return (
    <div className="oc-new-chat-picker" ref={rootRef}>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="New chat with agent"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus className="w-3.5 h-3.5" />
      </Button>
      {open && (
        <div className="oc-new-chat-picker__menu" role="menu">
          <div className="oc-new-chat-picker__label">New chat with…</div>
          {loading && !agents && (
            <div className="oc-new-chat-picker__hint">Loading agents…</div>
          )}
          {agents && installed.length === 0 && (
            <div className="oc-new-chat-picker__hint">
              No agents installed. Install one via <code>npm install -g</code>
              {" "}or set a default in <strong>Settings → Agents</strong>.
            </div>
          )}
          {installed.map((a) => (
            <Button
              key={a.id}
              variant="ghost"
              className="oc-new-chat-picker__item"
              onClick={() => handlePick(a)}
            >
              {a.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.icon}
                  alt=""
                  className="oc-new-chat-picker__icon"
                  loading="lazy"
                />
              ) : (
                <BotIcon className="oc-new-chat-picker__icon" />
              )}
              <span>{a.name}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
