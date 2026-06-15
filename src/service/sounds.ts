import { useSettingsStore } from '../store/settingsStore'

let audioCtx: AudioContext | null = null

function ctx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// Musical tone: decaying envelope — used for chimes, pings, clicks.
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
      const ac   = ctx()
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

// Scanner / buzzer beep: flat-top envelope (instant rise → sustain → sharp fall).
// A low-pass filter at 2.5× the fundamental strips harsh upper harmonics and
// gives the warm "piezo buzzer" timbre that real barcode scanners produce.
function beep(
  frequency: number,
  duration: number,
  volume  = 0.2,
  delayMs = 0,
) {
  if (!useSettingsStore.getState().soundEnabled) return
  setTimeout(() => {
    try {
      const ac     = ctx()
      const osc    = ac.createOscillator()
      const filter = ac.createBiquadFilter()
      const gain   = ac.createGain()

      osc.type = 'square'
      osc.frequency.setValueAtTime(frequency, ac.currentTime)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(frequency * 2.5, ac.currentTime)
      filter.Q.setValueAtTime(0.7, ac.currentTime)

      const t = ac.currentTime
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(volume, t + 0.002)       // 2 ms attack
      gain.gain.setValueAtTime(volume, t + duration - 0.008)     // sustain
      gain.gain.linearRampToValueAtTime(0, t + duration)         // 8 ms release

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + duration + 0.015)
    } catch {
      // AudioContext unavailable in headless/test environments
    }
  }, delayMs)
}

export const sounds = {
  // ~1900 Hz, 80 ms flat-top — matches the piezo beep of Honeywell/Zebra scanners
  scanSuccess() {
    beep(1900, 0.08, 0.18)
  },

  // Descending two-tone buzz (380 Hz → 220 Hz) — universally recognisable as
  // "wrong / not found"; clearly distinct from the high-pitched success beep
  scanError() {
    beep(380, 0.14, 0.3)
    beep(220, 0.22, 0.3, 150)
  },

  // Two quick beeps at scanner pitch — scanner language for "already scanned"
  scanDuplicate() {
    beep(1900, 0.065, 0.15)
    beep(1900, 0.065, 0.15, 110)
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
