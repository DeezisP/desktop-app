import { useState, useMemo, useEffect, type FormEvent } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import WarehouseService, { type StockLogEntry } from '../service/WarehouseService'

const TODAY_STR = new Date().toISOString().slice(0, 10)

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function StockHistory() {
  const [logs, setLogs]           = useState<StockLogEntry[]>([])
  const [loading, setLoading]     = useState(false)
  const [dateFilter, setDateFilter] = useState(TODAY_STR)
  const [query, setQuery]           = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [onlyChanges, setOnlyChanges]   = useState<'all' | 'in' | 'out'>('all')

  async function loadLogs(date: string) {
    setLoading(true)
    try {
      const res = await WarehouseService.getStockLogs(date)
      setLogs(res.data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLogs(dateFilter) }, [])

  function handleSearch(e?: FormEvent) {
    e?.preventDefault()
    setAppliedQuery(query)
  }

  function handleDateChange(d: string) {
    setDateFilter(d)
    loadLogs(d)
  }

  const filtered = useMemo(() =>
    logs.filter(l => {
      if (appliedQuery && !l.productTitle.toLowerCase().includes(appliedQuery.toLowerCase())) return false
      if (onlyChanges === 'in'  && l.changeAmount <= 0) return false
      if (onlyChanges === 'out' && l.changeAmount >= 0) return false
      return true
    }),
  [logs, appliedQuery, onlyChanges])

  const totalIn  = useMemo(() => logs.filter(l => l.changeAmount > 0).reduce((s, l) => s + l.changeAmount, 0), [logs])
  const totalOut = useMemo(() => logs.filter(l => l.changeAmount < 0).reduce((s, l) => s + l.changeAmount, 0), [logs])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">ประวัติสต็อก</h1>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-700">
                +{totalIn} รับเข้า
              </span>
              <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-700">
                {totalOut} ตัดออก
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date picker */}
        <input
          type="date"
          value={dateFilter}
          max={TODAY_STR}
          onChange={e => handleDateChange(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />

        {/* Quick: today */}
        {dateFilter !== TODAY_STR && (
          <button
            onClick={() => handleDateChange(TODAY_STR)}
            className="px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-colors">
            วันนี้
          </button>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-1 flex-1 min-w-[180px]">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="กรองชื่อสินค้า..."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 pl-8 pr-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <button type="submit" className="px-3 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            ค้นหา
          </button>
        </form>

        {/* In/Out filter */}
        <div className="flex gap-1">
          {(['all', 'in', 'out'] as const).map(v => (
            <button
              key={v}
              onClick={() => setOnlyChanges(v)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                onlyChanges === v
                  ? v === 'in'  ? 'bg-green-600 text-white border-green-600'
                  : v === 'out' ? 'bg-red-600 text-white border-red-600'
                  : 'bg-zinc-700 dark:bg-zinc-200 text-white dark:text-zinc-900 border-zinc-700 dark:border-zinc-200'
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}>
              {v === 'all' ? 'ทั้งหมด' : v === 'in' ? 'รับเข้า' : 'ตัดออก'}
            </button>
          ))}
        </div>

        <button
          onClick={() => loadLogs(dateFilter)}
          disabled={loading}
          title="รีเฟรช"
          className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-zinc-400 text-sm">กำลังโหลด…</div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-400 dark:text-zinc-500">
            <p className="text-sm font-medium">ไม่มีการเปลี่ยนแปลงสต็อกในวันนี้</p>
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-100 dark:border-zinc-800 px-4 py-2">
              <p className="text-xs text-zinc-400">{filtered.length} / {logs.length} รายการ</p>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-280px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">สินค้า</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 w-24">เปลี่ยนแปลง</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 w-20 hidden sm:table-cell">ก่อน</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 w-20">หลัง</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 hidden md:table-cell">เหตุผล / อ้างอิง</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 w-24">เวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const isIn = l.changeAmount > 0
                    return (
                      <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-2.5">
                          <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-tight">{l.productTitle}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">id:{l.productId}</p>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono text-sm font-bold ${isIn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isIn ? `+${l.changeAmount}` : l.changeAmount}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-400 hidden sm:table-cell">{l.beforeStock}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">{l.afterStock}</td>
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">{l.reason ?? '—'}</p>
                          {l.referenceId && l.referenceId !== 'MANUAL' && (
                            <p className="text-[10px] font-mono text-zinc-400">{l.referenceId}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-zinc-400 tabular-nums">{formatTime(l.createdAt)}</td>
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
