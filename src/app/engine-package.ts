// ──────────────────────────────────────────────────────────
// DesignDead Engine — Package Configuration Templates
// ──────────────────────────────────────────────────────────
//
// These templates define the npm package structure for
// publishing. When the project is pushed to GitHub:
//
//   1. The actual source code lives in /src/app/
//   2. These templates are used as reference for the repo's
//      root-level config files (package.json, tsup.config.ts, etc.)
//   3. The GitHub repo structure maps as:
//
//      GitHub repo root/
//      ├── package.json        ← PACKAGE_JSON below
//      ├── tsup.config.ts      ← TSUP_CONFIG below
//      ├── tsconfig.json       ← TSCONFIG below
//      ├── README.md           ← README_MD below
//      ├── .gitignore
//      ├── .npmignore
//      ├── setup.mjs
//      └── src/
//          ├── index.ts         ← entry point (exports <DesignDead />)
//          ├── store.tsx         ← from /src/app/store.tsx
//          ├── pages/
//          │   └── workspace.tsx
//          └── components/
//              ├── designdead-engine.tsx   ← the <DesignDead /> wrapper
//              ├── designdead-styles.ts    ← runtime CSS injection
//              ├── dom-inspector.ts
//              ├── live-canvas.tsx
//              ├── clipboard.ts
//              ├── layers-panel.tsx
//              ├── style-panel.tsx
//              ├── agent-panel.tsx
//              ├── brainstorm-panel.tsx
//              ├── annotation-overlay.tsx
//              ├── workspace-toolbar.tsx
//              ├── command-palette.tsx
//              ├── file-map-panel.tsx
//              ├── version-manager.tsx
//              └── ui/
//                  └── scroll-area.tsx
// ──────────────────────────────────────────────────────────

export const PACKAGE_NAME = "designdead";
export const PACKAGE_VERSION = "0.1.0";

// ── package.json ───────────────────────────────────────────

export const PACKAGE_JSON = JSON.stringify(
  {
    name: "designdead",
    version: PACKAGE_VERSION,
    description:
      "Visual feedback engine for AI-powered development. Inspect elements, edit styles, and send structured instructions to your AI coding agent.",
    license: "MIT",
    main: "./dist/index.js",
    module: "./dist/index.mjs",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: { types: "./dist/index.d.mts", default: "./dist/index.mjs" },
        require: { types: "./dist/index.d.ts", default: "./dist/index.js" },
      },
    },
    files: ["dist"],
    scripts: {
      build: "tsup",
      watch: "tsup --watch",
      dev: "pnpm build && pnpm watch",
      prepublishOnly: "pnpm build",
    },
    peerDependencies: { react: ">=18.0.0", "react-dom": ">=18.0.0" },
    peerDependenciesMeta: {
      react: { optional: true },
      "react-dom": { optional: true },
    },
    dependencies: {
      "@radix-ui/react-scroll-area": "^1.2.0",
      "lucide-react": "^0.400.0",
      "clsx": "^2.1.0",
      "tailwind-merge": "^3.0.0",
    },
    devDependencies: {
      "@types/react": "^18.2.0",
      "@types/react-dom": "^18.2.0",
      react: "^18.2.0",
      "react-dom": "^18.2.0",
      tsup: "^8.0.0",
      typescript: "^5.0.0",
      tailwindcss: "^4.0.0",
      "@tailwindcss/cli": "^4.0.0",
    },
    keywords: [
      "design",
      "feedback",
      "inspector",
      "ai",
      "agent",
      "visual",
      "css",
      "devtools",
      "overlay",
      "react",
    ],
  },
  null,
  2
);

// ── tsup.config.ts ─────────────────────────────────────────

export const TSUP_CONFIG = [
  'import { defineConfig } from "tsup";',
  'import * as fs from "fs";',
  "",
  'const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));',
  "const VERSION = pkg.version;",
  "",
  "export default defineConfig({",
  '  entry: ["src/index.ts"],',
  '  format: ["cjs", "esm"],',
  "  dts: true,",
  "  splitting: false,",
  "  sourcemap: true,",
  "  clean: true,",
  '  external: ["react", "react-dom"],',
  '  tsconfig: "tsconfig.build.json",',
  "  define: {",
  "    __VERSION__: JSON.stringify(VERSION),",
  "  },",
  "  banner: {",
  '    js: \'"use client";\',',
  "  },",
  "});",
].join("\n");

// ── tsconfig.json ──────────────────────────────────────────

export const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      outDir: "./dist",
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      resolveJsonModule: true,
    },
    include: ["src"],
    exclude: ["dist", "node_modules"],
  },
  null,
  2
);

// ── src/index.ts ───────────────────────────────────────────

export const INDEX_TS = [
  '// DesignDead — Visual feedback engine for AI-powered dev',
  '//',
  '// Usage:',
  '//   import { DesignDead } from "designdead";',
  '//   <DesignDead />',
  '',
  '// Main component',
  'export { DesignDead } from "./components/designdead-engine";',
  'export type { DesignDeadProps } from "./components/designdead-engine";',
  '',
  '// Default export for convenience',
  'export { default } from "./components/designdead-engine";',
  '',
  '// DOM Inspector utilities (for building custom UIs)',
  'export {',
  '  buildElementTree,',
  '  rebuildElementMap,',
  '  getElementById,',
  '  highlightElement,',
  '  applyStyle,',
  '  startInspect,',
  '  stopInspect,',
  '  isInspecting,',
  '  generateAgentOutput,',
  '  cleanup,',
  '} from "./components/dom-inspector";',
  '',
  '// Runtime CSS injection (for advanced consumers)',
  'export { injectStyles, removeStyles } from "./components/designdead-styles";',
  '',
  '// Store types (for TypeScript consumers)',
  'export type { ElementNode, StyleChange } from "./store";',
].join("\n");

// ── README.md ──────────────────────────────────────────────

export const README_MD = [
  "# DesignDead",
  "",
  "Visual feedback engine for AI-powered development.",
  "",
  "Inspect elements, edit styles live, and send structured instructions to your AI coding agent — all from a floating overlay inside your app.",
  "",
  "## Install",
  "",
  "```bash",
  "npm install designdead -D",
  "```",
  "",
  "## Usage",
  "",
  "```tsx",
  'import { DesignDead } from "designdead";',
  "",
  "function App() {",
  "  return (",
  "    <>",
  "      <YourApp />",
  "      <DesignDead />",
  "    </>",
  "  );",
  "}",
  "```",
  "",
  "That's it. No config, no server, no proxy.",
  "",
  "## How it works",
  "",
  "DesignDead runs inside your app as a React component. It:",
  "",
  "1. Injects a floating overlay UI (toolbar, panels, canvas)",
  "2. Walks your page's DOM tree directly (no iframe, no proxy)",
  "3. Lets you click to inspect any element and see/edit its styles",
  "4. Generates structured markdown output for AI coding agents",
  "5. Marks all its own UI with `data-designdead` so it skips itself during inspection",
  "6. Injects scoped CSS at runtime — works with **any** framework and **any** CSS setup",
  "",
  "## Features",
  "",
  "- **Click to inspect** any element to see its styles and CSS selector",
  "- **Live style editing** directly in the panel",
  "- **Layer tree** to browse the DOM hierarchy",
  "- **Agent output** — structured markdown for AI coding agents (Claude Code, Cursor, etc.)",
  "- **Annotations** — draw rectangles, arrows, circles, text, and freehand on the page",
  "- **Version management** — save style change snapshots and send to IDEs",
  "- **File mapping** — heuristic component-to-file inference",
  "- **Brainstorm** — jot down design ideas linked to versions",
  "- **Command palette** — Ctrl+K for quick actions",
  "- **Dark theme** — Vercel Geist aesthetic, scoped so it never affects your app",
  "- **Keyboard shortcuts** — I to inspect, Ctrl+Shift+D to toggle",
  "",
  "## Props",
  "",
  "| Prop | Type | Default | Description |",
  "|------|------|---------|-------------|",
  '| position | string | "bottom-right" | FAB button position |',
  "| defaultOpen | boolean | false | Start with panel open |",
  '| theme | string | "dark" | dark / light / auto |',
  '| shortcut | string | "d" | Key for Ctrl+Shift+{key} toggle |',
  "| devOnly | boolean | true | Hide in production builds |",
  "| zIndex | number | 2147483640 | CSS z-index for the overlay |",
  "| onToggle | function | — | Callback when panel opens/closes |",
  "",
  "## Works with",
  "",
  "- React, Next.js, Remix, Vite, CRA",
  "- Tailwind CSS, CSS Modules, styled-components, vanilla CSS",
  "- Any React 18+ project",
  "",
  "## Keyboard Shortcuts",
  "",
  "| Shortcut | Action |",
  "|----------|--------|",
  "| Ctrl+Shift+D | Toggle DesignDead |",
  "| I | Start/stop element inspection |",
  "| Ctrl+K | Command palette |",
  "| V | Select tool (annotation mode) |",
  "| R | Rectangle tool |",
  "| O | Circle tool |",
  "| A | Arrow tool |",
  "| T | Text tool |",
  "| P | Freehand tool |",
  "",
  "## Architecture",
  "",
  "```",
  "┌─────────────────────────────────────────┐",
  "│  Your App                               │",
  "│                                         │",
  "│  ┌─────────────────────────────────────┐│",
  "│  │  <DesignDead />                     ││",
  "│  │                                     ││",
  "│  │  ┌─ Toolbar ──────────────────────┐ ││",
  "│  │  │ Layers │ Inspect │ Style │ IDE │ ││",
  "│  │  └────────────────────────────────┘ ││",
  "│  │  ┌─────┬───────────┬──────┐       ││",
  "│  │  │Layer│  Canvas   │Style │       ││",
  "│  │  │Panel│           │Panel │       ││",
  "│  │  └─────┴───────────┴──────┘       ││",
  "│  │                                     ││",
  "│  │  DOM Inspector walks document.body  ││",
  "│  │  (skips [data-designdead] elements) ││",
  "│  └─────────────────────────────────────┘│",
  "└─────────────────────────────────────────┘",
  "```",
  "",
  "## License",
  "",
  "MIT",
].join("\n");

// ── .gitignore ─────────────────────────────────────────────

export const GITIGNORE = ["node_modules/", "dist/", ".DS_Store", "*.tsbuildinfo"].join("\n");

// ── .npmignore ─────────────────────────────────────────────

export const NPMIGNORE = [
  "src/",
  "*.ts",
  "!dist/**",
  "tsconfig.json",
  "tsup.config.ts",
  ".gitignore",
].join("\n");

// ── setup.mjs ──────────────────────────────────────────────

export const SETUP_MJS = [
  "#!/usr/bin/env node",
  "",
  "// DesignDead Setup Script",
  "// Usage: node designdead/setup.mjs",
  "",
  "import { readFileSync, existsSync } from 'fs';",
  "import { join, dirname } from 'path';",
  "import { fileURLToPath } from 'url';",
  "",
  "const __dirname = dirname(fileURLToPath(import.meta.url));",
  "",
  "function findProjectRoot(startDir) {",
  "  let dir = startDir;",
  "  while (dir !== dirname(dir)) {",
  "    if (existsSync(join(dir, 'package.json'))) return dir;",
  "    dir = dirname(dir);",
  "  }",
  "  return null;",
  "}",
  "",
  "function main() {",
  "  console.log('\\n  DesignDead Setup\\n');",
  "  const root = findProjectRoot(__dirname);",
  "  if (!root) { console.log('  Error: No package.json found.'); process.exit(1); }",
  "  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));",
  "  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };",
  "  const prereqs = ['react', 'react-dom'];",
  "  let ok = true;",
  "  for (const dep of prereqs) {",
  "    if (allDeps[dep]) { console.log('  + ' + dep); }",
  "    else { console.log('  x ' + dep + ' (required)'); ok = false; }",
  "  }",
  "  if (!ok) { console.log('\\n  React is required.'); process.exit(1); }",
  "  console.log('\\n  Setup complete! Add <DesignDead /> to your app.\\n');",
  "}",
  "",
  "main();",
].join("\n");

// ── designdead.deps.json ───────────────────────────────────

export const DEPS_JSON = JSON.stringify(
  {
    description: "DesignDead runtime dependencies",
    dependencies: {
      "@radix-ui/react-scroll-area": "^1.2.0",
      "lucide-react": "^0.400.0",
      "clsx": "^2.1.0",
      "tailwind-merge": "^3.0.0",
    },
    peerDependencies: {
      react: ">=18.0.0",
      "react-dom": ">=18.0.0",
    },
  },
  null,
  2
);

// ── Collect all files for download ─────────────────────────

export interface PackageFile {
  path: string;
  content: string;
  description: string;
}

export function getPackageFiles(): PackageFile[] {
  return [
    { path: "package.json", content: PACKAGE_JSON, description: "npm package configuration" },
    { path: "tsup.config.ts", content: TSUP_CONFIG, description: "Build configuration (tsup)" },
    { path: "tsconfig.json", content: TSCONFIG, description: "TypeScript configuration" },
    { path: "src/index.ts", content: INDEX_TS, description: "Package entry point" },
    { path: "README.md", content: README_MD, description: "Documentation" },
    { path: ".gitignore", content: GITIGNORE, description: "Git ignore rules" },
    { path: ".npmignore", content: NPMIGNORE, description: "npm publish ignore rules" },
    { path: "setup.mjs", content: SETUP_MJS, description: "Setup script" },
    { path: "designdead.deps.json", content: DEPS_JSON, description: "Dependency manifest" },
  ];
}