// ──────────────────────────────────────────────────────────
// Shared adapter helpers
// ──────────────────────────────────────────────────────────
//
// Most adapters spawn a CLI subprocess with `--output-format
// stream-json` (or equivalent), read NDJSON from stdout, drain stderr
// for diagnostics, and translate CLI-native events into the canonical
// SessionNotification stream. The plumbing below is the same across
// Claude, Codex, Cursor, Amp, Droid — only the event-translation
// logic differs. PTY-only adapters (Gemini, Copilot) bypass this and
// use node-pty directly.
//
// ──────────────────────────────────────────────────────────

import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { once } from "node:events";
import * as readline from "node:readline";

import { StreamJsonParser } from "../stream-json/parser";
import type { AgentFailure } from "../types";
import { AgentFailureError } from "../types";

const STDERR_TAIL_LINES = 40;

export interface SpawnedStreamOptions {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  /** Called for each JSON object parsed from stdout. */
  onEvent: (obj: unknown) => void;
  /** Called for each line of stderr (already trimmed). */
  onStderrLine?: (line: string) => void;
  /** Called when the subprocess exits. */
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  /** Called on JSON parse failures. Default: log + continue. */
  onParseError?: (line: string, err: Error) => void;
}

export interface SpawnedStream {
  readonly child: ChildProcess;
  /** Last N lines of stderr, newest last. Useful for failure classification. */
  stderrTail(): string;
  /** Send a SIGTERM and await exit. */
  kill(signal?: NodeJS.Signals): Promise<void>;
  /** Promise that resolves when the subprocess exits. */
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

export function spawnStreamJson(opts: SpawnedStreamOptions): SpawnedStream {
  const spawnOpts: SpawnOptions = {
    cwd: opts.cwd,
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
    stdio: ["pipe", "pipe", "pipe"],
  };

  const child = spawn(opts.command, opts.args, spawnOpts);
  // Close stdin immediately. The prompt is always passed via argv for
  // these CLIs — they only read stdin when piped, and at least Codex
  // (`codex exec … --json`) hangs forever waiting for EOF if stdin
  // stays open, even after emitting `turn.completed`. Claude has a 3s
  // timeout but pays the latency on every turn. Closing stdin once,
  // here, fixes both for free.
  child.stdin?.end();
  child.stdout?.setEncoding("utf-8");
  child.stderr?.setEncoding("utf-8");

  const parser = new StreamJsonParser({
    onEvent: opts.onEvent,
    onParseError: (line, err) => {
      if (opts.onParseError) {
        opts.onParseError(line, err);
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[agents] stream-json parse failure from ${opts.command}: ${err.message}`,
        );
      }
    },
  });
  child.stdout?.on("data", (chunk: string | Buffer) => parser.feed(chunk));
  child.stdout?.on("end", () => parser.end());

  const stderrBuf: string[] = [];
  if (child.stderr) {
    const rl = readline.createInterface({ input: child.stderr });
    rl.on("line", (line) => {
      stderrBuf.push(line);
      if (stderrBuf.length > STDERR_TAIL_LINES) stderrBuf.shift();
      opts.onStderrLine?.(line);
    });
  }

  const exited = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    child.once("exit", (code, signal) => {
      resolve({ code, signal });
      opts.onExit?.(code, signal);
    });
  });

  return {
    child,
    stderrTail: () => stderrBuf.join("\n"),
    async kill(signal = "SIGTERM") {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill(signal);
      // Give the child a grace period, then escalate to SIGKILL.
      const graceful = await Promise.race([
        exited.then(() => true),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 3000),
        ),
      ]);
      if (!graceful) {
        try { child.kill("SIGKILL"); } catch { /* already dead */ }
        await exited;
      }
    },
    exited,
  };
}

// ── Error classification ─────────────────────────────────
//
// Ported from src/engine/acp/failure.ts but trimmed. The heuristics
// still work for raw CLI stderr (no JSON-RPC framing).

const AUTH_KEYWORDS =
  /\b(login|signed?\s*in|credentials|unauthori[sz]ed|api[-\s]?key|oauth|authenticate|please\s+sign|access\s+token|permission\s+denied)\b/i;

const PROTOCOL_KEYWORDS = /\b(protocol\s+version|unsupported\s+version|incompatible\s+cli)\b/i;

export function classifyExit(args: {
  agentId: string;
  code: number | null;
  signal: NodeJS.Signals | string | null;
  stderrTail: string;
  stage: AgentFailure["stage"];
}): AgentFailure {
  const { agentId, code, signal, stderrTail, stage } = args;

  if (AUTH_KEYWORDS.test(stderrTail)) {
    return {
      kind: "auth-required",
      message: "sign-in required",
      stage,
      agentId,
      exit: { code, signal: signal ? String(signal) : null, stderrTail },
    };
  }

  if (PROTOCOL_KEYWORDS.test(stderrTail)) {
    return {
      kind: "protocol-error",
      message: "CLI version incompatible",
      stage,
      agentId,
      exit: { code, signal: signal ? String(signal) : null, stderrTail },
    };
  }

  // Previously: a stage=="initialize" branch mapped clean exits to
  // auth-required. That branch only made sense for the ACP path,
  // which spawned a subprocess at initialize() time. The native
  // adapters synthesise InitializeResponse without touching the
  // subprocess (see each adapter's initialize()), so this classifier
  // never fires with stage="initialize" anymore. Dropped to avoid
  // misleading callers who read the code.

  // Pull the most informative line from stderr to use as the user-
  // facing message. The bare "code=N signal=null" form was useless —
  // users had no signal to act on (e.g. Cursor's free-plan model
  // gate prints its real error to stderr only). We pick the last
  // non-empty stderr line, which is usually the agent's own summary.
  const lastStderrLine = stderrTail
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .pop();
  const friendly =
    lastStderrLine && lastStderrLine.length > 0
      ? lastStderrLine.length > 240
        ? lastStderrLine.slice(0, 237) + "…"
        : lastStderrLine
      : `CLI exited with code=${code} signal=${signal ?? "null"}`;

  return {
    kind: "subprocess-exited",
    message: friendly,
    stage,
    agentId,
    exit: { code, signal: signal ? String(signal) : null, stderrTail },
  };
}

export function failureFromError(
  err: unknown,
  agentId: string,
  stage: AgentFailure["stage"],
): AgentFailure {
  if (err instanceof AgentFailureError) return err.failure;
  const message = err instanceof Error ? err.message : String(err);
  if (/timed?\s*out/i.test(message)) {
    return { kind: "timeout", message, stage, agentId };
  }
  if (/connection\s*(closed|reset)|transport\s+closed|broken\s*pipe/i.test(message)) {
    return { kind: "transport-closed", message, stage, agentId };
  }
  if (AUTH_KEYWORDS.test(message)) {
    return { kind: "auth-required", message, stage, agentId };
  }
  return { kind: "protocol-error", message, stage, agentId };
}

// ── Auth method advertisement ────────────────────────────
//
// In the ACP world, agents advertised their own auth methods via
// InitializeResponse.authMethods; the UI's sign-in modal rendered
// those verbatim. The native adapters don't speak a protocol, so
// they synthesise InitializeResponse. An empty `authMethods: []`
// here made the sign-in modal render an empty picker — users
// could never complete sign-in.
//
// Every native adapter's real sign-in path is the same: open
// Terminal.app and run `<cli> login`. So we advertise a single
// "terminal" method across the board. The UI routes this method
// id through `runCliLogin` (electron/ipc/commands/ai-cli.ts) which
// owns the osascript call. Agents that need a different flow
// can opt out by passing their own authMethods array.

export const TERMINAL_AUTH_METHOD = {
  id: "terminal",
  name: "Sign in via Terminal",
  description: "Open Terminal.app and complete the CLI's own login flow.",
} as const;

// ── Small utilities ──────────────────────────────────────

/** Wait until subprocess exits, then throw if exit was non-zero. */
export async function assertCleanExit(
  stream: SpawnedStream,
  stage: AgentFailure["stage"],
  agentId: string,
): Promise<void> {
  const { code, signal } = await stream.exited;
  if (code === 0) return;
  throw new AgentFailureError(
    classifyExit({
      agentId,
      code,
      signal,
      stderrTail: stream.stderrTail(),
      stage,
    }),
  );
}

/** Ensure a listener for `once` never leaks across aborts. */
export async function awaitOrAbort<T>(
  source: NodeJS.EventEmitter,
  event: string,
  abort: AbortSignal,
): Promise<T> {
  const ac = new AbortController();
  abort.addEventListener("abort", () => ac.abort(), { once: true });
  const [value] = (await once(source, event, { signal: ac.signal })) as [T];
  return value;
}
