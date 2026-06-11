import React from 'react'

interface Column {
  key: string
  label: string
  align?: 'left' | 'right'
  format?: (val: unknown) => React.ReactNode
}

interface DataTableProps {
  columns: Column[]
  rows: Record<string, unknown>[]
  emptyMessage?: string
}

export function DataTable({ columns, rows, emptyMessage = 'ไม่มีข้อมูล' }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {columns.map(col => (
              <th
                key={col.key}
                className={`pb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider
                  ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`py-2.5 text-zinc-700 dark:text-zinc-300
                      ${col.align === 'right' ? 'text-right tabular-nums' : 'text-left'}`}
                  >
                    {col.format ? col.format(row[col.key]) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
