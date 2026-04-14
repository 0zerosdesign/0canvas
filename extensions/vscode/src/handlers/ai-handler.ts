// ──────────────────────────────────────────────────────────
// AI Chat Handler
// ──────────────────────────────────────────────────────────
//
// Handles AI_CHAT_REQUEST messages: builds rich context,
// writes it to .0canvas/ai-request.md, then opens the
// agent's chat with a direct prompt.
//
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import type { BridgeWebSocket } from "../websocket-client";
import type { AIChatRequestMessage, BridgeMessage } from "../messages";
import { createMessage } from "../messages";
import { buildAIContext } from "../ai-context";
import type { AgentType } from "../agent-dispatch";

export function registerAIHandler(
  bridge: BridgeWebSocket,
  workspaceRoot: string,
  getAgentLabel: () => string
): void {
  bridge.on("AI_CHAT_REQUEST", async (msg) => {
    const aiMsg = msg as AIChatRequestMessage;
    console.log(`[0canvas] AI_CHAT_REQUEST: "${aiMsg.query}"`);

    try {
      const contextMarkdown = buildAIContext(aiMsg, workspaceRoot);

      // Write context to file for reference
      const contextDir = path.join(workspaceRoot, ".0canvas");
      if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(contextDir, "ai-request.md"),
        contextMarkdown,
        "utf-8"
      );

      // Build a direct prompt with full inline context (agents skip file reads)
      const styleSummary = aiMsg.selector && aiMsg.styles
        ? Object.entries(aiMsg.styles as Record<string, string>)
            .filter(([k]) => ["display","position","backgroundColor","color","fontSize","padding","margin","borderRadius","width","height"].includes(k))
            .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`)
            .slice(0, 8)
            .join("; ")
        : "";

      const directPrompt = [
        `0canvas design request: "${aiMsg.query}"`,
        aiMsg.selector ? `Element: \`${aiMsg.selector}\`` : "",
        styleSummary ? `Current styles: ${styleSummary}` : "",
        `Apply changes to the SOURCE FILES (CSS/Tailwind). The browser will hot-reload via Vite HMR.`,
        `Full context in .0canvas/ai-request.md`,
      ].filter(Boolean).join("\n");

      // Copy full context to clipboard as backup
      await vscode.env.clipboard.writeText(contextMarkdown);

      // Open Cursor's composer/chat with the direct prompt
      let ok = false;
      try {
        await vscode.commands.executeCommand("workbench.action.chat.open", {
          query: directPrompt,
        });
        ok = true;

        // Try to auto-submit
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        await sleep(1000);
        const submitCmds = ["workbench.action.chat.acceptInput", "chat.acceptInput", "composer.acceptInput"];
        for (const cmd of submitCmds) {
          try { await vscode.commands.executeCommand(cmd); break; } catch { continue; }
        }
      } catch {
        // Fallback: just show notification
        vscode.window.showInformationMessage(
          `0canvas AI: "${aiMsg.query}" — context copied to clipboard and saved to .0canvas/ai-request.md`
        );
        ok = true;
      }

      // Send response back to browser
      bridge.send(
        createMessage<BridgeMessage>({
          type: "AI_CHAT_RESPONSE",
          source: "extension",
          requestId: aiMsg.id,
          success: ok,
          message: ok
            ? `Sent to ${getAgentLabel()}: "${aiMsg.query}"`
            : `Context saved to .0canvas/ai-request.md and copied to clipboard.`,
        })
      );
    } catch (err) {
      console.error(`[0canvas] AI_CHAT_REQUEST failed:`, err);
      bridge.send(
        createMessage<BridgeMessage>({
          type: "AI_CHAT_RESPONSE",
          source: "extension",
          requestId: aiMsg.id,
          success: false,
          message: `Error: ${err instanceof Error ? err.message : String(err)}`,
        })
      );
    }
  });
}
