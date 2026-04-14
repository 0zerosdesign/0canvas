// ──────────────────────────────────────────────────────────
// 0canvas CLI — scaffold .0c project files
// ──────────────────────────────────────────────────────────
//
// Usage:
//   npx 0canvas init          — Detect framework, scaffold project.0c
//   npx 0canvas init --name   — Custom project name
//   npx 0canvas --help        — Show usage
//
// ──────────────────────────────────────────────────────────

import * as fs from "fs";
import * as path from "path";
import { createEmptyProjectFile, serializeProjectFile } from "./0canvas/format/oc-project";

// ── Framework detection ───────────────────────────────────

type Framework = "react" | "next" | "vue" | "nuxt" | "svelte" | "solid" | "angular" | "astro" | "unknown";

interface DetectionResult {
  framework: Framework;
  entryFiles: string[];
  projectName: string;
}

const FRAMEWORK_DEPS: Record<string, Framework> = {
  "next": "next",
  "nuxt": "nuxt",
  "@angular/core": "angular",
  "svelte": "svelte",
  "@sveltejs/kit": "svelte",
  "vue": "vue",
  "solid-js": "solid",
  "astro": "astro",
  "react": "react",
};

const ENTRY_CANDIDATES: Record<Framework, string[]> = {
  next: [
    "app/page.tsx", "app/page.jsx", "app/page.js",
    "pages/index.tsx", "pages/index.jsx", "pages/index.js",
    "src/app/page.tsx", "src/pages/index.tsx",
  ],
  nuxt: [
    "pages/index.vue", "app.vue",
    "src/pages/index.vue", "src/app.vue",
  ],
  angular: [
    "src/app/app.component.ts", "src/main.ts",
  ],
  svelte: [
    "src/routes/+page.svelte", "src/App.svelte",
    "src/main.ts", "src/main.js",
  ],
  vue: [
    "src/App.vue", "src/main.ts", "src/main.js",
  ],
  solid: [
    "src/App.tsx", "src/App.jsx",
    "src/index.tsx", "src/index.jsx",
  ],
  astro: [
    "src/pages/index.astro", "src/layouts/Layout.astro",
  ],
  react: [
    "src/main.tsx", "src/main.jsx", "src/main.ts",
    "src/App.tsx", "src/App.jsx",
    "src/index.tsx", "src/index.jsx",
    "app/page.tsx", "pages/index.tsx",
  ],
  unknown: [
    "src/main.tsx", "src/main.ts", "src/main.jsx", "src/main.js",
    "src/index.tsx", "src/index.ts", "src/index.jsx", "src/index.js",
    "index.html",
  ],
};

function detectFramework(cwd: string): DetectionResult {
  const pkgPath = path.join(cwd, "package.json");
  let projectName = path.basename(cwd);
  let framework: Framework = "unknown";

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      projectName = pkg.name || projectName;

      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      // Check deps in priority order
      for (const [dep, fw] of Object.entries(FRAMEWORK_DEPS)) {
        if (allDeps && allDeps[dep]) {
          framework = fw;
          break;
        }
      }
    } catch {
      // Malformed package.json — continue with unknown
    }
  }

  // Find entry files — check framework-specific candidates first, then fall back to generic
  const candidates = ENTRY_CANDIDATES[framework] || ENTRY_CANDIDATES.unknown;
  let entryFiles = candidates.filter((f) => fs.existsSync(path.join(cwd, f)));

  // If no framework-specific entries found, try the generic list
  if (entryFiles.length === 0 && framework !== "unknown") {
    entryFiles = ENTRY_CANDIDATES.unknown.filter((f) => fs.existsSync(path.join(cwd, f)));
  }

  // Fallback: use the first candidate as a suggestion
  if (entryFiles.length === 0) {
    entryFiles.push(candidates[0] || "src/main.tsx");
  }

  return { framework, entryFiles, projectName };
}

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

  // Check if file already exists
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

  // Create the .0c project file
  const project = {
    id: generateProjectId(),
    name: projectName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    appUrl: "http://localhost:5173",
    saved: false,
  };

  const projectFile = createEmptyProjectFile(project, detection.framework);

  // Override entry files with detected ones
  projectFile.workspace.entryFiles = detection.entryFiles;

  const json = serializeProjectFile(projectFile);
  fs.writeFileSync(outputFile, json, "utf-8");

  console.log(`\n  \x1b[32m\u2713\x1b[0m Created \x1b[1mproject.0c\x1b[0m\n`);
  console.log("  \x1b[2mNext steps:\x1b[0m");
  console.log("  1. Add 0canvas to your app:");
  console.log("     \x1b[36mimport { ZeroCanvas } from \"@zerosdesign/0canvas\";\x1b[0m");
  console.log("  2. Add the Vite plugin:");
  console.log("     \x1b[36mimport { zeroCanvas } from \"@zerosdesign/0canvas/vite\";\x1b[0m");
  console.log("  3. Start your dev server and open the app.\n");
}

// ── Help ──────────────────────────────────────────────────

function showHelp() {
  console.log(`
  \x1b[36m0canvas\x1b[0m — Visual feedback engine for AI-powered development

  \x1b[1mUsage:\x1b[0m
    npx 0canvas <command> [options]

  \x1b[1mCommands:\x1b[0m
    init          Scaffold a project.0c file in the current directory

  \x1b[1mOptions:\x1b[0m
    --name <n>    Override the project name (default: from package.json)
    --help, -h    Show this help message

  \x1b[1mExamples:\x1b[0m
    npx 0canvas init
    npx 0canvas init --name "my-app"
`);
}

// ── Main ──────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  showHelp();
  process.exit(0);
}

if (command === "init") {
  // Parse --name flag
  const nameIdx = args.indexOf("--name");
  const nameOverride = nameIdx !== -1 && args[nameIdx + 1] ? args[nameIdx + 1] : undefined;
  runInit(process.cwd(), nameOverride);
} else {
  console.log(`\n  \x1b[31mUnknown command: ${command}\x1b[0m`);
  showHelp();
  process.exit(1);
}
