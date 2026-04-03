import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startBridge } from "./bridge";
import { registerTools } from "./tools";

const DEFAULT_PORT = 24192;

async function main() {
  const port = parseInt(process.env.ZEROCANVAS_PORT || String(DEFAULT_PORT), 10);

  const server = new McpServer({
    name: "0canvas",
    version: "1.0.0",
  });

  registerTools(server);

  const actualPort = await startBridge(port);
  console.error(`[ZeroCanvas MCP] Bridge running on port ${actualPort}`);
  console.error(`[ZeroCanvas MCP] Connecting via stdio transport...`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[ZeroCanvas MCP] Server connected and ready.`);
}

main().catch((err) => {
  console.error("[ZeroCanvas MCP] Fatal error:", err);
  process.exit(1);
});
