// ──────────────────────────────────────────────────────────
// InferredQuestion — quick-reply hint after an agent's `?`
// ──────────────────────────────────────────────────────────
//
// Roadmap §2.4.9 — inferred non-blocking question path. Most agents
// (Codex, Cursor, Copilot, Droid, OpenCode, sometimes Claude) end a
// turn with a clarifying question as plain assistant text rather than
// firing a structured `AskUserQuestion` tool. The user has no signal
// that a reply is expected, and tries a few of them just send the
// next prompt blind.
//
// This component renders a small "quick reply" banner *under* the
// last agent text message, but only when the heuristic is confident:
//   - role === "agent"
//   - message.id === ctx.lastMessageId (this is the tail)
//   - !ctx.isStreaming (the turn has finalized)
//   - message.text trim().endsWith("?") OR contains a numbered
//     option list (1) ... 2) ... or 1. ... 2. ...) with 2-5 items
//
// When the text contains parseable options, we render them as
// click-to-reply buttons. Otherwise we just render a discreet hint
// "→ Reply below to continue." so the user knows a reply is expected
// without forcing a UI choice.
//
// On click, we route through `ctx.respondToQuestion` (which dispatches
// the answer as a normal next-turn user prompt — see §2.4.9 inferred
// reply protocol).
// ──────────────────────────────────────────────────────────

import { memo } from "react";
import { CornerDownRight } from "lucide-react";
import type { AgentTextMessage } from "../use-agent-session";
import type { RendererContext } from "./types";
import { Button } from "../../ui";

interface InferredQuestionProps {
  message: AgentTextMessage;
  ctx: RendererContext;
}

/** Conservative heuristic — only fire on confident shape matches.
 *  Returning null when we're not sure is the correct call: the user
 *  can always type a normal reply. We'd rather miss inferring than
 *  paint a question UI on a non-question. */
function shouldInferQuestion(
  message: AgentTextMessage,
  ctx: RendererContext,
): boolean {
  if (message.role !== "agent") return false;
  if (ctx.isStreaming) return false;
  if (ctx.lastMessageId !== message.id) return false;
  const trimmed = message.text.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.endsWith("?")) return true;
  // Option list (`1)`, `1.`, or `- option a)` style) at start of line.
  // Require at least 2 items to avoid false positives on prose.
  const matches = trimmed.match(/^\s*\d+[\.\)]\s+\S/gm);
  return matches !== null && matches.length >= 2;
}

/** Parse numbered options out of an agent text message. Returns up to
 *  5 short option strings (the line content after the marker), or
 *  null if the message doesn't have a clear option list. Conservative
 *  — bails on anything that doesn't look like a clean enumeration. */
function parseOptions(text: string): string[] | null {
  const lines = text.split("\n");
  const collected: string[] = [];
  const re = /^\s*\d+[\.\)]\s+(.+?)\s*$/;
  for (const line of lines) {
    const m = re.exec(line);
    if (m && m[1]) {
      // Trim trailing punctuation users wouldn't include in a reply.
      const opt = m[1].replace(/[\.\?:;,]+$/, "").trim();
      // Skip absurdly long lines — those are paragraphs, not options.
      if (opt.length > 0 && opt.length <= 80) collected.push(opt);
    }
  }
  if (collected.length < 2 || collected.length > 5) return null;
  return collected;
}

export const InferredQuestion = memo(function InferredQuestion({
  message,
  ctx,
}: InferredQuestionProps) {
  if (!shouldInferQuestion(message, ctx)) return null;

  const options = parseOptions(message.text);

  return (
    <div className="oc-agent-inferred-question">
      <div className="oc-agent-inferred-question-hint">
        <CornerDownRight className="w-3.5 h-3.5" />
        <span>
          {options && options.length > 0
            ? "Pick one to reply, or type below."
            : "Reply below to continue."}
        </span>
      </div>
      {options && options.length > 0 && (
        <div className="oc-agent-inferred-question-options">
          {options.map((opt, i) => (
            <Button
              key={i}
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => ctx.respondToQuestion(opt)}
              className="oc-agent-inferred-question-opt"
            >
              {opt}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
});
