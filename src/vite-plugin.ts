// ──────────────────────────────────────────────────────────
// ZeroCanvas Vite Plugin — Starts engine in-process
// ──────────────────────────────────────────────────────────
//
// Usage in vite.config.ts:
//
//   import { zeroCanvas } from "@zerosdesign/0canvas/vite";
//   export default defineConfig({
//     plugins: [react(), zeroCanvas()],
//   });
//
// The plugin:
//   1. Starts the 0canvas engine in-process (no separate terminal)
//   2. Optionally auto-injects the overlay script into HTML
//   3. Stops the engine on server close
//
// This is a convenience wrapper. The engine can also run
// standalone via `npx 0canvas serve`.
//
// ──────────────────────────────────────────────────────────

import type { Plugin, ViteDevServer } from "vite";

export interface ZeroCanvasPluginOptions {
  /** Engine port. Default: 24193 */
  port?: number;
  /** Auto-inject the overlay script into index.html. Default: false */
  inject?: boolean;
}

export function zeroCanvas(options?: ZeroCanvasPluginOptions): Plugin {
  const port = options?.port ?? 24193;
  const inject = options?.inject ?? false;
  let engine: any = null;
  let projectRoot = "";

  return {
    name: "0canvas",
    apply: "serve",

    configResolved(config) {
      projectRoot = config.root;
    },

    async configureServer(server: ViteDevServer) {
      // Start the engine in-process
      try {
        const { ZeroCanvasEngine } = await import("./engine/index");
        engine = new ZeroCanvasEngine({ root: projectRoot, port });
        await engine.start();
      } catch (err) {
        console.error("[0canvas] Failed to start engine:", err);
      }

      // Stop engine when Vite server closes
      const httpServer = server.httpServer;
      if (httpServer) {
        httpServer.on("close", async () => {
          if (engine) {
            await engine.stop();
            engine = null;
          }
        });
      }
    },

    // Auto-inject the overlay component into HTML
    transformIndexHtml(html) {
      if (!inject) return html;

      // Inject before </body>
      const script = `
    <script type="module">
      import { ZeroCanvas } from "@zerosdesign/0canvas";
      // Auto-injected by 0canvas Vite plugin
    </script>`;

      return html.replace("</body>", `${script}\n  </body>`);
    },

    async buildEnd() {
      if (engine) {
        await engine.stop();
        engine = null;
      }
    },
  };
}

export default zeroCanvas;
