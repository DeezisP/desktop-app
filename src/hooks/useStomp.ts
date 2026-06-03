import { useEffect, useRef, useState } from 'react'
import { warehouseStompClient } from '../stomp/client'
import { useWarehouseStore } from '../store/warehouseStore'
import { useAuthStore } from '../store/authStore'
import { sounds, sendDesktopNotification } from '../service/sounds'
import { toast } from '../components/Toast'

export function useStomp() {
  const token           = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const applyQueueEvent = useWarehouseStore((s) => s.applyQueueEvent)
  const unsubRef        = useRef<(() => void) | null>(null)

  // Reactive: re-renders as soon as onConnect / onDisconnect fires
  const [isConnected, setIsConnected] = useState(() => warehouseStompClient.isConnected())

  // Track previous connection state to detect transitions (not just current state)
  const prevConnectedRef = useRef<boolean | null>(null)

  useEffect(() => {
    return warehouseStompClient.onConnectionChange((connected) => {
      // Only fire notifications on transitions, not the initial call
      if (prevConnectedRef.current !== null && prevConnectedRef.current !== connected) {
        if (connected) {
          toast.success('เชื่อมต่อแล้ว', 'WebSocket กลับมาเชื่อมต่อแล้ว', 3000)
          sounds.notify()
          sendDesktopNotification('เชื่อมต่อแล้ว', 'ระบบกลับมาออนไลน์')
        } else {
          toast.warning('ขาดการเชื่อมต่อ', 'กำลังพยายามเชื่อมต่อใหม่...', 5000)
          sendDesktopNotification('ขาดการเชื่อมต่อ', 'กำลังพยายามเชื่อมต่อใหม่')
        }
      }
      prevConnectedRef.current = connected
      setIsConnected(connected)
    })
  }, [])

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

  return { isConnected }
}
