import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface NavItem {
  to: string
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { to: '/',               label: 'Dashboard',      icon: '⊞' },
  { to: '/scan-pack',      label: 'Scan & Pack',    icon: '⬡' },
  { to: '/order-packing',  label: 'Order Packing',  icon: '📦' },
  { to: '/product-lookup', label: 'Product Lookup', icon: '🔍' },
  { to: '/stock-in',       label: 'Stock In',       icon: '▲' },
  { to: '/stock-out',      label: 'Stock Out',      icon: '▼' },
  { to: '/stock-count',    label: 'Stock Count',    icon: '≡' },
  { to: '/stock-history',  label: 'Stock History',  icon: '◷' },
  { to: '/order-import',   label: 'Order Import',   icon: '⤵' },
]

export function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-slate-800 bg-slate-900">
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          W
        </div>
        <div>
          <p className="text-xs font-semibold text-white leading-tight">Perfect ELT</p>
          <p className="text-[10px] text-slate-500 leading-tight">Warehouse</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-brand-600/20 text-brand-400 font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`
            }
          >
            <span className="w-5 text-center text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-slate-800 px-4 py-3">
        {user && (
          <p className="mb-2 truncate text-xs text-slate-500">
            {user.username}
          </p>
        )}
        <button
          onClick={logout}
          className="w-full rounded-md bg-slate-800 px-3 py-1.5 text-left text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
