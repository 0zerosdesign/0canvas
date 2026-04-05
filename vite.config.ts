import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { zeroCanvas } from './src/vite-plugin'

export default defineConfig({
  plugins: [
    // React plugin for JSX transform, Tailwind for utility CSS in dev mode
    react(),
    tailwindcss(),
    // Auto-starts MCP bridge, detects IDE, injects config into page
    zeroCanvas(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
