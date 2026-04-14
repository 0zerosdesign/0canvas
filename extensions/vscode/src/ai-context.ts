// ──────────────────────────────────────────────────────────
// AI Context Builder — Rich markdown context for AI agents
// ──────────────────────────────────────────────────────────
//
// Builds a structured markdown prompt with design context
// so AI agents can make informed code changes.
//
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import type { AIChatRequestMessage } from "./messages";

export function buildAIContext(
  request: AIChatRequestMessage,
  workspaceRoot: string
): string {
  const lines: string[] = [];

  lines.push("# 0canvas Design Request");
  lines.push("");
  lines.push(`**Designer's request:** ${request.query}`);
  lines.push("");

  // Element context
  if (request.selector) {
    lines.push("## Selected Element");
    lines.push(`- **Selector:** \`${request.selector}\``);
    lines.push("");
  }

  // Computed styles (top relevant ones)
  if (request.styles && Object.keys(request.styles).length > 0) {
    lines.push("## Current Styles");
    const importantProps = [
      "display", "position", "width", "height",
      "margin", "padding", "color", "backgroundColor",
      "fontSize", "fontWeight", "flexDirection", "alignItems",
      "justifyContent", "gap", "borderRadius", "boxShadow",
    ];
    const relevantStyles = Object.entries(request.styles)
      .filter(([k]) => importantProps.includes(k))
      .slice(0, 15);

    if (relevantStyles.length > 0) {
      lines.push("```css");
      for (const [prop, value] of relevantStyles) {
        const kebab = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
        lines.push(`${kebab}: ${value};`);
      }
      lines.push("```");
      lines.push("");
    }
  }

  // Current route
  if (request.route) {
    lines.push(`**Current route:** \`${request.route}\``);
    lines.push("");
  }

  // Pending feedback
  try {
    const feedbackPath = path.join(workspaceRoot, ".0canvas", "feedback.md");
    if (fs.existsSync(feedbackPath)) {
      const feedback = fs.readFileSync(feedbackPath, "utf-8").trim();
      if (feedback) {
        lines.push("## Pending Feedback");
        lines.push(feedback);
        lines.push("");
      }
    }
  } catch {
    // Ignore
  }

  // Instructions
  lines.push("## Instructions");
  lines.push("- Make the requested change to the **source files** in this project.");
  lines.push("- The browser will hot-reload automatically via Vite HMR.");
  lines.push("- Prefer editing CSS files or Tailwind classes over inline styles.");
  lines.push("- If the element uses CSS variables/tokens, prefer changing the token value.");
  lines.push("- After making changes, briefly describe what you changed.");
  lines.push("");

  return lines.join("\n");
}
