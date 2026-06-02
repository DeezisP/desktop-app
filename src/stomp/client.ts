import { Client, type StompSubscription, type IMessage } from '@stomp/stompjs'
import type { WarehouseQueueEvent } from '../types/warehouse'

// sockjs-client was removed because it bundles Node.js require("events") and
// require("crypto") which throw in Electron's renderer (nodeIntegration: false).
// Spring's SockJS endpoint exposes a native WebSocket at the /websocket sub-path.
// We connect there directly using the browser-native WebSocket API.
//
// https:// → wss://   (TLS)
// http://  → ws://    (plain — dev only)
const rawUrl  = import.meta.env.VITE_WS_URL ?? 'https://perfectelt.com/perfect/v1/ws/websocket'
const WS_URL  = rawUrl.replace(/^http/, 'ws')

const WAREHOUSE_QUEUE_TOPIC = '/topic/admin/warehouse/queue'

type QueueEventHandler = (event: WarehouseQueueEvent) => void

class WarehouseStompClient {
  private client:       Client | null = null
  private subscription: StompSubscription | null = null
  private handlers:     Set<QueueEventHandler> = new Set()
  private currentToken: string | null = null
  private connected  = false

  connect(token: string) {
    if (this.connected && this.currentToken === token) return
    this.disconnect()
    this.currentToken = token

    console.log('[stomp] connecting to', WS_URL)

    this.client = new Client({
      // Native WebSocket — no Node.js polyfills needed in Electron renderer.
      webSocketFactory: () => new WebSocket(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      heartbeatIncoming: 25_000,
      heartbeatOutgoing: 10_000,
      reconnectDelay:    5_000,
      onConnect: () => {
        this.connected = true
        console.log('[stomp] connected')
        this.subscribeToQueue()
      },
      onDisconnect: () => {
        this.connected    = false
        this.subscription = null
        console.log('[stomp] disconnected')
      },
      onStompError: (frame) => {
        console.error('[stomp] STOMP error:', frame.headers['message'])
      },
      onWebSocketError: (evt) => {
        console.error('[stomp] WebSocket error', evt)
      },
    })

    this.client.activate()
  }

  private subscribeToQueue() {
    if (!this.client || !this.connected) return
    this.subscription = this.client.subscribe(
      WAREHOUSE_QUEUE_TOPIC,
      (msg: IMessage) => {
        try {
          const event = JSON.parse(msg.body) as WarehouseQueueEvent
          this.handlers.forEach((h) => h(event))
        } catch (e) {
          console.error('[stomp] failed to parse queue event', e)
        }
      },
    )
    console.log('[stomp] subscribed to', WAREHOUSE_QUEUE_TOPIC)
  }

  disconnect() {
    this.subscription?.unsubscribe()
    this.subscription = null
    this.client?.deactivate()
    this.client       = null
    this.connected    = false
    this.currentToken = null
  }

  isConnected(): boolean {
    return this.connected
  }

  onQueueEvent(handler: QueueEventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}

export const warehouseStompClient = new WarehouseStompClient()
