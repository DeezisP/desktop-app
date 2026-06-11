import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { analyticsApi, type DateRange } from '../../api/analyticsApi'
import { KpiCard } from './components/KpiCard'
import { SectionHeader } from './components/SectionHeader'

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function fmtSec(s: number): string {
  if (!s) return '0s'
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m}น. ${sec}ว.` : `${sec}ว.`
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

interface OverviewTabProps { days: DateRange }

export function OverviewTab({ days }: OverviewTabProps) {
  const [overview, setOverview] = useState<Record<string, number> | null>(null)
  const [trend, setTrend] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      analyticsApi.getOverview(days),
      analyticsApi.getTrend(days),
    ]).then(([ov, tr]) => {
      setOverview(ov)
      setTrend(tr)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [days])

  if (loading) return <Spinner />

  const ov = overview || {}

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div>
        <SectionHeader title="ตัวชี้วัดหลัก" description={`${days} วันล่าสุด เทียบช่วงก่อนหน้า`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="เซสชัน" value={fmt(ov.sessions || 0)} delta={ov.sessionsDelta} sub="เทียบช่วงก่อน" />
          <KpiCard label="ผู้เยี่ยมชมไม่ซ้ำ" value={fmt(ov.uniqueVisitors || 0)} delta={ov.uniqueVisitorsDelta} sub="เทียบช่วงก่อน" />
          <KpiCard label="การดูหน้า" value={fmt(ov.pageviews || 0)} delta={ov.pageviewsDelta} sub="เทียบช่วงก่อน" />
          <KpiCard label="ระยะเวลาเซสชันเฉลี่ย" value={fmtSec(ov.avgSessionDuration || 0)} sub="ต่อเซสชัน" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <KpiCard label="ผู้เยี่ยมชมใหม่" value={fmt(ov.newVisitors || 0)} sub="ครั้งแรก" />
          <KpiCard label="ผู้เยี่ยมชมกลับมา" value={fmt(ov.returningVisitors || 0)} sub="กลับมาเยี่ยมชม" />
          <KpiCard label="หน้า / เซสชัน" value={(ov.avgPagesPerSession || 0).toFixed(2)} sub="ความลึกเฉลี่ย" />
          <KpiCard label="อัตราการออก" value={`${(ov.bounceRate || 0).toFixed(1)}%`} sub="เซสชันหน้าเดียว" />
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <SectionHeader title="แนวโน้มการเข้าชม" description="เซสชัน ผู้เยี่ยมชม และการดูหน้า ตามช่วงเวลา" />
        {trend.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
            ยังไม่มีข้อมูลแนวโน้ม จะปรากฏเมื่อมีผู้เยี่ยมชมเว็บไซต์
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend as object[]} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPageviews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(val: unknown) => fmt(val as number)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="sessions" stroke="#2563eb" fill="url(#gSessions)" strokeWidth={2} name="เซสชัน" />
              <Area type="monotone" dataKey="visitors" stroke="#10b981" fill="url(#gVisitors)" strokeWidth={2} name="ผู้เยี่ยมชม" />
              <Area type="monotone" dataKey="pageviews" stroke="#8b5cf6" fill="url(#gPageviews)" strokeWidth={2} name="การดูหน้า" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Engagement */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <SectionHeader title="การมีส่วนร่วม" />
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">ความลึกในการเลื่อนเฉลี่ย</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {(ov.avgScrollDepth || 0).toFixed(0)}%
            </p>
            <div className="mt-2 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${ov.avgScrollDepth || 0}%` }} />
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">อัตราการออก</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {(ov.bounceRate || 0).toFixed(1)}%
            </p>
            <div className="mt-2 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${(ov.bounceRate || 0) > 60 ? 'bg-red-500' : (ov.bounceRate || 0) > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${ov.bounceRate || 0}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">หน้า / เซสชัน</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {(ov.avgPagesPerSession || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
