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

export interface ElectronAPI {
  saveToken:   (key: string, value: string) => Promise<boolean>
  getToken:    (key: string) => Promise<string | null>
  deleteToken: (key: string) => Promise<boolean>
  clearTokens: () => Promise<boolean>
  appVersion:  () => Promise<string>
  platform:    string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
