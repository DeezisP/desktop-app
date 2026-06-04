import { create } from 'zustand'
import type { ChatRoom, ChatMessage, OutboundMessage } from '../types/chat'

interface ChatState {
  rooms: ChatRoom[]
  // roomId → messages sorted oldest-first
  messages: Record<number, ChatMessage[]>
  // roomId → cursor for loading older messages
  cursors: Record<number, string | null>
  hasMore: Record<number, boolean>
  // roomId → set of display names currently typing
  typing: Record<number, Set<string>>
  // userId → online status
  presence: Record<number, boolean>
  activeRoomId: number | null
  // messages queued while offline
  outboundQueue: OutboundMessage[]
  loadingRooms: boolean
  loadingMessages: Record<number, boolean>

  setRooms: (rooms: ChatRoom[]) => void
  setActiveRoom: (roomId: number | null) => void
  prependMessages: (roomId: number, messages: ChatMessage[], nextCursor: string | null, hasMore: boolean) => void
  appendMessage: (message: ChatMessage) => void
  replaceMessage: (clientMessageId: string, message: ChatMessage) => void
  softDeleteMessage: (messageId: number) => void
  updateRoomPreview: (roomId: number, lastMessage: string, lastMessageAt: string) => void
  decrementUnread: (roomId: number) => void
  clearUnread: (roomId: number) => void
  setTyping: (roomId: number, displayName: string, isTyping: boolean) => void
  setPresence: (userId: number, online: boolean) => void
  addToQueue: (msg: OutboundMessage) => void
  removeFromQueue: (clientMessageId: string) => void
  setLoadingRooms: (v: boolean) => void
  setLoadingMessages: (roomId: number, v: boolean) => void
  setCursor: (roomId: number, cursor: string | null, hasMore: boolean) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  messages: {},
  cursors: {},
  hasMore: {},
  typing: {},
  presence: {},
  activeRoomId: null,
  outboundQueue: [],
  loadingRooms: false,
  loadingMessages: {},

  setRooms(rooms) {
    set({ rooms })
  },

  setActiveRoom(roomId) {
    set({ activeRoomId: roomId })
  },

  // Called when loading history (older messages prepended at top)
  prependMessages(roomId, messages, nextCursor, hasMore) {
    set((s) => {
      const existing = s.messages[roomId] ?? []
      const existingIds = new Set(existing.map((m) => m.id))
      const deduped = messages.filter((m) => !existingIds.has(m.id))
      return {
        messages: { ...s.messages, [roomId]: [...deduped, ...existing] },
        cursors: { ...s.cursors, [roomId]: nextCursor },
        hasMore: { ...s.hasMore, [roomId]: hasMore },
      }
    })
  },

  // Called when a new message arrives via STOMP or initial load (append newest)
  appendMessage(message) {
    set((s) => {
      const existing = s.messages[message.room.id] ?? []
      if (existing.some((m) => m.id === message.id || m.clientMessageId === message.clientMessageId)) {
        return {}
      }
      const updated = [...existing, message]
      // Update room preview
      const rooms = s.rooms.map((r) =>
        r.id === message.room.id
          ? { ...r, lastMessage: message.messageText, lastMessageAt: message.sentAt }
          : r,
      )
      return {
        messages: { ...s.messages, [message.room.id]: updated },
        rooms,
      }
    })
  },

  // Replace optimistic/pending message with server-confirmed one
  replaceMessage(clientMessageId, message) {
    set((s) => {
      const existing = s.messages[message.room.id] ?? []
      if (existing.some((m) => m.id === message.id)) return {}
      const updated = existing.map((m) =>
        m.clientMessageId === clientMessageId ? message : m,
      )
      return { messages: { ...s.messages, [message.room.id]: updated } }
    })
  },

  softDeleteMessage(messageId) {
    set((s) => {
      const updated: Record<number, ChatMessage[]> = {}
      for (const [rid, msgs] of Object.entries(s.messages)) {
        updated[Number(rid)] = msgs.map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, messageText: '' } : m,
        )
      }
      return { messages: updated }
    })
  },

  updateRoomPreview(roomId, lastMessage, lastMessageAt) {
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === roomId ? { ...r, lastMessage, lastMessageAt } : r,
      ),
    }))
  },

  decrementUnread(roomId) {
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === roomId ? { ...r, unreadCount: Math.max(0, r.unreadCount - 1) } : r,
      ),
    }))
  },

  clearUnread(roomId) {
    set((s) => ({
      rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r)),
    }))
  },

  setTyping(roomId, displayName, isTyping) {
    set((s) => {
      const current = new Set(s.typing[roomId] ?? [])
      if (isTyping) current.add(displayName)
      else current.delete(displayName)
      return { typing: { ...s.typing, [roomId]: current } }
    })
  },

  setPresence(userId, online) {
    set((s) => ({ presence: { ...s.presence, [userId]: online } }))
  },

  addToQueue(msg) {
    set((s) => ({ outboundQueue: [...s.outboundQueue, msg] }))
  },

  removeFromQueue(clientMessageId) {
    set((s) => ({
      outboundQueue: s.outboundQueue.filter((m) => m.clientMessageId !== clientMessageId),
    }))
  },

  setLoadingRooms(v) {
    set({ loadingRooms: v })
  },

  setLoadingMessages(roomId, v) {
    set((s) => ({ loadingMessages: { ...s.loadingMessages, [roomId]: v } }))
  },

  setCursor(roomId, cursor, hasMore) {
    set((s) => ({
      cursors: { ...s.cursors, [roomId]: cursor },
      hasMore: { ...s.hasMore, [roomId]: hasMore },
    }))
  },
}))

// Selector helpers
export const selectSortedRooms = (s: ChatState) =>
  [...s.rooms].sort((a, b) => {
    if (!a.lastMessageAt && !b.lastMessageAt) return 0
    if (!a.lastMessageAt) return 1
    if (!b.lastMessageAt) return -1
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  })

export const selectTotalUnread = (s: ChatState) =>
  s.rooms.reduce((sum, r) => sum + r.unreadCount, 0)
