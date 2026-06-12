import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Activity, Cpu, HardDrive, Server, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'
import { analyticsApi, type SystemHealth as SystemHealthData } from '../../api/analyticsApi'
import { PageHeader, RefreshButton } from './shared'
import { Skeleton } from '../../components/Skeleton'

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function GaugeBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">{value.toLocaleString()} MB</span>
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
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

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  status?: 'ok' | 'warn' | 'error'
}

function MetricCard({ icon, label, value, sub, status = 'ok' }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 p-2 text-zinc-500 dark:text-zinc-400">{icon}</div>
        {status === 'ok'    && <CheckCircle2 size={14} className="text-green-500" />}
        {status === 'warn'  && <AlertTriangle size={14} className="text-amber-500" />}
        {status === 'error' && <AlertTriangle size={14} className="text-red-500" />}
      </div>
      <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">{value}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export function SystemHealth() {
  const [health,  setHealth]  = useState<SystemHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const h = await analyticsApi.getSystemHealth()
      setHealth(h)
    } catch (e) {
      setError('Failed to load system health')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  const memPct  = health?.memory.usedPct ?? 0
  const memStat = memPct > 85 ? 'error' : memPct > 70 ? 'warn' : 'ok'

  return (
    <div className="p-5 space-y-5 h-full overflow-y-auto">
      <PageHeader
        icon={<Activity size={18} />}
        title="System Health"
        description="JVM memory, uptime, and server status"
        right={<RefreshButton loading={loading} onClick={load} />}
      />

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      ) : health && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <MetricCard
              icon={<Server size={15} />}
              label="Server Status"
              value={health.status.toUpperCase()}
              sub="Spring Boot JVM"
              status={health.status === 'ok' ? 'ok' : 'error'}
            />
            <MetricCard
              icon={<Clock size={15} />}
              label="Uptime"
              value={fmtUptime(health.uptimeMs)}
              sub="Since last restart"
              status="ok"
            />
            <MetricCard
              icon={<HardDrive size={15} />}
              label="Memory Used"
              value={`${health.memory.usedMB} MB`}
              sub={`of ${health.memory.maxMB} MB max`}
              status={memStat}
            />
            <MetricCard
              icon={<Cpu size={15} />}
              label="Heap Usage"
              value={`${health.memory.usedPct}%`}
              sub={`${health.memory.totalMB} MB total`}
              status={memStat}
            />
          </div>

          {/* Memory gauge */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">JVM Memory</p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">Used Heap</p>
                <GaugeBar
                  value={health.memory.usedMB}
                  max={health.memory.maxMB}
                  color={memPct > 85 ? 'bg-red-500' : memPct > 70 ? 'bg-amber-500' : 'bg-green-500'}
                />
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">Committed Heap</p>
                <GaugeBar
                  value={health.memory.totalMB}
                  max={health.memory.maxMB}
                  color="bg-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <p className="text-[10px] text-zinc-400">Used</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">{health.memory.usedMB} MB</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-400">Committed</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">{health.memory.totalMB} MB</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-400">Max</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">{health.memory.maxMB} MB</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
