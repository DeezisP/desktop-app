import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  /** True while the app is initialising (auth check not yet complete). */
  isVisible: boolean
}

/**
 * Full-screen branded splash that sits in front of everything while the app
 * is initialising. Fades out once `isVisible` becomes false.
 *
 * Rendered inside the Router so the React tree is already mounted behind it —
 * no route or context is ever "seen" before auth is resolved.
 */
export function AppLoader({ isVisible }: Props) {
  const [version, setVersion] = useState<string | null>(null)

  // Fetch the Electron app version once on mount.
  useEffect(() => {
    window.electronAPI?.appVersion?.()
      .then((v) => setVersion(v))
      .catch(() => {})
  }, [])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="app-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          // Inline background ensures loader is opaque even before Tailwind loads.
          style={{ backgroundColor: '#09090b', position: 'fixed', inset: 0, zIndex: 99999 }}
          className="flex flex-col items-center justify-center select-none"
          aria-label="กำลังเริ่มต้น"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-5">

            {/* Brand mark */}
            <div className="relative">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-2xl"
                style={{ boxShadow: '0 0 48px rgba(37,99,235,0.40)' }}
              >
                <span className="text-white font-bold text-[28px] tracking-tight leading-none">P</span>
              </motion.div>
              {/* Subtle pulse ring */}
              <div
                className="absolute inset-0 rounded-2xl bg-blue-500 animate-ping"
                style={{ opacity: 0.15, animationDuration: '1.8s' }}
              />
            </div>

            {/* App name */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12, ease: 'easeOut' }}
              className="text-center space-y-1"
            >
              <p className="text-zinc-100 font-semibold text-[15px] tracking-tight">
                Perfect Electronic
              </p>
              <p className="text-zinc-500 text-[11px]">Warehouse Management</p>
            </motion.div>

            {/* Loading indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              className="flex items-center gap-2 mt-1"
            >
              <LoadingDots />
            </motion.div>
          </div>

          {/* Version badge — bottom of screen */}
          {version && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="absolute bottom-8 text-zinc-600 text-[11px] font-mono tracking-wider"
            >
              v{version}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Three-dot loading animation ───────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-zinc-600"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.18,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
