import { apiClient } from './client'
import type { StoreOrder } from './warehouse'

export interface AdminUser {
  id: number
  name: string
  email: string
  role: string
  username?: string
}

export const userApi = {
  async listAll(): Promise<AdminUser[]> {
    const { data } = await apiClient.get<AdminUser[]>('/user/admin/all')
    return data
  },

  async deleteUser(userId: number): Promise<void> {
    await apiClient.delete(`/user/admin/${userId}`)
  },

  async getUserOrders(userId: number): Promise<StoreOrder[]> {
    const { data } = await apiClient.get<StoreOrder[]>(`/user/admin/${userId}/orders`)
    return data
  },
}
