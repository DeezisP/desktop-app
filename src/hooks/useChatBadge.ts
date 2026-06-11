import { useEffect, useRef, useCallback } from 'react'
import { useChatStore, selectTotalUnread } from '../store/chatStore'

type ElectronWithBadge = Window & {
  electronAPI?: { updateBadge?: (n: number) => Promise<void> }
}

function getAPI() {
  return (window as ElectronWithBadge).electronAPI
}

/**
 * Drives the LINE-style bottom-right badge overlay via Electron IPC.
 *
 * Two triggers:
 *  1. Unread count changes  → send new count immediately
 *  2. Window blur           → re-send current count so the main process can
 *                             show the badge even when the count hasn't changed
 *                             (e.g. user had 3 unread msgs and switched away)
 */
export function useChatBadge() {
  const totalUnread = useChatStore(selectTotalUnread)
  const lastSentRef = useRef<number>(-1)

  const sendBadge = useCallback((count: number, reason: string) => {
    const api = getAPI()
    if (!api?.updateBadge) return
    console.log(`[useChatBadge] sendBadge count=${count} reason=${reason}`)
    lastSentRef.current = count
    api.updateBadge(count).catch((err) => {
      console.warn('[useChatBadge] updateBadge IPC error:', err)
    })
  }, [])

  // Trigger 1: unread count changed
  useEffect(() => {
    console.log(`[useChatBadge] totalUnread=${totalUnread} lastSent=${lastSentRef.current}`)
    if (totalUnread === lastSentRef.current) return
    sendBadge(totalUnread, 'count-changed')
  }, [totalUnread, sendBadge])

  // Trigger 2: window loses focus — re-send current count so main process shows
  // the badge even when no new messages arrived since focus was last active
  useEffect(() => {
    const onBlur = () => {
      console.log(`[useChatBadge] window blur — re-sending count=${totalUnread}`)
      // Force re-send regardless of lastSentRef so the main process re-evaluates
      const api = getAPI()
      if (!api?.updateBadge) return
      api.updateBadge(totalUnread).catch(() => {})
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [totalUnread])

  // Trigger 3: window regains focus — explicitly clear the badge count display
  useEffect(() => {
    const onFocus = () => {
      console.log('[useChatBadge] window focus — sending count=0 to clear badge')
      const api = getAPI()
      if (!api?.updateBadge) return
      // Send the real count; main process will hide badge because it is now focused
      api.updateBadge(totalUnread).catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [totalUnread])
}
