import {
  app, BrowserWindow, ipcMain, safeStorage,
  session, Menu, shell, Notification, net, dialog,
} from 'electron'
import { createRequire } from 'node:module'
import path   from 'node:path'
import fs     from 'node:fs'
import os     from 'node:os'
import { fileURLToPath } from 'node:url'

// electron-updater is a CommonJS module. Its `autoUpdater` export is defined
// as a lazy getter via Object.defineProperty, which Node.js's static CJS→ESM
// name extractor does not execute. Using a named ESM import therefore throws:
//   SyntaxError: Named export 'autoUpdater' not found
//
// Fix: load via createRequire so that require() evaluates the getter at
// runtime inside the Electron process where `app` is already initialised.
const _require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { autoUpdater } = _require('electron-updater') as typeof import('electron-updater')

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const PRODUCTION_ORIGIN   = 'https://perfectelt.com'

const tokenStore = new Map<string, Buffer>()
let mainWindow:    BrowserWindow | null = null
let badgeWindow:   BrowserWindow | null = null
let logPath:       string | null = null
let tokenFilePath: string | null = null
let badgeCount:    number = 0

// ── Token persistence (survives app restarts) ─────────────────────────────────
// Buffers are stored as base64 in a 0600 JSON file inside userData.
// safeStorage-encrypted bytes remain opaque on disk; only this app can decrypt.

function initTokenFile() {
  try {
    tokenFilePath = path.join(app.getPath('userData'), 'tokens.enc')
    log('[token] persist file: ' + tokenFilePath)
  } catch (e) {
    log('[token] initTokenFile error: ' + e)
  }
}

function persistTokens() {
  if (!tokenFilePath) return
  try {
    const obj: Record<string, string> = {}
    for (const [k, buf] of tokenStore.entries()) obj[k] = buf.toString('base64')
    fs.writeFileSync(tokenFilePath, JSON.stringify(obj), { mode: 0o600 })
  } catch (e) {
    log('[token] persist error: ' + e)
  }
}

function loadPersistedTokens() {
  if (!tokenFilePath) return
  try {
    if (!fs.existsSync(tokenFilePath)) return
    const raw = fs.readFileSync(tokenFilePath, 'utf8')
    const obj = JSON.parse(raw) as Record<string, string>
    for (const [k, b64] of Object.entries(obj)) {
      if (ALLOWED_KEYS.has(k)) tokenStore.set(k, Buffer.from(b64, 'base64'))
    }
    log('[token] loaded persisted keys: ' + Object.keys(obj).join(', '))
  } catch (e) {
    log('[token] load error: ' + e)
  }
}

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

// ── LINE-style chat badge overlay ─────────────────────────────────────────────
// A small always-on-top frameless window that appears in the bottom-right
// corner of the screen when new chat messages arrive and the app is not focused.
// Clicking it brings the main window to the front and hides the badge.

function createBadgeWindow() {
  if (badgeWindow && !badgeWindow.isDestroyed()) return

  const badgePreloadPath = path.join(__dirname, 'badge-preload.mjs')
  const { width: sw, height: sh } = require('electron').screen.getPrimaryDisplay().workAreaSize

  const WIN_SIZE = 90

  badgeWindow = new BrowserWindow({
    width:           WIN_SIZE,
    height:          WIN_SIZE,
    x:               sw - WIN_SIZE - 16,
    y:               sh - WIN_SIZE - 16,
    frame:           false,
    transparent:     true,
    alwaysOnTop:     true,
    skipTaskbar:     true,
    resizable:       false,
    movable:         false,
    minimizable:     false,
    maximizable:     false,
    closable:        false,
    focusable:       false,
    show:            false,
    hasShadow:       false,
    webPreferences: {
      preload:          badgePreloadPath,
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  })

  badgeWindow.setAlwaysOnTop(true, 'screen-saver')
  badgeWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const badgePath = VITE_DEV_SERVER_URL
    ? `${VITE_DEV_SERVER_URL}badge.html`
    : path.join(__dirname, '../dist/badge.html')

  if (VITE_DEV_SERVER_URL) {
    badgeWindow.loadURL(badgePath)
  } else {
    badgeWindow.loadFile(badgePath)
  }

  badgeWindow.on('closed', () => { badgeWindow = null })
  log('[badge] window created')
}

function showBadge(count: number) {
  if (!badgeWindow || badgeWindow.isDestroyed()) {
    createBadgeWindow()
  }
  badgeWindow?.webContents.send('badge:count', count)
  if (!badgeWindow?.isVisible()) {
    badgeWindow?.showInactive()
    log(`[badge] shown count=${count}`)
  }
}

function hideBadge() {
  if (badgeWindow && !badgeWindow.isDestroyed() && badgeWindow.isVisible()) {
    badgeWindow.hide()
    log('[badge] hidden')
  }
}

function updateBadgeState(count: number) {
  badgeCount = count

  // Windows taskbar overlay icon badge
  if (mainWindow && !mainWindow.isDestroyed() && process.platform === 'win32') {
    if (count > 0) {
      try {
        const { nativeImage } = require('electron')
        // Draw a red circle with count number as a 16×16 canvas
        const size = 16
        const canvas = Buffer.alloc(size * size * 4)
        // Simple red circle: fill with #ef4444 (rgba 239,68,68)
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const cx = x - size / 2 + 0.5
            const cy = y - size / 2 + 0.5
            const idx = (y * size + x) * 4
            if (cx * cx + cy * cy <= (size / 2) * (size / 2)) {
              canvas[idx]     = 239  // R
              canvas[idx + 1] = 68   // G
              canvas[idx + 2] = 68   // B
              canvas[idx + 3] = 255  // A
            }
          }
        }
        const overlay = nativeImage.createFromBuffer(canvas, { width: size, height: size })
        const label = count > 99 ? '99+' : String(count)
        mainWindow.setOverlayIcon(overlay, `${label} ข้อความใหม่`)
      } catch (e) {
        log(`[badge] setOverlayIcon error: ${e}`)
      }
    } else {
      try {
        const { nativeImage } = require('electron')
        mainWindow.setOverlayIcon(nativeImage.createEmpty(), '')
      } catch {}
    }
  }

  // macOS / Linux dock badge
  if (process.platform !== 'win32') {
    try { app.setBadgeCount(count) } catch {}
  }

  const focused = mainWindow ? mainWindow.isFocused() : false
  if (count > 0 && !focused) {
    showBadge(count)
  } else {
    hideBadge()
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
// Checks public GitHub Releases for DeezisP/desktop-app.
// Pushes status objects to the renderer via the 'update:status' IPC channel.
// State machine: idle → checking → available | not-available | error
//                available → downloading → downloaded → (user clicks install)

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available';     version: string; releaseNotes?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading';   percent: number; bytesPerSecond: number; transferred: number; total: number; isDifferential: boolean }
  | { state: 'downloaded';    version: string }
  | { state: 'error';         message: string }

function sendUpdateStatus(status: UpdateStatus) {
  log(`[updater] ${JSON.stringify(status)}`)
  mainWindow?.webContents.send('update:status', status)
}

// Estimate for the full NSIS installer size (used to detect differential downloads).
// A differential download is typically <35% of the full installer size.
const FULL_INSTALLER_ESTIMATE_BYTES = 150 * 1024 * 1024  // 150 MB upper bound

function fmtBytes(n: number): string {
  if (n < 1024)             return `${n} B`
  if (n < 1024 * 1024)      return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function setupAutoUpdater() {
  log('[updater] provider=github')
  log('[updater] owner=DeezisP')
  log('[updater] repo=desktop-app')
  log('[updater] releaseType=release')

  autoUpdater.logger               = null   // we capture everything via events below
  autoUpdater.autoDownload         = true   // background download, no prompt
  autoUpdater.autoInstallOnAppQuit = false  // user must click "Restart and Install"
  autoUpdater.allowDowngrade       = false  // never roll back to an older version

  // Track whether the current download is differential (set on first progress event).
  let downloadIsDifferential = false
  let downloadTypeLogged     = false

  autoUpdater.on('checking-for-update', () => {
    downloadIsDifferential = false
    downloadTypeLogged     = false
    sendUpdateStatus({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    downloadIsDifferential = false
    downloadTypeLogged     = false
    sendUpdateStatus({
      state:        'available',
      version:      String(info.version),
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus({ state: 'not-available', version: String(info.version) })
  })

  autoUpdater.on('download-progress', (progress) => {
    // On the first progress event, determine download type from the total size.
    // electron-updater reports the actual bytes that need to be fetched:
    //   differential → only changed blocks → typically 2–15 MB
    //   full         → entire installer   → typically 120–150 MB
    if (!downloadTypeLogged) {
      downloadIsDifferential = progress.total < FULL_INSTALLER_ESTIMATE_BYTES * 0.35
      downloadTypeLogged = true
      log(
        `[updater] download started — type=${downloadIsDifferential ? 'DIFFERENTIAL' : 'FULL'}` +
        ` total=${fmtBytes(progress.total)}` +
        (downloadIsDifferential
          ? ` (saving ~${fmtBytes(FULL_INSTALLER_ESTIMATE_BYTES - progress.total)} vs full)`
          : ''),
      )
    }

    sendUpdateStatus({
      state:          'downloading',
      percent:        Math.round(progress.percent),
      bytesPerSecond: Math.round(progress.bytesPerSecond),
      transferred:    progress.transferred,
      total:          progress.total,
      isDifferential: downloadIsDifferential,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    log(`[updater] download complete — version=${info.version} isDifferential=${downloadIsDifferential}`)
    sendUpdateStatus({ state: 'downloaded', version: String(info.version) })
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
    // electron-updater falls back to a full download when the blockmap can't be
    // fetched (404 — missing from the release). Log a clear hint in that case.
    if (msg.includes('blockmap') || msg.includes('ENOTFOUND') || msg.includes('404')) {
      log('[updater] WARNING: differential download failed — check that *.blockmap is published to the GitHub release. Falling back to full download.')
    }
    sendUpdateStatus({ state: 'error', message: msg })
  })

  log('[updater] initialised (allowDowngrade=false, autoDownload=true, autoInstallOnAppQuit=false)')
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
        {
          label: 'Check for Updates…',
          click: () => {
            if (!app.isPackaged) {
              log('[updater] skipping check — app is not packaged (dev mode)')
              sendUpdateStatus({ state: 'error', message: 'Auto-update only works in the packaged app.' })
              return
            }
            sendUpdateStatus({ state: 'checking' })
            autoUpdater.checkForUpdates().catch((err) => {
              sendUpdateStatus({ state: 'error', message: err?.message ?? String(err) })
            })
          },
        },
        { type: 'separator' },
        // DevTools — manual access only, NOT auto-opened on startup
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
            fs.existsSync(logPath)
              ? shell.openPath(logPath)
              : shell.openPath(path.dirname(logPath))
          },
        },
        {
          label: 'Show Log Location',
          click: () => { if (logPath) shell.showItemInFolder(logPath) },
        },
        { type: 'separator' },
        { label: `App Version: ${app.getVersion()}`, enabled: false },
        { label: `Log: ${logPath ?? 'not initialized'}`, enabled: false },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── Window creation ───────────────────────────────────────────────────────────

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.mjs')
  const indexPath   = path.join(__dirname, '../dist/index.html')
  const iconPath    = path.join(
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
    title:     'Admin Perfect Electronic',
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

  mainWindow.once('ready-to-show', () => {
    log('[main] ready-to-show → showing window')
    mainWindow?.show()
    mainWindow?.focus()

    // Process any deep-link URL that arrived before the window was ready
    if (pendingDeepLinkUrl) {
      const url = pendingDeepLinkUrl
      pendingDeepLinkUrl = null
      // Delay so the renderer has time to initialize before we push auth state
      setTimeout(() => handleDeepLink(url), 1500)
    }

    // Auto-update check — packaged builds only; dev mode has no installer channel
    if (app.isPackaged) {
      // Initial check: 3 s after window show (gives React time to mount the listener)
      setTimeout(() => {
        log('[updater] auto-checking for updates on startup')
        autoUpdater.checkForUpdates().catch((err) => {
          log(`[updater] startup check failed: ${err?.message ?? err}`)
          sendUpdateStatus({ state: 'error', message: err?.message ?? String(err) })
        })
      }, 3000)

      // Periodic background check every 4 hours
      const PERIODIC_INTERVAL_MS = 4 * 60 * 60 * 1000
      setInterval(() => {
        log('[updater] periodic background check')
        autoUpdater.checkForUpdates().catch((err) => {
          log(`[updater] periodic check failed: ${err?.message ?? err}`)
          // Do not send error status for background checks — would interrupt the user
        })
      }, PERIODIC_INTERVAL_MS)
      log(`[updater] periodic checks scheduled every ${PERIODIC_INTERVAL_MS / 1000 / 60} min`)
    } else {
      log('[updater] skipping startup check — dev mode')
    }
  })

  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      log('[main] WARN: ready-to-show never fired — forcing show()')
      mainWindow.show()
      mainWindow.focus()
    }
  }, 5000)

  mainWindow.once('show', () => clearTimeout(showFallback))

  mainWindow.webContents.on('did-fail-load', (_ev, code, desc, url) => {
    log(`[renderer] did-fail-load code=${code} desc="${desc}" url="${url}"`)
    if (mainWindow && !mainWindow.isVisible()) { mainWindow.show(); mainWindow.focus() }
  })

  mainWindow.webContents.on('render-process-gone', (_ev, details) => {
    log(`[renderer] render-process-gone: ${JSON.stringify(details)}`)
  })

  mainWindow.webContents.on('did-finish-load',   () => log('[renderer] did-finish-load'))
  mainWindow.webContents.on('did-start-loading', () => log('[renderer] did-start-loading'))
  mainWindow.webContents.on('dom-ready',         () => log('[renderer] dom-ready'))

  mainWindow.webContents.on('console-message', (_ev, level, message, line, source) => {
    const lvl = ['verbose', 'info', 'warning', 'error'][level] ?? `level${level}`
    log(`[renderer][${lvl}] ${message}  (${source}:${line})`)
  })

  mainWindow.on('focus', () => {
    hideBadge()
    // Clear taskbar/dock badge on focus
    if (process.platform === 'win32') {
      try {
        const { nativeImage } = require('electron')
        mainWindow?.setOverlayIcon(nativeImage.createEmpty(), '')
      } catch {}
    } else {
      try { app.setBadgeCount(0) } catch {}
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })

  // CORS: spoof Origin so backend CORS allows file:// requests.
  //
  // In a packaged Electron app the renderer runs from file:// so Chromium sets
  // Origin: null (the literal string "null"). Spring Boot's CORS policy rejects
  // that, causing WebSocket upgrades and API calls to fail with 403.
  //
  // We override any absent, null, or file:// origin with the production value
  // for every request — including WebSocket upgrade requests.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders }
    const origin  = headers['Origin'] ?? headers['origin'] ?? ''
    if (!origin || origin === 'null' || origin.startsWith('file://')) {
      headers['Origin'] = PRODUCTION_ORIGIN
      delete headers['origin']  // remove lower-case duplicate if present
    }
    callback({ requestHeaders: headers })
  })

  if (VITE_DEV_SERVER_URL) {
    log('[main] loading dev server: ' + VITE_DEV_SERVER_URL)
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    log('[main] loading file: ' + indexPath)
    mainWindow.loadFile(indexPath)
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────

const ALLOWED_KEYS      = new Set(['access_token', 'refresh_token', 'device_token'])
const AUTH_ONLY_KEYS    = new Set(['access_token', 'refresh_token'])

ipcMain.handle('token:save', (_ev, key: string, value: string): boolean => {
  if (!ALLOWED_KEYS.has(key)) return false
  if (safeStorage.isEncryptionAvailable()) {
    tokenStore.set(key, safeStorage.encryptString(value))
  } else {
    tokenStore.set(key, Buffer.from(value, 'utf8'))
  }
  persistTokens()
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
    persistTokens()
    return null
  }
})

ipcMain.handle('token:delete', (_ev, key: string): boolean => {
  if (!ALLOWED_KEYS.has(key)) return false
  tokenStore.delete(key)
  persistTokens()
  return true
})

// Clears auth tokens only — deliberately preserves device_token so the
// device stays trusted after logout and OTP is not asked on the next login.
ipcMain.handle('token:clear', (): boolean => {
  AUTH_ONLY_KEYS.forEach(k => tokenStore.delete(k))
  persistTokens()
  return true
})

ipcMain.handle('app:version', (): string => app.getVersion())

ipcMain.handle('log:error', (_ev, message: string, stack: string): void => {
  log(`[renderer][error-ipc] ${message}`)
  if (stack) log(`[renderer][stack] ${stack}`)
})

ipcMain.handle('log:open', (): boolean => {
  if (!logPath) return false
  shell.openPath(logPath)
  return true
})

ipcMain.handle('log:read', (): string => {
  if (!logPath || !fs.existsSync(logPath)) return '(no log file)'
  try { return fs.readFileSync(logPath, 'utf8') } catch (e) { return `(failed to read: ${e})` }
})

ipcMain.handle('log:path', (): string => logPath ?? '(not initialized)')

ipcMain.handle('notify:show', (_ev, title: string, body?: string): void => {
  try {
    if (Notification.isSupported()) new Notification({ title, body: body ?? '', silent: true }).show()
  } catch (e) { log(`[main] notify:show error: ${e}`) }
})

// ── Chat badge IPC ────────────────────────────────────────────────────────────

ipcMain.handle('badge:update', (_ev, count: number): void => {
  updateBadgeState(count)
})

// Badge window sends this when the user clicks it
ipcMain.on('badge:click', () => {
  log('[badge] clicked — focusing main window')
  hideBadge()
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

// ── Save dialog + file write (album downloads) ────────────────────────────────

ipcMain.handle('dialog:showSave', async (
  _ev,
  options: Electron.SaveDialogOptions,
): Promise<string | null> => {
  const { canceled, filePath } = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options)
  return canceled || !filePath ? null : filePath
})

ipcMain.handle('fs:writeFile', async (
  _ev,
  filePath: string,
  data: Uint8Array,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    fs.writeFileSync(filePath, Buffer.from(data))
    return { ok: true }
  } catch (e) {
    log(`[fs:writeFile] error: ${e}`)
    return { ok: false, error: String(e) }
  }
})

// ── Label / document printing ─────────────────────────────────────────────────
// Writes HTML to a temp file, loads it in a hidden BrowserWindow, then invokes
// the native OS print dialog via webContents.print(). Avoids the Chromium
// "This app doesn't support print preview" message that appears with window.open.

ipcMain.handle('print:html', async (_ev, html: string): Promise<{ ok: boolean; error?: string }> => {
  const tmpFile = path.join(os.tmpdir(), `pe-print-${Date.now()}.html`)
  try {
    fs.writeFileSync(tmpFile, html, 'utf8')

    const printWin = new BrowserWindow({
      width: 420,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration:  false,
        contextIsolation: true,
        sandbox:          true,
      },
    })

    await printWin.loadFile(tmpFile)

    return await new Promise((resolve) => {
      printWin.webContents.print(
        { silent: false, printBackground: true, color: true },
        (success, failureReason) => {
          log(`[print] success=${success} reason=${failureReason ?? ''}`)
          printWin.close()
          try { fs.unlinkSync(tmpFile) } catch {}
          resolve(success ? { ok: true } : { ok: false, error: failureReason ?? 'unknown' })
        },
      )
    })
  } catch (e) {
    try { fs.unlinkSync(tmpFile) } catch {}
    log(`[print] error: ${e}`)
    return { ok: false, error: String(e) }
  }
})

// ── Google OAuth — external browser + polling ─────────────────────────────────
//
// Flow:
//  1. Generate nonce = "ELECTRON_<uuid>"
//  2. shell.openExternal → user's default browser opens Google OAuth with state=nonce
//  3. Backend /auth/google-success detects state starts with "ELECTRON_", stores
//     userId keyed by nonce, serves a "you can close this tab" HTML page
//  4. This process polls /auth/google-desktop-redeem every 2 s with { nonce }
//     — backend returns { pending:true } until OAuth completes, then { token }
//  5. On token receipt: net.fetch (credentials:include) stores the refreshToken
//     cookie in Electron's session; IPC resolves with { success:true, accessToken }
//
// No custom protocol registration or reinstall needed.

export type GoogleLoginResult =
  | { success: true;  accessToken: string; refreshToken?: string }
  | { success: false; error: string }

const GOOGLE_CLIENT_ID = '970539775014-pdsiuqc987ses2n4o00e48geb2d2uikg.apps.googleusercontent.com'
const GOOGLE_REDIRECT  = 'https://www.perfectelt.com/perfect/v1/auth/google-success'
const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth'
const REDEEM_URL       = 'https://perfectelt.com/perfect/v1/auth/google-desktop-redeem'

let googlePollInterval:   ReturnType<typeof setInterval> | null = null
let googlePollTimeout:    ReturnType<typeof setTimeout>  | null = null
let pendingGoogleResolve: ((r: GoogleLoginResult) => void) | null = null
let pendingDeepLinkUrl:   string | null = null

function stopGooglePoll() {
  if (googlePollInterval) { clearInterval(googlePollInterval); googlePollInterval = null }
  if (googlePollTimeout)  { clearTimeout(googlePollTimeout);   googlePollTimeout  = null }
}

// ── Session redemption helper (used by both poll and deep-link handler) ────────

type RedeemResult =
  | { status: 'success'; accessToken: string; refreshToken?: string }
  | { status: 'pending' }
  | { status: 'error';   error: string }

async function redeemGoogleSession(nonce: string): Promise<RedeemResult> {
  try {
    const buf = tokenStore.get('device_token')
    const deviceToken = buf
      ? (safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8'))
      : undefined

    const resp = await net.fetch(REDEEM_URL, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json', 'Origin': PRODUCTION_ORIGIN },
      credentials: 'include',
      body:        JSON.stringify({ nonce, ...(deviceToken ? { deviceToken } : {}) }),
    })

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({})) as { error?: string }
      return { status: 'error', error: data.error ?? 'redeem_failed' }
    }

    const data = await resp.json() as { pending?: boolean; token?: string; refreshToken?: string }
    if (data.pending) return { status: 'pending' }
    if (!data.token)  return { status: 'error', error: 'no_token' }

    return { status: 'success', accessToken: data.token, refreshToken: data.refreshToken }
  } catch (err) {
    return { status: 'error', error: `network_error: ${err}` }
  }
}

// ── Deep-link handler ─────────────────────────────────────────────────────────
// Called whenever the OS delivers a desktopwarehouse:// URL to this process —
// either via open-url (macOS), second-instance argv (Win/Linux), or a startup arg.

function handleDeepLink(url: string): void {
  log('[deep-link] received: ' + url)
  if (!url.startsWith('desktopwarehouse://auth/')) return

  let session: string | null = null
  try {
    session = new URL(url).searchParams.get('session')
  } catch {
    log('[deep-link] failed to parse URL')
    return
  }
  if (!session) { log('[deep-link] missing session param'); return }

  // Bring window to foreground
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }

  // Capture and clear the pending resolve atomically before any async work
  const resolve = pendingGoogleResolve
  pendingGoogleResolve = null
  stopGooglePoll()

  redeemGoogleSession(session).then(r => {
    const result: GoogleLoginResult = r.status === 'success'
      ? { success: true, accessToken: r.accessToken, refreshToken: r.refreshToken }
      : { success: false, error: r.status === 'pending' ? 'not_ready' : r.error }

    log('[deep-link] redeem status=' + r.status)

    if (resolve) {
      // Active login flow: resolve the pending auth:google IPC promise
      resolve(result)
    } else {
      // Cold-start or no active flow: push result directly to the renderer
      mainWindow?.webContents.send('auth:deep-link-result', result)
    }
  }).catch(err => {
    log('[deep-link] unexpected error: ' + err)
    if (resolve) resolve({ success: false, error: String(err) })
  })
}

ipcMain.handle('auth:google', (): Promise<GoogleLoginResult> => {
  stopGooglePoll()
  pendingGoogleResolve = null

  return new Promise((resolve) => {
    pendingGoogleResolve = resolve

    const nonce = `ELECTRON_${crypto.randomUUID()}`

    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     GOOGLE_CLIENT_ID,
      redirect_uri:  GOOGLE_REDIRECT,
      scope:         'openid email profile',
      access_type:   'offline',
      prompt:        'select_account',
      state:         nonce,
    })

    shell.openExternal(`${GOOGLE_AUTH_URL}?${params}`)
      .catch((err) => {
        stopGooglePoll()
        const r = pendingGoogleResolve; pendingGoogleResolve = null
        r?.({ success: false, error: `open_failed: ${err.message}` })
      })

    // Poll every 2 s as fallback — deep-link will short-circuit this when it arrives
    googlePollInterval = setInterval(async () => {
      if (!pendingGoogleResolve) { stopGooglePoll(); return }

      const r = await redeemGoogleSession(nonce)
      if (!pendingGoogleResolve) { stopGooglePoll(); return } // deep-link won the race

      if (r.status === 'success') {
        stopGooglePoll()
        if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus() }
        log('[google-auth] poll redeemed token')
        const cb = pendingGoogleResolve; pendingGoogleResolve = null
        cb({ success: true, accessToken: r.accessToken, refreshToken: r.refreshToken })
      } else if (r.status === 'error' && !r.error.startsWith('network_error')) {
        // Terminal error (expired, redeem_failed, no_token) — stop polling
        stopGooglePoll()
        const cb = pendingGoogleResolve; pendingGoogleResolve = null
        cb({ success: false, error: r.error })
      }
      // status === 'pending' or network_error: keep polling
    }, 2000)

    googlePollTimeout = setTimeout(() => {
      stopGooglePoll()
      const cb = pendingGoogleResolve; pendingGoogleResolve = null
      cb?.({ success: false, error: 'timeout' })
    }, 5 * 60 * 1000)
  })
})

// ── Auto-update IPC ───────────────────────────────────────────────────────────

ipcMain.handle('update:check', (): void => {
  if (!app.isPackaged) {
    sendUpdateStatus({ state: 'error', message: 'Auto-update only works in the packaged app.' })
    return
  }
  sendUpdateStatus({ state: 'checking' })
  autoUpdater.checkForUpdates().catch((err) => {
    sendUpdateStatus({ state: 'error', message: err?.message ?? String(err) })
  })
})

ipcMain.handle('update:install', (): void => {
  log('[updater] user requested quitAndInstall')
  autoUpdater.quitAndInstall(true, true)  // isSilent=true → no wizard UI; isForceRunAfter=true → relaunch
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Set the Windows Application User Model ID so that notifications, the taskbar
// button, and safeStorage all display "Perfect Electronic" — not the default
// "electron.app.Perfect Electronic" fallback.
if (process.platform === 'win32') {
  app.setAppUserModelId('Admin Perfect Electronic')
}

// ── Protocol registration ─────────────────────────────────────────────────────
// On macOS the OS delivers open-url before app is ready; register early.
app.on('open-url', (event, url) => {
  event.preventDefault()
  if (mainWindow) {
    handleDeepLink(url)
  } else {
    pendingDeepLinkUrl = url
    log('[deep-link] stored pending URL (window not yet ready)')
  }
})

// Single-instance lock: if a second instance starts, bring window to front
// or handle an incoming desktopwarehouse:// URL (Windows / Linux).
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

app.on('second-instance', (_event, argv) => {
  const url = argv.find((a) => a.startsWith('desktopwarehouse://'))
  if (url) {
    handleDeepLink(url)
  } else if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// Windows / Linux: if the app was launched directly via the protocol (cold start),
// the URL appears as a command-line argument.
if (process.platform !== 'darwin') {
  const startUrl = process.argv.find((a) => a.startsWith('desktopwarehouse://'))
  if (startUrl) {
    pendingDeepLinkUrl = startUrl
    log('[deep-link] startup URL captured: ' + startUrl)
  }
}

app.whenReady().then(() => {
  // Register the custom protocol so the OS routes desktopwarehouse:// here.
  // electron-builder also writes the registry key (Win) / .desktop entry (Linux)
  // for packaged builds via the protocols section in electron-builder.yml.
  if (process.platform === 'linux' && !app.isPackaged) {
    app.setAsDefaultProtocolClient('desktopwarehouse', process.execPath, [
      path.resolve(process.argv[1]),
    ])
  } else {
    app.setAsDefaultProtocolClient('desktopwarehouse')
  }
  log('[protocol] registered desktopwarehouse://')

  initLogFile()
  initTokenFile()
  loadPersistedTokens()
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
