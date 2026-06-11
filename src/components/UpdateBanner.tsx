import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, RotateCcw, X, Loader2, Zap } from 'lucide-react'
import type { UpdateStatus } from '../types/api'
import { formatBytes } from '../lib/utils'

// Shows a non-blocking banner at the top of the app when an update is detected.
// The user is never forced to update — they choose when to act.

export function UpdateBanner() {
  const [status, setStatus]     = useState<UpdateStatus>({ state: 'idle' })
  const [visible, setVisible]   = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onUpdateStatus) return

    unsubRef.current = api.onUpdateStatus((s) => {
      setStatus(s)
      if (s.state === 'available' || s.state === 'downloading' || s.state === 'downloaded') {
        setVisible(true)
        setDismissed(false)
      }
    })

    return () => { unsubRef.current?.(); unsubRef.current = null }
  }, [])

  function handleInstall() { window.electronAPI?.installUpdate?.() }
  function handleDismiss() { setDismissed(true); setVisible(false) }

  const show = visible && !dismissed && (
    status.state === 'available' ||
    status.state === 'downloading' ||
    status.state === 'downloaded'
  )

  // ── Download subtitle ──────────────────────────────────────────────────────

  const subtitle = (() => {
    if (status.state === 'available')   return `เวอร์ชัน ${status.version} — กำลังดาวน์โหลดในพื้นหลัง…`
    if (status.state === 'downloaded')  return 'พร้อมติดตั้งแล้ว — คลิกเพื่อรีสตาร์ท'
    if (status.state === 'downloading') {
      const transferred = formatBytes(status.transferred)
      const total       = formatBytes(status.total)
      return `${status.percent}% · ${transferred} / ${total}`
    }
    return ''
  })()

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-600 dark:bg-blue-700 text-white shadow-lg"
        >
          {/* Left: icon + text */}
          <div className="flex items-center gap-2.5 min-w-0">
            {status.state === 'downloading'
              ? <Loader2 size={15} className="flex-shrink-0 animate-spin" />
              : <Download size={15} className="flex-shrink-0" />
            }
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-sm font-semibold whitespace-nowrap">New Update Available</span>
              <span className="hidden sm:inline text-sm text-blue-100">{subtitle}</span>
              {/* Differential badge — shown when the download is a blockmap patch */}
              {status.state === 'downloading' && status.isDifferential && (
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/20 text-white whitespace-nowrap">
                  <Zap size={9} className="flex-shrink-0" />
                  Differential
                </span>
              )}
            </div>
          </div>

          {/* Right: action + dismiss */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {status.state === 'downloaded' && (
              <button
                onClick={handleInstall}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-blue-700 text-xs font-semibold hover:bg-blue-50 transition-colors"
              >
                <RotateCcw size={12} />
                รีสตาร์ทและติดตั้ง
              </button>
            )}
            <button
              onClick={handleDismiss}
              aria-label="Dismiss update banner"
              className="p-1 rounded-md hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Download progress bar */}
          {status.state === 'downloading' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500">
              <div
                className="h-full bg-white/70 transition-all duration-300"
                style={{ width: `${status.percent}%` }}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
