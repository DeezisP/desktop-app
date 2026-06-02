import { Client, type StompSubscription, type IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { WarehouseQueueEvent } from '../types/warehouse'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'https://perfectelt.com/perfect/v1/ws/websocket'
const WAREHOUSE_QUEUE_TOPIC = '/topic/admin/warehouse/queue'

type QueueEventHandler = (event: WarehouseQueueEvent) => void

class WarehouseStompClient {
  private client: Client | null = null
  private subscription: StompSubscription | null = null
  private handlers: Set<QueueEventHandler> = new Set()
  private currentToken: string | null = null
  private connected = false

  connect(token: string) {
    if (this.connected && this.currentToken === token) return
    this.disconnect()
    this.currentToken = token

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL) as WebSocket,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      heartbeatIncoming: 25_000,
      heartbeatOutgoing: 10_000,
      reconnectDelay: 5_000,
      onConnect: () => {
        this.connected = true
        this.subscribeToQueue()
      },
      onDisconnect: () => {
        this.connected = false
        this.subscription = null
      },
      onStompError: (frame) => {
        console.error('[STOMP] error', frame.headers['message'])
      },
      onWebSocketError: (evt) => {
        console.error('[STOMP] WebSocket error', evt)
      },
    })

    this.client.activate()
  }

  private subscribeToQueue() {
    if (!this.client || !this.connected) return
    this.subscription = this.client.subscribe(WAREHOUSE_QUEUE_TOPIC, (msg: IMessage) => {
      try {
        const event = JSON.parse(msg.body) as WarehouseQueueEvent
        this.handlers.forEach((h) => h(event))
      } catch (e) {
        console.error('[STOMP] failed to parse queue event', e)
      }
    })
  }

  disconnect() {
    this.subscription?.unsubscribe()
    this.subscription = null
    this.client?.deactivate()
    this.client = null
    this.connected = false
    this.currentToken = null
  }

  isConnected(): boolean {
    return this.connected
  }

  onQueueEvent(handler: QueueEventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  updateToken(token: string) {
    if (token !== this.currentToken) {
      this.connect(token)
    }
  }
}

export const warehouseStompClient = new WarehouseStompClient()
