import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'
import { ToastOverlay } from './Toast'
import { useStomp } from '../hooks/useStomp'
import { useSettingsStore } from '../store/settingsStore'

// ── Animated connection pill ──────────────────────────────────────────────────

function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={isConnected ? 'online' : 'offline'}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
          isConnected
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            isConnected
              ? 'bg-green-500 animate-pulse'
              : 'bg-zinc-400 dark:bg-zinc-600'
          }`}
        />
        {isConnected ? 'ออนไลน์' : 'ออฟไลน์'}
      </motion.div>
    </AnimatePresence>
  )
}

// ── Station name badge ────────────────────────────────────────────────────────

function StationBadge() {
  const name = useSettingsStore((s) => s.stationName)
  if (!name) return null
  return (
    <span className="hidden sm:inline-block text-xs text-zinc-400 dark:text-zinc-500 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-medium truncate max-w-[120px]">
      {name}
    </span>
  )
}

// ── Main layout ───────────────────────────────────────────────────────────────

export function Layout() {
  const { isConnected } = useStomp()
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="flex h-10 flex-shrink-0 items-center justify-end border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 gap-2.5">
          <StationBadge />
          <ConnectionStatus isConnected={isConnected} />
          <ThemeToggle />
        </header>

        {/* Page content — fade-only transition avoids clip artefacts */}
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, ease: 'easeInOut' }}
              className="absolute inset-0"
              style={{ overflowY: 'auto' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Global toast overlay */}
      <ToastOverlay />
    </div>
  )
}
