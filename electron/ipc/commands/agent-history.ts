// ──────────────────────────────────────────────────────────
// IPC commands: agent-history (Phase 0 step 4)
// ──────────────────────────────────────────────────────────
//
// Thin wrappers over electron/db.ts. The renderer batches writes
// per animation frame and calls these via window.__ZEROS_NATIVE__.
// All payloads are pre-stringified JSON; the DB stores opaque
// blobs so the schema doesn't churn as the message shape evolves.
//
// Read amplification is deliberate: the windowMessages handler
// returns ALL fields the renderer needs in one call, so the chat
// view hydrates from a single round-trip on mount.
//
// ──────────────────────────────────────────────────────────

import {
  clearChat,
  getChatMeta,
  listChats,
  upsertChatMeta,
  upsertMessagesBulk,
  windowMessages,
  type PersistedMessage,
} from "../../db";
import type { CommandHandler } from "../router";

function requireString(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`agent_history: missing required string '${key}'`);
  }
  return v;
}

function optionalString(
  args: Record<string, unknown>,
  key: string,
): string | null {
  const v = args[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function requireNumber(args: Record<string, unknown>, key: string): number {
  const v = args[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`agent_history: missing required number '${key}'`);
  }
  return v;
}

/** agent_history_append — append (or upsert) a batch of messages.
 *  Inputs:
 *    chatId:  string
 *    items:   Array<{ msgId, kind, payload (string), createdAt }>
 *  No return value. Errors propagate to the renderer's awaited invoke. */
export const agentHistoryAppend: CommandHandler = (args) => {
  const chatId = requireString(args, "chatId");
  const raw = args.items;
  if (!Array.isArray(raw)) {
    throw new Error("agent_history_append: 'items' must be an array");
  }
  const items: PersistedMessage[] = raw.map((it, i) => {
    if (!it || typeof it !== "object") {
      throw new Error(`agent_history_append: items[${i}] not an object`);
    }
    const obj = it as Record<string, unknown>;
    return {
      msgId: requireString(obj, "msgId"),
      kind: requireString(obj, "kind"),
      payload: requireString(obj, "payload"),
      createdAt: requireNumber(obj, "createdAt"),
    };
  });
  upsertMessagesBulk(chatId, items);
};

/** agent_history_window — fetch the most recent `limit` messages
 *  (oldest first), optionally before an `ord` cursor for older pages.
 *  Inputs:
 *    chatId:  string
 *    limit:   number
 *    before?: number (ord exclusive upper bound)
 *  Returns: PersistedMessage[] */
export const agentHistoryWindow: CommandHandler = (args) => {
  const chatId = requireString(args, "chatId");
  const limit = requireNumber(args, "limit");
  const before =
    typeof args.before === "number" && Number.isFinite(args.before)
      ? args.before
      : undefined;
  return windowMessages(chatId, limit, before);
};

/** agent_history_clear_chat — delete a chat's transcript and metadata. */
export const agentHistoryClearChat: CommandHandler = (args) => {
  const chatId = requireString(args, "chatId");
  clearChat(chatId);
};

/** agent_history_set_chat_meta — upsert agent id / session id / etc. */
export const agentHistorySetChatMeta: CommandHandler = (args) => {
  const chatId = requireString(args, "chatId");
  upsertChatMeta({
    chatId,
    agentId: optionalString(args, "agentId"),
    agentName: optionalString(args, "agentName"),
    sessionId: optionalString(args, "sessionId"),
    updatedAt: Date.now(),
  });
};

/** agent_history_get_chat_meta — read the metadata row, or null. */
export const agentHistoryGetChatMeta: CommandHandler = (args) => {
  const chatId = requireString(args, "chatId");
  return getChatMeta(chatId);
};

/** agent_history_list_chats — every chat with rows on disk. Used by
 *  the hydration boot path to seed the store before bridge connect. */
export const agentHistoryListChats: CommandHandler = () => {
  return listChats();
};
