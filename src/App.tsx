import { useEffect } from 'react'
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary }  from './components/ErrorBoundary'
import { useAuthStore }   from './store/authStore'
import { Layout }         from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login }          from './screens/Login'
import { StockHistory }   from './screens/StockHistory'
import Settings           from './screens/Settings'
import Chat               from './screens/Chat'
import { useAppLifecycle } from './hooks/useAppLifecycle'
import ImportPanel         from './panels/ImportPanel'
import OrderListPanel      from './panels/OrderListPanel'
import PackingPanel        from './panels/PackingPanel'
import StockListPanel      from './panels/StockListPanel'
import BarcodeLabelPanel   from './panels/BarcodeLabelPanel'

// Side-effect import: initialises theme from localStorage before first paint
import './store/settingsStore'

const isElectron = typeof navigator !== 'undefined' &&
  navigator.userAgent.includes('Electron')

const Router = isElectron ? MemoryRouter : BrowserRouter

console.log('[App] isElectron:', isElectron)
console.log('[App] router type:', isElectron ? 'MemoryRouter' : 'BrowserRouter')
console.log('[App] window.electronAPI:', typeof window.electronAPI)

function Padded({ children }: { children: React.ReactNode }) {
  return <div className="p-5 h-full overflow-y-auto">{children}</div>
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)
  
  // Initialize session on app startup
  useEffect(() => {
    initialize().catch((err: unknown) => {
      console.error('[App] initialize() rejected:', err)
    })
  }, [initialize])

  // Manage app lifecycle, STOMP reconnections, and session persistence
  useAppLifecycle()

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index              element={<ImportPanel />} />
            <Route path="orders"      element={<Padded><OrderListPanel /></Padded>} />
            <Route path="packing"     element={<Padded><PackingPanel /></Padded>} />
            <Route path="stock"       element={<Padded><StockListPanel /></Padded>} />
            <Route path="barcode"     element={<Padded><BarcodeLabelPanel /></Padded>} />
            <Route path="history"     element={<Padded><StockHistory /></Padded>} />
            <Route path="chat"        element={<Chat />} />
            <Route path="settings"    element={<Settings />} />
          </Route>
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}
