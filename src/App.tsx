import { useEffect } from 'react'
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login }          from './screens/Login'
import { Dashboard }      from './screens/Dashboard'
import { ScanPack }       from './screens/ScanPack'
import { ProductLookup }  from './screens/ProductLookup'
import { StockIn }        from './screens/StockIn'
import { StockOut }       from './screens/StockOut'
import { StockCount }     from './screens/StockCount'
import { OrderPacking }   from './screens/OrderPacking'
import { OrderImport }    from './screens/OrderImport'
import { StockHistory }   from './screens/StockHistory'

// Electron uses file:// protocol → use MemoryRouter; web dev uses BrowserRouter
const Router = window.electronAPI ? MemoryRouter : BrowserRouter

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
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
          <Route index element={<Dashboard />} />
          <Route path="scan-pack"      element={<ScanPack />} />
          <Route path="product-lookup" element={<ProductLookup />} />
          <Route path="stock-in"       element={<StockIn />} />
          <Route path="stock-out"      element={<StockOut />} />
          <Route path="stock-count"    element={<StockCount />} />
          <Route path="order-packing"  element={<OrderPacking />} />
          <Route path="order-import"   element={<OrderImport />} />
          <Route path="stock-history"  element={<StockHistory />} />
        </Route>
      </Routes>
    </Router>
  )
}
