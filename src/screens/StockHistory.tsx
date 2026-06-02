import { useEffect, useState } from 'react'
import { productsApi } from '../api/warehouse'
import type { WarehouseProductResponse } from '../types/warehouse'

type SortKey = 'title' | 'stock' | 'availableStock' | 'updatedAt'
type SortDir = 'asc' | 'desc'

export function StockHistory() {
  const [products, setProducts]   = useState<WarehouseProductResponse[]>([])
  const [loading, setLoading]     = useState(false)
  const [filter, setFilter]       = useState('')
  const [sortKey, setSortKey]     = useState<SortKey>('updatedAt')
  const [sortDir, setSortDir]     = useState<SortDir>('desc')
  const [showLow, setShowLow]     = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const all = await productsApi.listAll()
      setProducts(all)
    } finally {
      setLoading(false)
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-slate-700 ml-1">↕</span>
    return <span className="text-brand-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const filtered = products
    .filter((p) => {
      if (filter && !p.title.toLowerCase().includes(filter.toLowerCase())) return false
      if (showLow && p.availableStock > 5) return false
      return true
    })
    .sort((a, b) => {
      let av: string | number = 0
      let bv: string | number = 0
      if (sortKey === 'title') {
        av = a.title.toLowerCase()
        bv = b.title.toLowerCase()
      } else if (sortKey === 'updatedAt') {
        av = a.updatedAt ?? a.createdAt
        bv = b.updatedAt ?? b.createdAt
      } else {
        av = a[sortKey] as number
        bv = b[sortKey] as number
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const lowStockCount = products.filter((p) => p.availableStock <= 5).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Stock History</h1>
        <div className="flex items-center gap-3">
          {lowStockCount > 0 && (
            <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs text-red-400 ring-1 ring-red-500/30">
              {lowStockCount} low stock
            </span>
          )}
          <button
            onClick={loadAll}
            disabled={loading}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-50"
          >
            ↻ Reload
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter products…"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={showLow}
            onChange={(e) => setShowLow(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 accent-brand-600"
          />
          Low stock only (≤5)
        </label>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-slate-500 text-sm">Loading…</div>
        ) : (
          <>
            <div className="border-b border-slate-800 px-4 py-2">
              <p className="text-xs text-slate-500">{filtered.length} of {products.length} products</p>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-240px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-300 select-none"
                      onClick={() => toggleSort('title')}
                    >
                      Product <SortArrow col="title" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-300 select-none"
                      onClick={() => toggleSort('stock')}
                    >
                      Total <SortArrow col="stock" />
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Reserved</th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-300 select-none"
                      onClick={() => toggleSort('availableStock')}
                    >
                      Available <SortArrow col="availableStock" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Checked</th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-300 select-none"
                      onClick={() => toggleSort('updatedAt')}
                    >
                      Last Updated <SortArrow col="updatedAt" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isLow = p.availableStock <= 0
                    const isWarn = p.availableStock > 0 && p.availableStock <= 5
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-800/50 last:border-0 ${
                          isLow ? 'bg-red-500/5' : isWarn ? 'bg-yellow-500/5' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <p className="text-sm text-slate-200 leading-tight">{p.title}</p>
                          <p className="text-xs text-slate-600 font-mono">id:{p.id}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-300">{p.stock}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-500">{p.reservedStock}</td>
                        <td className={`px-4 py-2.5 text-right font-mono text-sm font-semibold ${
                          isLow ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {p.availableStock}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs">
                          {p.stockChecked
                            ? <span className="text-green-400">✓</span>
                            : <span className="text-slate-700">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-slate-500">
                          {p.updatedAt
                            ? new Date(p.updatedAt).toLocaleString()
                            : new Date(p.createdAt).toLocaleString()
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
