import { create } from 'zustand'
import axios from 'axios'
import { authApi } from '../api/auth'
import { registerAuthAccessors } from '../api/client'
import type { AuthUser } from '../types/auth'

function eAPI() {
  return window.electronAPI ?? null
}

// ── Stable per-installation device token ─────────────────────────────────────
// Generated once, stored encrypted via safeStorage.
// Using a stable UUID ensures the device is only verified once per machine.

async function getOrCreateDeviceToken(): Promise<string> {
  const api = eAPI()
  if (!api) {
    // Preload unavailable — use a session-only identifier
    return 'DESKTOP-UNKNOWN'
  }
  let token = await api.getToken('device_token')
  if (!token) {
    // crypto.randomUUID() is available in Electron's Chromium renderer
    token = crypto.randomUUID()
    await api.saveToken('device_token', token)
    console.log('[authStore] generated new device token')
  }
  return token
}

// ── State shape ───────────────────────────────────────────────────────────────

export interface PendingOtp {
  username:    string
  deviceToken: string
  maskedEmail: string
}

interface AuthState {
  user:            AuthUser | null
  token:           string | null
  isLoading:       boolean
  isAuthenticated: boolean
  pendingOtp:      PendingOtp | null

  initialize:      () => Promise<void>
  login:           (username: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  verifyOtp:       (otp: string) => Promise<void>
  resendOtp:       () => Promise<void>
  cancelOtp:       () => void
  logout:          () => Promise<void>
  _setToken:       (token: string) => void
}

export const useAuthStore = create<AuthState>((set, get) => {
  const store: AuthState = {
    user:            null,
    token:           null,
    isLoading:       true,
    isAuthenticated: false,
    pendingOtp:      null,

    _setToken(token: string) {
      set({ token })
      if (eAPI()) {
        eAPI()!.saveToken('access_token', token)
      } else {
        sessionStorage.setItem('access_token', token)
      }
    },

    async initialize() {
      console.log('[authStore] initialize()')
      set({ isLoading: true })
      try {
        const api = eAPI()
        let token: string | null = null
        if (api) {
          token = await api.getToken('access_token')
        } else {
          // Browser dev mode — persist session across reloads via sessionStorage
          token = sessionStorage.getItem('access_token')
        }
        if (!token) {
          set({ isLoading: false })
          return
        }
        set({ token })
        const user = await authApi.getMe()
        console.log('[authStore] session restored for', user.username)
        set({ user, isAuthenticated: true })
      } catch (err) {
        console.error('[authStore] initialize error:', err)
        // Only clear the stored token if the server explicitly rejected it (401/403).
        // Network errors, timeouts, and other transient failures must NOT trigger
        // logout — the user's session is still valid; we just can't verify it right now.
        const status = axios.isAxiosError(err) ? err.response?.status : undefined
        if (status === 401 || status === 403) {
          eAPI()?.clearTokens()
          sessionStorage.removeItem('access_token')
          set({ token: null, user: null, isAuthenticated: false })
        }
        // For transient errors: leave token intact so the app keeps the user logged in.
        // The next API call will re-attempt authentication via the refresh interceptor.
      } finally {
        set({ isLoading: false })
      }
    },

    async login(username: string, password: string) {
      set({ isLoading: true, pendingOtp: null })
      try {
        const deviceToken = await getOrCreateDeviceToken()
        const result = await authApi.login(username, password, deviceToken)

        if ('requiresDeviceVerification' in result && result.requiresDeviceVerification) {
          // Server sent OTP to the user's email — show OTP step
          console.log('[authStore] device OTP required, masked email:', result.maskedEmail)
          set({
            pendingOtp: { username, deviceToken, maskedEmail: result.maskedEmail },
          })
          return
        }

        // Trusted device — full login response (narrowed past the guard above)
        const loginResp = result as import('../types/auth').LoginResponse
        const { accessToken, ...user } = loginResp
        if (eAPI()) { await eAPI()!.saveToken('access_token', accessToken) }
        else { sessionStorage.setItem('access_token', accessToken) }
        set({ token: accessToken, user: user as AuthUser, isAuthenticated: true })
      } finally {
        set({ isLoading: false })
      }
    },

    async loginWithGoogle() {
      const api = eAPI()
      if (!api?.googleLogin) throw new Error('Google login not available')
      set({ isLoading: true })
      try {
        const result = await api.googleLogin()
        if (!result.success) {
          if (result.error === 'cancelled') return
          throw new Error(result.error)
        }
        const { accessToken } = result
        if (api) {
          await api.saveToken('access_token', accessToken)
        } else {
          sessionStorage.setItem('access_token', accessToken)
        }
        set({ token: accessToken })
        const user = await authApi.getMe()
        set({ user, isAuthenticated: true })
        console.log('[authStore] Google login successful for', user.username)
      } catch (err) {
        eAPI()?.deleteToken('access_token')
        sessionStorage.removeItem('access_token')
        set({ token: null })
        throw err
      } finally {
        set({ isLoading: false })
      }
    },

    async verifyOtp(otp: string) {
      const { pendingOtp } = get()
      if (!pendingOtp) throw new Error('No pending OTP state')

      set({ isLoading: true })
      try {
        const result = await authApi.verifyDeviceOtp(
          pendingOtp.username,
          otp.trim(),
          pendingOtp.deviceToken,
        )
        const { accessToken, ...user } = result
        if (eAPI()) { await eAPI()!.saveToken('access_token', accessToken) }
        else { sessionStorage.setItem('access_token', accessToken) }
        set({
          token:           accessToken,
          user:            user as AuthUser,
          isAuthenticated: true,
          pendingOtp:      null,
        })
        console.log('[authStore] device OTP verified, logged in as', user.username)
      } finally {
        set({ isLoading: false })
      }
    },

    async resendOtp() {
      const { pendingOtp } = get()
      if (!pendingOtp) return
      await authApi.resendDeviceOtp(pendingOtp.username, pendingOtp.deviceToken)
      console.log('[authStore] OTP resent')
    },

    cancelOtp() {
      set({ pendingOtp: null })
    },

    async logout() {
      try {
        await authApi.logout()
      } catch {
        // Always clear local state even if server call fails
      } finally {
        eAPI()?.clearTokens()
        sessionStorage.removeItem('access_token')
        set({ user: null, token: null, isAuthenticated: false, pendingOtp: null })
      }
    },
  }

  registerAuthAccessors(
    () => get().token,
    (t) => get()._setToken(t),
    () => get().logout(),
  )

  return store
})
