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
