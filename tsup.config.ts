import { defineConfig } from "tsup";
import * as fs from "fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const VERSION = pkg.version;

export default defineConfig([
  // Entry 1: Browser library (React component + utils)
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ["react", "react-dom"],
    tsconfig: "tsconfig.build.json",
    define: {
      __VERSION__: JSON.stringify(VERSION),
    },
    banner: {
      js: '"use client";',
    },
  },
  // Entry 2: Vite plugin (wraps engine)
  {
    entry: ["src/vite-plugin.ts"],
    format: ["cjs", "esm"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    platform: "node",
    target: "node18",
    external: [
      "vite",
      /^node:/,
      "postcss",
      "@parcel/watcher",
      "ws",
      "tinyglobby",
      "@modelcontextprotocol/sdk",
    ],
    noExternal: [],
  },
  // Entry 3: CLI + Engine (Node.js)
  {
    entry: ["src/cli.ts"],
    format: ["cjs"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    platform: "node",
    target: "node18",
    external: [
      /^node:/,
      "postcss",
      "@parcel/watcher",
      "ws",
      "tinyglobby",
      "@modelcontextprotocol/sdk",
    ],
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
