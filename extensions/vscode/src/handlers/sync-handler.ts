// ──────────────────────────────────────────────────────────
// Project Sync Handlers
// ──────────────────────────────────────────────────────────
//
// Handles PROJECT_STATE_SYNC (save .0c files to disk) and
// PEER_CONNECTED (send all .0c files to the browser).
//
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import type { BridgeWebSocket } from "../websocket-client";
import type { BridgeMessage } from "../messages";
import { createMessage } from "../messages";

export function registerSyncHandlers(
  bridge: BridgeWebSocket,
  workspaceRoot: string
): void {
  // Track project ID -> file path mapping
  const projectFilePaths = new Map<string, string>();

  // Handle PROJECT_STATE_SYNC: save each project's .0c file to disk
  bridge.on("PROJECT_STATE_SYNC", async (msg) => {
    const syncMsg = msg as any;

    try {
      // Use the filePath from the message (derived from project name)
      const fileName = syncMsg.filePath || "project.0c";
      const targetPath = path.join(workspaceRoot, fileName);

      // Track this project's file path
      if (syncMsg.projectId) {
        projectFilePaths.set(syncMsg.projectId, targetPath);
      }

      fs.writeFileSync(targetPath, syncMsg.projectFile, "utf-8");
      console.log(`[0canvas] Saved -> ${fileName}`);
    } catch (err) {
      console.error(`[0canvas] Failed to save .0c file:`, err);
    }
  });

  // When browser connects, send ALL .0c files from workspace
  bridge.on("PEER_CONNECTED", async (msg) => {
    if ((msg as any).role !== "browser") return;

    try {
      const ocFiles = await vscode.workspace.findFiles("**/*.0c", "**/node_modules/**", 20);

      for (const uri of ocFiles) {
        try {
          const content = fs.readFileSync(uri.fsPath, "utf-8");
          JSON.parse(content); // validate JSON
          const relPath = path.relative(workspaceRoot, uri.fsPath);

          bridge.send(
            createMessage<BridgeMessage>({
              type: "PROJECT_STATE_LOADED",
              source: "extension",
              projectFile: content,
              filePath: relPath,
            })
          );
          console.log(`[0canvas] Sent .0c -> browser: ${relPath}`);
        } catch {
          // Skip invalid files
        }
      }
    } catch (err) {
      console.error(`[0canvas] Failed to send .0c files:`, err);
    }
  });
}
