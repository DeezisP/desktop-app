import { useState, useMemo, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { productsApi } from '../api/warehouse'
import type { WarehouseProductResponse } from '../types/warehouse'

type SortKey = 'title' | 'stock' | 'availableStock' | 'updatedAt'
type SortDir = 'asc' | 'desc'

export function StockHistory() {
  const [products, setProducts] = useState<WarehouseProductResponse[]>([])
  const [loading, setLoading]   = useState(false)
  const [query, setQuery]       = useState('')
  const [searched, setSearched] = useState(false)
  const [sortKey, setSortKey]   = useState<SortKey>('updatedAt')
  const [sortDir, setSortDir]   = useState<SortDir>('desc')
  const [showLow, setShowLow]   = useState(false)

  async function handleSearch(e?: FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setSearched(true)
    try {
      const all = await productsApi.listAll()
      setProducts(all)
    } finally {
      setLoading(false)
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-zinc-300 ml-1">↕</span>
    return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const filtered = useMemo(() =>
    products
      .filter((p) => {
        if (query && !p.title.toLowerCase().includes(query.toLowerCase())) return false
        if (showLow && p.availableStock > 5) return false
        return true
      })
      .sort((a, b) => {
        let av: string | number = 0
        let bv: string | number = 0
        if (sortKey === 'title') { av = a.title.toLowerCase(); bv = b.title.toLowerCase() }
        else if (sortKey === 'updatedAt') { av = a.updatedAt ?? a.createdAt; bv = b.updatedAt ?? b.createdAt }
        else { av = a[sortKey] as number; bv = b[sortKey] as number }
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ? 1 : -1
        return 0
      }),
  [products, query, showLow, sortKey, sortDir])

  const lowStockCount = useMemo(() => products.filter((p) => p.availableStock <= 5).length, [products])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-800">ประวัติสต็อก</h1>
        {searched && lowStockCount > 0 && (
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-600 ring-1 ring-red-200">
            {lowStockCount} สต็อกต่ำ
          </span>
        )}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อสินค้า..."
            className="w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-4 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'กำลังโหลด…' : 'ค้นหา'}
        </button>
        {searched && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500 whitespace-nowrap">
            <input
              type="checkbox"
              checked={showLow}
              onChange={(e) => setShowLow(e.target.checked)}
              className="rounded border-zinc-300 accent-blue-600"
            />
            สต็อกต่ำ (≤5)
          </label>
        )}
      </form>

      {/* Empty state before first search */}
      {!searched && (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400 gap-3">
          <Search size={36} strokeWidth={1.5} />
          <p className="text-sm">กดค้นหาเพื่อโหลดข้อมูลสต็อก</p>
        </div>
      )}

      {/* Results table */}
      {searched && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-zinc-400 text-sm">กำลังโหลด…</div>
          ) : (
            <>
              <div className="border-b border-zinc-100 px-4 py-2">
                <p className="text-xs text-zinc-400">{filtered.length} / {products.length} รายการ</p>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-260px)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-700 select-none" onClick={() => toggleSort('title')}>
                        สินค้า <SortArrow col="title" />
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-700 select-none" onClick={() => toggleSort('stock')}>
                        รวม <SortArrow col="stock" />
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">จอง</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-700 select-none" onClick={() => toggleSort('availableStock')}>
                        คงเหลือ <SortArrow col="availableStock" />
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">ตรวจแล้ว</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-700 select-none" onClick={() => toggleSort('updatedAt')}>
                        อัปเดตล่าสุด <SortArrow col="updatedAt" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const isLow  = p.availableStock <= 0
                      const isWarn = p.availableStock > 0 && p.availableStock <= 5
                      return (
                        <tr key={p.id} className={`border-b border-zinc-100 last:border-0 ${isLow ? 'bg-red-50' : isWarn ? 'bg-yellow-50' : 'hover:bg-zinc-50'}`}>
                          <td className="px-4 py-2.5">
                            <p className="text-sm text-zinc-800 leading-tight">{p.title}</p>
                            <p className="text-xs text-zinc-400 font-mono">id:{p.id}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-sm text-zinc-700">{p.stock}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-sm text-zinc-400">{p.reservedStock}</td>
                          <td className={`px-4 py-2.5 text-right font-mono text-sm font-semibold ${isLow ? 'text-red-600' : isWarn ? 'text-amber-600' : 'text-green-600'}`}>
                            {p.availableStock}
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs">
                            {p.stockChecked ? <span className="text-green-500">✓</span> : <span className="text-zinc-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-zinc-400">
                            {new Date(p.updatedAt ?? p.createdAt).toLocaleString('th-TH')}
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
      )}
    </div>
  )
}
