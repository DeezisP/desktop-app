import { useState, useCallback } from 'react'
import { scanApi } from '../api/warehouse'
import { BarcodeInput } from '../components/BarcodeInput'
import { StatusBadge } from '../components/StatusBadge'
import { sounds } from '../service/sounds'
import type { ScanQueueResponse } from '../types/warehouse'

export function ScanPack() {
  const [scanning, setScanning]   = useState(false)
  const [lastScan, setLastScan]   = useState<ScanQueueResponse | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  const handleScan = useCallback(async (barcode: string) => {
    if (scanning) return
    setScanError(null)
    setScanning(true)
    try {
      const result = await scanApi.scan(barcode)
      setLastScan(result)
      sounds.scanSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setScanError(msg ?? 'Scan failed — order not found or already packed')
      sounds.scanError()
    } finally {
      setScanning(false)
    }
  }, [scanning])

  return (
    <div className="flex h-full items-start justify-center pt-8">
      <div className="w-96 space-y-4">
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

        {lastScan && (
          <div className="rounded-xl border border-brand-600/40 bg-slate-900 p-4 space-y-3">
            <p className="text-xs font-medium text-brand-400">Last Scan</p>
            <p className="font-mono text-sm text-white">{lastScan.orderNumber}</p>
            {lastScan.order && (
              <div className="space-y-1">
                <p className="text-xs text-slate-400">
                  Customer: <span className="text-slate-200">{lastScan.order.customerName ?? '—'}</span>
                </p>
                <p className="text-xs text-slate-400">
                  Items: <span className="text-slate-200">{lastScan.order.items.length}</span>
                </p>
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
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
          </div>
        )}
      </div>
    </div>
  )
}
