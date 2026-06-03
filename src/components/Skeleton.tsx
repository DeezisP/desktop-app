import React from 'react'
import { cn } from '../lib/utils'

// ── Base pulse block ──────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800',
        className,
      )}
      style={style}
    />
  )
}

// ── Table skeleton (N rows × M cols) ─────────────────────────────────────────

interface TableSkeletonProps {
  rows?: number
  cols?: number
  className?: string
}

export function TableSkeleton({ rows = 5, cols = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('w-full space-y-2', className)}>
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton
              key={col}
              className="h-4 flex-1"
              style={{ opacity: 0.6 + (row % 2 === 0 ? 0.1 : 0) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Card skeleton ─────────────────────────────────────────────────────────────

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-2.5 w-full" />
      <Skeleton className="h-2.5 w-5/6" />
    </div>
  )
}

// ── List skeleton (queue items) ───────────────────────────────────────────────

export function QueueSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
          style={{ opacity: 1 - i * 0.12 }}
        >
          <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-7 w-16 rounded-lg flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ── Full-page loading screen ──────────────────────────────────────────────────

export function PageSkeleton() {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <TableSkeleton rows={6} cols={5} />
    </div>
  )
}
