// ──────────────────────────────────────────────────────────
// Agent registry — local manifest
// ──────────────────────────────────────────────────────────
//
// Replaces the former remote agent registry. The old registry fetched
// CDN JSON describing how to spawn npx/uvx adapters. We don't do that
// anymore — users bring their own CLI installs, and we know exactly
// which seven CLIs we support.
//
// This file is the single source of truth for:
//   - which agents Zeros knows about
//   - what CLI binary to probe on PATH
//   - which adapter class to instantiate
//   - what auth-file to check for the green-dot indicator
//   - how `<cli> login` gets triggered from the UI
//
// Adding an 8th agent = one entry here + one adapter module.
//
// ──────────────────────────────────────────────────────────

import type { AgentAdapter, AgentAdapterContext } from "./types";
import type { EnrichedRegistryAgent } from "../types";
import { createClaudeAdapter } from "./adapters/claude";
import { createCodexAdapter } from "./adapters/codex";
import { createCursorAdapter } from "./adapters/cursor";
import { createAmpAdapter } from "./adapters/amp";
import { createDroidAdapter } from "./adapters/droid";
import { createCopilotAdapter } from "./adapters/copilot";
import { createGeminiAdapter } from "./adapters/gemini";

// ── Auth-probe spec ──────────────────────────────────────
//
// "File" = check existence of path (expands ~ to home, never reads
//   contents).
// "Keychain" = macOS `security find-generic-password -s <name>` exit
//   code. Used by Claude's macOS Keychain storage.
// "Command" = run `<cli> auth status` / `<cli> status` and check exit
//   code 0. Slowest — only used when filesystem and keychain paths
//   don't pin down the answer.

export type AuthProbe =
  | { kind: "file"; paths: string[] }
  | { kind: "keychain"; service: string }
  | { kind: "command"; binary: string; args: string[] }
  | { kind: "any-of"; probes: AuthProbe[] };

// ── Manifest entry ───────────────────────────────────────

export interface AgentManifestEntry {
  id: string;
  name: string;
  description: string;
  icon?: string;
  /** The CLI binary the user invokes directly. This is what we probe
   *  on PATH to decide if the agent is installed. */
  cliBinary: string;
  /** Shown in Settings → Agents. Used by the "Install" affordance. */
  installHint?: {
    command: string;
    docsUrl?: string;
  };
  /** Auth detection — existence-probe only, never reads contents. */
  authProbe: AuthProbe;
  /** Command the UI's "Sign in" button runs in Terminal. */
  loginCommand: { binary: string; args: string[] };
  /** Minimum `<cliBinary> --version` we've tested our translator
   *  against. Below this, the UI surfaces "supported versions: X+"
   *  so the user doesn't chase ghost parse errors. Omitted = no
   *  floor (early-adopter territory, best-effort parse). */
  minCliVersion?: string;
  /** Maximum version we've pinned to. Usually omitted — we only set
   *  this when a vendor ships a breaking stream-json schema change
   *  that we know breaks our translator, while we work on a fork. */
  maxCliVersion?: string;
  /** Adapter factory. Called lazily on first use. */
  createAdapter: (ctx: AgentAdapterContext) => AgentAdapter;
}

// ── Manifest ─────────────────────────────────────────────
//
// Adapter factories are imported lazily so the engine boots fast and
// unused agents never load their modules. Phase 1-6 fill these in;
// until then, `createAdapter` throws a clear "not yet implemented"
// error so the engine can still list agents in Settings.

function notYetImplemented(agentId: string): AgentAdapter {
  return {
    agentId,
    initialize: () => {
      throw new Error(
        `[agents] ${agentId} adapter not yet implemented — still on native path`,
      );
    },
    newSession: () => { throw new Error(`${agentId}: not implemented`); },
    loadSession: () => { throw new Error(`${agentId}: not implemented`); },
    listSessions: () => { throw new Error(`${agentId}: not implemented`); },
    prompt: () => { throw new Error(`${agentId}: not implemented`); },
    cancel: () => { throw new Error(`${agentId}: not implemented`); },
    respondToPermission: () => {
      throw new Error(`${agentId}: not implemented`);
    },
    dispose: async () => {},
  };
}

export const AGENT_MANIFEST: AgentManifestEntry[] = [
  {
    id: "claude-acp", // compatibility id for saved chats/settings; rename only with migration
    name: "Claude Code",
    description: "Anthropic's Claude Code CLI (subscription or API key).",
    cliBinary: "claude",
    installHint: {
      command: "npm install -g @anthropic-ai/claude-code",
      docsUrl: "https://code.claude.com/docs",
    },
    authProbe: {
      kind: "any-of",
      probes: [
        { kind: "keychain", service: "Claude Code-credentials" },
        {
          kind: "file",
          paths: [
            "~/.claude/.credentials.json",
            "~/.claude/auth.json",
            "~/.claude/settings.json",
          ],
        },
      ],
    },
    loginCommand: { binary: "claude", args: ["/login"] },
    // Stream-json stabilised around 1.0.0; our translator captures
    // usage + session-id from the `result` event shipped in that
    // release. Below that, streaming works but usage accounting is
    // silently zero.
    minCliVersion: "1.0.0",
    createAdapter: (ctx) => createClaudeAdapter(ctx),
  },
  {
    id: "codex-acp",
    name: "Codex",
    description: "OpenAI Codex CLI (ChatGPT subscription or API key).",
    cliBinary: "codex",
    installHint: {
      command: "npm install -g @openai/codex",
      docsUrl: "https://developers.openai.com/codex",
    },
    authProbe: {
      kind: "file",
      paths: ["~/.codex/auth.json"],
    },
    loginCommand: { binary: "codex", args: ["login"] },
    // `exec resume` landed in 0.8.0; before that `exec --json` shipped
    // but without a resumable thread id in the result event.
    minCliVersion: "0.8.0",
    createAdapter: (ctx) => createCodexAdapter(ctx),
  },
  {
    id: "cursor",
    name: "Cursor Agent",
    description: "Cursor's coding agent CLI.",
    cliBinary: "cursor-agent",
    installHint: {
      command: "curl https://cursor.com/install -sSf | bash",
      docsUrl: "https://cursor.com/docs/cli",
    },
    authProbe: {
      kind: "any-of",
      probes: [
        {
          kind: "file",
          paths: ["~/.cursor/cli-config.json"],
        },
        { kind: "command", binary: "cursor-agent", args: ["status"] },
      ],
    },
    loginCommand: { binary: "cursor-agent", args: ["login"] },
    createAdapter: (ctx) => createCursorAdapter(ctx),
  },
  {
    id: "amp-acp",
    name: "Amp",
    description: "Sourcegraph Amp agent.",
    cliBinary: "amp",
    installHint: {
      command: "npm install -g @sourcegraph/amp",
      docsUrl: "https://ampcode.com/manual",
    },
    authProbe: {
      kind: "file",
      paths: ["~/.config/amp/settings.json"],
    },
    loginCommand: { binary: "amp", args: ["login"] },
    createAdapter: (ctx) => createAmpAdapter(ctx),
  },
  {
    id: "factory-droid",
    name: "Factory Droid",
    description: "Factory's Droid agent (Claude-compatible hooks).",
    cliBinary: "droid",
    installHint: {
      command: "curl https://app.factory.ai/install | bash",
      docsUrl: "https://docs.factory.ai",
    },
    authProbe: {
      kind: "file",
      paths: ["~/.factory/config.json"],
    },
    loginCommand: { binary: "droid", args: ["login"] },
    createAdapter: (ctx) => createDroidAdapter(ctx),
  },
  {
    id: "github-copilot-cli",
    name: "GitHub Copilot CLI",
    description: "GitHub's Copilot CLI agent.",
    cliBinary: "copilot",
    installHint: {
      command: "gh extension install github/gh-copilot",
      docsUrl:
        "https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli",
    },
    authProbe: {
      kind: "any-of",
      probes: [
        {
          kind: "file",
          paths: ["~/.copilot/config.json", "~/.copilot/mcp-config.json"],
        },
        { kind: "command", binary: "copilot", args: ["auth", "status"] },
      ],
    },
    loginCommand: { binary: "copilot", args: ["auth", "login"] },
    createAdapter: (ctx) => createCopilotAdapter(ctx),
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    description: "Google's Gemini CLI agent.",
    cliBinary: "gemini",
    installHint: {
      command: "npm install -g @google/gemini-cli",
      docsUrl: "https://geminicli.com/docs",
    },
    authProbe: {
      kind: "file",
      paths: ["~/.gemini/oauth_creds.json"],
    },
    loginCommand: { binary: "gemini", args: [] }, // first-run triggers OAuth
    createAdapter: (ctx) => createGeminiAdapter(ctx),
  },
];

// ── Public API ───────────────────────────────────────────

export function listAgentIds(): string[] {
  return AGENT_MANIFEST.map((a) => a.id);
}

export function findAgent(id: string): AgentManifestEntry | undefined {
  return AGENT_MANIFEST.find((a) => a.id === id);
}

/** Produce the agent list the engine broadcasts over `AGENT_AGENTS_LIST`.
 *  `installed` comes from PATH probing (caller passes the result).
 *  Typed as `EnrichedRegistryAgent` so it drops cleanly into the
 *  existing wire message; browser-side `BridgeRegistryAgent` is
 *  structurally compatible. */
/** Per-agent version compatibility summary the gateway fans out to
 *  the wire. The caller (AgentGateway.listAgents) runs the probes
 *  concurrently so we don't pay N × 2s of serialised `--version` calls. */
export interface AgentVersionInfo {
  installedVersion?: string;
  versionCompatible?: boolean;
}

export function toBridgeAgents(
  installedBinaries: Set<string>,
  authenticatedAgentIds?: Set<string>,
  versionInfoByAgentId?: Map<string, AgentVersionInfo>,
): EnrichedRegistryAgent[] {
  return AGENT_MANIFEST.map((m) => {
    const installed = installedBinaries.has(m.cliBinary);
    const vinfo = versionInfoByAgentId?.get(m.id);
    return {
      id: m.id,
      name: m.name,
      // `version` historically held the registry-declared version; we
      // now always pass the CLI's actually-installed version when we
      // have it. Empty string = not probed / not installed.
      version: vinfo?.installedVersion ?? "",
      description: m.description,
      icon: m.icon,
      distribution: {}, // no npx/uvx/binary registry — user-installed
      installed,
      launchKind: installed ? "binary" : "unavailable",
      authBinary: m.cliBinary,
      // Surface install hints to the UI so the "no CLI detected" state
      // can tell the user exactly what to run. Cheap — a few strings
      // on every AGENT_AGENTS_LIST broadcast.
      installHint: m.installHint,
      // Engine-resolved auth state. Undefined when the caller didn't
      // supply a probe set (older gateway path); the legacy
      // `ai_cli_is_authenticated` IPC is the fallback in that case.
      authenticated: authenticatedAgentIds?.has(m.id),
      installedVersion: vinfo?.installedVersion,
      versionCompatible: vinfo?.versionCompatible,
      minCliVersion: m.minCliVersion,
      maxCliVersion: m.maxCliVersion,
    } satisfies EnrichedRegistryAgent;
  });
}
