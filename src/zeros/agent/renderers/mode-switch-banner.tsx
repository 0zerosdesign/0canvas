// ──────────────────────────────────────────────────────────
// ModeSwitchBanner — timeline record of a mode change
// ──────────────────────────────────────────────────────────
//
// Renders an `AgentModeSwitchMessage` as a thin horizontal
// divider:
//
//   ─── Switched to Plan mode ──────────────── 14:32:18 ───
//   ─── Auto-switched to Execute mode ──────── 14:34:51 ───
//      (rationale, if any, on a second line)
//
// Source flips the verb:
//   - source: "user"  → "Switched"
//   - source: "agent" → "Auto-switched" (highlights it as
//     non-user-initiated, which is the case the user most
//     wants to notice)
//
// Axis tints the bar slightly so phase / permission / tier
// changes are visually distinct in a long transcript.
// ──────────────────────────────────────────────────────────

import { memo } from "react";
import type { ComponentType } from "react";
import { GitBranch, Lock, Zap } from "lucide-react";

import type { AgentMessage } from "../use-agent-session";
import type { RendererContext } from "./types";

export const ModeSwitchBanner: ComponentType<{
  message: AgentMessage;
  ctx: RendererContext;
}> = memo(function ModeSwitchBanner({ message }) {
  if (message.kind !== "mode_switch") return null;
  const verb = message.source === "agent" ? "Auto-switched" : "Switched";
  const Icon = iconForAxis(message.axis);
  const time = formatTime(message.createdAt);
  const klass = `oc-agent-mode-banner oc-agent-mode-banner-${message.axis} oc-agent-mode-banner-${message.source}`;
  const toLabel = humanizeMode(message.to);

  return (
    <div className={klass}>
      <span className="oc-agent-mode-rule" />
      <Icon className="oc-agent-mode-icon w-3 h-3" />
      <span className="oc-agent-mode-text">
        {verb} to <strong>{toLabel}</strong>
        {axisLabel(message.axis)}
      </span>
      <span className="oc-agent-mode-time">{time}</span>
      <span className="oc-agent-mode-rule" />
      {message.reason && (
        <div className="oc-agent-mode-reason">{message.reason}</div>
      )}
    </div>
  );
});

function iconForAxis(axis: "phase" | "permission" | "tier") {
  if (axis === "phase") return GitBranch;
  if (axis === "permission") return Lock;
  return Zap;
}

function axisLabel(axis: "phase" | "permission" | "tier"): string {
  if (axis === "phase") return " mode";
  if (axis === "permission") return " permission";
  return " tier";
}

/** Map raw mode ids to display labels.
 *
 *  Claude advertises ids like `default`, `acceptEdits`, `plan`,
 *  `bypassPermissions`. Most other agents use snake_case (`plan_mode`).
 *  We normalise to the casing the UI uses elsewhere. */
function humanizeMode(id: string): string {
  if (!id) return "—";
  const map: Record<string, string> = {
    default: "Default",
    acceptEdits: "Accept Edits",
    plan: "Plan",
    bypassPermissions: "Bypass",
    auto: "Auto",
    explore: "Explore",
    execute: "Execute",
  };
  if (map[id]) return map[id];
  return id
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
