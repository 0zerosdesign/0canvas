// ──────────────────────────────────────────────────────────
// Factory Droid spec
// ──────────────────────────────────────────────────────────
//
// `droid exec --output-format json <prompt>` — stream-json shape mirrors
// Claude (Droid's hooks are Claude-parity by design). Hooks installed
// into a session-scoped FACTORY_CONFIG_DIR. If Droid uses a different
// env var name for config discovery, hooks silently no-op and the
// stream-json output still works (degraded, not broken).
//
// ──────────────────────────────────────────────────────────

import * as fsp from "node:fs/promises";
import * as path from "node:path";

import type { StreamJsonAgentSpec } from "../shared";
import type { ContentBlock, InitializeResponse } from "../../../../zeros/bridge/agent-events";
import type { HookResponse } from "../../types";
import { ClaudeStreamTranslator } from "../claude/translator";
import { installDroidHooks } from "./hooks";

interface DroidExtra {
  configDir: string;
  hookToken: string;
}

export const droidSpec: StreamJsonAgentSpec<DroidExtra> = {
  agentId: "factory-droid",
  agentName: "Factory Droid",
  protocolVersion: 1,
  cliBinary: "droid",
  modes: {
    defaultId: "default",
    available: [{ modeId: "default", name: "Default" }] as never,
  },

  async initSessionExtra({ sessionId, hookToken, hookUrl }) {
    const { ensureSessionDir } = await import("../../session-paths");
    const dirs = await ensureSessionDir(sessionId);
    const configDir = path.join(dirs.env, "factory");
    await fsp.mkdir(configDir, { recursive: true });
    await installDroidHooks({
      configDir,
      hookUrl,
      token: hookToken,
      sessionId,
    });
    return { configDir, hookToken };
  },

  buildPromptArgs({ promptText }) {
    return ["exec", "--output-format", "json", promptText];
  },

  buildPromptEnv(state) {
    return { FACTORY_CONFIG_DIR: state.extra.configDir };
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

  async handleHook({ event, escalator }): Promise<HookResponse> {
    if (event.name === "PreToolUse") {
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
    return { status: 200 };
  },

  buildInitializeResponse(): InitializeResponse {
    return {
      protocolVersion: 1 as never,
      agentInfo: { name: "Factory Droid", version: "native" } as never,
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
          description: "Open Terminal.app and run `droid login`.",
        },
      ] as never,
    };
  },
};
