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
  /** Print an HTML string via the native OS print dialog (avoids Chromium print-preview issues) */
  printHtml: (html: string) => Promise<{ ok: boolean; error?: string }>
  /** Open a native Save dialog and return the chosen path (null if cancelled) */
  showSaveDialog: (options: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }) => Promise<string | null>
  /** Write binary data to a file path chosen via showSaveDialog */
  writeFile: (path: string, data: Uint8Array) => Promise<{ ok: boolean; error?: string }>

  // ── Google OAuth ───────────────────────────────────────────────────────────
  /** Open Google OAuth popup and return access token on success */
  googleLogin: () => Promise<GoogleLoginResult>
  /** Subscribe to deep-link auth results pushed from the main process (cold-start). */
  onDeepLinkResult: (cb: (result: GoogleLoginResult) => void) => () => void

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

  // ── Chat badge (LINE-style overlay when app is not focused) ───────────────
  /** Update the chat unread badge count. Shows/hides the overlay badge window. */
  updateBadge: (count: number) => Promise<void>
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
  printHtml:      (html)         => ipcRenderer.invoke('print:html', html),
  showSaveDialog: (options)      => ipcRenderer.invoke('dialog:showSave', options),
  writeFile:      (path, data)   => ipcRenderer.invoke('fs:writeFile', path, data),

  // ── Google OAuth ───────────────────────────────────────────────────────────
  googleLogin: () => ipcRenderer.invoke('auth:google'),

  onDeepLinkResult: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, result: GoogleLoginResult) => cb(result)
    ipcRenderer.on('auth:deep-link-result', listener)
    return () => ipcRenderer.removeListener('auth:deep-link-result', listener)
  },

  // ── Auto-update ────────────────────────────────────────────────────────────
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate:   () => ipcRenderer.invoke('update:install'),

  onUpdateStatus: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => cb(status)
    ipcRenderer.on('update:status', listener)
    // Return an unsubscribe function so the caller can clean up
    return () => ipcRenderer.removeListener('update:status', listener)
  },

  // ── Chat badge ─────────────────────────────────────────────────────────────
  updateBadge: (count) => ipcRenderer.invoke('badge:update', count),
}

contextBridge.exposeInMainWorld('electronAPI', api)
