import { apiClient } from './client'
import type { AuthUser, LoginResponse } from '../types/auth'

export const authApi = {
  async login(username: string, password: string, deviceToken = 'DESKTOP'): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', {
      username,
      password,
      deviceToken,
    })
    return data
  },

  async getMe(): Promise<AuthUser> {
    const { data } = await apiClient.get<AuthUser>('/auth/me')
    return data
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
  },
}
