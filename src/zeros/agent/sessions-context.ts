// ──────────────────────────────────────────────────────────
// sessions-context — actions context shared between provider + hooks
// ──────────────────────────────────────────────────────────
//
// Track 5.C — Vite Fast Refresh requires that a `.tsx` file with a
// component export ONLY export components (and type-only exports).
// Mixing the `<AgentSessionsProvider>` component with the
// `useChatSession`/`useAgentSessions` hooks in the same file forced
// a full page reload on every edit instead of a hot-swap.
//
// The fix is to extract the Context object and the actions interface
// into this plain `.ts` module. Provider creates+populates the Context
// from here; hooks read from here. Both files now have a clean Fast
// Refresh boundary (provider = component-only, hooks = hooks-only).
// ──────────────────────────────────────────────────────────

import { createContext } from "react";
import type {
  ContentBlock,
  InitializeResponse,
  RequestPermissionResponse,
} from "../bridge/agent-events";
import type { ListSessionsResponse } from "../bridge/agent-events";
import type { BridgeRegistryAgent } from "../bridge/messages";
import type {
  AgentSessionState,
  StartSessionOptions,
} from "./use-agent-session";

/** Options accepted by `ensureSession`/`loadIntoChat`. Extends the
 *  base `StartSessionOptions` with chat-scoped fields the provider
 *  needs (cwd, force-restart). */
export interface StartForChatOptions extends StartSessionOptions {
  /** Absolute path the agent subprocess should use as cwd. */
  cwd?: string;
  /** Force a fresh session even when one is already ready. Used when
   *  the user changes model/effort. */
  force?: boolean;
}

/** Bridge-connected actions. The context value contains ONLY these —
 *  no session data — so the value is stable and downstream consumers
 *  using `useContext(ActionsCtx)` don't re-render on every token. */
export interface SessionsActions {
  getSession(chatId: string): AgentSessionState | undefined;
  listAgents(force?: boolean): Promise<BridgeRegistryAgent[]>;
  initAgent(agentId: string): Promise<InitializeResponse>;
  ensureSession(
    chatId: string,
    agentId: string,
    options?: StartForChatOptions,
  ): Promise<void>;
  sendPrompt(
    chatId: string,
    text: string,
    displayText?: string,
    attachments?: ContentBlock[],
  ): Promise<void>;
  cancel(chatId: string): Promise<void>;
  respondToPermission(
    chatId: string,
    response: RequestPermissionResponse,
  ): void;
  setMode(chatId: string, modeId: string): Promise<void>;
  reset(chatId: string): void;
  listSessionsFor(
    agentId: string,
    opts?: { cwd?: string; cursor?: string | null },
  ): Promise<ListSessionsResponse>;
  loadIntoChat(
    chatId: string,
    agentId: string,
    sessionId: string,
    options?: StartForChatOptions,
  ): Promise<void>;
  /** Load on-disk transcript for `chatId` if the in-memory slot is
   *  empty. Idempotent — safe to call from a chat view's mount effect.
   *  Does NOT touch a slot that's already populated; the live store
   *  is the source of truth once the user is interacting. */
  hydrateChat(chatId: string): Promise<void>;
  disposeAll(): void;
}

/** Public alias for the context type — kept under its old name so
 *  `useAgentSessions(): SessionsCtx` consumers don't need to update. */
export type SessionsCtx = SessionsActions;

/** Internal React context. The provider sets the value; hooks
 *  consume it. Null when used outside the provider — hooks throw. */
export const ActionsCtx = createContext<SessionsActions | null>(null);
