// ──────────────────────────────────────────────────────────
// Zeros Electron — SQLite (better-sqlite3) connection
// ──────────────────────────────────────────────────────────
//
// Phase 0 step 4 of the chat UI rebuild. Persists per-chat
// agent message history so reloads don't blow away the
// transcript and so the silent in-memory `MAX_MESSAGES_PER_CHAT`
// truncation isn't lossy any more — disk is the source of
// truth, the renderer just holds a window.
//
// Schema philosophy (v1):
//   - Append-only `agent_messages` keyed by (chat_id, ord) so
//     a chat is the natural shard. Pagination by `ord DESC`
//     gives us the windowed-view loadback without a sort.
//   - One small `agent_chat_meta` row per chat for agent id /
//     session id / last-seen tracking. Optional today; the
//     window query doesn't depend on it.
//
// Why not relational columns for kind/role/status:
//   The store keeps the message shape evolving (Phase 1 will
//   add per-tool-kind cards). Pinning the schema to today's
//   shape would force a migration on every renderer-side type
//   change. We store the JSON blob and trust the renderer to
//   parse — same trade-off Linear, Slack and Cursor settle on
//   for chat archives.
//
// File location:
//   <userData>/zeros-agent-history.db
// On macOS that's ~/Library/Application Support/Zeros (prod)
// or ~/Library/Application Support/Zeros Dev (dev mode).
//
// ──────────────────────────────────────────────────────────

import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

let db: Database.Database | null = null;

function open(): Database.Database {
  if (db) return db;
  const userData = app.getPath("userData");
  fs.mkdirSync(userData, { recursive: true });
  const file = path.join(userData, "zeros-agent-history.db");
  const handle = new Database(file);
  // Pragmas: WAL for fast concurrent reads while writes commit. Synchronous
  // NORMAL trades a tiny crash-recovery window for a 5-10× write speedup —
  // the worst case is losing the last few unsynced messages on a crash,
  // which the live engine stream will replay anyway.
  handle.pragma("journal_mode = WAL");
  handle.pragma("synchronous = NORMAL");
  handle.pragma("foreign_keys = ON");

  handle.exec(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      chat_id   TEXT NOT NULL,
      ord       INTEGER NOT NULL,
      msg_id    TEXT NOT NULL,
      kind      TEXT NOT NULL,
      payload   TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (chat_id, ord)
    );
    CREATE INDEX IF NOT EXISTS idx_agent_messages_chat_msg
      ON agent_messages(chat_id, msg_id);
    CREATE INDEX IF NOT EXISTS idx_agent_messages_created
      ON agent_messages(chat_id, created_at);

    CREATE TABLE IF NOT EXISTS agent_chat_meta (
      chat_id         TEXT PRIMARY KEY,
      agent_id        TEXT,
      agent_name      TEXT,
      session_id      TEXT,
      updated_at      INTEGER NOT NULL,
      scroll_position INTEGER
    );

    -- Per-chat permission policies ("Always allow X for tool Y").
    -- Phase 1 audit fix #2: was localStorage-only, which silently
    -- failed under quota / private mode. Promoting to SQLite gives
    -- us cross-restart durability + per-chat scoping that matches
    -- the policy domain.
    CREATE TABLE IF NOT EXISTS agent_chat_policies (
      chat_id      TEXT NOT NULL,
      policy_id    TEXT NOT NULL,
      payload      TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      PRIMARY KEY (chat_id, policy_id)
    );

    -- Per-chat plan snapshot. Phase 1 audit fix #3: TodoWrite plans
    -- were live-only, wiped on restart. Single row per chat (latest
    -- replace-semantics snapshot) keeps the plan visible after the
    -- user re-opens the chat.
    CREATE TABLE IF NOT EXISTS agent_chat_plan (
      chat_id     TEXT PRIMARY KEY,
      payload     TEXT NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    -- Chat list (sidebar metadata). Migrated out of localStorage so
    -- (a) we no longer share the 5–10 MB origin quota with UI flags,
    -- and (b) wiping the browser store can't lose the user's chats —
    -- they recover from this table on next boot. localStorage stays
    -- as a sync-boot cache so the sidebar paints without a round-trip,
    -- but SQLite is the source of truth.
    CREATE TABLE IF NOT EXISTS chats (
      id              TEXT PRIMARY KEY,
      folder          TEXT NOT NULL DEFAULT '',
      agent_id        TEXT,
      agent_name      TEXT,
      model           TEXT,
      effort          TEXT NOT NULL DEFAULT 'medium',
      permission_mode TEXT NOT NULL DEFAULT 'ask',
      title           TEXT NOT NULL DEFAULT '',
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,
      session_id      TEXT,
      pinned          INTEGER NOT NULL DEFAULT 0,
      archived        INTEGER NOT NULL DEFAULT 0,
      source_chat_id  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);
  `);

  // Migration: pre-Phase-2 DBs have agent_chat_meta without scroll_position.
  // SQLite ALTER TABLE ADD COLUMN is idempotent only if we guard, so we
  // probe pragma_table_info. Cheap (one row per column), runs once per boot.
  const cols = handle
    .prepare<[], { name: string }>(
      `SELECT name FROM pragma_table_info('agent_chat_meta')`,
    )
    .all();
  if (!cols.some((c) => c.name === "scroll_position")) {
    handle.exec(`ALTER TABLE agent_chat_meta ADD COLUMN scroll_position INTEGER`);
  }

  db = handle;
  return handle;
}

/** Close at process exit. Caller is electron `before-quit`. */
export function closeAgentHistory(): void {
  if (db) {
    try {
      db.close();
    } catch {
      /* best-effort */
    }
    db = null;
  }
}

// ──────────────────────────────────────────────────────────
// Public API — used by IPC handlers
// ──────────────────────────────────────────────────────────

export interface PersistedMessage {
  /** Engine-supplied id (or renderer-side fallback) so upserts replace
   *  the previous row for streaming chunks. */
  msgId: string;
  kind: string;
  /** Pre-serialised JSON payload. The handler stringifies once, the DB
   *  stores once, the renderer parses once on hydrate. */
  payload: string;
  createdAt: number;
}

export interface ChatMeta {
  chatId: string;
  agentId: string | null;
  agentName: string | null;
  sessionId: string | null;
  updatedAt: number;
  /** Last persisted scroll-top of the message list for this chat.
   *  Optional on writes — `upsertChatMeta` leaves the column untouched,
   *  so callers updating only agent/session id don't need to read the
   *  value first. Always present on reads (`null` until the user has
   *  scrolled, or until a pre-Phase-2 row gets its first update). */
  scrollPosition?: number | null;
}

/** Upsert a single message. New messages get a fresh `ord`; messages
 *  with a known msg_id replace the existing row's payload + kind in
 *  place — matters for streaming where the same message id receives
 *  many chunks. */
export function upsertMessage(chatId: string, msg: PersistedMessage): void {
  const handle = open();
  const existing = handle
    .prepare<[string, string], { ord: number }>(
      `SELECT ord FROM agent_messages WHERE chat_id = ? AND msg_id = ? LIMIT 1`,
    )
    .get(chatId, msg.msgId);
  if (existing) {
    handle
      .prepare(
        `UPDATE agent_messages SET kind = ?, payload = ?, created_at = ? WHERE chat_id = ? AND ord = ?`,
      )
      .run(msg.kind, msg.payload, msg.createdAt, chatId, existing.ord);
    return;
  }
  // Append at next ord. SELECT MAX is fine at our scale — the index
  // makes it a single B-tree traversal per chat. If chats ever grow to
  // 100k+ messages we can keep an in-memory counter.
  const maxRow = handle
    .prepare<[string], { max: number | null }>(
      `SELECT MAX(ord) AS max FROM agent_messages WHERE chat_id = ?`,
    )
    .get(chatId);
  const nextOrd = (maxRow?.max ?? 0) + 1;
  handle
    .prepare(
      `INSERT INTO agent_messages (chat_id, ord, msg_id, kind, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(chatId, nextOrd, msg.msgId, msg.kind, msg.payload, msg.createdAt);
}

/** Bulk upsert — wraps N upserts in one transaction. The caller batches
 *  per-frame so writes coalesce with the rAF in the renderer. */
export function upsertMessagesBulk(
  chatId: string,
  messages: PersistedMessage[],
): void {
  if (messages.length === 0) return;
  const handle = open();
  const txn = handle.transaction((items: PersistedMessage[]) => {
    for (const m of items) upsertMessage(chatId, m);
  });
  txn(messages);
}

/** Fetch the last N messages for a chat, oldest first. `before` lets
 *  the renderer paginate older history when the user scrolls up.
 *  Returns rows in chronological order (created_at ASC) so the caller
 *  doesn't have to reverse. */
export function windowMessages(
  chatId: string,
  limit: number,
  before?: number,
): PersistedMessage[] {
  const handle = open();
  // Two-step: fetch the newest `limit` rows by ord (DESC), then return
  // them in ASC order so the renderer can append them tail-end.
  const rows = before
    ? handle
        .prepare<
          [string, number, number],
          { msg_id: string; kind: string; payload: string; created_at: number }
        >(
          `SELECT msg_id, kind, payload, created_at
             FROM agent_messages
             WHERE chat_id = ? AND ord < ?
             ORDER BY ord DESC
             LIMIT ?`,
        )
        .all(chatId, before, limit)
    : handle
        .prepare<
          [string, number],
          { msg_id: string; kind: string; payload: string; created_at: number }
        >(
          `SELECT msg_id, kind, payload, created_at
             FROM agent_messages
             WHERE chat_id = ?
             ORDER BY ord DESC
             LIMIT ?`,
        )
        .all(chatId, limit);
  return rows
    .reverse()
    .map((r) => ({
      msgId: r.msg_id,
      kind: r.kind,
      payload: r.payload,
      createdAt: r.created_at,
    }));
}

/** Phase 2 §2.11.4 — fetch a page of older messages relative to a known
 *  message id. The renderer passes the oldest visible message's id;
 *  we look up its `ord` and return the next `limit` rows below it.
 *  Returns empty if the message id isn't found (chat hydrate edge
 *  case) or if no older rows exist. */
export function windowOlderMessages(
  chatId: string,
  limit: number,
  beforeMsgId: string,
): PersistedMessage[] {
  const handle = open();
  const cursor = handle
    .prepare<[string, string], { ord: number }>(
      `SELECT ord FROM agent_messages WHERE chat_id = ? AND msg_id = ? LIMIT 1`,
    )
    .get(chatId, beforeMsgId);
  if (!cursor) return [];
  return windowMessages(chatId, limit, cursor.ord);
}

/** Wipe a chat's transcript. Used by `reset(chatId)` and chat deletion. */
export function clearChat(chatId: string): void {
  const handle = open();
  const txn = handle.transaction(() => {
    handle.prepare(`DELETE FROM agent_messages WHERE chat_id = ?`).run(chatId);
    handle.prepare(`DELETE FROM agent_chat_meta WHERE chat_id = ?`).run(chatId);
  });
  txn();
}

/** Persist the per-chat metadata row (agent id, session id, last-seen).
 *  Leaves `scroll_position` untouched — the renderer writes that on its
 *  own debounced cadence via `setChatMetaScrollPosition` and would lose
 *  state otherwise (we don't have a fresh top here). */
export function upsertChatMeta(meta: ChatMeta): void {
  const handle = open();
  handle
    .prepare(
      `INSERT INTO agent_chat_meta (chat_id, agent_id, agent_name, session_id, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         agent_id   = excluded.agent_id,
         agent_name = excluded.agent_name,
         session_id = excluded.session_id,
         updated_at = excluded.updated_at`,
    )
    .run(
      meta.chatId,
      meta.agentId,
      meta.agentName,
      meta.sessionId,
      meta.updatedAt,
    );
}

/** Persist just the scroll position for a chat. Called by the renderer
 *  on a 1s debounce while the user scrolls. Upserts so the row exists
 *  even before the agent has bound (chats opened in Picker mode etc.).
 *  Phase 2 §2.11 — closes the comment in sessions-store about SQLite
 *  scroll persistence being a polish item. */
export function setChatMetaScrollPosition(
  chatId: string,
  scrollTop: number,
): void {
  const handle = open();
  handle
    .prepare(
      `INSERT INTO agent_chat_meta (chat_id, updated_at, scroll_position)
       VALUES (?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         scroll_position = excluded.scroll_position`,
    )
    .run(chatId, Date.now(), scrollTop);
}

export function getChatMeta(chatId: string): ChatMeta | null {
  const handle = open();
  const row = handle
    .prepare<
      [string],
      {
        chat_id: string;
        agent_id: string | null;
        agent_name: string | null;
        session_id: string | null;
        updated_at: number;
        scroll_position: number | null;
      }
    >(
      `SELECT chat_id, agent_id, agent_name, session_id, updated_at, scroll_position
         FROM agent_chat_meta WHERE chat_id = ?`,
    )
    .get(chatId);
  if (!row) return null;
  return {
    chatId: row.chat_id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    sessionId: row.session_id,
    updatedAt: row.updated_at,
    scrollPosition: row.scroll_position,
  };
}

/** Enumerate every chat we have rows for. Used by hydrate-on-boot to
 *  warm the store with all known transcripts before the bridge arrives. */
export function listChats(): ChatMeta[] {
  const handle = open();
  const rows = handle
    .prepare<
      [],
      {
        chat_id: string;
        agent_id: string | null;
        agent_name: string | null;
        session_id: string | null;
        updated_at: number;
        scroll_position: number | null;
      }
    >(
      `SELECT chat_id, agent_id, agent_name, session_id, updated_at, scroll_position
         FROM agent_chat_meta ORDER BY updated_at DESC`,
    )
    .all();
  return rows.map((r) => ({
    chatId: r.chat_id,
    agentId: r.agent_id,
    agentName: r.agent_name,
    sessionId: r.session_id,
    updatedAt: r.updated_at,
    scrollPosition: r.scroll_position,
  }));
}

/** Bulk-fetch scroll positions for all chats. Cheaper than `listChats`
 *  when the boot path only needs scroll restoration — one tiny scalar
 *  per chat instead of every meta column. Returns a map; chats with
 *  no saved position simply don't appear in the map. */
export function listChatScrollPositions(): Record<string, number> {
  const handle = open();
  const rows = handle
    .prepare<[], { chat_id: string; scroll_position: number | null }>(
      `SELECT chat_id, scroll_position FROM agent_chat_meta
         WHERE scroll_position IS NOT NULL`,
    )
    .all();
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.scroll_position !== null) out[r.chat_id] = r.scroll_position;
  }
  return out;
}

// ── Per-chat permission policies — fix #2 ────────────────

export interface PersistedPolicy {
  policyId: string;
  /** Opaque blob — JSON-serialized PolicyRule. The renderer owns the
   *  shape; main-side just persists. */
  payload: string;
  createdAt: number;
}

export function listChatPolicies(chatId: string): PersistedPolicy[] {
  const handle = open();
  const rows = handle
    .prepare<
      [string],
      { policy_id: string; payload: string; created_at: number }
    >(
      `SELECT policy_id, payload, created_at
         FROM agent_chat_policies WHERE chat_id = ?
         ORDER BY created_at ASC`,
    )
    .all(chatId);
  return rows.map((r) => ({
    policyId: r.policy_id,
    payload: r.payload,
    createdAt: r.created_at,
  }));
}

export function upsertChatPolicy(chatId: string, p: PersistedPolicy): void {
  const handle = open();
  handle
    .prepare(
      `INSERT INTO agent_chat_policies (chat_id, policy_id, payload, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(chat_id, policy_id) DO UPDATE SET
         payload = excluded.payload,
         created_at = excluded.created_at`,
    )
    .run(chatId, p.policyId, p.payload, p.createdAt);
}

export function deleteChatPolicy(chatId: string, policyId: string): void {
  const handle = open();
  handle
    .prepare(
      `DELETE FROM agent_chat_policies WHERE chat_id = ? AND policy_id = ?`,
    )
    .run(chatId, policyId);
}

// ── Per-chat plan snapshot — fix #3 ──────────────────────

export interface PersistedPlan {
  /** JSON-serialized AgentPlanEntry[]. Single row per chat — replace
   *  semantics matches how every adapter emits plans today. */
  payload: string;
  updatedAt: number;
}

export function getChatPlan(chatId: string): PersistedPlan | null {
  const handle = open();
  const row = handle
    .prepare<[string], { payload: string; updated_at: number }>(
      `SELECT payload, updated_at FROM agent_chat_plan WHERE chat_id = ?`,
    )
    .get(chatId);
  if (!row) return null;
  return { payload: row.payload, updatedAt: row.updated_at };
}

export function upsertChatPlan(chatId: string, p: PersistedPlan): void {
  const handle = open();
  handle
    .prepare(
      `INSERT INTO agent_chat_plan (chat_id, payload, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
    )
    .run(chatId, p.payload, p.updatedAt);
}

export function deleteChatPlan(chatId: string): void {
  const handle = open();
  handle.prepare(`DELETE FROM agent_chat_plan WHERE chat_id = ?`).run(chatId);
}

// ── Chat list (sidebar metadata) ──────────────────────────

export interface ChatRow {
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

interface ChatRowSql {
  id: string;
  folder: string;
  agent_id: string | null;
  agent_name: string | null;
  model: string | null;
  effort: string;
  permission_mode: string;
  title: string;
  created_at: number;
  updated_at: number;
  session_id: string | null;
  pinned: number;
  archived: number;
  source_chat_id: string | null;
}

function rowFromSql(r: ChatRowSql): ChatRow {
  return {
    id: r.id,
    folder: r.folder,
    agentId: r.agent_id,
    agentName: r.agent_name,
    model: r.model,
    effort: r.effort,
    permissionMode: r.permission_mode,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    sessionId: r.session_id,
    pinned: r.pinned !== 0,
    archived: r.archived !== 0,
    sourceChatId: r.source_chat_id,
  };
}

export function listAllChats(): ChatRow[] {
  const handle = open();
  const rows = handle
    .prepare<[], ChatRowSql>(
      `SELECT id, folder, agent_id, agent_name, model, effort, permission_mode,
              title, created_at, updated_at, session_id, pinned, archived,
              source_chat_id
         FROM chats
         ORDER BY updated_at DESC`,
    )
    .all();
  return rows.map(rowFromSql);
}

export function upsertChatRow(row: ChatRow): void {
  const handle = open();
  handle
    .prepare(
      `INSERT INTO chats (id, folder, agent_id, agent_name, model, effort,
                          permission_mode, title, created_at, updated_at,
                          session_id, pinned, archived, source_chat_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         folder          = excluded.folder,
         agent_id        = excluded.agent_id,
         agent_name      = excluded.agent_name,
         model           = excluded.model,
         effort          = excluded.effort,
         permission_mode = excluded.permission_mode,
         title           = excluded.title,
         created_at      = excluded.created_at,
         updated_at      = excluded.updated_at,
         session_id      = excluded.session_id,
         pinned          = excluded.pinned,
         archived        = excluded.archived,
         source_chat_id  = excluded.source_chat_id`,
    )
    .run(
      row.id,
      row.folder,
      row.agentId,
      row.agentName,
      row.model,
      row.effort,
      row.permissionMode,
      row.title,
      row.createdAt,
      row.updatedAt,
      row.sessionId,
      row.pinned ? 1 : 0,
      row.archived ? 1 : 0,
      row.sourceChatId,
    );
}

export function deleteChatRow(id: string): void {
  const handle = open();
  handle.prepare(`DELETE FROM chats WHERE id = ?`).run(id);
}

/** Replace the entire chat list in one transaction. The renderer
 *  treats SQLite as a mirror of state.chats — bulk replace keeps
 *  the table in sync without per-mutation diffing on the JS side. */
export function replaceAllChats(rows: ChatRow[]): void {
  const handle = open();
  const txn = handle.transaction((items: ChatRow[]) => {
    handle.prepare(`DELETE FROM chats`).run();
    for (const r of items) upsertChatRow(r);
  });
  txn(rows);
}
