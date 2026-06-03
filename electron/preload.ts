import { contextBridge, ipcRenderer } from 'electron'
import type { UpdateStatus, GoogleLoginResult } from './main'

export type ElectronAPI = {
  saveToken:   (key: string, value: string)  => Promise<boolean>
  getToken:    (key: string)                 => Promise<string | null>
  deleteToken: (key: string)                 => Promise<boolean>
  clearTokens: ()                            => Promise<boolean>
  appVersion:  ()                            => Promise<string>
  platform:    NodeJS.Platform
  logError:    (message: string, stack: string) => Promise<void>
  openLogFile: ()                            => Promise<boolean>
  readLog:     ()                            => Promise<string>
  logPath:     ()                            => Promise<string>
  /** Send a native desktop notification via the main process */
  showNotification: (title: string, body?: string) => Promise<void>

  // ── Google OAuth ───────────────────────────────────────────────────────────
  /** Open Google OAuth popup and return access token on success */
  googleLogin: () => Promise<GoogleLoginResult>

  // ── Auto-update ────────────────────────────────────────────────────────────
  /** Trigger a manual update check (noop in dev mode) */
  checkForUpdates: () => Promise<void>
  /** Quit the app and install the downloaded update */
  installUpdate:   () => Promise<void>
  /**
   * Subscribe to update status events pushed from the main process.
   * Returns an unsubscribe function.
   */
  onUpdateStatus:  (cb: (status: UpdateStatus) => void) => () => void
}

const api: ElectronAPI = {
  saveToken:   (key, value) => ipcRenderer.invoke('token:save', key, value),
  getToken:    (key)        => ipcRenderer.invoke('token:get', key),
  deleteToken: (key)        => ipcRenderer.invoke('token:delete', key),
  clearTokens: ()           => ipcRenderer.invoke('token:clear'),
  appVersion:  ()           => ipcRenderer.invoke('app:version'),
  platform:    process.platform,
  logError:    (msg, stack) => ipcRenderer.invoke('log:error', msg, stack),
  openLogFile: ()           => ipcRenderer.invoke('log:open'),
  readLog:     ()           => ipcRenderer.invoke('log:read'),
  logPath:     ()           => ipcRenderer.invoke('log:path'),
  showNotification: (title, body) => ipcRenderer.invoke('notify:show', title, body),

  // ── Google OAuth ───────────────────────────────────────────────────────────
  googleLogin: () => ipcRenderer.invoke('auth:google'),

  // ── Auto-update ────────────────────────────────────────────────────────────
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate:   () => ipcRenderer.invoke('update:install'),

  onUpdateStatus: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => cb(status)
    ipcRenderer.on('update:status', listener)
    // Return an unsubscribe function so the caller can clean up
    return () => ipcRenderer.removeListener('update:status', listener)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
