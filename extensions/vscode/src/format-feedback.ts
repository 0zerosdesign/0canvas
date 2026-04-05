// ──────────────────────────────────────────────────────────
// Format feedback items into structured markdown for agents
// ──────────────────────────────────────────────────────────

import type { FeedbackItem } from "./bridge-client";

/**
 * Format feedback items into structured markdown that agents can act on.
 * Includes selectors, component info, and the user's feedback.
 */
export function formatFeedbackForAgent(items: FeedbackItem[]): string {
  if (items.length === 0) return "No pending feedback.";

  const lines: string[] = [
    "# 0canvas Feedback",
    "",
    `${items.length} item${items.length > 1 ? "s" : ""} from the visual inspector.`,
    "Each item targets a specific DOM element. Use the CSS selector to find it in the codebase.",
    "",
    "---",
    "",
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const num = i + 1;

    lines.push(`## ${num}. ${item.comment}`);
    lines.push("");
    lines.push(`- **Selector:** \`${item.elementSelector}\``);
    lines.push(`- **Tag:** \`<${item.elementTag}>\``);

    if (item.elementClasses.length > 0) {
      lines.push(`- **Classes:** \`${item.elementClasses.join(" ")}\``);
    }

    lines.push(`- **Intent:** ${item.intent}`);
    lines.push(`- **Severity:** ${item.severity}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("Please address each item. After fixing, the changes will be visible in 0canvas when the page refreshes.");

  return lines.join("\n");
}

/**
 * Format a compact single-line summary for notifications.
 */
export function formatFeedbackSummary(items: FeedbackItem[]): string {
  if (items.length === 0) return "No feedback";
  if (items.length === 1) return `1 feedback: "${items[0].comment}"`;
  return `${items.length} feedback items from 0canvas`;
}
