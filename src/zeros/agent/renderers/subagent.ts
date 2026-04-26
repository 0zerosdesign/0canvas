// ──────────────────────────────────────────────────────────
// subagent — detect a parent agent delegating to a child
// ──────────────────────────────────────────────────────────
//
// A delegation shows up in the stream as a regular ToolCall.
// claude-agent-sdk's built-in is "Task"; other agents name it
// differently. Match permissively by title or by rawInput
// carrying a subagent_type key.
//
// Extracted from agent-chat.tsx in Phase 0; behavior unchanged.
//
// ──────────────────────────────────────────────────────────

import type { AgentToolMessage } from "../use-agent-session";

const SUBAGENT_TITLE_PATTERN = /^(task|spawn_?agent|delegate|subagent)$/i;

export interface SubagentInfo {
  /** Which subagent role the parent agent is invoking, if declared. */
  subagentType?: string;
  /** One-line description of the job the parent handed off. */
  description?: string;
}

export function matchSubagent(tool: AgentToolMessage): SubagentInfo | null {
  if (SUBAGENT_TITLE_PATTERN.test(tool.title)) {
    const input = tool.rawInput as
      | { subagent_type?: string; description?: string; prompt?: string }
      | undefined;
    return {
      subagentType: input?.subagent_type,
      description:
        input?.description ??
        (typeof input?.prompt === "string" ? input.prompt.slice(0, 160) : undefined),
    };
  }
  const input = tool.rawInput as
    | { subagent_type?: string; description?: string }
    | undefined;
  if (input && typeof input.subagent_type === "string") {
    return {
      subagentType: input.subagent_type,
      description: input.description,
    };
  }
  return null;
}
