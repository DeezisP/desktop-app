import { create } from 'zustand'
import { authApi } from '../api/auth'
import { registerAuthAccessors } from '../api/client'
import type { AuthUser } from '../types/auth'

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
      window.electronAPI.saveToken('access_token', token)
    },

    async initialize() {
      set({ isLoading: true })
      try {
        const token = await window.electronAPI.getToken('access_token')
        if (!token) {
          set({ isLoading: false })
          return
        }
        set({ token })
        const user = await authApi.getMe()
        set({ user, isAuthenticated: true })
      } catch {
        await window.electronAPI.clearTokens()
        set({ token: null, user: null, isAuthenticated: false })
      } finally {
        set({ isLoading: false })
      }
    },

    async login(username: string, password: string) {
      set({ isLoading: true })
      try {
        const response = await authApi.login(username, password)
        const { accessToken, ...user } = response
        await window.electronAPI.saveToken('access_token', accessToken)
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
        await window.electronAPI.clearTokens()
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
