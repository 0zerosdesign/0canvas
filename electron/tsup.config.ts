// ──────────────────────────────────────────────────────────
// tsup config for the Electron main & preload processes.
// ──────────────────────────────────────────────────────────
//
// Output lands at `<repo>/dist-electron/`:
//   - main.cjs     (app entry, package.json "main" points here)
//   - preload.cjs  (injected via BrowserWindow webPreferences.preload)
//
// Both are CommonJS because Electron's main process loader expects
// CJS by default. We switch to .cjs extension so Node doesn't try to
// interpret them as ESM due to package.json's implicit type.
// ──────────────────────────────────────────────────────────

import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "electron/main.ts",
    preload: "electron/preload.ts",
  },
  format: ["cjs"],
  outDir: "dist-electron",
  target: "node20",
  platform: "node",
  sourcemap: true,
  clean: true,
  outExtension: () => ({ js: ".cjs" }),
  external: ["electron"],
});
