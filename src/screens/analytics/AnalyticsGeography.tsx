import { useEffect, useState, useCallback } from 'react'
import { Globe } from 'lucide-react'
import { analyticsApi, type TopItem } from '../../api/analyticsApi'
import {
  PageHeader, PeriodSelector, SectionCard, TopRow, RefreshButton, EmptyData,
} from './shared'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b']

export function AnalyticsGeography() {
  const [days,      setDays]    = useState(30)
  const [countries, setCountries] = useState<TopItem[]>([])
  const [loading,   setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const c = await analyticsApi.getGeography(days)
      setCountries(c)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const total = countries.reduce((s, c) => s + c.count, 0)

  return (
    <div className="p-5 space-y-5 h-full overflow-y-auto">
      <PageHeader
        icon={<Globe size={18} />}
        title="Geography"
        description="Visitor distribution by country"
        right={
          <div className="flex items-center gap-2">
            <PeriodSelector value={days} onChange={setDays} />
            <RefreshButton loading={loading} onClick={load} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4">

        {/* Top countries */}
        <SectionCard title="Top Countries" icon={<Globe size={14} />} loading={loading}>
          {countries.length === 0 ? (
            <EmptyData icon={<Globe size={28} />} message="No geography data" />
          ) : (
            <div className="space-y-2.5">
              {countries.slice(0, 15).map((c, i) => (
                <TopRow
                  key={c.label}
                  rank={i + 1}
                  label={c.label ?? 'Unknown'}
                  count={c.count}
                  percentage={c.percentage}
                  color={`bg-[${COLORS[i % COLORS.length]}]`}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Summary card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Geography Summary</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-3">
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">{countries.length}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Countries</p>
              </div>
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-3">
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">{total.toLocaleString()}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Total Events</p>
              </div>
            </div>

            {countries.slice(0, 5).map((c, i) => (
              <div key={c.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300">{c.label ?? 'Unknown'}</span>
                </div>
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 tabular-nums">
                  {c.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
