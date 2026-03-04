import { defineConfig } from "tsup";
import * as fs from "fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const VERSION = pkg.version;

export default defineConfig([
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
  {
    entry: ["src/mcp/server.ts"],
    outDir: "dist/mcp",
    format: ["esm"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    platform: "node",
    target: "node18",
    external: [],
    noExternal: [/@modelcontextprotocol/, /zod/],
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);