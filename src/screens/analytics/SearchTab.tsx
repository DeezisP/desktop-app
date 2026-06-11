import { useEffect, useState } from 'react'
import { analyticsApi, type DateRange } from '../../api/analyticsApi'
import { KpiCard } from './components/KpiCard'
import { SectionHeader } from './components/SectionHeader'
import { DataTable } from './components/DataTable'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

interface SearchTabProps { days: DateRange }

export function SearchTab({ days }: SearchTabProps) {
  const [data, setData] = useState<{
    totalSearches: number
    zeroResultSearches: number
    successRate: number
    topQueries: unknown[]
    zeroResultQueries: unknown[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsApi.getSearch(days).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [days])

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="การค้นหาทั้งหมด" value={(data?.totalSearches || 0).toLocaleString('th-TH')} />
        <KpiCard label="ไม่พบผล" value={(data?.zeroResultSearches || 0).toLocaleString('th-TH')} sub="การค้นหาที่ไม่มีผลลัพธ์" />
        <KpiCard label="อัตราความสำเร็จ" value={`${data?.successRate || 0}%`} sub="การค้นหาที่มีผลลัพธ์" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
          <SectionHeader title="คำค้นหายอดนิยม" description={`คำค้นหาที่ใช้บ่อยที่สุด — ${days} วันล่าสุด`} />
          <DataTable
            columns={[
              { key: 'query', label: 'คำค้นหา' },
              { key: 'count', label: 'ครั้ง', align: 'right', format: (v) => (v as number).toLocaleString('th-TH') },
              { key: 'withResults', label: 'มีผลลัพธ์', align: 'right', format: (v) => (v as number).toLocaleString('th-TH') },
            ]}
            rows={(data?.topQueries || []) as Record<string, unknown>[]}
            emptyMessage="ยังไม่มีข้อมูลการค้นหา"
          />
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
          <SectionHeader title="คำค้นหาที่ไม่พบผล" description="คำค้นหาที่ไม่มีผลลัพธ์ — ช่องว่างด้านเนื้อหา" />
          <DataTable
            columns={[
              { key: 'query', label: 'คำค้นหา' },
              { key: 'count', label: 'ครั้ง', align: 'right', format: (v) => (v as number).toLocaleString('th-TH') },
            ]}
            rows={(data?.zeroResultQueries || []) as Record<string, unknown>[]}
            emptyMessage="ไม่พบการค้นหาที่ไม่มีผลลัพธ์"
          />
        </div>
      </div>
    </div>
  )
}
