import { useEffect, useRef, useCallback } from 'react'
import { warehouseStompClient } from '../stomp/client'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { chatApi } from '../api/chatApi'
import type { ChatMessage, TypingBroadcast, PresenceBroadcast, OutboundMessage } from '../types/chat'
import type { AuthUser } from '../types/auth'

const HEARTBEAT_INTERVAL = 20_000
const TYPING_DEBOUNCE_MS = 2_500

// id: 0 marks a locally-created placeholder not yet confirmed by the
// server — mirrors the `msg.id > 0` convention already used for read
// receipts elsewhere in this file.
function buildOptimisticMessage(
  roomId: number,
  clientMessageId: string,
  text: string,
  user: AuthUser,
  fileUrl: string | null,
  fileType: string | null,
): ChatMessage {
  return {
    id: 0,
    clientMessageId,
    room: { id: roomId },
    sender: { id: user.id, username: user.username, firstname: user.firstname ?? user.username, role: user.role },
    guestSenderId: null,
    messageText: text || (fileUrl ? 'Sent an attachment' : ''),
    sentAt: new Date().toISOString(),
    isRead: false,
    fileUrl,
    fileType,
    isDeleted: false,
    isEdited: false,
    pending: true,
  }
}

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

  const activeRoomId         = useChatStore((s) => s.activeRoomId)
  const outboundQueue        = useChatStore((s) => s.outboundQueue)
  const setRooms             = useChatStore((s) => s.setRooms)
  const addOptimisticMessage = useChatStore((s) => s.addOptimisticMessage)
  const upsertMessage        = useChatStore((s) => s.upsertMessage)
  const markMessageFailed    = useChatStore((s) => s.markMessageFailed)
  const softDeleteMessage    = useChatStore((s) => s.softDeleteMessage)
  const setTyping            = useChatStore((s) => s.setTyping)
  const setPresence          = useChatStore((s) => s.setPresence)
  const clearUnread          = useChatStore((s) => s.clearUnread)
  const prependMessages      = useChatStore((s) => s.prependMessages)
  const setLoadingRooms      = useChatStore((s) => s.setLoadingRooms)
  const setLoadingMessages   = useChatStore((s) => s.setLoadingMessages)
  const addToQueue           = useChatStore((s) => s.addToQueue)
  const removeFromQueue      = useChatStore((s) => s.removeFromQueue)
  const setPartnerLastReadId = useChatStore((s) => s.setPartnerLastReadId)
  const removeRoom           = useChatStore((s) => s.removeRoom)

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
      setRooms(Array.isArray(rooms) ? rooms : [])
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
        // Backend already returns messages in ascending chronological order
        prependMessages(roomId, raw, nextCursor, hasMore)
        if (raw.length > 0) {
          const newest = raw[raw.length - 1]
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
    async (roomId: number, content: string, file?: File) => {
      const trimmed = content.trim()
      if (!trimmed && !file) return
      if (!user) return

      const clientMessageId = crypto.randomUUID()
      const msg: OutboundMessage = { clientMessageId, roomId, content: trimmed }

      // Local image preview shown instantly while the real upload runs in
      // the background; revoked once we have the permanent server URL.
      const localPreviewUrl = file?.type.startsWith('image/') ? URL.createObjectURL(file) : null
      addOptimisticMessage(
        buildOptimisticMessage(roomId, clientMessageId, trimmed, user, localPreviewUrl, file?.type ?? null),
      )

      if (!file && !warehouseStompClient.isConnected()) {
        addToQueue(msg)
        return
      }

      try {
        let fileUrl: string | undefined
        let fileType: string | undefined
        if (file) {
          const up = await chatApi.uploadFile(file)
          fileUrl = up.fileUrl
          fileType = up.fileType || file.type
          if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
        }
        const confirmed = await chatApi.sendMessage(roomId, trimmed, clientMessageId, fileUrl, fileType)
        // Resolve immediately from the response — don't wait on the STOMP
        // echo, which may be delayed or (in theory) never arrive.
        upsertMessage(confirmed)
      } catch (err) {
        console.error('[useChat] sendMessage failed', err)
        if (!file) addToQueue(msg)
        else markMessageFailed(clientMessageId)
      }
    },
    [addToQueue, addOptimisticMessage, upsertMessage, markMessageFailed, user],
  )

  // ── Drain offline queue when connection restores ────────────────────────────

  useEffect(() => {
    if (!isConnected || outboundQueue.length === 0) return
    const queue = [...outboundQueue]
    queue.forEach(async ({ clientMessageId, roomId, content }) => {
      try {
        const confirmed = await chatApi.sendMessage(roomId, content, clientMessageId)
        upsertMessage(confirmed)
        removeFromQueue(clientMessageId)
      } catch {
        // Will retry on next reconnect — placeholder stays pending
      }
    })
  }, [isConnected, outboundQueue, removeFromQueue, upsertMessage])

  // ── Gap-fill after reconnect ────────────────────────────────────────────────

  const gapFill = useCallback(
    async (roomId: number) => {
      const sinceId = lastSeenMessageRef.current[roomId]
      if (!sinceId) return
      try {
        const raw = await chatApi.getMessagesSince(roomId, sinceId)
        const messages = Array.isArray(raw) ? raw : []
        messages.forEach((m) => upsertMessage(m))
        if (messages.length > 0) {
          lastSeenMessageRef.current[roomId] = messages[messages.length - 1].id
        }
      } catch (err) {
        console.error('[useChat] gap-fill failed for room', roomId, err)
      }
    },
    [upsertMessage],
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

  // ── Delete a room ───────────────────────────────────────────────────────────

  const deleteRoom = useCallback(async (roomId: number) => {
    removeRoom(roomId)
    try {
      await chatApi.deleteRoom(roomId)
    } catch (err) {
      console.error('[useChat] deleteRoom failed', err)
      loadRooms() // re-fetch to restore if delete failed
    }
  }, [removeRoom, loadRooms])

  // ── Delete a message ────────────────────────────────────────────────────────

  const deleteMessage = useCallback(async (messageId: number) => {
    const roomId = activeRoomId
    softDeleteMessage(messageId)
    try {
      await chatApi.deleteMessage(messageId)
    } catch (err) {
      console.error('[useChat] deleteMessage failed', err)
      if (roomId) loadMessages(roomId)
    }
  }, [softDeleteMessage, activeRoomId, loadMessages])

  // NOTE: /topic/admin/notifications is handled globally by useGlobalChatMessages
  // (mounted in Layout). It must NOT be subscribed here — the STOMP client keeps
  // only one handler per topic; a duplicate subscription here would hijack the
  // global one and delete it when Chat unmounts, breaking notifications everywhere.

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
          if (payload?.action === 'DELETE_MESSAGE' && payload.messageId != null) {
            softDeleteMessage(Number(payload.messageId))
          } else if (isValidChatMessage(payload)) {
            upsertMessage(payload)
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
  }, [activeRoomId, upsertMessage, setTyping, gapFill, sendTyping, user, setPartnerLastReadId, loadPartnerReadState])

  // NOTE: initial loadRooms() is handled by useGlobalChatMessages in Layout.

  return {
    loadRooms,
    loadMessages,
    sendMessage,
    notifyTyping,
    markRoomRead,
    deleteRoom,
    deleteMessage,
  }
}
