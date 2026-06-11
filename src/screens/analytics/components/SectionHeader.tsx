interface SectionHeaderProps {
  title: string
  description?: string
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      {description && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
      )}
    </div>
  )
}
