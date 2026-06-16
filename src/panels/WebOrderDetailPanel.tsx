import React, { useEffect, useRef, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Receipt, Truck, Copy, Check, FileText,
  Trash2, X, TrendingUp, Clock, Tag, MessageSquare,
  Printer, Download, PlayCircle, PackageCheck, RefreshCw,
  Package, ChevronRight, CheckCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { storeOrdersApi, type StoreOrder, type StoreOrderItem } from '../api/warehouse'
import { Skeleton, CardSkeleton } from '../components/Skeleton'

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCOUNT_RATE = 1  // no discount applied; prices are already final

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  PAID:      { label: 'สั่งซื้อสำเร็จ',          bg: 'bg-emerald-50 dark:bg-emerald-900/20',  text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
  PREPARING: { label: 'กำลังจัดเตรียมสินค้า',    bg: 'bg-blue-50 dark:bg-blue-900/20',        text: 'text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500',    border: 'border-blue-200 dark:border-blue-800'       },
  SHIPPING:  { label: 'จัดส่งแล้ว',              bg: 'bg-violet-50 dark:bg-violet-900/20',    text: 'text-violet-700 dark:text-violet-400',   dot: 'bg-violet-500',  border: 'border-violet-200 dark:border-violet-800'   },
  SHIPPED:   { label: 'จัดส่งแล้ว',              bg: 'bg-violet-50 dark:bg-violet-900/20',    text: 'text-violet-700 dark:text-violet-400',   dot: 'bg-violet-500',  border: 'border-violet-200 dark:border-violet-800'   },
  DELIVERED: { label: 'ส่งถึงผู้รับแล้ว',        bg: 'bg-teal-50 dark:bg-teal-900/20',        text: 'text-teal-700 dark:text-teal-400',       dot: 'bg-teal-500',    border: 'border-teal-200 dark:border-teal-800'       },
  PENDING:   { label: 'รอชำระ',                  bg: 'bg-amber-50 dark:bg-amber-900/20',      text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',   border: 'border-amber-200 dark:border-amber-800'     },
  EXPIRED:   { label: 'หมดอายุ',                 bg: 'bg-rose-50 dark:bg-rose-900/20',        text: 'text-rose-700 dark:text-rose-400',       dot: 'bg-rose-500',    border: 'border-rose-200 dark:border-rose-800'       },
  CANCELLED: { label: 'ยกเลิกแล้ว',             bg: 'bg-slate-100 dark:bg-zinc-800',         text: 'text-slate-600 dark:text-zinc-400',      dot: 'bg-slate-400',   border: 'border-slate-200 dark:border-zinc-700'      },
}

const getStatus = (s: string) =>
  STATUS_CONFIG[s?.toUpperCase()] ?? { label: s, bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-200' }

function StatusBadge({ status }: { status: string }) {
  const cfg = getStatus(status)
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

const NEXT_ACTION: Record<string, { label: string; status: string; icon: React.ReactNode; color: string } | null> = {
  PAID:      { label: 'ดำเนินการสั่งซื้อ',       status: 'PREPARING', icon: <PlayCircle size={15} />,    color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  PREPARING: { label: 'พร้อมจัดส่งแล้ว',         status: 'SHIPPING',  icon: <PackageCheck size={15} />, color: 'bg-violet-600 hover:bg-violet-700 text-white' },
  SHIPPING:  { label: 'ลูกค้ารับสินค้าแล้ว',     status: 'DELIVERED', icon: <CheckCircle size={15} />,  color: 'bg-teal-600 hover:bg-teal-700 text-white' },
  SHIPPED:   { label: 'ลูกค้ารับสินค้าแล้ว',     status: 'DELIVERED', icon: <CheckCircle size={15} />,  color: 'bg-teal-600 hover:bg-teal-700 text-white' },
  DELIVERED: null, PENDING: null, EXPIRED: null, CANCELLED: null,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanVariation(v: string): string {
  try {
    const parsed = JSON.parse(v)
    if (parsed && typeof parsed === 'object') {
      return Object.values(parsed).map((val: unknown) => String(val).replace(/-/g, ' ')).join(', ')
    }
  } catch {}
  return v.replace(/-/g, ' ')
}

const calcSubtotal = (items: StoreOrderItem[] = []) => items.reduce((s, i) => s + i.price * i.quantity, 0)
const calcOriginal = (items: StoreOrderItem[] = []) => items.reduce((s, i) => s + (i.price / DISCOUNT_RATE) * i.quantity, 0)
const getShipping  = (order: StoreOrder) => order.totalAmount < 530 && order.totalAmount > 0 ? 30 : 0

// ── Shipping Label ────────────────────────────────────────────────────────────

const ShippingLabel = React.forwardRef<HTMLDivElement, { order: StoreOrder }>(({ order }, ref) => {
  const address = order.shippingAddress || ''
  const parts = address.split(',').map(s => s.trim())
  const name = parts.slice(0, 2).join(' ')
  const addr = parts.slice(2).join(', ')

  return (
    <div ref={ref} style={{ width: '105mm', minHeight: '148mm', padding: '6mm', fontFamily: 'sans-serif', backgroundColor: '#fff', color: '#000', boxSizing: 'border-box' }}>
      <div style={{ borderBottom: '2px solid #000', paddingBottom: '3mm', marginBottom: '4mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '14pt', letterSpacing: '0.5px' }}>Perfect Electronic</div>
          <div style={{ fontSize: '7.5pt', color: '#000', marginTop: '1mm' }}>
            วันที่: {new Date(order.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '7pt', color: '#000' }}>เลขพัสดุ</div>
          <div style={{ fontSize: '9pt', fontWeight: 700, fontFamily: 'monospace' }}>{order.trackingNumber || '-'}</div>
        </div>
      </div>

      <div style={{ fontSize: '7pt', color: '#000', fontWeight: 700, marginBottom: '1mm' }}>ผู้ส่ง</div>
      <div style={{ fontSize: '8pt', marginBottom: '4mm', lineHeight: 1.4 }}>
        <div style={{ fontWeight: 600 }}>เพอร์เฟค อิเล็กทรอนิกส์</div>
        <div>กรุงเทพมหานคร, ประเทศไทย</div>
        <div>โทร: 088-683-7697</div>
      </div>

      <div style={{ fontSize: '7pt', color: '#000', fontWeight: 700, marginBottom: '1mm' }}>ผู้รับ</div>
      <div style={{ border: '1.5px solid #000', padding: '3mm', marginBottom: '4mm', minHeight: '24mm' }}>
        <div style={{ fontWeight: 700, fontSize: '10pt', marginBottom: '1.5mm' }}>{name || address}</div>
        {addr && <div style={{ fontSize: '8pt', lineHeight: 1.5 }}>{addr}</div>}
      </div>

      <div style={{ fontSize: '7pt', color: '#000', fontWeight: 700, marginBottom: '1.5mm' }}>รายละเอียดสินค้า</div>
      <div style={{ border: '1px solid #000', overflow: 'hidden', marginBottom: '3mm' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
          <thead>
            <tr style={{ background: '#f0f0f0', borderBottom: '1px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '1.5mm', fontWeight: 700, borderRight: '1px solid #000', color: '#000' }}>สินค้า</th>
              <th style={{ textAlign: 'left', padding: '1.5mm', fontWeight: 700, borderRight: '1px solid #000', width: '28mm', color: '#000' }}>ตัวเลือก</th>
              <th style={{ textAlign: 'center', padding: '1.5mm', fontWeight: 700, width: '12mm', color: '#000' }}>จำนวน</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: i < (order.items?.length ?? 0) - 1 ? '1px solid #ddd' : 'none' }}>
                <td style={{ padding: '1.5mm', borderRight: '1px solid #000', lineHeight: 1.3, fontWeight: 600, color: '#000' }}>
                  {item.productName}
                </td>
                <td style={{ padding: '1.5mm', borderRight: '1px solid #000', fontSize: '7pt', color: '#000', lineHeight: 1.3 }}>
                  {item.variation ? cleanVariation(item.variation) : '-'}
                </td>
                <td style={{ padding: '1.5mm', textAlign: 'center', fontWeight: 700, color: '#000' }}>
                  {item.quantity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ borderTop: '1px solid #000', paddingTop: '2.5mm', textAlign: 'center' }}>
        <div style={{ fontSize: '7pt', color: '#000' }}>ขอบคุณที่ใช้บริการ เพอร์เฟค อิเล็กทรอนิกส์</div>
      </div>
    </div>
  )
})
ShippingLabel.displayName = 'ShippingLabel'

async function exportLabelPDF(order: StoreOrder, labelRef: React.RefObject<HTMLDivElement | null>) {
  if (!labelRef.current) return
  const { default: jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(labelRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' })
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a6' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 105, 148)
  pdf.save(`label-${order.orderKey}.pdf`)
}

async function printLabel(labelRef: React.RefObject<HTMLDivElement | null>) {
  if (!labelRef.current) return
  // Open before any await so popup blockers see it as user-initiated.
  const newWindow = window.open('about:blank', '_blank')
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF } = await import('jspdf')
  const canvas = await html2canvas(labelRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a6' })
  pdf.addImage(imgData, 'PNG', 0, 0, 105, 148)
  const pdfBytes = pdf.output('arraybuffer')
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
  const pdfUrl = URL.createObjectURL(pdfBlob)
  if (newWindow) { newWindow.location.href = pdfUrl; newWindow.focus() }
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 300_000)
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function WebOrderDetailPanel() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const labelRef = useRef<HTMLDivElement>(null)

  const [order, setOrder]               = useState<StoreOrder | null>((location.state as { order?: StoreOrder })?.order ?? null)
  const [loading, setLoading]           = useState(!order)
  const [trackingInput, setTrackingInput] = useState(order?.trackingNumber || '')
  const [isSavingTracking, setIsSavingTracking] = useState(false)
  const [copiedField, setCopiedField]   = useState<string | null>(null)
  const [isDeletingItem, setIsDeletingItem] = useState<number | null>(null)
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [showPrintPanel, setShowPrintPanel] = useState(false)
  const [isDeleting, setIsDeleting]     = useState(false)
  const [hasPrinted, setHasPrinted]     = useState(false)
  const [confirmReprint, setConfirmReprint] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    if (order) {
      setTrackingInput(order.trackingNumber || '')
      setHasPrinted(localStorage.getItem(`label_printed_${order.id}`) === '1')
      return
    }
    if (!id) return
    setLoading(true)
    storeOrdersApi.getAll()
      .then(all => {
        const found = all.find(o => o.id === Number(id))
        if (found) {
          setOrder(found)
          setTrackingInput(found.trackingNumber || '')
          setHasPrinted(localStorage.getItem(`label_printed_${found.id}`) === '1')
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  const handlePrint = async () => {
    if (hasPrinted && !confirmReprint) {
      setConfirmReprint(true)
      return
    }
    setConfirmReprint(false)
    await printLabel(labelRef)
    localStorage.setItem(`label_printed_${order!.id}`, '1')
    setHasPrinted(true)
  }

  const handleCopy = (text: string, field: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleUpdateTracking = async () => {
    if (!order || !trackingInput.trim()) return
    setIsSavingTracking(true)
    try {
      await storeOrdersApi.updateTracking(order.id, trackingInput)
      setOrder(prev => prev ? { ...prev, trackingNumber: trackingInput } : null)
    } catch {}
    setIsSavingTracking(false)
  }

  const handleChangeStatus = async (newStatus: string) => {
    if (!order) return
    setIsChangingStatus(true)
    try {
      await storeOrdersApi.updateStatus(order.id, newStatus)
      setOrder(prev => prev ? { ...prev, status: newStatus } : null)
      setShowPrintPanel(true)
    } catch {}
    setIsChangingStatus(false)
  }

  const handleDeleteItem = async (itemId: number) => {
    if (!order) return
    if (!window.confirm('ยืนยันการลบสินค้านี้?')) return
    setIsDeletingItem(itemId)
    const updatedItems = order.items?.filter(i => i.id !== itemId) || []
    try {
      await storeOrdersApi.updateItems(order.id, updatedItems)
      setOrder(prev => prev ? { ...prev, items: updatedItems } : null)
    } catch {}
    setIsDeletingItem(null)
  }

  const handleAdminCancel = async () => {
    if (!order || !cancelReason.trim()) return
    setIsCancelling(true)
    try {
      await storeOrdersApi.cancelOrder(order.id, cancelReason.trim())
      setOrder(prev => prev ? { ...prev, status: 'CANCELLED', cancelReason: cancelReason.trim() } : null)
      setShowCancelModal(false)
      setCancelReason('')
    } catch {}
    setIsCancelling(false)
  }

  const handleDeleteOrder = async () => {
    if (!order) return
    if (!window.confirm('ยืนยันการลบคำสั่งซื้อนี้?')) return
    setIsDeleting(true)
    try {
      await storeOrdersApi.deleteOrder(order.id)
      navigate('/web-orders')
    } catch {}
    setIsDeleting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-zinc-950">
        <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-10">
          <div className="px-6 py-3 flex items-center gap-4">
            <Skeleton className="h-4 w-10" />
            <div className="h-4 w-px bg-slate-200 dark:bg-zinc-700" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-28 rounded-full ml-1" />
          </div>
        </div>
        <div className="px-6 flex gap-4 py-4 items-start">
          <div className="flex-1 min-w-0 space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
                <Skeleton className="h-7 w-32 rounded-full" />
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-zinc-800">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 space-y-2">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-5 space-y-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-4 py-2">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-16 text-center" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="w-80 flex-shrink-0 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <Package size={48} className="text-slate-300" />
        <p className="text-slate-500 font-medium">ไม่พบคำสั่งซื้อ</p>
        <button
          onClick={() => navigate('/web-orders')}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          กลับรายการ
        </button>
      </div>
    )
  }

  const action = NEXT_ACTION[order.status?.toUpperCase()] ?? null
  const canPrintLabel = !['PAID', 'PENDING', 'EXPIRED', 'CANCELLED'].includes(order.status?.toUpperCase())
  const sub       = calcSubtotal(order.items)
  const orig      = calcOriginal(order.items)
  const rateDisc  = orig - sub
  const ship      = getShipping(order)
  const tax       = order.taxAmount || 0
  const couponDisc = Math.max(0, Math.round(sub + ship + tax - order.totalAmount))

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950">
      {/* Hidden label for print */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none">
        <ShippingLabel ref={labelRef} order={order} />
      </div>

      {/* ── Top bar ── */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate('/web-orders')}
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft size={15} /> กลับ
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Receipt size={14} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-200 truncate">{order.orderKey || `#${order.id}`}</span>
            <StatusBadge status={order.status} />
            {order.appliedCoupon && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-medium flex-shrink-0">
                <Tag size={10} /> {order.appliedCoupon}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {action && (
              <button
                onClick={() => handleChangeStatus(action.status)}
                disabled={isChangingStatus}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 disabled:opacity-60 ${action.color}`}
              >
                {isChangingStatus ? <RefreshCw size={14} className="animate-spin" /> : action.icon}
                {action.label}
              </button>
            )}
            {!['CANCELLED', 'DELIVERED'].includes(order.status?.toUpperCase()) && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors border border-rose-200 dark:border-rose-900/40"
              >
                <X size={14} /> ยกเลิกออเดอร์
              </button>
            )}
            <button
              onClick={handleDeleteOrder}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body: two-column ── */}
      <div className="px-6 flex gap-4 py-4 items-start">

        {/* ── Left (main) ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Print panel */}
          <AnimatePresence>
            {showPrintPanel && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                    <Printer size={14} /> อัปเดตสถานะสำเร็จ — พิมพ์ / ดาวน์โหลดใบปะหน้า
                  </span>
                  <button onClick={() => setShowPrintPanel(false)} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800/40 text-blue-400">
                    <X size={13} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Printer size={14} /> พิมพ์ใบปะหน้า
                  </button>
                  <button
                    onClick={() => exportLabelPDF(order, labelRef)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Download size={14} /> ดาวน์โหลด PDF
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cancel reason */}
          {order.status?.toUpperCase() === 'CANCELLED' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-red-500">
                <MessageSquare size={14} /> เหตุผลการยกเลิก
              </div>
              <p className="text-sm text-red-700 dark:text-red-400">
                {order.cancelReason || <span className="italic opacity-60">ไม่ได้ระบุเหตุผล</span>}
              </p>
            </div>
          )}

          {/* Order metadata grid */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
              <StatusBadge status={order.status} />
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-zinc-800">
              {[
                { label: 'เลขที่ออเดอร์', value: order.orderKey || `#${order.id}` },
                { label: 'วันที่สั่งซื้อ', value: new Date(order.createdAt).toLocaleDateString('th-TH', { dateStyle: 'medium' }) },
                { label: 'เวลา',          value: new Date(order.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) },
                { label: 'เลขพัสดุ',     value: order.trackingNumber || '-' },
                { label: 'สกุลเงิน',     value: order.currency || 'THB' },
                { label: 'คูปอง',        value: order.appliedCoupon || '-' },
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-4">
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mb-1">{label}</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-zinc-100 break-all">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tracking input */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-700 dark:text-zinc-200">
              <Truck size={15} className="text-blue-500" /> หมายเลขติดตามพัสดุ
            </div>
            {order.trackingNumber && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg">
                <span className="text-sm font-mono font-medium text-slate-700 dark:text-zinc-200 flex-1">{order.trackingNumber}</span>
                <button onClick={() => handleCopy(order.trackingNumber!, 'track')} className="p-1 text-slate-400 hover:text-blue-500 transition-colors">
                  {copiedField === 'track' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={trackingInput}
                onChange={e => setTrackingInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdateTracking()}
                placeholder="กรอกเลขพัสดุใหม่..."
                className="flex-1 text-sm px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 dark:text-zinc-100 dark:placeholder-zinc-500 transition-all"
              />
              <button
                onClick={handleUpdateTracking}
                disabled={isSavingTracking || !trackingInput.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
              >
                {isSavingTracking ? <RefreshCw size={14} className="animate-spin" /> : 'บันทึก'}
              </button>
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
              <Package size={15} className="text-blue-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
                รายการสินค้า <span className="font-normal text-slate-400 dark:text-zinc-500">{order.items?.length ?? 0} รายการ</span>
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/60 text-slate-400 dark:text-zinc-500 text-xs uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-left font-medium">สินค้า</th>
                  <th className="px-4 py-3 text-left font-medium">ตัวเลือก</th>
                  <th className="px-4 py-3 text-center font-medium w-24">จำนวน</th>
                  <th className="px-4 py-3 text-right font-medium w-32">ราคา/ชิ้น</th>
                  <th className="px-4 py-3 text-right font-medium w-32">รวม</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {order.items?.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800 dark:text-zinc-100">{item.productName}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-500 dark:text-zinc-400">
                      {item.variation ? cleanVariation(item.variation) : <span className="text-slate-300 dark:text-zinc-600">-</span>}
                    </td>
                    <td className="px-4 py-4 text-center text-slate-700 dark:text-zinc-200 font-medium">{item.quantity}</td>
                    <td className="px-4 py-4 text-right text-slate-800 dark:text-zinc-100">
                      ฿{item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-800 dark:text-zinc-100">
                      ฿{(item.price * item.quantity).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={isDeletingItem === item.id}
                        className="p-1.5 text-slate-300 dark:text-zinc-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors disabled:opacity-40"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-80 flex-shrink-0 space-y-4">

          {/* Payment summary */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">สรุปยอด</span>
            </div>
            <div className="px-5 py-4 space-y-3">
              {rateDisc > 0 && (
                <>
                  <div className="flex justify-between text-sm text-slate-500 dark:text-zinc-400">
                    <span>ยอดเดิม</span>
                    <span>฿{orig.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between text-sm text-rose-500 font-medium">
                    <span>ส่วนลด</span>
                    <span>-฿{rateDisc.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm text-slate-700 dark:text-zinc-200">
                <span>รวมสินค้า</span>
                <span className="font-medium">฿{sub.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              {order.appliedCoupon && couponDisc > 0 && (
                <div className="flex justify-between text-sm text-emerald-600 font-medium">
                  <span className="flex items-center gap-1"><Tag size={11} /> {order.appliedCoupon}</span>
                  <span>-฿{couponDisc.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-500 dark:text-zinc-400 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span>ค่าจัดส่ง</span>
                <span>{ship > 0 ? `฿${ship}` : <span className="text-emerald-600 font-medium">ฟรี</span>}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500 dark:text-zinc-400">
                <span>VAT (7%)</span>
                <span>฿{tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-sm font-semibold text-slate-800 dark:text-zinc-100">ยอดสุทธิ</span>
                <span className="text-xl font-bold text-blue-600">฿{order.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Shipping address */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
              <MapPin size={14} className="text-rose-400" />
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">ที่อยู่จัดส่ง</span>
              <button onClick={() => handleCopy(order.shippingAddress, 'ship')} className="ml-auto p-1 text-slate-400 hover:text-blue-500 transition-colors">
                {copiedField === 'ship' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">{order.shippingAddress || 'ไม่มีข้อมูล'}</p>
            </div>
            {order.vatAddress && (
              <>
                <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2">
                  <FileText size={13} className="text-purple-400" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">ที่อยู่ใบกำกับภาษี</span>
                </div>
                <div className="px-5 pb-4">
                  <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">{order.vatAddress}</p>
                </div>
              </>
            )}
          </div>

          {/* Label actions */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">ใบปะหน้าพัสดุ</span>
              {!canPrintLabel && (
                <p className="text-xs text-amber-500 mt-0.5">กรุณาดำเนินการสั่งซื้อก่อน</p>
              )}
            </div>
            <div className="p-3 space-y-2">
              {canPrintLabel ? (
                <button
                  onClick={handlePrint}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm transition-colors border ${
                    hasPrinted
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                      : 'border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {hasPrinted ? <Check size={14} className="text-emerald-500" /> : <Printer size={14} className="text-blue-500" />}
                  {confirmReprint ? 'กด อีกครั้ง เพื่อพิมพ์ซ้ำ' : hasPrinted ? 'พิมพ์แล้ว (พิมพ์ซ้ำ?)' : 'พิมพ์ใบปะหน้า'}
                  <ChevronRight size={13} className="ml-auto text-slate-400" />
                </button>
              ) : (
                <button disabled className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm border border-slate-100 dark:border-zinc-800 text-slate-300 dark:text-zinc-600 cursor-not-allowed">
                  <Printer size={14} /> พิมพ์ใบปะหน้า
                  <ChevronRight size={13} className="ml-auto" />
                </button>
              )}
              {canPrintLabel ? (
                <button
                  onClick={() => exportLabelPDF(order, labelRef)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg text-sm text-slate-700 dark:text-zinc-200 transition-colors border border-slate-200 dark:border-zinc-700"
                >
                  <Download size={14} className="text-violet-500" /> ดาวน์โหลด PDF A6
                  <ChevronRight size={13} className="ml-auto text-slate-400" />
                </button>
              ) : (
                <button disabled className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm border border-slate-100 dark:border-zinc-800 text-slate-300 dark:text-zinc-600 cursor-not-allowed">
                  <Download size={14} /> ดาวน์โหลด PDF A6
                  <ChevronRight size={13} className="ml-auto" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Admin Cancel Modal ── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <X size={15} className="text-red-500" />
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">ยกเลิกคำสั่งซื้อ</h3>
              </div>
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason('') }}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">ระบุเหตุผลการยกเลิกสำหรับลูกค้า</p>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="เช่น สินค้าหมดสต็อก, ไม่สามารถจัดส่งในพื้นที่ได้..."
                rows={4}
                className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 outline-none focus:border-red-400 transition-colors resize-none"
              />
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason('') }}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                ไม่ยกเลิก
              </button>
              <button
                onClick={handleAdminCancel}
                disabled={isCancelling || !cancelReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCancelling && <RefreshCw size={14} className="animate-spin" />}
                ยืนยันยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
