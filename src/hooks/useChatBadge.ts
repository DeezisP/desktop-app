import { useEffect, useRef } from 'react'
import { useChatStore, selectTotalUnread } from '../store/chatStore'

type ElectronWithBadge = Window & {
  electronAPI?: { updateBadge?: (n: number) => Promise<void> }
}

export function useChatBadge() {
  const totalUnread = useChatStore(selectTotalUnread)
  const lastSentRef = useRef<number>(-1)

  useEffect(() => {
    const api = (window as ElectronWithBadge).electronAPI
    if (!api?.updateBadge) return
    if (totalUnread === lastSentRef.current) return
    lastSentRef.current = totalUnread
    api.updateBadge(totalUnread).catch(() => {})
  }, [totalUnread])
}
