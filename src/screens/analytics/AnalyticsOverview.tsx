import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  BarChart2, Users, Eye, MousePointer, Clock, Percent,
  RefreshCw,
} from 'lucide-react'
import { analyticsApi, type OverviewStats, type TimeSeriesPoint } from '../../api/analyticsApi'
import {
  PageHeader, PeriodSelector, StatCard, SectionCard, TopRow, RefreshButton,
  fmtNum, fmtDuration, EmptyData,
} from './shared'

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg px-3 py-2 text-xs">
      <p className="text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <p className="font-semibold text-zinc-800 dark:text-zinc-100">{payload[0].value.toLocaleString()}</p>
    </div>
  )
}

// ── Metric tab selector ───────────────────────────────────────────────────────

const METRICS = [
  { label: 'Page Views', key: 'pageviews' as const },
  { label: 'Sessions',   key: 'sessions'  as const },
  { label: 'Visitors',   key: 'visitors'  as const },
]

// ── Main component ────────────────────────────────────────────────────────────

export function AnalyticsOverview() {
  const [days,        setDays]        = useState(30)
  const [overview,    setOverview]    = useState<OverviewStats | null>(null)
  const [series,      setSeries]      = useState<TimeSeriesPoint[]>([])
  const [metric,      setMetric]      = useState<'pageviews' | 'sessions' | 'visitors'>('pageviews')
  const [loading,     setLoading]     = useState(true)
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, ts] = await Promise.all([
        analyticsApi.getOverview(days),
        analyticsApi.getTimeSeries(metric, days),
      ])
      setOverview(ov)
      setSeries(ts)
    } catch (e) {
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }, [days, metric])

  useEffect(() => { loadAll() }, [loadAll])

  const loadSeries = useCallback(async (m: typeof metric) => {
    setSeriesLoading(true)
    try {
      const ts = await analyticsApi.getTimeSeries(m, days)
      setSeries(ts)
    } finally {
      setSeriesLoading(false)
    }
  }, [days])

  const handleMetric = (m: typeof metric) => {
    setMetric(m)
    loadSeries(m)
  }

  const formatDate = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="p-5 space-y-5 h-full overflow-y-auto">

      <PageHeader
        icon={<BarChart2 size={18} />}
        title="Analytics Overview"
        description="Website traffic, sessions, and visitor insights"
        right={
          <div className="flex items-center gap-2">
            <PeriodSelector value={days} onChange={setDays} />
            <RefreshButton loading={loading} onClick={loadAll} />
          </div>
        }
      />

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-6 gap-3">
        <StatCard
          label="Page Views"
          value={loading ? '—' : fmtNum(overview?.pageViews ?? 0)}
          change={overview?.pageViewsChange}
          icon={<Eye size={15} />}
          accent="blue"
          loading={loading}
        />
        <StatCard
          label="Sessions"
          value={loading ? '—' : fmtNum(overview?.sessions ?? 0)}
          icon={<MousePointer size={15} />}
          accent="violet"
          loading={loading}
        />
        <StatCard
          label="Unique Visitors"
          value={loading ? '—' : fmtNum(overview?.uniqueVisitors ?? 0)}
          change={overview?.visitorsChange}
          icon={<Users size={15} />}
          accent="teal"
          loading={loading}
        />
        <StatCard
          label="Returning"
          value={loading ? '—' : fmtNum(overview?.returningVisitors ?? 0)}
          subLabel="returning visitors"
          icon={<Users size={15} />}
          accent="green"
          loading={loading}
        />
        <StatCard
          label="Bounce Rate"
          value={loading ? '—' : `${overview?.bounceRate ?? 0}%`}
          icon={<Percent size={15} />}
          accent="amber"
          loading={loading}
        />
        <StatCard
          label="Avg Session"
          value={loading ? '—' : fmtDuration(overview?.avgSessionDuration ?? 0)}
          icon={<Clock size={15} />}
          accent="rose"
          loading={loading}
        />
      </div>

      {/* Time Series Chart */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
          <div className="flex gap-1">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => handleMetric(m.key)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                  metric === m.key
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {seriesLoading && (
            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
              <RefreshCw size={10} className="animate-spin" /> Loading
            </span>
          )}
        </div>
        <div className="p-4">
          {series.length === 0 ? (
            <EmptyData icon={<BarChart2 size={32} />} message="No data for this period" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-ring-color, #e4e4e7)" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 10, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={fmtNum}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#grad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#3b82f6' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </div>
  )
}
