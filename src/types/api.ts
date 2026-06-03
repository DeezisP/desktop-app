export interface ApiResponse<T> {
  success: boolean
  code: number
  message: string
  data: T
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
  numberOfElements: number
}

// ── Auto-update status pushed from main process ───────────────────────────────

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available';     version: string; releaseNotes?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading';   percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { state: 'downloaded';    version: string }
  | { state: 'error';         message: string }

// ── Electron IPC bridge exposed via contextBridge ─────────────────────────────

export interface ElectronAPI {
  saveToken:   (key: string, value: string)  => Promise<boolean>
  getToken:    (key: string)                 => Promise<string | null>
  deleteToken: (key: string)                 => Promise<boolean>
  clearTokens: ()                            => Promise<boolean>
  appVersion:  ()                            => Promise<string>
  platform:    string
  logError:    (message: string, stack: string) => Promise<void>
  openLogFile: ()                            => Promise<boolean>
  readLog:     ()                            => Promise<string>
  logPath:     ()                            => Promise<string>
  showNotification: (title: string, body?: string) => Promise<void>

  // ── Auto-update ────────────────────────────────────────────────────────────
  checkForUpdates: () => Promise<void>
  installUpdate:   () => Promise<void>
  onUpdateStatus:  (cb: (status: UpdateStatus) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
