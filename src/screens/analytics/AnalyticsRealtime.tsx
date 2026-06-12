import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, Users, Wifi, WifiOff } from 'lucide-react'
import { analyticsApi } from '../../api/analyticsApi'
import { warehouseStompClient } from '../../stomp/client'
import { PageHeader } from './shared'

interface RealtimeData {
  activeVisitors: number
  timestamp: number
}

function Pulse({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        {/* Concentric pulse rings */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-blue-400 dark:border-blue-500"
            style={{
              width: 80 + i * 40,
              height: 80 + i * 40,
              top: -(i * 20),
              left: -(i * 20),
            }}
            animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}

        {/* Centre */}
        <div className="relative z-10 w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Users size={28} className="text-white" />
        </div>
      </div>

      <div className="mt-10 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={count}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="text-5xl font-black text-zinc-900 dark:text-zinc-50 tabular-nums"
          >
            {count}
          </motion.p>
        </AnimatePresence>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">active visitors right now</p>
      </div>
    </div>
  )
}

export function AnalyticsRealtime() {
  const [data,        setData] = useState<RealtimeData | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [loading,     setLoading]     = useState(true)
  const history = useRef<{ time: string; count: number }[]>([])

  // Initial REST fetch
  useEffect(() => {
    analyticsApi.getRealtime()
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // WebSocket subscription for live updates
  useEffect(() => {
    const cleanup = warehouseStompClient.subscribe('/topic/analytics/realtime', (msg) => {
      try {
        const payload: RealtimeData = JSON.parse(msg.body)
        setData(payload)
        setWsConnected(true)

        // Keep last 30 entries for mini sparkline
        const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        history.current = [...history.current.slice(-29), { time, count: payload.activeVisitors }]
      } catch { /* ignore parse errors */ }
    })
    return cleanup
  }, [])

  const lastUpdated = data ? new Date(data.timestamp).toLocaleTimeString() : '—'
  const count       = data?.activeVisitors ?? 0

  return (
    <div className="p-5 h-full overflow-y-auto">

      <PageHeader
        icon={<Radio size={18} />}
        title="Realtime"
        description="Live visitor activity on the website"
        right={
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
            wsConnected
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
          }`}>
            {wsConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {wsConnected ? 'Live' : 'Polling'}
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-400">
          <Radio size={24} className="animate-pulse" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <Pulse count={count} />
            <div className="border-t border-zinc-100 dark:border-zinc-800 px-6 py-3 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-xs text-zinc-400">Updated {lastUpdated}</span>
              <div className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-3 gap-3">
            <InfoCard label="Activity window" value="5 minutes" sub="Sessions active in last 5 min" />
            <InfoCard label="Update interval" value="5 seconds" sub="WebSocket push via STOMP" />
            <InfoCard label="Connection" value={wsConnected ? 'WebSocket' : 'REST'} sub={wsConnected ? 'Live push updates' : 'Polling fallback'} />
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-zinc-800 dark:text-zinc-200">{value}</p>
      <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  )
}
