import { useState } from 'react'
import {
  FileSpreadsheet, Package, ScanLine, BarChart2, Tag,
} from 'lucide-react'
import ImportPanel       from '../panels/ImportPanel'
import OrderListPanel    from '../panels/OrderListPanel'
import PackingPanel      from '../panels/PackingPanel'
import StockListPanel    from '../panels/StockListPanel'
import BarcodeLabelPanel from '../panels/BarcodeLabelPanel'

const TABS = [
  { id: 'import',  label: 'นำเข้าออเดอร์', icon: FileSpreadsheet },
  { id: 'orders',  label: 'รายการออเดอร์',  icon: Package },
  { id: 'packing', label: 'สแกนบาร์โค้ด',  icon: ScanLine },
  { id: 'stock',   label: 'สต็อกสินค้า',   icon: BarChart2 },
  { id: 'barcode', label: 'ป้ายพัสดุ',     icon: Tag },
] as const

type TabId = typeof TABS[number]['id']

export function MainPage() {
  const [tab, setTab] = useState<TabId>('import')

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Tab bar */}
      <div className="flex items-end border-b border-zinc-200 bg-white px-4 overflow-x-auto [scrollbar-width:none] flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto bg-zinc-50">
        {tab === 'import'  && <ImportPanel />}
        {tab === 'orders'  && <div className="p-5"><OrderListPanel /></div>}
        {tab === 'packing' && <div className="p-5"><PackingPanel /></div>}
        {tab === 'stock'   && <div className="p-5"><StockListPanel /></div>}
        {tab === 'barcode' && <div className="p-5"><BarcodeLabelPanel /></div>}
      </div>
    </div>
  )
}
