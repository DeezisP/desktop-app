import { useEffect, useState } from 'react'
import { analyticsApi, type DateRange } from '../../api/analyticsApi'
import { SectionHeader } from './components/SectionHeader'
import { DataTable } from './components/DataTable'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

interface GeoTabProps { days: DateRange }

export function GeoTab({ days }: GeoTabProps) {
  const [geo, setGeo] = useState<{ countries: unknown[]; cities: unknown[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsApi.getGeo(days).then(setGeo).catch(() => {}).finally(() => setLoading(false))
  }, [days])

  if (loading) return <Spinner />

  const countries = (geo?.countries || []) as Array<{ country: string; visitors: number }>
  const cities = (geo?.cities || []) as Array<{ city: string; country: string; visitors: number }>
  const totalCountry = countries.reduce((s, c) => s + c.visitors, 0)

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <SectionHeader title="ประเทศยอดนิยม" description={`การกระจายผู้เยี่ยมชมตามประเทศ — ${days} วันล่าสุด`} />
        {countries.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400">
            ยังไม่มีข้อมูลภูมิศาสตร์ จะปรากฏเมื่อมีผู้เยี่ยมชม
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {countries.slice(0, 15).map((c) => {
              const pct = totalCountry > 0 ? (c.visitors / totalCountry) * 100 : 0
              return (
                <div key={c.country} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-zinc-700 dark:text-zinc-300 truncate shrink-0">{c.country}</span>
                  <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-24 text-right text-sm text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0">
                    {c.visitors.toLocaleString('th-TH')} ({pct.toFixed(1)}%)
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <SectionHeader title="เมืองยอดนิยม" />
        <DataTable
          columns={[
            { key: 'city', label: 'เมือง' },
            { key: 'country', label: 'ประเทศ' },
            { key: 'visitors', label: 'ผู้เยี่ยมชม', align: 'right', format: (v) => (v as number).toLocaleString('th-TH') },
          ]}
          rows={cities.slice(0, 20) as Record<string, unknown>[]}
          emptyMessage="ยังไม่มีข้อมูลเมือง"
        />
      </div>
    </div>
  )
}
