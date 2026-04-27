// ──────────────────────────────────────────────────────────
// Claude Code spec
// ──────────────────────────────────────────────────────────
//
// The pilot — most-featured of the bunch:
//   - Hook injection via `--settings <file>` (Claude's first-class flag
//     for layering extra settings on top of the user's). We point it at
//     a session-private hooks file under the session env dir; Claude
//     itself still reads ~/.claude for credentials.
//   - Modes: default / plan / accept-edits → --permission-mode
//   - Session resume: our UUID via --session-id (first turn) /
//     --resume (subsequent turns)
//   - Transcript replay on loadSession (Claude's own on-disk JSONL)
//
// History note: an earlier version of this spec overrode
// CLAUDE_CONFIG_DIR for hook injection. That env var also disables
// Claude's macOS Keychain reads — so keychain-auth users (the default
// for `claude /login`) saw "Not logged in · Please run /login" even
// when their auth probe was green. The defensive auth-file copy that
// papered over it could not help users whose creds existed only in
// the keychain. Switching to `--settings` keeps Claude's auth path
// stock and ships zero credential plumbing on our side.
//
// ──────────────────────────────────────────────────────────

import * as fsp from "node:fs/promises";
import * as path from "node:path";

import type { StreamJsonAgentSpec } from "../shared";
import type { ContentBlock, InitializeResponse } from "../../../../zeros/bridge/agent-events";
import type { HookEvent, HookResponse } from "../../types";
import { ClaudeStreamTranslator } from "./translator";
import { installClaudeHooks } from "./hooks";
import { replayTranscript } from "./history";

interface ClaudeExtra {
  /** Path to the session-private settings.json that holds our hook
   *  config. Passed to `claude` via `--settings <path>`. */
  settingsPath: string;
  /** Hook server token for this session. */
  hookToken: string;
  /** Selected permission mode, applied as --permission-mode on next
   *  spawn. setMode persists into here. */
  permissionMode: "default" | "plan" | "accept-edits";
}

export const claudeSpec: StreamJsonAgentSpec<ClaudeExtra> = {
  agentId: "claude-acp",
  agentName: "Claude Code",
  protocolVersion: 1,
  cliBinary: "claude",
  modes: {
    defaultId: "default",
    available: [
      { modeId: "default", name: "Default" },
      { modeId: "plan", name: "Plan" },
      { modeId: "accept-edits", name: "Accept Edits" },
    ] as never,
  },

  async initSessionExtra({ sessionId, hookToken, hookUrl }) {
    // Session-private dir for our hooks settings file. We do NOT set
    // CLAUDE_CONFIG_DIR — see header — so Claude's own ~/.claude
    // (creds, project memory, user settings) is left alone.
    const { ensureSessionDir } = await import("../../session-paths");
    const dirs = await ensureSessionDir(sessionId);
    const settingsDir = path.join(dirs.env, "claude");
    await fsp.mkdir(settingsDir, { recursive: true });

    const settingsPath = await installClaudeHooks({
      configDir: settingsDir,
      hookUrl,
      token: hookToken,
      sessionId,
    });

    return {
      settingsPath,
      hookToken,
      permissionMode: "default",
    };
  },

  buildPromptArgs({ state, promptText }) {
    const args = [
      "-p",
      promptText,
      "--output-format",
      "stream-json",
      "--verbose",
      "--settings",
      state.extra.settingsPath,
      "--permission-mode",
      state.extra.permissionMode,
    ];
    if (state.primed) {
      args.push("--resume", state.sessionId);
    } else {
      args.push("--session-id", state.sessionId);
    }
    return args;
  },

  formatPromptText(blocks: ContentBlock[]): string {
    const parts: string[] = [];
    for (const b of blocks) {
      const block = b as unknown as {
        type?: string;
        text?: string;
        source?: { type?: string; media_type?: string; data?: string; url?: string };
        mimeType?: string;
        data?: string;
        uri?: string;
      };
      if (block.type === "text" && typeof block.text === "string") {
        parts.push(block.text);
        continue;
      }
      if (block.type === "image") {
        const src = block.source;
        if (src?.data && src?.media_type) {
          parts.push(`![image](data:${src.media_type};base64,${src.data})`);
        } else if (src?.url) {
          parts.push(`![image](${src.url})`);
        } else if (block.data && block.mimeType) {
          parts.push(`![image](data:${block.mimeType};base64,${block.data})`);
        }
        continue;
      }
      if (block.type === "resource_link" && typeof block.uri === "string") {
        parts.push(`@${block.uri.replace(/^file:\/\//, "")}`);
      }
    }
    return parts.join("\n\n");
  },

  createTranslator({ sessionId, emit }) {
    const inner = new ClaudeStreamTranslator({
      sessionId,
      emit,
      onUnknown: () => {
        /* benign — Claude evolves stream-json schema */
      },
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

  setMode({ state, modeId }) {
    if (
      modeId === "default" ||
      modeId === "plan" ||
      modeId === "accept-edits"
    ) {
      state.extra.permissionMode = modeId;
    }
  },

  async handleHook({ event, escalator }): Promise<HookResponse> {
    switch (event.name) {
      case "PreToolUse": {
        const payload = event.payload as Record<string, unknown> | null;
        const toolName =
          typeof payload?.tool_name === "string"
            ? (payload.tool_name as string)
            : "tool";
        const decision = await escalator.request({
          toolUseId:
            typeof payload?.tool_use_id === "string"
              ? (payload.tool_use_id as string)
              : `${Date.now()}`,
          toolName,
          toolInput: payload?.tool_input,
        });
        return {
          status: 200,
          body: {
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: decision,
            },
          },
        };
      }
      case "PostToolUse":
      case "Stop":
      case "Notification":
      case "SessionEnd":
      default:
        return { status: 200 };
    }
  },

  async loadSession({ sessionId, ctx, emit }) {
    const dirs = await (
      await import("../../session-paths")
    ).ensureSessionDir(sessionId);
    const settingsDir = path.join(dirs.env, "claude");
    await fsp.mkdir(settingsDir, { recursive: true });

    // The base adapter has already registered hook routing for this
    // sessionId before calling us — we only need to write settings.json
    // pointing at it. Re-register here too because base's loadSession
    // skips registration when the session was already in its map (e.g.
    // we'd been creating + saving + reloading in the same process).
    const { token } = ctx.hookServer.registerSession(sessionId, () =>
      Promise.resolve({ status: 200 }),
    );
    const settingsPath = await installClaudeHooks({
      configDir: settingsDir,
      hookUrl: ctx.hookServer.url,
      token,
      sessionId,
    });

    // Stream Claude's on-disk transcript back as historical
    // SessionNotifications so the UI sees prior turns.
    await replayTranscript({ sessionId, emit });

    return {
      response: {},
      extra: {
        settingsPath,
        hookToken: token,
        permissionMode: "default" as const,
      },
    };
  },

  buildInitializeResponse(): InitializeResponse {
    return {
      protocolVersion: 1 as never,
      agentInfo: { name: "Claude Code", version: "native" } as never,
      agentCapabilities: {
        loadSession: { enabled: true } as never,
        promptCapabilities: {
          image: true,
          audio: false,
          embeddedContext: true,
        } as never,
        mcpCapabilities: { http: true, sse: false } as never,
        sessionCapabilities: { list: {} } as never,
      } as never,
      authMethods: [
        {
          id: "terminal",
          name: "Sign in via Terminal",
          description: "Open Terminal.app and run `claude /login`.",
        },
      ] as never,
    };
  },
};
