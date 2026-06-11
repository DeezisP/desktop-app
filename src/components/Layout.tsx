import { Outlet, useLocation, NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import { LogOut, ChevronDown } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'
import { ToastOverlay } from './Toast'
import { UpdateNotification } from './UpdateNotification'
import { useStomp } from '../hooks/useStomp'
import { useSettingsStore } from '../store/settingsStore'
import { useAuth } from '../hooks/useAuth'

const PAGE_TITLES: Record<string, string> = {
  '/':           'ภาพรวม',
  '/dashboard':  'ภาพรวม',
  '/import':     'นำเข้าออเดอร์',
  '/orders':     'รายการออเดอร์',
  '/web-orders': 'ออเดอร์เว็บ',
  '/packing':    'สแกนแพ็ค',
  '/stock':      'สต็อกสินค้า',
  '/barcode':    'ป้ายพัสดุ',
  '/history':    'ประวัติสต็อก',
  '/chat':       'แชทสนับสนุน',
  '/settings':   'ตั้งค่า',
}

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
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-zinc-400 dark:bg-zinc-600'
          }`}
        />
        {isConnected ? 'ออนไลน์' : 'ออฟไลน์'}
      </motion.div>
    </AnimatePresence>
  )
}

function StationBadge() {
  const name = useSettingsStore((s) => s.stationName)
  if (!name) return null
  return (
    <span className="hidden sm:inline-block text-[11px] text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-medium truncate max-w-[120px]">
      {name}
    </span>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!user) return null
  const initials = user.username.slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 select-none">
          {initials}
        </div>
        <span className="hidden sm:block text-xs font-medium text-zinc-700 dark:text-zinc-300 max-w-[80px] truncate">
          {user.username}
        </span>
        <ChevronDown
          size={11}
          className={`text-zinc-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-200/60 dark:shadow-black/40 py-1 z-50"
          >
            <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                {user.username}
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                ผู้ดูแลระบบคลังสินค้า
              </p>
            </div>
            <NavLink
              to="/settings"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              ตั้งค่าระบบ
            </NavLink>
            <div className="border-t border-zinc-100 dark:border-zinc-800 mt-1 pt-1">
              <button
                onClick={() => { setOpen(false); logout() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut size={12} />
                ออกจากระบบ
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Layout() {
  const { isConnected } = useStomp()
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname] ?? ''

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top header */}
        <header className="flex h-11 flex-shrink-0 items-center border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 gap-3">
          {/* Page title */}
          <div className="flex-1 min-w-0">
            {pageTitle && (
              <h1 className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                {pageTitle}
              </h1>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <StationBadge />
            <ConnectionStatus isConnected={isConnected} />
            <ThemeToggle />
            <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
            <UserMenu />
          </div>
        </header>

        {/* Page content */}
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

      <ToastOverlay />
      <UpdateNotification />
    </div>
  )
}
