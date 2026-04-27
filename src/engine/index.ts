// ──────────────────────────────────────────────────────────
// ZerosEngine — The heart of Zeros V2
// ──────────────────────────────────────────────────────────
//
// Standalone Node.js process that:
//   - Reads and writes CSS/source files directly
//   - Serves the design workspace via WebSocket
//   - Manages .0c design files on disk
//   - Exposes MCP endpoint for AI tools (Phase 1B)
//
// Usage:
//   const engine = new ZerosEngine({ port: 24193 });
//   await engine.start();
//
// ──────────────────────────────────────────────────────────

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { WebSocket } from "ws";

import { EngineCache } from "./cache";
import { CSSResolver } from "./css-resolver";
import { CSSFileWriter } from "./css-writer";
import { TailwindWriter } from "./tailwind-writer";
import { OCManager } from "./oc-manager";
import { FileWatcher } from "./watcher";
import { EngineServer } from "./server";
import { ZerosMcp } from "./mcp";
import { AgentGateway } from "./agents/gateway";
import { detectFramework, findProjectRoot, type Framework } from "./framework-detector";
import { createMessage, type EngineMessage } from "./types";

const VERSION = "0.0.5";

export interface EngineOptions {
  root?: string;
  port?: number;
}

export class ZerosEngine {
  private cache: EngineCache;
  private resolver: CSSResolver;
  private writer: CSSFileWriter;
  private tailwindWriter: TailwindWriter;
  private ocManager: OCManager;
  private watcher: FileWatcher;
  private server: EngineServer;
  private mcp: ZerosMcp | null = null;
  // Native per-CLI adapter runtime — multiplexes the per-agent
  // adapter implementations behind a single gateway surface.
  private agents: AgentGateway;

  private root: string;
  private port: number;
  private actualPort = 0;
  private framework: Framework = "unknown";
  private running = false;

  /**
   * Latest selection the browser reported. The MCP server's get_selection
   * tool reads this so the agent always knows what the designer is looking
   * at. Null means nothing is selected; the agent should treat that as
   * "ask the designer what they want me to work on" rather than an error.
   */
  private currentSelection: {
    selector: string;
    tagName: string;
    className: string;
    computedStyles: Record<string, string>;
    updatedAt: number;
  } | null = null;

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

    // Native agent gateway — spawns agents on demand and fans notifications
    // over the same WebSocket the renderer is already listening on.
    // Credentials never cross this boundary; the agent owns its own auth.
    const projectRoot = this.root;
    const resolveInsideRoot = (raw: string): string => {
      const full = path.isAbsolute(raw)
        ? path.resolve(raw)
        : path.resolve(projectRoot, raw);
      const rel = path.relative(projectRoot, full);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new Error(`Path escapes project root: ${raw}`);
      }
      return full;
    };
    const backendOpts = {
      projectRoot: this.root,
      events: {
        onSessionUpdate: (agentId: string, notification: unknown) => {
          this.server.broadcast(createMessage({
            type: "AGENT_SESSION_UPDATE",
            source: "engine",
            agentId,
            notification: notification as never,
          }));
        },
        onPermissionRequest: (agentId: string, permissionId: string, request: unknown) => {
          this.server.broadcast(createMessage({
            type: "AGENT_PERMISSION_REQUEST",
            source: "engine",
            agentId,
            permissionId,
            request: request as never,
          }));
        },
        onAgentStderr: (agentId: string, line: string) => {
          this.server.broadcast(createMessage({
            type: "AGENT_AGENT_STDERR",
            source: "engine",
            agentId,
            line,
          }));
        },
        onAgentExit: (agentId: string, code: number | null, signal: string | null) => {
          this.server.broadcast(createMessage({
            type: "AGENT_AGENT_EXITED",
            source: "engine",
            agentId,
            code,
            signal: signal ? String(signal) : null,
          }));
        },
      },
      fs: {
        async readTextFile({ path: p }: { path: string }) {
          const full = resolveInsideRoot(p);
          const content = await fsp.readFile(full, "utf-8");
          return { content };
        },
        async writeTextFile({ path: p, content }: { path: string; content: string }) {
          const full = resolveInsideRoot(p);
          await fsp.mkdir(path.dirname(full), { recursive: true });
          await fsp.writeFile(full, content, "utf-8");
          return {};
        },
      },
    };

    this.agents = new AgentGateway(backendOpts as never);
    console.log(`[Zeros] Agent backend: native`);

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

    console.log(`[Zeros] Project root: ${this.root}`);
    console.log(`[Zeros] Framework: ${this.framework}`);

    // 2. Build CSS selector index
    await this.cache.buildIndex();
    const stats = this.cache.stats();
    console.log(`[Zeros] Index built: ${stats.selectors} selectors, ${stats.files} files, ${stats.tokens} tokens`);

    // 3. Start HTTP + WebSocket server
    this.actualPort = await this.server.start();

    // 4. Start MCP server (mounted on /mcp)
    this.mcp = new ZerosMcp({
      root: this.root,
      cache: this.cache,
      resolver: this.resolver,
      writer: this.writer,
      ocManager: this.ocManager,
      engineServer: this.server,
      getSelection: () => this.currentSelection,
    });
    this.server.setMcpHandler((req, res) => this.mcp!.handleRequest(req, res));
    console.log("[Zeros] MCP server mounted at /mcp");

    // Register the MCP endpoint with the native agent gateway. Every new
    // agent session can attach this endpoint so the agent gets our 5 design
    // tools without per-agent user configuration.
    this.agents.registerMcpServer({
      name: "Zeros",
      url: `http://127.0.0.1:${this.actualPort}/mcp`,
    });
    console.log(`[Zeros] MCP auto-attach enabled for agent sessions`);

    // 5. Start file watcher
    await this.watcher.start();

    // 5. Write .zeros/.port file
    this.writePortFile(this.actualPort);

    // 6. Generate .mcp.json if not present (for AI tool auto-discovery)
    this.writeMcpConfig(this.actualPort);

    this.running = true;
    const elapsed = Date.now() - startTime;
    console.log(`[Zeros] Engine ready on port ${this.actualPort} (${elapsed}ms)`);
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
    await this.agents.dispose();
    await this.watcher.stop();
    await this.server.stop();
    this.removePortFile();

    console.log("[Zeros] Engine stopped");
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
      case "ELEMENT_SELECTED":
        this.handleElementSelected(msg);
        break;
      case "AGENT_LIST_AGENTS":
      case "AGENT_NEW_SESSION":
      case "AGENT_INIT_AGENT":
      case "AGENT_AUTHENTICATE":
      case "AGENT_PROMPT":
      case "AGENT_CANCEL":
      case "AGENT_PERMISSION_RESPONSE":
      case "AGENT_SET_MODE":
      case "AGENT_LIST_SESSIONS":
      case "AGENT_LOAD_SESSION":
        await this.handleAcpMessage(msg, ws);
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
   * Cache the latest selection reported by the browser. Exposed as the
   * Zeros_get_selection MCP tool so the agent sees what the designer is
   * focused on without the user having to retype a selector.
   */
  private handleElementSelected(msg: EngineMessage): void {
    if (msg.type !== "ELEMENT_SELECTED") return;
    if (!msg.selector) {
      this.currentSelection = null;
      return;
    }
    this.currentSelection = {
      selector: msg.selector,
      tagName: msg.tagName,
      className: msg.className,
      computedStyles: msg.computedStyles,
      updatedAt: Date.now(),
    };
  }

  /**
   * Dispatch AGENT_* messages from the renderer to the native agent gateway.
   * Responses fan back out via the shared WebSocket; permission prompts are
   * pushed proactively by the gateway (not via this request path).
   */
  private async handleAcpMessage(msg: EngineMessage, ws: WebSocket): Promise<void> {
    // Diagnostic: log every AGENT_* message at the dispatch boundary so
    // we can tell from main.log whether prompts are even reaching the
    // engine. Used to triage "user sent codex prompt, no response" —
    // without this the only visible log was occasional adapter creation,
    // and any "request never made it to the engine" bug was invisible.
    {
      const requestId = (msg as { id?: string }).id;
      const agentId = (msg as { agentId?: string }).agentId;
      const sessionId = (msg as { sessionId?: string }).sessionId;
      // eslint-disable-next-line no-console
      console.log(
        `[agents] dispatch ${msg.type}` +
          (agentId ? ` agent=${agentId}` : "") +
          (sessionId ? ` session=${sessionId.slice(0, 8)}…` : "") +
          (requestId ? ` reqId=${requestId.slice(0, 8)}…` : ""),
      );
    }
    try {
      switch (msg.type) {
        case "AGENT_LIST_AGENTS": {
          const agents = msg.force
            ? await this.agents.refreshRegistry()
            : await this.agents.listAgents();
          this.server.send(ws, createMessage({
            type: "AGENT_AGENTS_LIST",
            source: "engine",
            requestId: msg.id,
            agents,
          }));
          return;
        }
        case "AGENT_NEW_SESSION": {
          const initialize = await this.agents.ensureAgent(msg.agentId, { env: msg.env });
          const session = await this.agents.newSession(msg.agentId, {
            cwd: msg.cwd,
            env: msg.env,
          });
          this.server.send(ws, createMessage({
            type: "AGENT_SESSION_CREATED",
            source: "engine",
            requestId: msg.id,
            agentId: msg.agentId,
            session,
            initialize,
          }));
          return;
        }
        case "AGENT_INIT_AGENT": {
          // Spawns the subprocess with empty env (if not already running)
          // so the auth screen can read the agent's advertised auth methods.
          // Providing a real env later (via AGENT_NEW_SESSION) will transparently
          // respawn the subprocess when needed.
          const initialize = await this.agents.initializeAgent(msg.agentId);
          this.server.send(ws, createMessage({
            type: "AGENT_AGENT_INITIALIZED",
            source: "engine",
            requestId: msg.id,
            agentId: msg.agentId,
            initialize,
          }));
          return;
        }
        case "AGENT_AUTHENTICATE": {
          await this.agents.authenticate(msg.agentId, msg.methodId);
          this.server.send(ws, createMessage({
            type: "AGENT_AUTH_COMPLETED",
            source: "engine",
            requestId: msg.id,
            agentId: msg.agentId,
            methodId: msg.methodId,
          }));
          return;
        }
        case "AGENT_PROMPT": {
          try {
            const response = await this.agents.prompt(msg.agentId, msg.sessionId, msg.prompt);
            this.server.send(ws, createMessage({
              type: "AGENT_PROMPT_COMPLETE",
              source: "engine",
              requestId: msg.id,
              agentId: msg.agentId,
              sessionId: msg.sessionId,
              stopReason: response.stopReason,
              response,
            }));
          } catch (err) {
            this.server.send(ws, createMessage({
              type: "AGENT_PROMPT_FAILED",
              source: "engine",
              requestId: msg.id,
              agentId: msg.agentId,
              sessionId: msg.sessionId,
              error: err instanceof Error ? err.message : String(err),
            }));
          }
          return;
        }
        case "AGENT_CANCEL": {
          await this.agents.cancel(msg.agentId, msg.sessionId);
          return;
        }
        case "AGENT_PERMISSION_RESPONSE": {
          this.agents.answerPermission(msg.permissionId, msg.response);
          return;
        }
        case "AGENT_SET_MODE": {
          await this.agents.setMode(msg.agentId, msg.sessionId, msg.modeId);
          this.server.send(ws, createMessage({
            type: "AGENT_MODE_CHANGED",
            source: "engine",
            requestId: msg.id,
            agentId: msg.agentId,
            sessionId: msg.sessionId,
            modeId: msg.modeId,
          }));
          return;
        }
        case "AGENT_LIST_SESSIONS": {
          const resp = await this.agents.listSessions(msg.agentId, {
            cwd: msg.cwd,
            cursor: msg.cursor,
          });
          this.server.send(ws, createMessage({
            type: "AGENT_SESSIONS_LIST",
            source: "engine",
            requestId: msg.id,
            agentId: msg.agentId,
            sessions: resp.sessions,
            nextCursor: resp.nextCursor ?? null,
          }));
          return;
        }
        case "AGENT_LOAD_SESSION": {
          const response = await this.agents.loadSession(
            msg.agentId,
            msg.sessionId,
            { cwd: msg.cwd, env: msg.env },
          );
          this.server.send(ws, createMessage({
            type: "AGENT_SESSION_LOADED",
            source: "engine",
            requestId: msg.id,
            agentId: msg.agentId,
            sessionId: msg.sessionId,
            response,
          }));
          return;
        }
      }
    } catch (err) {
      const agentId =
        "agentId" in msg ? (msg as { agentId?: string }).agentId : undefined;
      // Structured AgentFailure classification travels alongside the
      // free-form message so the UI can route deterministically on
      // failure.kind. The AgentFailureError class is the native
      // gateway's structured error boundary.
      const { AgentFailureError } = await import("./agents/types.js");
      const message = err instanceof Error ? err.message : String(err);
      const failure =
        err instanceof AgentFailureError ? err.failure : undefined;
      this.server.send(ws, createMessage({
        type: "AGENT_ERROR",
        source: "engine",
        requestId: msg.id,
        agentId,
        code: failure?.kind
          ? `AGENT_${failure.kind.toUpperCase().replace(/-/g, "_")}`
          : "AGENT_DISPATCH_FAILED",
        message,
        failure,
      }));
    }
  }

  /**
   * STYLE_CHANGE: Resolve CSS source → write file → send ACK
   * Ported from extensions/vscode/src/handlers/style-handler.ts
   */
  private async handleStyleChange(msg: EngineMessage, ws: WebSocket): Promise<void> {
    if (msg.type !== "STYLE_CHANGE") return;
    console.log(`[Zeros] STYLE_CHANGE: ${msg.selector} { ${msg.property}: ${msg.value} }`);

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
      console.log(`[Zeros] Written: ${result.file}:${result.line}`);
    } else {
      console.warn(`[Zeros] Write failed: ${result.error}`);
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
    console.log(`[Zeros] TAILWIND_CLASS_CHANGE: ${msg.action} "${msg.className}" on ${msg.selector}`);

    const result = await this.tailwindWriter.writeClassChange(msg.selector, msg.action, msg.className);
    if (result.success) {
      console.log(`[Zeros] Tailwind written: ${result.file}`);
    } else {
      console.warn(`[Zeros] Tailwind write failed: ${result.error}`);
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
      console.log(`[Zeros] Saved -> ${fileName}`);
    }
  }

  /**
   * AI_CHAT_REQUEST: Build context + write to .zeros/ai-request.md
   * Ported from extensions/vscode/src/handlers/ai-handler.ts
   * (minus VS Code clipboard/command APIs — just writes file)
   */
  private handleAIChatRequest(msg: EngineMessage, ws: WebSocket): void {
    if (msg.type !== "AI_CHAT_REQUEST") return;
    console.log(`[Zeros] AI_CHAT_REQUEST: "${msg.query}"`);

    try {
      const contextMarkdown = buildAIContext(msg, this.root);

      // Write context to file
      const contextDir = path.join(this.root, ".zeros");
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
        message: `Context saved to .zeros/ai-request.md — your AI agent can read it from there.`,
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
    console.log("[Zeros] Browser connected");

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
        console.log(`[Zeros] Sent .0c -> browser: ${project.relPath}`);
      }
    } catch (err) {
      console.error("[Zeros] Failed to send .0c files:", err);
    }
  }

  // ── File Change Handling ───────────────────────────────

  private handleFileChange(filePath: string, type: string, fileType: "css" | "oc" | "jsx" | "other"): void {
    const relPath = path.relative(this.root, filePath);

    if (fileType === "css") {
      console.log(`[Zeros] CSS ${type}: ${relPath}`);
      // Notify browser that a CSS file changed (so it can re-inspect if needed)
      this.server.broadcast(createMessage({
        type: "CSS_FILE_CHANGED",
        source: "engine",
        file: relPath,
      }));
    }

    if (fileType === "oc") {
      console.log(`[Zeros] .0c ${type}: ${relPath}`);
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
      const dir = path.join(this.root, ".zeros");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, ".port"), String(port), "utf-8");
    } catch (err) {
      console.error("[Zeros] Failed to write port file:", err);
    }
  }

  private removePortFile(): void {
    try {
      const portFile = path.join(this.root, ".zeros", ".port");
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
            "Zeros": {
              type: "http",
              url: mcpUrl,
            },
          },
        };
        fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2), "utf-8");
        console.log("[Zeros] Generated .mcp.json");
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
            "Zeros": {
              type: "http",
              url: mcpUrl,
            },
          },
        };
        fs.writeFileSync(vscodeMcpPath, JSON.stringify(config, null, 2), "utf-8");
        console.log("[Zeros] Generated .vscode/mcp.json");
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

  lines.push("# Zeros Design Request");
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
    const feedbackPath = path.join(workspaceRoot, ".zeros", "feedback.md");
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
