import { create } from 'zustand'
import type { ChatRoom, ChatMessage, OutboundMessage } from '../types/chat'

// Single source of truth for message order, regardless of API/merge order.
// `id` is the tiebreaker (not just sentAt) because it's the same auto-increment
// column the backend's own queries order by — immune to same-millisecond ties
// or LocalDateTime parsing quirks.
function sortMessages(msgs: ChatMessage[]): ChatMessage[] {
  return [...msgs].sort((a, b) => {
    const ta = new Date(a.sentAt).getTime()
    const tb = new Date(b.sentAt).getTime()
    return ta !== tb ? ta - tb : a.id - b.id
  })
}

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
  // roomId → partner's last read message ID
  partnerLastReadId: Record<number, number | null>

  setRooms: (rooms: ChatRoom[] | null | undefined) => void
  removeRoom: (roomId: number) => void
  setActiveRoom: (roomId: number | null) => void
  prependMessages: (roomId: number, messages: ChatMessage[], nextCursor: string | null, hasMore: boolean) => void
  addOptimisticMessage: (message: ChatMessage) => void
  upsertMessage: (message: ChatMessage) => void
  markMessageFailed: (clientMessageId: string) => void
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
  setPartnerLastReadId: (roomId: number, messageId: number | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
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
  partnerLastReadId: {},

  // Always coerce to array — guards against null/undefined from API
  setRooms(rooms) {
    set({ rooms: Array.isArray(rooms) ? rooms : [] })
  },

  removeRoom(roomId) {
    set((s) => ({ rooms: (s.rooms ?? []).filter((r) => r.id !== roomId) }))
  },

  setActiveRoom(roomId) {
    set({ activeRoomId: roomId })
  },

  prependMessages(roomId, messages, nextCursor, hasMore) {
    set((s) => {
      const safeMessages = Array.isArray(messages) ? messages : []
      const existing = s.messages[roomId] ?? []
      const existingIds = new Set(existing.map((m) => m.id))
      const deduped = safeMessages.filter((m) => !existingIds.has(m.id))
      return {
        messages: { ...(s.messages ?? {}), [roomId]: sortMessages([...deduped, ...existing]) },
        cursors: { ...(s.cursors ?? {}), [roomId]: nextCursor },
        hasMore: { ...(s.hasMore ?? {}), [roomId]: hasMore },
      }
    })
  },

  // Inserts a locally-created placeholder (pending: true) the instant the
  // user hits send — before any network round-trip — so it shows up
  // immediately, the way Telegram/WhatsApp/ChatGPT do.
  addOptimisticMessage(message) {
    set((s) => {
      const roomId = message?.room?.id
      if (!roomId) return {}
      const existing = (s.messages ?? {})[roomId] ?? []
      const updated = sortMessages([...existing, message])
      return { messages: { ...(s.messages ?? {}), [roomId]: updated } }
    })
  },

  // Single entry point for any message coming back from the server
  // (STOMP broadcast, gap-fill, retry-after-reconnect). If it matches a
  // still-pending optimistic placeholder by clientMessageId, it replaces
  // that placeholder IN PLACE (no jump in position); otherwise it's a
  // message from someone else and gets appended normally. Either way,
  // every other message in the room keeps its exact object reference.
  upsertMessage(message) {
    set((s) => {
      const roomId = message?.room?.id
      if (!roomId) return {}
      const existing = (s.messages ?? {})[roomId] ?? []

      if (existing.some((m) => m.id === message.id)) return {}

      const placeholderIndex = existing.findIndex(
        (m) => m.pending && m.clientMessageId === message.clientMessageId,
      )

      let updated: ChatMessage[]
      if (placeholderIndex !== -1) {
        updated = existing.slice()
        updated[placeholderIndex] = message
      } else {
        updated = [...existing, message]
      }

      const rooms = (s.rooms ?? []).map((r) =>
        r.id === roomId
          ? { ...r, lastMessage: message.messageText, lastMessageAt: message.sentAt }
          : r,
      )
      return {
        messages: { ...(s.messages ?? {}), [roomId]: sortMessages(updated) },
        rooms,
      }
    })
  },

  // The send request itself failed (not just offline) — mark the
  // placeholder so the UI can show "failed to send" instead of leaving it
  // spinning in "pending" forever.
  markMessageFailed(clientMessageId) {
    set((s) => {
      const updated: Record<number, ChatMessage[]> = {}
      for (const [rid, msgs] of Object.entries(s.messages ?? {})) {
        updated[Number(rid)] = (Array.isArray(msgs) ? msgs : []).map((m) =>
          m.pending && m.clientMessageId === clientMessageId
            ? { ...m, pending: false, failed: true }
            : m,
        )
      }
      return { messages: updated }
    })
  },

  softDeleteMessage(messageId) {
    set((s) => {
      const updated: Record<number, ChatMessage[]> = {}
      for (const [rid, msgs] of Object.entries(s.messages ?? {})) {
        updated[Number(rid)] = (Array.isArray(msgs) ? msgs : []).map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, messageText: '' } : m,
        )
      }
      return { messages: updated }
    })
  },

  updateRoomPreview(roomId, lastMessage, lastMessageAt) {
    set((s) => ({
      rooms: (s.rooms ?? []).map((r) =>
        r.id === roomId ? { ...r, lastMessage, lastMessageAt } : r,
      ),
    }))
  },

  decrementUnread(roomId) {
    set((s) => ({
      rooms: (s.rooms ?? []).map((r) =>
        r.id === roomId ? { ...r, unreadCount: Math.max(0, (r.unreadCount ?? 0) - 1) } : r,
      ),
    }))
  },

  clearUnread(roomId) {
    set((s) => ({
      rooms: (s.rooms ?? []).map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r)),
    }))
  },

  setTyping(roomId, displayName, isTyping) {
    set((s) => {
      const current = new Set(s.typing?.[roomId] ?? [])
      if (isTyping) current.add(displayName)
      else current.delete(displayName)
      return { typing: { ...(s.typing ?? {}), [roomId]: current } }
    })
  },

  setPresence(userId, online) {
    set((s) => ({ presence: { ...(s.presence ?? {}), [userId]: online } }))
  },

  addToQueue(msg) {
    set((s) => ({ outboundQueue: [...(s.outboundQueue ?? []), msg] }))
  },

  removeFromQueue(clientMessageId) {
    set((s) => ({
      outboundQueue: (s.outboundQueue ?? []).filter((m) => m.clientMessageId !== clientMessageId),
    }))
  },

  setLoadingRooms(v) {
    set({ loadingRooms: v })
  },

  setLoadingMessages(roomId, v) {
    set((s) => ({ loadingMessages: { ...(s.loadingMessages ?? {}), [roomId]: v } }))
  },

  setCursor(roomId, cursor, hasMore) {
    set((s) => ({
      cursors: { ...(s.cursors ?? {}), [roomId]: cursor },
      hasMore: { ...(s.hasMore ?? {}), [roomId]: hasMore },
    }))
  },

  setPartnerLastReadId(roomId, messageId) {
    set((s) => ({
      partnerLastReadId: { ...(s.partnerLastReadId ?? {}), [roomId]: messageId },
    }))
  },
}))

// Selector helpers — safe against undefined store state
export const selectSortedRooms = (s: ChatState) => {
  const raw = s.rooms ?? []
  return [...raw].sort((a, b) => {
    if (!a.lastMessageAt && !b.lastMessageAt) return 0
    if (!a.lastMessageAt) return 1
    if (!b.lastMessageAt) return -1
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  })
}

export const selectTotalUnread = (s: ChatState) =>
  (s.rooms ?? []).reduce((sum, r) => sum + (r.unreadCount ?? 0), 0)
