// ──────────────────────────────────────────────────────────
// 0canvas VS Code Extension — Fully Automated
// ──────────────────────────────────────────────────────────
//
// Two communication channels:
//
//   1. WebSocket bridge (new) — real-time style changes from
//      the browser overlay, written directly to CSS files.
//      Connects to the Vite plugin's WS server at /__0canvas.
//
//   2. HTTP polling (legacy) — feedback dispatch to AI agents.
//      Kept for backward compatibility.
//
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import { BridgeClient, type FeedbackItem } from "./bridge-client";
import { formatFeedbackForAgent, formatFeedbackSummary } from "./format-feedback";
import { detectAgent, sendToAgent, type AgentType } from "./agent-dispatch";
import { BridgeWebSocket } from "./websocket-client";
import { CSSSourceResolver } from "./css-source-resolver";
import { CSSFileWriter } from "./css-file-writer";
import { SidebarProvider } from "./sidebar-provider";
import { OCEditorProvider } from "./custom-editor-provider";
import { DevServerManager } from "./dev-server-manager";
import { createMcpServer, type ZeroCanvasMcpServer } from "./mcp-server";
import { createMessage } from "./messages";
import type { StyleChangeMessage, RequestSourceMapMessage, BridgeMessage } from "./messages";

let client: BridgeClient;
let wsBridge: BridgeWebSocket | null = null;
let mcpServer: ZeroCanvasMcpServer | null = null;
let sidebar: SidebarProvider;
let ocEditor: OCEditorProvider;
let devServer: DevServerManager;
let statusBarItem: vscode.StatusBarItem;
let pendingItems: FeedbackItem[] = [];
let agent: AgentType = "unknown";
let isSending = false;

export function activate(context: vscode.ExtensionContext) {
  agent = detectAgent();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  console.log(`[0canvas] Detected agent: ${agent}`);
  console.log(`[0canvas] Workspace root: ${workspaceRoot}`);

  // ── Status bar ──────────────────────────────────────────
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "0canvas.sendToAgent";
  updateStatusBar(false, 0);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // ── Sidebar (Activity Bar panel) ───────────────────────
  sidebar = new SidebarProvider(context.extensionUri);
  sidebar.updateAgent(getAgentLabel(agent));
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebar
    )
  );

  // ── Dev Server Manager ──────────────────────────────────
  devServer = new DevServerManager(workspaceRoot);
  devServer.checkRunning();

  // ── Custom Editor for .0c files ────────────────────────
  ocEditor = new OCEditorProvider(context, devServer);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      OCEditorProvider.viewType,
      ocEditor,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("0canvas.startDevServer", async () => {
      await devServer.start();
    })
  );

  // ── WebSocket bridge (real-time CSS editing) ────────────
  if (workspaceRoot) {
    const resolver = new CSSSourceResolver(workspaceRoot);
    const writer = new CSSFileWriter(workspaceRoot);
    const { TailwindWriter } = require("./tailwind-writer");
    const twWriter = new TailwindWriter(workspaceRoot);

    wsBridge = new BridgeWebSocket(workspaceRoot);

    // Handle STYLE_CHANGE: resolve source → write file → send ACK
    wsBridge.on("STYLE_CHANGE", async (msg) => {
      const styleMsg = msg as StyleChangeMessage;
      console.log(`[0canvas] STYLE_CHANGE: ${styleMsg.selector} { ${styleMsg.property}: ${styleMsg.value} }`);

      // 1. Find where this selector + property lives
      const location = await resolver.resolve(styleMsg.selector, styleMsg.property);

      if (!location) {
        // Property not found in any CSS file — send failure ACK
        wsBridge?.send(
          createMessage<BridgeMessage>({
            type: "STYLE_CHANGE_ACK",
            source: "extension",
            requestId: styleMsg.id,
            success: false,
            error: `Could not find "${styleMsg.property}" for selector "${styleMsg.selector}" in any CSS file`,
          })
        );
        return;
      }

      // 2. Write the new value
      const result = writer.write(location.file, location.line, styleMsg.property, styleMsg.value);

      // 3. Send ACK
      wsBridge?.send(
        createMessage<BridgeMessage>({
          type: "STYLE_CHANGE_ACK",
          source: "extension",
          requestId: styleMsg.id,
          success: result.success,
          file: result.file,
          line: result.line,
          error: result.error,
        })
      );

      if (result.success) {
        console.log(`[0canvas] Written: ${result.file}:${result.line}`);
      } else {
        console.warn(`[0canvas] Write failed: ${result.error}`);
      }
    });

    // Handle TAILWIND_CLASS_CHANGE: add/remove class in JSX source
    wsBridge.on("TAILWIND_CLASS_CHANGE", async (msg) => {
      const twMsg = msg as any;
      console.log(`[0canvas] TAILWIND_CLASS_CHANGE: ${twMsg.action} "${twMsg.className}" on ${twMsg.selector}`);
      const result = await twWriter.writeClassChange(twMsg.selector, twMsg.action, twMsg.className);
      if (result.success) {
        console.log(`[0canvas] Tailwind written: ${result.file}`);
      } else {
        console.warn(`[0canvas] Tailwind write failed: ${result.error}`);
      }
    });

    // Handle REQUEST_SOURCE_MAP: resolve and respond
    wsBridge.on("REQUEST_SOURCE_MAP", async (msg) => {
      const mapMsg = msg as RequestSourceMapMessage;
      const location = await resolver.resolve(mapMsg.selector, mapMsg.property);

      if (location) {
        wsBridge?.send(
          createMessage<BridgeMessage>({
            type: "SOURCE_MAP_RESULT",
            source: "extension",
            requestId: mapMsg.id,
            selector: mapMsg.selector,
            file: location.file,
            line: location.line,
            column: location.column,
          })
        );
      } else {
        wsBridge?.send(
          createMessage<BridgeMessage>({
            type: "ERROR",
            source: "extension",
            code: "SOURCE_NOT_FOUND",
            message: `Could not resolve source for "${mapMsg.selector}"`,
            requestId: mapMsg.id,
          })
        );
      }
    });

    // Track project ID → file path mapping
    const projectFilePaths = new Map<string, string>();

    // Handle PROJECT_STATE_SYNC: save each project's .0c file to disk
    wsBridge.on("PROJECT_STATE_SYNC", async (msg) => {
      const syncMsg = msg as any;

      try {
        const fs = require("fs");
        const pathMod = require("path");

        // Use the filePath from the message (derived from project name)
        const fileName = syncMsg.filePath || "project.0c";
        const targetPath = pathMod.join(workspaceRoot, fileName);

        // Track this project's file path
        if (syncMsg.projectId) {
          projectFilePaths.set(syncMsg.projectId, targetPath);
        }

        fs.writeFileSync(targetPath, syncMsg.projectFile, "utf-8");
        console.log(`[0canvas] Saved → ${fileName}`);
      } catch (err) {
        console.error(`[0canvas] Failed to save .0c file:`, err);
      }
    });

    // When browser connects, send ALL .0c files from workspace
    wsBridge.on("PEER_CONNECTED", async (msg) => {
      if ((msg as any).role !== "browser") return;

      try {
        const fs = require("fs");
        const pathMod = require("path");
        const ocFiles = await vscode.workspace.findFiles("**/*.0c", "**/node_modules/**", 20);

        for (const uri of ocFiles) {
          try {
            const content = fs.readFileSync(uri.fsPath, "utf-8");
            JSON.parse(content); // validate JSON
            const relPath = pathMod.relative(workspaceRoot, uri.fsPath);

            wsBridge?.send(
              createMessage<BridgeMessage>({
                type: "PROJECT_STATE_LOADED",
                source: "extension",
                projectFile: content,
                filePath: relPath,
              })
            );
            console.log(`[0canvas] Sent .0c → browser: ${relPath}`);
          } catch {
            // Skip invalid files
          }
        }
      } catch (err) {
        console.error(`[0canvas] Failed to send .0c files:`, err);
      }
    });

    // Handle AI_CHAT_REQUEST: build context + open agent chat directly
    wsBridge.on("AI_CHAT_REQUEST", async (msg) => {
      const aiMsg = msg as import("./messages").AIChatRequestMessage;
      console.log(`[0canvas] AI_CHAT_REQUEST: "${aiMsg.query}"`);

      try {
        const { buildAIContext } = require("./ai-context");
        const contextMarkdown = buildAIContext(aiMsg, workspaceRoot);

        // Write context to file for reference
        const contextDir = require("path").join(workspaceRoot, ".0canvas");
        if (!require("fs").existsSync(contextDir)) {
          require("fs").mkdirSync(contextDir, { recursive: true });
        }
        require("fs").writeFileSync(
          require("path").join(contextDir, "ai-request.md"),
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
        wsBridge?.send(
          createMessage<BridgeMessage>({
            type: "AI_CHAT_RESPONSE",
            source: "extension",
            requestId: aiMsg.id,
            success: ok,
            message: ok
              ? `Sent to ${getAgentLabel(agent)}: "${aiMsg.query}"`
              : `Context saved to .0canvas/ai-request.md and copied to clipboard.`,
          })
        );
      } catch (err) {
        console.error(`[0canvas] AI_CHAT_REQUEST failed:`, err);
        wsBridge?.send(
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

    wsBridge.onStatusChange((status) => {
      console.log(`[0canvas] WebSocket bridge: ${status}`);
      const wsConnected = status === "connected";
      updateStatusBar(client?.online || wsConnected, pendingItems.length);
      // Update sidebar
      sidebar.updateBridgeStatus(status);
      ocEditor.updateBridgeStatus(status);
      if (wsConnected) {
        try {
          const fs = require("fs");
          const portPath = require("path").join(workspaceRoot, ".0canvas", ".port");
          if (fs.existsSync(portPath)) {
            const port = fs.readFileSync(portPath, "utf-8").trim();
            sidebar.updateDevServerUrl(`http://localhost:${port}`);
          }
        } catch (err) {
          console.error("[0canvas] Error reading port file in status handler:", err);
        }
      }
    });

    wsBridge.start();
    context.subscriptions.push({ dispose: () => wsBridge?.dispose() });

    // ── MCP Server ──────────────────────────────────────────
    mcpServer = createMcpServer(workspaceRoot);
    mcpServer.setBridge(wsBridge);
    mcpServer.start().catch((err) => {
      console.warn("[0canvas] MCP server failed to start:", err);
    });
    context.subscriptions.push({
      dispose: () => {
        mcpServer?.stop().catch(() => {});
        mcpServer = null;
      },
    });
  }

  // ── HTTP bridge client (feedback dispatch) ──────────────
  client = new BridgeClient(24192);

  client.onStatusChange((online) => {
    updateStatusBar(online || wsBridge?.status === "connected", pendingItems.length);
  });

  // When new feedback arrives → auto-send to agent
  client.onFeedback(async (items) => {
    pendingItems = items;
    updateStatusBar(client.online, items.length);
    sidebar.updatePendingFeedback(items.length);

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

  context.subscriptions.push(
    vscode.commands.registerCommand("0canvas.openBrowser", async () => {
      try {
        const fs = require("fs");
        const path = require("path");
        const portFile = path.join(workspaceRoot, ".0canvas", ".port");
        if (fs.existsSync(portFile)) {
          const port = fs.readFileSync(portFile, "utf-8").trim();
          await vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
        } else {
          vscode.window.showWarningMessage("0canvas: Dev server not detected. Start it with `npm run dev` first.");
        }
      } catch {
        vscode.window.showWarningMessage("0canvas: Could not open browser.");
      }
    })
  );
}

export function deactivate() {
  mcpServer?.stop().catch(() => {});
  wsBridge?.dispose();
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
