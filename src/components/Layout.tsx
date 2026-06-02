import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useStomp } from '../hooks/useStomp'

export function Layout() {
  const { isConnected } = useStomp()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-10 items-center justify-end border-b border-slate-800 bg-slate-900 px-4">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-slate-600'}`}
              title={isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
            />
            <span className="text-xs text-slate-500">{isConnected ? 'Live' : 'Offline'}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
