// ──────────────────────────────────────────────────────────
// agent-history-client — renderer-side wrapper over IPC
// ──────────────────────────────────────────────────────────
//
// Thin typed shell over the SQLite handlers in
// electron/ipc/commands/agent-history.ts. Every call goes
// through window.__ZEROS_NATIVE__ via nativeInvoke, so when
// running in a non-Electron browser harness all writes are
// silent no-ops and reads return [].
//
// The store batches writes: bridge updates land in the
// store's reducers (sync), then a per-frame flusher in
// sessions-provider calls `appendMessages` once with the
// changed messages for each affected chat. Reads happen
// once per chat on mount via the hydrate helper.
//
// ──────────────────────────────────────────────────────────

import { isElectron, nativeInvoke } from "../../native/runtime";
import type { AgentMessage } from "./use-agent-session";

export interface PersistedMessageWire {
  msgId: string;
  kind: string;
  /** JSON-serialized AgentMessage (string, not parsed) so the IPC
   *  envelope stays stable as the message shape evolves. */
  payload: string;
  createdAt: number;
}

export interface ChatMetaWire {
  chatId: string;
  agentId: string | null;
  agentName: string | null;
  sessionId: string | null;
  updatedAt: number;
  /** Optional — pre-Phase-2 rows return undefined; null means the user
   *  hasn't scrolled yet. */
  scrollPosition?: number | null;
}

/** Convert an in-memory AgentMessage to its on-disk shape. The msgId
 *  is the stable identity — for streaming text chunks every coalesced
 *  update keeps the same id, so the UPSERT in the main process
 *  rewrites a single row instead of appending. */
export function toPersistedMessage(m: AgentMessage): PersistedMessageWire {
  return {
    msgId: m.id,
    kind: m.kind,
    payload: JSON.stringify(m),
    createdAt: m.createdAt,
  };
}

/** Inverse of toPersistedMessage. JSON.parse is wrapped so a corrupt
 *  row from an earlier build doesn't crash hydrate — bad rows are
 *  dropped and logged. */
export function fromPersistedMessage(p: PersistedMessageWire): AgentMessage | null {
  try {
    return JSON.parse(p.payload) as AgentMessage;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Zeros agent-history] dropping unreadable message ${p.msgId}:`,
      err,
    );
    return null;
  }
}

export async function appendMessages(
  chatId: string,
  messages: AgentMessage[],
): Promise<void> {
  if (!isElectron() || messages.length === 0) return;
  await nativeInvoke<void>("agent_history_append", {
    chatId,
    items: messages.map(toPersistedMessage),
  });
}

export async function windowMessages(
  chatId: string,
  limit: number,
  before?: number,
): Promise<AgentMessage[]> {
  if (!isElectron()) return [];
  const rows = await nativeInvoke<PersistedMessageWire[]>(
    "agent_history_window",
    { chatId, limit, ...(before !== undefined ? { before } : {}) },
  );
  return rows
    .map(fromPersistedMessage)
    .filter((m): m is AgentMessage => m !== null);
}

/** Phase 2 §2.11.4 — fetch the next page of older messages relative
 *  to the oldest visible message. Returns rows in chronological
 *  order; renderer prepends them. Empty array = no older rows on
 *  disk (renderer should hide the "Load older" affordance). */
export async function windowOlderMessages(
  chatId: string,
  limit: number,
  beforeMsgId: string,
): Promise<AgentMessage[]> {
  if (!isElectron()) return [];
  const rows = await nativeInvoke<PersistedMessageWire[]>(
    "agent_history_window_older",
    { chatId, limit, beforeMsgId },
  );
  return rows
    .map(fromPersistedMessage)
    .filter((m): m is AgentMessage => m !== null);
}

export async function clearChat(chatId: string): Promise<void> {
  if (!isElectron()) return;
  await nativeInvoke<void>("agent_history_clear_chat", { chatId });
}

export async function setChatMeta(
  meta: Omit<ChatMetaWire, "updatedAt">,
): Promise<void> {
  if (!isElectron()) return;
  await nativeInvoke<void>("agent_history_set_chat_meta", meta);
}

export async function getChatMeta(
  chatId: string,
): Promise<ChatMetaWire | null> {
  if (!isElectron()) return null;
  return nativeInvoke<ChatMetaWire | null>(
    "agent_history_get_chat_meta",
    { chatId },
  );
}

export async function listChats(): Promise<ChatMetaWire[]> {
  if (!isElectron()) return [];
  return nativeInvoke<ChatMetaWire[]>("agent_history_list_chats");
}

/** Fire-and-forget persist of a chat's scroll position. The renderer
 *  already updates the in-memory store synchronously; this just makes
 *  the value durable across restart. Caller is expected to debounce —
 *  typically 1s of scroll-idle. Phase 2 §2.11 closure. */
export async function setChatScrollPosition(
  chatId: string,
  top: number,
): Promise<void> {
  if (!isElectron()) return;
  await nativeInvoke<void>("agent_history_set_chat_scroll_position", {
    chatId,
    top,
  });
}

/** Bulk-fetch every chat's saved scroll position. Called once at app
 *  boot to seed the in-memory store before any chat mounts. Returns
 *  an empty map outside Electron (no persistence available). */
export async function listChatScrollPositions(): Promise<Record<string, number>> {
  if (!isElectron()) return {};
  return nativeInvoke<Record<string, number>>(
    "agent_history_list_chat_scroll_positions",
  );
}

// ── Chat list (sidebar metadata) — SQLite-backed ──────────

/** Wire shape mirrors the SQLite chats row. The renderer translates
 *  to/from the in-memory ChatThread shape because store.tsx is the
 *  single source of truth on field types (booleans, optional fields). */
export interface ChatRowWire {
  id: string;
  folder: string;
  agentId: string | null;
  agentName: string | null;
  model: string | null;
  effort: string;
  permissionMode: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  sessionId: string | null;
  pinned: boolean;
  archived: boolean;
  sourceChatId: string | null;
}

export async function dbListChats(): Promise<ChatRowWire[]> {
  if (!isElectron()) return [];
  return nativeInvoke<ChatRowWire[]>("chats_list");
}

export async function dbUpsertChat(chat: ChatRowWire): Promise<void> {
  if (!isElectron()) return;
  await nativeInvoke<void>("chats_upsert", { chat });
}

export async function dbDeleteChat(id: string): Promise<void> {
  if (!isElectron()) return;
  await nativeInvoke<void>("chats_delete", { id });
}

export async function dbReplaceAllChats(chats: ChatRowWire[]): Promise<void> {
  if (!isElectron()) return;
  await nativeInvoke<void>("chats_replace_all", { chats });
}
