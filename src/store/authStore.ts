import { create } from 'zustand'
import { authApi } from '../api/auth'
import { registerAuthAccessors } from '../api/client'
import type { AuthUser } from '../types/auth'

// Safe accessor — window.electronAPI is set by the preload script.
// If the preload failed to load, this returns undefined gracefully.
function eAPI() {
  return window.electronAPI ?? null
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  initialize: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  _setToken: (token: string) => void
}

export const useAuthStore = create<AuthState>((set, get) => {
  const store: AuthState = {
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,

    _setToken(token: string) {
      set({ token })
      eAPI()?.saveToken('access_token', token)
    },

    async initialize() {
      console.log('[authStore] initialize() called')
      console.log('[authStore] window.electronAPI:', typeof window.electronAPI)

      set({ isLoading: true })
      try {
        const api = eAPI()
        if (!api) {
          console.warn('[authStore] window.electronAPI is undefined — preload may have failed')
          set({ isLoading: false, isAuthenticated: false })
          return
        }

        const token = await api.getToken('access_token')
        console.log('[authStore] stored token found:', token !== null)

        if (!token) {
          console.log('[authStore] no stored token → navigating to login')
          set({ isLoading: false })
          return
        }

        set({ token })
        console.log('[authStore] validating token via /auth/me')
        const user = await authApi.getMe()
        console.log('[authStore] /auth/me succeeded, user:', user.username)
        set({ user, isAuthenticated: true })
      } catch (err) {
        console.error('[authStore] initialize() error:', err)
        eAPI()?.clearTokens()
        set({ token: null, user: null, isAuthenticated: false })
      } finally {
        set({ isLoading: false })
        console.log('[authStore] initialize() complete, isLoading → false')
      }
    },

    async login(username: string, password: string) {
      set({ isLoading: true })
      try {
        const response = await authApi.login(username, password)
        const { accessToken, ...user } = response
        await eAPI()?.saveToken('access_token', accessToken)
        set({ token: accessToken, user: user as AuthUser, isAuthenticated: true })
      } finally {
        set({ isLoading: false })
      }
    },

    async logout() {
      try {
        await authApi.logout()
      } catch {
        // Always clear local state even if server logout fails
      } finally {
        await eAPI()?.clearTokens()
        set({ user: null, token: null, isAuthenticated: false })
      }
    },
  }

  // Wire client interceptors to this store (avoids circular import)
  registerAuthAccessors(
    () => get().token,
    (t) => get()._setToken(t),
    () => get().logout(),
  )

  return store
})
