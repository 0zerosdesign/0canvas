// ──────────────────────────────────────────────────────────
// ZeroCanvas Vite Plugin — Zero-config dev server integration
// ──────────────────────────────────────────────────────────
//
// Usage in vite.config.ts:
//
//   import { zeroCanvas } from "@zerosdesign/0canvas/vite";
//   export default defineConfig({
//     plugins: [react(), zeroCanvas()],
//   });
//
// What it does:
//   1. Starts the MCP bridge HTTP server when the Vite dev server starts
//   2. Detects which IDE launched the dev server (Cursor, VS Code, etc.)
//   3. Injects __ZEROCANVAS_MCP_PORT__ and __ZEROCANVAS_IDE__ into the page
//   4. The <ZeroCanvas /> client reads these for instant auto-connection
//
// ──────────────────────────────────────────────────────────

import type { Plugin } from "vite";

export interface ZeroCanvasPluginOptions {
  /** MCP bridge port. Default: 24192 */
  port?: number;
  /** Override IDE detection. Default: auto-detect from environment */
  ide?: string;
}

/** Detect which IDE launched the process by checking environment variables */
function detectIDE(): string | null {
  const env = process.env;

  // Cursor-specific env vars (not always set)
  if (env.CURSOR_TRACE_ID || env.CURSOR_CLI_PATH || env.CURSOR_CHANNEL) return "cursor";

  // Windsurf / Codeium
  if (env.WINDSURF_PATH || env.CODEIUM_PATH) return "windsurf";

  // Claude Code (Anthropic CLI)
  if (env.CLAUDE_CODE || env.ANTHROPIC_API_KEY) return "claude-code";

  // VS Code family — Cursor is a VS Code fork, so VSCODE_* vars are set in both.
  // Distinguish by checking if any VSCODE_* path values contain "cursor".
  if (env.VSCODE_PID || env.VSCODE_CWD || env.VSCODE_IPC_HOOK) {
    const vsVals = [
      env.VSCODE_GIT_ASKPASS_NODE,
      env.VSCODE_GIT_ASKPASS_MAIN,
      env.VSCODE_IPC_HOOK,
      env.VSCODE_CWD,
      env.TERM_PROGRAM,
    ].join(" ").toLowerCase();
    if (vsVals.includes("cursor")) return "cursor";
    if (vsVals.includes("windsurf")) return "windsurf";
    return "vscode";
  }

  // Fallback: TERM_PROGRAM
  const term = (env.TERM_PROGRAM || "").toLowerCase();
  if (term.includes("cursor")) return "cursor";
  if (term.includes("vscode")) return "vscode";

  return null;
}

export function zeroCanvas(options?: ZeroCanvasPluginOptions): Plugin {
  const port = options?.port || 24192;
  const ideOverride = options?.ide || null;
  let actualPort = port;
  let detectedIDE: string | null = null;
  let bridgeStarted = false;

  return {
    name: "0canvas",
    apply: "serve", // Only run during dev server, not production builds

    configureServer() {
      if (bridgeStarted) return;
      bridgeStarted = true;

      detectedIDE = ideOverride || detectIDE();

      // Start the bridge HTTP server (dynamic import to avoid issues in non-Node contexts)
      import("./mcp/bridge.js").then(({ startBridge }) => {
        startBridge(port)
          .then((p: number) => {
            actualPort = p;
            const ideLabel = detectedIDE ? ` (IDE: ${detectedIDE})` : "";
            console.log(
              `\n  \x1b[36m0canvas\x1b[0m  MCP bridge → http://127.0.0.1:${actualPort}${ideLabel}\n`
            );
          })
          .catch((err: Error) => {
            console.warn(`[0canvas] Failed to start MCP bridge: ${err.message}`);
          });
      }).catch(() => {
        // Bridge module not available (e.g. in browser context) — skip silently
      });
    },

    transformIndexHtml() {
      const ide = detectedIDE;
      return [
        {
          tag: "script",
          children: [
            `window.__ZEROCANVAS_MCP_PORT__=${actualPort};`,
            `window.__ZEROCANVAS_IDE__=${JSON.stringify(ide)};`,
          ].join(""),
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

export default zeroCanvas;
