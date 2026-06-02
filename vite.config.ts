import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Vite may inject __dirname when loading the config, but we define it
// explicitly here so the alias works regardless of how the config is loaded.
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

export default defineConfig({
  // base MUST be './' so that built HTML uses relative asset paths.
  // Without this, Vite uses '/assets/...' which resolves to the filesystem
  // root when loaded via file:// in Electron, causing blank screen.
  base: './',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
})
