import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Receipt, Search, RefreshCw, Package, Clock,
  ChevronDown, ChevronUp, PlayCircle, PackageCheck,
  Truck, CheckSquare, Square, Trash2, AlertTriangle,
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
  PAID:      { label: 'ดำเนินการสั่งซื้อ', status: 'PREPARING', icon: <PlayCircle size={12} />,    color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  PREPARING: { label: 'พร้อมจัดส่งแล้ว',   status: 'SHIPPING',  icon: <PackageCheck size={12} />, color: 'bg-violet-600 hover:bg-violet-700 text-white' },
  SHIPPING:  null,
  SHIPPED:   null, DELIVERED: null, PENDING: null, EXPIRED: null, CANCELLED: null,
}

function getStatusMeta(status: string) {
  return STATUS_META[status?.toUpperCase()] ?? {
    label: status, bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400',
    dot: 'bg-zinc-400', border: 'border-zinc-200 dark:border-zinc-700',
  }
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
  const [orders, setOrders]             = useState<StoreOrder[]>([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PAID')
  const [expandedId, setExpandedId]     = useState<number | null>(null)
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
    <div className="space-y-3">

      <AnimatePresence>
        {showConfirm && (
          <ConfirmModal
            count={selectedIds.length}
            onConfirm={handleBulkDelete}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Toolbar ── */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg flex-shrink-0">
            <Receipt size={14} className="text-white" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex-1">
            คำสั่งซื้อเว็บไซต์
          </h2>
          <span className="text-xs text-zinc-400 tabular-nums">{orders.length} รายการ</span>
        </div>

        {/* Search + actions */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            title={allSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
            className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer flex-shrink-0"
          />
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหา เลขออเดอร์ / ที่อยู่ / สินค้า"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={bulkDeleting}
              className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors disabled:opacity-50 flex-shrink-0 whitespace-nowrap flex items-center gap-1"
            >
              <Trash2 size={11} /> {bulkDeleting ? 'กำลังลบ...' : `ลบ (${selectedIds.length})`}
            </button>
          )}
          <button
            onClick={loadOrders}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-blue-500' : ''} />
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
          {STATUS_FILTERS.map(f => {
            const count = tabCounts[f.value === 'ALL' ? 'ALL' : f.value] ?? 0
            return (
              <button
                key={f.value}
                onClick={() => { setStatusFilter(f.value); setSelectedIds([]) }}
                className={`flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  statusFilter === f.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className={`text-[10px] tabular-nums px-1 rounded-full leading-tight ${
                    statusFilter === f.value
                      ? 'bg-white/25 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && orders.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3" />
                <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2" />
              </div>
              <div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredOrders.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-400 dark:text-zinc-500">
          <Package size={40} className="opacity-30" />
          <p className="text-sm font-medium">ไม่พบรายการ</p>
        </div>
      )}

      {/* ── Order rows ── */}
      {filteredOrders.map(order => {
        const meta      = getStatusMeta(order.status)
        const action    = NEXT_ACTION[order.status?.toUpperCase()] ?? null
        const isExp     = expandedId === order.id
        const isChecked = selectedIds.includes(order.id)
        const timeStr   = new Date(order.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        const dateStr   = new Date(order.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })

        return (
          <div key={order.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">

            {/* Header row */}
            <div className="flex items-stretch">

              {/* Checkbox */}
              <label className="flex items-center px-3 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSelect(order.id)}
                  className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                />
              </label>

              {/* Main area */}
              <button
                className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors min-w-0 overflow-hidden"
                onClick={() => setExpandedId(isExp ? null : order.id)}
              >
                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${meta.dot}`} />

                {/* Order key */}
                <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[130px] flex-shrink-0">
                  {order.orderKey || `#${order.id}`}
                </span>

                {/* Status badge */}
                <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${meta.bg} ${meta.text} ${meta.border}`}>
                  <span className={`w-1 h-1 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>

                {/* Amount */}
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex-shrink-0">
                  ฿{order.totalAmount.toLocaleString()}
                </span>

                {/* Items count */}
                <span className="text-[11px] text-zinc-400 flex-shrink-0">
                  {order.items?.length ?? 0} ชิ้น
                </span>

                {/* Spacer */}
                <span className="flex-1" />

                {/* Date */}
                <span className="flex-shrink-0 flex items-center gap-1 text-[10px] text-zinc-400">
                  <Clock size={9} /> {timeStr} · {dateStr}
                </span>

                {/* Expand */}
                <span className="flex-shrink-0 text-zinc-400">
                  {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>

              {/* Action button */}
              {action && (
                <button
                  onClick={e => { e.stopPropagation(); handleChangeStatus(order.id, action.status) }}
                  disabled={changingId === order.id}
                  className={`flex items-center gap-1 px-3 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 border-l border-zinc-100 dark:border-zinc-800 ${action.color}`}
                >
                  {changingId === order.id ? <RefreshCw size={11} className="animate-spin" /> : action.icon}
                  <span className="hidden sm:inline">{action.label}</span>
                </button>
              )}
            </div>

            {/* Expanded detail */}
            {isExp && (
              <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 space-y-3 bg-zinc-50/50 dark:bg-zinc-800/30">

                {/* Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">ที่อยู่จัดส่ง</p>
                    <p className="text-zinc-700 dark:text-zinc-300">{order.shippingAddress || '—'}</p>
                  </div>
                  {order.trackingNumber && (
                    <div>
                      <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">เลขพัสดุ</p>
                      <p className="font-mono text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                        <Truck size={11} className="text-zinc-400" /> {order.trackingNumber}
                      </p>
                    </div>
                  )}
                  {order.appliedCoupon && (
                    <div>
                      <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">คูปอง</p>
                      <p className="font-mono text-zinc-700 dark:text-zinc-300">{order.appliedCoupon}</p>
                    </div>
                  )}
                  {order.taxAmount > 0 && (
                    <div>
                      <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">ภาษี</p>
                      <p className="text-zinc-700 dark:text-zinc-300">฿{order.taxAmount.toLocaleString()}</p>
                    </div>
                  )}
                  {order.cancelReason && (
                    <div className="sm:col-span-2">
                      <p className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">เหตุผลยกเลิก</p>
                      <p className="text-rose-600 dark:text-rose-400">{order.cancelReason}</p>
                    </div>
                  )}
                </div>

                {/* Items table */}
                {order.items && order.items.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <table className="w-full text-xs min-w-[360px]">
                      <thead className="bg-zinc-100 dark:bg-zinc-800">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-zinc-400 uppercase tracking-wider">สินค้า</th>
                          <th className="text-left px-3 py-2 font-semibold text-zinc-400 uppercase tracking-wider w-16">จำนวน</th>
                          <th className="text-left px-3 py-2 font-semibold text-zinc-400 uppercase tracking-wider w-24">ราคา</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {order.items.map(item => (
                          <tr key={item.id} className="bg-white dark:bg-zinc-900">
                            <td className="px-3 py-2">
                              <p className="text-zinc-800 dark:text-zinc-200 font-medium leading-snug">{item.productName}</p>
                              {item.variation && <p className="text-zinc-400 text-[10px] mt-0.5">{item.variation}</p>}
                            </td>
                            <td className="px-3 py-2 font-bold text-zinc-700 dark:text-zinc-200 tabular-nums">{item.quantity}</td>
                            <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                              ฿{(item.price * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Status flow actions (full set) */}
                {action && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleChangeStatus(order.id, action.status)}
                      disabled={changingId === order.id}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 ${action.color}`}
                    >
                      {changingId === order.id ? <RefreshCw size={12} className="animate-spin" /> : action.icon}
                      {action.label}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Selection toast */}
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
                  className="px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-600 transition-colors flex items-center gap-1 font-medium"
                >
                  <Trash2 size={11} /> ลบ
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
