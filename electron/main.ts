import { app, BrowserWindow, ipcMain, safeStorage, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// __dirname is not available in ESM modules.
// "type":"module" in package.json causes vite-plugin-electron to emit ESM.
// Reconstruct __dirname from import.meta.url.
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const PRODUCTION_ORIGIN   = 'https://perfectelt.com'

const tokenStore = new Map<string, Buffer>()
let mainWindow: BrowserWindow | null = null

// ── Global error handlers ─────────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason)
})

// ── Window creation ───────────────────────────────────────────────────────────

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js')
  const indexPath   = path.join(__dirname, '../dist/index.html')

  console.log('[main] __dirname    :', __dirname)
  console.log('[main] preloadPath  :', preloadPath)
  console.log('[main] indexPath    :', indexPath)
  console.log('[main] devServerURL :', VITE_DEV_SERVER_URL ?? '(none)')

  const iconPath = path.join(__dirname, '../resources/perfect-logo.png')

  mainWindow = new BrowserWindow({
    width:     1400,
    height:    860,
    minWidth:  1100,
    minHeight: 680,
    title:     'Perfect ELT Warehouse',
    icon:      iconPath,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload:          preloadPath,
      contextIsolation: true,
      nodeIntegration:  false,
      webSecurity:      true,
      sandbox:          false,
    },
  })

  // ── Renderer diagnostics ────────────────────────────────────────────────────

  mainWindow.once('ready-to-show', () => {
    console.log('[main] ready-to-show → showing window')
    mainWindow?.show()
    mainWindow?.focus()
  })

  // Fallback: if ready-to-show has not fired in 5 s, force show anyway
  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.warn('[main] ready-to-show did not fire — forcing show()')
      mainWindow.show()
      mainWindow.focus()
    }
  }, 5000)

  mainWindow.once('show', () => clearTimeout(showFallback))

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[main] did-fail-load  code=${errorCode}  desc="${errorDescription}"  url="${validatedURL}"`,
      )
      // Surface the window so the user sees the error rather than nothing
      if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.show()
        mainWindow.focus()
      }
    },
  )

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] render-process-gone:', JSON.stringify(details))
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main] did-finish-load')
  })

  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[main] did-start-loading')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // ── CORS: spoof Origin for file:// requests to pass backend CORS check ──────

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }
    if (!headers['Origin'] && !headers['origin']) {
      headers['Origin'] = PRODUCTION_ORIGIN
    }
    callback({ requestHeaders: headers })
  })

  // ── Load renderer ───────────────────────────────────────────────────────────

  if (VITE_DEV_SERVER_URL) {
    console.log('[main] loading dev server:', VITE_DEV_SERVER_URL)
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    console.log('[main] loading file:', indexPath)
    mainWindow.loadFile(indexPath)
  }
}

// ── IPC: secure token storage via OS encryption ──────────────────────────────

const ALLOWED_KEYS = new Set(['access_token'])

ipcMain.handle('token:save', (_event, key: string, value: string): boolean => {
  if (!ALLOWED_KEYS.has(key)) return false
  if (safeStorage.isEncryptionAvailable()) {
    tokenStore.set(key, safeStorage.encryptString(value))
  } else {
    tokenStore.set(key, Buffer.from(value, 'utf8'))
  }
  return true
})

ipcMain.handle('token:get', (_event, key: string): string | null => {
  if (!ALLOWED_KEYS.has(key)) return null
  const buf = tokenStore.get(key)
  if (!buf) return null
  try {
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString('utf8')
  } catch {
    tokenStore.delete(key)
    return null
  }
})

ipcMain.handle('token:delete', (_event, key: string): boolean => {
  if (!ALLOWED_KEYS.has(key)) return false
  tokenStore.delete(key)
  return true
})

ipcMain.handle('token:clear', (): boolean => {
  tokenStore.clear()
  return true
})

ipcMain.handle('app:version', (): string => app.getVersion())

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(createWindow).catch((err) => {
  console.error('[main] createWindow failed:', err)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('render-process-gone', (_event, _webContents, details) => {
  console.error('[main] app render-process-gone:', JSON.stringify(details))
})
