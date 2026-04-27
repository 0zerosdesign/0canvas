// ──────────────────────────────────────────────────────────
// GitHub Copilot CLI spec
// ──────────────────────────────────────────────────────────
//
// `copilot -p <prompt> --output-format json --allow-all-tools \
//          [--add-dir <cwd>] [--resume <sessionId>]`
//
// Stage 8.4 — verified against copilot 1.0.36. The previous adapter
// was a 20KB PTY scraper based on the assumption "Copilot CLI has
// no stream-json output" — which was true at the time of writing
// but no longer is. v1.0.36 ships `--output-format json` (JSONL,
// one event per line) covering the full event lifecycle including
// tool calls, reasoning, and turn boundaries. Switching to the
// StreamJsonAdapter pattern matches every other agent in the
// codebase and lets Copilot tool calls render through the same
// canonical card system.
//
// `--allow-all-tools` is required for non-interactive runs; without
// it Copilot prompts for permission per-tool and the prompt halts
// the subprocess. We rely on Zeros's own permission cluster
// (Stage 6.x) to gate writes; passing this flag here just lets the
// subprocess run to completion so we can surface canonical events.
//
// `--add-dir` adds the cwd to Copilot's allowed-paths list. Without
// it, edits outside Copilot's default cwd silently fail.
//
// Auth: Copilot CLI authenticates via GitHub OAuth — `~/.copilot/`
// holds tokens after `/login` inside the TUI. Headless mode reuses
// the same credentials; we never read or write them.
//
// ──────────────────────────────────────────────────────────

import type { StreamJsonAgentSpec } from "../shared";
import type { ContentBlock, InitializeResponse } from "../../../../zeros/bridge/agent-events";

import { CopilotStreamTranslator } from "./translator";

interface CopilotExtra {
  /** Copilot session id captured from the `result` event. Used as
   *  --resume for follow-up turns so the agent keeps its turn
   *  history without re-bootstrapping the system prompt. */
  copilotSessionId: string | null;
}

export const copilotSpec: StreamJsonAgentSpec<CopilotExtra> = {
  agentId: "github-copilot-cli",
  agentName: "GitHub Copilot CLI",
  protocolVersion: 1,
  cliBinary: "copilot",
  modes: {
    defaultId: "default",
    available: [{ modeId: "default", name: "Default" }] as never,
  },

  async initSessionExtra() {
    return { copilotSessionId: null };
  },

  buildPromptArgs({ state, promptText }) {
    const args = [
      "-p",
      promptText,
      "--output-format",
      "json",
      "--allow-all-tools",
      "--add-dir",
      state.cwd,
    ];
    if (state.extra.copilotSessionId) {
      args.push("--resume", state.extra.copilotSessionId);
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
    const inner = new CopilotStreamTranslator({
      sessionId,
      emit,
      onUnknown: () => {
        /* benign */
      },
    });
    (state.extra as CopilotExtra & { _t?: CopilotStreamTranslator })._t = inner;
    return {
      feed: (obj) => inner.feed(obj),
      get sawTerminal() {
        return inner.sawTerminal;
      },
      get stopReason() {
        return inner.stopReason;
      },
    };
  },

  captureAfterPrompt({ state }) {
    const t = (state.extra as CopilotExtra & { _t?: CopilotStreamTranslator })._t;
    const sid = t?.copilotSessionId ?? null;
    if (sid && !state.extra.copilotSessionId) {
      state.extra.copilotSessionId = sid;
    }
  },

  buildInitializeResponse(): InitializeResponse {
    return {
      protocolVersion: 1 as never,
      agentInfo: { name: "GitHub Copilot CLI", version: "native" } as never,
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
          description:
            "Open Terminal.app, run `copilot`, then `/login` inside the TUI.",
        },
      ] as never,
    };
  },
};
