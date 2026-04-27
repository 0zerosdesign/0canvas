// ──────────────────────────────────────────────────────────
// Cursor Agent spec
// ──────────────────────────────────────────────────────────
//
// Cursor's stream-json schema is structurally different from Claude's
// (Stage 7.3 verified against real cursor-agent 2026.04.17 output):
// top-level `tool_call` events instead of inline `tool_use` content
// blocks, top-level `thinking` events, no message ids on text deltas.
// The dedicated `CursorStreamTranslator` handles all of those — see
// translator.ts for the schema notes.
//
// Auth: ~/.cursor/cli-config.json (probed in registry). Permissions
// are not routed through hooks — Cursor has its own approval config.
// ──────────────────────────────────────────────────────────

import type { StreamJsonAgentSpec } from "../shared";
import type { ContentBlock, InitializeResponse } from "../../../../zeros/bridge/agent-events";

import { CursorStreamTranslator } from "./translator";

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
    //
    // We *do not* pass `--stream-partial-output`. Stage 7.3 verified
    // that flag causes cursor-agent to emit each text segment twice —
    // once as the streaming draft, once as the finalized chunk — which
    // surfaced in the chat as duplicated paragraphs. Without the flag,
    // text still streams in chunks (one chunk per logical segment of
    // the reply); we just lose token-level streaming, which is fine.
    const args = [
      "-p",
      promptText,
      "--output-format",
      "stream-json",
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
    const inner = new CursorStreamTranslator({
      sessionId,
      emit,
      onUnknown: () => {
        /* benign */
      },
    });
    (state.extra as CursorExtra & { _t?: CursorStreamTranslator })._t = inner;
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
    const t = (state.extra as CursorExtra & { _t?: CursorStreamTranslator })._t;
    const sid = t?.cursorSessionId ?? null;
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
