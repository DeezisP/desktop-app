import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface Props {
  children: React.ReactNode
}

// If auth takes longer than this, surface a diagnostic screen.
const INIT_TIMEOUT_MS = 8000

/**
 * Guards authenticated routes.
 *
 * The global AppLoader in App.tsx handles the loading screen while
 * `isLoading` is true, so this component does NOT render its own
 * spinner. Its only jobs are:
 *   1. Return null while loading (AppLoader covers the UI)
 *   2. Show a diagnostic screen if loading hangs
 *   3. Navigate to /login if not authenticated
 *   4. Render children when authenticated
 */
export function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth()
  const [timedOut, setTimedOut]        = useState(false)
  const [logContents, setLogContents]  = useState<string | null>(null)

  // Watchdog: if init hasn't finished within the timeout, show diagnostics.
  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false)
      return
    }
    const t = setTimeout(() => {
      console.error('[ProtectedRoute] initialization timeout after', INIT_TIMEOUT_MS, 'ms')
      setTimedOut(true)
      window.electronAPI?.readLog?.()
        .then((contents) => setLogContents(contents))
        .catch(() => {})
    }, INIT_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [isLoading])

  // ── Startup timeout diagnostic ────────────────────────────────────────────

  if (isLoading && timedOut) {
    return (
      <div style={styles.overlay}>
        <div style={styles.box}>
          <div style={styles.header}>
            <span>⏱</span>
            <span>Perfect Electronic — Startup Timeout</span>
          </div>
          <div style={styles.section}>
            <div style={styles.label}>Problem</div>
            <div style={styles.value}>
              Initialization did not complete within {INIT_TIMEOUT_MS / 1000} seconds.
            </div>
          </div>
          <div style={styles.section}>
            <div style={styles.label}>Diagnostics</div>
            <div style={styles.value}>
              <div>window.electronAPI: {typeof window.electronAPI}</div>
              <div>protocol: {window.location.protocol}</div>
              <div>pathname: {window.location.pathname}</div>
              <div>userAgent: {navigator.userAgent}</div>
            </div>
          </div>
          {logContents && (
            <div style={styles.section}>
              <div style={styles.label}>Error Log (last 4 KB)</div>
              <pre style={styles.pre}>{logContents.slice(-4096)}</pre>
            </div>
          )}
          <div style={styles.buttons}>
            <button style={styles.btnPrimary} onClick={() => window.location.reload()}>
              Reload
            </button>
            <button style={styles.btnSecondary} onClick={() => window.electronAPI?.openLogFile?.()}>
              Open Error Log
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Loading: AppLoader in App.tsx is covering everything — render nothing ──

  if (isLoading) return null

  // ── Not authenticated: redirect to login ──────────────────────────────────

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <>{children}</>
}

// ── Inline styles (diagnostic overlay, independent of Tailwind) ───────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: '#0f172a', color: '#f1f5f9',
    fontFamily: '"Consolas","Monaco","Courier New",monospace', fontSize: '13px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', overflowY: 'auto', zIndex: 99999,
  },
  box: {
    width: '100%', maxWidth: '900px', background: '#1e293b',
    border: '1px solid #f59e0b', borderRadius: '8px', overflow: 'hidden',
  },
  header: {
    background: '#f59e0b', color: '#1e293b', padding: '12px 20px',
    fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '10px',
  },
  section: { padding: '16px 20px', borderBottom: '1px solid #334155' },
  label: {
    color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' as const,
    letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 'bold',
  },
  value:  { color: '#fbbf24', wordBreak: 'break-all' as const, lineHeight: '1.6' },
  pre: {
    margin: 0, color: '#94a3b8', whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const, maxHeight: '300px', overflowY: 'auto' as const,
    fontSize: '11px', lineHeight: '1.5',
  },
  buttons: { padding: '16px 20px', display: 'flex', gap: '12px' },
  btnPrimary: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '8px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
  },
  btnSecondary: {
    background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '6px',
    padding: '8px 20px', cursor: 'pointer', fontSize: '13px',
  },
}
