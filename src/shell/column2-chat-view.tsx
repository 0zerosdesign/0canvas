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
//   - chat w/ agent         → AgentChat (messages + composer)
//
// Lazy start: the session isn't created until the view mounts
// with a chat that has an agentId — typing a prompt warms the
// subprocess at composer-focus time (handled by AgentChat).
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Bot as BotIcon, History } from "lucide-react";
import { Button } from "../zeros/ui";
import { useWorkspace, type ChatThread } from "../zeros/store/store";
import { useAgentSessions, useChatSession } from "../zeros/agent/sessions-provider";
import { AgentChat } from "../zeros/agent/agent-chat";
import { AgentsPanel } from "../zeros/agent/agents-panel";
import { envForChat } from "../zeros/agent/composer-pills";
import { uiEntryForAgent } from "../zeros/agent/agent-ui-registry";
import { useEnabledAgents } from "../zeros/agent/enabled-agents";
import type { SessionInfo } from "@agentclientprotocol/sdk";
import type { BridgeRegistryAgent } from "../zeros/bridge/messages";
import { isNativeRuntime, nativeInvoke } from "../native/runtime";
import { EmptyComposer } from "./empty-composer";

function newChatId(): string {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

async function resolveCurrentFolder(): Promise<string> {
  if (!isNativeRuntime()) return "";
  try {
    const root = await nativeInvoke<string | null>("get_engine_root");
    return root ?? "";
  } catch {
    return "";
  }
}

export function Column2ChatView() {
  const { state, dispatch } = useWorkspace();
  const active = state.chats.find((c) => c.id === state.activeChatId);

  if (!active) {
    return <EmptyComposer />;
  }

  // Chat has no agent bound yet — show the registry picker. Bind the
  // first choice to this chat so future mounts go straight to AgentChat.
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
  const sessions = useAgentSessions();
  return (
    <AgentsPanel
      listAgents={session.listAgents}
      onSelect={onPicked}
      activeAgentId={null}
      onPreWarm={(id) => {
        // Fire-and-forget; errors silently ignored. Warms the adapter
        // subprocess + ACP initialize so clicking is instant.
        void sessions.initAgent(id).catch(() => {});
      }}
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
  const { state, dispatch } = useWorkspace();
  const session = useChatSession(chatId);
  const chat = state.chats.find((c) => c.id === chatId);

  // Serialize the env tuple so the effect only fires on a real
  // user-facing change, not on every store update.
  const envKey = chat
    ? `${chat.model ?? ""}|${chat.effort}`
    : "";
  const envKeyRef = useRef(envKey);

  // Initial spawn (idempotent). ensureSession short-circuits if the
  // same (chatId, agentId) pair is already ready. When the chat has a
  // resumeSessionId set (Codex/Claude "resume recent thread"), we load
  // that session instead of creating a new one.
  const sessions = useAgentSessions();
  useEffect(() => {
    const env = chat ? envForChat(chat, session.initialize) : undefined;
    const toResume = chat?.resumeSessionId;
    if (toResume) {
      // Clear the resume marker *before* awaiting — if the load fails or
      // the user closes/reopens the app mid-load, we must not re-enter
      // the same broken resume on next mount. The Retry button then falls
      // back to ensureSession (fresh session), which is the right thing
      // when the prior session is unrecoverable.
      dispatch({
        type: "UPDATE_CHAT_SETTINGS",
        id: chatId,
        updates: { resumeSessionId: undefined },
      });
      void sessions.loadIntoChat(chatId, agentId, toResume, {
        agentName,
        cwd: cwd || undefined,
        env,
      });
    } else {
      void session.ensureSession(agentId, {
        agentName,
        cwd: cwd || undefined,
        env,
      });
    }
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
    <AgentChat
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
interface RecentThread {
  agentId: string;
  agentName: string;
  info: SessionInfo;
}

function NewChatPicker() {
  const { dispatch } = useWorkspace();
  const sessions = useAgentSessions();
  const { isEnabled } = useEnabledAgents();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<BridgeRegistryAgent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentThread[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  // Pre-warm set — agent ids we've already initAgent'd this session, so
  // re-hovering doesn't re-fire the spawn.
  const warmedRef = useRef<Set<string>>(new Set());

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

  // Also load recent threads for history-capable installed agents. Fires
  // once per dropdown open, parallel across agents so slow adapters don't
  // block the whole list.
  useEffect(() => {
    if (!open || !agents) return;
    const eligible = agents.filter(
      (a) => a.installed && uiEntryForAgent(a.id).ui.hasThreadHistory,
    );
    if (eligible.length === 0) {
      setRecent([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        eligible.map(async (a) => ({
          agent: a,
          resp: await sessions.listSessionsFor(a.id),
        })),
      );
      if (cancelled) return;
      const flat: RecentThread[] = [];
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        for (const info of r.value.resp.sessions) {
          flat.push({
            agentId: r.value.agent.id,
            agentName: r.value.agent.name,
            info,
          });
        }
      }
      // Most-recent first, cap to 5 across agents.
      flat.sort((a, b) => {
        const ta = a.info.updatedAt ? Date.parse(a.info.updatedAt) : 0;
        const tb = b.info.updatedAt ? Date.parse(b.info.updatedAt) : 0;
        return tb - ta;
      });
      setRecent(flat.slice(0, 5));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, agents, sessions]);

  const handleResume = async (r: RecentThread) => {
    setOpen(false);
    const folder = r.info.cwd || (await resolveCurrentFolder());
    const chat: ChatThread = {
      id: newChatId(),
      folder,
      agentId: r.agentId,
      agentName: r.agentName,
      model: null,
      effort: "medium",
      permissionMode: "ask",
      title: r.info.title ?? `Resumed ${r.agentName} chat`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      resumeSessionId: r.info.sessionId,
    };
    dispatch({ type: "ADD_CHAT", chat });
  };

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

  // An agent is runnable only when it's installed AND signed in (when
  // sign-in applies). Mirrors the agent-pill + Settings panel logic so
  // the user gets one consistent definition of "this is ready to use"
  // across all three surfaces.
  const isRunnableAgent = (a: BridgeRegistryAgent): boolean => {
    if (a.installed !== true) return false;
    if (!a.authBinary) return true;
    return a.authenticated === true;
  };
  const visible = (agents ?? [])
    .filter((a) => isEnabled(a.id))
    .sort((a, b) => {
      const aActive = isRunnableAgent(a) ? 0 : 1;
      const bActive = isRunnableAgent(b) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.name.localeCompare(b.name);
    });

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
          {recent.length > 0 && (
            <>
              <div className="oc-new-chat-picker__label">Resume recent</div>
              {recent.map((r) => (
                <Button
                  key={`${r.agentId}:${r.info.sessionId}`}
                  variant="ghost"
                  className="oc-new-chat-picker__item"
                  onClick={() => void handleResume(r)}
                  title={`${r.agentName} · ${r.info.cwd}`}
                >
                  <History className="oc-new-chat-picker__icon" />
                  <span className="truncate">
                    {r.info.title ?? r.info.sessionId.slice(0, 8)}
                  </span>
                </Button>
              ))}
              <div className="oc-new-chat-picker__sep" aria-hidden />
            </>
          )}
          <div className="oc-new-chat-picker__label">New chat with…</div>
          {loading && !agents && (
            <div className="oc-new-chat-picker__hint">Loading agents…</div>
          )}
          {agents && visible.length === 0 && (
            <div className="oc-new-chat-picker__hint">
              No active agents. Log in to one in{" "}
              <strong>Settings → Agents</strong>.
            </div>
          )}
          {visible.map((a) => {
            const isRunnable = isRunnableAgent(a);
            return (
              <Button
                key={a.id}
                variant="ghost"
                className={`oc-new-chat-picker__item ${isRunnable ? "" : "is-disabled"}`}
                onClick={() => {
                  if (!isRunnable) return;
                  handlePick(a);
                }}
                onMouseEnter={() => {
                  if (!isRunnable) return;
                  if (warmedRef.current.has(a.id)) return;
                  warmedRef.current.add(a.id);
                  void sessions.initAgent(a.id).catch(() => {});
                }}
                disabled={!isRunnable}
                title={
                  isRunnable
                    ? a.name
                    : `${a.name} is not active — log in via Settings → Agents`
                }
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
                {!isRunnable && (
                  <span
                    className="oc-chat-agent-inactive-dot"
                    aria-label="Agent not active"
                    title="Not active — log in via Settings → Agents"
                  />
                )}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
