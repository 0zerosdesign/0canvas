// ──────────────────────────────────────────────────────────
// 0canvas MCP Server — Exposes design state to AI agents
// ──────────────────────────────────────────────────────────
//
// Provides 5 tools for AI agents to interact with 0canvas:
//   1. 0canvas_read_design_state  — read .0c project file(s)
//   2. 0canvas_get_element_styles — computed styles + source location
//   3. 0canvas_list_tokens        — CSS custom properties
//   4. 0canvas_get_feedback       — pending feedback items
//   5. 0canvas_apply_change       — write CSS change to source file
//
// Uses Streamable HTTP transport — mounted on the engine's
// HTTP server at /mcp. Auto-discovered by AI tools via
// .mcp.json and .vscode/mcp.json.
//
// ──────────────────────────────────────────────────────────

import * as fs from "node:fs";
import * as path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { EngineCache } from "./cache";
import type { CSSResolver } from "./css-resolver";
import type { CSSFileWriter } from "./css-writer";
import type { OCManager } from "./oc-manager";
import type { EngineServer } from "./server";
import { createMessage } from "./types";

export interface McpServerOptions {
  root: string;
  cache: EngineCache;
  resolver: CSSResolver;
  writer: CSSFileWriter;
  ocManager: OCManager;
  engineServer: EngineServer;
}

export class ZeroCanvasMcp {
  private mcpServer: McpServer;
  private transport: StreamableHTTPServerTransport | null = null;
  private options: McpServerOptions;

  constructor(options: McpServerOptions) {
    this.options = options;

    this.mcpServer = new McpServer({
      name: "0canvas",
      version: "0.0.5",
    });

    this.registerTools();
  }

  /**
   * Handle an incoming MCP HTTP request.
   * Called from the engine's HTTP server for requests to /mcp.
   */
  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Collect request body first
    const body = await collectBody(req);
    const parsedBody = body ? JSON.parse(body) : undefined;

    // Check if this is an initialization request
    const isInit = Array.isArray(parsedBody)
      ? parsedBody.some((m: { method?: string }) => m.method === "initialize")
      : parsedBody?.method === "initialize";

    if (isInit || !this.transport) {
      // Create a new transport per session
      this.transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => `0canvas-${Date.now()}`,
      });
      await this.mcpServer.connect(this.transport);
    }

    await this.transport.handleRequest(req, res, parsedBody);
  }

  /**
   * Stop the MCP server.
   */
  async stop(): Promise<void> {
    if (this.transport) {
      await this.mcpServer.close();
      this.transport = null;
    }
  }

  // ── Tool Registration ─────────────────────────────────────

  private registerTools(): void {
    const { root, cache, resolver, writer, ocManager, engineServer } = this.options;

    // 1. Read design state — returns the .0c project file JSON
    this.mcpServer.tool(
      "0canvas_read_design_state",
      "Returns the current .0c project file JSON, containing all variants, feedback items, and project metadata.",
      {},
      async () => {
        try {
          const projects = await ocManager.listProjects();
          if (projects.length === 0) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "No .0c project files found in workspace" }) }],
            };
          }

          const results: Record<string, unknown> = {};
          for (const project of projects) {
            results[project.relPath] = project.content;
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

    // 2. Get element styles — source file locations for a selector
    this.mcpServer.tool(
      "0canvas_get_element_styles",
      "Returns CSS source file locations for a given CSS selector, showing where each property is defined.",
      {
        selector: z.string().describe("CSS selector of the element (e.g. '.hero-title', '#main-nav')"),
      },
      async ({ selector }) => {
        try {
          const properties = [
            "color", "background-color", "font-size", "padding", "margin",
            "display", "position", "border", "border-radius", "width", "height",
          ];

          const sourceLocations: Record<string, { file: string; line: number; column?: number }> = {};
          for (const prop of properties) {
            const location = await resolver.resolve(selector, prop);
            if (location) {
              sourceLocations[prop] = {
                file: location.relPath,
                line: location.line,
                column: location.column,
              };
            }
          }

          // Find all CSS rules matching this selector from the cache
          const matchedRules = findCSSRulesForSelector(selector, cache, root);

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

    // 3. List tokens — all CSS custom properties
    this.mcpServer.tool(
      "0canvas_list_tokens",
      "Returns all CSS custom properties (design tokens) found in CSS files in the workspace.",
      {},
      async () => {
        try {
          const tokenMap = cache.getTokens();
          const tokens: Record<string, { value: string; file: string; line: number }> = {};

          for (const [name, entry] of tokenMap) {
            tokens[name] = entry;
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                tokenCount: tokenMap.size,
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

    // 4. Get feedback — pending feedback items from .0c files
    this.mcpServer.tool(
      "0canvas_get_feedback",
      "Returns all pending feedback items from the current 0canvas project.",
      {},
      async () => {
        try {
          const projects = await ocManager.listProjects();
          const allFeedback: unknown[] = [];

          for (const project of projects) {
            const content = project.content as Record<string, unknown>;
            // Check both variants (which contain feedback) and top-level feedbackItems
            if (content.feedbackItems && Array.isArray(content.feedbackItems)) {
              const pending = (content.feedbackItems as Array<{ status?: string }>).filter(
                (item) => item.status === "pending"
              );
              allFeedback.push(...pending);
            }
            // Also check inside variants
            if (content.variants && Array.isArray(content.variants)) {
              for (const variant of content.variants as Array<{ feedback?: unknown[] }>) {
                if (variant.feedback && Array.isArray(variant.feedback)) {
                  const pending = (variant.feedback as Array<{ status?: string }>).filter(
                    (item) => item.status === "pending"
                  );
                  allFeedback.push(...pending);
                }
              }
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
    this.mcpServer.tool(
      "0canvas_apply_change",
      "Applies a CSS property change to the source file for a given selector. The browser hot-reloads via the dev server's HMR.",
      {
        selector: z.string().describe("CSS selector to target (e.g. '.hero-title')"),
        property: z.string().describe("CSS property name in kebab-case (e.g. 'background-color')"),
        value: z.string().describe("New CSS value (e.g. '#3B82F6', '16px', 'flex')"),
      },
      async ({ selector, property, value }) => {
        try {
          // 1. Find where this selector + property lives
          const location = await resolver.resolve(selector, property);

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
          const result = writer.write(location.file, location.line, property, value);

          if (!result.success) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({ success: false, error: result.error }),
              }],
              isError: true,
            };
          }

          // 3. Notify browser via WebSocket
          engineServer.broadcast(createMessage({
            type: "CSS_FILE_CHANGED",
            source: "engine" as const,
            file: result.file ?? "",
          }));

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
}

// ── Helpers ──────────────────────────────────────────────

function collectBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function findCSSRulesForSelector(
  selector: string,
  cache: EngineCache,
  root: string
): { file: string; line: number; rule: string }[] {
  const results: { file: string; line: number; rule: string }[] = [];

  // Look up in the selector index
  const selectorParts = selector.split(/\s+/);
  const lastPart = selectorParts[selectorParts.length - 1];

  // Try exact match first, then last part
  const candidates = [selector, lastPart];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const locations = cache.resolveSelector(candidate);
    if (!locations) continue;

    for (const loc of locations) {
      const key = `${loc.file}:${loc.line}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const content = cache.readFile(loc.file);
      if (!content) continue;

      const lines = content.split("\n");
      const startLine = loc.line - 1;
      if (startLine < 0 || startLine >= lines.length) continue;

      // Collect the full rule
      let rule = lines[startLine];
      let braceDepth = (rule.match(/{/g) || []).length - (rule.match(/}/g) || []).length;
      let j = startLine + 1;
      while (braceDepth > 0 && j < lines.length) {
        rule += "\n" + lines[j];
        braceDepth += (lines[j].match(/{/g) || []).length - (lines[j].match(/}/g) || []).length;
        j++;
      }

      results.push({
        file: path.relative(root, loc.file),
        line: loc.line,
        rule: rule.trim(),
      });
    }
  }

  return results.slice(0, 10);
}
