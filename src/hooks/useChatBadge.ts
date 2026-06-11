import { useEffect, useRef } from 'react'
import { useChatStore, selectTotalUnread } from '../store/chatStore'

/**
 * Drives the LINE-style bottom-right badge overlay via Electron IPC.
 * Sends the current unread count to the main process whenever it changes.
 * The main process decides whether to show or hide the badge based on
 * whether the main window is focused.
 */
export function useChatBadge() {
  const totalUnread = useChatStore(selectTotalUnread)
  const lastCountRef = useRef<number>(-1)

  useEffect(() => {
    const api = (window as Window & { electronAPI?: { updateBadge?: (n: number) => Promise<void> } }).electronAPI
    if (!api?.updateBadge) return
    if (totalUnread === lastCountRef.current) return
    lastCountRef.current = totalUnread
    api.updateBadge(totalUnread).catch(() => {})
  }, [totalUnread])
}
