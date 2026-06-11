import { useEffect, useState, useCallback } from 'react'
import { analyticsApi } from '../../api/analyticsApi'
import { SectionHeader } from './components/SectionHeader'
import { RefreshCw } from 'lucide-react'

const SOURCE_LABELS: Record<string, string> = {
  direct: 'ตรง',
  organic: 'ค้นหาออร์แกนิค',
  social: 'โซเชียลมีเดีย',
  referral: 'การอ้างอิง',
  email: 'อีเมล',
  paid: 'ค้นหาแบบชำระเงิน',
}

interface RealtimeData {
  activeUsers: number
  activePages: Array<{ path: string; active: number }>
  activeSources: Record<string, number>
}

export function RealtimeTab() {
  const [data, setData] = useState<RealtimeData | null>(null)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(() => {
    setRefreshing(true)
    analyticsApi.getRealtime().then((d) => {
      setData(d)
      setLastUpdate(new Date())
    }).catch(() => {}).finally(() => setRefreshing(false))
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  return (
    <div className="space-y-6">
      {/* Active users */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="ผู้เยี่ยมชมสด" description="ผู้ใช้ที่ใช้งานใน 5 นาทีล่าสุด" />
          <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>สด · อัปเดต {lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="ml-2 flex items-center gap-1 px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              รีเฟรช
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-5xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {data?.activeUsers ?? '—'}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">ผู้ใช้งานอยู่</p>
          </div>

          {data?.activeSources && Object.keys(data.activeSources).length > 0 && (
            <div className="flex-1 border-l border-zinc-100 dark:border-zinc-800 pl-6">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">แยกตามแหล่งที่มา</p>
              <div className="space-y-1">
                {Object.entries(data.activeSources).map(([src, count]) => (
                  <div key={src} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">{SOURCE_LABELS[src] || src}</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active pages */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <SectionHeader title="หน้าที่กำลังดูอยู่" description="หน้าที่มีผู้เยี่ยมชมอยู่ในขณะนี้" />
        {!data?.activePages?.length ? (
          <div className="py-8 text-center text-sm text-zinc-400">
            ไม่มีผู้เยี่ยมชมอยู่ในขณะนี้
          </div>
        ) : (
          <div className="space-y-2">
            {data.activePages.map((p) => {
              const max = Math.max(...(data.activePages || []).map(x => x.active), 1)
              return (
                <div key={p.path} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{p.path}</p>
                    <div className="mt-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(p.active / max) * 100}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tabular-nums w-6 text-right">{p.active}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
