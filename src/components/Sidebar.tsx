import { NavLink } from 'react-router-dom'
import {
  ArrowDownToLine, Package, ScanBarcode, Boxes,
  Tag, History, Settings, LogOut, MessageSquare, Receipt,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useChatStore, selectTotalUnread } from '../store/chatStore'
import logo from '../assets/logo.png'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  end?: boolean
  badge?: React.ReactNode
}

function ChatBadge() {
  const count = useChatStore(selectTotalUnread)
  if (count === 0) return null
  return (
    <span className="ml-auto flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  )
}

const NAV: NavItem[] = [
  { to: '/',        label: 'นำเข้าออเดอร์', icon: <ArrowDownToLine size={15} />, end: true },
  { to: '/orders',      label: 'รายการออเดอร์',  icon: <Package size={15} /> },
  { to: '/web-orders',  label: 'ออเดอร์เว็บ',    icon: <Receipt size={15} /> },
  { to: '/packing', label: 'สแกนบาร์โค้ด',  icon: <ScanBarcode size={15} /> },
  { to: '/stock',   label: 'สต็อกสินค้า',   icon: <Boxes size={15} /> },
  { to: '/barcode', label: 'ป้ายพัสดุ',     icon: <Tag size={15} /> },
  { to: '/history', label: 'ประวัติสต็อก',  icon: <History size={15} /> },
  { to: '/chat',    label: 'แชท',           icon: <MessageSquare size={15} />, badge: <ChatBadge /> },
]

export function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-screen w-48 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">

      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3.5">
        <img
          src={logo}
          alt="Perfect Electronic"
          className="h-8 w-8 rounded-lg object-cover flex-shrink-0 shadow-sm"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 leading-tight truncate">
            Perfect Electronic
          </p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
            ระบบคลังสินค้า
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1.5" aria-label="Main navigation">
        {NAV.map(({ to, label, icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group flex items-center gap-2.5 px-3 py-2 mx-1.5 my-0.5 text-sm rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-medium shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex-shrink-0 transition-transform duration-150 ${isActive ? '' : 'group-hover:scale-110'}`}>
                  {icon}
                </span>
                <span className="truncate">{label}</span>
                {/* Unread badge (chat) or active indicator bar */}
                {badge ?? (isActive && (
                  <span className="ml-auto w-1 h-3.5 rounded-full bg-blue-500 dark:bg-blue-400 flex-shrink-0" />
                ))}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: settings + user + logout */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-1.5 pb-2 px-1.5 space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `group flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-medium'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`
          }
        >
          <Settings size={15} className="flex-shrink-0 transition-transform duration-300 group-hover:rotate-45" />
          <span>ตั้งค่า</span>
        </NavLink>

        <div className="px-3 pt-1">
          {user && (
            <p className="mb-1.5 truncate text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
              {user.username}
            </p>
          )}
          <button
            onClick={logout}
            className="w-full group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <LogOut size={13} className="flex-shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5" />
            ออกจากระบบ
          </button>
        </div>
      </div>
    </aside>
  )
}
