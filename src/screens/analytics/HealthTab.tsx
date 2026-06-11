import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { analyticsApi } from '../../api/analyticsApi'
import { HealthScoreCard } from './components/HealthScoreCard'
import { SectionHeader } from './components/SectionHeader'

interface ScoreEntry {
  type: string
  score: number | null
  scoreDate?: string
  breakdown?: string
  recommendations?: string
}

const TYPE_COLORS: Record<string, string> = {
  SEO: '#2563eb',
  AEO: '#10b981',
  CONTENT: '#8b5cf6',
  TRAFFIC: '#f59e0b',
  TECHNICAL: '#ef4444',
}

const TYPE_LABELS: Record<string, string> = {
  SEO: 'SEO',
  AEO: 'AEO',
  CONTENT: 'เนื้อหา',
  TRAFFIC: 'การเข้าชม',
  TECHNICAL: 'เทคนิค',
}

export function HealthTab() {
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [history, setHistory] = useState<Record<string, unknown[]>>({})
  const [computing, setComputing] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    analyticsApi.getHealthScores().then(async (data: ScoreEntry[]) => {
      setScores(data)
      const types = data.map((d: ScoreEntry) => d.type)
      const histories = await Promise.all(types.map((t: string) => analyticsApi.getHealthScoreHistory(t)))
      const map: Record<string, unknown[]> = {}
      types.forEach((t: string, i: number) => { map[t] = histories[i] })
      setHistory(map)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCompute = async () => {
    setComputing(true)
    try {
      await analyticsApi.computeHealthScores()
      load()
    } finally {
      setComputing(false)
    }
  }

  const allDates = new Set<string>()
  Object.values(history).forEach(arr =>
    (arr as Array<{ date: string; score: number }>).forEach(p => allDates.add(p.date))
  )
  const combinedTrend = Array.from(allDates).sort().map(date => {
    const point: Record<string, unknown> = { date }
    Object.entries(history).forEach(([type, arr]) => {
      const found = (arr as Array<{ date: string; score: number }>).find(p => p.date === date)
      point[type] = found?.score ?? null
    })
    return point
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="คะแนนสุขภาพเว็บไซต์" description="สุขภาพเว็บไซต์ใน 5 มิติ — คะแนน 0–100" />
        <button
          onClick={handleCompute}
          disabled={computing}
          className="px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {computing ? 'กำลังคำนวณ…' : 'คำนวณใหม่'}
        </button>
      </div>

      {scores.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-sm text-zinc-400">ยังไม่มีคะแนนสุขภาพ</p>
          <p className="text-xs text-zinc-400 mt-1">กด "คำนวณใหม่" เพื่อสร้างคะแนนครั้งแรก</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {scores.map((s: ScoreEntry) => (
              <HealthScoreCard key={s.type} type={TYPE_LABELS[s.type] || s.type} score={s.score} scoreDate={s.scoreDate} />
            ))}
          </div>

          {combinedTrend.length > 1 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
              <SectionHeader title="ประวัติคะแนน" description="แนวโน้มคะแนนสุขภาพตามช่วงเวลา" />
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={combinedTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(val) => TYPE_LABELS[val] || val} />
                  {scores.map((s: ScoreEntry) => (
                    <Line key={s.type} type="monotone" dataKey={s.type}
                      stroke={TYPE_COLORS[s.type] || '#6b7280'} strokeWidth={2}
                      dot={false} connectNulls name={TYPE_LABELS[s.type] || s.type} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {scores.some((s: ScoreEntry) => s.recommendations) && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
              <SectionHeader title="คำแนะนำ" />
              <div className="space-y-4">
                {scores.filter((s: ScoreEntry) => s.recommendations).map((s: ScoreEntry) => {
                  let recs: string[] = []
                  try { recs = JSON.parse(s.recommendations || '[]') } catch { recs = [] }
                  return recs.length > 0 ? (
                    <div key={s.type}>
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                        {TYPE_LABELS[s.type] || s.type}
                      </p>
                      <ul className="space-y-1">
                        {recs.map((rec: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                            <span className="mt-1.5 w-1.5 h-1.5 bg-blue-600 rounded-full shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
