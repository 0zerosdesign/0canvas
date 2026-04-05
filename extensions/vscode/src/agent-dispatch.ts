// ──────────────────────────────────────────────────────────
// Agent Dispatch — Fully automated feedback → agent pipeline
// ──────────────────────────────────────────────────────────
//
// Strategy: Write feedback to a workspace file, then trigger
// the agent to read it and act. This works reliably across
// all editors because it uses the filesystem as the bridge.
//
// Cursor: open composer with query referencing the file
// Copilot: open chat with query
// Claude Code: open terminal with command
// Fallback: clipboard
//
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export type AgentType = "cursor" | "copilot" | "claude-code" | "codex" | "unknown";

const FEEDBACK_DIR = ".0canvas";
const FEEDBACK_FILE = "feedback.md";

/** Detect which AI agent is available */
export function detectAgent(): AgentType {
  const appName = vscode.env.appName.toLowerCase();
  if (appName.includes("cursor")) return "cursor";

  const copilot = vscode.extensions.getExtension("github.copilot-chat");
  if (copilot) return "copilot";

  const claude = vscode.extensions.getExtension("anthropic.claude-code");
  if (claude) return "claude-code";

  return "unknown";
}

/** Write feedback markdown to .0canvas/feedback.md in workspace */
function writeFeedbackFile(markdown: string): string | null {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return null;

  const dirPath = path.join(workspaceFolder.uri.fsPath, FEEDBACK_DIR);
  const filePath = path.join(dirPath, FEEDBACK_FILE);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, markdown, "utf-8");
  return filePath;
}

/** Full automation: write file → trigger agent → agent starts working */
export async function sendToAgent(markdown: string, agent: AgentType): Promise<boolean> {
  // Step 1: Write feedback to workspace file
  const filePath = writeFeedbackFile(markdown);

  // Step 2: Also copy to clipboard as backup
  await vscode.env.clipboard.writeText(markdown);

  // Step 3: Trigger the agent
  switch (agent) {
    case "cursor":
      return triggerCursor(filePath);
    case "copilot":
      return triggerCopilot(filePath);
    case "claude-code":
      return triggerClaudeCode(filePath);
    default:
      return triggerFallback();
  }
}

// ── Cursor ────────────────────────────────────────────────

async function triggerCursor(filePath: string | null): Promise<boolean> {
  const prompt = filePath
    ? `Read the file .0canvas/feedback.md in the workspace. It contains visual feedback from 0canvas with CSS selectors for each element. Fix all the issues listed.`
    : `Fix these visual feedback issues from 0canvas (check clipboard).`;

  // Approach 1: VS Code Chat API with query param + auto-submit
  try {
    await vscode.commands.executeCommand("workbench.action.chat.open", {
      query: prompt,
    });

    // Try multiple submit commands with increasing delays
    // Cursor/VS Code needs time to render the chat panel
    const submitCommands = [
      "workbench.action.chat.acceptInput",
      "chat.acceptInput",
      "composer.acceptInput",
      "aichat.submit",
    ];

    for (let delay = 800; delay <= 2000; delay += 400) {
      await sleep(delay);
      for (const cmd of submitCommands) {
        try {
          await vscode.commands.executeCommand(cmd);
          return true;
        } catch {
          continue;
        }
      }
    }

    // Submit commands didn't work — prompt is pre-filled, user presses Enter
    vscode.window.showInformationMessage("0canvas: Prompt ready in chat — press Enter to submit.");
    return true;
  } catch (e) {
    console.log("[0canvas] workbench.action.chat.open failed:", e);
  }

  // Approach 2: Cursor-specific aichat command
  try {
    await vscode.commands.executeCommand("aichat.newchataction", prompt);
    return true;
  } catch (e) {
    console.log("[0canvas] aichat.newchataction failed:", e);
  }

  // Approach 3: Open composer and paste
  try {
    await vscode.env.clipboard.writeText(prompt);
    await vscode.commands.executeCommand("workbench.action.chat.open");
    vscode.window.showInformationMessage(
      "0canvas: Feedback ready — press Cmd+V then Enter in chat."
    );
    return true;
  } catch {
    // Final fallback
    vscode.window.showInformationMessage(
      "0canvas: Feedback saved to .0canvas/feedback.md. Tell your agent: \"fix issues in .0canvas/feedback.md\""
    );
    return true;
  }
}

// ── Copilot ───────────────────────────────────────────────

async function triggerCopilot(filePath: string | null): Promise<boolean> {
  const prompt = filePath
    ? `Read .0canvas/feedback.md and fix all the visual feedback issues listed.`
    : `Fix these visual feedback issues (from clipboard).`;

  try {
    await vscode.commands.executeCommand("workbench.action.chat.open", {
      query: prompt,
    });
    await sleep(600);
    await vscode.commands.executeCommand("workbench.action.chat.acceptInput");
    return true;
  } catch {
    vscode.window.showInformationMessage(
      "0canvas: Feedback saved to .0canvas/feedback.md. Open Copilot chat and reference the file."
    );
    return true;
  }
}

// ── Claude Code ───────────────────────────────────────────

async function triggerClaudeCode(filePath: string | null): Promise<boolean> {
  // Claude Code in terminal: pipe the prompt
  if (filePath) {
    const terminal = vscode.window.createTerminal("0canvas → Claude");
    terminal.show();
    terminal.sendText(
      `claude "Read .0canvas/feedback.md and fix all the visual feedback issues. Each item has a CSS selector to find the element."`,
      true
    );
    return true;
  }

  vscode.window.showInformationMessage(
    "0canvas: Feedback copied to clipboard. Paste into Claude Code."
  );
  return true;
}

// ── Fallback ──────────────────────────────────────────────

async function triggerFallback(): Promise<boolean> {
  vscode.window.showInformationMessage(
    "0canvas: Feedback saved to .0canvas/feedback.md and copied to clipboard."
  );
  return true;
}

// ── Helpers ───────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
