import { useEffect, useState } from 'react'
import { ordersApi } from '../api/warehouse'
import { useWarehouseStore } from '../store/warehouseStore'
import type { OrderImportDto, ImportResultResponse } from '../types/warehouse'

const JSON_PLACEHOLDER = `[
  {
    "order_no": "ORD-001",
    "tracking_no": "TH123456789",
    "platform": "Shopee",
    "shop": "My Shop",
    "customer_name": "John Doe",
    "status": "READY_TO_SHIP",
    "shipping_method": "Standard",
    "created_at": "2024-01-01T10:00:00",
    "phone": "0812345678",
    "address": "123 Main St",
    "province": "Bangkok",
    "buyer_note": "",
    "items": [
      {
        "sku": "SKU-001",
        "product_name": "Product Name",
        "variant": "Size M",
        "qty": 2,
        "price": 299.00
      }
    ]
  }
]`

export function OrderImport() {
  const importHistory  = useWarehouseStore((s) => s.importHistory)
  const loadHistory    = useWarehouseStore((s) => s.loadImportHistory)

  const [jsonText, setJsonText]       = useState('')
  const [platform, setPlatform]       = useState('Shopee')
  const [importing, setImporting]     = useState(false)
  const [result, setResult]           = useState<ImportResultResponse | null>(null)
  const [parseError, setParseError]   = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  function validateJson(): OrderImportDto[] | null {
    setParseError(null)
    try {
      const parsed = JSON.parse(jsonText)
      if (!Array.isArray(parsed)) {
        setParseError('JSON must be an array of orders')
        return null
      }
      return parsed as OrderImportDto[]
    } catch (e: unknown) {
      setParseError(`Invalid JSON: ${(e as Error).message}`)
      return null
    }
  }

  async function handleImport() {
    const orders = validateJson()
    if (!orders) return
    setImporting(true)
    setResult(null)
    setImportError(null)
    try {
      const res = await ordersApi.importOrders(orders, platform)
      setResult(res)
      setJsonText('')
      await loadHistory()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setImportError(msg ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex h-full gap-6">
      {/* Left: import form */}
      <div className="flex-1 space-y-4">
        <h1 className="text-lg font-semibold text-white">Order Import</h1>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500">Platform:</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-brand-500 focus:outline-none"
          >
            {['Shopee', 'Lazada', 'TikTok', 'LINE', 'MANUAL', 'WooCommerce'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400">Order JSON</label>
            <button
              onClick={() => setJsonText(JSON_PLACEHOLDER)}
              className="text-xs text-brand-400 hover:text-brand-300"
            >
              Load example
            </button>
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setParseError(null) }}
            rows={18}
            spellCheck={false}
            placeholder={JSON_PLACEHOLDER}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs text-slate-200 placeholder-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
          />
        </div>

        {parseError && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 ring-1 ring-red-500/30">
            {parseError}
          </p>
        )}
        {importError && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 ring-1 ring-red-500/30">
            {importError}
          </p>
        )}
        {result && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
            <p className="text-sm font-medium text-green-400">Import Complete</p>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-white">{result.newCount}</p>
                <p className="text-xs text-slate-500">New</p>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-400">{result.skippedCount}</p>
                <p className="text-xs text-slate-500">Skipped</p>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-300">{result.tried}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => validateJson()}
            disabled={!jsonText.trim()}
            className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            Validate JSON
          </button>
          <button
            onClick={handleImport}
            disabled={importing || !jsonText.trim()}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {importing ? 'Importing…' : `Import Orders (${platform})`}
          </button>
        </div>
      </div>

      {/* Right: import history */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-400">Import History</h2>
          <button
            onClick={loadHistory}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            ↻
          </button>
        </div>
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-180px)]">
          {importHistory.length === 0 ? (
            <p className="text-xs text-slate-600">No history yet</p>
          ) : (
            importHistory.map((h) => (
              <div key={h.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">{h.platform}</span>
                  <span className="text-[10px] text-slate-600">
                    {new Date(h.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1.5 flex gap-3 text-[11px]">
                  <span className="text-green-400">+{h.newCount} new</span>
                  <span className="text-slate-500">{h.skippedCount} skipped</span>
                  <span className="text-slate-600">{h.tried} tried</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
