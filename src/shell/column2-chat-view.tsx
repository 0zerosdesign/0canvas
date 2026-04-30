// ──────────────────────────────────────────────────────────
// Column 2 — Chat view (per-chat native agent session)
// ──────────────────────────────────────────────────────────
//
// Replaces the Phase-0 AIChatPanel in Column 2's Chat tab. Each
// ChatThread in the store gets its own agent session, scoped to
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
import { useAgentSessions, useChatSession } from "../zeros/agent/sessions-hooks";
import { useBridgeStatus } from "../zeros/bridge/use-bridge";
import { AgentChat } from "../zeros/agent/agent-chat";
import { AgentsPanel } from "../zeros/agent/agents-panel";
import { envForChat } from "../zeros/agent/composer-pills";
import { uiEntryForAgent } from "../zeros/agent/agent-ui-registry";
import { useEnabledAgents } from "../zeros/agent/enabled-agents";
import type { SessionInfo } from "../zeros/bridge/agent-events";
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
        // subprocess + agent initialize so clicking is instant.
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
  // persisted sessionId (either seeded by "Resume recent thread" or
  // carried over from a previous app run), we load that session from
  // disk instead of creating a new one — provider state is a hot
  // cache, the agent CLI's on-disk transcript is the source of truth.
  const sessions = useAgentSessions();
  useEffect(() => {
    // Show whatever we saved on disk immediately — works for every
    // agent regardless of whether its loadSession replays (Claude Code
    // does, Codex / Cursor don't). The store's `loadInProgress` flag
    // suppresses the agent's replay events while loadIntoChat runs, so
    // hydrate + load no longer double-renders messages.
    void session.hydrateChat();

    const env = chat ? envForChat(chat, session.initialize) : undefined;
    const persistedSessionId = chat?.sessionId;
    // Provider already has a live session for this chat — nothing to do.
    if (session.sessionId) {
      envKeyRef.current = envKey;
      return;
    }
    if (persistedSessionId) {
      // Tell the engine about the prior session id so future prompts
      // can resume the agent's server-side context. The replay events
      // the agent emits during this RPC are dropped by the store
      // (loadInProgress) — disk hydrate above is the visible source.
      // On AGENT_ERROR the provider lands in "failed" — clear sessionId
      // so the next Retry tap falls into ensureSession with a fresh id.
      void sessions
        .loadIntoChat(chatId, agentId, persistedSessionId, {
          agentName,
          cwd: cwd || undefined,
          env,
        })
        .then(() => {
          const after = sessions.getSession(chatId);
          if (after?.status === "failed") {
            dispatch({
              type: "UPDATE_CHAT_SETTINGS",
              id: chatId,
              updates: { sessionId: undefined },
            });
          }
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

  // Persist the session id back onto the chat metadata whenever the
  // provider reports a new one (after newSession, loadSession, or a
  // forced model-swap respawn). This is what makes the disk link
  // survive app restarts and future workspace swaps.
  useEffect(() => {
    if (!chat) return;
    const sid = session.sessionId;
    if (sid && sid !== chat.sessionId) {
      dispatch({
        type: "UPDATE_CHAT_SETTINGS",
        id: chatId,
        updates: { sessionId: sid },
      });
    }
  }, [chatId, session.sessionId, chat, dispatch]);

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

  // Auto-retry on bridge reconnect. The chat lands in `failed` state
  // when its initial load hits a transient bridge error (queue full
  // mid-respawn, AGENT_LOAD_SESSION timeout while the engine is
  // restarting). Without this effect the user has to manually click
  // away and back to retry — a real "stuck" feeling. We only retry
  // once per reconnect: on the rising edge of bridgeStatus going to
  // "connected" while the session is in a failed/transient state.
  const bridgeStatus = useBridgeStatus();
  const lastBridgeStatusRef = useRef(bridgeStatus);
  useEffect(() => {
    const prev = lastBridgeStatusRef.current;
    lastBridgeStatusRef.current = bridgeStatus;
    if (prev === "connected" || bridgeStatus !== "connected") return;
    if (!chat) return;
    if (session.status !== "failed" && session.status !== "reconnecting") return;
    const env = envForChat(chat, session.initialize);
    const persistedSessionId = chat.sessionId;
    if (persistedSessionId) {
      void sessions.loadIntoChat(chatId, agentId, persistedSessionId, {
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
    // We deliberately exclude `session` from deps — its identity
    // changes on every state update and would re-fire this loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeStatus, chatId, agentId, agentName, cwd]);

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
  const { state, dispatch } = useWorkspace();
  const sessions = useAgentSessions();
  const { isEnabled } = useEnabledAgents();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<BridgeRegistryAgent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentThread[]>([]);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Pre-warm set — agent ids we've already initAgent'd this session, so
  // re-hovering doesn't re-fire the spawn.
  const warmedRef = useRef<Set<string>>(new Set());

  // Reset the "Show all" expansion every time the dropdown closes —
  // re-opening should start with the compact view, not whatever the
  // user expanded to last time.
  useEffect(() => {
    if (!open) setShowAllRecent(false);
  }, [open]);

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
      // Dedupe against already-imported chats by sessionId so the user
      // can't accidentally create a second sidebar entry pointing at the
      // same on-disk transcript. Archived chats still count — restoring
      // is the right path for those, not re-importing.
      const importedSessionIds = new Set(
        state.chats
          .map((c) => c.sessionId)
          .filter((s): s is string => typeof s === "string"),
      );
      const flat: RecentThread[] = [];
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        for (const info of r.value.resp.sessions) {
          if (importedSessionIds.has(info.sessionId)) continue;
          flat.push({
            agentId: r.value.agent.id,
            agentName: r.value.agent.name,
            info,
          });
        }
      }
      // Most-recent first.
      flat.sort((a, b) => {
        const ta = a.info.updatedAt ? Date.parse(a.info.updatedAt) : 0;
        const tb = b.info.updatedAt ? Date.parse(b.info.updatedAt) : 0;
        return tb - ta;
      });
      setRecent(flat);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, agents, sessions, state.chats]);

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
      sessionId: r.info.sessionId,
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
          {recent.length > 0 && (() => {
            // Default cap keeps the dropdown short; "Show all" expands
            // it for the import-history flow when the user wants to see
            // every native CLI session that isn't yet in the sidebar.
            const DEFAULT_CAP = 5;
            const visibleRecent = showAllRecent
              ? recent
              : recent.slice(0, DEFAULT_CAP);
            const hidden = recent.length - visibleRecent.length;
            return (
              <>
                <div className="oc-new-chat-picker__label">
                  {showAllRecent
                    ? `Import from disk (${recent.length})`
                    : "Resume recent"}
                </div>
                {visibleRecent.map((r) => (
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
                {hidden > 0 && (
                  <Button
                    variant="ghost"
                    className="oc-new-chat-picker__item is-muted"
                    onClick={() => setShowAllRecent(true)}
                  >
                    <span className="truncate">
                      Show {hidden} older session{hidden === 1 ? "" : "s"}…
                    </span>
                  </Button>
                )}
                <div className="oc-new-chat-picker__sep" aria-hidden />
              </>
            );
          })()}
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
