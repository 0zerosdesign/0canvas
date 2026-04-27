// ──────────────────────────────────────────────────────────
// sessions-store — Zustand store for per-chat session slots
// ──────────────────────────────────────────────────────────
//
// Phase 0 step 3 of the chat UI rebuild. Before this, every
// chat lived in a single React useState<Record<chatId, slot>>
// inside <AgentSessionsProvider>. That meant a token arriving
// for chat A re-rendered chat B's MessageView, the sidebar
// row for chat C, and every other consumer of the context.
//
// Zustand inverts that: subscribers pick the slice they care
// about and only re-render when *that slice* changes. The
// per-chat hook (`useChatSession`) now subscribes to one
// `sessions[chatId]` slot via a selector — chat A's stream no
// longer touches chat B.
//
// What lives here:
//   - `sessions`: the chatId-keyed slot map (the one truth)
//   - `warmAgentIds`: set of agent ids the engine confirmed alive
//   - `sessionToChatId`: O(1) reverse index for bridge dispatch
//     (kept in the store so it stays consistent with `sessions`
//     instead of as a separate React ref that can drift)
//   - Pure mutators + bridge-notification reducers
//
// What does NOT live here:
//   - The bridge client (lives in <AgentSessionsProvider>)
//   - Async actions that talk to the bridge (sendPrompt,
//     ensureSession, …) — those need bridge access and stay
//     in the provider as React-callback methods
//
// ──────────────────────────────────────────────────────────

import { create } from "zustand";
import type {
  AvailableCommand,
  PlanEntry,
  RequestPermissionRequest,
  SessionNotification,
} from "../bridge/agent-events";
import {
  applyUpdate,
  BLANK_USAGE,
  type AgentMessage,
  type AgentSessionState,
  type AgentUsage,
  type SessionStatus,
} from "./use-agent-session";

const MAX_STDERR_LINES = 200;

/** Renderer-side cap on per-chat message history. The engine streams
 *  every tool-call delta as a separate notification; long edit-heavy
 *  sessions can produce tens of thousands of entries. We keep the most
 *  recent N so the renderer doesn't grow without bound. Phase 0 step 4
 *  replaces this silent truncation with a SQLite-backed windowed view
 *  so disk is the source of truth and nothing is lost. */
export const MAX_MESSAGES_PER_CHAT = 1000;

function capMessages(messages: AgentMessage[]): AgentMessage[] {
  if (messages.length <= MAX_MESSAGES_PER_CHAT) return messages;
  return messages.slice(-MAX_MESSAGES_PER_CHAT);
}

export const BLANK: AgentSessionState = {
  agentId: null,
  agentName: null,
  sessionId: null,
  initialize: null,
  session: null,
  status: "idle",
  messages: [],
  pendingPermission: null,
  stderrLog: [],
  error: null,
  failure: null,
  lastStopReason: null,
  availableModes: [],
  currentModeId: null,
  usage: BLANK_USAGE,
  plan: [],
  availableCommands: [],
};

export interface SessionsStoreState {
  sessions: Record<string, AgentSessionState>;
  warmAgentIds: Set<string>;
  /** sessionId → chatId reverse index. Updated atomically with `sessions`
   *  so bridge dispatch stays O(1) and never reads a half-applied state. */
  sessionToChatId: Record<string, string>;
  /** Chats currently inside an `AGENT_LOAD_SESSION` round-trip. While a
   *  chat sits in this set, content-bearing session_updates (text /
   *  thought / tool chunks) are dropped — the agent's loadSession may
   *  replay history (Claude Code does), and we already showed those
   *  messages from the disk hydrate. Allowing both produces visible
   *  duplication of every message and thinking block.
   *
   *  Control-plane updates (plan, mode, usage, commands) are NOT dropped
   *  — they reflect the latest server state and need to land. */
  loadInProgress: Set<string>;

  /** Per-chat scroll position (scrollTop in px). Phase 1 §2.5.8:
   *  when the user swaps between parallel agent chats in the sidebar,
   *  each chat restores its last scroll position rather than snapping
   *  to bottom. Conductor 0.49 ships this; without it, the long-run UX
   *  loses the "I was reading mid-transcript" state on every chat
   *  swap. In-memory only for now — survives chat-switch within a
   *  session, resets at app restart. SQLite persistence is a
   *  Phase 2.11 polish item. */
  scrollPositions: Record<string, number>;

  // ── Pure mutators ───────────────────────────────────────
  setSession: (chatId: string, slot: AgentSessionState) => void;
  patchSession: (chatId: string, patch: Partial<AgentSessionState>) => void;
  removeSession: (chatId: string) => void;
  setWarmAgent: (agentId: string, warm: boolean) => void;
  setLoadInProgress: (chatId: string, value: boolean) => void;
  setScrollPosition: (chatId: string, top: number) => void;
  clearAll: () => void;

  // ── Bridge-notification reducers ────────────────────────
  /** Dispatch a SessionNotification to its chat's slot. Splits on
   *  notification kind: `usage_update`/`plan`/`current_mode_update`/
   *  `available_commands_update` patch top-level fields; everything else
   *  feeds into the messages reducer (`applyUpdate`). */
  applyBridgeUpdate: (notification: SessionNotification) => void;

  /** Permission requests are routed through the request's sessionId. */
  applyBridgePermissionRequest: (
    agentId: string,
    permissionId: string,
    request: RequestPermissionRequest,
  ) => void;

  /** Stderr fans out to every chat on this agent — a single subprocess
   *  serves them all and the user could be looking at any of them. */
  applyBridgeStderr: (agentId: string, line: string) => void;

  /** Subprocess exited. Any chat on this agent that wasn't already in a
   *  terminal state flips to `reconnecting` so the next user action can
   *  drive a fresh ensureSession. We do NOT auto-retry — that path
   *  produced eternal "Reconnecting…" bugs in the past. */
  applyBridgeAgentExit: (agentId: string) => void;
}

export const useSessionsStore = create<SessionsStoreState>((set, get) => ({
  sessions: {},
  warmAgentIds: new Set(),
  sessionToChatId: {},
  loadInProgress: new Set(),
  scrollPositions: {},

  setScrollPosition: (chatId, top) => {
    // Identity-stable when value unchanged so subscribers (e.g. the
    // sidebar reading the map) don't re-render on every scroll tick.
    set((state) => {
      if (state.scrollPositions[chatId] === top) return state;
      return {
        scrollPositions: { ...state.scrollPositions, [chatId]: top },
      };
    });
  },

  setSession: (chatId, slot) => {
    set((state) => {
      const next = { ...state.sessions, [chatId]: slot };
      return {
        sessions: next,
        sessionToChatId: rebuildIndex(next),
      };
    });
  },

  patchSession: (chatId, patch) => {
    set((state) => {
      const existing = state.sessions[chatId] ?? BLANK;
      const updated = { ...existing, ...patch };
      const next = { ...state.sessions, [chatId]: updated };
      // Only rebuild the reverse index if sessionId changed — saves work
      // on the common path (token chunks don't touch sessionId).
      const indexNeedsUpdate =
        existing.sessionId !== updated.sessionId;
      return {
        sessions: next,
        sessionToChatId: indexNeedsUpdate
          ? rebuildIndex(next)
          : state.sessionToChatId,
      };
    });
  },

  removeSession: (chatId) => {
    set((state) => {
      if (!(chatId in state.sessions)) return state;
      const next = { ...state.sessions };
      delete next[chatId];
      const nextScroll = { ...state.scrollPositions };
      delete nextScroll[chatId];
      return {
        sessions: next,
        sessionToChatId: rebuildIndex(next),
        scrollPositions: nextScroll,
      };
    });
  },

  setWarmAgent: (agentId, warm) => {
    set((state) => {
      const has = state.warmAgentIds.has(agentId);
      if (warm === has) return state;
      const next = new Set(state.warmAgentIds);
      if (warm) next.add(agentId);
      else next.delete(agentId);
      return { warmAgentIds: next };
    });
  },

  setLoadInProgress: (chatId, value) => {
    set((state) => {
      const has = state.loadInProgress.has(chatId);
      if (value === has) return state;
      const next = new Set(state.loadInProgress);
      if (value) next.add(chatId);
      else next.delete(chatId);
      return { loadInProgress: next };
    });
  },

  clearAll: () => {
    set({
      sessions: {},
      warmAgentIds: new Set(),
      sessionToChatId: {},
      loadInProgress: new Set(),
      scrollPositions: {},
    });
  },

  applyBridgeUpdate: (notification) => {
    const chatId = get().sessionToChatId[notification.sessionId];
    if (!chatId) return;

    const upd = notification.update as {
      sessionUpdate?: string;
      size?: number;
      used?: number;
      currentModeId?: string;
      entries?: PlanEntry[];
      availableCommands?: AvailableCommand[];
    };

    // Drop content events while a load is in flight. The agent (Claude
    // Code in particular) replays its transcript via session_updates
    // during loadSession; we already showed those messages from the
    // disk hydrate, and the agent's regenerated msgIds don't coalesce
    // with our stored ones. Letting the replay through duplicates every
    // message + thinking block on reopen — the bug we're fixing here.
    //
    // Control updates (plan / mode / commands / usage) are always kept:
    // they reflect the current authoritative server state.
    if (get().loadInProgress.has(chatId)) {
      const isContentEvent =
        upd.sessionUpdate === "user_message_chunk" ||
        upd.sessionUpdate === "agent_message_chunk" ||
        upd.sessionUpdate === "agent_thought_chunk" ||
        upd.sessionUpdate === "tool_call" ||
        upd.sessionUpdate === "tool_call_update";
      if (isContentEvent) return;
    }

    // usage_update → context window accounting. Keep cumulative counters
    // from prompt-response usage; overwrite size/used.
    if (upd.sessionUpdate === "usage_update") {
      set((state) => {
        const slot = state.sessions[chatId];
        if (!slot) return state;
        const nextUsage: AgentUsage = {
          ...slot.usage,
          size: typeof upd.size === "number" ? upd.size : slot.usage.size,
          used: typeof upd.used === "number" ? upd.used : slot.usage.used,
        };
        return {
          sessions: { ...state.sessions, [chatId]: { ...slot, usage: nextUsage } },
        };
      });
      return;
    }

    if (upd.sessionUpdate === "current_mode_update" && upd.currentModeId) {
      get().patchSession(chatId, { currentModeId: upd.currentModeId });
      return;
    }

    if (upd.sessionUpdate === "plan" && Array.isArray(upd.entries)) {
      get().patchSession(chatId, { plan: upd.entries });
      return;
    }

    if (
      upd.sessionUpdate === "available_commands_update" &&
      Array.isArray(upd.availableCommands)
    ) {
      get().patchSession(chatId, { availableCommands: upd.availableCommands });
      return;
    }

    // Everything else → feed to the messages reducer.
    set((state) => {
      const slot = state.sessions[chatId];
      if (!slot) return state;
      const nextMessages = capMessages(applyUpdate(slot.messages, notification));
      // Reference-equal short-circuit: if applyUpdate returned the same
      // array (no-op for a kind we don't model in messages), avoid the
      // spread to keep selectors stable.
      if (nextMessages === slot.messages) return state;
      return {
        sessions: {
          ...state.sessions,
          [chatId]: { ...slot, messages: nextMessages },
        },
      };
    });
  },

  applyBridgePermissionRequest: (agentId, permissionId, request) => {
    const sid = (request as { sessionId?: string }).sessionId;
    const chatId = sid ? get().sessionToChatId[sid] : undefined;
    if (!chatId) return;
    get().patchSession(chatId, {
      pendingPermission: {
        agentId,
        permissionId,
        request,
      },
    });
  },

  applyBridgeStderr: (agentId, line) => {
    set((state) => {
      let changed = false;
      const next: Record<string, AgentSessionState> = {};
      for (const [chatId, slot] of Object.entries(state.sessions)) {
        if (slot.agentId === agentId) {
          next[chatId] = {
            ...slot,
            stderrLog: [
              ...slot.stderrLog.slice(-(MAX_STDERR_LINES - 1)),
              line,
            ],
          };
          changed = true;
        } else {
          next[chatId] = slot;
        }
      }
      return changed ? { sessions: next } : state;
    });
  },

  applyBridgeAgentExit: (agentId) => {
    // Mark the agent cold first.
    get().setWarmAgent(agentId, false);
    set((state) => {
      let changed = false;
      const next: Record<string, AgentSessionState> = {};
      for (const [chatId, slot] of Object.entries(state.sessions)) {
        if (slot.agentId === agentId) {
          changed = true;
          const terminal =
            slot.status === "failed" || slot.status === "auth-required";
          if (terminal) {
            next[chatId] = slot;
            continue;
          }
          next[chatId] = {
            ...slot,
            status: "reconnecting" as SessionStatus,
            error: null,
            failure: null,
            sessionId: null,
            session: null,
          };
        } else {
          next[chatId] = slot;
        }
      }
      if (!changed) return state;
      return {
        sessions: next,
        sessionToChatId: rebuildIndex(next),
      };
    });
  },
}));

function rebuildIndex(
  sessions: Record<string, AgentSessionState>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [chatId, slot] of Object.entries(sessions)) {
    if (slot.sessionId) map[slot.sessionId] = chatId;
  }
  return map;
}

// ──────────────────────────────────────────────────────────
// Selector hooks — preferred over reading the whole store
// ──────────────────────────────────────────────────────────

/** Subscribe to one chat's slot. The render only fires when *this* chat's
 *  slot reference changes — sibling chats streaming tokens never trigger
 *  this hook. Returns BLANK for unknown ids so the caller can render a
 *  consistent shape without null-guarding. */
export function useChatSlot(chatId: string): AgentSessionState {
  return useSessionsStore((s) => s.sessions[chatId] ?? BLANK);
}

/** Subscribe to the warm-agent set. Used by agent pills (green dot). */
export function useWarmAgentIds(): ReadonlySet<string> {
  return useSessionsStore((s) => s.warmAgentIds);
}
