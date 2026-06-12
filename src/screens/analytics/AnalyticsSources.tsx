import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Share2, Link } from 'lucide-react'
import { analyticsApi, type TopItem } from '../../api/analyticsApi'
import {
  PageHeader, PeriodSelector, SectionCard, TopRow, RefreshButton,
  EmptyData,
} from './shared'

const SOURCE_COLORS: Record<string, string> = {
  google:     '#4285f4',
  direct:     '#6b7280',
  facebook:   '#1877f2',
  instagram:  '#e1306c',
  x:          '#000000',
  twitter:    '#1da1f2',
  linkedin:   '#0a66c2',
  reddit:     '#ff4500',
  bing:       '#008373',
  yahoo:      '#6001d2',
  duckduckgo: '#de5833',
  line:       '#00b900',
  referral:   '#f59e0b',
}

const BAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

function sourceColor(label: string, i: number) {
  const l = label?.toLowerCase()
  return SOURCE_COLORS[l] ?? BAR_COLORS[i % BAR_COLORS.length]
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-zinc-800 dark:text-zinc-100">{payload[0].name}</p>
      <p className="text-zinc-500">{payload[0].value.toLocaleString()} events</p>
    </div>
  )
}

export function AnalyticsSources() {
  const [days,      setDays]      = useState(30)
  const [sources,   setSources]   = useState<TopItem[]>([])
  const [referrers, setReferrers] = useState<TopItem[]>([])
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r] = await Promise.all([
        analyticsApi.getSources(days),
        analyticsApi.getReferrers(days),
      ])
      setSources(s)
      setReferrers(r)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const pieData = sources.slice(0, 6).map((s, i) => ({
    name:  s.label ?? 'unknown',
    value: s.count,
    fill:  sourceColor(s.label, i),
  }))

  return (
    <div className="p-5 space-y-5 h-full overflow-y-auto">
      <PageHeader
        icon={<Share2 size={18} />}
        title="Traffic Sources"
        description="Where your visitors are coming from"
        right={
          <div className="flex items-center gap-2">
            <PeriodSelector value={days} onChange={setDays} />
            <RefreshButton loading={loading} onClick={load} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4">

        {/* Pie chart */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Source Breakdown</span>
          </div>
          <div className="p-4">
            {sources.length === 0 ? (
              <EmptyData icon={<Share2 size={28} />} message="No source data" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    formatter={(v) => <span style={{ fontSize: 11, color: '#a1a1aa' }}>{v}</span>}
                    iconSize={8}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top sources table */}
        <SectionCard title="Top Sources" icon={<Share2 size={14} />} loading={loading}>
          {sources.length === 0 ? (
            <EmptyData icon={<Share2 size={24} />} message="No data for this period" />
          ) : (
            <div className="space-y-2.5">
              {sources.slice(0, 10).map((s, i) => (
                <TopRow
                  key={s.label}
                  rank={i + 1}
                  label={s.label ?? 'unknown'}
                  count={s.count}
                  percentage={s.percentage}
                  color={`bg-[${sourceColor(s.label, i)}]`}
                />
              ))}
            </div>
          )}
        </SectionCard>

      </div>

      {/* Top referrers */}
      <SectionCard title="Top Referrers" icon={<Link size={14} />} loading={loading}>
        {referrers.length === 0 ? (
          <EmptyData icon={<Link size={24} />} message="No referrer data" />
        ) : (
          <div className="space-y-2.5">
            {referrers.slice(0, 10).map((r, i) => (
              <TopRow
                key={r.label}
                rank={i + 1}
                label={r.label}
                count={r.count}
                percentage={r.percentage}
                color="bg-blue-500"
              />
            ))}
          </div>
        )}
      </SectionCard>

    </div>
  )
}
