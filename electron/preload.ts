import { contextBridge, ipcRenderer } from 'electron'

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
}

contextBridge.exposeInMainWorld('electronAPI', api)
