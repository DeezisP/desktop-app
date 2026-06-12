import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Users } from 'lucide-react'
import { analyticsApi, type OverviewStats, type TimeSeriesPoint } from '../../api/analyticsApi'
import {
  PageHeader, PeriodSelector, StatCard, SectionCard, RefreshButton,
  fmtNum, fmtDuration, EmptyData,
} from './shared'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg px-3 py-2 text-xs">
      <p className="text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <p className="font-semibold text-zinc-800 dark:text-zinc-100">{payload[0].value.toLocaleString()}</p>
    </div>
  )
}

export function AnalyticsVisitors() {
  const [days,    setDays]    = useState(30)
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [series,  setSeries]  = useState<TimeSeriesPoint[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, ts] = await Promise.all([
        analyticsApi.getOverview(days),
        analyticsApi.getTimeSeries('visitors', days),
      ])
      setOverview(ov)
      setSeries(ts)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const newVsReturn = overview ? [
    { name: 'New',       value: overview.newVisitors,       fill: '#3b82f6' },
    { name: 'Returning', value: overview.returningVisitors, fill: '#8b5cf6' },
  ] : []

  return (
    <div className="p-5 space-y-5 h-full overflow-y-auto">
      <PageHeader
        icon={<Users size={18} />}
        title="Visitors"
        description="Unique visitors, sessions, and retention analytics"
        right={
          <div className="flex items-center gap-2">
            <PeriodSelector value={days} onChange={setDays} />
            <RefreshButton loading={loading} onClick={load} />
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Unique Visitors"  value={loading ? '—' : fmtNum(overview?.uniqueVisitors ?? 0)}  change={overview?.visitorsChange} icon={<Users size={15} />} accent="blue"   loading={loading} />
        <StatCard label="New Visitors"     value={loading ? '—' : fmtNum(overview?.newVisitors ?? 0)}     icon={<Users size={15} />} accent="teal"   loading={loading} />
        <StatCard label="Returning"        value={loading ? '—' : fmtNum(overview?.returningVisitors ?? 0)} icon={<Users size={15} />} accent="violet" loading={loading} />
        <StatCard label="Avg Session"      value={loading ? '—' : fmtDuration(overview?.avgSessionDuration ?? 0)} icon={<Users size={15} />} accent="amber"  loading={loading} />
      </div>

      <div className="grid grid-cols-3 gap-4">

        {/* Visitors over time */}
        <div className="col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Visitors Over Time</span>
          </div>
          <div className="p-4">
            {series.length === 0 ? (
              <EmptyData icon={<Users size={28} />} message="No visitor data" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} fill="url(#visGrad)" dot={false} activeDot={{ r: 4, fill: '#8b5cf6' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* New vs Returning */}
        <SectionCard title="New vs Returning" loading={loading}>
          {newVsReturn.length === 0 ? (
            <EmptyData icon={<Users size={24} />} message="No data" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={newVsReturn} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {newVsReturn.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

      </div>
    </div>
  )
}
