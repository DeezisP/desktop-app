interface HealthScoreCardProps {
  type: string
  score: number | null
  scoreDate?: string
}

function getStrokeColor(score: number | null) {
  if (score === null) return 'stroke-zinc-300 dark:stroke-zinc-600'
  if (score >= 85) return 'stroke-emerald-500'
  if (score >= 65) return 'stroke-amber-500'
  return 'stroke-red-500'
}

function getTextColor(score: number | null) {
  if (score === null) return 'text-zinc-400'
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 65) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export function HealthScoreCard({ type, score, scoreDate }: HealthScoreCardProps) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const pct = score !== null ? Math.min(Math.max(score, 0), 100) : 0
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 flex items-center gap-4">
      <div className="relative shrink-0">
        <svg width="88" height="88" className="-rotate-90">
          <circle cx="44" cy="44" r={radius} fill="none"
            className="stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="8" />
          <circle cx="44" cy="44" r={radius} fill="none"
            className={getStrokeColor(score)} strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${getTextColor(score)}`}>
            {score !== null ? score : '—'}
          </span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{type}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">คะแนนจาก 100</p>
        {scoreDate && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            อัปเดต {new Date(scoreDate).toLocaleDateString('th-TH')}
          </p>
        )}
      </div>
    </div>
  )
}
