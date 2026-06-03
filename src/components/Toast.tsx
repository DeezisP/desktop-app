import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ── Store ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration: number
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push(toast) {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    if (toast.duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, toast.duration)
    }
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

// ── Imperative helper ─────────────────────────────────────────────────────────

export const toast = {
  success: (title: string, message?: string, duration = 3500) =>
    useToastStore.getState().push({ type: 'success', title, message, duration }),
  error: (title: string, message?: string, duration = 5000) =>
    useToastStore.getState().push({ type: 'error', title, message, duration }),
  warning: (title: string, message?: string, duration = 4000) =>
    useToastStore.getState().push({ type: 'warning', title, message, duration }),
  info: (title: string, message?: string, duration = 3500) =>
    useToastStore.getState().push({ type: 'info', title, message, duration }),
}

// ── Icons & styles per type ───────────────────────────────────────────────────

const META: Record<ToastType, { icon: React.ReactNode; bar: string; ring: string; bg: string }> = {
  success: {
    icon: <CheckCircle2 size={16} className="text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />,
    bar:  'bg-green-500',
    ring: 'ring-green-200 dark:ring-green-800',
    bg:   'bg-white dark:bg-zinc-900',
  },
  error: {
    icon: <XCircle size={16} className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />,
    bar:  'bg-red-500',
    ring: 'ring-red-200 dark:ring-red-800',
    bg:   'bg-white dark:bg-zinc-900',
  },
  warning: {
    icon: <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />,
    bar:  'bg-amber-500',
    ring: 'ring-amber-200 dark:ring-amber-800',
    bg:   'bg-white dark:bg-zinc-900',
  },
  info: {
    icon: <Info size={16} className="text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />,
    bar:  'bg-blue-500',
    ring: 'ring-blue-200 dark:ring-blue-800',
    bg:   'bg-white dark:bg-zinc-900',
  },
}

// ── Single toast card ─────────────────────────────────────────────────────────

function ToastCard({ toast: t }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const m = META[t.type]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden flex items-start gap-3 w-80 max-w-[calc(100vw-2rem)] rounded-xl shadow-lg ring-1 px-4 py-3 ${m.bg} ${m.ring}`}
    >
      {/* Coloured left accent bar */}
      <div className={`absolute left-0 inset-y-0 w-1 rounded-l-xl ${m.bar}`} />

      {m.icon}

      <div className="flex-1 min-w-0 pl-1">
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 leading-snug">
          {t.title}
        </p>
        {t.message && (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {t.message}
          </p>
        )}
      </div>

      <button
        onClick={() => dismiss(t.id)}
        className="flex-shrink-0 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}

// ── Overlay container — rendered once in Layout ───────────────────────────────

export function ToastOverlay() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence mode="sync">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
