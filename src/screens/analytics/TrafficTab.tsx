import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { analyticsApi, type DateRange } from '../../api/analyticsApi'
import { SectionHeader } from './components/SectionHeader'

const SOURCE_COLORS: Record<string, string> = {
  direct: '#2563eb',
  organic: '#10b981',
  social: '#8b5cf6',
  referral: '#f59e0b',
  email: '#ef4444',
  paid: '#ec4899',
}

const SOURCE_LABELS: Record<string, string> = {
  direct: 'ตรง',
  organic: 'ค้นหาออร์แกนิค',
  social: 'โซเชียลมีเดีย',
  referral: 'การอ้างอิง',
  email: 'อีเมล',
  paid: 'ค้นหาแบบชำระเงิน',
}

const SOURCE_DESCS: Record<string, string> = {
  direct: 'ไม่มีผู้อ้างอิง — พิมพ์ URL หรือ bookmark',
  organic: 'เครื่องมือค้นหา: Google, Bing, Yahoo',
  social: 'Facebook, Instagram, LINE, Twitter',
  referral: 'เว็บไซต์อื่นที่ลิงก์มาหาคุณ',
  email: 'แคมเปญอีเมล (utm_medium=email)',
  paid: 'แคมเปญ CPC / PPC (utm_medium=cpc)',
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

interface TrafficTabProps { days: DateRange }

export function TrafficTab({ days }: TrafficTabProps) {
  const [sources, setSources] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsApi.getTrafficSources(days)
      .then(setSources)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  if (loading) return <Spinner />

  const data = (sources as Array<{ source: string; sessions: number; percent: number }>)
    .map(s => ({ ...s, label: SOURCE_LABELS[s.source] || s.source, color: SOURCE_COLORS[s.source] || '#6b7280' }))

  const total = data.reduce((s, d) => s + d.sessions, 0)

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <SectionHeader title="แหล่งที่มาของการเข้าชม" description={`${days} วันล่าสุด — จำแนกตามช่องทาง`} />
        {data.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
            ยังไม่มีข้อมูลการเข้าชม จะปรากฏเมื่อมีผู้เยี่ยมชม
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="shrink-0">
              <ResponsiveContainer width={280} height={280}>
                <PieChart>
                  <Pie data={data} dataKey="sessions" nameKey="label" cx="50%" cy="50%"
                    innerRadius={70} outerRadius={110} paddingAngle={2}>
                    {data.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: unknown) => [(val as number).toLocaleString('th-TH'), 'เซสชัน']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {data.map(d => (
                <div key={d.source} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{d.label}</span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {d.sessions.toLocaleString('th-TH')} ({d.percent}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${d.percent}%`, background: d.color }} />
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  รวม: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{total.toLocaleString('th-TH')} เซสชัน</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <SectionHeader title="คำอธิบายช่องทาง" />
        <div className="grid grid-cols-2 gap-3 text-sm">
          {Object.entries(SOURCE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: SOURCE_COLORS[key] }} />
              <div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
                <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-0.5">{SOURCE_DESCS[key]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
