import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowDownToLine, Package, ScanBarcode, Boxes,
  Tag, History, Settings, LogOut, MessageSquare, Receipt, Images,
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

interface NavSection {
  header?: string
  items: NavItem[]
}

function ChatBadge() {
  const count = useChatStore(selectTotalUnread)
  if (count === 0) return null
  return (
    <span className="ml-auto flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  )
}

const SECTIONS: NavSection[] = [
  {
    items: [
      { to: '/dashboard',  label: 'ภาพรวม',           icon: <LayoutDashboard size={15} />, end: true },
    ],
  },
  {
    header: 'ออเดอร์',
    items: [
      { to: '/import',     label: 'นำเข้าออเดอร์', icon: <ArrowDownToLine size={15} /> },
      { to: '/orders',     label: 'รายการออเดอร์',  icon: <Package size={15} /> },
      { to: '/web-orders', label: 'ออเดอร์เว็บ',    icon: <Receipt size={15} /> },
    ],
  },
  {
    header: 'คลังสินค้า',
    items: [
      { to: '/packing', label: 'สแกนแพ็ค',    icon: <ScanBarcode size={15} /> },
      { to: '/stock',   label: 'สต็อกสินค้า', icon: <Boxes size={15} /> },
      { to: '/barcode', label: 'ป้ายพัสดุ',   icon: <Tag size={15} /> },
      { to: '/history', label: 'ประวัติสต็อก', icon: <History size={15} /> },
    ],
  },
  {
    header: 'สื่อ',
    items: [
      { to: '/albums', label: 'อัลบั้มรูป', icon: <Images size={15} /> },
    ],
  },
  {
    header: 'การสื่อสาร',
    items: [
      { to: '/chat', label: 'แชท', icon: <MessageSquare size={15} />, badge: <ChatBadge /> },
    ],
  },
]

function NavItemLink({ to, label, icon, end, badge }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group relative flex items-center gap-2.5 px-3 py-[7px] mx-1.5 text-[13px] rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isActive
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-medium'
            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 hover:text-zinc-800 dark:hover:text-zinc-200'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator stripe */}
          {isActive && (
            <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-blue-500 dark:bg-blue-400" />
          )}
          <span className={`flex-shrink-0 ${isActive ? '' : 'group-hover:scale-105 transition-transform duration-150'}`}>
            {icon}
          </span>
          <span className="truncate flex-1">{label}</span>
          {badge}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar() {
  const { logout } = useAuth()

  return (
    <aside className="flex h-screen w-[188px] flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">

      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3.5">
        <img
          src={logo}
          alt="Perfect Electronic"
          className="h-7 w-7 rounded-lg object-cover flex-shrink-0 shadow-sm"
        />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100 leading-tight truncate">
            Admin Perfect Electronic
          </p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight mt-0.5">
            ระบบจัดการคลังสินค้า
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Main navigation">
        {SECTIONS.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-1' : ''}>
            {section.header && (
              <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 select-none">
                {section.header}
              </p>
            )}
            {section.items.map((item) => (
              <NavItemLink key={item.to} {...item} />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom: settings + logout */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 py-2 px-1.5 space-y-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `group relative flex items-center gap-2.5 px-3 py-[7px] text-[13px] rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-medium'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-blue-500 dark:bg-blue-400" />
              )}
              <Settings size={15} className="flex-shrink-0 transition-transform duration-300 group-hover:rotate-45" />
              <span>ตั้งค่า</span>
            </>
          )}
        </NavLink>

        <button
          onClick={logout}
          className="w-full group flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] text-zinc-400 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <LogOut size={15} className="flex-shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5" />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  )
}
