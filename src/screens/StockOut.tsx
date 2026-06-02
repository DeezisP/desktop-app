import { useState, useCallback } from 'react'
import { productsApi } from '../api/warehouse'
import { BarcodeInput } from '../components/BarcodeInput'
import type { WarehouseProductResponse } from '../types/warehouse'

export function StockOut() {
  const [product, setProduct]   = useState<WarehouseProductResponse | null>(null)
  const [query, setQuery]       = useState('')
  const [delta, setDelta]       = useState(1)
  const [reason, setReason]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [searching, setSearching] = useState(false)
  const [success, setSuccess]   = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  const lookupByBarcode = useCallback(async (barcode: string) => {
    setSearching(true)
    setSuccess(null)
    setError(null)
    setProduct(null)
    try {
      const results = await productsApi.search(barcode)
      if (results.length > 0) {
        setProduct(results[0])
      } else {
        setError(`No product found for: ${barcode}`)
      }
    } catch {
      setError('Search failed')
    } finally {
      setSearching(false)
    }
  }, [])

  const searchManual = useCallback(async () => {
    if (!query.trim()) return
    await lookupByBarcode(query.trim())
  }, [query, lookupByBarcode])

  const handleAdjust = useCallback(async () => {
    if (!product || delta <= 0) return
    if (product.availableStock < delta) {
      setError(`Insufficient stock. Available: ${product.availableStock}`)
      return
    }
    setLoading(true)
    setSuccess(null)
    setError(null)
    try {
      const updated = await productsApi.adjustStock(product.id, -delta, reason || `Stock Out -${delta}`)
      setProduct(updated)
      setSuccess(`Removed ${delta} units. New stock: ${updated.stock}`)
      setDelta(1)
      setReason('')
    } catch {
      setError('Failed to adjust stock')
    } finally {
      setLoading(false)
    }
  }, [product, delta, reason])

  const stockWarning = product && product.availableStock < delta

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-lg font-semibold text-white">Stock Out</h1>

      {/* Barcode scanner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <p className="text-xs font-medium text-slate-400">Scan or Search Product</p>
        <BarcodeInput onScan={lookupByBarcode} disabled={searching} placeholder="Scan product barcode…" />
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchManual()}
            placeholder="Or type product name…"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
          <button
            onClick={searchManual}
            disabled={searching}
            className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-50"
          >
            {searching ? '…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Product card */}
      {product && (
        <div className="rounded-xl border border-orange-500/40 bg-slate-900 p-4 space-y-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Product</p>
            <p className="text-sm font-medium text-slate-100">{product.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              Current stock: <span className="text-slate-300 font-mono">{product.stock}</span> &nbsp;|&nbsp;
              Available: <span className={`font-mono ${product.availableStock <= 0 ? 'text-red-400' : product.availableStock <= 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                {product.availableStock}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Quantity to remove</label>
              <input
                type="number"
                min={1}
                value={delta}
                onChange={(e) => setDelta(Math.max(1, parseInt(e.target.value) || 1))}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-100 bg-slate-800 focus:outline-none focus:ring-2 ${
                  stockWarning
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/40'
                    : 'border-slate-700 focus:border-brand-500 focus:ring-brand-500/40'
                }`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Damaged / Manual"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>
          </div>

          {stockWarning && (
            <p className="rounded-lg bg-orange-500/10 px-3 py-2 text-xs text-orange-400 ring-1 ring-orange-500/30">
              Warning: removing {delta} exceeds available stock ({product.availableStock})
            </p>
          )}

          {success && (
            <p className="rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-400 ring-1 ring-green-500/30">
              {success}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 ring-1 ring-red-500/30">
              {error}
            </p>
          )}

          <button
            onClick={handleAdjust}
            disabled={loading || delta <= 0}
            className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? 'Removing…' : `- Remove ${delta} Unit${delta !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {!product && !searching && (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/50">
          <p className="text-sm text-slate-500">Scan a barcode or search for a product</p>
        </div>
      )}
    </div>
  )
}
