import { apiClient } from './client'
import type { ApiResponse, PageResponse } from '../types/api'
import type {
  ScanQueueResponse,
  WarehouseOrderResponse,
  WarehouseProductResponse,
  ImportHistoryResponse,
  ImportResultResponse,
  OrderImportDto,
  HeldBarcodeResponse,
} from '../types/warehouse'

// ── Scan Queue ────────────────────────────────────────────────────────────────

export const scanApi = {
  async getQueue(page = 0, size = 50): Promise<PageResponse<ScanQueueResponse>> {
    const { data } = await apiClient.get<ApiResponse<PageResponse<ScanQueueResponse>>>(
      '/warehouse/scan/queue',
      { params: { page, size } },
    )
    return data.data
  },

  async scan(orderNumber: string, stationId?: string): Promise<ScanQueueResponse> {
    const { data } = await apiClient.post<ApiResponse<ScanQueueResponse>>('/warehouse/scan', {
      orderNumber,
      stationId: stationId ?? import.meta.env.VITE_STATION_ID ?? 'DESKTOP',
    })
    return data.data
  },

  async confirmPack(queueId: number): Promise<ScanQueueResponse> {
    const { data } = await apiClient.post<ApiResponse<ScanQueueResponse>>('/warehouse/scan/confirm', {
      queueId,
    })
    return data.data
  },

  async deleteQueue(queueId: number): Promise<void> {
    await apiClient.delete(`/warehouse/scan/${queueId}`)
  },

  async getHeld(): Promise<HeldBarcodeResponse[]> {
    const { data } = await apiClient.get<ApiResponse<HeldBarcodeResponse[]>>('/warehouse/scan/held')
    return data.data
  },

  async clearHeld(): Promise<void> {
    await apiClient.delete('/warehouse/scan/held')
  },
}

// ── Orders ────────────────────────────────────────────────────────────────────

export const ordersApi = {
  async list(params?: {
    page?: number
    size?: number
    importStatus?: string
    platform?: string
    date?: string
  }): Promise<PageResponse<WarehouseOrderResponse>> {
    const { data } = await apiClient.get<ApiResponse<PageResponse<WarehouseOrderResponse>>>(
      '/warehouse/orders',
      { params: { page: 0, size: 50, ...params } },
    )
    return data.data
  },

  async getByOrderNumber(orderNumber: string): Promise<WarehouseOrderResponse> {
    const { data } = await apiClient.get<ApiResponse<WarehouseOrderResponse>>(
      `/warehouse/orders/${orderNumber}`,
    )
    return data.data
  },

  async scanOrder(code: string): Promise<WarehouseOrderResponse> {
    const { data } = await apiClient.get<ApiResponse<WarehouseOrderResponse>>(
      '/warehouse/orders/scan',
      { params: { code } },
    )
    return data.data
  },

  async updateStatus(orderNumber: string, status: string): Promise<void> {
    await apiClient.patch(`/warehouse/orders/${orderNumber}/status`, null, {
      params: { status },
    })
  },

  async updateShipping(orderNumber: string, method: string): Promise<void> {
    await apiClient.patch(`/warehouse/orders/${orderNumber}/shipping`, null, {
      params: { method },
    })
  },

  async deleteOrder(orderNumber: string): Promise<void> {
    await apiClient.delete(`/warehouse/orders/${orderNumber}`)
  },

  async addItem(orderId: number, payload: { matchedProductId: number; qty: number; productName?: string }): Promise<void> {
    await apiClient.post(`/warehouse/orders/${orderId}/items`, payload)
  },

  async deleteItem(itemId: number): Promise<void> {
    await apiClient.delete(`/warehouse/orders/items/${itemId}`)
  },

  async updateItem(itemId: number, payload: { qty: number; matchedProductId: number }): Promise<void> {
    await apiClient.patch(`/warehouse/orders/items/${itemId}`, payload)
  },

  async rematch(): Promise<void> {
    await apiClient.post('/warehouse/orders/rematch')
  },

  async importOrders(orders: OrderImportDto[], platform = 'MANUAL'): Promise<ImportResultResponse> {
    const { data } = await apiClient.post<ApiResponse<ImportResultResponse>>('/warehouse/orders/import', {
      orders,
    })
    return data.data
  },

  async getImportHistory(size = 100): Promise<ImportHistoryResponse[]> {
    const { data } = await apiClient.get<ApiResponse<ImportHistoryResponse[]>>(
      '/warehouse/orders/import-history',
      { params: { size } },
    )
    return data.data
  },
}

// ── Products ──────────────────────────────────────────────────────────────────

export const productsApi = {
  async list(page = 0, size = 50): Promise<PageResponse<WarehouseProductResponse>> {
    const { data } = await apiClient.get<ApiResponse<PageResponse<WarehouseProductResponse>>>(
      '/warehouse/products',
      { params: { page, size } },
    )
    return data.data
  },

  async listAll(): Promise<WarehouseProductResponse[]> {
    const { data } = await apiClient.get<ApiResponse<WarehouseProductResponse[]>>(
      '/warehouse/products/all',
    )
    return data.data
  },

  async search(q: string): Promise<WarehouseProductResponse[]> {
    const { data } = await apiClient.get<ApiResponse<WarehouseProductResponse[]>>(
      '/warehouse/products/search',
      { params: { q } },
    )
    return data.data
  },

  async getById(id: number): Promise<WarehouseProductResponse> {
    const { data } = await apiClient.get<ApiResponse<WarehouseProductResponse>>(
      `/warehouse/products/${id}`,
    )
    return data.data
  },

  async adjustStock(id: number, delta: number, reason: string): Promise<WarehouseProductResponse> {
    const { data } = await apiClient.patch<ApiResponse<WarehouseProductResponse>>(
      `/warehouse/products/${id}/stock`,
      { delta, reason },
    )
    return data.data
  },

  async toggleStockChecked(id: number): Promise<WarehouseProductResponse> {
    const { data } = await apiClient.patch<ApiResponse<WarehouseProductResponse>>(
      `/warehouse/products/${id}/toggle-stock-checked`,
    )
    return data.data
  },

  async sync(): Promise<void> {
    await apiClient.post('/warehouse/products/sync')
  },

  async create(title: string, stock: number): Promise<WarehouseProductResponse> {
    const { data } = await apiClient.post<ApiResponse<WarehouseProductResponse>>(
      '/warehouse/products',
      { title, stock },
    )
    return data.data
  },

  async deleteProduct(id: number): Promise<void> {
    await apiClient.delete(`/warehouse/products/${id}`)
  },
}
