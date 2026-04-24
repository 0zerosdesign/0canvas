// ──────────────────────────────────────────────────────────
// Claude JSONL transcript replay
// ──────────────────────────────────────────────────────────
//
// Each Claude session writes `~/.claude/projects/<project-hash>/<session-id>.jsonl`
// with one JSON record per line describing the whole conversation.
// Record shapes (as of claude-code 0.31):
//
//   {"type":"user","uuid":"...","parentUuid":"...","timestamp":"...","sessionId":"...","cwd":"...","message":{"role":"user","content":"..."}}
//   {"type":"assistant","uuid":"...","message":{"role":"assistant","content":[{type:"text",...},{type:"thinking",...},{type:"tool_use",id,name,input}]}}
//   {"type":"tool_result","toolUseResult":{tool_use_id,content,is_error}}
//   {"type":"system","subtype":...}
//   {"type":"summary"} / {"type":"result"} / {"type":"file-history-snapshot"}
//
// For loadSession we replay the transcript into SessionNotification
// events so the chat UI shows prior turns. Project-hash discovery:
// Claude hashes the working directory to pick the subfolder; we scan
// all subfolders for the target session-id.
//
// ──────────────────────────────────────────────────────────

import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

import type { ContentBlock, SessionNotification } from "../../types";

type Emit = (notification: SessionNotification) => void;

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

export interface ReplayHandlers {
  emit: Emit;
  sessionId: string;
  /** Override Claude's `projects` root (tests). */
  projectsRoot?: string;
}

/**
 * Locate the JSONL transcript for a given Claude session id by
 * scanning `~/.claude/projects/<hash>/<session-id>.jsonl`. Returns
 * the full path or null.
 */
export async function findTranscript(
  sessionId: string,
  projectsRoot: string = CLAUDE_PROJECTS_DIR,
): Promise<string | null> {
  let entries: string[];
  try {
    entries = await fsp.readdir(projectsRoot);
  } catch {
    return null;
  }
  const filename = `${sessionId}.jsonl`;
  for (const dir of entries) {
    const candidate = path.join(projectsRoot, dir, filename);
    try {
      const stat = await fsp.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      /* continue */
    }
  }
  return null;
}

/**
 * Read the transcript file and emit SessionNotification events for
 * every user/assistant message + tool use. Idempotent: safe to call
 * on loadSession; caller decides whether to replay (usually yes on
 * first load of a session that already has history on disk).
 */
export async function replayTranscript(opts: ReplayHandlers): Promise<void> {
  const transcriptPath = await findTranscript(
    opts.sessionId,
    opts.projectsRoot,
  );
  if (!transcriptPath) return;

  let content: string;
  try {
    content = await fsp.readFile(transcriptPath, "utf-8");
  } catch {
    return;
  }

  // Tool-use id → tool-call-id so tool_result events can correlate
  // back to the tool_call we emitted earlier in the replay.
  const toolCallIds = new Map<string, string>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    const type = typeof rec.type === "string" ? rec.type : "";
    switch (type) {
      case "user":
        replayUser(rec, opts, toolCallIds);
        break;
      case "assistant":
        replayAssistant(rec, opts, toolCallIds);
        break;
      case "tool_result":
        replayToolResult(rec, opts, toolCallIds);
        break;
      // system / summary / result / file-history-snapshot — not
      // rendered in chat, skip.
    }
  }
}

function replayUser(
  rec: Record<string, unknown>,
  opts: ReplayHandlers,
  toolCallIds: Map<string, string>,
): void {
  const message = rec.message as { content?: unknown } | undefined;
  const content = message?.content;
  const blocks = Array.isArray(content) ? content : typeof content === "string"
    ? [{ type: "text", text: content }]
    : [];
  const messageId =
    typeof rec.uuid === "string" ? (rec.uuid as string) : randomUUID();

  for (const block of blocks) {
    const b = block as { type?: string; text?: string; tool_use_id?: string; content?: unknown; is_error?: boolean };
    if (b.type === "text" && typeof b.text === "string") {
      opts.emit({
        sessionId: opts.sessionId,
        update: {
          sessionUpdate: "user_message_chunk",
          content: { type: "text", text: b.text } as ContentBlock,
          messageId,
        },
      });
    } else if (b.type === "tool_result" && typeof b.tool_use_id === "string") {
      const toolCallId = toolCallIds.get(b.tool_use_id) ?? b.tool_use_id;
      const text = typeof b.content === "string"
        ? b.content
        : Array.isArray(b.content)
          ? b.content
              .map((c) => (c as { text?: string }).text ?? "")
              .filter(Boolean)
              .join("\n")
          : "";
      opts.emit({
        sessionId: opts.sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId,
          status: b.is_error ? "failed" : "completed",
          rawOutput: b.content,
          content: text
            ? [{ type: "content", content: { type: "text", text } as ContentBlock }]
            : null,
        },
      });
    }
  }
}

function replayAssistant(
  rec: Record<string, unknown>,
  opts: ReplayHandlers,
  toolCallIds: Map<string, string>,
): void {
  const message = rec.message as { content?: unknown } | undefined;
  const blocks = Array.isArray(message?.content) ? message!.content as unknown[] : [];
  const messageId =
    typeof rec.uuid === "string" ? (rec.uuid as string) : randomUUID();

  for (const block of blocks) {
    const b = block as {
      type?: string;
      text?: string;
      thinking?: string;
      id?: string;
      name?: string;
      input?: unknown;
    };
    if (b.type === "thinking" && typeof b.thinking === "string") {
      opts.emit({
        sessionId: opts.sessionId,
        update: {
          sessionUpdate: "agent_thought_chunk",
          content: { type: "text", text: b.thinking } as ContentBlock,
          messageId,
        },
      });
    } else if (b.type === "text" && typeof b.text === "string") {
      opts.emit({
        sessionId: opts.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: b.text } as ContentBlock,
          messageId,
        },
      });
    } else if (
      b.type === "tool_use" &&
      typeof b.id === "string" &&
      typeof b.name === "string"
    ) {
      const toolCallId = randomUUID();
      toolCallIds.set(b.id, toolCallId);
      opts.emit({
        sessionId: opts.sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId,
          title: b.name,
          kind: "other" as never,
          status: "completed",
          rawInput: b.input,
        },
      });
    }
  }
}

function replayToolResult(
  rec: Record<string, unknown>,
  opts: ReplayHandlers,
  toolCallIds: Map<string, string>,
): void {
  const r = (rec as { toolUseResult?: {
    tool_use_id?: string;
    content?: unknown;
    is_error?: boolean;
  } }).toolUseResult;
  if (!r?.tool_use_id) return;
  const toolCallId = toolCallIds.get(r.tool_use_id) ?? r.tool_use_id;
  const text = typeof r.content === "string" ? r.content : "";
  opts.emit({
    sessionId: opts.sessionId,
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId,
      status: r.is_error ? "failed" : "completed",
      rawOutput: r.content,
      content: text
        ? [{ type: "content", content: { type: "text", text } as ContentBlock }]
        : null,
    },
  });
}
