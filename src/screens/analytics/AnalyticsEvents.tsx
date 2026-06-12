import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Zap, FileText } from 'lucide-react'
import { analyticsApi, type TopItem } from '../../api/analyticsApi'
import {
  PageHeader, PeriodSelector, SectionCard, TopRow, RefreshButton, EmptyData,
} from './shared'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

const EVENT_LABELS: Record<string, string> = {
  page_view:   'Page View',
  login:       'Login',
  logout:      'Logout',
  signup:      'Sign Up',
  purchase:    'Purchase',
  add_to_cart: 'Add to Cart',
  search:      'Search',
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg px-3 py-2 text-xs">
      <p className="text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <p className="font-semibold text-zinc-800 dark:text-zinc-100">{payload[0].value.toLocaleString()}</p>
    </div>
  )
}

export function AnalyticsEvents() {
  const [days,   setDays]   = useState(30)
  const [events, setEvents] = useState<TopItem[]>([])
  const [pages,  setPages]  = useState<TopItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ev, pg] = await Promise.all([
        analyticsApi.getEvents(days),
        analyticsApi.getTopPages(days),
      ])
      setEvents(ev)
      setPages(pg)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const chartData = events.slice(0, 8).map((e, i) => ({
    name:  EVENT_LABELS[e.label] ?? e.label,
    value: e.count,
    fill:  COLORS[i % COLORS.length],
  }))

  return (
    <div className="p-5 space-y-5 h-full overflow-y-auto">
      <PageHeader
        icon={<Zap size={18} />}
        title="Events"
        description="Custom and standard event tracking"
        right={
          <div className="flex items-center gap-2">
            <PeriodSelector value={days} onChange={setDays} />
            <RefreshButton loading={loading} onClick={load} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4">

        {/* Event bar chart */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Event Breakdown</span>
          </div>
          <div className="p-4">
            {chartData.length === 0 ? (
              <EmptyData icon={<Zap size={28} />} message="No events for this period" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Event table */}
        <SectionCard title="All Events" icon={<Zap size={14} />} loading={loading}>
          {events.length === 0 ? (
            <EmptyData icon={<Zap size={24} />} message="No events" />
          ) : (
            <div className="space-y-2.5">
              {events.map((e, i) => (
                <TopRow
                  key={e.label}
                  rank={i + 1}
                  label={EVENT_LABELS[e.label] ?? e.label}
                  count={e.count}
                  percentage={e.percentage}
                  color={`bg-[${COLORS[i % COLORS.length]}]`}
                />
              ))}
            </div>
          )}
        </SectionCard>

      </div>

      {/* Top pages */}
      <SectionCard title="Top Pages" icon={<FileText size={14} />} loading={loading}>
        {pages.length === 0 ? (
          <EmptyData icon={<FileText size={24} />} message="No page view data" />
        ) : (
          <div className="space-y-2.5">
            {pages.slice(0, 15).map((p, i) => (
              <TopRow
                key={p.label}
                rank={i + 1}
                label={p.label}
                count={p.count}
                percentage={p.percentage}
                color="bg-blue-500"
              />
            ))}
          </div>
        )}
      </SectionCard>

    </div>
  )
}
