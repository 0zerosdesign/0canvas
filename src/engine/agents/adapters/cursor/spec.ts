// ──────────────────────────────────────────────────────────
// Cursor Agent spec
// ──────────────────────────────────────────────────────────
//
// Cursor's stream-json schema is close enough to Claude's that we
// reuse ClaudeStreamTranslator. The envelope (system/user/assistant/
// result) and the `tool_use` content-block shape match; only the tool
// names diverge — Cursor emits `shellToolCall` / `readToolCall` /
// `editToolCall` / `writeToolCall` / `grepToolCall` / `globToolCall` /
// `todoToolCall` / `updateTodosToolCall` instead of Claude's `Bash` /
// `Read` / etc. The shared `mapToolKind` / `describeTool` /
// `computeMergeKey` helpers in claude/translator.ts (Stage 7.2)
// recognize both name sets, so Cursor tool calls render through the
// same Shell / Read / Edit / Search / Plan cards as Claude's.
//
// Auth: ~/.cursor/cli-config.json (probed in registry). Permissions
// are not routed through hooks — Cursor has its own approval config.
// ──────────────────────────────────────────────────────────

import type { StreamJsonAgentSpec } from "../shared";
import type { ContentBlock, InitializeResponse } from "../../../../zeros/bridge/agent-events";

import { ClaudeStreamTranslator } from "../claude/translator";

interface CursorExtra {
  /** Cursor-side session id captured from stream-json init. */
  cursorSessionId: string | null;
}

export const cursorSpec: StreamJsonAgentSpec<CursorExtra> = {
  agentId: "cursor",
  agentName: "Cursor Agent",
  protocolVersion: 1,
  cliBinary: "cursor-agent",
  modes: {
    defaultId: "default",
    available: [{ modeId: "default", name: "Default" }] as never,
  },

  async initSessionExtra() {
    return { cursorSessionId: null };
  },

  buildPromptArgs({ state, promptText }) {
    // `--trust` is required for non-interactive runs; without it
    // cursor-agent prints a workspace-trust prompt and exits before
    // emitting any stream-json. The auth dot is green (creds exist)
    // but every prompt fails with "Error: command failed unexpectedly"
    // — so a missing flag here looked like a transient subprocess bug.
    //
    // `--model auto` is the only model all plan tiers can use. Without
    // it, Cursor defaults to "Composer 2 Fast" which free-plan accounts
    // can't access; cursor-agent then exits non-zero with a stderr-only
    // error ("Named models unavailable. Free plans can only use Auto…")
    // that surfaces in the chat as a generic CLI-exit failure. We pin
    // to "auto" so first-run works for everyone; users who want a
    // specific model can switch via the model picker once we wire it.
    const args = [
      "-p",
      promptText,
      "--output-format",
      "stream-json",
      "--stream-partial-output",
      "--trust",
      "--model",
      "auto",
    ];
    if (state.extra.cursorSessionId) {
      args.push("--resume", state.extra.cursorSessionId);
    }
    return args;
  },

  formatPromptText(blocks: ContentBlock[]): string {
    const parts: string[] = [];
    for (const b of blocks) {
      const block = b as unknown as { type?: string; text?: string };
      if (block.type === "text" && typeof block.text === "string") {
        parts.push(block.text);
      }
    }
    return parts.join("\n\n");
  },

  createTranslator({ sessionId, emit, state }) {
    const inner = new ClaudeStreamTranslator({
      sessionId,
      emit,
      onUnknown: () => {
        /* benign */
      },
    });
    (state.extra as CursorExtra & { _t?: ClaudeStreamTranslator })._t = inner;
    return {
      feed: (obj) => inner.feed(obj),
      get sawTerminal() {
        return inner.sawResult;
      },
      get stopReason() {
        return inner.stopReason;
      },
    };
  },

  captureAfterPrompt({ state }) {
    const t = (state.extra as CursorExtra & { _t?: ClaudeStreamTranslator })._t;
    const sid = t?.claudeSessionId ?? null;
    if (sid && !state.extra.cursorSessionId) {
      state.extra.cursorSessionId = sid;
    }
  },

  buildInitializeResponse(): InitializeResponse {
    return {
      protocolVersion: 1 as never,
      agentInfo: { name: "Cursor Agent", version: "native" } as never,
      agentCapabilities: {
        loadSession: { enabled: true } as never,
        promptCapabilities: {
          image: false,
          audio: false,
          embeddedContext: false,
        } as never,
        mcpCapabilities: { http: false, sse: false } as never,
        sessionCapabilities: { list: {} } as never,
      } as never,
      authMethods: [
        {
          id: "terminal",
          name: "Sign in via Terminal",
          description: "Open Terminal.app and run `cursor-agent login`.",
        },
      ] as never,
    };
  },
};
