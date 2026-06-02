import { apiClient } from './client'
import type { AuthUser, LoginApiResult, LoginResponse } from '../types/auth'

export const authApi = {
  async login(
    username: string,
    password: string,
    deviceToken: string,
  ): Promise<LoginApiResult> {
    const { data } = await apiClient.post<LoginApiResult>('/auth/login', {
      username,
      password,
      deviceToken,
    })
    return data
  },

  async verifyDeviceOtp(
    username: string,
    otp: string,
    deviceToken: string,
  ): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/verify-device-otp', {
      username,
      otp,
      deviceToken,
    })
    return data
  },

  async resendDeviceOtp(
    username: string,
    deviceToken: string,
  ): Promise<void> {
    await apiClient.post('/auth/resend-device-otp', {
      username,
      deviceToken,
    })
  },

  async getMe(): Promise<AuthUser> {
    const { data } = await apiClient.get<AuthUser>('/auth/me')
    return data
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
  },
}
