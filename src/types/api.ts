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

// ── Google OAuth result returned from main process ───────────────────────────

export type GoogleLoginResult =
  | { success: true;  accessToken: string; refreshToken?: string }
  | { success: false; error: string }

// ── Auto-update status pushed from main process ───────────────────────────────

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available';     version: string; releaseNotes?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading';   percent: number; bytesPerSecond: number; transferred: number; total: number; isDifferential: boolean }
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

  // ── Google OAuth ───────────────────────────────────────────────────────────
  googleLogin: () => Promise<GoogleLoginResult>
  onDeepLinkResult: (cb: (result: GoogleLoginResult) => void) => () => void

  // ── Auto-update ────────────────────────────────────────────────────────────
  checkForUpdates: () => Promise<void>
  installUpdate:   () => Promise<void>
  onUpdateStatus:  (cb: (status: UpdateStatus) => void) => () => void

  // ── File system ────────────────────────────────────────────────────────────
  showSaveDialog: (options: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }) => Promise<string | null>
  writeFile: (path: string, data: Uint8Array) => Promise<{ ok: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
