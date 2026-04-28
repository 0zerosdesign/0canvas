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
  deleteChatPlan,
  deleteChatPolicy,
  deleteChatRow,
  getChatMeta,
  getChatPlan,
  listAllChats,
  listChatPolicies,
  listChats,
  replaceAllChats,
  upsertChatMeta,
  upsertChatPlan,
  upsertChatPolicy,
  upsertChatRow,
  upsertMessagesBulk,
  windowMessages,
  type ChatRow,
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

// ── Per-chat permission policies — fix #2 ──────────────────

export const agentHistoryListPolicies: CommandHandler = (args) => {
  const chatId = requireString(args, "chatId");
  return listChatPolicies(chatId);
};

export const agentHistoryUpsertPolicy: CommandHandler = (args) => {
  const chatId = requireString(args, "chatId");
  const policyId = requireString(args, "policyId");
  const payload = requireString(args, "payload");
  upsertChatPolicy(chatId, {
    policyId,
    payload,
    createdAt: Date.now(),
  });
};

export const agentHistoryDeletePolicy: CommandHandler = (args) => {
  const chatId = requireString(args, "chatId");
  const policyId = requireString(args, "policyId");
  deleteChatPolicy(chatId, policyId);
};

// ── Per-chat plan snapshot — fix #3 ────────────────────────

export const agentHistoryGetPlan: CommandHandler = (args) => {
  const chatId = requireString(args, "chatId");
  return getChatPlan(chatId);
};

export const agentHistoryUpsertPlan: CommandHandler = (args) => {
  const chatId = requireString(args, "chatId");
  const payload = requireString(args, "payload");
  upsertChatPlan(chatId, { payload, updatedAt: Date.now() });
};

export const agentHistoryDeletePlan: CommandHandler = (args) => {
  const chatId = requireString(args, "chatId");
  deleteChatPlan(chatId);
};

// ── Chat list (sidebar metadata) ────────────────────────────

function parseChatRow(raw: unknown, label: string): ChatRow {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${label}: row not an object`);
  }
  const obj = raw as Record<string, unknown>;
  const optStr = (k: string): string | null => {
    const v = obj[k];
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  return {
    id: requireString(obj, "id"),
    folder: typeof obj.folder === "string" ? obj.folder : "",
    agentId: optStr("agentId"),
    agentName: optStr("agentName"),
    model: optStr("model"),
    effort: typeof obj.effort === "string" ? obj.effort : "medium",
    permissionMode:
      typeof obj.permissionMode === "string" ? obj.permissionMode : "ask",
    title: typeof obj.title === "string" ? obj.title : "",
    createdAt: requireNumber(obj, "createdAt"),
    updatedAt: requireNumber(obj, "updatedAt"),
    sessionId: optStr("sessionId"),
    pinned: obj.pinned === true,
    archived: obj.archived === true,
    sourceChatId: optStr("sourceChatId"),
  };
}

export const chatsList: CommandHandler = () => {
  return listAllChats();
};

export const chatsUpsert: CommandHandler = (args) => {
  const row = parseChatRow(args.chat, "chats_upsert");
  upsertChatRow(row);
};

export const chatsDelete: CommandHandler = (args) => {
  const id = requireString(args, "id");
  deleteChatRow(id);
  // Wipe the chat's transcript + meta + plan + policies too — keeping
  // these around after the user deletes the chat from the sidebar would
  // be a slow leak in agent_messages.
  clearChat(id);
  deleteChatPlan(id);
};

export const chatsReplaceAll: CommandHandler = (args) => {
  const raw = args.chats;
  if (!Array.isArray(raw)) {
    throw new Error("chats_replace_all: 'chats' must be an array");
  }
  const rows = raw.map((r, i) => parseChatRow(r, `chats_replace_all[${i}]`));
  replaceAllChats(rows);
};
