// ──────────────────────────────────────────────────────────
// 0canvas MCP Server — Exposes design state to AI agents
// ──────────────────────────────────────────────────────────
//
// Provides 5 tools for AI agents to interact with 0canvas:
//   1. 0canvas_read_design_state  — read the .0c project file
//   2. 0canvas_get_element_styles — computed styles + source location
//   3. 0canvas_list_tokens        — CSS custom properties from theme files
//   4. 0canvas_get_feedback       — pending feedback items
//   5. 0canvas_apply_change       — write CSS change + notify browser
//
// Uses @modelcontextprotocol/sdk with stdio transport.
// Registered during extension activation.
//
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CSSSourceResolver } from "./css-source-resolver";
import { CSSFileWriter } from "./css-file-writer";
import type { BridgeWebSocket } from "./websocket-client";
import { createMessage } from "./messages";
import type { BridgeMessage } from "./messages";

export class ZeroCanvasMcpServer {
  private server: McpServer;
  private workspaceRoot: string;
  private resolver: CSSSourceResolver;
  private writer: CSSFileWriter;
  private wsBridge: BridgeWebSocket | null = null;
  private transport: StdioServerTransport | null = null;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.resolver = new CSSSourceResolver(workspaceRoot);
    this.writer = new CSSFileWriter(workspaceRoot);

    this.server = new McpServer({
      name: "0canvas",
      version: "0.0.1",
    });

    this.registerTools();
  }

  /** Set the WebSocket bridge for live notifications */
  setBridge(bridge: BridgeWebSocket): void {
    this.wsBridge = bridge;
  }

  /** Start the MCP server on stdio transport */
  async start(): Promise<void> {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
    console.log("[0canvas] MCP server started on stdio");
  }

  /** Stop the MCP server */
  async stop(): Promise<void> {
    if (this.transport) {
      await this.server.close();
      this.transport = null;
    }
  }

  // ── Tool Registration ─────────────────────────────────────

  private registerTools(): void {
    // 1. Read design state — returns the .0c project file JSON
    this.server.tool(
      "0canvas_read_design_state",
      "Returns the current .0c project file JSON, containing all variants, feedback items, and project metadata.",
      {},
      async () => {
        try {
          const ocFiles = await this.findOcFiles();
          if (ocFiles.length === 0) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "No .0c project files found in workspace" }) }],
            };
          }

          const results: Record<string, unknown> = {};
          for (const filePath of ocFiles) {
            try {
              const content = fs.readFileSync(filePath, "utf-8");
              const parsed = JSON.parse(content);
              const relPath = path.relative(this.workspaceRoot, filePath);
              results[relPath] = parsed;
            } catch {
              // Skip unparseable files
            }
          }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }) }],
            isError: true,
          };
        }
      }
    );

    // 2. Get element styles — computed styles + source file location
    this.server.tool(
      "0canvas_get_element_styles",
      "Returns computed styles and CSS source file location for a given CSS selector.",
      {
        selector: z.string().describe("CSS selector of the element (e.g. '.hero-title', '#main-nav')"),
      },
      async ({ selector }) => {
        try {
          // Find source locations for common properties
          const properties = [
            "color", "background-color", "font-size", "padding", "margin",
            "display", "position", "border", "border-radius", "width", "height",
          ];

          const sourceLocations: Record<string, { file: string; line: number; column?: number }> = {};
          for (const prop of properties) {
            const location = await this.resolver.resolve(selector, prop);
            if (location) {
              sourceLocations[prop] = {
                file: location.file,
                line: location.line,
                column: location.column,
              };
            }
          }

          // Read all CSS files to find rules matching this selector
          const matchedRules = await this.findCSSRulesForSelector(selector);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                selector,
                sourceLocations,
                matchedRules,
              }, null, 2),
            }],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }) }],
            isError: true,
          };
        }
      }
    );

    // 3. List tokens — all CSS custom properties from theme files
    this.server.tool(
      "0canvas_list_tokens",
      "Returns all CSS custom properties (design tokens) found in theme/variable CSS files in the workspace.",
      {},
      async () => {
        try {
          const tokens = await this.collectTokens();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                tokenCount: Object.keys(tokens).length,
                tokens,
              }, null, 2),
            }],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }) }],
            isError: true,
          };
        }
      }
    );

    // 4. Get feedback — pending feedback items
    this.server.tool(
      "0canvas_get_feedback",
      "Returns all pending feedback items from the current 0canvas project.",
      {},
      async () => {
        try {
          const ocFiles = await this.findOcFiles();
          const allFeedback: unknown[] = [];

          for (const filePath of ocFiles) {
            try {
              const content = fs.readFileSync(filePath, "utf-8");
              const parsed = JSON.parse(content);
              if (parsed.feedbackItems && Array.isArray(parsed.feedbackItems)) {
                const pending = parsed.feedbackItems.filter(
                  (item: { status?: string }) => item.status === "pending"
                );
                allFeedback.push(...pending);
              }
            } catch {
              // Skip
            }
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                pendingCount: allFeedback.length,
                items: allFeedback,
              }, null, 2),
            }],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }) }],
            isError: true,
          };
        }
      }
    );

    // 5. Apply change — write CSS change + notify browser
    this.server.tool(
      "0canvas_apply_change",
      "Applies a CSS property change to the source file for a given selector. The browser hot-reloads via Vite HMR.",
      {
        selector: z.string().describe("CSS selector to target (e.g. '.hero-title')"),
        property: z.string().describe("CSS property name in kebab-case (e.g. 'background-color')"),
        value: z.string().describe("New CSS value (e.g. '#3B82F6', '16px', 'flex')"),
      },
      async ({ selector, property, value }) => {
        try {
          // 1. Find where this selector + property lives
          const location = await this.resolver.resolve(selector, property);

          if (!location) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: `Could not find "${property}" for selector "${selector}" in any CSS file`,
                }),
              }],
              isError: true,
            };
          }

          // 2. Write the new value
          const result = this.writer.write(location.file, location.line, property, value);

          if (!result.success) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({ success: false, error: result.error }),
              }],
              isError: true,
            };
          }

          // 3. Notify browser via WebSocket bridge
          if (this.wsBridge) {
            this.wsBridge.send(
              createMessage<BridgeMessage>({
                type: "STYLE_CHANGE_ACK",
                source: "extension",
                requestId: `mcp-${Date.now()}`,
                success: true,
                file: result.file,
                line: result.line,
              })
            );
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                file: result.file,
                line: result.line,
                message: `Applied ${property}: ${value} to ${selector} in ${result.file}:${result.line}`,
              }),
            }],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }) }],
            isError: true,
          };
        }
      }
    );
  }

  // ── Helpers ──────────────────────────────────────────────

  private async findOcFiles(): Promise<string[]> {
    const uris = await vscode.workspace.findFiles("**/*.0c", "**/node_modules/**", 20);
    return uris.map((u) => u.fsPath);
  }

  private async collectTokens(): Promise<Record<string, { value: string; file: string; line: number }>> {
    const tokens: Record<string, { value: string; file: string; line: number }> = {};

    // Search CSS files for custom property definitions
    const cssFiles = await vscode.workspace.findFiles(
      "**/*.css",
      "{**/node_modules/**,**/dist/**,**/.next/**,**/build/**}"
    );

    const tokenRegex = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*;/;

    for (const uri of cssFiles) {
      try {
        const content = fs.readFileSync(uri.fsPath, "utf-8");
        const lines = content.split("\n");
        const relPath = path.relative(this.workspaceRoot, uri.fsPath);

        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(tokenRegex);
          if (match) {
            tokens[match[1]] = {
              value: match[2],
              file: relPath,
              line: i + 1,
            };
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return tokens;
  }

  private async findCSSRulesForSelector(selector: string): Promise<{ file: string; line: number; rule: string }[]> {
    const results: { file: string; line: number; rule: string }[] = [];

    const cssFiles = await vscode.workspace.findFiles(
      "**/*.css",
      "{**/node_modules/**,**/dist/**,**/.next/**,**/build/**}"
    );

    // Normalize selector for matching
    const selectorParts = selector.split(/\s+/);
    const lastPart = selectorParts[selectorParts.length - 1];

    for (const uri of cssFiles) {
      try {
        const content = fs.readFileSync(uri.fsPath, "utf-8");
        const lines = content.split("\n");
        const relPath = path.relative(this.workspaceRoot, uri.fsPath);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Simple check: does this line contain the selector (or its last part)?
          if (line.includes(lastPart) && line.includes("{")) {
            // Collect the full rule up to the closing brace
            let rule = line;
            let braceDepth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
            let j = i + 1;
            while (braceDepth > 0 && j < lines.length) {
              rule += "\n" + lines[j];
              braceDepth += (lines[j].match(/{/g) || []).length - (lines[j].match(/}/g) || []).length;
              j++;
            }
            results.push({ file: relPath, line: i + 1, rule: rule.trim() });
          }
        }
      } catch {
        // Skip
      }
    }

    return results.slice(0, 10); // Limit to 10 results
  }
}

// ── Factory for extension activation ──────────────────────

let mcpServer: ZeroCanvasMcpServer | null = null;

export function createMcpServer(workspaceRoot: string): ZeroCanvasMcpServer {
  mcpServer = new ZeroCanvasMcpServer(workspaceRoot);
  return mcpServer;
}

export function getMcpServer(): ZeroCanvasMcpServer | null {
  return mcpServer;
}
