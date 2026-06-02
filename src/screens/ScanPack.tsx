import { useEffect, useState, useCallback } from 'react'
import { useWarehouseStore } from '../store/warehouseStore'
import { scanApi } from '../api/warehouse'
import { BarcodeInput } from '../components/BarcodeInput'
import { StatusBadge } from '../components/StatusBadge'
import type { ScanQueueResponse } from '../types/warehouse'

export function ScanPack() {
  const queue        = useWarehouseStore((s) => s.queue)
  const queueLoading = useWarehouseStore((s) => s.queueLoading)
  const loadQueue    = useWarehouseStore((s) => s.loadQueue)

  const [scanning, setScanning]       = useState(false)
  const [confirming, setConfirming]   = useState<number | null>(null)
  const [lastScan, setLastScan]       = useState<ScanQueueResponse | null>(null)
  const [scanError, setScanError]     = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const handleScan = useCallback(async (barcode: string) => {
    if (scanning) return
    setScanError(null)
    setScanning(true)
    try {
      const result = await scanApi.scan(barcode)
      setLastScan(result)
      await loadQueue()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setScanError(msg ?? 'Scan failed — order not found or already packed')
    } finally {
      setScanning(false)
    }
  }, [scanning, loadQueue])

  const handleConfirm = useCallback(async (queueId: number) => {
    setConfirming(queueId)
    try {
      await scanApi.confirmPack(queueId)
      setLastScan(null)
      await loadQueue()
    } catch {
      // queue will update via STOMP
    } finally {
      setConfirming(null)
    }
  }, [loadQueue])

  const handleDelete = useCallback(async (queueId: number) => {
    await scanApi.deleteQueue(queueId)
    await loadQueue()
  }, [loadQueue])

  const filtered = filterStatus === 'ALL'
    ? queue
    : queue.filter((q) => q.status === filterStatus)

  return (
    <div className="flex h-full gap-6">
      {/* Left: scanner panel */}
      <div className="w-80 flex-shrink-0 space-y-4">
        <h1 className="text-lg font-semibold text-white">Scan & Pack</h1>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <p className="text-xs font-medium text-slate-400">Barcode Scanner</p>
          <BarcodeInput onScan={handleScan} disabled={scanning} />
          {scanning && (
            <p className="text-xs text-brand-400 animate-pulse">Scanning…</p>
          )}
          {scanError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 ring-1 ring-red-500/30">
              {scanError}
            </p>
          )}
        </div>

        {/* Last scan result */}
        {lastScan && (
          <div className="rounded-xl border border-brand-600/40 bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-brand-400">Last Scan</p>
              <StatusBadge value={lastScan.status} />
            </div>
            <p className="font-mono text-sm text-white">{lastScan.orderNumber}</p>
            {lastScan.order && (
              <div className="space-y-1">
                <p className="text-xs text-slate-400">
                  Customer: <span className="text-slate-200">{lastScan.order.customerName ?? '—'}</span>
                </p>
                <p className="text-xs text-slate-400">
                  Items: <span className="text-slate-200">{lastScan.order.items.length}</span>
                </p>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {lastScan.order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded bg-slate-800 px-2 py-1">
                      <span className="text-xs text-slate-300 truncate mr-2">{item.productName}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-500">×{item.qty}</span>
                        <StatusBadge value={item.matchConfidence} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lastScan.status === 'WAITING' && (
              <button
                onClick={() => handleConfirm(lastScan.id)}
                disabled={confirming === lastScan.id}
                className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {confirming === lastScan.id ? 'Confirming…' : '✓ Confirm Packed'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: queue table */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</p>
          <div className="flex items-center gap-2">
            {['ALL', 'WAITING', 'PACKING', 'DONE', 'ERROR'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  filterStatus === s
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => loadQueue()}
              disabled={queueLoading}
              className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-50"
            >
              ↻
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          {queueLoading ? (
            <div className="flex h-32 items-center justify-center text-slate-500 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-slate-500 text-sm">
              No items {filterStatus !== 'ALL' ? `with status ${filterStatus}` : 'in queue'}
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Station</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Scanned</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-xs text-slate-200">{item.orderNumber}</td>
                      <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
                      <td className="px-4 py-3 text-xs text-slate-400">{item.stationId ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(item.scannedAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {item.order?.items.length ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.status === 'WAITING' && (
                            <button
                              onClick={() => handleConfirm(item.id)}
                              disabled={confirming === item.id}
                              className="rounded bg-green-600/20 px-2 py-1 text-xs text-green-400 hover:bg-green-600/30 disabled:opacity-50"
                            >
                              {confirming === item.id ? '…' : 'Confirm'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="rounded bg-red-600/10 px-2 py-1 text-xs text-red-400 hover:bg-red-600/20"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
