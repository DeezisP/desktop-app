import { Client, type StompSubscription, type IMessage } from '@stomp/stompjs'
import type { WarehouseQueueEvent } from '../types/warehouse'

type GenericMessageHandler = (msg: IMessage) => void

// sockjs-client was removed because it bundles Node.js require("events") and
// require("crypto") which throw in Electron's renderer (nodeIntegration: false).
// Spring's SockJS endpoint exposes a native WebSocket at the /websocket sub-path.
// We connect there directly using the browser-native WebSocket API.
//
// https:// → wss://   (TLS)
// http://  → ws://    (plain — dev only)
const rawUrl = import.meta.env.VITE_WS_URL ?? 'https://perfectelt.com/perfect/v1/ws/websocket'
const WS_URL = rawUrl.replace(/^http/, 'ws')

const WAREHOUSE_QUEUE_TOPIC = '/topic/admin/warehouse/queue'

type QueueEventHandler      = (event: WarehouseQueueEvent) => void
type ConnectionStateHandler = (connected: boolean) => void

class WarehouseStompClient {
  private client:       Client | null = null
  private subscription: StompSubscription | null = null
  private queueHandlers: Set<QueueEventHandler>      = new Set()
  private connHandlers:  Set<ConnectionStateHandler> = new Set()
  private currentToken: string | null = null
  private connected = false
  private reconnectCount = 0

  // Generic topic subscriptions (chat and other modules)
  private genericSubs: Map<string, { handler: GenericMessageHandler; sub: StompSubscription | null }> = new Map()

  connect(token: string) {
    if (this.connected && this.currentToken === token) return
    this.disconnect()
    this.currentToken = token

    // Diagnostics
    console.log('[stomp] url:', WS_URL)
    console.log('[stomp] tokenPresent:', Boolean(token && token.length > 0))
    console.log('[stomp] reconnectCount:', this.reconnectCount)

    this.client = new Client({
      webSocketFactory: () => {
        const ws = new WebSocket(WS_URL)
        // Log the WebSocket readyState transitions for diagnostics
        ws.addEventListener('open',  () => console.log('[stomp] ws open'))
        ws.addEventListener('close', (e) => console.log(`[stomp] ws close code=${e.code} reason="${e.reason}" wasClean=${e.wasClean}`))
        ws.addEventListener('error', () => console.error('[stomp] ws error (see network tab)'))
        return ws
      },
      connectHeaders: { Authorization: `Bearer ${token}` },
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      reconnectDelay:    2_000,
      onConnect: (frame) => {
        this.connected = true
        this.reconnectCount = 0
        console.log('[stomp] connected, server=', frame.headers['server'] ?? '(unknown)')
        this.notifyConnState(true)
        this.subscribeToQueue()
        this.resubscribeGeneric()
      },
      onDisconnect: () => {
        this.connected    = false
        this.subscription = null
        console.log('[stomp] disconnected')
        this.notifyConnState(false)
      },
      onStompError: (frame) => {
        console.error('[stomp] STOMP error:', frame.headers['message'], frame.body)
      },
      onWebSocketError: (evt) => {
        this.reconnectCount++
        console.error('[stomp] WebSocket error (attempt', this.reconnectCount, ')', evt)
      },
    })

    this.client.activate()
  }

  private notifyConnState(connected: boolean) {
    this.connHandlers.forEach((h) => h(connected))
  }

  private subscribeToQueue() {
    if (!this.client || !this.connected) return
    this.subscription = this.client.subscribe(
      WAREHOUSE_QUEUE_TOPIC,
      (msg: IMessage) => {
        try {
          const event = JSON.parse(msg.body) as WarehouseQueueEvent
          this.queueHandlers.forEach((h) => h(event))
        } catch (e) {
          console.error('[stomp] failed to parse queue event', e)
        }
      },
    )
    console.log('[stomp] subscribed to', WAREHOUSE_QUEUE_TOPIC)
  }

  private resubscribeGeneric() {
    if (!this.client || !this.connected) return
    this.genericSubs.forEach((entry, topic) => {
      entry.sub = this.client!.subscribe(topic, entry.handler)
      console.log('[stomp] re-subscribed generic topic:', topic)
    })
  }

  /** Subscribe to any STOMP topic. Returns an unsubscribe function. */
  subscribe(topic: string, handler: GenericMessageHandler): () => void {
    const existing = this.genericSubs.get(topic)
    if (existing) {
      existing.handler = handler
      return () => this.unsubscribeTopic(topic)
    }
    const entry: { handler: GenericMessageHandler; sub: StompSubscription | null } = {
      handler,
      sub: null,
    }
    if (this.client && this.connected && this.client.connected) {
      entry.sub = this.client.subscribe(topic, handler)
      console.log('[stomp] subscribed generic topic:', topic)
    }
    this.genericSubs.set(topic, entry)
    return () => this.unsubscribeTopic(topic)
  }

  private unsubscribeTopic(topic: string) {
    const entry = this.genericSubs.get(topic)
    if (entry) {
      entry.sub?.unsubscribe()
      this.genericSubs.delete(topic)
      console.log('[stomp] unsubscribed generic topic:', topic)
    }
  }

  /** Publish a message to a STOMP destination. No-op if not connected. */
  publish(destination: string, body: string): void {
    if (!this.client || !this.connected || !this.client.connected) {
      console.warn('[stomp] publish skipped (not connected):', destination)
      return
    }
    try {
      this.client.publish({ destination, body })
    } catch (err) {
      console.warn('[stomp] publish threw (connection dropped mid-flight):', err)
    }
  }

  disconnect() {
    this.genericSubs.forEach((entry) => entry.sub?.unsubscribe())
    this.genericSubs.clear()
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
    this.queueHandlers.add(handler)
    return () => this.queueHandlers.delete(handler)
  }

  /** Subscribe to connection-state changes. Fires immediately with current state, then on every change. */
  onConnectionChange(handler: ConnectionStateHandler): () => void {
    handler(this.connected)
    this.connHandlers.add(handler)
    return () => this.connHandlers.delete(handler)
  }
}

export const warehouseStompClient = new WarehouseStompClient()
