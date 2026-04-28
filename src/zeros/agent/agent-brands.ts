// ──────────────────────────────────────────────────────────
// agent-brands.ts — brand colors for MVP agents
// ──────────────────────────────────────────────────────────
//
// The agent registry serves agent logos as SVGs with
// `fill="currentColor"`. When rendered via `<img>` those SVGs
// can't inherit CSS color, so they land monochrome (muted grey).
// This module provides the brand color per agent id; AgentIcon
// fetches the SVG once, rewrites `currentColor` to the brand
// color, and inlines the result so the mark shows in its real
// color across the app (Settings rows, composer pill, dropdown).
//
// For agents with no entry below, the icon renders in the neutral
// foreground color — same as today.
// ──────────────────────────────────────────────────────────

export interface AgentBrand {
  /** CSS color string. Used as the fill replacement for the
   *  CDN-served SVG's `currentColor` references. */
  color: string;
}

export const AGENT_BRANDS: Record<string, AgentBrand> = {
  claude: { color: "#D97757" },
  codex: { color: "#10A37F" },
  cursor: { color: "#E8E8E8" },
  "factory-droid": { color: "#A855F7" },
  gemini: { color: "#4285F4" },
  "github-copilot-cli": { color: "#E8E8E8" },
  opencode: { color: "#FFA500" },
};

export function brandColor(agentId: string | null | undefined): string | null {
  if (!agentId) return null;
  return AGENT_BRANDS[agentId]?.color ?? null;
}
