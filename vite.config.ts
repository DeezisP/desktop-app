import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

export default defineConfig({
  // './' is required for Electron (file:// protocol).
  // '/' is required for browser routing — relative paths break on any sub-path.
  base: process.env.ELECTRON_SKIP_LAUNCH ? '/' : './',

  server: {
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: ['app.perfectelt.com'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  plugins: [
    react(),

    electron([
      // ── Main process (ESM — Electron 31 supports ESM main natively) ──────
      {
        entry: 'electron/main.ts',
        onstart(options) {
          // ELECTRON_SKIP_LAUNCH=true → headless VPS browser-only dev mode
          if (!process.env.ELECTRON_SKIP_LAUNCH) {
            options.startup()
          }
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // electron-updater is CJS and must stay external so Node.js
              // resolves it from node_modules at runtime, not bundled by Vite.
              external: ['electron', 'electron-updater'],
            },
          },
        },
      },

      // ── Preload (.mjs — Electron 28+ loads .mjs preloads as native ESM) ───
      // With "type":"module", vite-plugin-electron always emits ESM output
      // regardless of rollupOptions.output.format (empirically confirmed).
      // Electron's require()-based preload loader rejects ESM .js files
      // with ERR_REQUIRE_ESM. The fix: use .mjs extension so Electron uses
      // its import()-based ESM preload loader instead of require().
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
              output: {
                entryFileNames: '[name].mjs',
              },
            },
          },
        },
      },
    ]),

    renderer(),
  ],
})
