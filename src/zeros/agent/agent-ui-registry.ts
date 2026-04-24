import type { InitializeResponse } from "@agentclientprotocol/sdk";
import { agentFamily } from "./model-catalog";

export interface AgentUiEntry {
  configDir?: string;
  rulesFileName?: string;
  ui: {
    hasPlanPanel: boolean;
    hasSlashCommands: boolean;
    hasModes: boolean;
    hasSubagentTree: boolean;
    hasThreadHistory: boolean;
  };
  expectedFirstSessionMs: number;
}

const BY_FAMILY: Record<string, AgentUiEntry> = {
  claude: {
    configDir: "~/.claude",
    rulesFileName: "CLAUDE.md",
    ui: {
      hasPlanPanel: true,
      hasSlashCommands: true,
      hasModes: true,
      hasSubagentTree: true,
      hasThreadHistory: true,
    },
    expectedFirstSessionMs: 11_000,
  },
  codex: {
    configDir: "~/.codex",
    rulesFileName: "AGENTS.md",
    ui: {
      hasPlanPanel: true,
      hasSlashCommands: true,
      hasModes: true,
      hasSubagentTree: false,
      hasThreadHistory: true,
    },
    expectedFirstSessionMs: 3_000,
  },
  gemini: {
    configDir: "~/.gemini",
    rulesFileName: "GEMINI.md",
    ui: {
      hasPlanPanel: false,
      hasSlashCommands: true,
      hasModes: false,
      hasSubagentTree: false,
      hasThreadHistory: false,
    },
    expectedFirstSessionMs: 2_500,
  },
  opencode: {
    configDir: "~/.config/opencode",
    rulesFileName: "AGENTS.md",
    ui: {
      hasPlanPanel: true,
      hasSlashCommands: true,
      hasModes: true,
      hasSubagentTree: true,
      hasThreadHistory: true,
    },
    expectedFirstSessionMs: 2_500,
  },
  amp: {
    ui: {
      hasPlanPanel: false,
      hasSlashCommands: false,
      hasModes: false,
      hasSubagentTree: false,
      hasThreadHistory: false,
    },
    expectedFirstSessionMs: 3_000,
  },
  augment: {
    ui: {
      hasPlanPanel: false,
      hasSlashCommands: true,
      hasModes: false,
      hasSubagentTree: false,
      hasThreadHistory: false,
    },
    expectedFirstSessionMs: 3_000,
  },
};

const DEFAULT_ENTRY: AgentUiEntry = {
  ui: {
    hasPlanPanel: false,
    hasSlashCommands: false,
    hasModes: false,
    hasSubagentTree: false,
    hasThreadHistory: false,
  },
  expectedFirstSessionMs: 2_500,
};

/** Look up the static UI entry for an agent. Matches by family (claude/codex/gemini/…),
 *  so wrapper variants like `claude-acp`, `claude-code`, `@anthropic-ai/claude-code`
 *  all resolve to the same entry. */
export function uiEntryForAgent(agentId: string | null): AgentUiEntry {
  return BY_FAMILY[agentFamily(agentId)] ?? DEFAULT_ENTRY;
}

/** Merge the static entry with whatever the agent advertises at runtime. Runtime
 *  *enables* panels the static entry said false about (forward-compat: if the
 *  agent ships a new capability we can honor it immediately). Runtime cannot
 *  *disable* a panel the static entry said true about — static wins that way,
 *  so the UI stays stable even if the agent temporarily omits metadata. */
export function resolveAgentUi(
  agentId: string | null,
  initialize: InitializeResponse | null,
  runtime?: {
    hasPlan?: boolean;
    hasCommands?: boolean;
    hasModes?: boolean;
  },
): AgentUiEntry {
  const base = uiEntryForAgent(agentId);
  const caps = initialize?.agentCapabilities as
    | { loadSession?: boolean }
    | undefined;
  return {
    ...base,
    ui: {
      ...base.ui,
      hasPlanPanel: base.ui.hasPlanPanel || !!runtime?.hasPlan,
      hasSlashCommands: base.ui.hasSlashCommands || !!runtime?.hasCommands,
      hasModes: base.ui.hasModes || !!runtime?.hasModes,
      hasThreadHistory: base.ui.hasThreadHistory || !!caps?.loadSession,
    },
  };
}
