import { useState } from 'react'
import type { DateRange } from '../api/analyticsApi'
import { OverviewTab } from './analytics/OverviewTab'
import { TrafficTab } from './analytics/TrafficTab'
import { PagesTab } from './analytics/PagesTab'
import { DevicesTab } from './analytics/DevicesTab'
import { GeoTab } from './analytics/GeoTab'
import { RealtimeTab } from './analytics/RealtimeTab'
import { SearchTab } from './analytics/SearchTab'
import { HealthTab } from './analytics/HealthTab'
import { InsightsTab } from './analytics/InsightsTab'

const TABS = [
  { id: 'overview',  label: 'ภาพรวม'          },
  { id: 'traffic',   label: 'การเข้าชม'        },
  { id: 'pages',     label: 'หน้าเว็บ'          },
  { id: 'devices',   label: 'อุปกรณ์'           },
  { id: 'geo',       label: 'ภูมิศาสตร์'        },
  { id: 'realtime',  label: 'เรียลไทม์'         },
  { id: 'search',    label: 'ค้นหา'             },
  { id: 'health',    label: 'สุขภาพเว็บ'        },
  { id: 'insights',  label: 'ข้อมูลเชิงลึก'     },
]

const DAY_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'วันนี้',    value: 1   },
  { label: '7 วัน',    value: 7   },
  { label: '30 วัน',   value: 30  },
  { label: '90 วัน',   value: 90  },
  { label: '1 ปี',     value: 365 },
]

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('overview')
  const [days, setDays] = useState<DateRange>(30)

  const showDateRange = activeTab !== 'realtime' && activeTab !== 'health' && activeTab !== 'insights'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">การวิเคราะห์เว็บไซต์</h1>
          {showDateRange && (
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
              {DAY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors
                    ${days === opt.value
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <nav className="flex gap-0 overflow-x-auto [scrollbar-width:none]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview'  && <OverviewTab  days={days} />}
        {activeTab === 'traffic'   && <TrafficTab   days={days} />}
        {activeTab === 'pages'     && <PagesTab     days={days} />}
        {activeTab === 'devices'   && <DevicesTab   days={days} />}
        {activeTab === 'geo'       && <GeoTab       days={days} />}
        {activeTab === 'realtime'  && <RealtimeTab  />}
        {activeTab === 'search'    && <SearchTab    days={days} />}
        {activeTab === 'health'    && <HealthTab    />}
        {activeTab === 'insights'  && <InsightsTab  />}
      </div>
    </div>
  )
}
