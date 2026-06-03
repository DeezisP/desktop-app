import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { productsApi } from '../api/warehouse'
import type { WarehouseProductResponse } from '../types/warehouse'

interface CountRow {
  product: WarehouseProductResponse
  counted: number | ''
  status: 'idle' | 'saving' | 'saved' | 'error'
}

export function StockCount() {
  const [rows, setRows]       = useState<CountRow[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter]             = useState('')
  const [debouncedFilter, setDebouncedFilter] = useState('')
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    setLoading(true)
    try {
      const all = await productsApi.listAll()
      setRows(all.map((p) => ({ product: p, counted: '', status: 'idle' })))
    } finally {
      setLoading(false)
    }
  }

  async function syncFromWordPress() {
    setSyncing(true)
    try {
      await productsApi.sync()
      await loadProducts()
    } finally {
      setSyncing(false)
    }
  }

  const saveRow = useCallback(async (index: number) => {
    const row = rows[index]
    if (row.counted === '' || row.status === 'saving') return

    const delta = (row.counted as number) - row.product.stock
    if (delta === 0) return

    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, status: 'saving' } : r)),
    )

    try {
      const updated = await productsApi.adjustStock(
        row.product.id,
        delta,
        `Stock Count: set to ${row.counted}`,
      )
      setRows((prev) =>
        prev.map((r, i) =>
          i === index ? { ...r, product: updated, counted: '', status: 'saved' } : r,
        ),
      )
    } catch {
      setRows((prev) =>
        prev.map((r, i) => (i === index ? { ...r, status: 'error' } : r)),
      )
    }
  }, [rows])

  const filtered = useMemo(
    () => rows.filter((r) =>
      !debouncedFilter || r.product.title.toLowerCase().includes(debouncedFilter.toLowerCase()),
    ),
    [rows, debouncedFilter],
  )

  const dirtyCount = useMemo(() => rows.filter((r) => r.counted !== '').length, [rows])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Stock Count</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{dirtyCount} pending</span>
          <button
            onClick={syncFromWordPress}
            disabled={syncing}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : '↺ Sync from WP'}
          </button>
          <button
            onClick={loadProducts}
            disabled={loading}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            ↻ Reload
          </button>
        </div>
      </div>

      <input
        type="text"
        value={filter}
        onChange={(e) => {
          const v = e.target.value;
          setFilter(v);
          if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
          filterTimerRef.current = setTimeout(() => setDebouncedFilter(v), 250);
        }}
        placeholder="Filter products…"
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
      />

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-slate-500 text-sm">Loading products…</div>
        ) : (
          <div className="overflow-y-auto max-h-[calc(100vh-240px)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Current</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Available</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Count</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Delta</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const delta = row.counted !== '' ? (row.counted as number) - row.product.stock : null
                  return (
                    <tr
                      key={row.product.id}
                      className={`border-b border-slate-800/50 last:border-0 ${
                        row.status === 'saved' ? 'bg-green-500/5' :
                        row.status === 'error' ? 'bg-red-500/5' : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <p className="text-sm text-slate-200 leading-tight">{row.product.title}</p>
                        <p className="text-xs text-slate-600 font-mono">id:{row.product.id}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-300">
                        {row.product.stock}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-400">
                        {row.product.availableStock}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          value={row.counted}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? { ...r, counted: e.target.value === '' ? '' : parseInt(e.target.value) || 0, status: 'idle' }
                                  : r,
                              ),
                            )
                          }
                          onKeyDown={(e) => e.key === 'Enter' && saveRow(idx)}
                          className="w-20 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-center text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {delta !== null ? (
                          <span className={`text-sm font-mono font-semibold ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {row.status === 'saved' ? (
                          <span className="text-xs text-green-400">✓ Saved</span>
                        ) : row.status === 'error' ? (
                          <span className="text-xs text-red-400">Error</span>
                        ) : (
                          <button
                            onClick={() => saveRow(idx)}
                            disabled={row.counted === '' || delta === 0 || row.status === 'saving'}
                            className="rounded bg-brand-600/20 px-2 py-1 text-xs text-brand-400 hover:bg-brand-600/30 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {row.status === 'saving' ? '…' : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
