import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Trash2, ChevronDown, ChevronUp, RefreshCw, X, ShoppingBag } from 'lucide-react'
import { userApi, type AdminUser } from '../api/userApi'
import type { StoreOrder } from '../api/warehouse'

const ROLE_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  ROLE_ADMIN:    { label: 'Admin',    bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-700' },
  ROLE_CUSTOMER: { label: 'Customer', bg: 'bg-zinc-100 dark:bg-zinc-800',       text: 'text-zinc-600 dark:text-zinc-400',     border: 'border-zinc-200 dark:border-zinc-700' },
}

const ORDER_STATUS_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  PENDING:    { label: 'รอชำระ',    bg: 'bg-amber-50 dark:bg-amber-900/20',  text: 'text-amber-700 dark:text-amber-400',  border: 'border-amber-200 dark:border-amber-700' },
  PAID:       { label: 'ชำระแล้ว', bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-700 dark:text-blue-400',    border: 'border-blue-200 dark:border-blue-700' },
  SHIPPED:    { label: 'จัดส่งแล้ว', bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-400',   border: 'border-teal-200 dark:border-teal-700' },
  DELIVERED:  { label: 'ส่งถึงแล้ว', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-700' },
  CANCELLED:  { label: 'ยกเลิก',    bg: 'bg-zinc-100 dark:bg-zinc-800',      text: 'text-zinc-500 dark:text-zinc-400',    border: 'border-zinc-200 dark:border-zinc-700' },
}

function roleMeta(role: string) {
  return ROLE_META[role] ?? { label: role.replace('ROLE_', ''), bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400', border: 'border-zinc-200 dark:border-zinc-700' }
}

function orderStatusMeta(status: string) {
  return ORDER_STATUS_META[status] ?? { label: status, bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400', border: 'border-zinc-200 dark:border-zinc-700' }
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3" />
        <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2" />
      </div>
      <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
    </div>
  )
}

interface OrdersDrawerProps {
  user: AdminUser
  onClose: () => void
}

function OrdersDrawer({ user, onClose }: OrdersDrawerProps) {
  const [orders, setOrders]   = useState<StoreOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    userApi.getUserOrders(user.id).then(data => {
      if (!cancelled) { setOrders(data); setLoading(false) }
    }).catch(() => {
      if (!cancelled) { setError('โหลดออเดอร์ไม่สำเร็จ'); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [user.id])

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 dark:bg-black/50" />

      {/* Drawer panel */}
      <div
        className="w-full max-w-md bg-white dark:bg-zinc-900 h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{user.name}</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Orders list */}
        <div className="flex-1 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
            <ShoppingBag size={12} />
            ออเดอร์ทั้งหมด
          </p>

          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-500">
              <ShoppingBag size={32} className="mb-2 opacity-30" />
              <p className="text-sm">ยังไม่มีออเดอร์</p>
            </div>
          )}

          {!loading && orders.map(order => {
            const sm = orderStatusMeta(order.status)
            const total = order.totalAmount ?? 0
            return (
              <div
                key={order.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">
                      #{order.orderKey ?? order.id}
                    </p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('th-TH') : '—'}
                      {order.trackingNumber && (
                        <span className="ml-2 font-mono">{order.trackingNumber}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${sm.bg} ${sm.text} ${sm.border}`}>
                      {sm.label}
                    </span>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 tabular-nums">
                      ฿{total.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {order.items && order.items.length > 0 && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-2 space-y-1">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-600 dark:text-zinc-400 truncate flex-1 min-w-0 mr-2">
                          {item.productName}
                          {item.variation && <span className="text-zinc-400 ml-1">({item.variation})</span>}
                        </span>
                        <span className="flex-shrink-0 text-zinc-500 dark:text-zinc-400 tabular-nums">
                          ×{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {order.shippingAddress && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-2">
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{order.shippingAddress}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Users() {
  const [users, setUsers]           = useState<AdminUser[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set())
  const [confirmId, setConfirmId]   = useState<number | null>(null)
  const [ordersUser, setOrdersUser] = useState<AdminUser | null>(null)
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    userApi.listAll()
      .then(data => { setUsers(data); setLoading(false) })
      .catch(() => { setError('โหลดผู้ใช้ไม่สำเร็จ'); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = useCallback(async (userId: number) => {
    setConfirmId(null)
    setDeletingIds(prev => new Set(prev).add(userId))
    try {
      await userApi.deleteUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch {
      setError('ลบผู้ใช้ไม่สำเร็จ')
    } finally {
      setDeletingIds(prev => { const n = new Set(prev); n.delete(userId); return n })
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = q
      ? users.filter(u =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.username ?? '').toLowerCase().includes(q)
        )
      : users
    return [...list].sort((a, b) =>
      sortDir === 'asc' ? a.id - b.id : b.id - a.id
    )
  }, [users, search, sortDir])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / อีเมล / username..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <button
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          title={sortDir === 'asc' ? 'เรียงจากใหม่ไปเก่า' : 'เรียงจากเก่าไปใหม่'}
          className="flex items-center gap-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          ID {sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          รีเฟรช
        </button>
      </div>

      {/* Count */}
      <p className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
        {filtered.length < users.length
          ? `${filtered.length.toLocaleString()} / ${users.length.toLocaleString()} รายการ`
          : `${users.length.toLocaleString()} รายการ`}
      </p>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {error}
          <button onClick={() => setError('')} className="ml-3 underline text-xs">ปิด</button>
        </div>
      )}

      {/* Skeleton */}
      {loading && users.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-400 dark:text-zinc-500">
          <p className="text-sm font-medium">ไม่พบผู้ใช้</p>
        </div>
      )}

      {/* User list */}
      {filtered.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {filtered.map(user => {
            const rm = roleMeta(user.role)
            const isDeleting = deletingIds.has(user.id)
            const isConfirming = confirmId === user.id

            return (
              <div key={user.id} className="flex items-center gap-3 px-4 py-3.5">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none">
                  {user.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                      {user.name}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${rm.bg} ${rm.text} ${rm.border}`}>
                      {rm.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                    {user.email}
                    <span className="text-zinc-300 dark:text-zinc-700 mx-1">·</span>
                    <span className="font-mono">ID {user.id}</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* View orders */}
                  <button
                    onClick={() => setOrdersUser(user)}
                    title="ดูออเดอร์"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    <ShoppingBag size={11} />
                    ออเดอร์
                  </button>

                  {/* Delete — two-step confirm */}
                  {isConfirming ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={isDeleting}
                        className="px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-red-500 text-white text-[11px] font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? '...' : 'ยืนยัน'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(user.id)}
                      disabled={isDeleting}
                      title="ลบผู้ใช้"
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Orders drawer */}
      {ordersUser && (
        <OrdersDrawer user={ordersUser} onClose={() => setOrdersUser(null)} />
      )}
    </div>
  )
}
