import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    outDir: "build",
  },
  server: {
    port: 3001,
    host: true,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:4456",
        changeOrigin: true,
      },
    },
  },
});
