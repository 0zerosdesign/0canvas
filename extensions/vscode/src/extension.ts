// ──────────────────────────────────────────────────────────
// 0canvas VS Code Extension — Fully Automated
// ──────────────────────────────────────────────────────────
//
// When feedback arrives from the 0canvas browser UI:
//   1. Writes feedback to .0canvas/feedback.md
//   2. Opens the agent's chat/composer
//   3. Types the prompt referencing the file
//   4. Auto-submits — agent starts working immediately
//
// No popups, no manual steps. Click Send in 0canvas →
// agent starts fixing.
//
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import { BridgeClient, type FeedbackItem } from "./bridge-client";
import { formatFeedbackForAgent, formatFeedbackSummary } from "./format-feedback";
import { detectAgent, sendToAgent, type AgentType } from "./agent-dispatch";

let client: BridgeClient;
let statusBarItem: vscode.StatusBarItem;
let pendingItems: FeedbackItem[] = [];
let agent: AgentType = "unknown";
let isSending = false;

export function activate(context: vscode.ExtensionContext) {
  agent = detectAgent();
  console.log(`[0canvas] Detected agent: ${agent}`);

  // ── Status bar ──────────────────────────────────────────
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "0canvas.sendToAgent";
  updateStatusBar(false, 0);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // ── Bridge client ───────────────────────────────────────
  client = new BridgeClient(24192);

  client.onStatusChange((online) => {
    updateStatusBar(online, pendingItems.length);
  });

  // When new feedback arrives → auto-send to agent
  client.onFeedback(async (items) => {
    pendingItems = items;
    updateStatusBar(client.online, items.length);

    if (items.length > 0 && !isSending) {
      await autoSendToAgent();
    }
  });

  client.startPolling(2000);
  context.subscriptions.push({ dispose: () => client.dispose() });

  // ── Commands ────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("0canvas.sendToAgent", async () => {
      if (pendingItems.length === 0) {
        pendingItems = await client.getPendingFeedback();
      }
      if (pendingItems.length === 0) {
        vscode.window.showInformationMessage("0canvas: No pending feedback.");
        return;
      }
      await autoSendToAgent();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("0canvas.copyFeedback", async () => {
      if (pendingItems.length === 0) {
        pendingItems = await client.getPendingFeedback();
      }
      if (pendingItems.length === 0) {
        vscode.window.showInformationMessage("0canvas: No pending feedback.");
        return;
      }
      const md = formatFeedbackForAgent(pendingItems);
      await vscode.env.clipboard.writeText(md);
      vscode.window.showInformationMessage(
        `0canvas: ${pendingItems.length} items copied to clipboard.`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("0canvas.showFeedback", async () => {
      pendingItems = await client.getPendingFeedback();
      updateStatusBar(client.online, pendingItems.length);
      if (pendingItems.length === 0) {
        vscode.window.showInformationMessage("0canvas: No pending feedback.");
        return;
      }
      const md = formatFeedbackForAgent(pendingItems);
      const doc = await vscode.workspace.openTextDocument({
        content: md,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    })
  );
}

export function deactivate() {
  client?.dispose();
}

// ── Auto-send pipeline ────────────────────────────────────

async function autoSendToAgent() {
  if (isSending) return;
  isSending = true;

  try {
    const markdown = formatFeedbackForAgent(pendingItems);
    const count = pendingItems.length;

    updateStatusBar(client.online, count);
    statusBarItem.text = `$(sync~spin) 0canvas: sending...`;

    const ok = await sendToAgent(markdown, agent);

    if (ok) {
      pendingItems = [];
      updateStatusBar(client.online, 0);
    }
  } finally {
    isSending = false;
  }
}

// ── Status bar ────────────────────────────────────────────

function updateStatusBar(online: boolean, count: number) {
  if (!online) {
    statusBarItem.text = "$(circle-slash) 0canvas";
    statusBarItem.tooltip = "0canvas bridge offline";
    statusBarItem.backgroundColor = undefined;
    return;
  }

  if (count > 0) {
    statusBarItem.text = `$(comment-discussion) 0canvas: ${count}`;
    statusBarItem.tooltip = `${count} pending — click to send to ${getAgentLabel(agent)}`;
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  } else {
    statusBarItem.text = "$(check) 0canvas";
    statusBarItem.tooltip = `Connected — ${getAgentLabel(agent)}`;
    statusBarItem.backgroundColor = undefined;
  }
}

function getAgentLabel(a: AgentType): string {
  switch (a) {
    case "cursor": return "Cursor";
    case "copilot": return "Copilot";
    case "claude-code": return "Claude Code";
    case "codex": return "Codex";
    default: return "Agent";
  }
}
