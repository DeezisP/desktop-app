import { Sun, Moon, Monitor } from 'lucide-react'
import { useSettingsStore, type ThemeMode } from '../store/settingsStore'

const CYCLE: ThemeMode[] = ['light', 'dark', 'system']

const ICON: Record<ThemeMode, React.ReactNode> = {
  light:  <Sun  size={13} />,
  dark:   <Moon size={13} />,
  system: <Monitor size={13} />,
}

const LABEL: Record<ThemeMode, string> = {
  light:  'Light mode',
  dark:   'Dark mode',
  system: 'System theme',
}

export function ThemeToggle() {
  const theme    = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length]
    setTheme(next)
  }

  return (
    <button
      onClick={cycle}
      title={LABEL[theme]}
      aria-label={LABEL[theme]}
      className="flex items-center justify-center w-7 h-7 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {ICON[theme]}
    </button>
  )
}
