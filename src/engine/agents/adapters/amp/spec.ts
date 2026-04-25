// ──────────────────────────────────────────────────────────
// Amp (Sourcegraph) spec
// ──────────────────────────────────────────────────────────
// Headless `amp -x <prompt> --stream-json`. No documented resume flag,
// so each turn is a fresh invocation; the chat UI owns the transcript.
// Stream-json schema mirrors Claude's — reuse ClaudeStreamTranslator.
// ──────────────────────────────────────────────────────────

import type { StreamJsonAgentSpec } from "../shared";
import type { ContentBlock, InitializeResponse } from "@agentclientprotocol/sdk";
import { ClaudeStreamTranslator } from "../claude/translator";

interface AmpExtra {
  /* Amp has no per-session extra state today. */
}

export const ampSpec: StreamJsonAgentSpec<AmpExtra> = {
  agentId: "amp-acp",
  agentName: "Amp",
  protocolVersion: 1,
  cliBinary: "amp",
  modes: {
    defaultId: "default",
    available: [{ modeId: "default", name: "Default" }] as never,
  },

  async initSessionExtra() {
    return {};
  },

  buildPromptArgs({ promptText }) {
    return ["-x", promptText, "--stream-json"];
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

  createTranslator({ sessionId, emit }) {
    const inner = new ClaudeStreamTranslator({
      sessionId,
      emit,
      onUnknown: () => {},
    });
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

  buildInitializeResponse(): InitializeResponse {
    return {
      protocolVersion: 1 as never,
      agentInfo: { name: "Amp", version: "native" } as never,
      agentCapabilities: {
        loadSession: { enabled: false } as never,
        promptCapabilities: {
          image: false,
          audio: false,
          embeddedContext: false,
        } as never,
        mcpCapabilities: { http: false, sse: false } as never,
      } as never,
      authMethods: [
        {
          id: "terminal",
          name: "Sign in via Terminal",
          description: "Open Terminal.app and run `amp login`.",
        },
      ] as never,
    };
  },
};
