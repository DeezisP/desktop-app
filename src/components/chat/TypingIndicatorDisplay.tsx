import { memo } from 'react'

interface TypingIndicatorProps {
  names: string[]
}

const TypingDot = memo(() => (
  <span className="inline-block w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" />
))

export const TypingIndicator = memo(function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null

  const displayText =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`

  return (
    <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 py-1 px-4">
      {displayText}
      <div className="flex gap-1 ml-1">
        <TypingDot />
        <TypingDot />
        <TypingDot />
      </div>
    </div>
  )
})
