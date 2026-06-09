import { useSettingsStore } from '../store/settingsStore'

let audioCtx: AudioContext | null = null

function ctx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  // AudioContext can be suspended until user interaction
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.25,
  delayMs = 0,
) {
  if (!useSettingsStore.getState().soundEnabled) return
  setTimeout(() => {
    try {
      const ac = ctx()
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(frequency, ac.currentTime)
      gain.gain.setValueAtTime(volume, ac.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(ac.currentTime)
      osc.stop(ac.currentTime + duration)
    } catch {
      // AudioContext unavailable in headless/test environments
    }
  }, delayMs)
}

export const sounds = {
  /** Short clean beep on successful barcode scan */
  scanSuccess() {
    tone(880, 0.09, 'sine', 0.28)
  },

  /** Double low buzz on scan error or held barcode */
  scanError() {
    tone(280, 0.1, 'square', 0.18)
    tone(230, 0.14, 'square', 0.18, 120)
  },

  /** Double quick beep — already-packed / duplicate scan (success variant) */
  scanDuplicate() {
    tone(880, 0.07, 'sine', 0.22)
    tone(880, 0.07, 'sine', 0.22, 110)
  },

  /** Ascending two-note chime on confirm / pack complete */
  confirm() {
    tone(660, 0.07, 'sine', 0.2)
    tone(880, 0.1,  'sine', 0.2, 90)
  },

  /** Soft single ping for info notifications */
  notify() {
    tone(660, 0.12, 'sine', 0.14)
  },

  /** Subtle click for UI interactions */
  click() {
    tone(1200, 0.04, 'sine', 0.1)
  },
}

/** Send a desktop notification if permission is granted and the setting is on */
export function sendDesktopNotification(title: string, body?: string) {
  if (!useSettingsStore.getState().notificationsEnabled) return
  try {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, silent: true })
    }
  } catch {
    // Silently fail if notifications are not supported
  }
}
