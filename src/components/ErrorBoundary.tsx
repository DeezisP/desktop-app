import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error:     Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })

    const stack = [
      error.stack ?? error.message,
      '',
      'Component Stack:',
      errorInfo.componentStack ?? '(unavailable)',
    ].join('\n')

    console.error('[ErrorBoundary]', error, errorInfo)

    // Forward to main-process log file via IPC
    window.electronAPI?.logError?.(error.message, stack)
  }

  private handleReload = () => window.location.reload()

  private handleOpenLog = () => window.electronAPI?.openLogFile?.()

  render() {
    const { error, errorInfo } = this.state
    if (!error) return this.props.children

    const stack = [
      error.stack ?? error.message,
      errorInfo?.componentStack ? `\nComponent Stack:\n${errorInfo.componentStack}` : '',
    ].join('')

    return (
      <div style={styles.overlay}>
        <div style={styles.box}>
          <div style={styles.header}>
            <span style={styles.icon}>⚠</span>
            <span>Perfect Electronic — React Error</span>
          </div>

          <div style={styles.section}>
            <div style={styles.label}>Message</div>
            <div style={styles.value}>{error.message}</div>
          </div>

          <div style={styles.section}>
            <div style={styles.label}>Stack Trace</div>
            <pre style={styles.pre}>{stack}</pre>
          </div>

          <div style={styles.section}>
            <div style={styles.label}>Time</div>
            <div style={styles.value}>{new Date().toISOString()}</div>
          </div>

          <div style={styles.buttons}>
            <button style={styles.btnPrimary} onClick={this.handleReload}>
              Reload Application
            </button>
            <button style={styles.btnSecondary} onClick={this.handleOpenLog}>
              Open Error Log
            </button>
          </div>
        </div>
      </div>
    )
  }
}

// ── Inline styles (no Tailwind dependency — works even if CSS fails) ──────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position:        'fixed',
    inset:           0,
    background:      '#0f172a',
    color:           '#f1f5f9',
    fontFamily:      '"Consolas", "Monaco", "Courier New", monospace',
    fontSize:        '13px',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         '20px',
    zIndex:          99999,
    overflowY:       'auto',
  },
  box: {
    width:           '100%',
    maxWidth:        '900px',
    background:      '#1e293b',
    border:          '1px solid #ef4444',
    borderRadius:    '8px',
    overflow:        'hidden',
  },
  header: {
    background:      '#ef4444',
    color:           '#fff',
    padding:         '12px 20px',
    fontWeight:      'bold',
    fontSize:        '15px',
    display:         'flex',
    alignItems:      'center',
    gap:             '10px',
  },
  icon: {
    fontSize: '18px',
  },
  section: {
    padding:         '16px 20px',
    borderBottom:    '1px solid #334155',
  },
  label: {
    color:           '#94a3b8',
    fontSize:        '11px',
    textTransform:   'uppercase',
    letterSpacing:   '0.05em',
    marginBottom:    '6px',
    fontWeight:      'bold',
  },
  value: {
    color:           '#fbbf24',
    wordBreak:       'break-all',
  },
  pre: {
    margin:          0,
    color:           '#cbd5e1',
    whiteSpace:      'pre-wrap',
    wordBreak:       'break-all',
    maxHeight:       '300px',
    overflowY:       'auto',
    fontSize:        '12px',
    lineHeight:      '1.5',
  },
  buttons: {
    padding:         '16px 20px',
    display:         'flex',
    gap:             '12px',
  },
  btnPrimary: {
    background:      '#2563eb',
    color:           '#fff',
    border:          'none',
    borderRadius:    '6px',
    padding:         '8px 20px',
    cursor:          'pointer',
    fontSize:        '13px',
    fontWeight:      'bold',
  },
  btnSecondary: {
    background:      '#334155',
    color:           '#cbd5e1',
    border:          'none',
    borderRadius:    '6px',
    padding:         '8px 20px',
    cursor:          'pointer',
    fontSize:        '13px',
  },
}
