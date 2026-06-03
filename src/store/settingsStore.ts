import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

interface SettingsState {
  theme: ThemeMode
  soundEnabled: boolean
  notificationsEnabled: boolean
  stationName: string
  setTheme: (theme: ThemeMode) => void
  setSoundEnabled: (v: boolean) => void
  setNotificationsEnabled: (v: boolean) => void
  setStationName: (name: string) => void
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v !== null ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = mode === 'dark' || (mode === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', dark)
}

// Apply theme immediately on module load (prevents FOUC)
applyTheme(load<ThemeMode>('settings.theme', 'system'))

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: load<ThemeMode>('settings.theme', 'system'),
  soundEnabled: load<boolean>('settings.sound', true),
  notificationsEnabled: load<boolean>('settings.notifications', true),
  stationName: load<string>('settings.stationName', ''),

  setTheme: (theme) => {
    save('settings.theme', theme)
    set({ theme })
    applyTheme(theme)
  },
  setSoundEnabled: (v) => { save('settings.sound', v); set({ soundEnabled: v }) },
  setNotificationsEnabled: (v) => { save('settings.notifications', v); set({ notificationsEnabled: v }) },
  setStationName: (name) => { save('settings.stationName', name); set({ stationName: name }) },
}))

// Keep theme in sync when OS preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const current = useSettingsStore.getState().theme
  if (current === 'system') applyTheme('system')
})
