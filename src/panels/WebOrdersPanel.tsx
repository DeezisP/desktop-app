import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Receipt, Search, RefreshCw, Package, Clock,
  ChevronRight, PlayCircle, PackageCheck,
  CheckSquare, Square, Trash2, AlertTriangle,
} from 'lucide-react'
import { storeOrdersApi, type StoreOrder } from '../api/warehouse'

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | 'PAID' | 'PREPARING' | 'SHIPPING' | 'DELIVERED' | 'EXPIRED' | 'CANCELLED'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL',       label: 'ทั้งหมด' },
  { value: 'PAID',      label: 'ใหม่' },
  { value: 'PREPARING', label: 'จัดเตรียม' },
  { value: 'SHIPPING',  label: 'จัดส่ง' },
  { value: 'DELIVERED', label: 'รับแล้ว' },
  { value: 'EXPIRED',   label: 'หมดอายุ' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
]

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  PAID:      { label: 'สั่งซื้อสำเร็จ',       bg: 'bg-emerald-50 dark:bg-emerald-900/20',  text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
  PREPARING: { label: 'กำลังจัดเตรียมสินค้า', bg: 'bg-blue-50 dark:bg-blue-900/20',        text: 'text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500',    border: 'border-blue-200 dark:border-blue-800'       },
  SHIPPING:  { label: 'จัดส่งแล้ว',           bg: 'bg-violet-50 dark:bg-violet-900/20',    text: 'text-violet-700 dark:text-violet-400',   dot: 'bg-violet-500',  border: 'border-violet-200 dark:border-violet-800'   },
  SHIPPED:   { label: 'จัดส่งแล้ว',           bg: 'bg-violet-50 dark:bg-violet-900/20',    text: 'text-violet-700 dark:text-violet-400',   dot: 'bg-violet-500',  border: 'border-violet-200 dark:border-violet-800'   },
  DELIVERED: { label: 'ส่งถึงผู้รับแล้ว',     bg: 'bg-teal-50 dark:bg-teal-900/20',        text: 'text-teal-700 dark:text-teal-400',       dot: 'bg-teal-500',    border: 'border-teal-200 dark:border-teal-800'       },
  PENDING:   { label: 'รอชำระ',               bg: 'bg-amber-50 dark:bg-amber-900/20',      text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',   border: 'border-amber-200 dark:border-amber-800'     },
  EXPIRED:   { label: 'หมดอายุ',              bg: 'bg-rose-50 dark:bg-rose-900/20',        text: 'text-rose-700 dark:text-rose-400',       dot: 'bg-rose-500',    border: 'border-rose-200 dark:border-rose-800'       },
  CANCELLED: { label: 'ยกเลิกแล้ว',          bg: 'bg-zinc-100 dark:bg-zinc-800',          text: 'text-zinc-600 dark:text-zinc-400',       dot: 'bg-zinc-400',    border: 'border-zinc-200 dark:border-zinc-700'       },
}

const NEXT_ACTION: Record<string, { label: string; status: string; icon: React.ReactNode; color: string } | null> = {
  PAID:      { label: 'ดำเนินการสั่งซื้อ', status: 'PREPARING', icon: <PlayCircle size={13} />,    color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  PREPARING: { label: 'พร้อมจัดส่งแล้ว',   status: 'SHIPPING',  icon: <PackageCheck size={13} />, color: 'bg-violet-600 hover:bg-violet-700 text-white' },
  SHIPPING:  null,
  SHIPPED: null, DELIVERED: null, PENDING: null, EXPIRED: null, CANCELLED: null,
}

function getStatusMeta(status: string) {
  return STATUS_META[status?.toUpperCase()] ?? {
    label: status, bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400',
    dot: 'bg-zinc-400', border: 'border-zinc-200 dark:border-zinc-700',
  }
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = getStatusMeta(status)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ count, onConfirm, onCancel }: { count: number; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 w-full max-w-sm p-6"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
            <AlertTriangle size={22} className="text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">ยืนยันการลบ</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              คุณต้องการลบ <span className="font-semibold text-rose-600">{count} รายการ</span> นี้ใช่หรือไม่?
              <br />การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
          </div>
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 size={14} /> ลบรายการ
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function WebOrdersPanel() {
  const navigate = useNavigate()

  const [orders, setOrders]             = useState<StoreOrder[]>([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PAID')
  const [changingId, setChangingId]     = useState<number | null>(null)
  const [selectedIds, setSelectedIds]   = useState<number[]>([])
  const [showConfirm, setShowConfirm]   = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await storeOrdersApi.getAll()
      setOrders(data)
    } catch {
      setError('โหลดคำสั่งซื้อไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const handleChangeStatus = useCallback(async (orderId: number, newStatus: string) => {
    setChangingId(orderId)
    try {
      await storeOrdersApi.updateStatus(orderId, newStatus)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
    } catch { /* silent */ }
    finally { setChangingId(null) }
  }, [])

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }, [])

  const handleBulkDelete = useCallback(async () => {
    if (!selectedIds.length) return
    setBulkDeleting(true)
    setShowConfirm(false)
    try {
      await storeOrdersApi.bulkDelete(selectedIds)
      setOrders(prev => prev.filter(o => !selectedIds.includes(o.id)))
      setSelectedIds([])
    } catch { /* silent */ }
    finally { setBulkDeleting(false) }
  }, [selectedIds])

  // ── Derived ────────────────────────────────────────────────────────────────

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: orders.length }
    orders.forEach(o => {
      const s = o.status?.toUpperCase()
      if (s) counts[s] = (counts[s] ?? 0) + 1
    })
    return counts
  }, [orders])

  const filteredOrders = useMemo(() => {
    const term = search.toLowerCase().trim()
    return orders
      .filter(o => {
        const matchStatus = statusFilter === 'ALL' || o.status?.toUpperCase() === statusFilter
        if (!matchStatus) return false
        if (!term) return true
        return (
          o.orderKey?.toLowerCase().includes(term) ||
          String(o.id).includes(term) ||
          o.shippingAddress?.toLowerCase().includes(term) ||
          o.items?.some(i => i.productName.toLowerCase().includes(term))
        )
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [orders, search, statusFilter])

  const allSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedIds.includes(o.id))

  const toggleAll = () => {
    if (allSelected) setSelectedIds([])
    else setSelectedIds(filteredOrders.map(o => o.id))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col h-full">
      <style>{`.no-sb::-webkit-scrollbar{display:none}.no-sb{-ms-overflow-style:none;scrollbar-width:none}`}</style>

      <AnimatePresence>
        {showConfirm && (
          <ConfirmModal
            count={selectedIds.length}
            onConfirm={handleBulkDelete}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Top Bar ── */}
      <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 bg-blue-600 rounded-xl"><Receipt size={18} className="text-white" /></div>
            <div>
              <h1 className="font-medium text-slate-900 dark:text-zinc-100 text-base leading-tight">คำสั่งซื้อเว็บไซต์</h1>
              <p className="text-xs text-slate-400 dark:text-zinc-500">ทั้งหมด {orders.length} รายการ</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={15} />
              <input
                type="text"
                placeholder="ค้นหา..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl text-sm w-full sm:w-52 focus:ring-2 focus:ring-blue-500/30 outline-none focus:bg-white dark:focus:bg-zinc-700 border border-transparent focus:border-blue-200 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500 transition-all"
              />
            </div>
            <button
              onClick={loadOrders}
              disabled={loading}
              className="p-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition-colors flex-shrink-0 disabled:opacity-50"
              title="รีเฟรช"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-blue-500' : 'text-slate-500 dark:text-zinc-400'} />
            </button>
          </div>
        </div>
      </div>

      {/* ── List Panel ── */}
      <div className="relative flex flex-col flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* Filter Tabs */}
        <div className="px-4 pt-3 pb-0 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex gap-1 overflow-x-auto no-sb">
            {STATUS_FILTERS.map(f => {
              const count = tabCounts[f.value === 'ALL' ? 'ALL' : f.value] ?? 0
              return (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setSelectedIds([]) }}
                  className={`relative px-3 py-2 text-xs font-normal rounded-t-lg border-b-2 flex-shrink-0 transition-all flex items-center gap-1.5 ${
                    statusFilter === f.value
                      ? 'text-blue-600 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20'
                      : 'text-slate-400 dark:text-zinc-500 border-transparent hover:text-slate-600 dark:hover:text-zinc-300'
                  }`}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold ${
                      statusFilter === f.value ? 'bg-blue-600 text-white' : 'bg-rose-500 text-white'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Table Header — desktop only */}
        <div className="hidden sm:flex px-4 py-2.5 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800 items-center gap-3 flex-shrink-0">
          <button onClick={toggleAll} className="w-4 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors flex-shrink-0">
            {allSelected
              ? <CheckSquare size={16} className="text-blue-600" />
              : <Square size={16} />}
          </button>
          <div className="grid grid-cols-4 flex-1 gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500 min-w-0">
            <span>รหัส / เวลา</span>
            <span>สถานะ</span>
            <span>ยอดรวม</span>
            <span></span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400 flex-shrink-0">
            {error}
          </div>
        )}

        {/* Order Rows */}
        <div className="no-sb flex-1 overflow-y-auto bg-white dark:bg-zinc-900">
          {loading && orders.length === 0 ? (
            <div className="space-y-px pt-px">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-4 bg-white dark:bg-zinc-900 border-b border-slate-50 dark:border-zinc-800 flex items-center gap-3 animate-pulse">
                  <div className="w-4 h-4 rounded bg-slate-100 dark:bg-zinc-700 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-100 dark:bg-zinc-700 rounded w-48" />
                    <div className="h-3 bg-slate-100 dark:bg-zinc-700 rounded w-24" />
                  </div>
                  <div className="h-6 bg-slate-100 dark:bg-zinc-700 rounded w-24" />
                  <div className="h-8 bg-slate-100 dark:bg-zinc-700 rounded w-20" />
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-zinc-600">
              <Package size={44} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">ไม่พบรายการ</p>
            </div>
          ) : (
            filteredOrders.map(order => (
              <OrderRow
                key={order.id}
                order={order}
                isChecked={selectedIds.includes(order.id)}
                isChanging={changingId === order.id}
                onCheck={e => { e.stopPropagation(); toggleSelect(order.id) }}
                onNavigate={() => navigate(`/web-orders/${order.id}`, { state: { order } })}
                onAction={handleChangeStatus}
              />
            ))
          )}
        </div>

        {/* ── Selection toast ── */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50"
            >
              <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900 dark:bg-zinc-800 text-white rounded-lg shadow-xl border border-white/10 text-xs whitespace-nowrap">
                <span className="text-zinc-400">
                  เลือก <span className="text-white font-semibold">{selectedIds.length}</span> รายการ
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-zinc-300"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={bulkDeleting}
                    className="px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-600 transition-colors flex items-center gap-1 font-medium disabled:opacity-50"
                  >
                    <Trash2 size={11} /> {bulkDeleting ? 'กำลังลบ...' : 'ลบ'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── OrderRow ──────────────────────────────────────────────────────────────────

function OrderRow({
  order, isChecked, isChanging, onCheck, onNavigate, onAction,
}: {
  order: StoreOrder
  isChecked: boolean
  isChanging: boolean
  onCheck: (e: React.MouseEvent) => void
  onNavigate: () => void
  onAction: (orderId: number, newStatus: string) => void
}) {
  const action  = NEXT_ACTION[order.status?.toUpperCase()] ?? null
  const timeStr = new Date(order.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  const dateStr = new Date(order.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })

  return (
    <div className="border-b border-slate-50 dark:border-zinc-800 last:border-0 bg-white dark:bg-zinc-900">
      <div
        onClick={onNavigate}
        className="group flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/70 transition-colors"
      >
        <button onClick={onCheck} className="text-slate-300 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors flex-shrink-0">
          {isChecked ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
        </button>

        {/* ── Mobile layout ── */}
        <div className="sm:hidden flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-800 dark:text-zinc-100 truncate">{order.orderKey || `#${order.id}`}</p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {action && (
                <button
                  onClick={e => { e.stopPropagation(); onAction(order.id, action.status) }}
                  disabled={isChanging}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium active:scale-95 disabled:opacity-50 transition-all ${action.color}`}
                >
                  {isChanging ? <RefreshCw size={11} className="animate-spin" /> : action.icon}
                  {action.label}
                </button>
              )}
              <ChevronRight size={14} className="text-slate-300 dark:text-zinc-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={order.status} />
            <span className="text-xs font-medium text-slate-700 dark:text-zinc-200">฿{order.totalAmount.toLocaleString()}</span>
            <span className="text-[11px] text-slate-400">{order.items?.length ?? 0} ชิ้น</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
            <Clock size={9} /> {timeStr} · {dateStr}
          </p>
          {order.status?.toUpperCase() === 'CANCELLED' && order.cancelReason && (
            <p className="text-[10px] text-red-400 truncate">{order.cancelReason}</p>
          )}
        </div>

        {/* ── Desktop layout ── */}
        <div className="hidden sm:grid grid-cols-4 flex-1 gap-2 items-center min-w-0">
          {/* Key + time */}
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-800 dark:text-zinc-100 truncate">{order.orderKey || `#${order.id}`}</p>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1">
              <Clock size={9} /> {timeStr} · {dateStr}
            </p>
          </div>

          {/* Status */}
          <div className="min-w-0">
            <StatusBadge status={order.status} />
            {order.status?.toUpperCase() === 'CANCELLED' && order.cancelReason && (
              <p className="text-[10px] text-red-400 mt-1 truncate max-w-[140px]" title={order.cancelReason}>
                {order.cancelReason}
              </p>
            )}
          </div>

          {/* Amount */}
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-zinc-100">฿{order.totalAmount.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">{order.items?.length ?? 0} ชิ้น</p>
          </div>

          {/* Action */}
          <div className="flex items-center gap-2 justify-end">
            {action && (
              <button
                onClick={e => { e.stopPropagation(); onAction(order.id, action.status) }}
                disabled={isChanging}
                title={action.label}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 ${action.color}`}
              >
                {isChanging ? <RefreshCw size={11} className="animate-spin" /> : action.icon}
                {action.label}
              </button>
            )}
            <ChevronRight size={14} className="text-slate-300 dark:text-zinc-600 group-hover:text-slate-400 dark:group-hover:text-zinc-400 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  )
}
