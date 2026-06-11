import { useEffect, useState } from 'react'
import { analyticsApi } from '../../api/analyticsApi'
import { SectionHeader } from './components/SectionHeader'

interface Insight {
  id: number
  insightType: string
  title: string
  description: string
  trend: string
  changePercent: number
  generatedAt: string
}

function TrendBadge({ trend, change }: { trend: string; change?: number }) {
  const color = trend === 'positive'
    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
    : trend === 'negative'
    ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
    : 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800'

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {change !== undefined && change !== null
        ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
        : trend}
    </span>
  )
}

const TYPE_LABELS: Record<string, string> = {
  traffic: 'การเข้าชม',
  content: 'เนื้อหา',
  seo: 'SEO',
  device: 'อุปกรณ์',
  geo: 'ภูมิศาสตร์',
  engagement: 'การมีส่วนร่วม',
  search: 'ค้นหา',
}

export function InsightsTab() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    analyticsApi.getInsights().then(setInsights).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await analyticsApi.generateInsights()
      load()
    } finally {
      setGenerating(false)
    }
  }

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
        <SectionHeader title="ข้อมูลเชิงลึกอัตโนมัติ" description="การวิเคราะห์ที่สร้างโดย AI จากข้อมูลการใช้งาน" />
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {generating ? 'กำลังสร้าง…' : 'สร้างข้อมูลเชิงลึก'}
        </button>
      </div>

      {insights.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-sm text-zinc-400">ยังไม่มีข้อมูลเชิงลึก</p>
          <p className="text-xs text-zinc-400 mt-1">
            กด "สร้างข้อมูลเชิงลึก" เพื่อวิเคราะห์ข้อมูลและสร้างการสังเกตอัตโนมัติ
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    {TYPE_LABELS[insight.insightType] || insight.insightType}
                  </span>
                  <span className="shrink-0 text-zinc-300 dark:text-zinc-600">·</span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{insight.title}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <TrendBadge trend={insight.trend} change={insight.changePercent} />
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
                    {new Date(insight.generatedAt).toLocaleDateString('th-TH')}
                  </span>
                </div>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{insight.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
