import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths so the bundled index.html works under
  // Electron's file:// load path. Without this Vite emits absolute
  // /assets/*.js which resolve to the filesystem root under file://
  // and the packaged app renders as a blank black window.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Phase 2 §2.11.2 — module workers (syntax.worker.ts) need ESM
  // output for code-splitting. Shiki has dynamic imports internally
  // for grammars/themes; the default "iife" worker format rejects
  // the build with "UMD and IIFE output formats are not supported
  // for code-splitting builds".
  worker: {
    format: 'es',
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
