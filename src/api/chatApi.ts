import { apiClient } from './client'
import type { ChatRoom, ChatMessage, PagedMessageResponse } from '../types/chat'
import type { ApiResponse } from '../types/api'

export const chatApi = {
  getRooms(): Promise<ChatRoom[]> {
    return apiClient
      .get<ApiResponse<ChatRoom[]>>('/chat/rooms/active')
      .then((r) => r.data.data)
  },

  getMessages(roomId: number, beforeId?: number, limit = 50): Promise<PagedMessageResponse> {
    return apiClient
      .get<PagedMessageResponse>(`/chat/rooms/${roomId}/messages`, {
        params: { ...(beforeId !== undefined ? { beforeId } : {}), limit },
      })
      .then((r) => r.data)
  },

  getMessagesSince(roomId: number, sinceId: number): Promise<ChatMessage[]> {
    return apiClient
      .get<ApiResponse<ChatMessage[]>>(`/chat/rooms/${roomId}/messages/since`, {
        params: { sinceId },
      })
      .then((r) => r.data.data)
  },

  sendMessage(roomId: number, messageText: string, clientMessageId: string): Promise<ChatMessage> {
    return apiClient
      .post<ApiResponse<ChatMessage>>('/chat/messages/send', {
        roomId,
        messageText,
        clientMessageId,
      })
      .then((r) => r.data.data)
  },

  markRead(roomId: number): Promise<void> {
    return apiClient.post(`/chat/rooms/${roomId}/read`).then(() => undefined)
  },

  deleteMessage(messageId: number): Promise<void> {
    return apiClient.delete(`/chat/messages/${messageId}`).then(() => undefined)
  },
}
