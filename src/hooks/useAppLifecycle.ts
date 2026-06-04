import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { warehouseStompClient } from '../stomp/client'
import { useChat } from './useChat'
import type { ChatRoom } from '../types/chat'

/**
 * Manages application lifecycle events:
 * - Restores STOMP connection when app regains focus
 * - Reloads chat rooms after reconnection
 * - Validates session persistence across app restarts
 */
export function useAppLifecycle() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const token = useAuthStore((s) => s.token)
  const rooms = useChatStore((s) => s.rooms ?? [])
  const { loadRooms } = useChat()
  const focusHandlerRef = useRef<(() => void) | null>(null)

  // ── Reconnect STOMP when app regains focus ──────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !token) return

    const handleAppFocus = () => {
      console.log('[lifecycle] app regained focus, checking STOMP connection')
      if (!warehouseStompClient.isConnected()) {
        console.log('[lifecycle] STOMP disconnected, reconnecting...')
        warehouseStompClient.connect(token)
      }
    }

    focusHandlerRef.current = handleAppFocus
    window.addEventListener('focus', handleAppFocus)

    return () => {
      if (focusHandlerRef.current) {
        window.removeEventListener('focus', handleAppFocus)
      }
    }
  }, [isAuthenticated, token])

  // ── Reload chat rooms when STOMP connects ───────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return

    const unsub = warehouseStompClient.onConnectionChange((connected) => {
      if (connected) {
        console.log('[lifecycle] STOMP connected, reloading chat rooms')
        // Delay to ensure subscriptions are ready
        setTimeout(() => loadRooms(), 500)
      }
    })

    return unsub
  }, [isAuthenticated, loadRooms])

  // ── Log chat store state for diagnostics ────────────────────────────────────
  useEffect(() => {
    if (rooms.length > 0) {
      console.log('[lifecycle] chat rooms available, count:', rooms.length)
    }
  }, [rooms.length])
}
