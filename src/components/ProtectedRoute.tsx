import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface Props {
  children: React.ReactNode
}

const INIT_TIMEOUT_MS = 5000

export function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth()
  const [timedOut, setTimedOut]        = useState(false)
  const [logContents, setLogContents]  = useState<string | null>(null)

  // Start a watchdog timer while isLoading is true.
  // If initialization hasn't finished in 5 s, surface a diagnostic screen.
  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false)
      return
    }
    const t = setTimeout(() => {
      console.error('[ProtectedRoute] initialization timeout after', INIT_TIMEOUT_MS, 'ms')
      setTimedOut(true)
      // Try to fetch log contents for display
      window.electronAPI?.readLog?.().then((contents) => {
        setLogContents(contents)
      }).catch(() => {})
    }, INIT_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [isLoading])

  // ── Timeout screen ────────────────────────────────────────────────────────

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
              <pre style={styles.pre}>
                {logContents.slice(-4096)}
              </pre>
            </div>
          )}

          <div style={styles.buttons}>
            <button style={styles.btnPrimary} onClick={() => window.location.reload()}>
              Reload
            </button>
            <button style={styles.btnSecondary} onClick={() => window.electronAPI?.openLogFile?.()}>
              Open Error Log File
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Normal loading spinner ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        <p className="text-sm text-slate-400">Initializing…</p>
        <p className="text-xs text-slate-600">
          Timeout in {INIT_TIMEOUT_MS / 1000}s if this hangs
        </p>
      </div>
    )
  }

  // ── Guard: redirect to login ──────────────────────────────────────────────

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// ── Inline styles (independent of Tailwind) ───────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position:       'fixed',
    inset:          0,
    background:     '#0f172a',
    color:          '#f1f5f9',
    fontFamily:     '"Consolas","Monaco","Courier New",monospace',
    fontSize:       '13px',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '20px',
    overflowY:      'auto',
    zIndex:         9999,
  },
  box: {
    width:          '100%',
    maxWidth:       '900px',
    background:     '#1e293b',
    border:         '1px solid #f59e0b',
    borderRadius:   '8px',
    overflow:       'hidden',
  },
  header: {
    background:     '#f59e0b',
    color:          '#1e293b',
    padding:        '12px 20px',
    fontWeight:     'bold',
    fontSize:       '15px',
    display:        'flex',
    alignItems:     'center',
    gap:            '10px',
  },
  section: {
    padding:        '16px 20px',
    borderBottom:   '1px solid #334155',
  },
  label: {
    color:          '#94a3b8',
    fontSize:       '11px',
    textTransform:  'uppercase' as const,
    letterSpacing:  '0.05em',
    marginBottom:   '6px',
    fontWeight:     'bold',
  },
  value: {
    color:          '#fbbf24',
    wordBreak:      'break-all' as const,
    lineHeight:     '1.6',
  },
  pre: {
    margin:         0,
    color:          '#94a3b8',
    whiteSpace:     'pre-wrap' as const,
    wordBreak:      'break-all' as const,
    maxHeight:      '300px',
    overflowY:      'auto' as const,
    fontSize:       '11px',
    lineHeight:     '1.5',
  },
  buttons: {
    padding:        '16px 20px',
    display:        'flex',
    gap:            '12px',
  },
  btnPrimary: {
    background:     '#2563eb',
    color:          '#fff',
    border:         'none',
    borderRadius:   '6px',
    padding:        '8px 20px',
    cursor:         'pointer',
    fontSize:       '13px',
    fontWeight:     'bold',
  },
  btnSecondary: {
    background:     '#334155',
    color:          '#cbd5e1',
    border:         'none',
    borderRadius:   '6px',
    padding:        '8px 20px',
    cursor:         'pointer',
    fontSize:       '13px',
  },
}
