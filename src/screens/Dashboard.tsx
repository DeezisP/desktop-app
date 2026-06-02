import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWarehouseStore } from '../store/warehouseStore'
import { useAuthStore } from '../store/authStore'
import { StatusBadge } from '../components/StatusBadge'
import type { QueueStatus } from '../types/warehouse'

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border bg-slate-900 p-5 ${color}`}>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  )
}

function QuickAction({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-brand-600/50 hover:bg-slate-800"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </Link>
  )
}

const QUEUE_STATUSES: QueueStatus[] = ['WAITING', 'PACKING', 'DONE', 'ERROR']

export function Dashboard() {
  const user         = useAuthStore((s) => s.user)
  const queue        = useWarehouseStore((s) => s.queue)
  const queueLoading = useWarehouseStore((s) => s.queueLoading)
  const loadQueue    = useWarehouseStore((s) => s.loadQueue)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  async function refresh() {
    setRefreshing(true)
    await loadQueue()
    setRefreshing(false)
  }

  const countByStatus = (status: QueueStatus) =>
    queue.filter((q) => q.status === status).length

  const recentQueue = [...queue]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Welcome back, <span className="text-slate-300">{user?.username}</span>
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing || queueLoading}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {QUEUE_STATUSES.map((s) => (
          <StatCard
            key={s}
            label={s}
            value={countByStatus(s)}
            color={
              s === 'WAITING' ? 'border-yellow-500/30' :
              s === 'PACKING' ? 'border-blue-500/30'   :
              s === 'DONE'    ? 'border-green-500/30'  :
                                'border-red-500/30'
            }
          />
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-slate-400">Quick Actions</h2>
        <div className="grid grid-cols-5 gap-3">
          <QuickAction to="/scan-pack"      label="Scan & Pack"    icon="⬡" />
          <QuickAction to="/product-lookup" label="Product Lookup" icon="🔍" />
          <QuickAction to="/stock-in"       label="Stock In"       icon="▲" />
          <QuickAction to="/stock-out"      label="Stock Out"      icon="▼" />
          <QuickAction to="/order-import"   label="Import Orders"  icon="⤵" />
        </div>
      </div>

      {/* Recent queue */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-slate-400">Recent Scan Queue</h2>
        {queueLoading ? (
          <div className="flex h-24 items-center justify-center text-slate-500 text-sm">Loading…</div>
        ) : recentQueue.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">
            No items in queue
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Order #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Station</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Scanned</th>
                </tr>
              </thead>
              <tbody>
                {recentQueue.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-slate-200">{item.orderNumber}</td>
                    <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{item.stationId ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(item.scannedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
