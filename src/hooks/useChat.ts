import { useEffect, useRef, useCallback } from 'react'
import { warehouseStompClient } from '../stomp/client'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { chatApi } from '../api/chatApi'
import type { ChatMessage, TypingBroadcast, PresenceBroadcast, OutboundMessage } from '../types/chat'

const HEARTBEAT_INTERVAL = 20_000
const TYPING_DEBOUNCE_MS = 2_500

// ── Payload validators ────────────────────────────────────────────────────────

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

function isValidTypingBroadcast(v: unknown): v is TypingBroadcast {
  if (!v || typeof v !== 'object') return false
  const t = v as Record<string, unknown>
  return (
    typeof t.roomId === 'number' &&
    typeof t.displayName === 'string' &&
    typeof t.typing === 'boolean'
  )
}

function isValidPresenceBroadcast(v: unknown): v is PresenceBroadcast {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  return typeof p.userId === 'number' && typeof p.online === 'boolean'
}

// ── useChat hook ──────────────────────────────────────────────────────────────

export function useChat() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const {
    activeRoomId,
    outboundQueue,
    setRooms,
    appendMessage,
    setTyping,
    setPresence,
    clearUnread,
    prependMessages,
    setLoadingRooms,
    setLoadingMessages,
    addToQueue,
    removeFromQueue,
    setPartnerLastReadId,
  } = useChatStore()

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingRoomRef = useRef<number | null>(null)
  const lastSeenMessageRef = useRef<Record<number, number>>({})
  const isConnected = warehouseStompClient.isConnected()

  // ── Load all rooms ──────────────────────────────────────────────────────────

  const loadRooms = useCallback(async () => {
    if (!isAuthenticated) return
    setLoadingRooms(true)
    try {
      const rooms = await chatApi.getRooms()
      console.log('[useChat] getRooms() response count:', Array.isArray(rooms) ? rooms.length : 0)
      if (Array.isArray(rooms) && rooms.length > 0) {
        console.log('[useChat] first room from API:', rooms[0])
      }
      // chatApi already normalizes to [], double-guard here for safety
      const safeRooms = Array.isArray(rooms) ? rooms : []
      setRooms(safeRooms)
      console.log('[useChat] stored rooms in store, count:', safeRooms.length)
    } catch (err) {
      console.error('[useChat] failed to load rooms', err)
      setRooms([])
    } finally {
      setLoadingRooms(false)
    }
  }, [isAuthenticated, setLoadingRooms, setRooms])

  // ── Load message history for a room ────────────────────────────────────────

  const loadMessages = useCallback(
    async (roomId: number, beforeId?: number) => {
      setLoadingMessages(roomId, true)
      try {
        const result = await chatApi.getMessages(roomId, beforeId, 50)
        const raw = Array.isArray(result?.messages) ? result.messages : []
        const nextCursor = result?.nextCursor ?? null
        const hasMore = result?.hasMore ?? false
        // API returns newest-first; reverse to oldest-first for display
        const ordered = [...raw].reverse()
        prependMessages(roomId, ordered, nextCursor, hasMore)
        if (ordered.length > 0) {
          const newest = ordered[ordered.length - 1]
          if (
            !lastSeenMessageRef.current[roomId] ||
            newest.id > lastSeenMessageRef.current[roomId]
          ) {
            lastSeenMessageRef.current[roomId] = newest.id
          }
        }
      } catch (err) {
        console.error('[useChat] failed to load messages for room', roomId, err)
      } finally {
        setLoadingMessages(roomId, false)
      }
    },
    [prependMessages, setLoadingMessages],
  )

  // ── Send a message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (roomId: number, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      const clientMessageId = crypto.randomUUID()
      const msg: OutboundMessage = { clientMessageId, roomId, content: trimmed }

      if (!warehouseStompClient.isConnected()) {
        addToQueue(msg)
        return
      }

      try {
        await chatApi.sendMessage(roomId, trimmed, clientMessageId)
      } catch (err) {
        console.error('[useChat] sendMessage failed', err)
        addToQueue(msg)
      }
    },
    [addToQueue],
  )

  // ── Drain offline queue when connection restores ────────────────────────────

  useEffect(() => {
    if (!isConnected || outboundQueue.length === 0) return
    const queue = [...outboundQueue]
    queue.forEach(async ({ clientMessageId, roomId, content }) => {
      try {
        await chatApi.sendMessage(roomId, content, clientMessageId)
        removeFromQueue(clientMessageId)
      } catch {
        // Will retry on next reconnect
      }
    })
  }, [isConnected, outboundQueue, removeFromQueue])

  // ── Gap-fill after reconnect ────────────────────────────────────────────────

  const gapFill = useCallback(
    async (roomId: number) => {
      const sinceId = lastSeenMessageRef.current[roomId]
      if (!sinceId) return
      try {
        const raw = await chatApi.getMessagesSince(roomId, sinceId)
        const messages = Array.isArray(raw) ? raw : []
        messages.forEach((m) => appendMessage(m))
        if (messages.length > 0) {
          lastSeenMessageRef.current[roomId] = messages[messages.length - 1].id
        }
      } catch (err) {
        console.error('[useChat] gap-fill failed for room', roomId, err)
      }
    },
    [appendMessage],
  )

  // ── Send typing indicator ───────────────────────────────────────────────────

  const sendTyping = useCallback(
    (roomId: number, typing: boolean) => {
      if (!warehouseStompClient.isConnected()) return
      warehouseStompClient.publish(
        '/app/chat.typing',
        JSON.stringify({ roomId, typing }),
      )
    },
    [],
  )

  /** Call on every keystroke in the input. Sends typing=true, debounces typing=false. */
  const notifyTyping = useCallback(
    (roomId: number) => {
      if (lastTypingRoomRef.current !== roomId) {
        lastTypingRoomRef.current = roomId
        sendTyping(roomId, true)
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => {
        sendTyping(roomId, false)
        lastTypingRoomRef.current = null
      }, TYPING_DEBOUNCE_MS)
    },
    [sendTyping],
  )

  // ── Send read receipt ───────────────────────────────────────────────────────

  const markRoomRead = useCallback(
    async (roomId: number, lastMessageId?: number) => {
      clearUnread(roomId)
      try {
        await chatApi.markRead(roomId)
      } catch {
        // non-critical
      }
      if (lastMessageId && warehouseStompClient.isConnected()) {
        warehouseStompClient.publish(
          '/app/chat.read',
          JSON.stringify({ roomId, lastReadMessageId: lastMessageId }),
        )
      }
    },
    [clearUnread],
  )

  // ── Send presence heartbeat ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return
    heartbeatRef.current = setInterval(() => {
      if (warehouseStompClient.isConnected()) {
        warehouseStompClient.publish('/app/chat.heartbeat', '{}')
      }
    }, HEARTBEAT_INTERVAL)
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [isAuthenticated])

  // ── Subscribe to admin notification topic ──────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return
    const unsub = warehouseStompClient.subscribe(
      '/topic/admin/notifications',
      (msg) => {
        try {
          const room = JSON.parse(msg.body)
          if (room && typeof room.id === 'number') {
            // Refresh room list so new rooms appear
            loadRooms()
          }
        } catch {
          // malformed — ignore silently
        }
      },
    )
    return unsub
  }, [isAuthenticated, loadRooms])

  // ── Subscribe to admin presence topic ──────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return
    const unsub = warehouseStompClient.subscribe(
      '/topic/admin/presence',
      (msg) => {
        try {
          const payload = JSON.parse(msg.body)
          if (isValidPresenceBroadcast(payload)) {
            setPresence(payload.userId, payload.online)
          }
        } catch {
          // ignore
        }
      },
    )
    return unsub
  }, [isAuthenticated, setPresence])

  // ── Load partner read state ────────────────────────────────────────────────

  const loadPartnerReadState = useCallback(async (roomId: number) => {
    try {
      const state = await chatApi.getReadState(roomId)
      if (state.partnerLastReadMessageId) {
        setPartnerLastReadId(roomId, Number(state.partnerLastReadMessageId))
      }
    } catch (err) {
      console.error('[useChat] failed to load partner read state for room', roomId, err)
    }
  }, [setPartnerLastReadId])

  // ── Subscribe to room-specific topics when activeRoomId changes ─────────────

  useEffect(() => {
    if (!activeRoomId) return

    // Messages
    const unsubMsg = warehouseStompClient.subscribe(
      `/topic/room/${activeRoomId}`,
      (msg) => {
        try {
          const payload = JSON.parse(msg.body)
          if (isValidChatMessage(payload)) {
            appendMessage(payload)
            lastSeenMessageRef.current[activeRoomId] = payload.id
          }
        } catch {
          // malformed — ignore
        }
      },
    )

    // Typing
    const unsubTyping = warehouseStompClient.subscribe(
      `/topic/room/${activeRoomId}/typing`,
      (msg) => {
        try {
          const payload = JSON.parse(msg.body)
          if (isValidTypingBroadcast(payload)) {
            // Don't show own typing indicator
            if (user && payload.userId === user.id) return
            setTyping(payload.roomId, payload.displayName, payload.typing)
          }
        } catch {
          // ignore
        }
      },
    )

    // Read receipts - when partner marks messages as read
    const unsubRead = warehouseStompClient.subscribe(
      `/topic/room/${activeRoomId}/read`,
      (msg) => {
        try {
          const payload = JSON.parse(msg.body)
          if (payload.lastReadMessageId && user && payload.userId !== user.id) {
            setPartnerLastReadId(activeRoomId, Number(payload.lastReadMessageId))
          }
        } catch {
          // ignore
        }
      },
    )

    // Load partner read state and gap-fill on room select
    loadPartnerReadState(activeRoomId)
    gapFill(activeRoomId)

    return () => {
      unsubMsg()
      unsubTyping()
      unsubRead()
      // Stop any pending typing on room leave
      if (lastTypingRoomRef.current === activeRoomId) {
        sendTyping(activeRoomId, false)
        lastTypingRoomRef.current = null
      }
    }
  }, [activeRoomId, appendMessage, setTyping, gapFill, sendTyping, user, setPartnerLastReadId, loadPartnerReadState])

  // ── Initial room load ───────────────────────────────────────────────────────

  useEffect(() => {
    if (isAuthenticated) {
      console.log('[useChat] authenticated, loading rooms...')
      loadRooms()
    } else {
      console.log('[useChat] not authenticated, skipping room load')
    }
  }, [isAuthenticated, loadRooms])

  return {
    loadRooms,
    loadMessages,
    sendMessage,
    notifyTyping,
    markRoomRead,
  }
}
