// ──────────────────────────────────────────────────────────
// sessions-hooks — chat-scoped + app-level hooks over the actions context
// ──────────────────────────────────────────────────────────
//
// Track 5.C — extracted from sessions-provider.tsx so Vite Fast Refresh
// stops doing a full reload on every edit. This file exports only
// hooks; the provider file exports only the component; the shared
// Context lives in `./sessions-context`.
//
// `useChatSession(chatId)` is the primary surface for chat views —
// returns the chat's slot state PLUS bridge-connected actions bound
// to that chat id. Subscribes via Zustand selector so chat A's stream
// doesn't re-render chat B.
//
// `useAgentSessions()` returns the bare actions context for app-level
// flows (settings panels, sidebar) that aren't tied to a single chat.
// Identity stable across mutations — safe to put in useEffect deps.
// ──────────────────────────────────────────────────────────

import { useContext } from "react";

import type {
  AgentSessionControls,
  AgentSessionState,
} from "./use-agent-session";
import { useSessionsStore, BLANK } from "./sessions-store";
import { ActionsCtx, type SessionsCtx, type StartForChatOptions } from "./sessions-context";

/** Returns chat slot state + bridge-connected actions bound to `chatId`.
 *
 *  Subscribes to `sessions[chatId]` via a Zustand selector so this hook
 *  only re-renders when *this chat's* slot changes — not when sibling
 *  chats stream tokens. Exposes `ensureSession` for chat-view warmup. */
export function useChatSession(
  chatId: string,
): AgentSessionState & AgentSessionControls & {
  ensureSession(agentId: string, options?: StartForChatOptions): Promise<void>;
  hydrateChat(): Promise<void>;
} {
  const ctx = useContext(ActionsCtx);
  if (!ctx) {
    throw new Error("useChatSession must be used inside <AgentSessionsProvider>");
  }
  const slot = useSessionsStore((s) => s.sessions[chatId] ?? BLANK);

  return {
    ...slot,
    listAgents: ctx.listAgents,
    initAgent: ctx.initAgent,
    // startSession kept for API compatibility; forwards to ensureSession
    // with the chat's id baked in.
    startSession: (agentId, options) =>
      ctx.ensureSession(chatId, agentId, options),
    sendPrompt: (text, displayText, attachments) =>
      ctx.sendPrompt(chatId, text, displayText, attachments),
    cancel: () => ctx.cancel(chatId),
    respondToPermission: (response) =>
      ctx.respondToPermission(chatId, response),
    setMode: (modeId: string) => ctx.setMode(chatId, modeId),
    reset: () => ctx.reset(chatId),
    ensureSession: (agentId, options) =>
      ctx.ensureSession(chatId, agentId, options),
    hydrateChat: () => ctx.hydrateChat(chatId),
  };
}

/** App-level access for flows that aren't tied to a single chat
 *  (e.g. the settings Agents panel fetching the registry).
 *
 *  Returns the **stable** actions context. Its identity does NOT change
 *  on every store mutation — that's the whole point. Consumers can put
 *  this in `useEffect`/`useCallback` deps without their effects
 *  re-firing on every chat token (the bug that produced the 50+/sec
 *  AGENT_INIT_AGENT flood).
 *
 *  For chat-slot data: use `useChatSession(chatId)` (sliced).
 *  For warm-agent state: use `useWarmAgentIds()` from `./sessions-store`. */
export function useAgentSessions(): SessionsCtx {
  const ctx = useContext(ActionsCtx);
  if (!ctx) {
    throw new Error("useAgentSessions must be used inside <AgentSessionsProvider>");
  }
  return ctx;
}
