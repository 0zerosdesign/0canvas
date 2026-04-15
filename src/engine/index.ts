// ──────────────────────────────────────────────────────────
// ZeroCanvasEngine — The heart of 0canvas V2
// ──────────────────────────────────────────────────────────
//
// Standalone Node.js process that:
//   - Reads and writes CSS/source files directly
//   - Serves the browser overlay via WebSocket
//   - Manages .0c design files on disk
//   - Exposes MCP endpoint for AI tools (Phase 1B)
//
// Usage:
//   const engine = new ZeroCanvasEngine({ port: 24193 });
//   await engine.start();
//
// ──────────────────────────────────────────────────────────

import * as fs from "node:fs";
import * as path from "node:path";
import type { WebSocket } from "ws";

import { EngineCache } from "./cache";
import { CSSResolver } from "./css-resolver";
import { CSSFileWriter } from "./css-writer";
import { TailwindWriter } from "./tailwind-writer";
import { OCManager } from "./oc-manager";
import { FileWatcher } from "./watcher";
import { EngineServer } from "./server";
import { ZeroCanvasMcp } from "./mcp";
import { detectFramework, findProjectRoot, type Framework } from "./framework-detector";
import { createMessage, type EngineMessage } from "./types";

const VERSION = "0.0.5";

export interface EngineOptions {
  root?: string;
  port?: number;
}

export class ZeroCanvasEngine {
  private cache: EngineCache;
  private resolver: CSSResolver;
  private writer: CSSFileWriter;
  private tailwindWriter: TailwindWriter;
  private ocManager: OCManager;
  private watcher: FileWatcher;
  private server: EngineServer;
  private mcp: ZeroCanvasMcp | null = null;

  private root: string;
  private port: number;
  private actualPort = 0;
  private framework: Framework = "unknown";
  private running = false;

  constructor(options?: EngineOptions) {
    this.root = options?.root
      ? path.resolve(options.root)
      : findProjectRoot(process.cwd());
    this.port = options?.port ?? 24193;

    // Initialize components
    this.cache = new EngineCache(this.root);
    this.resolver = new CSSResolver(this.root, this.cache);
    this.writer = new CSSFileWriter(this.root, this.cache);
    this.tailwindWriter = new TailwindWriter(this.root);
    this.ocManager = new OCManager(this.root);

    this.watcher = new FileWatcher(this.root, this.cache, (filePath, type, fileType) => {
      this.handleFileChange(filePath, type, fileType);
    });

    this.server = new EngineServer({
      port: this.port,
      onMessage: (msg, ws) => this.handleMessage(msg, ws),
      onConnect: (ws) => this.handleConnect(ws),
      onDisconnect: () => {},
    });

    const engineStartTime = Date.now();
    this.server.setInfoProvider(() => ({
      version: VERSION,
      uptime: Date.now() - engineStartTime,
      connections: this.server.connectionCount,
      stats: this.cache.stats(),
    }));
  }

  /**
   * Start the engine. Builds indexes, starts server, starts watcher.
   */
  async start(): Promise<void> {
    if (this.running) return;

    const startTime = Date.now();

    // 1. Detect framework
    const detection = detectFramework(this.root);
    this.framework = detection.framework;

    console.log(`[0canvas] Project root: ${this.root}`);
    console.log(`[0canvas] Framework: ${this.framework}`);

    // 2. Build CSS selector index
    await this.cache.buildIndex();
    const stats = this.cache.stats();
    console.log(`[0canvas] Index built: ${stats.selectors} selectors, ${stats.files} files, ${stats.tokens} tokens`);

    // 3. Start HTTP + WebSocket server
    this.actualPort = await this.server.start();

    // 4. Start MCP server (mounted on /mcp)
    this.mcp = new ZeroCanvasMcp({
      root: this.root,
      cache: this.cache,
      resolver: this.resolver,
      writer: this.writer,
      ocManager: this.ocManager,
      engineServer: this.server,
    });
    this.server.setMcpHandler((req, res) => this.mcp!.handleRequest(req, res));
    console.log("[0canvas] MCP server mounted at /mcp");

    // 5. Start file watcher
    await this.watcher.start();

    // 5. Write .0canvas/.port file
    this.writePortFile(this.actualPort);

    // 6. Generate .mcp.json if not present (for AI tool auto-discovery)
    this.writeMcpConfig(this.actualPort);

    this.running = true;
    const elapsed = Date.now() - startTime;
    console.log(`[0canvas] Engine ready on port ${this.actualPort} (${elapsed}ms)`);
  }

  /**
   * Stop the engine gracefully.
   */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.mcp) {
      await this.mcp.stop();
    }
    await this.watcher.stop();
    await this.server.stop();
    this.removePortFile();

    console.log("[0canvas] Engine stopped");
  }

  // ── Message Routing ────────────────────────────────────

  private async handleMessage(msg: EngineMessage, ws: WebSocket): Promise<void> {
    switch (msg.type) {
      case "STYLE_CHANGE":
        await this.handleStyleChange(msg, ws);
        break;
      case "REQUEST_SOURCE_MAP":
        await this.handleSourceMap(msg, ws);
        break;
      case "TAILWIND_CLASS_CHANGE":
        await this.handleTailwindChange(msg);
        break;
      case "PROJECT_STATE_SYNC":
        this.handleProjectSync(msg);
        break;
      case "AI_CHAT_REQUEST":
        this.handleAIChatRequest(msg, ws);
        break;
      case "CONNECTED":
        // Browser announced itself — already handled in onConnect
        break;
      case "HEARTBEAT":
        // No response needed
        break;
      default:
        break;
    }
  }

  /**
   * STYLE_CHANGE: Resolve CSS source → write file → send ACK
   * Ported from extensions/vscode/src/handlers/style-handler.ts
   */
  private async handleStyleChange(msg: EngineMessage, ws: WebSocket): Promise<void> {
    if (msg.type !== "STYLE_CHANGE") return;
    console.log(`[0canvas] STYLE_CHANGE: ${msg.selector} { ${msg.property}: ${msg.value} }`);

    const location = await this.resolver.resolve(msg.selector, msg.property);

    if (!location) {
      this.server.send(ws, createMessage({
        type: "STYLE_CHANGE_ACK",
        source: "engine",
        requestId: msg.id,
        success: false,
        error: `Could not find "${msg.property}" for selector "${msg.selector}" in any CSS file`,
      }));
      return;
    }

    const result = this.writer.write(location.file, location.line, msg.property, msg.value);

    this.server.send(ws, createMessage({
      type: "STYLE_CHANGE_ACK",
      source: "engine",
      requestId: msg.id,
      success: result.success,
      file: result.file,
      line: result.line,
      error: result.error,
    }));

    if (result.success) {
      console.log(`[0canvas] Written: ${result.file}:${result.line}`);
    } else {
      console.warn(`[0canvas] Write failed: ${result.error}`);
    }
  }

  /**
   * REQUEST_SOURCE_MAP: Resolve selector → send result
   * Ported from extensions/vscode/src/handlers/source-map-handler.ts
   */
  private async handleSourceMap(msg: EngineMessage, ws: WebSocket): Promise<void> {
    if (msg.type !== "REQUEST_SOURCE_MAP") return;

    const location = await this.resolver.resolve(msg.selector, msg.property);

    if (location) {
      this.server.send(ws, createMessage({
        type: "SOURCE_MAP_RESULT",
        source: "engine",
        requestId: msg.id,
        selector: msg.selector,
        file: location.relPath,
        line: location.line,
        column: location.column,
      }));
    } else {
      this.server.send(ws, createMessage({
        type: "ERROR",
        source: "engine",
        code: "SOURCE_NOT_FOUND",
        message: `Could not resolve source for "${msg.selector}"`,
        requestId: msg.id,
      }));
    }
  }

  /**
   * TAILWIND_CLASS_CHANGE: Modify className in JSX/TSX
   * Ported from extensions/vscode/src/handlers/tailwind-handler.ts
   */
  private async handleTailwindChange(msg: EngineMessage): Promise<void> {
    if (msg.type !== "TAILWIND_CLASS_CHANGE") return;
    console.log(`[0canvas] TAILWIND_CLASS_CHANGE: ${msg.action} "${msg.className}" on ${msg.selector}`);

    const result = await this.tailwindWriter.writeClassChange(msg.selector, msg.action, msg.className);
    if (result.success) {
      console.log(`[0canvas] Tailwind written: ${result.file}`);
    } else {
      console.warn(`[0canvas] Tailwind write failed: ${result.error}`);
    }
  }

  /**
   * PROJECT_STATE_SYNC: Save .0c file to disk
   * Ported from extensions/vscode/src/handlers/sync-handler.ts
   */
  private handleProjectSync(msg: EngineMessage): void {
    if (msg.type !== "PROJECT_STATE_SYNC") return;

    const fileName = msg.filePath || "project.0c";
    const success = this.ocManager.writeProject(
      path.join(this.root, fileName),
      msg.projectFile
    );

    if (success) {
      console.log(`[0canvas] Saved -> ${fileName}`);
    }
  }

  /**
   * AI_CHAT_REQUEST: Build context + write to .0canvas/ai-request.md
   * Ported from extensions/vscode/src/handlers/ai-handler.ts
   * (minus VS Code clipboard/command APIs — just writes file)
   */
  private handleAIChatRequest(msg: EngineMessage, ws: WebSocket): void {
    if (msg.type !== "AI_CHAT_REQUEST") return;
    console.log(`[0canvas] AI_CHAT_REQUEST: "${msg.query}"`);

    try {
      const contextMarkdown = buildAIContext(msg, this.root);

      // Write context to file
      const contextDir = path.join(this.root, ".0canvas");
      if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(contextDir, "ai-request.md"),
        contextMarkdown,
        "utf-8"
      );

      this.server.send(ws, createMessage({
        type: "AI_CHAT_RESPONSE",
        source: "engine",
        requestId: msg.id,
        success: true,
        message: `Context saved to .0canvas/ai-request.md — your AI agent can read it from there.`,
      }));
    } catch (err) {
      this.server.send(ws, createMessage({
        type: "AI_CHAT_RESPONSE",
        source: "engine",
        requestId: msg.id,
        success: false,
        message: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }));
    }
  }

  // ── Connection Handling ────────────────────────────────

  /**
   * When a browser connects, send ENGINE_READY + all .0c files.
   */
  private async handleConnect(ws: WebSocket): Promise<void> {
    console.log("[0canvas] Browser connected");

    // Send engine ready message
    this.server.send(ws, createMessage({
      type: "ENGINE_READY",
      source: "engine",
      version: VERSION,
      root: this.root,
      framework: this.framework,
      port: this.actualPort,
    }));

    // Send all .0c files
    try {
      const projects = await this.ocManager.listProjects();
      for (const project of projects) {
        this.server.send(ws, createMessage({
          type: "PROJECT_STATE_LOADED",
          source: "engine",
          projectFile: JSON.stringify(project.content),
          filePath: project.relPath,
        }));
        console.log(`[0canvas] Sent .0c -> browser: ${project.relPath}`);
      }
    } catch (err) {
      console.error("[0canvas] Failed to send .0c files:", err);
    }
  }

  // ── File Change Handling ───────────────────────────────

  private handleFileChange(filePath: string, type: string, fileType: "css" | "oc" | "jsx" | "other"): void {
    const relPath = path.relative(this.root, filePath);

    if (fileType === "css") {
      console.log(`[0canvas] CSS ${type}: ${relPath}`);
      // Notify browser that a CSS file changed (so it can re-inspect if needed)
      this.server.broadcast(createMessage({
        type: "CSS_FILE_CHANGED",
        source: "engine",
        file: relPath,
      }));
    }

    if (fileType === "oc") {
      console.log(`[0canvas] .0c ${type}: ${relPath}`);
      // Notify browser about .0c file changes (external edits, e.g. git pull)
      this.server.broadcast(createMessage({
        type: "OC_FILE_CHANGED",
        source: "engine",
        filePath: relPath,
        action: type as "created" | "updated" | "deleted",
      }));
    }
  }

  // ── Port File ──────────────────────────────────────────

  private writePortFile(port: number): void {
    try {
      const dir = path.join(this.root, ".0canvas");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, ".port"), String(port), "utf-8");
    } catch (err) {
      console.error("[0canvas] Failed to write port file:", err);
    }
  }

  private removePortFile(): void {
    try {
      const portFile = path.join(this.root, ".0canvas", ".port");
      if (fs.existsSync(portFile)) fs.unlinkSync(portFile);
    } catch {
      // Ignore cleanup errors
    }
  }

  // ── MCP Config ─────────────────────────────────────────

  private writeMcpConfig(port: number): void {
    const mcpUrl = `http://localhost:${port}/mcp`;

    // .mcp.json — Claude Code, Cursor, and other MCP-aware tools
    const mcpJsonPath = path.join(this.root, ".mcp.json");
    if (!fs.existsSync(mcpJsonPath)) {
      try {
        const config = {
          mcpServers: {
            "0canvas": {
              type: "http",
              url: mcpUrl,
            },
          },
        };
        fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2), "utf-8");
        console.log("[0canvas] Generated .mcp.json");
      } catch {
        // Non-critical
      }
    }

    // .vscode/mcp.json — VS Code Copilot compatibility
    const vscodeMcpPath = path.join(this.root, ".vscode", "mcp.json");
    if (!fs.existsSync(vscodeMcpPath)) {
      try {
        const vscodeDir = path.join(this.root, ".vscode");
        if (!fs.existsSync(vscodeDir)) {
          fs.mkdirSync(vscodeDir, { recursive: true });
        }
        const config = {
          servers: {
            "0canvas": {
              type: "http",
              url: mcpUrl,
            },
          },
        };
        fs.writeFileSync(vscodeMcpPath, JSON.stringify(config, null, 2), "utf-8");
        console.log("[0canvas] Generated .vscode/mcp.json");
      } catch {
        // Non-critical
      }
    }
  }
}

// ── AI Context Builder ───────────────────────────────────
// Ported from extensions/vscode/src/ai-context.ts
// (removed unused vscode import)

function buildAIContext(
  request: { query: string; selector?: string; styles?: Record<string, string>; route?: string },
  workspaceRoot: string
): string {
  const lines: string[] = [];

  lines.push("# 0canvas Design Request");
  lines.push("");
  lines.push(`**Designer's request:** ${request.query}`);
  lines.push("");

  if (request.selector) {
    lines.push("## Selected Element");
    lines.push(`- **Selector:** \`${request.selector}\``);
    lines.push("");
  }

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

  if (request.route) {
    lines.push(`**Current route:** \`${request.route}\``);
    lines.push("");
  }

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

  lines.push("## Instructions");
  lines.push("- Make the requested change to the **source files** in this project.");
  lines.push("- The browser will hot-reload automatically via the dev server's HMR.");
  lines.push("- Prefer editing CSS files or Tailwind classes over inline styles.");
  lines.push("- If the element uses CSS variables/tokens, prefer changing the token value.");
  lines.push("- After making changes, briefly describe what you changed.");
  lines.push("");

  return lines.join("\n");
}
