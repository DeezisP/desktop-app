import { create } from 'zustand'
import { scanApi, productsApi, ordersApi, storeOrdersApi } from '../api/warehouse'
import type { StoreOrder } from '../api/warehouse'
import type {
  ScanQueueResponse,
  WarehouseProductResponse,
  WarehouseOrderResponse,
  WarehouseOrderItemResponse,
  ImportHistoryResponse,
  WarehouseQueueEvent,
} from '../types/warehouse'

interface WarehouseState {
  // ── Scan queue ────────────────────────────────────────────────────────────
  queue: ScanQueueResponse[]
  queueLoading: boolean
  queueLoaded: boolean

  // ── Products (paginated, used by Dashboard) ───────────────────────────────
  products: WarehouseProductResponse[]
  productsLoading: boolean
  productsTotal: number

  // ── All products (full list, used by StockListPanel) ─────────────────────
  allProducts: WarehouseProductResponse[]
  allProductsLoaded: boolean
  allProductsLoading: boolean
  allProductsError: string

  // ── Backend orders (import/packing flow) ─────────────────────────────────
  orders: WarehouseOrderResponse[]
  ordersLoading: boolean
  ordersTotal: number
  ordersLoaded: boolean
  ordersLastFilter: string  // serialised filter key to detect changes

  // ── Website store orders (WebOrdersPanel) ─────────────────────────────────
  webOrders: StoreOrder[]
  webOrdersLoading: boolean
  webOrdersLoaded: boolean

  // ── Import history ────────────────────────────────────────────────────────
  importHistory: ImportHistoryResponse[]

  // ── Actions ───────────────────────────────────────────────────────────────
  loadQueue: (page?: number) => Promise<void>
  setQueueData: (queue: ScanQueueResponse[]) => void

  loadProducts: (page?: number, size?: number) => Promise<void>
  searchProducts: (q: string) => Promise<WarehouseProductResponse[]>

  loadAllProducts: (force?: boolean) => Promise<void>
  addProduct: (p: WarehouseProductResponse) => void
  removeProduct: (id: number) => void
  updateProduct: (p: WarehouseProductResponse) => void

  loadOrders: (params?: Record<string, string | undefined>) => Promise<void>
  loadImportHistory: () => Promise<void>

  patchOrder: (orderNumber: string, patch: Partial<WarehouseOrderResponse>) => void
  removeOrder: (orderNumber: string) => void
  removeOrders: (orderNumbers: string[]) => void
  patchOrderItem: (orderNumber: string, itemId: number, patch: Partial<WarehouseOrderResponse['items'][number]>) => void
  batchPatchOrderItems: (items: (Partial<WarehouseOrderItemResponse> & { id: number })[]) => void

  loadWebOrders: (force?: boolean) => Promise<void>
  patchWebOrder: (id: number, patch: Partial<StoreOrder>) => void
  removeWebOrder: (id: number) => void
  bulkRemoveWebOrders: (ids: number[]) => void

  upsertQueueEntry: (entry: ScanQueueResponse) => void
  removeQueueEntry: (queueId: number) => void
  updateQueueItem: (queueId: number, itemId: number, item: WarehouseOrderItemResponse) => void
  removeQueueItem: (queueId: number, itemId: number) => void
  addQueueItem: (queueId: number, item: WarehouseOrderItemResponse) => void

  applyQueueEvent: (event: WarehouseQueueEvent) => void
}

export const useWarehouseStore = create<WarehouseState>((set, get) => ({
  // ── Initial state ─────────────────────────────────────────────────────────
  queue: [],
  queueLoading: false,
  queueLoaded: false,

  products: [],
  productsLoading: false,
  productsTotal: 0,

  allProducts: [],
  allProductsLoaded: false,
  allProductsLoading: false,
  allProductsError: '',

  orders: [],
  ordersLoading: false,
  ordersTotal: 0,
  ordersLoaded: false,
  ordersLastFilter: '',

  webOrders: [],
  webOrdersLoading: false,
  webOrdersLoaded: false,

  importHistory: [],

  // ── Queue ─────────────────────────────────────────────────────────────────

  async loadQueue(page = 0) {
    set({ queueLoading: true })
    try {
      const page_data = await scanApi.getQueue(page, 100)
      set({ queue: page_data.content, queueLoaded: true })
    } finally {
      set({ queueLoading: false })
    }
  },

  setQueueData(queue) {
    set({ queue, queueLoaded: true })
  },

  // ── Products (paginated) ──────────────────────────────────────────────────

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

  // ── All products ──────────────────────────────────────────────────────────

  async loadAllProducts(force = false) {
    const { allProductsLoaded, allProductsLoading } = get()
    if ((allProductsLoaded && !force) || allProductsLoading) return
    set({ allProductsLoading: true, allProductsError: '' })
    try {
      const data = await productsApi.listAll()
      set({ allProducts: data, allProductsLoaded: true })
    } catch {
      set({ allProductsError: 'โหลดข้อมูลสต็อกไม่สำเร็จ' })
    } finally {
      set({ allProductsLoading: false })
    }
  },

  addProduct(p) {
    set(s => ({
      allProducts: [...s.allProducts, p].sort((a, b) => a.title.localeCompare(b.title)),
    }))
  },

  removeProduct(id) {
    set(s => ({ allProducts: s.allProducts.filter(p => p.id !== id) }))
  },

  updateProduct(p) {
    set(s => ({ allProducts: s.allProducts.map(x => x.id === p.id ? p : x) }))
  },

  // ── Backend orders ────────────────────────────────────────────────────────

  async loadOrders(params: Record<string, string | undefined> = {}) {
    const filterKey = JSON.stringify(params)
    const { ordersLoaded, ordersLastFilter, ordersLoading } = get()
    if (ordersLoaded && ordersLastFilter === filterKey && !ordersLoading) return
    set({ ordersLoading: true })
    try {
      const page_data = await ordersApi.list({
        page: 0,
        size: 9999,
        importStatus: params.importStatus,
        platform: params.platform,
        date: params.date,
      })
      set({ orders: page_data.content, ordersTotal: page_data.totalElements, ordersLoaded: true, ordersLastFilter: filterKey })
    } finally {
      set({ ordersLoading: false })
    }
  },

  async loadImportHistory() {
    const history = await ordersApi.getImportHistory(100)
    set({ importHistory: history })
  },

  // ── Backend order mutations ───────────────────────────────────────────────

  patchOrder(orderNumber, patch) {
    set(s => ({ orders: s.orders.map(o => o.orderNumber === orderNumber ? { ...o, ...patch } : o) }))
  },

  removeOrder(orderNumber) {
    set(s => ({ orders: s.orders.filter(o => o.orderNumber !== orderNumber) }))
  },

  removeOrders(orderNumbers) {
    const nums = new Set(orderNumbers)
    set(s => ({ orders: s.orders.filter(o => !nums.has(o.orderNumber)) }))
  },

  patchOrderItem(orderNumber, itemId, patch) {
    set(s => ({
      orders: s.orders.map(o => {
        if (o.orderNumber !== orderNumber) return o
        return { ...o, items: o.items.map(i => i.id === itemId ? { ...i, ...patch } : i) }
      }),
    }))
  },

  batchPatchOrderItems(items) {
    const patchMap = new Map(items.map(i => [i.id, i]))
    set(s => ({
      orders: s.orders.map(o => ({
        ...o,
        items: o.items.map(i => {
          const patch = patchMap.get(i.id)
          return patch ? { ...i, ...patch } : i
        }),
      })),
    }))
  },

  // ── Web orders ────────────────────────────────────────────────────────────

  async loadWebOrders(force = false) {
    const { webOrdersLoaded, webOrdersLoading } = get()
    if ((webOrdersLoaded && !force) || webOrdersLoading) return
    set({ webOrdersLoading: true })
    try {
      const data = await storeOrdersApi.getAll()
      set({ webOrders: data, webOrdersLoaded: true })
    } finally {
      set({ webOrdersLoading: false })
    }
  },

  patchWebOrder(id, patch) {
    set(s => ({
      webOrders: s.webOrders.map(o => o.id === id ? { ...o, ...patch } : o),
    }))
  },

  removeWebOrder(id) {
    set(s => ({ webOrders: s.webOrders.filter(o => o.id !== id) }))
  },

  bulkRemoveWebOrders(ids) {
    const set_ = new Set(ids)
    set(s => ({ webOrders: s.webOrders.filter(o => !set_.has(o.id)) }))
  },

  // ── Queue entry mutations ─────────────────────────────────────────────────

  upsertQueueEntry(entry) {
    const { queue } = get()
    const exists = queue.some(q => q.id === entry.id)
    set({ queue: exists ? queue.map(q => q.id === entry.id ? entry : q) : [entry, ...queue] })
  },

  removeQueueEntry(queueId) {
    set(s => ({ queue: s.queue.filter(q => q.id !== queueId) }))
  },

  updateQueueItem(queueId, itemId, item) {
    set(s => ({
      queue: s.queue.map(q => {
        if (q.id !== queueId || !q.order) return q
        return { ...q, order: { ...q.order, items: q.order.items.map(i => i.id === itemId ? item : i) } }
      }),
    }))
  },

  removeQueueItem(queueId, itemId) {
    set(s => ({
      queue: s.queue.map(q => {
        if (q.id !== queueId || !q.order) return q
        return { ...q, order: { ...q.order, items: q.order.items.filter(i => i.id !== itemId) } }
      }),
    }))
  },

  addQueueItem(queueId, item) {
    set(s => ({
      queue: s.queue.map(q => {
        if (q.id !== queueId || !q.order) return q
        const exists = q.order.items.some(i => i.id === item.id)
        return { ...q, order: { ...q.order, items: exists ? q.order.items.map(i => i.id === item.id ? item : i) : [...q.order.items, item] } }
      }),
    }))
  },

  // ── Queue events ──────────────────────────────────────────────────────────

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
      case 'ITEM_ADDED': {
        if (event.orderId == null || !event.item) return
        set({
          queue: queue.map(q => {
            if (!q.order || q.order.id !== event.orderId) return q
            const exists = q.order.items.some(i => i.id === event.item!.id)
            return {
              ...q,
              order: {
                ...q.order,
                items: exists
                  ? q.order.items.map(i => i.id === event.item!.id ? event.item! : i)
                  : [...q.order.items, event.item!],
              },
            }
          }),
        })
        break
      }
      default:
        break
    }
  },
}))
