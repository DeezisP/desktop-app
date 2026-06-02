import { create } from 'zustand'
import { scanApi, productsApi, ordersApi } from '../api/warehouse'
import type {
  ScanQueueResponse,
  WarehouseProductResponse,
  WarehouseOrderResponse,
  ImportHistoryResponse,
  WarehouseQueueEvent,
} from '../types/warehouse'

interface WarehouseState {
  // Scan queue
  queue: ScanQueueResponse[]
  queueLoading: boolean

  // Products
  products: WarehouseProductResponse[]
  productsLoading: boolean
  productsTotal: number

  // Orders
  orders: WarehouseOrderResponse[]
  ordersLoading: boolean
  ordersTotal: number

  // Import history
  importHistory: ImportHistoryResponse[]

  // Actions
  loadQueue: (page?: number) => Promise<void>
  loadProducts: (page?: number, size?: number) => Promise<void>
  searchProducts: (q: string) => Promise<WarehouseProductResponse[]>
  loadOrders: (params?: Record<string, string | number>) => Promise<void>
  loadImportHistory: () => Promise<void>
  applyQueueEvent: (event: WarehouseQueueEvent) => void
}

export const useWarehouseStore = create<WarehouseState>((set, get) => ({
  queue: [],
  queueLoading: false,
  products: [],
  productsLoading: false,
  productsTotal: 0,
  orders: [],
  ordersLoading: false,
  ordersTotal: 0,
  importHistory: [],

  async loadQueue(page = 0) {
    set({ queueLoading: true })
    try {
      const page_data = await scanApi.getQueue(page, 100)
      set({ queue: page_data.content })
    } finally {
      set({ queueLoading: false })
    }
  },

  async loadProducts(page = 0, size = 100) {
    set({ productsLoading: true })
    try {
      const page_data = await productsApi.list(page, size)
      set({ products: page_data.content, productsTotal: page_data.totalElements })
    } finally {
      set({ productsLoading: false })
    }
  },

  async searchProducts(q: string) {
    const results = await productsApi.search(q)
    return results
  },

  async loadOrders(params = {}) {
    set({ ordersLoading: true })
    try {
      const page_data = await ordersApi.list({ page: 0, size: 50, ...params })
      set({ orders: page_data.content, ordersTotal: page_data.totalElements })
    } finally {
      set({ ordersLoading: false })
    }
  },

  async loadImportHistory() {
    const history = await ordersApi.getImportHistory(100)
    set({ importHistory: history })
  },

  applyQueueEvent(event: WarehouseQueueEvent) {
    const { queue } = get()

    switch (event.type) {
      case 'SCANNED': {
        if (!event.entry) return
        const existing = queue.findIndex((q) => q.id === event.entry!.id)
        if (existing >= 0) {
          const updated = [...queue]
          updated[existing] = event.entry
          set({ queue: updated })
        } else {
          set({ queue: [event.entry, ...queue] })
        }
        break
      }
      case 'CONFIRMED': {
        if (!event.entry) return
        set({ queue: queue.map((q) => (q.id === event.entry!.id ? event.entry! : q)) })
        break
      }
      case 'CANCELLED': {
        if (!event.queueId) return
        set({ queue: queue.filter((q) => q.id !== event.queueId) })
        break
      }
      default:
        break
    }
  },
}))
