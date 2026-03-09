import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "src/webview"),
  build: {
    outDir: path.resolve(__dirname, "dist/webview"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/webview.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  resolve: {
    alias: {
      "@designdead/canvas": path.resolve(__dirname, "..", "src", "app", "components", "canvas"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
