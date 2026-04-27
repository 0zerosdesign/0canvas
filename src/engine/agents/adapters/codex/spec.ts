// ──────────────────────────────────────────────────────────
// Codex CLI spec — declares per-agent quirks for StreamJsonAdapter
// ──────────────────────────────────────────────────────────
//
// Codex's flow:
//   - First prompt: `codex exec <text> --json`
//   - Subsequent:   `codex exec resume <thread-id> <text> --json`
//   - The thread id is captured from the `thread.started` event by
//     CodexStreamTranslator and copied into state.extra after each turn.
//   - No hook system; Codex enforces sandboxing/approval via its own
//     `~/.codex/config.toml`.
//
// Auth: `~/.codex/auth.json` existence (probed in registry.ts).
//
// ──────────────────────────────────────────────────────────

import type { StreamJsonAgentSpec } from "../shared";
import type { ContentBlock, InitializeResponse } from "../../../../zeros/bridge/agent-events";

import { CodexStreamTranslator } from "./translator";
import { listCodexSessions } from "./history";

/** Codex-specific session state. The base adapter stores this on
 *  `SessionState.extra`. */
interface CodexExtra {
  /** Codex's internal thread id, captured from the translator after
   *  the first successful turn. null until then. Drives --resume. */
  codexThreadId: string | null;
}

export const codexSpec: StreamJsonAgentSpec<CodexExtra> = {
  agentId: "codex",
  agentName: "Codex",
  protocolVersion: 1,
  cliBinary: "codex",

  async initSessionExtra() {
    return { codexThreadId: null };
  },

  buildPromptArgs({ state, promptText }) {
    // Flag order matters: positional prompt comes BEFORE `--json` on
    // resume. Codex's resume parser is stricter than fresh-exec; don't
    // reorder without testing against the live CLI.
    //
    // `--skip-git-repo-check` is unconditional. Codex refuses to run in
    // any directory that isn't a git repo (or marked trusted in
    // ~/.codex/config.toml) — surfacing that as an "Agent error" in our
    // chat is bad UX when the user just wants to try Codex on, say, a
    // fresh notes folder. Conductor and OpenCode both pass this flag for
    // the same reason. The user's safety story is the permission-mode
    // gate (Ask First / Auto-Edit / etc.), not Codex's own untrusted-dir
    // check.
    //
    // Model selection: the renderer's model picker writes
    // OPENAI_MODEL into state.env (catalogs/models-v1.json convention).
    // Codex CLI itself doesn't read OPENAI_MODEL — it only honors the
    // `--model` flag or ~/.codex/config.toml. Without this translation
    // every model picked in the UI was silently ignored, and codex used
    // whatever default was configured globally (which on older CLI
    // versions returned a "model requires newer version" error for
    // every prompt). Translate env → flag here.
    const threadId = state.extra.codexThreadId;
    const model = state.env?.OPENAI_MODEL;
    const modelArgs = model ? ["--model", model] : [];
    return threadId
      ? [
          "exec",
          "--skip-git-repo-check",
          ...modelArgs,
          "resume",
          threadId,
          promptText,
          "--json",
        ]
      : [
          "exec",
          "--skip-git-repo-check",
          ...modelArgs,
          promptText,
          "--json",
        ];
  },

  formatPromptText(blocks: ContentBlock[]): string {
    // Codex doesn't accept image / resource_link blocks via exec — only
    // plain text reaches the model. Drop everything else silently; the
    // UI surfaces unsupported blocks via the prompt-capabilities flag.
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
    const inner = new CodexStreamTranslator({
      sessionId,
      emit,
      onUnknown: () => {
        /* benign — Codex adds new event types over time */
      },
    });
    // Stash for captureAfterPrompt to read the threadId out cleanly.
    (state.extra as CodexExtra & { _t?: CodexStreamTranslator })._t = inner;
    return {
      feed: (obj) => inner.feed(obj),
      get sawTerminal() {
        return inner.sawTurnTerminal;
      },
      get stopReason() {
        return inner.stopReason;
      },
    };
  },

  captureAfterPrompt({ state }) {
    const t = (state.extra as CodexExtra & { _t?: CodexStreamTranslator })._t;
    const next = t?.codexThreadId ?? null;
    if (next && !state.extra.codexThreadId) {
      state.extra.codexThreadId = next;
    }
  },

  async loadSession({ sessionId, cwd, env }) {
    // Treat opts.sessionId as the Codex thread id — listSessions
    // returned it and the UI stored it. Subsequent prompts use
    // `codex exec resume <thread-id>`.
    return {
      response: {},
      extra: { codexThreadId: sessionId },
    };
  },

  async listSessions({ cwd }) {
    return listCodexSessions({ cwd });
  },

  buildInitializeResponse(): InitializeResponse {
    return {
      protocolVersion: 1 as never,
      agentInfo: { name: "Codex", version: "native" } as never,
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
          description: "Open Terminal.app and run `codex login`.",
        },
      ] as never,
    };
  },
};
