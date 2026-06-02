import { app, BrowserWindow, ipcMain, safeStorage, session } from 'electron'
import path from 'node:path'

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const PRODUCTION_ORIGIN = 'https://perfectelt.com'

// In-memory encrypted token store (process memory only, never written as plaintext)
const tokenStore = new Map<string, Buffer>()

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1100,
    minHeight: 680,
    title: 'Perfect ELT Warehouse',
    icon: path.join(__dirname, '../resources/icon.png'),
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: false,
    },
  })

  // Spoof Origin so backend CORS accepts requests from the Electron file:// context
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }
    if (!headers['Origin'] && !headers['origin']) {
      headers['Origin'] = PRODUCTION_ORIGIN
    }
    callback({ requestHeaders: headers })
  })

  win.once('ready-to-show', () => win.show())

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ── IPC: secure token storage via OS encryption ──────────────────────────────

ipcMain.handle('token:save', (_event, key: string, value: string): boolean => {
  if (safeStorage.isEncryptionAvailable()) {
    tokenStore.set(key, safeStorage.encryptString(value))
  } else {
    tokenStore.set(key, Buffer.from(value, 'utf8'))
  }
  return true
})

ipcMain.handle('token:get', (_event, key: string): string | null => {
  const buf = tokenStore.get(key)
  if (!buf) return null
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buf)
    }
    return buf.toString('utf8')
  } catch {
    tokenStore.delete(key)
    return null
  }
})

ipcMain.handle('token:delete', (_event, key: string): boolean => {
  tokenStore.delete(key)
  return true
})

ipcMain.handle('token:clear', (): boolean => {
  tokenStore.clear()
  return true
})

ipcMain.handle('app:version', (): string => app.getVersion())

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
