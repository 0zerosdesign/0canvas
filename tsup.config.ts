import { defineConfig } from "tsup";
import * as fs from "fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const VERSION = pkg.version;

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  define: {
    __VERSION__: JSON.stringify(VERSION),
  },
  banner: {
    js: '"use client";',
  },
});
