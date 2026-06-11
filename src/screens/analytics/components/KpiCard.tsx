interface KpiCardProps {
  label: string
  value: string | number
  delta?: number | null
  sub?: string
}

function formatDelta(delta: number) {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}%`
}

export function KpiCard({ label, value, delta, sub }: KpiCardProps) {
  const positive = delta !== undefined && delta !== null && delta >= 0
  const hasData = delta !== undefined && delta !== null

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2 h-4">
        {hasData && (
          <span className={`text-xs font-medium ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatDelta(delta!)}
          </span>
        )}
        {sub && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{sub}</span>
        )}
      </div>
    </div>
  )
}
