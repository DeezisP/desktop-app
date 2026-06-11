import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownToLine, RotateCcw, X, Loader2, Zap,
  Bell, ChevronDown, ChevronUp, AlertCircle, RefreshCw,
} from 'lucide-react'
import type { UpdateStatus } from '../types/api'
import { formatBytes } from '../lib/utils'

// ── Persistence helpers ───────────────────────────────────────────────────────

const STORAGE_SKIPPED   = 'update.skipped_versions'
const STORAGE_REMIND    = 'update.remind_until'
const REMIND_DURATION   = 4 * 60 * 60 * 1000  // 4 hours in ms

function getSkipped(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_SKIPPED) ?? '[]') } catch { return [] }
}
function addSkipped(version: string) {
  try {
    const list = getSkipped()
    if (!list.includes(version)) localStorage.setItem(STORAGE_SKIPPED, JSON.stringify([...list, version]))
  } catch {}
}
function isSkipped(version: string): boolean {
  return getSkipped().includes(version)
}

function setRemindLater() {
  try { localStorage.setItem(STORAGE_REMIND, String(Date.now() + REMIND_DURATION)) } catch {}
}
function isRemindSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(STORAGE_REMIND) ?? 0)
    return Date.now() < until
  } catch { return false }
}
function clearRemindSnooze() {
  try { localStorage.removeItem(STORAGE_REMIND) } catch {}
}

// ── Release notes parser ──────────────────────────────────────────────────────
// Strip HTML tags and truncate.
function parseNotes(raw: string | undefined, max = 280): string {
  if (!raw) return ''
  const stripped = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return stripped.length > max ? stripped.slice(0, max).trimEnd() + '…' : stripped
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Non-blocking update notification card that appears at the bottom-right.
 * Covers all update states: available → downloading → downloaded → error.
 *
 * UX contract:
 *  - "Remind Me Later"   — snoozes notification for 4 hours
 *  - "Skip This Version" — permanently hides this version
 *  - "Update Now"        — confirms (download starts automatically); shows progress
 *  - "Restart & Install" — calls installUpdate() IPC
 *  - "Retry"             — triggers a fresh update:check
 * Download is always background (autoDownload: true in main process).
 */
export function UpdateNotification() {
  const [status, setStatus]           = useState<UpdateStatus>({ state: 'idle' })
  const [visible, setVisible]         = useState(false)
  const [expanded, setExpanded]       = useState(false)
  const [confirmedUpdate, setConfirmedUpdate] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)

  // ── Subscribe to update events from main process ──────────────────────────

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onUpdateStatus) return

    unsubRef.current = api.onUpdateStatus((s) => {
      setStatus(s)

      if (s.state === 'available') {
        if (isSkipped(s.version) || isRemindSnoozed()) return
        setVisible(true)
        setExpanded(false)
        setConfirmedUpdate(false)
      }
      if (s.state === 'downloading') {
        // Keep visible if already shown; show quietly if not yet dismissed
        if (confirmedUpdate) setVisible(true)
      }
      if (s.state === 'downloaded') {
        clearRemindSnooze()
        setVisible(true)
        setExpanded(true)   // expand so the restart button is prominent
      }
      if (s.state === 'error') {
        setVisible(true)
      }
    })

    return () => { unsubRef.current?.(); unsubRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleUpdateNow() {
    setConfirmedUpdate(true)
    setExpanded(true)
    // Download already running (autoDownload: true); nothing extra to trigger
  }

  function handleRemindLater() {
    setRemindLater()
    setVisible(false)
  }

  function handleSkipVersion() {
    if (status.state === 'available') addSkipped(status.version)
    setVisible(false)
  }

  function handleInstall() {
    window.electronAPI?.installUpdate?.()
  }

  function handleRetry() {
    window.electronAPI?.checkForUpdates?.()
  }

  function handleDismiss() {
    // Only allow dismissing non-critical states
    if (status.state === 'downloaded') {
      setRemindLater()
    }
    setVisible(false)
  }

  // ── Render guard ──────────────────────────────────────────────────────────

  const shouldShow = visible && (
    status.state === 'available'  ||
    status.state === 'downloading' ||
    status.state === 'downloaded'  ||
    status.state === 'error'
  )

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          key="update-notification"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="fixed bottom-5 right-5 z-[9990] w-80 max-w-[calc(100vw-2.5rem)]"
          role="alert"
          aria-live="polite"
        >
          <Card
            status={status}
            expanded={expanded}
            confirmedUpdate={confirmedUpdate}
            onToggleExpand={() => setExpanded((v) => !v)}
            onUpdateNow={handleUpdateNow}
            onRemindLater={handleRemindLater}
            onSkipVersion={handleSkipVersion}
            onInstall={handleInstall}
            onRetry={handleRetry}
            onDismiss={handleDismiss}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  status: UpdateStatus
  expanded: boolean
  confirmedUpdate: boolean
  onToggleExpand: () => void
  onUpdateNow: () => void
  onRemindLater: () => void
  onSkipVersion: () => void
  onInstall: () => void
  onRetry: () => void
  onDismiss: () => void
}

function Card({
  status, expanded, confirmedUpdate,
  onToggleExpand, onUpdateNow, onRemindLater,
  onSkipVersion, onInstall, onRetry, onDismiss,
}: CardProps) {
  const isDownloaded  = status.state === 'downloaded'
  const isDownloading = status.state === 'downloading'
  const isAvailable   = status.state === 'available'
  const isError       = status.state === 'error'

  // Header accent colour
  const accentClass = isDownloaded
    ? 'border-emerald-500/50 dark:border-emerald-500/40'
    : isError
    ? 'border-rose-500/50 dark:border-rose-500/40'
    : 'border-blue-500/50 dark:border-blue-500/40'

  return (
    <div
      className={`rounded-xl border bg-white dark:bg-zinc-900 shadow-2xl shadow-black/20 overflow-hidden ${accentClass}`}
      style={{ borderTopWidth: 2, borderColor: undefined }}
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <HeaderIcon status={status} />

        <div className="flex-1 min-w-0">
          <HeaderTitle status={status} />
          <HeaderSubtitle status={status} confirmedUpdate={confirmedUpdate} />
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 -mt-0.5">
          {/* Expand toggle — only on available state with release notes */}
          {isAvailable && (status as { releaseNotes?: string }).releaseNotes && (
            <button
              onClick={onToggleExpand}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title={expanded ? 'Collapse' : 'View release notes'}
              aria-label={expanded ? 'Collapse' : 'View release notes'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}

          {/* Dismiss — not available when update is downloaded */}
          {!isDownloaded && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Release notes (expandable) ── */}
      <AnimatePresence>
        {expanded && isAvailable && (status as { releaseNotes?: string }).releaseNotes && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                Release Notes
              </p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                {parseNotes((status as { releaseNotes?: string }).releaseNotes)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Download progress ── */}
      {isDownloading && (
        <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mb-1.5">
            <span className="flex items-center gap-1.5">
              {(status as { isDifferential: boolean }).isDifferential && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                  <Zap size={9} /> Differential
                </span>
              )}
              {formatBytes((status as { transferred: number }).transferred)} / {formatBytes((status as { total: number }).total)}
            </span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-200 tabular-nums">
              {(status as { percent: number }).percent}%
            </span>
          </div>
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              animate={{ width: `${(status as { percent: number }).percent}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1 tabular-nums">
            {formatBytes((status as { bytesPerSecond: number }).bytesPerSecond)}/s
          </p>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="px-3 py-2.5">
        {isAvailable && !confirmedUpdate && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onSkipVersion}
              className="px-2.5 py-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              ข้ามเวอร์ชันนี้
            </button>
            <button
              onClick={onRemindLater}
              className="px-2.5 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              เตือนภายหลัง
            </button>
            <button
              onClick={onUpdateNow}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors"
            >
              <ArrowDownToLine size={12} />
              อัปเดตเลย
            </button>
          </div>
        )}

        {isAvailable && confirmedUpdate && !isDownloading && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <Loader2 size={12} className="animate-spin text-blue-500 flex-shrink-0" />
            <span>กำลังเตรียมดาวน์โหลด...</span>
          </div>
        )}

        {isDownloading && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <Loader2 size={12} className="animate-spin text-blue-500 flex-shrink-0" />
            <span>กำลังดาวน์โหลดในพื้นหลัง</span>
          </div>
        )}

        {isDownloaded && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onDismiss}
              className="px-2.5 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              ภายหลัง
            </button>
            <button
              onClick={onInstall}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors"
            >
              <RotateCcw size={12} />
              รีสตาร์ทและติดตั้ง
            </button>
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-1.5">
            <span className="flex-1 text-[11px] text-rose-500 dark:text-rose-400 truncate">
              {(status as { message: string }).message}
            </span>
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
            >
              <RefreshCw size={11} /> ลองอีกครั้ง
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Header helpers ────────────────────────────────────────────────────────────

function HeaderIcon({ status }: { status: UpdateStatus }) {
  if (status.state === 'downloaded') {
    return (
      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
        <RotateCcw size={15} className="text-emerald-600 dark:text-emerald-400" />
      </div>
    )
  }
  if (status.state === 'downloading') {
    return (
      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
        <Loader2 size={15} className="text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    )
  }
  if (status.state === 'error') {
    return (
      <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
        <AlertCircle size={15} className="text-rose-600 dark:text-rose-400" />
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
      <Bell size={15} className="text-blue-600 dark:text-blue-400" />
    </div>
  )
}

function HeaderTitle({ status }: { status: UpdateStatus }) {
  if (status.state === 'downloaded') {
    return <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">พร้อมติดตั้งแล้ว</p>
  }
  if (status.state === 'downloading') {
    return <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">กำลังดาวน์โหลด...</p>
  }
  if (status.state === 'error') {
    return <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">อัปเดตล้มเหลว</p>
  }
  if (status.state === 'available') {
    return (
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        อัปเดตใหม่ — v{status.version}
      </p>
    )
  }
  return null
}

function HeaderSubtitle({ status, confirmedUpdate }: { status: UpdateStatus; confirmedUpdate: boolean }) {
  if (status.state === 'downloaded') {
    return <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">v{status.version} — รีสตาร์ทเพื่อติดตั้ง</p>
  }
  if (status.state === 'downloading') {
    return (
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
        {(status as { percent: number }).percent}% เสร็จสิ้น
      </p>
    )
  }
  if (status.state === 'available' && !confirmedUpdate) {
    return <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">ดาวน์โหลดในพื้นหลัง</p>
  }
  return null
}
