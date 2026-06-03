import { useCallback } from 'react'
import { warehouseStompClient } from '../stomp/client'
import { useStomp } from './useStomp'

// Provides the { connected, subscribe } interface that the packing panels expect,
// bridging from the desktop's singleton STOMP client to the Next.js context API.
export function useStompContext() {
  const { isConnected } = useStomp()

  const subscribe = useCallback(
    (_topic: string, callback: (msg: { body: string }) => void) => {
      return warehouseStompClient.onQueueEvent((event) => {
        callback({ body: JSON.stringify(event) })
      })
    },
    [],
  )

  return { connected: isConnected, subscribe }
}
