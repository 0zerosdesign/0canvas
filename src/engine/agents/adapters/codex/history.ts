// ──────────────────────────────────────────────────────────
// Codex rollout JSONL enumeration
// ──────────────────────────────────────────────────────────
//
// Codex sessions are persisted at
// `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl`
// (default CODEX_HOME = ~/.codex). The first line of each rollout is
// a thread metadata record we can parse cheaply to produce the
// SessionInfo entries the UI expects from listSessions.
//
// A rollout begins with:
//   {"type":"thread.metadata","thread_id":"...","created_at":"...","cwd":"...","title":"...",...}
//
// followed by the full transcript (user/assistant/turn records).
// We stat + read just the first non-empty line of each file so
// enumeration stays under a few hundred reads even for heavy users.
//
// ──────────────────────────────────────────────────────────

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import * as readline from "node:readline";

import type { ListSessionsResponse } from "../../types";

function codexHome(): string {
  return process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
}

/**
 * Find every rollout JSONL under $CODEX_HOME/sessions. Walks
 * YYYY/MM/DD subdirs in reverse chronological order so newer
 * sessions appear first.
 */
async function findRolloutFiles(limit: number): Promise<string[]> {
  const root = path.join(codexHome(), "sessions");
  const out: string[] = [];
  let years: string[];
  try {
    years = (await fsp.readdir(root)).filter(nonDot).sort().reverse();
  } catch {
    return out;
  }
  for (const y of years) {
    const yDir = path.join(root, y);
    let months: string[];
    try {
      months = (await fsp.readdir(yDir)).filter(nonDot).sort().reverse();
    } catch { continue; }
    for (const m of months) {
      const mDir = path.join(yDir, m);
      let days: string[];
      try {
        days = (await fsp.readdir(mDir)).filter(nonDot).sort().reverse();
      } catch { continue; }
      for (const d of days) {
        const dDir = path.join(mDir, d);
        let files: string[];
        try {
          files = (await fsp.readdir(dDir)).filter((f) => f.endsWith(".jsonl"));
        } catch { continue; }
        files.sort().reverse();
        for (const f of files) {
          out.push(path.join(dDir, f));
          if (out.length >= limit) return out;
        }
      }
    }
  }
  return out;
}

/** Read the first non-empty line of a file and parse it as JSON. */
async function readFirstLine(file: string): Promise<unknown | null> {
  let stream: Readable;
  try {
    stream = fs.createReadStream(file, { encoding: "utf-8" });
  } catch {
    return null;
  }
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }
  return null;
}

function nonDot(n: string): boolean {
  return !n.startsWith(".");
}

interface RawSessionEntry {
  sessionId: string;
  title?: string;
  createdAt?: number;
  cwd?: string;
}

/**
 * Enumerate recent Codex threads. Returns sessions newest-first,
 * capped at `limit` to keep the scan bounded.
 */
export async function listCodexSessions(
  opts: { cwd?: string; limit?: number } = {},
): Promise<ListSessionsResponse> {
  const limit = opts.limit ?? 50;
  const files = await findRolloutFiles(limit * 2); // oversample; some files may lack thread.metadata

  const sessions: RawSessionEntry[] = [];
  for (const file of files) {
    if (sessions.length >= limit) break;
    const head = await readFirstLine(file);
    if (!head || typeof head !== "object") continue;
    const rec = head as Record<string, unknown>;
    const type = rec.type;
    if (type !== "thread.metadata" && type !== "session_meta") continue;
    const sessionId =
      typeof rec.thread_id === "string" ? (rec.thread_id as string)
      : typeof rec.session_id === "string" ? (rec.session_id as string)
      : null;
    if (!sessionId) continue;

    // Optional cwd filter — skip sessions that weren't in this project.
    const entryCwd = typeof rec.cwd === "string" ? (rec.cwd as string) : undefined;
    if (opts.cwd && entryCwd && entryCwd !== opts.cwd) continue;

    sessions.push({
      sessionId,
      title: typeof rec.title === "string" ? (rec.title as string) : undefined,
      createdAt: typeof rec.created_at === "string"
        ? Date.parse(rec.created_at as string)
        : typeof rec.timestamp === "number"
          ? (rec.timestamp as number)
          : undefined,
      cwd: entryCwd,
    });
  }

  return {
    sessions: sessions.map((s) => ({
      sessionId: s.sessionId,
      title: s.title ?? "Untitled",
      // engine SessionInfo doesn't require createdAt but many
      // clients show it; emit as _meta for forward compat.
      _meta: s.createdAt ? { createdAt: s.createdAt, cwd: s.cwd } : undefined,
    })),
  } as never;
}
