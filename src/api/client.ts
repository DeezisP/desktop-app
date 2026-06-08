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
let _refreshToken: string | null = null

export function registerAuthAccessors(
  getToken: () => string | null,
  setToken: (t: string) => void,
  doLogout: () => Promise<void>,
) {
  _getToken  = getToken
  _setToken  = setToken
  _doLogout  = doLogout
}

/** Called by authStore whenever a refresh token is obtained or cleared. */
export function setStoredRefreshToken(token: string | null) {
  _refreshToken = token
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
      // Send the stored refresh token in the request body as a fallback for Electron
      // where SameSite cookies may not be forwarded from the renderer context.
      // The server still checks the HttpOnly cookie first; body is only used when
      // the cookie is absent.
      const body = _refreshToken ? { refreshToken: _refreshToken } : {}
      const { data } = await axios.post<RefreshResponse & { refreshToken?: string }>(
        `${BASE_URL}/auth/refresh`,
        body,
        { withCredentials: true },
      )
      const newToken = data.token
      _setToken?.(newToken)
      if (data.refreshToken) _refreshToken = data.refreshToken
      drainQueue(null, newToken)
      original.headers.Authorization = `Bearer ${newToken}`
      return apiClient(original)
    } catch (refreshErr) {
      drainQueue(refreshErr, null)
      // Only logout when the refresh endpoint explicitly rejects the token (401/403).
      // Network errors, timeouts, and 5xx responses are transient — keep the session.
      const status = (refreshErr as { response?: { status?: number } })?.response?.status
      if (status === 401 || status === 403) {
        await _doLogout?.()
      }
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  },
)
