import {
  app, BrowserWindow, ipcMain, safeStorage,
  session, Menu, shell, Notification, net,
} from 'electron'
import { createRequire } from 'node:module'
import path   from 'node:path'
import fs     from 'node:fs'
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
// Checks public GitHub Releases for DeezisP/desktop-app.
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
  log('[updater] provider=github')
  log('[updater] owner=DeezisP')
  log('[updater] repo=desktop-app')
  log('[updater] releaseType=release')

  autoUpdater.logger              = null   // we capture everything via events below
  autoUpdater.autoDownload        = true   // background download, no prompt
  autoUpdater.autoInstallOnAppQuit = false // user must click "Restart and Install"

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
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
    sendUpdateStatus({ state: 'error', message: err?.message ?? String(err) })
  })

  log('[updater] initialised')
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
    title:     'Perfect Electronic',
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

    // Auto-update check — packaged builds only; dev mode has no installer channel
    if (app.isPackaged) {
      setTimeout(() => {
        log('[updater] auto-checking for updates on startup')
        autoUpdater.checkForUpdates().catch((err) => {
          log(`[updater] startup check failed: ${err?.message ?? err}`)
          sendUpdateStatus({ state: 'error', message: err?.message ?? String(err) })
        })
      }, 3000)
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

ipcMain.handle('token:clear', (): boolean => { tokenStore.clear(); return true })

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

// ── Google OAuth — external browser + custom deep link ───────────────────────
//
// Flow:
//  1. shell.openExternal → user's default browser opens Google OAuth
//  2. Backend /auth/google-success detects state=ELECTRON_DESKTOP, issues a
//     short-lived exchange token, redirects to perfectelt://oauth?et=<token>
//  3. OS launches this app (or notifies the running instance) with the URL
//  4. handleGoogleDeepLink() redeems the token via /auth/google-desktop-redeem
//     which sets the HttpOnly refreshToken cookie in the Electron session AND
//     returns the access token
//  5. IPC promise resolves with { success: true, accessToken }

export type GoogleLoginResult =
  | { success: true;  accessToken: string }
  | { success: false; error: string }

const GOOGLE_CLIENT_ID = '970539775014-pdsiuqc987ses2n4o00e48geb2d2uikg.apps.googleusercontent.com'
const GOOGLE_REDIRECT  = 'https://www.perfectelt.com/perfect/v1/auth/google-success'
const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth'
const REDEEM_URL       = 'https://perfectelt.com/perfect/v1/auth/google-desktop-redeem'

let pendingGoogleResolve: ((r: GoogleLoginResult) => void) | null = null
let googleLoginTimeout: ReturnType<typeof setTimeout> | null      = null

async function handleGoogleDeepLink(url: string) {
  if (!pendingGoogleResolve) return
  try {
    const parsed = new URL(url)
    const et    = parsed.searchParams.get('et')
    const error = parsed.searchParams.get('error')

    if (error || !et) {
      const resolve = pendingGoogleResolve
      pendingGoogleResolve = null
      if (googleLoginTimeout) { clearTimeout(googleLoginTimeout); googleLoginTimeout = null }
      resolve({ success: false, error: error ?? 'google_failed' })
      return
    }

    log(`[google-auth] deep link received, redeeming et=${et.slice(0, 8)}…`)
    const resp = await net.fetch(REDEEM_URL, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json', 'Origin': PRODUCTION_ORIGIN },
      credentials: 'include',
      body:        JSON.stringify({ et }),
    })

    const resolve = pendingGoogleResolve
    pendingGoogleResolve = null
    if (googleLoginTimeout) { clearTimeout(googleLoginTimeout); googleLoginTimeout = null }

    if (!resp.ok) {
      log(`[google-auth] redeem HTTP ${resp.status}`)
      resolve({ success: false, error: 'redeem_failed' })
      return
    }

    const data = await resp.json() as { token?: string }
    if (!data.token) { resolve({ success: false, error: 'no_access_token' }); return }

    log('[google-auth] deep link redeemed — access token obtained')
    resolve({ success: true, accessToken: data.token })
  } catch (err) {
    const resolve = pendingGoogleResolve
    pendingGoogleResolve = null
    if (googleLoginTimeout) { clearTimeout(googleLoginTimeout); googleLoginTimeout = null }
    resolve?.({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
}

ipcMain.handle('auth:google', (): Promise<GoogleLoginResult> => {
  // Cancel any in-flight login
  if (pendingGoogleResolve) {
    pendingGoogleResolve({ success: false, error: 'cancelled' })
    pendingGoogleResolve = null
  }
  if (googleLoginTimeout) { clearTimeout(googleLoginTimeout); googleLoginTimeout = null }

  return new Promise((resolve) => {
    pendingGoogleResolve = resolve

    // 5-minute timeout
    googleLoginTimeout = setTimeout(() => {
      if (pendingGoogleResolve === resolve) {
        pendingGoogleResolve = null
        resolve({ success: false, error: 'timeout' })
      }
    }, 5 * 60 * 1000)

    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     GOOGLE_CLIENT_ID,
      redirect_uri:  GOOGLE_REDIRECT,
      scope:         'openid email profile',
      access_type:   'offline',
      prompt:        'select_account',
      state:         'ELECTRON_DESKTOP',
    })

    shell.openExternal(`${GOOGLE_AUTH_URL}?${params}`)
      .catch((err) => {
        pendingGoogleResolve = null
        if (googleLoginTimeout) { clearTimeout(googleLoginTimeout); googleLoginTimeout = null }
        resolve({ success: false, error: `open_failed: ${err.message}` })
      })
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
  autoUpdater.quitAndInstall(false, true)
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Register the perfectelt:// custom URI scheme so the OS can route OAuth
// deep links back to this app after the user signs in via their browser.
app.setAsDefaultProtocolClient('perfectelt')

// Enforce single instance so deep links from a second launch are forwarded
// to the already-running instance via the second-instance event.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

// Windows: second instance started with the deep link URL as a CLI arg
app.on('second-instance', (_ev, commandLine) => {
  const url = commandLine.find(a => a.startsWith('perfectelt://'))
  if (url) handleGoogleDeepLink(url)
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// macOS: OS sends the URL directly via open-url event
app.on('open-url', (ev, url) => {
  ev.preventDefault()
  handleGoogleDeepLink(url)
})

app.whenReady().then(() => {
  initLogFile()
  setupAutoUpdater()
  buildMenu()
  createWindow()

  // Handle deep link on cold launch (Windows passes URL as process.argv entry)
  const coldUrl = process.argv.find(a => a.startsWith('perfectelt://'))
  if (coldUrl) handleGoogleDeepLink(coldUrl)
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
