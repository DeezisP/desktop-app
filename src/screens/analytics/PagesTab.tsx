import { useEffect, useState } from 'react'
import { analyticsApi, type DateRange } from '../../api/analyticsApi'
import { SectionHeader } from './components/SectionHeader'
import { DataTable } from './components/DataTable'

function fmtSec(s: number): string {
  if (!s) return '0ว.'
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m}น. ${sec}ว.` : `${sec}ว.`
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

interface PagesTabProps { days: DateRange }

export function PagesTab({ days }: PagesTabProps) {
  const [topPages, setTopPages] = useState<unknown[]>([])
  const [landingPages, setLandingPages] = useState<unknown[]>([])
  const [exitPages, setExitPages] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      analyticsApi.getTopPages(days, 20),
      analyticsApi.getLandingPages(days, 10),
      analyticsApi.getExitPages(days, 10),
    ]).then(([top, land, exit]) => {
      setTopPages(top)
      setLandingPages(land)
      setExitPages(exit)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [days])

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <SectionHeader title="หน้ายอดนิยม" description={`หน้าที่ถูกดูมากที่สุดใน ${days} วันล่าสุด`} />
        <DataTable
          columns={[
            { key: 'path', label: 'เส้นทางหน้า' },
            { key: 'title', label: 'ชื่อหน้า' },
            { key: 'views', label: 'ครั้งที่ดู', align: 'right', format: (v) => (v as number).toLocaleString('th-TH') },
            { key: 'avgTimeSeconds', label: 'เวลาเฉลี่ย', align: 'right', format: (v) => fmtSec(v as number) },
          ]}
          rows={topPages as Record<string, unknown>[]}
          emptyMessage="ยังไม่มีข้อมูลหน้า จะปรากฏเมื่อมีผู้เยี่ยมชม"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
          <SectionHeader title="หน้าแรกที่เข้า" description="หน้าแรกที่ผู้เยี่ยมชมเข้ามาในแต่ละเซสชัน" />
          <DataTable
            columns={[
              { key: 'path', label: 'หน้า' },
              { key: 'sessions', label: 'เซสชัน', align: 'right', format: (v) => (v as number).toLocaleString('th-TH') },
            ]}
            rows={landingPages as Record<string, unknown>[]}
            emptyMessage="ยังไม่มีข้อมูลหน้าแรกที่เข้า"
          />
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
          <SectionHeader title="หน้าสุดท้ายก่อนออก" description="หน้าสุดท้ายที่ดูก่อนออกจากเว็บ" />
          <DataTable
            columns={[
              { key: 'path', label: 'หน้า' },
              { key: 'exits', label: 'ครั้งที่ออก', align: 'right', format: (v) => (v as number).toLocaleString('th-TH') },
            ]}
            rows={exitPages as Record<string, unknown>[]}
            emptyMessage="ยังไม่มีข้อมูลหน้าสุดท้ายก่อนออก"
          />
        </div>
      </div>
    </div>
  )
}
