import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { RefreshResponse } from '../types/auth'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'https://perfectelt.com/perfect/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Token accessor (avoids circular import with authStore) ────────────────────

let _getToken: (() => string | null) | null = null
let _setToken: ((t: string) => void) | null = null
let _doLogout: (() => Promise<void>) | null = null

export function registerAuthAccessors(
  getToken: () => string | null,
  setToken: (t: string) => void,
  doLogout: () => Promise<void>,
) {
  _getToken  = getToken
  _setToken  = setToken
  _doLogout  = doLogout
}

// ── Refresh state ─────────────────────────────────────────────────────────────

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function drainQueue(err: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => (token ? resolve(token) : reject(err)))
  failedQueue = []
}

// ── Request interceptor: attach Bearer token ──────────────────────────────────

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = _getToken?.()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor: handle 401 → refresh → retry ───────────────────────

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return apiClient(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post<RefreshResponse>(
        `${BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      const newToken = data.token
      _setToken?.(newToken)
      drainQueue(null, newToken)
      original.headers.Authorization = `Bearer ${newToken}`
      return apiClient(original)
    } catch (refreshErr) {
      drainQueue(refreshErr, null)
      await _doLogout?.()
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  },
)
