import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const user            = useAuthStore((s) => s.user)
  const token           = useAuthStore((s) => s.token)
  const isLoading       = useAuthStore((s) => s.isLoading)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login           = useAuthStore((s) => s.login)
  const logout          = useAuthStore((s) => s.logout)

  return { user, token, isLoading, isAuthenticated, login, logout }
}
