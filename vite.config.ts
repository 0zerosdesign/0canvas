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
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
