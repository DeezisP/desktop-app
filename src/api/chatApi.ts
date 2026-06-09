import { apiClient } from './client'
import type { ChatRoom, ChatMessage, PagedMessageResponse } from '../types/chat'

export const chatApi = {
  getRooms(): Promise<ChatRoom[]> {
    return apiClient
      .get<ChatRoom[]>('/chat/rooms/active')
      .then((r) => (Array.isArray(r.data) ? r.data : []))
  },

  getMessages(roomId: number, beforeId?: number, limit = 50): Promise<PagedMessageResponse> {
    return apiClient
      .get<PagedMessageResponse>(`/chat/rooms/${roomId}/messages`, {
        params: { ...(beforeId !== undefined ? { beforeId } : {}), limit },
      })
      .then((r) => ({
        messages: Array.isArray(r.data?.messages) ? r.data.messages : [],
        nextCursor: r.data?.nextCursor ?? null,
        hasMore: r.data?.hasMore ?? false,
      }))
  },

  getMessagesSince(roomId: number, sinceId: number): Promise<ChatMessage[]> {
    return apiClient
      .get<ChatMessage[]>(`/chat/rooms/${roomId}/messages/since`, {
        params: { sinceId },
      })
      .then((r) => (Array.isArray(r.data) ? r.data : []))
  },

  getReadState(roomId: number): Promise<{ partnerLastReadMessageId?: number | null }> {
    return apiClient
      .get<{ partnerLastReadMessageId?: number | null }>(`/chat/rooms/${roomId}/read-state`)
      .then((r) => r.data ?? {})
      .catch(() => ({}))
  },

  sendMessage(roomId: number, messageText: string, clientMessageId: string): Promise<ChatMessage> {
    return apiClient
      .post<ChatMessage>('/chat/messages/send', {
        roomId,
        messageText,
        clientMessageId,
      })
      .then((r) => r.data)
  },

  markRead(roomId: number): Promise<void> {
    return apiClient.post(`/chat/rooms/${roomId}/read`).then(() => undefined)
  },

  deleteMessage(messageId: number): Promise<void> {
    return apiClient.delete(`/chat/messages/${messageId}`).then(() => undefined)
  },
}
