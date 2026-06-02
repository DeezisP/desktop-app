import { useState, useCallback, useRef } from 'react'
import { productsApi } from '../api/warehouse'
import { StatusBadge } from '../components/StatusBadge'
import type { WarehouseProductResponse } from '../types/warehouse'

export function ProductLookup() {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<WarehouseProductResponse[]>([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    try {
      const data = await productsApi.search(q.trim())
      setResults(data)
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(v: string) {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 300)
  }

  function stockColor(avail: number) {
    if (avail <= 0) return 'text-red-400'
    if (avail <= 5) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-white">Product Lookup</h1>

      {/* Search */}
      <div className="flex gap-3">
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search by product name or SKU…"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <button
          onClick={() => search(query)}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Search'}
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          {results.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-slate-500 text-sm">No products found</div>
          ) : (
            <>
              <div className="border-b border-slate-800 px-4 py-2">
                <p className="text-xs text-slate-500">{results.length} result{results.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-260px)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Product</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Stock</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Reserved</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Available</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Checked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((p) => (
                      <tr key={p.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-200 leading-tight">{p.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">ID: {p.id}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">{p.stock}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-500">{p.reservedStock}</td>
                        <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${stockColor(p.availableStock)}`}>
                          {p.availableStock}
                        </td>
                        <td className="px-4 py-3">
                          {p.stockChecked ? (
                            <span className="text-green-400 text-xs">✓ Yes</span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {!searched && !loading && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
          <p className="text-sm text-slate-500">Enter a search term to find products</p>
        </div>
      )}
    </div>
  )
}
