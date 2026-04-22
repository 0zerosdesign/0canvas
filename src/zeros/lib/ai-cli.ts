// ──────────────────────────────────────────────────────────
// Phase 4 — frontend bridge to the Rust AI CLI subprocess
// ──────────────────────────────────────────────────────────
//
// Wraps the ai_cli_* Tauri commands into an AsyncGenerator<string>
// that matches the shape of the openai.ts streamChat(), so the chat
// panel can dispatch between HTTP providers and CLI subprocesses
// without caring which one it's talking to.
// ──────────────────────────────────────────────────────────

import type { AiSettings, AiThinkingEffort } from "../store/store";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type AiStreamEvent = {
  sessionId: string;
  kind: string;
  content?: string | null;
  data?: unknown;
};

function newSessionId(): string {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Probe whether the named CLI binary is on the user's PATH. */
export async function checkCli(binary: "claude" | "codex"): Promise<string | null> {
  if (!isTauri()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>("ai_cli_check", { binary });
}

/**
 * Best-effort probe for whether the user finished `<cli> login`. Checks
 * for the official CLI's cached-credential file only — we never read
 * the token. Safe to poll during the login modal.
 */
export async function isCliAuthenticated(
  binary: "claude" | "codex",
): Promise<boolean> {
  if (!isTauri()) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("ai_cli_is_authenticated", { binary });
}

/** Open Terminal and run `<binary> login` so the user authenticates
 *  with the official CLI's OAuth flow. We never handle tokens ourselves. */
export async function runCliLogin(binary: "claude" | "codex"): Promise<void> {
  if (!isTauri()) {
    throw new Error("CLI login requires the Mac app");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke<void>("ai_cli_run_login", { binary });
}

export async function cancelSession(sessionId: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke<void>("ai_cli_cancel", { sessionId });
}

// ── Streaming adapter ────────────────────────────────────
//
// Rust emits NDJSON-parsed chunks as Tauri events. We bridge them
// to an AsyncGenerator by buffering events in a queue and yielding
// them out; the generator closes when the "end" event arrives or
// when the consumer abort-signals.

type QueueItem =
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; input: unknown }
  | { kind: "error"; message: string }
  | { kind: "session"; resumeId: string }
  | { kind: "end" };

export type CliStreamHandlers = {
  onTool?: (name: string, input: unknown) => void;
  onResumeId?: (id: string) => void;
};

/**
 * Spawn a CLI provider and stream text chunks back. Yields only
 * text; tool calls / resume ids are delivered via handlers so the
 * caller can layer richer UX without destructuring every chunk.
 */
export async function* streamCli(
  provider: "claude" | "codex",
  prompt: string,
  settings: AiSettings,
  signal: AbortSignal | undefined,
  handlers: CliStreamHandlers = {},
): AsyncGenerator<string> {
  if (!isTauri()) {
    throw new Error(
      `${provider} subscription mode requires the Mac app — use API key mode in the browser.`,
    );
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");

  const sessionId = newSessionId();
  const queue: QueueItem[] = [];
  let pendingResolve: ((item: QueueItem) => void) | null = null;

  const push = (item: QueueItem) => {
    if (pendingResolve) {
      const r = pendingResolve;
      pendingResolve = null;
      r(item);
    } else {
      queue.push(item);
    }
  };

  const unlisten = await listen<AiStreamEvent>("ai-stream-event", (e) => {
    if (e.payload.sessionId !== sessionId) return;
    switch (e.payload.kind) {
      case "text":
        if (typeof e.payload.content === "string") {
          push({ kind: "text", text: e.payload.content });
        }
        break;
      case "tool":
        push({
          kind: "tool",
          name: e.payload.content ?? "tool",
          input: e.payload.data ?? null,
        });
        break;
      case "error":
        push({
          kind: "error",
          message: e.payload.content ?? "CLI error",
        });
        break;
      case "session":
        if (typeof e.payload.content === "string") {
          push({ kind: "session", resumeId: e.payload.content });
        }
        break;
      case "end":
        push({ kind: "end" });
        break;
      // Unknown kinds (including "claude:raw" / "codex:raw") are logged
      // to the console for diagnostics but don't interrupt the stream.
      default:
        // eslint-disable-next-line no-console
        console.debug("[ai-cli] unhandled event", e.payload);
    }
  });

  const onAbort = () => {
    cancelSession(sessionId).catch(() => {});
    push({ kind: "end" });
  };
  signal?.addEventListener("abort", onAbort);

  try {
    const effort = mapEffort(settings.thinkingEffort);
    if (provider === "claude") {
      await invoke<void>("claude_spawn", {
        args: {
          sessionId,
          prompt,
          model: settings.model || null,
          resumeId: null,
          effort,
          systemPrompt: null,
        },
      });
    } else {
      await invoke<void>("codex_spawn", {
        args: {
          sessionId,
          prompt,
          model: settings.model || null,
          resumeId: null,
          effort,
        },
      });
    }

    while (true) {
      const next = await new Promise<QueueItem>((resolve) => {
        if (queue.length > 0) resolve(queue.shift()!);
        else pendingResolve = resolve;
      });
      if (next.kind === "end") return;
      if (next.kind === "error") throw new Error(next.message);
      if (next.kind === "tool") {
        handlers.onTool?.(next.name, next.input);
        continue;
      }
      if (next.kind === "session") {
        handlers.onResumeId?.(next.resumeId);
        continue;
      }
      yield next.text;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    unlisten();
  }
}

function mapEffort(effort: AiThinkingEffort | undefined): string | null {
  switch (effort) {
    case "low":
    case "medium":
    case "high":
      return effort;
    case "xhigh":
      return "xhigh";
    default:
      return null;
  }
}
