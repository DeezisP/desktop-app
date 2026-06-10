import type { ReactNode } from 'react'

interface PageShellProps {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  noPad?: boolean
}

export function PageShell({ title, description, actions, children, noPad }: PageShellProps) {
  return (
    <div className={noPad ? 'h-full flex flex-col' : 'p-5 space-y-4'}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-[15px] font-semibold text-zinc-800 dark:text-zinc-100">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className={noPad ? 'flex-1 overflow-hidden' : ''}>{children}</div>
    </div>
  )
}
