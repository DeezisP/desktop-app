/**
 * useGlobalChatMessages
 *
 * Permanent, globally-mounted hook (lives in Layout so it is ALWAYS active).
 *
 * Responsibilities:
 *  1. Subscribe to /topic/admin/notifications — the single source of truth for
 *     new messages and room events from the backend.
 *  2. Call loadRooms() so the sidebar unread count stays fresh everywhere.
 *  3. Fire Electron toast notifications directly from the incoming STOMP
 *     payload — no dependency on ChatPage being mounted.
 *
 * WHY this hook exists:
 *  Previously useChat.ts owned the /topic/admin/notifications subscription.
 *  warehouseStompClient stores only ONE handler per topic; when useChat.ts
 *  unmounted (user navigated away from /chat) its cleanup deleted the entry,
 *  leaving no active subscription.  Result: zero notifications outside /chat.
 *
 * This hook must NEVER be mounted inside a page component — only in Layout.
 */

import { useEffect, useCallback, useRef } from 'react'
import { warehouseStompClient } from '../stomp/client'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { chatApi } from '../api/chatApi'
import type { ChatMessage } from '../types/chat'

// ── Avatar colour palette (orange-first, warm tones) ─────────────────────────
const AVATAR_COLORS = [
  '#FF9500', '#F59E0B', '#EF4444', '#8B5CF6',
  '#14B8A6', '#EC4899', '#10B981', '#6366F1',
]

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function isValidChatMessage(v: unknown): v is ChatMessage {
  if (!v || typeof v !== 'object') return false
  const m = v as Record<string, unknown>
  return (
    typeof m.id === 'number' &&
    typeof m.messageText === 'string' &&
    typeof m.sentAt === 'string' &&
    m.room !== null &&
    typeof m.room === 'object'
  )
}

type ToastAPI = {
  showChatToast?: (p: unknown) => Promise<void>
}

function getElectronAPI(): ToastAPI | null {
  return (window as Window & { electronAPI?: ToastAPI }).electronAPI ?? null
}

export function useGlobalChatMessages() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // Stable store actions (Zustand guarantees these never change identity)
  const removeRoom     = useChatStore((s) => s.removeRoom)
  const setRooms       = useChatStore((s) => s.setRooms)
  const setLoadingRooms = useChatStore((s) => s.setLoadingRooms)

  // Mutable refs — let the STOMP callback read the latest values without
  // re-registering the subscription on every render
  const activeRoomIdRef = useRef<number | null>(null)
  const roomsRef        = useRef(useChatStore.getState().rooms)
  const userRef         = useRef(useAuthStore.getState().user)

  // Keep refs in sync
  useEffect(() =>
    useChatStore.subscribe((s) => {
      activeRoomIdRef.current = s.activeRoomId
      roomsRef.current        = s.rooms
    })
  , [])

  useEffect(() =>
    useAuthStore.subscribe((s) => { userRef.current = s.user })
  , [])

  // ── Room loader ─────────────────────────────────────────────────────────────
  const loadRooms = useCallback(async () => {
    if (!isAuthenticated) return
    setLoadingRooms(true)
    try {
      const fetched = await chatApi.getRooms()
      setRooms(Array.isArray(fetched) ? fetched : [])
    } catch {
      // non-critical — sidebar badge will be stale until next update
    } finally {
      setLoadingRooms(false)
    }
  }, [isAuthenticated, setRooms, setLoadingRooms])

  // ── Global /topic/admin/notifications subscription ─────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return

    const unsub = warehouseStompClient.subscribe('/topic/admin/notifications', (msg) => {
      let payload: unknown
      try { payload = JSON.parse(msg.body) } catch { return }
      if (!payload || typeof payload !== 'object') return

      const p = payload as Record<string, unknown>

      // ── Room deleted ───────────────────────────────────────────────────────
      if (p.action === 'ROOM_DELETED' && p.roomId != null) {
        removeRoom(Number(p.roomId))
        return
      }

      // ── Any event with a numeric id → refresh rooms (unread counts, etc.) ──
      if (typeof p.id === 'number') {
        loadRooms()
      }

      // ── Full ChatMessage → fire toast if applicable ────────────────────────
      if (!isValidChatMessage(payload)) return

      const user = userRef.current
      // Skip own messages
      if (user && payload.sender?.id === user.id) return
      // Skip if focused AND viewing this exact conversation
      if (document.hasFocus() && activeRoomIdRef.current === payload.room?.id) return

      // Resolve sender display name
      let senderName: string
      if (payload.guestSenderId) {
        const room = roomsRef.current.find((r) => r.id === payload.room?.id)
        senderName = room?.name || 'ลูกค้า'
      } else if (payload.sender) {
        senderName = payload.sender.firstname || payload.sender.username || 'ลูกค้า'
      } else {
        senderName = 'ลูกค้า'
      }

      const preview = payload.isDeleted
        ? '(ลบข้อความแล้ว)'
        : payload.fileUrl
          ? '📎 ไฟล์แนบ'
          : (payload.messageText?.slice(0, 80) || '(ข้อความ)')

      const toastPayload = {
        roomId:         payload.room.id,
        senderName,
        senderInitials: senderName.slice(0, 2).toUpperCase(),
        messagePreview: preview,
        unreadCount:    0,
        avatarColor:    avatarColor(senderName),
      }

      getElectronAPI()?.showChatToast?.(toastPayload).catch(() => {})
    })

    return unsub
  }, [isAuthenticated, loadRooms, removeRoom])

  // ── Initial room load on auth ───────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) loadRooms()
  }, [isAuthenticated, loadRooms])
}
