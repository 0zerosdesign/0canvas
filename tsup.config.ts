import { defineConfig } from "tsup";
import * as fs from "fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const VERSION = pkg.version;

// Mac-only pivot: browser library and Vite plugin builds removed.
// Only the engine (Node.js sidecar, run via `node dist/cli.js` during dev,
// packaged as a Bun single-file executable for the Tauri shell) is built here.
export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: ["cjs"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    outDir: "dist-engine",
    platform: "node",
    target: "node18",
    external: [
      /^node:/,
      "postcss",
      "chokidar",
      "ws",
      "tinyglobby",
      "@modelcontextprotocol/sdk",
      // ESM-only — must stay external so the runtime resolves it via
      // Node's dynamic import (CJS `require()` would throw
      // ERR_PACKAGE_PATH_NOT_EXPORTED).
      "@opencode-ai/sdk",
    ],
    define: {
      __VERSION__: JSON.stringify(VERSION),
    },
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
