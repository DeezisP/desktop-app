import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { Skeleton } from '../../components/Skeleton'

// ── Period selector ───────────────────────────────────────────────────────────

export const PERIODS = [
  { label: '7d',  value: 7  },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

export function PeriodSelector({
  value, onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-zinc-50 dark:bg-zinc-800">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
            value === p.value
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ── Page header ───────────────────────────────────────────────────────────────

export function PageHeader({
  icon, title, description,
  right,
}: {
  icon: React.ReactNode
  title: string
  description: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-100 dark:bg-blue-900/30 p-2.5 text-blue-600 dark:text-blue-400">
          {icon}
        </div>
        <div>
          <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{title}</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
        </div>
      </div>
      {right}
    </div>
  )
}

// ── KPI Stat card ─────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  subLabel?: string
  change?: number
  icon: React.ReactNode
  loading?: boolean
  accent?: string
}

export function StatCard({ label, value, subLabel, change, icon, loading, accent = 'blue' }: StatCardProps) {
  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50   dark:bg-blue-900/20  text-blue-600   dark:text-blue-400',
    green:  'bg-green-50  dark:bg-green-900/20 text-green-600  dark:text-green-400',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
    amber:  'bg-amber-50  dark:bg-amber-900/20 text-amber-600  dark:text-amber-400',
    rose:   'bg-rose-50   dark:bg-rose-900/20  text-rose-600   dark:text-rose-400',
    teal:   'bg-teal-50   dark:bg-teal-900/20  text-teal-600   dark:text-teal-400',
  }
  const iconColor = colorMap[accent] || colorMap.blue

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`rounded-lg p-2 ${iconColor}`}>{icon}</div>
        {change !== undefined && (
          <ChangeBadge value={change} />
        )}
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">{value}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{label}</p>
          {subLabel && <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{subLabel}</p>}
        </>
      )}
    </motion.div>
  )
}

// ── Change badge ──────────────────────────────────────────────────────────────

export function ChangeBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.1) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
        <Minus size={9} /> 0%
      </span>
    )
  }
  const isPos = value > 0
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
      isPos
        ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
        : 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
    }`}>
      {isPos ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {isPos ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}

// ── Top list row ──────────────────────────────────────────────────────────────

export function TopRow({
  rank, label, count, percentage, color = 'bg-blue-500',
}: {
  rank?: number
  label: string
  count: number
  percentage: number
  color?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {rank !== undefined && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 w-4 text-right flex-shrink-0">{rank}</span>
          )}
          <span className="text-zinc-700 dark:text-zinc-300 truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-zinc-400 dark:text-zinc-500 text-[10px]">{percentage}%</span>
          <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 w-12 text-right">{count.toLocaleString()}</span>
        </div>
      </div>
      <div className="h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

export function SectionCard({
  title, subtitle, icon, loading, children, className = '',
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  loading?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          {icon && <span className="text-zinc-400">{icon}</span>}
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</span>
          {subtitle && <span className="text-xs text-zinc-400 dark:text-zinc-500">{subtitle}</span>}
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-1 w-full" />
              </div>
            ))}
          </div>
        ) : children}
      </div>
    </div>
  )
}

// ── Refresh button ────────────────────────────────────────────────────────────

export function RefreshButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-all"
    >
      <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
      {loading ? 'Loading…' : 'Refresh'}
    </button>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyData({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-zinc-400 dark:text-zinc-600">
      <div className="mb-2 opacity-40">{icon}</div>
      <p className="text-xs">{message}</p>
    </div>
  )
}

// ── Format helpers ────────────────────────────────────────────────────────────

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k'
  return n.toLocaleString()
}

export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(amount)
}
