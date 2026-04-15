// ──────────────────────────────────────────────────────────
// 0canvas CLI
// ──────────────────────────────────────────────────────────
//
// Usage:
//   npx 0canvas serve           — Start the engine
//   npx 0canvas serve --port N  — Custom port (default: 24193)
//   npx 0canvas serve --root .  — Custom project root
//   npx 0canvas init            — Scaffold project.0c
//   npx 0canvas status          — Check engine health
//   npx 0canvas --help          — Show usage
//
// ──────────────────────────────────────────────────────────

import * as fs from "node:fs";
import * as path from "node:path";
import { detectFramework, findProjectRoot } from "./engine/framework-detector";
import { createEmptyProjectFile, serializeProjectFile } from "./0canvas/format/oc-project";

// ── Generate project ID ───────────────────────────────────

function generateProjectId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "proj_";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ── Init command ──────────────────────────────────────────

function runInit(cwd: string, nameOverride?: string) {
  const outputFile = path.join(cwd, "project.0c");

  if (fs.existsSync(outputFile)) {
    console.log("\n  \x1b[33mproject.0c already exists.\x1b[0m");
    console.log("  Delete it first if you want to reinitialize.\n");
    process.exit(1);
  }

  console.log("\n  \x1b[36m0canvas\x1b[0m  Initializing project...\n");

  const detection = detectFramework(cwd);
  const projectName = nameOverride || detection.projectName;

  console.log(`  Framework:    \x1b[1m${detection.framework}\x1b[0m`);
  console.log(`  Entry files:  \x1b[1m${detection.entryFiles.join(", ")}\x1b[0m`);
  console.log(`  Project name: \x1b[1m${projectName}\x1b[0m`);

  const project = {
    id: generateProjectId(),
    name: projectName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    appUrl: "http://localhost:5173",
    saved: false,
  };

  const projectFile = createEmptyProjectFile(project, detection.framework);
  projectFile.workspace.entryFiles = detection.entryFiles;

  const json = serializeProjectFile(projectFile);
  fs.writeFileSync(outputFile, json, "utf-8");

  console.log(`\n  \x1b[32m\u2713\x1b[0m Created \x1b[1mproject.0c\x1b[0m\n`);
  console.log("  \x1b[2mNext steps:\x1b[0m");
  console.log("  1. Start the engine:");
  console.log("     \x1b[36mnpx 0canvas serve\x1b[0m");
  console.log("  2. Start your dev server:");
  console.log("     \x1b[36mnpm run dev\x1b[0m");
  console.log("  3. Open your app in the browser and press Ctrl+Shift+D.\n");
}

// ── Serve command ─────────────────────────────────────────

async function runServe(cwd: string, port: number, rootOverride?: string) {
  const root = rootOverride ? path.resolve(rootOverride) : findProjectRoot(cwd);

  console.log("");
  console.log("  \x1b[36m0canvas\x1b[0m  Starting engine...");
  console.log("");

  // Dynamic import to avoid loading heavy deps for other commands
  const { ZeroCanvasEngine } = await import("./engine/index");
  const engine = new ZeroCanvasEngine({ root, port });

  const shutdown = async () => {
    console.log("\n[0canvas] Shutting down...");
    await engine.stop();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGHUP", shutdown);

  try {
    await engine.start();
    console.log("");
    console.log("  \x1b[2mPress Ctrl+C to stop.\x1b[0m");
    console.log("");
  } catch (err) {
    console.error("\n  \x1b[31mFailed to start engine:\x1b[0m", err);
    process.exit(1);
  }
}

// ── Status command ────────────────────────────────────────

async function runStatus(port: number) {
  const url = `http://localhost:${port}/health`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    console.log("\n  \x1b[36m0canvas\x1b[0m  Engine Status\n");
    console.log(`  Status:       \x1b[32m${data.status}\x1b[0m`);
    console.log(`  Version:      ${data.version}`);
    console.log(`  Connections:  ${data.connections}`);
    if (data.stats) {
      console.log(`  Selectors:    ${data.stats.selectors}`);
      console.log(`  CSS files:    ${data.stats.files}`);
      console.log(`  Tokens:       ${data.stats.tokens}`);
    }
    console.log("");
  } catch {
    console.log("\n  \x1b[33m0canvas engine is not running on port " + port + ".\x1b[0m");
    console.log("  Start it with: \x1b[36mnpx 0canvas serve\x1b[0m\n");
  }
}

// ── Help ──────────────────────────────────────────────────

function showHelp() {
  console.log(`
  \x1b[36m0canvas\x1b[0m — Design tool that runs on your production code

  \x1b[1mUsage:\x1b[0m
    npx 0canvas <command> [options]

  \x1b[1mCommands:\x1b[0m
    serve         Start the 0canvas engine (design server)
    init          Scaffold a project.0c file
    status        Check if the engine is running

  \x1b[1mServe Options:\x1b[0m
    --port <n>    Port number (default: 24193)
    --root <dir>  Project root directory (default: auto-detect)

  \x1b[1mInit Options:\x1b[0m
    --name <n>    Override the project name

  \x1b[1mExamples:\x1b[0m
    npx 0canvas serve
    npx 0canvas serve --port 3001
    npx 0canvas init --name "my-app"
    npx 0canvas status
`);
}

// ── Main ──────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  showHelp();
  process.exit(0);
}

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

if (command === "init") {
  runInit(process.cwd(), getFlag("--name"));
} else if (command === "serve") {
  const port = getFlag("--port") ? parseInt(getFlag("--port")!, 10) : 24193;
  const root = getFlag("--root");
  runServe(process.cwd(), port, root);
} else if (command === "status") {
  const port = getFlag("--port") ? parseInt(getFlag("--port")!, 10) : 24193;
  runStatus(port);
} else {
  console.log(`\n  \x1b[31mUnknown command: ${command}\x1b[0m`);
  showHelp();
  process.exit(1);
}
