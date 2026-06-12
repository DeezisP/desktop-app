import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Monitor } from 'lucide-react'
import { analyticsApi, type DeviceStats } from '../../api/analyticsApi'
import {
  PageHeader, PeriodSelector, SectionCard, TopRow, RefreshButton, EmptyData,
} from './shared'

const DEVICE_COLORS  = { desktop: '#3b82f6', mobile: '#10b981', tablet: '#f59e0b', unknown: '#6b7280' }
const BROWSER_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4']
const OS_COLORS      = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-zinc-800 dark:text-zinc-100">{payload[0].name}</p>
      <p className="text-zinc-500">{payload[0].value.toLocaleString()}</p>
    </div>
  )
}

export function AnalyticsDevices() {
  const [days,   setDays]   = useState(30)
  const [stats,  setStats]  = useState<DeviceStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await analyticsApi.getDevices(days)
      setStats(d)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const devicePie = (stats?.devices ?? []).map((d) => ({
    name:  d.label ?? 'unknown',
    value: d.count,
    fill:  DEVICE_COLORS[d.label as keyof typeof DEVICE_COLORS] ?? '#6b7280',
  }))

  const browserBar = (stats?.browsers ?? []).slice(0, 6).map((b, i) => ({
    name:  b.label ?? 'Unknown',
    value: b.count,
    fill:  BROWSER_COLORS[i % BROWSER_COLORS.length],
  }))

  return (
    <div className="p-5 space-y-5 h-full overflow-y-auto">
      <PageHeader
        icon={<Monitor size={18} />}
        title="Devices"
        description="Browser, OS, and device type breakdown"
        right={
          <div className="flex items-center gap-2">
            <PeriodSelector value={days} onChange={setDays} />
            <RefreshButton loading={loading} onClick={load} />
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">

        {/* Device type pie */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Device Type</span>
          </div>
          <div className="p-4">
            {devicePie.length === 0 ? (
              <EmptyData icon={<Monitor size={24} />} message="No device data" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={devicePie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                    {devicePie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 space-y-1.5">
              {devicePie.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                    <span className="text-zinc-600 dark:text-zinc-400 capitalize">{d.name}</span>
                  </div>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Browsers */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Browsers</span>
          </div>
          <div className="p-4">
            {browserBar.length === 0 ? (
              <EmptyData icon={<Monitor size={24} />} message="No browser data" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={browserBar} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} width={55} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {browserBar.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Operating systems */}
        <SectionCard title="Operating Systems" loading={loading}>
          {(stats?.os ?? []).length === 0 ? (
            <EmptyData icon={<Monitor size={24} />} message="No OS data" />
          ) : (
            <div className="space-y-2.5">
              {(stats?.os ?? []).slice(0, 8).map((o, i) => (
                <TopRow
                  key={o.label}
                  rank={i + 1}
                  label={o.label ?? 'Unknown'}
                  count={o.count}
                  percentage={o.percentage}
                  color={`bg-[${OS_COLORS[i % OS_COLORS.length]}]`}
                />
              ))}
            </div>
          )}
        </SectionCard>

      </div>
    </div>
  )
}
