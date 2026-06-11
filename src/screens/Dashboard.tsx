import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  RefreshCw, Clock, CheckCircle2, AlertTriangle,
  Package, Boxes, ArrowDownToLine, ScanBarcode,
  Tag, TrendingUp, Activity, ChevronRight,
  Layers, TriangleAlert, Globe,
} from 'lucide-react'
import { useWarehouseStore } from '../store/warehouseStore'
import { useAuthStore } from '../store/authStore'
import { StatusBadge } from '../components/StatusBadge'
import { Skeleton } from '../components/Skeleton'
import { analyticsApi } from '../api/analyticsApi'
import type { QueueStatus, WarehouseProductResponse } from '../types/warehouse'

// ── Analytics types ───────────────────────────────────────────────────────────

interface OverviewData {
  sessions: number
  uniqueVisitors: number
  pageviews: number
  bounceRate: number
  sessionsDelta: number
  uniqueVisitorsDelta: number
}

interface HealthScore {
  type: string
  score: number | null
}

// ── Analytics helpers ─────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('th-TH')
}

function fmtDelta(d: number | undefined): { label: string; positive: boolean } | null {
  if (d === undefined || d === null) return null
  return { label: `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`, positive: d >= 0 }
}

function scoreStroke(score: number | null): string {
  if (score === null) return 'stroke-zinc-200 dark:stroke-zinc-700'
  if (score >= 85) return 'stroke-emerald-500'
  if (score >= 65) return 'stroke-amber-500'
  return 'stroke-red-500'
}

function scoreText(score: number | null): string {
  if (score === null) return 'text-zinc-400'
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 65) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function scoreBorder(score: number | null): string {
  if (score === null) return 'border-zinc-200 dark:border-zinc-800'
  if (score >= 85) return 'border-emerald-200 dark:border-emerald-800'
  if (score >= 65) return 'border-amber-200 dark:border-amber-800'
  return 'border-red-200 dark:border-red-800'
}

// ── Analytics sub-components ──────────────────────────────────────────────────

function WebStatCard({ label, value, delta, sub }: { label: string; value: string; delta?: { label: string; positive: boolean } | null; sub?: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
      <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-2 h-3.5">
        {delta && (
          <span className={`text-[10px] font-medium ${delta.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {delta.label}
          </span>
        )}
        {sub && <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{sub}</span>}
      </div>
    </div>
  )
}

function WebScoreCard({ type, score }: { type: string; score: number | null }) {
  const radius = 22
  const circ = 2 * Math.PI * radius
  const pct = score !== null ? Math.min(Math.max(score, 0), 100) : 0
  const offset = circ - (pct / 100) * circ

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${scoreBorder(score)} bg-white dark:bg-zinc-900`}>
      <div className="relative shrink-0">
        <svg width="50" height="50" className="-rotate-90">
          <circle cx="25" cy="25" r={radius} fill="none" className="stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="5" />
          <circle cx="25" cy="25" r={radius} fill="none" className={scoreStroke(score)} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold ${scoreText(score)}`}>{score !== null ? score : '—'}</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{type}</p>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">จาก 100</p>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function isToday(iso: string) {
  return new Date(iso) >= todayStart()
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface KpiProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  accent: string       // Tailwind bg/border/text colour token
  loading?: boolean
  href?: string
}

function KpiCard({ label, value, sub, icon, accent, loading, href }: KpiProps) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex flex-col gap-3 rounded-xl border p-4 bg-white dark:bg-zinc-900 transition-all ${accent} ${href ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className={`rounded-lg p-2 ${accent.includes('yellow') ? 'bg-yellow-100 dark:bg-yellow-900/30' : accent.includes('blue') ? 'bg-blue-100 dark:bg-blue-900/30' : accent.includes('green') ? 'bg-green-100 dark:bg-green-900/30' : accent.includes('red') ? 'bg-red-100 dark:bg-red-900/30' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
          {icon}
        </div>
        {href && <ChevronRight size={14} className="text-zinc-400 mt-1" />}
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">{value}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
          {sub && <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{sub}</p>}
        </div>
      )}
    </motion.div>
  )
  return href ? <Link to={href}>{inner}</Link> : inner
}

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</h2>
        {sub && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

// Inline horizontal bar chart row
function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{count}</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ── Quick action card ─────────────────────────────────────────────────────────

function ActionCard({ to, icon, label, desc, color }: { to: string; icon: React.ReactNode; label: string; desc: string; color: string }) {
  return (
    <Link
      to={to}
      className={`group flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 hover:shadow-sm transition-all hover:border-zinc-300 dark:hover:border-zinc-700`}
    >
      <div className={`mt-0.5 rounded-lg p-1.5 ${color} flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{label}</p>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{desc}</p>
      </div>
    </Link>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

const QUEUE_STATUS_ORDER: QueueStatus[] = ['WAITING', 'PACKING', 'DONE', 'ERROR']

export function Dashboard() {
  const user = useAuthStore((s) => s.user)

  const queue           = useWarehouseStore((s) => s.queue)
  const queueLoading    = useWarehouseStore((s) => s.queueLoading)
  const orders          = useWarehouseStore((s) => s.orders)
  const ordersLoading   = useWarehouseStore((s) => s.ordersLoading)
  const ordersTotal     = useWarehouseStore((s) => s.ordersTotal)
  const products        = useWarehouseStore((s) => s.products)
  const productsLoading = useWarehouseStore((s) => s.productsLoading)
  const productsTotal   = useWarehouseStore((s) => s.productsTotal)
  const importHistory   = useWarehouseStore((s) => s.importHistory)

  const loadQueue         = useWarehouseStore((s) => s.loadQueue)
  const loadOrders        = useWarehouseStore((s) => s.loadOrders)
  const loadProducts      = useWarehouseStore((s) => s.loadProducts)
  const loadImportHistory = useWarehouseStore((s) => s.loadImportHistory)

  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // ── Website analytics state ─────────────────────────────────────────────────
  const [webToday, setWebToday] = useState<OverviewData | null>(null)
  const [webWeek, setWebWeek] = useState<OverviewData | null>(null)
  const [webMonth, setWebMonth] = useState<OverviewData | null>(null)
  const [liveUsers, setLiveUsers] = useState<number | null>(null)
  const [healthScores, setHealthScores] = useState<HealthScore[]>([])
  const [webLoading, setWebLoading] = useState(true)

  const fetchLive = useCallback(() => {
    analyticsApi.getRealtime()
      .then(d => setLiveUsers(d?.activeUsers ?? 0))
      .catch(() => {})
  }, [])

  const fetchWebStats = useCallback(() => {
    setWebLoading(true)
    Promise.all([
      analyticsApi.getOverview(1),
      analyticsApi.getOverview(7),
      analyticsApi.getOverview(30),
      analyticsApi.getHealthScores(),
    ]).then(([d1, d7, d30, hs]) => {
      setWebToday(d1)
      setWebWeek(d7)
      setWebMonth(d30)
      setHealthScores(hs)
    }).catch(() => {}).finally(() => setWebLoading(false))
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([loadQueue(), loadOrders(), loadProducts(), loadImportHistory()])
    setLastRefresh(new Date())
    setRefreshing(false)
  }, [loadQueue, loadOrders, loadProducts, loadImportHistory])

  // Initial load + auto-refresh every 60s
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchWebStats()
    fetchLive()
    const liveId = setInterval(fetchLive, 30_000)
    return () => clearInterval(liveId)
  }, [fetchWebStats, fetchLive])

  const loading = queueLoading || ordersLoading || productsLoading

  // ── Derived data ────────────────────────────────────────────────────────────

  const waitingCount = queue.filter((q) => q.status === 'WAITING').length
  const packingCount = queue.filter((q) => q.status === 'PACKING').length
  const doneToday    = queue.filter((q) => q.status === 'DONE' && isToday(q.scannedAt)).length
  const errorCount   = queue.filter((q) => q.status === 'ERROR').length

  const ordersToday     = orders.filter((o) => isToday(o.createdAt)).length
  const packedToday     = orders.filter((o) => o.importStatus === 'PACKED' && o.importedAt && isToday(o.importedAt)).length
  const importedCount   = orders.filter((o) => o.importStatus === 'IMPORTED').length
  const packedCount     = orders.filter((o) => o.importStatus === 'PACKED').length
  const cancelledCount  = orders.filter((o) => o.importStatus === 'CANCELLED').length
  const maxOrderStatus  = Math.max(importedCount, packedCount, cancelledCount, 1)

  // Platform breakdown
  const platformMap: Record<string, number> = {}
  orders.forEach((o) => {
    const p = o.platform || 'Manual'
    platformMap[p] = (platformMap[p] ?? 0) + 1
  })
  const platforms = Object.entries(platformMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const maxPlatform = Math.max(...platforms.map(([, c]) => c), 1)

  // Low stock (available ≤ 3)
  const LOW_THRESHOLD = 3
  const lowStock: WarehouseProductResponse[] = products
    .filter((p) => p.availableStock <= LOW_THRESHOLD && !p.generated)
    .sort((a, b) => a.availableStock - b.availableStock)
    .slice(0, 6)

  // Recent queue (last 12)
  const recentQueue = [...queue]
    .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime())
    .slice(0, 12)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'อรุณสวัสดิ์'
    if (h < 18) return 'สวัสดีตอนบ่าย'
    return 'สวัสดีตอนเย็น'
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 space-y-5 h-full overflow-y-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {greeting()}, <span className="text-brand-600 dark:text-brand-400">{user?.firstname || user?.username}</span>
          </h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1.5">
            <Activity size={11} />
            อัปเดตล่าสุด {lastRefresh.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-all"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'กำลังรีเฟรช…' : 'รีเฟรช'}
        </button>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard
          label="รอสแกน"
          value={fmt(waitingCount)}
          sub="WAITING ในคิว"
          icon={<Clock size={15} className="text-yellow-500" />}
          accent="border-yellow-200 dark:border-yellow-800/50"
          loading={queueLoading}
          href="/packing"
        />
        <KpiCard
          label="กำลังแพ็ค"
          value={fmt(packingCount)}
          sub="PACKING ในคิว"
          icon={<ScanBarcode size={15} className="text-blue-500" />}
          accent="border-blue-200 dark:border-blue-800/50"
          loading={queueLoading}
          href="/packing"
        />
        <KpiCard
          label="แพ็คแล้ววันนี้"
          value={fmt(doneToday)}
          sub={`DONE · ${packedToday > 0 ? packedToday + ' ออเดอร์' : 'วันนี้'}`}
          icon={<CheckCircle2 size={15} className="text-green-500" />}
          accent="border-green-200 dark:border-green-800/50"
          loading={queueLoading}
        />
        <KpiCard
          label="ข้อผิดพลาด"
          value={fmt(errorCount)}
          sub="ERROR ในคิว"
          icon={<AlertTriangle size={15} className="text-red-500" />}
          accent={errorCount > 0 ? 'border-red-300 dark:border-red-700/60' : 'border-zinc-200 dark:border-zinc-800'}
          loading={queueLoading}
          href="/packing"
        />
        <KpiCard
          label="สินค้าทั้งหมด"
          value={fmt(productsTotal || products.length)}
          sub={lowStock.length > 0 ? `⚠ ${lowStock.length} ใกล้หมด` : 'สต็อกปกติ'}
          icon={<Boxes size={15} className="text-zinc-500" />}
          accent="border-zinc-200 dark:border-zinc-800"
          loading={productsLoading}
          href="/stock"
        />
      </div>

      {/* ── Middle row: Queue + Import history ─────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">

        {/* Live Queue — 3 cols */}
        <div className="col-span-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <ScanBarcode size={14} className="text-zinc-400" />
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">คิวสแกน (ล่าสุด)</span>
              {!queueLoading && queue.length > 0 && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{queue.length} รายการ</span>
              )}
            </div>
            <div className="flex gap-1.5">
              {QUEUE_STATUS_ORDER.map((s) => {
                const cnt = queue.filter((q) => q.status === s).length
                if (cnt === 0) return null
                return (
                  <span key={s} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    s === 'WAITING' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                    s === 'PACKING' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                    s === 'DONE'    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                      'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  }`}>{cnt} {s}</span>
                )
              })}
            </div>
          </div>

          {queueLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" style={{ opacity: 1 - i * 0.15 }} />)}
            </div>
          ) : recentQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-600">
              <ScanBarcode size={28} className="mb-2 opacity-40" />
              <p className="text-sm">ยังไม่มีรายการในคิว</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800/60">
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">เลขออเดอร์</th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">สถานะ</th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">สถานี</th>
                    <th className="px-4 py-2 text-right text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">เวลา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {recentQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-zinc-700 dark:text-zinc-300 font-medium">
                        {item.orderNumber}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge value={item.status} />
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">
                        {item.stationId ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {timeAgo(item.scannedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {recentQueue.length > 0 && (
            <div className="border-t border-zinc-100 dark:border-zinc-800/60 px-4 py-2">
              <Link to="/packing" className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                ดูคิวทั้งหมด <ChevronRight size={11} />
              </Link>
            </div>
          )}
        </div>

        {/* Import History — 2 cols */}
        <div className="col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
            <ArrowDownToLine size={14} className="text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">ประวัตินำเข้า</span>
          </div>

          {importHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-400 dark:text-zinc-600">
              <Layers size={24} className="mb-2 opacity-40" />
              <p className="text-xs">ยังไม่มีประวัติ</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {importHistory.slice(0, 6).map((h) => (
                <div key={h.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{h.platform}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {new Date(h.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
                      +{h.newCount}
                    </span>
                    {h.skippedCount > 0 && (
                      <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                        {h.skippedCount} ข้าม
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {importHistory.length > 0 && (
            <div className="border-t border-zinc-100 dark:border-zinc-800/60 px-4 py-2">
              <Link to="/import" className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                นำเข้าออเดอร์ <ChevronRight size={11} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: Orders pipeline + Low stock ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Orders Pipeline */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <SectionHeader
            title="ออเดอร์ทั้งหมด"
            sub={ordersLoading ? 'กำลังโหลด…' : `${ordersTotal || orders.length} รายการ · วันนี้ ${ordersToday}`}
            action={
              <Link to="/orders" className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5">
                ดูทั้งหมด <ChevronRight size={11} />
              </Link>
            }
          />

          {ordersLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-400 dark:text-zinc-600">
              <Package size={24} className="mb-2 opacity-40" />
              <p className="text-xs">ยังไม่มีออเดอร์</p>
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              <BarRow label="นำเข้าแล้ว (IMPORTED)" count={importedCount} max={maxOrderStatus} color="bg-blue-500" />
              <BarRow label="แพ็คแล้ว (PACKED)" count={packedCount} max={maxOrderStatus} color="bg-green-500" />
              <BarRow label="ยกเลิก (CANCELLED)" count={cancelledCount} max={maxOrderStatus} color="bg-zinc-400" />

              {platforms.length > 0 && (
                <>
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3">
                    <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">แพลตฟอร์ม</p>
                    <div className="space-y-2">
                      {platforms.map(([p, c]) => (
                        <BarRow key={p} label={p} count={c} max={maxPlatform} color="bg-brand-500" />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <SectionHeader
            title="สต็อกใกล้หมด"
            sub={productsLoading ? 'กำลังโหลด…' : `สินค้า ≤ ${LOW_THRESHOLD} ชิ้น`}
            action={
              <Link to="/stock" className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5">
                จัดการสต็อก <ChevronRight size={11} />
              </Link>
            }
          />

          {productsLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
            </div>
          ) : lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-400 dark:text-zinc-600">
              <CheckCircle2 size={24} className="mb-2 text-green-500 opacity-60" />
              <p className="text-xs font-medium text-green-600 dark:text-green-500">สต็อกปกติทั้งหมด</p>
              <p className="text-[10px] text-zinc-400 mt-1">ไม่มีสินค้าต่ำกว่า {LOW_THRESHOLD} ชิ้น</p>
            </div>
          ) : (
            <div className="space-y-1.5 mt-2">
              {lowStock.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    p.availableStock === 0
                      ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50'
                      : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TriangleAlert size={12} className={p.availableStock === 0 ? 'text-red-500 flex-shrink-0' : 'text-amber-500 flex-shrink-0'} />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">{p.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {p.reservedStock > 0 && (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">จอง {p.reservedStock}</span>
                    )}
                    <span className={`text-xs font-bold tabular-nums ${p.availableStock === 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {p.availableStock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Website Analytics Summary ──────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">เว็บไซต์</span>
            <div className="flex items-center gap-1.5 ml-1">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {liveUsers !== null ? `${liveUsers} คนออนไลน์` : '—'}
              </span>
            </div>
          </div>
          <Link to="/analytics" className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
            ดูการวิเคราะห์เต็ม <ChevronRight size={11} />
          </Link>
        </div>

        <div className="p-4 space-y-4">
          {/* Today */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">วันนี้</p>
            <div className="grid grid-cols-3 gap-2">
              {webLoading ? (
                <><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /></>
              ) : (
                <>
                  <WebStatCard label="เซสชัน" value={fmtNum(webToday?.sessions ?? 0)} delta={fmtDelta(webToday?.sessionsDelta)} sub="เทียบวานนี้" />
                  <WebStatCard label="ผู้เยี่ยมชม" value={fmtNum(webToday?.uniqueVisitors ?? 0)} delta={fmtDelta(webToday?.uniqueVisitorsDelta)} sub="เทียบวานนี้" />
                  <WebStatCard label="การดูหน้า" value={fmtNum(webToday?.pageviews ?? 0)} />
                </>
              )}
            </div>
          </div>

          {/* 7 days */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">7 วันล่าสุด</p>
            <div className="grid grid-cols-3 gap-2">
              {webLoading ? (
                <><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /></>
              ) : (
                <>
                  <WebStatCard label="เซสชัน" value={fmtNum(webWeek?.sessions ?? 0)} delta={fmtDelta(webWeek?.sessionsDelta)} sub="เทียบ 7 วันก่อน" />
                  <WebStatCard label="ผู้เยี่ยมชม" value={fmtNum(webWeek?.uniqueVisitors ?? 0)} delta={fmtDelta(webWeek?.uniqueVisitorsDelta)} sub="เทียบ 7 วันก่อน" />
                  <WebStatCard label="การดูหน้า" value={fmtNum(webWeek?.pageviews ?? 0)} />
                </>
              )}
            </div>
          </div>

          {/* 30 days */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">30 วันล่าสุด</p>
            <div className="grid grid-cols-3 gap-2">
              {webLoading ? (
                <><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /></>
              ) : (
                <>
                  <WebStatCard label="เซสชัน" value={fmtNum(webMonth?.sessions ?? 0)} delta={fmtDelta(webMonth?.sessionsDelta)} sub="เทียบ 30 วันก่อน" />
                  <WebStatCard label="ผู้เยี่ยมชม" value={fmtNum(webMonth?.uniqueVisitors ?? 0)} delta={fmtDelta(webMonth?.uniqueVisitorsDelta)} sub="เทียบ 30 วันก่อน" />
                  <WebStatCard label="อัตราการออก" value={`${(webMonth?.bounceRate ?? 0).toFixed(1)}%`} sub="เซสชันหน้าเดียว" />
                </>
              )}
            </div>
          </div>

          {/* Health scores */}
          {!webLoading && healthScores.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">สุขภาพเว็บไซต์</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {healthScores.map(h => (
                  <WebScoreCard key={h.type} type={h.type} score={h.score} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <TrendingUp size={11} /> Quick Actions
        </p>
        <div className="grid grid-cols-5 gap-2.5">
          <ActionCard to="/packing"   icon={<ScanBarcode  size={14} className="text-blue-500" />}   label="สแกนบาร์โค้ด"  desc="แพ็คออเดอร์"     color="bg-blue-100 dark:bg-blue-900/30" />
          <ActionCard to="/import"     icon={<ArrowDownToLine size={14} className="text-violet-500" />} label="นำเข้าออเดอร์" desc="นำเข้า JSON"    color="bg-violet-100 dark:bg-violet-900/30" />
          <ActionCard to="/stock"     icon={<Boxes        size={14} className="text-emerald-500" />} label="สต็อกสินค้า"   desc="เพิ่ม / ลด"      color="bg-emerald-100 dark:bg-emerald-900/30" />
          <ActionCard to="/orders"    icon={<Package      size={14} className="text-orange-500" />}  label="รายการออเดอร์" desc="ดูทุกออเดอร์"   color="bg-orange-100 dark:bg-orange-900/30" />
          <ActionCard to="/barcode"   icon={<Tag          size={14} className="text-zinc-500" />}    label="ป้ายพัสดุ"     desc="พิมพ์บาร์โค้ด" color="bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>

    </div>
  )
}
