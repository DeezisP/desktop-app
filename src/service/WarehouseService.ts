import { apiClient } from '../api/client';

const API_BASE = '/warehouse';

export interface BackendApiResponse<T> {
  success: boolean;
  code: string;
  message: string | null;
  data: T;
}
export interface BackendPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
export interface HeldBarcode {
  id: number;
  barcode: string;
  stationId: string | null;
  scannedAt: string;
}
export type BackendQueueStatus   = 'WAITING' | 'PACKING' | 'DONE' | 'ERROR';
export type BackendImportStatus  = 'IMPORTED' | 'PACKED' | 'CANCELLED';
export type BackendMatchConfidence = 'EXACT' | 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED' | 'CONTAINS' | 'TOKEN';

export interface BackendOrderItem {
  id: number;
  sku: string | null;
  productName: string | null;
  variant: string | null;
  qty: number;
  price: number;
  matchedProductId: number | null;
  matchConfidence: BackendMatchConfidence | null;
  productStock: number | null;
}
export interface BackendOrder {
  id: number;
  orderNumber: string;
  trackingNumber: string | null;
  platform: string | null;
  shop: string | null;
  customerName: string | null;
  status: string | null;
  shippingMethod: string | null;
  createdAtPlatform: string | null;
  phone: string | null;
  address: string | null;
  province: string | null;
  buyerNote: string | null;
  importStatus: BackendImportStatus;
  importedAt: string | null;
  createdAt: string;
  labelPrinted: boolean;
  items: BackendOrderItem[];
}
export interface ScanQueueEntry {
  id: number;
  orderNumber: string;
  status: BackendQueueStatus;
  stationId: string | null;
  scannedAt: string | null;
  confirmedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  order: BackendOrder | null;
}
export interface WarehouseProduct {
  id: number;
  wordpressProductId: number | null;
  title: string;
  normalizedTitle: string;
  stock: number;
  reservedStock: number;
  availableStock: number;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stockChecked: boolean;
  generated: boolean;
}
export interface WpSyncResult {
  total: number; created: number; updated: number; skipped: number;
}
export interface BarcodeScanResult {
  type: 'ORDER_NUMBER' | 'TRACKING_NUMBER';
  order: BackendOrder;
}
export interface ImportResult {
  orders: BackendOrder[];
  newCount: number;
  skippedCount: number;
}
export interface StockLogEntry {
  id: number;
  productId: number;
  productTitle: string;
  changeAmount: number;
  beforeStock: number;
  afterStock: number;
  reason: string | null;
  referenceId: string | null;
  createdAt: string;
}
export interface ImportHistoryEntry {
  id: number;
  platform: string;
  tried: number;
  newCount: number;
  skippedCount: number;
  createdAt: string;
}
export interface OrderItemImport {
  sku: string;
  product_name: string;
  variant?: string;
  qty: number;
  price: number;
}
export interface OrderImport {
  order_no: string;
  tracking_no: string;
  platform: string;
  shop?: string;
  customer_name: string;
  items: OrderItemImport[];
  status: string;
  shipping_method: string;
  created_at: string;
  phone?: string;
  address?: string;
  province?: string;
  buyer_note?: string;
}

const WarehouseService = {
  getProducts: (page = 0, size = 50) =>
    apiClient.get<BackendApiResponse<BackendPage<WarehouseProduct>>>(
      `${API_BASE}/products`, { params: { page, size } }),

  getAllProducts: () =>
    apiClient.get<BackendApiResponse<WarehouseProduct[]>>(`${API_BASE}/products/all`),

  syncProducts: () =>
    apiClient.post<BackendApiResponse<WpSyncResult>>(`${API_BASE}/products/sync`),

  adjustStock: (id: number, delta: number, reason?: string) =>
    apiClient.patch<BackendApiResponse<WarehouseProduct>>(
      `${API_BASE}/products/${id}/stock`, { delta, reason }),

  toggleStockChecked: (id: number) =>
    apiClient.patch<BackendApiResponse<WarehouseProduct>>(
      `${API_BASE}/products/${id}/toggle-stock-checked`),

  createProduct: (title: string, stock: number) =>
    apiClient.post<BackendApiResponse<WarehouseProduct>>(
      `${API_BASE}/products`, { title, stock }),

  deleteProduct: (id: number) =>
    apiClient.delete<BackendApiResponse<void>>(`${API_BASE}/products/${id}`),

  importOrders: (orders: OrderImport[]) =>
    apiClient.post<BackendApiResponse<ImportResult>>(
      `${API_BASE}/orders/import`, { orders }),

  getOrders: (page = 0, size = 50, importStatus?: BackendImportStatus, date?: string) =>
    apiClient.get<BackendApiResponse<BackendPage<BackendOrder>>>(
      `${API_BASE}/orders`,
      { params: { page, size, ...(importStatus ? { importStatus } : {}), ...(date ? { date } : {}) } }),

  getOrderByNumber: (orderNumber: string) =>
    apiClient.get<BackendApiResponse<BackendOrder>>(
      `${API_BASE}/orders/${encodeURIComponent(orderNumber)}`),

  scan: (orderNumber: string, stationId?: string) =>
    apiClient.post<BackendApiResponse<ScanQueueEntry>>(
      `${API_BASE}/scan`,
      { order_number: orderNumber, ...(stationId ? { station_id: stationId } : {}) }),

  confirmPack: (queueId: number) =>
    apiClient.post<BackendApiResponse<ScanQueueEntry>>(
      `${API_BASE}/scan/confirm`, { queue_id: queueId }),

  getQueue: (page = 0, size = 100) =>
    apiClient.get<BackendApiResponse<BackendPage<ScanQueueEntry>>>(
      `${API_BASE}/scan/queue`, { params: { page, size } }),

  cancelScan: (queueId: number) =>
    apiClient.delete<BackendApiResponse<void>>(`${API_BASE}/scan/${queueId}`),

  getHeldBarcodes: () =>
    apiClient.get<BackendApiResponse<HeldBarcode[]>>(`${API_BASE}/scan/held`),

  clearHeldBarcodes: () =>
    apiClient.delete<BackendApiResponse<void>>(`${API_BASE}/scan/held`),

  updateOrderStatus: (orderNumber: string, status: BackendImportStatus) =>
    apiClient.patch<BackendApiResponse<BackendOrder>>(
      `${API_BASE}/orders/${encodeURIComponent(orderNumber)}/status`,
      null, { params: { status } }),

  updateOrderShipping: (orderNumber: string, method: string) =>
    apiClient.patch<BackendApiResponse<BackendOrder>>(
      `${API_BASE}/orders/${encodeURIComponent(orderNumber)}/shipping`,
      null, { params: { method } }),

  deleteOrder: (orderNumber: string) =>
    apiClient.delete<BackendApiResponse<void>>(
      `${API_BASE}/orders/${encodeURIComponent(orderNumber)}`),

  markLabelPrinted: (orderNumber: string, printed = true) =>
    apiClient.patch<BackendApiResponse<BackendOrder>>(
      `${API_BASE}/orders/${encodeURIComponent(orderNumber)}/printed`,
      null,
      { params: { printed } }),

  rematchAll: () =>
    apiClient.post<BackendApiResponse<number>>(`${API_BASE}/orders/rematch`),

  updateOrderItem: (itemId: number, req: { qty?: number; matchedProductId?: number | null }) =>
    apiClient.patch<BackendApiResponse<BackendOrderItem>>(
      `${API_BASE}/orders/items/${itemId}`, req),

  searchProducts: (q: string) =>
    apiClient.get<BackendApiResponse<WarehouseProduct[]>>(
      `${API_BASE}/products/search`, { params: { q } }),

  addOrderItem: (orderId: number, req: { matchedProductId: number; qty: number; productName: string }) =>
    apiClient.post<BackendApiResponse<BackendOrderItem>>(
      `${API_BASE}/orders/${orderId}/items`, req),

  deleteOrderItem: (itemId: number) =>
    apiClient.delete<BackendApiResponse<void>>(`${API_BASE}/orders/items/${itemId}`),

  scanBarcode: (code: string) =>
    apiClient.get<BackendApiResponse<BarcodeScanResult>>(
      `${API_BASE}/orders/scan`, { params: { code } }),

  getImportHistory: (size = 100) =>
    apiClient.get<BackendApiResponse<ImportHistoryEntry[]>>(
      `${API_BASE}/orders/import-history`, { params: { size } }),

  saveImportHistory: (entry: { platform: string; tried: number; newCount: number; skippedCount: number }) =>
    apiClient.post<BackendApiResponse<ImportHistoryEntry>>(
      `${API_BASE}/orders/import-history`, entry),

  notifyPackingQueue: (total: number, carriers: Record<string, number>) =>
    apiClient.post(`${API_BASE}/scan/notify-packing`, { total, carriers })
      .catch(err => { console.error('[notifyPackingQueue]', err?.response?.status, err?.message); return null; }),

  getStockLogs: (date?: string) =>
    apiClient.get<BackendApiResponse<StockLogEntry[]>>(
      `${API_BASE}/products/stock-logs`,
      { params: date ? { date } : {} }),
};

export default WarehouseService;
