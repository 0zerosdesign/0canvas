// ──────────────────────────────────────────────────────────
// ActivityHUD — "what's the agent doing right now?"
// ──────────────────────────────────────────────────────────
//
// Stage 5.1. Replaces the silent "Agent is responding…"
// placeholder with a live readout pinned above the composer:
//
//   ⚙ Reading src/zeros/agent/use-sticky-bottom.ts · 1m 23s
//   🔍 Searching grep "useStickyBottom" · 12s
//   $ npm run build · 8s
//   🌐 Fetching https://… · 3s
//   ⊕ Subagent Explore · 2m 14s
//
// Computed by walking backwards through session.messages and
// finding the latest tool whose status is in_progress / pending.
// If nothing is running but the session is still streaming we
// fall back to a thinking/generating message so the bar never
// silently disappears mid-turn.
// ──────────────────────────────────────────────────────────

import { memo, useMemo } from "react";
import {
  Brain,
  FileEdit,
  FileText,
  GitBranch,
  Globe,
  HelpCircle,
  Plug,
  Search,
  Terminal,
  Wrench,
} from "lucide-react";

import { LiveDuration } from "./renderers/live-duration";
import type { AgentMessage, AgentToolMessage } from "./use-agent-session";

interface ActivityHUDProps {
  messages: AgentMessage[];
  isStreaming: boolean;
}

export const ActivityHUD = memo(function ActivityHUD({
  messages,
  isStreaming,
}: ActivityHUDProps) {
  const view = useMemo(() => computeView(messages, isStreaming), [
    messages,
    isStreaming,
  ]);
  if (!view) return null;
  const Icon = view.icon;
  return (
    <div className="oc-agent-hud" data-tone={view.tone}>
      <Icon className="oc-agent-hud-icon w-3.5 h-3.5" />
      <span className="oc-agent-hud-label">{view.label}</span>
      <span className="oc-agent-hud-spacer" />
      <LiveDuration startedAt={view.startedAt} className="oc-agent-hud-time" />
    </div>
  );
});

interface ActivityView {
  icon: typeof Brain;
  label: string;
  startedAt: number;
  /** Visual tone — driven by tool kind. */
  tone: "default" | "shell" | "read" | "edit" | "search" | "fetch" | "subagent" | "thinking";
}

function computeView(
  messages: AgentMessage[],
  isStreaming: boolean,
): ActivityView | null {
  if (!isStreaming) return null;

  // Walk backwards looking for the most recent in-progress tool.
  // That's the user's "currently doing X" signal.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (
      m.kind === "tool" &&
      (m.status === "in_progress" || m.status === "pending")
    ) {
      return viewForTool(m as AgentToolMessage);
    }
  }

  // No in-flight tool but session is still streaming → the agent
  // is either thinking or generating its final-text reply. Pick the
  // freshest of the two as the start time.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.kind === "text" && m.role === "thought") {
      return {
        icon: Brain,
        label: "Thinking",
        startedAt: m.createdAt,
        tone: "thinking",
      };
    }
    if (m.kind === "text" && m.role === "agent") {
      return {
        icon: Brain,
        label: "Generating reply",
        startedAt: m.createdAt,
        tone: "default",
      };
    }
    // Stop walking once we hit the user prompt — earlier messages
    // belong to a prior turn and aren't the current activity.
    if (m.kind === "text" && m.role === "user") break;
  }

  return {
    icon: Brain,
    label: "Working…",
    startedAt: Date.now(),
    tone: "default",
  };
}

function viewForTool(tool: AgentToolMessage): ActivityView {
  const { icon, tone } = iconForKind(tool.toolKind);
  const label = labelForTool(tool);
  return {
    icon,
    label,
    startedAt: tool.createdAt,
    tone,
  };
}

function iconForKind(kind: string | undefined): {
  icon: typeof Brain;
  tone: ActivityView["tone"];
} {
  switch (kind) {
    case "execute":
      return { icon: Terminal, tone: "shell" };
    case "read":
      return { icon: FileText, tone: "read" };
    case "edit":
      return { icon: FileEdit, tone: "edit" };
    case "search":
      return { icon: Search, tone: "search" };
    case "web_search":
    case "fetch":
      return { icon: Globe, tone: "fetch" };
    case "subagent":
      return { icon: GitBranch, tone: "subagent" };
    case "mcp":
      return { icon: Plug, tone: "default" };
    case "question":
      return { icon: HelpCircle, tone: "default" };
    default:
      return { icon: Wrench, tone: "default" };
  }
}

function labelForTool(tool: AgentToolMessage): string {
  const input = (tool.rawInput && typeof tool.rawInput === "object"
    ? (tool.rawInput as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const kind = tool.toolKind;

  if (kind === "execute") {
    const cmd = typeof input.command === "string" ? input.command : tool.title;
    return truncate(cmd, 80);
  }
  if (kind === "read") {
    const path = pickString(input.file_path, input.path, input.filePath);
    return path ? `Reading ${shortenPath(path)}` : tool.title;
  }
  if (kind === "edit") {
    const path = pickString(input.file_path, input.path, input.filePath);
    return path ? `Editing ${shortenPath(path)}` : tool.title;
  }
  if (kind === "search") {
    const pattern = pickString(input.pattern, input.query);
    return pattern ? `Searching "${truncate(pattern, 60)}"` : tool.title;
  }
  if (kind === "web_search") {
    const query = pickString(input.query, input.q);
    return query ? `Web search: "${truncate(query, 60)}"` : tool.title;
  }
  if (kind === "fetch") {
    const url = pickString(input.url, input.URL);
    return url ? `Fetching ${truncate(url, 80)}` : tool.title;
  }
  if (kind === "subagent") {
    const desc = pickString(input.description, input.subagent_type);
    return desc ? `Subagent · ${truncate(desc, 70)}` : tool.title;
  }
  if (kind === "mcp") {
    return tool.title;
  }
  return tool.title;
}

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function shortenPath(p: string): string {
  // Keep just the trailing filename + immediate parent so the HUD
  // doesn't get hogged by deep absolute paths.
  const segments = p.split("/").filter(Boolean);
  if (segments.length <= 2) return p;
  return `…/${segments.slice(-2).join("/")}`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
