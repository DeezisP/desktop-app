import { useEffect, useRef } from 'react'
import { warehouseStompClient } from '../stomp/client'
import { useWarehouseStore } from '../store/warehouseStore'
import { useAuthStore } from '../store/authStore'

export function useStomp() {
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const applyQueueEvent = useWarehouseStore((s) => s.applyQueueEvent)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      warehouseStompClient.disconnect()
      return
    }

    warehouseStompClient.connect(token)
    unsubRef.current = warehouseStompClient.onQueueEvent(applyQueueEvent)

    return () => {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [token, isAuthenticated, applyQueueEvent])

  return { isConnected: warehouseStompClient.isConnected() }
}
