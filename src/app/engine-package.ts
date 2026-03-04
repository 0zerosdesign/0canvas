// ──────────────────────────────────────────────────────────
// DesignDead Engine — Package Configuration Templates
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
    devDependencies: {
      "@types/react": "^18.2.0",
      "@types/react-dom": "^18.2.0",
      react: "^18.2.0",
      "react-dom": "^18.2.0",
      tsup: "^8.0.0",
      typescript: "^5.0.0",
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
  '// Store types (for TypeScript consumers)',
  'export type { ElementNode, StyleChange } from "./store";',
].join("\n");

// ── README.md ──────────────────────────────────────────────

export const README_MD = [
  "# DesignDead",
  "",
  "Visual feedback engine for AI-powered development.",
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
  "## Features",
  "",
  "- **Click to inspect** any element to see its styles and selector",
  "- **Live style editing** directly in the panel",
  "- **Layer tree** to browse the DOM hierarchy",
  "- **Agent output** — structured markdown for AI coding agents",
  "- **Dark/light mode** — matches your preference or set manually",
  "- **Zero dependencies** — only React as a peer dependency",
  "- **Keyboard shortcut** — Ctrl+Shift+D to toggle",
  "",
  "## Props",
  "",
  "| Prop | Default | Description |",
  "|------|---------|-------------|",
  '| position | "bottom-right" | Panel position |',
  "| defaultOpen | false | Start with panel open |",
  '| theme | "dark" | dark / light / auto |',
  '| shortcut | "d" | Key for Ctrl+Shift+{key} |',
  "| devOnly | true | Hide in production |",
  "| zIndex | 2147483640 | CSS z-index |",
  "",
  "## How it works",
  "",
  "DesignDead runs inside your app. No server, no iframe, no proxy.",
  "It reads the current page DOM directly and renders a floating overlay.",
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
  "  console.log('\\n  Zero additional dependencies needed.');",
  "  console.log('  Done! Add <DesignDead /> to your app.\\n');",
  "}",
  "",
  "main();",
].join("\n");

// ── designdead.deps.json ───────────────────────────────────

export const DEPS_JSON = JSON.stringify(
  {
    description: "DesignDead has zero runtime dependencies beyond React.",
    dependencies: {},
    requires: ["react", "react-dom"],
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
