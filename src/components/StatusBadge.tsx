import type { ImportStatus, QueueStatus, MatchConfidence } from '../types/warehouse'

type StatusValue = ImportStatus | QueueStatus | MatchConfidence | string

const COLORS: Record<string, string> = {
  // QueueStatus
  WAITING: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
  PACKING: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  DONE:    'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
  ERROR:   'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',

  // ImportStatus
  IMPORTED:  'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  PACKED:    'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
  CANCELLED: 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30',

  // MatchConfidence
  EXACT:     'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  VERY_HIGH: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
  HIGH:      'bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/30',
  MEDIUM:    'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
  LOW:       'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
  UNMATCHED: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
}

interface Props {
  value: StatusValue | null | undefined
  className?: string
}

export function StatusBadge({ value, className = '' }: Props) {
  if (!value) return null
  const color = COLORS[value] ?? 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color} ${className}`}>
      {value}
    </span>
  )
}
