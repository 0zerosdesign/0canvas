import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/extension.ts"],
  format: ["cjs"],
  outDir: "dist",
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: false,
  external: ["vscode"],
  platform: "node",
  target: "node18",
});
