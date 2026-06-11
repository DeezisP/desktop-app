import { useEffect, useRef } from 'react'
import { useChatStore } from '../store/chatStore'
import type { ChatRoom } from '../types/chat'

type ChatToastPayload = {
  roomId:         number
  senderName:     string
  senderInitials: string
  messagePreview: string
  unreadCount:    number
  avatarColor:    string
}

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f59e0b', '#ef4444', '#10b981', '#6366f1',
]

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

type RoomSnapshot = { unreadCount: number; lastMessageAt: string | null }

export function useChatToast() {
  const rooms      = useChatStore((s) => s.rooms)
  const activeRoomId = useChatStore((s) => s.activeRoomId)
  const prevRef    = useRef<Map<number, RoomSnapshot>>(new Map())
  const readyRef   = useRef(false)

  useEffect(() => {
    if (rooms.length === 0) return

    if (!readyRef.current) {
      // First non-empty load — seed snapshot without firing any toasts
      rooms.forEach((r) => {
        prevRef.current.set(r.id, {
          unreadCount:   r.unreadCount ?? 0,
          lastMessageAt: r.lastMessageAt,
        })
      })
      readyRef.current = true
      return
    }

    rooms.forEach((room: ChatRoom) => {
      const prev       = prevRef.current.get(room.id)
      const newUnread  = room.unreadCount ?? 0
      const prevUnread = prev?.unreadCount ?? 0

      // New unread message AND lastMessageAt changed (not just a read-mark update)
      if (
        newUnread > prevUnread &&
        room.lastMessage &&
        room.lastMessageAt !== prev?.lastMessageAt
      ) {
        // Skip if app is focused AND this is the open conversation
        if (document.hasFocus() && activeRoomId === room.id) {
          prevRef.current.set(room.id, { unreadCount: newUnread, lastMessageAt: room.lastMessageAt })
          return
        }

        const name     = room.name || 'ลูกค้า'
        const initials = name.slice(0, 2).toUpperCase()
        const preview  = room.lastMessage.length > 80
          ? room.lastMessage.slice(0, 79) + '…'
          : room.lastMessage

        const payload: ChatToastPayload = {
          roomId:         room.id,
          senderName:     name,
          senderInitials: initials,
          messagePreview: preview,
          unreadCount:    newUnread,
          avatarColor:    avatarColor(name),
        }

        const api = (window as Window & { electronAPI?: { showChatToast?: (p: ChatToastPayload) => Promise<void> } }).electronAPI
        api?.showChatToast?.(payload).catch(() => {})
      }

      prevRef.current.set(room.id, {
        unreadCount:   newUnread,
        lastMessageAt: room.lastMessageAt,
      })
    })
  }, [rooms, activeRoomId])
}
