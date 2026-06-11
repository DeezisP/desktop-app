import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { analyticsApi, type DateRange } from '../../api/analyticsApi'
import { SectionHeader } from './components/SectionHeader'

const DEVICE_COLORS = ['#2563eb', '#10b981', '#f59e0b']
const BROWSER_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280']

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

type NameCount = { name: string; count: number }

interface DonutProps {
  data: NameCount[]
  colors: string[]
  label: string
}

function DonutChart({ data, colors, label }: DonutProps) {
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
      <SectionHeader title={label} />
      {data.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-400">ยังไม่มีข้อมูล</div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%"
                innerRadius={55} outerRadius={85} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip
                formatter={(v: unknown) => [(v as number).toLocaleString('th-TH'), 'เซสชัน']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="w-full space-y-1.5">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />
                  <span className="text-zinc-700 dark:text-zinc-300">{d.name}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 tabular-nums">
                  <span>{d.count.toLocaleString('th-TH')}</span>
                  <span className="text-xs">({total > 0 ? ((d.count / total) * 100).toFixed(1) : 0}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface DevicesTabProps { days: DateRange }

export function DevicesTab({ days }: DevicesTabProps) {
  const [data, setData] = useState<{ devices: unknown[]; browsers: unknown[]; os: unknown[]; resolutions: unknown[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsApi.getDevices(days).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [days])

  if (loading) return <Spinner />

  const devices = (data?.devices || []) as NameCount[]
  const browsers = (data?.browsers || []) as NameCount[]
  const os = (data?.os || []) as NameCount[]
  const resolutions = (data?.resolutions || []) as NameCount[]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DonutChart data={devices} colors={DEVICE_COLORS} label="ประเภทอุปกรณ์" />
        <DonutChart data={browsers} colors={BROWSER_COLORS} label="เบราว์เซอร์" />
        <DonutChart data={os} colors={BROWSER_COLORS} label="ระบบปฏิบัติการ" />
      </div>

      {resolutions.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
          <SectionHeader title="ความละเอียดหน้าจอ" description="10 อันดับขนาดหน้าจอ" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {resolutions.slice(0, 10).map((r) => {
              const total = resolutions.slice(0, 10).reduce((s, x) => s + (x as NameCount).count, 0)
              const rc = r as NameCount
              return (
                <div key={rc.name} className="border border-zinc-100 dark:border-zinc-800 rounded p-2 text-center">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{rc.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{((rc.count / total) * 100).toFixed(1)}%</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
