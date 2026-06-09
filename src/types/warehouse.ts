export type ImportStatus = 'IMPORTED' | 'PACKED' | 'CANCELLED'
export type QueueStatus  = 'WAITING' | 'PACKING' | 'DONE' | 'ERROR'
export type MatchConfidence = 'EXACT' | 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED'

export interface WarehouseOrderItemResponse {
  id: number
  sku: string | null
  productName: string
  variant: string | null
  qty: number
  price: number | null
  matchedProductId: number | null
  matchConfidence: MatchConfidence | null
  productStock: number | null
}

export interface WarehouseOrderResponse {
  id: number
  orderNumber: string
  trackingNumber: string | null
  platform: string | null
  shop: string | null
  customerName: string | null
  status: string | null
  shippingMethod: string | null
  createdAtPlatform: string | null
  phone: string | null
  address: string | null
  province: string | null
  buyerNote: string | null
  importStatus: ImportStatus
  importedAt: string | null
  createdAt: string
  items: WarehouseOrderItemResponse[]
}

export interface ScanQueueResponse {
  id: number
  orderNumber: string
  status: QueueStatus
  stationId: string | null
  scannedAt: string
  confirmedAt: string | null
  errorMessage: string | null
  createdAt: string
  order: WarehouseOrderResponse | null
}

export interface WarehouseProductResponse {
  id: number
  wordpressProductId: number | null
  title: string
  normalizedTitle: string | null
  stock: number
  reservedStock: number
  availableStock: number
  syncedAt: string | null
  createdAt: string
  updatedAt: string | null
  stockChecked: boolean
  generated: boolean
}

export interface HeldBarcodeResponse {
  id: number
  barcode: string
  stationId: string | null
  scannedAt: string
}

export interface ImportHistoryResponse {
  id: number
  platform: string
  tried: number
  newCount: number
  skippedCount: number
  createdAt: string
}

export interface BarcodeScanResult {
  success: boolean
  queueId: number | null
  orderId: number | null
  orderNumber: string | null
  status: QueueStatus | null
  items: WarehouseOrderItemResponse[] | null
  error: string | null
}

export interface WarehouseQueueEvent {
  type: 'SCANNED' | 'CONFIRMED' | 'CANCELLED' | 'HELD_UPDATED' | 'ITEM_ADDED'
  entry?: ScanQueueResponse
  queueId?: number
  held?: HeldBarcodeResponse[]
  orderId?: number
  item?: WarehouseOrderItemResponse
}

export interface OrderImportItem {
  sku: string
  product_name: string
  variant: string
  qty: number
  price: number
}

export interface OrderImportDto {
  order_no: string
  tracking_no: string
  platform: string
  shop: string
  customer_name: string
  status: string
  shipping_method: string
  created_at: string
  phone: string
  address: string
  province: string
  buyer_note: string
  items: OrderImportItem[]
}

export interface ImportResultResponse {
  newCount: number
  skippedCount: number
  tried: number
  platform: string
}
