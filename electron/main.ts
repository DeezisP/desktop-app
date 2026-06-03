import {
  app, BrowserWindow, ipcMain, safeStorage,
  session, Menu, shell, Notification,
} from 'electron'
import { autoUpdater } from 'electron-updater'
import path   from 'node:path'
import fs     from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const PRODUCTION_ORIGIN   = 'https://perfectelt.com'

const tokenStore = new Map<string, Buffer>()
let mainWindow: BrowserWindow | null = null
let logPath: string | null = null

// ── File logger ───────────────────────────────────────────────────────────────

function initLogFile() {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs')
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
    logPath = path.join(logsDir, 'error.log')
    try {
      if (fs.existsSync(logPath) && fs.statSync(logPath).size > 5 * 1024 * 1024) {
        fs.writeFileSync(logPath, '')
      }
    } catch {}
    log('[main] log file: ' + logPath)
    log('[main] electron: ' + process.versions.electron)
    log('[main] node: '     + process.versions.node)
    log('[main] platform: ' + process.platform)
    log('[main] appPath: '  + app.getAppPath())
    log('[main] userData: ' + app.getPath('userData'))
  } catch (e) {
    console.error('[main] failed to init log file:', e)
  }
}

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  process.stdout.write(line)
  if (logPath) {
    try { fs.appendFileSync(logPath, line) } catch {}
  }
}

// ── Global main-process error handlers ───────────────────────────────────────

process.on('uncaughtException', (err) => {
  log(`[main] uncaughtException: ${err?.message}\n${err?.stack ?? ''}`)
})

process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error
    ? `${reason.message}\n${reason.stack ?? ''}`
    : String(reason)
  log(`[main] unhandledRejection: ${msg}`)
})

// ── Auto-updater ──────────────────────────────────────────────────────────────
// Pushes status objects to the renderer via the 'update:status' IPC channel.
// State machine: idle → checking → available | not-available | error
//                available → downloading → downloaded → (user clicks install)

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available';     version: string; releaseNotes?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading';   percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { state: 'downloaded';    version: string }
  | { state: 'error';         message: string }

function sendUpdateStatus(status: UpdateStatus) {
  log(`[updater] ${JSON.stringify(status)}`)
  mainWindow?.webContents.send('update:status', status)
}

function setupAutoUpdater() {
  // Disable electron-updater's built-in logger; we capture everything via events
  autoUpdater.logger = null

  // Download silently in the background; do NOT auto-install without user consent
  autoUpdater.autoDownload    = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({
      state: 'available',
      version: String(info.version),
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    })
    // autoDownload=true means the download starts automatically here
  })

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus({ state: 'not-available', version: String(info.version) })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({
      state:          'downloading',
      percent:        Math.round(progress.percent),
      bytesPerSecond: Math.round(progress.bytesPerSecond),
      transferred:    progress.transferred,
      total:          progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ state: 'downloaded', version: String(info.version) })
    // Show a system notification so the user is aware even if Settings isn't open
    try {
      if (Notification.isSupported()) {
        new Notification({
          title: 'อัปเดตพร้อมติดตั้ง',
          body:  `เวอร์ชัน ${info.version} ดาวน์โหลดสำเร็จ เปิดการตั้งค่าเพื่อรีสตาร์ท`,
          silent: false,
        }).show()
      }
    } catch {}
  })

  autoUpdater.on('error', (err) => {
    const msg = err?.message ?? String(err)
    sendUpdateStatus({ state: 'error', message: msg })
  })
}

// ── App menu ──────────────────────────────────────────────────────────────────

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reload(),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        // ── Auto-update ──────────────────────────────────────────────────────
        {
          label: 'Check for Updates…',
          click: () => {
            if (app.isPackaged) {
              sendUpdateStatus({ state: 'checking' })
              autoUpdater.checkForUpdates().catch((err) => {
                sendUpdateStatus({ state: 'error', message: err?.message ?? String(err) })
              })
            } else {
              log('[updater] skipping check — app is not packaged (dev mode)')
              mainWindow?.webContents.send('update:status', {
                state: 'error',
                message: 'Auto-update is only available in the packaged app, not in dev mode.',
              })
            }
          },
        },
        { type: 'separator' },
        // ── DevTools (manual access only — NOT auto-opened on startup) ───────
        {
          label: 'Open DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        { type: 'separator' },
        {
          label: 'View Error Log',
          click: () => {
            if (!logPath) return
            if (fs.existsSync(logPath)) {
              shell.openPath(logPath)
            } else {
              shell.openPath(path.dirname(logPath))
            }
          },
        },
        {
          label: 'Show Log Location',
          click: () => {
            if (logPath) shell.showItemInFolder(logPath)
          },
        },
        { type: 'separator' },
        {
          label: `App Version: ${app.getVersion()}`,
          enabled: false,
        },
        {
          label: `Log: ${logPath ?? 'not initialized'}`,
          enabled: false,
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── Window creation ───────────────────────────────────────────────────────────

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.mjs')
  const indexPath   = path.join(__dirname, '../dist/index.html')
  const iconPath = path.join(
    __dirname,
    '../resources',
    process.platform === 'win32' ? 'icon.ico' : 'perfect-logo.png',
  )

  log('[main] __dirname    : ' + __dirname)
  log('[main] preloadPath  : ' + preloadPath)
  log('[main] indexPath    : ' + indexPath)
  log('[main] preload exists: ' + fs.existsSync(preloadPath))
  log('[main] index exists : ' + fs.existsSync(indexPath))
  log('[main] devServerURL : ' + (VITE_DEV_SERVER_URL ?? '(none)'))

  mainWindow = new BrowserWindow({
    width:     1400,
    height:    860,
    minWidth:  1100,
    minHeight: 680,
    title:     'Perfect ELT Warehouse',
    icon:      fs.existsSync(iconPath) ? iconPath : undefined,
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
    log('[main] ready-to-show → showing window')
    mainWindow?.show()
    mainWindow?.focus()

    // ── Auto-update check after window is visible ─────────────────────────
    // Only run in packaged builds; dev mode has no installer channel.
    if (app.isPackaged) {
      setTimeout(() => {
        log('[updater] auto-checking for updates on startup')
        autoUpdater.checkForUpdates().catch((err) => {
          log(`[updater] startup check failed: ${err?.message ?? err}`)
          sendUpdateStatus({ state: 'error', message: err?.message ?? String(err) })
        })
      }, 3000) // 3-second delay so the UI settles before the check starts
    } else {
      log('[updater] skipping startup check — app is not packaged (dev mode)')
    }
  })

  // Fallback: show after 5 s regardless — prevents permanent blank window
  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      log('[main] WARN: ready-to-show never fired — forcing show()')
      mainWindow.show()
      mainWindow.focus()
    }
  }, 5000)

  mainWindow.once('show', () => clearTimeout(showFallback))

  mainWindow.webContents.on(
    'did-fail-load',
    (_ev, code, desc, url) => {
      log(`[renderer] did-fail-load code=${code} desc="${desc}" url="${url}"`)
      if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.show()
        mainWindow.focus()
      }
    },
  )

  mainWindow.webContents.on('render-process-gone', (_ev, details) => {
    log(`[renderer] render-process-gone: ${JSON.stringify(details)}`)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    log('[renderer] did-finish-load')
  })

  mainWindow.webContents.on('did-start-loading', () => {
    log('[renderer] did-start-loading')
  })

  mainWindow.webContents.on('dom-ready', () => {
    log('[renderer] dom-ready')
  })

  // Mirror every renderer console message to the log file
  mainWindow.webContents.on('console-message', (_ev, level, message, line, source) => {
    const lvl = ['verbose', 'info', 'warning', 'error'][level] ?? `level${level}`
    log(`[renderer][${lvl}] ${message}  (${source}:${line})`)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // ── CORS: spoof Origin so backend CORS allows file:// requests ──────────────

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }
    if (!headers['Origin'] && !headers['origin']) {
      headers['Origin'] = PRODUCTION_ORIGIN
    }
    callback({ requestHeaders: headers })
  })

  // NOTE: DevTools are NOT auto-opened. Access via Help → Open DevTools (Ctrl+Shift+I).

  // ── Load renderer ───────────────────────────────────────────────────────────

  if (VITE_DEV_SERVER_URL) {
    log('[main] loading dev server: ' + VITE_DEV_SERVER_URL)
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    log('[main] loading file: ' + indexPath)
    mainWindow.loadFile(indexPath)
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────

const ALLOWED_KEYS = new Set(['access_token', 'device_token'])

ipcMain.handle('token:save', (_ev, key: string, value: string): boolean => {
  if (!ALLOWED_KEYS.has(key)) return false
  if (safeStorage.isEncryptionAvailable()) {
    tokenStore.set(key, safeStorage.encryptString(value))
  } else {
    tokenStore.set(key, Buffer.from(value, 'utf8'))
  }
  return true
})

ipcMain.handle('token:get', (_ev, key: string): string | null => {
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

ipcMain.handle('token:delete', (_ev, key: string): boolean => {
  if (!ALLOWED_KEYS.has(key)) return false
  tokenStore.delete(key)
  return true
})

ipcMain.handle('token:clear', (): boolean => {
  tokenStore.clear()
  return true
})

ipcMain.handle('app:version', (): string => app.getVersion())

// Renderer → log file bridge
ipcMain.handle('log:error', (_ev, message: string, stack: string): void => {
  log(`[renderer][error-ipc] ${message}`)
  if (stack) log(`[renderer][stack] ${stack}`)
})

// Open the log file directly (returns true on success)
ipcMain.handle('log:open', (): boolean => {
  if (!logPath) return false
  shell.openPath(logPath)
  return true
})

// Return the full log contents to the renderer
ipcMain.handle('log:read', (): string => {
  if (!logPath || !fs.existsSync(logPath)) return '(no log file)'
  try {
    return fs.readFileSync(logPath, 'utf8')
  } catch (e) {
    return `(failed to read: ${e})`
  }
})

// Return the log file path
ipcMain.handle('log:path', (): string => logPath ?? '(not initialized)')

// ── Desktop notifications ─────────────────────────────────────────────────────

ipcMain.handle('notify:show', (_ev, title: string, body?: string): void => {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body: body ?? '', silent: true }).show()
    }
  } catch (e) {
    log(`[main] notify:show error: ${e}`)
  }
})

// ── Auto-update IPC ───────────────────────────────────────────────────────────

// Renderer requests a manual update check
ipcMain.handle('update:check', (): void => {
  if (!app.isPackaged) {
    mainWindow?.webContents.send('update:status', {
      state: 'error',
      message: 'Auto-update is only available in the packaged app, not in dev mode.',
    } satisfies UpdateStatus)
    return
  }
  sendUpdateStatus({ state: 'checking' })
  autoUpdater.checkForUpdates().catch((err) => {
    sendUpdateStatus({ state: 'error', message: err?.message ?? String(err) })
  })
})

// Renderer requests quit-and-install after update is downloaded
ipcMain.handle('update:install', (): void => {
  log('[updater] user requested quitAndInstall')
  // isSilent=false shows a progress UI; isForceRunAfter=true relaunches the app
  autoUpdater.quitAndInstall(false, true)
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  initLogFile()
  setupAutoUpdater()
  buildMenu()
  createWindow()
}).catch((err) => {
  log(`[main] app.whenReady failed: ${err?.message}\n${err?.stack ?? ''}`)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('render-process-gone', (_ev, _wc, details) => {
  log(`[main] app render-process-gone: ${JSON.stringify(details)}`)
})
