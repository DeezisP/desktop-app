import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { DollarSign, ShoppingCart, TrendingUp } from 'lucide-react'
import { analyticsApi, type RevenueStats } from '../../api/analyticsApi'
import {
  PageHeader, PeriodSelector, StatCard, RefreshButton, EmptyData, fmtCurrency,
} from './shared'

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg px-3 py-2 text-xs">
      <p className="text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <p className="font-semibold text-zinc-800 dark:text-zinc-100">{fmtCurrency(payload[0].value)}</p>
    </div>
  )
}

export function AnalyticsRevenue() {
  const [days,   setDays]   = useState(30)
  const [stats,  setStats]  = useState<RevenueStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await analyticsApi.getRevenue(days)
      setStats(r)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const series = stats?.timeSeries ?? []
  const totalRevenue    = stats?.revenue ?? 0
  const orderCount      = stats?.orderCount ?? 0
  const avgOrderValue   = stats?.avgOrderValue ?? 0

  return (
    <div className="p-5 space-y-5 h-full overflow-y-auto">
      <PageHeader
        icon={<DollarSign size={18} />}
        title="Revenue"
        description="Sales revenue and order analytics"
        right={
          <div className="flex items-center gap-2">
            <PeriodSelector value={days} onChange={setDays} />
            <RefreshButton loading={loading} onClick={load} />
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Total Revenue"
          value={loading ? '—' : fmtCurrency(totalRevenue)}
          change={stats?.revenueChange}
          icon={<DollarSign size={15} />}
          accent="green"
          loading={loading}
        />
        <StatCard
          label="Orders"
          value={loading ? '—' : orderCount.toLocaleString()}
          icon={<ShoppingCart size={15} />}
          accent="blue"
          loading={loading}
        />
        <StatCard
          label="Avg Order Value"
          value={loading ? '—' : fmtCurrency(avgOrderValue)}
          icon={<TrendingUp size={15} />}
          accent="violet"
          loading={loading}
        />
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Revenue Over Time</span>
        </div>
        <div className="p-4">
          {series.length === 0 ? (
            <EmptyData icon={<DollarSign size={32} />} message="No revenue data for this period" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 20 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  tick={{ fontSize: 10, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#revGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Period comparison */}
      {stats && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Period Comparison</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">This period</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-0.5">{fmtCurrency(totalRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Previous period</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-0.5">{fmtCurrency(stats.prevRevenue)}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
