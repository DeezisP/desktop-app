import { useEffect, useState, useCallback } from 'react'
import { useWarehouseStore } from '../store/warehouseStore'
import { ordersApi } from '../api/warehouse'
import { StatusBadge } from '../components/StatusBadge'
import type { WarehouseOrderResponse } from '../types/warehouse'

const IMPORT_STATUSES = ['ALL', 'IMPORTED', 'PACKED', 'CANCELLED']

export function OrderPacking() {
  const orders        = useWarehouseStore((s) => s.orders)
  const ordersLoading = useWarehouseStore((s) => s.ordersLoading)
  const ordersTotal   = useWarehouseStore((s) => s.ordersTotal)
  const loadOrders    = useWarehouseStore((s) => s.loadOrders)

  const [selectedOrder, setSelectedOrder] = useState<WarehouseOrderResponse | null>(null)
  const [filterStatus, setFilterStatus]   = useState('ALL')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (filterStatus === 'ALL') {
      loadOrders({})
    } else {
      loadOrders({ importStatus: filterStatus })
    }
  }, [filterStatus, loadOrders])

  const selectOrder = useCallback(async (orderNumber: string) => {
    try {
      const order = await ordersApi.getByOrderNumber(orderNumber)
      setSelectedOrder(order)
    } catch {
      // fall back to list data
      setSelectedOrder(orders.find((o) => o.orderNumber === orderNumber) ?? null)
    }
  }, [orders])

  const updateStatus = useCallback(async (orderNumber: string, status: string) => {
    setUpdatingStatus(true)
    try {
      await ordersApi.updateStatus(orderNumber, status)
      if (filterStatus === 'ALL') {
        await loadOrders({})
      } else {
        await loadOrders({ importStatus: filterStatus })
      }
      if (selectedOrder?.orderNumber === orderNumber) {
        const refreshed = await ordersApi.getByOrderNumber(orderNumber)
        setSelectedOrder(refreshed)
      }
    } finally {
      setUpdatingStatus(false)
    }
  }, [filterStatus, loadOrders, selectedOrder])

  const filtered = filterPlatform
    ? orders.filter((o) => (o.platform ?? '').toLowerCase().includes(filterPlatform.toLowerCase()))
    : orders

  return (
    <div className="flex h-full gap-5">
      {/* Left: order list */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">Order Packing</h1>
          <button
            onClick={() => loadOrders()}
            disabled={ordersLoading}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-50"
          >
            ↻ Refresh
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {IMPORT_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  filterStatus === s ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            placeholder="Filter platform…"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:border-brand-500 focus:outline-none"
          />
          <span className="ml-auto text-xs text-slate-500">{ordersTotal} total</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          {ordersLoading ? (
            <div className="flex h-32 items-center justify-center text-slate-500 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-slate-500 text-sm">No orders</div>
          ) : (
            <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Platform</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => selectOrder(order.orderNumber)}
                      className={`border-b border-slate-800/50 last:border-0 cursor-pointer transition-colors ${
                        selectedOrder?.orderNumber === order.orderNumber
                          ? 'bg-brand-600/10'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-200">{order.orderNumber}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{order.platform ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-300 max-w-[140px] truncate">{order.customerName ?? '—'}</td>
                      <td className="px-4 py-2.5"><StatusBadge value={order.importStatus} /></td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-500">{order.items.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right: order detail */}
      <div className="w-80 flex-shrink-0">
        {selectedOrder ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4 sticky top-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-sm font-semibold text-white">{selectedOrder.orderNumber}</p>
                <p className="text-xs text-slate-500">{selectedOrder.platform ?? '—'} · {selectedOrder.shop ?? '—'}</p>
              </div>
              <StatusBadge value={selectedOrder.importStatus} />
            </div>

            <div className="space-y-1 text-xs">
              <p className="text-slate-400">Customer: <span className="text-slate-200">{selectedOrder.customerName ?? '—'}</span></p>
              <p className="text-slate-400">Shipping: <span className="text-slate-200">{selectedOrder.shippingMethod ?? '—'}</span></p>
              {selectedOrder.trackingNumber && (
                <p className="text-slate-400">Tracking: <span className="text-slate-200 font-mono">{selectedOrder.trackingNumber}</span></p>
              )}
              {selectedOrder.buyerNote && (
                <p className="rounded bg-yellow-500/10 px-2 py-1 text-yellow-400 ring-1 ring-yellow-500/20">
                  Note: {selectedOrder.buyerNote}
                </p>
              )}
            </div>

            {/* Items */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-400">Items ({selectedOrder.items.length})</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="rounded bg-slate-800 px-2 py-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 truncate mr-2">{item.productName}</span>
                      <span className="text-slate-500 flex-shrink-0">×{item.qty}</span>
                    </div>
                    {item.matchConfidence && (
                      <div className="mt-0.5 flex items-center gap-1">
                        <StatusBadge value={item.matchConfidence} />
                        {item.productStock !== null && (
                          <span className={`text-[10px] ${item.productStock < item.qty ? 'text-red-400' : 'text-slate-500'}`}>
                            stock:{item.productStock}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Status actions */}
            {selectedOrder.importStatus === 'IMPORTED' && (
              <button
                onClick={() => updateStatus(selectedOrder.orderNumber, 'PACKED')}
                disabled={updatingStatus}
                className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {updatingStatus ? 'Updating…' : '✓ Mark as Packed'}
              </button>
            )}
            {selectedOrder.importStatus !== 'CANCELLED' && (
              <button
                onClick={() => updateStatus(selectedOrder.orderNumber, 'CANCELLED')}
                disabled={updatingStatus}
                className="w-full rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-600 disabled:opacity-50"
              >
                Cancel Order
              </button>
            )}
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/50">
            <p className="text-sm text-slate-500">Select an order</p>
          </div>
        )}
      </div>
    </div>
  )
}
