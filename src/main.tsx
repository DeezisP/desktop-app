import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// ── Pure-DOM error overlay (works before React mounts) ────────────────────────

function showCriticalError(title: string, message: string, stack: string) {
  // Remove any existing overlay
  document.getElementById('critical-error-overlay')?.remove()

  const ts = new Date().toISOString()

  const el = document.createElement('div')
  el.id = 'critical-error-overlay'
  el.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:#0f172a',
    'color:#f1f5f9',
    'font-family:"Consolas","Monaco","Courier New",monospace',
    'font-size:13px',
    'padding:0',
    'z-index:99999',
    'overflow:auto',
    'display:flex',
    'align-items:center',
    'justify-content:center',
  ].join(';')

  el.innerHTML = `
<div style="width:100%;max-width:900px;margin:20px auto;background:#1e293b;border:1px solid #ef4444;border-radius:8px;overflow:hidden;">
  <div style="background:#ef4444;color:#fff;padding:12px 20px;font-weight:bold;font-size:15px;display:flex;align-items:center;gap:10px;">
    <span>⚠</span><span>Perfect ELT Warehouse — ${escHtml(title)}</span>
  </div>
  <div style="padding:16px 20px;border-bottom:1px solid #334155;">
    <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;font-weight:bold;">Message</div>
    <div style="color:#fbbf24;word-break:break-all;">${escHtml(message)}</div>
  </div>
  <div style="padding:16px 20px;border-bottom:1px solid #334155;">
    <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;font-weight:bold;">Stack</div>
    <pre style="margin:0;color:#cbd5e1;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto;font-size:12px;line-height:1.5;">${escHtml(stack)}</pre>
  </div>
  <div style="padding:16px 20px;border-bottom:1px solid #334155;">
    <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;font-weight:bold;">Time</div>
    <div style="color:#94a3b8;">${ts}</div>
  </div>
  <div style="padding:16px 20px;display:flex;gap:12px;">
    <button onclick="window.location.reload()"
      style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 20px;cursor:pointer;font-size:13px;font-weight:bold;">
      Reload
    </button>
    <button onclick="window.electronAPI?.openLogFile?.()"
      style="background:#334155;color:#cbd5e1;border:none;border-radius:6px;padding:8px 20px;cursor:pointer;font-size:13px;">
      Open Error Log
    </button>
  </div>
</div>`

  document.body.appendChild(el)

  // Forward to IPC log
  try {
    window.electronAPI?.logError?.(title + ': ' + message, stack)
  } catch {}
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Global uncaught error handler ─────────────────────────────────────────────

window.addEventListener('error', (ev) => {
  const msg   = ev.message ?? 'Unknown error'
  const stack = ev.error?.stack ?? `${ev.filename}:${ev.lineno}:${ev.colno}`
  console.error('[renderer] uncaught error:', msg, stack)
  showCriticalError('Uncaught JavaScript Error', msg, stack)
})

window.addEventListener('unhandledrejection', (ev) => {
  const reason = ev.reason
  const msg    = reason instanceof Error ? reason.message : String(reason)
  const stack  = reason instanceof Error ? (reason.stack ?? '') : ''
  console.error('[renderer] unhandled rejection:', msg)
  showCriticalError('Unhandled Promise Rejection', msg, stack)
})

// ── Startup diagnostics ───────────────────────────────────────────────────────

console.log('[renderer] main.tsx executing')
console.log('[renderer] window.electronAPI defined:', typeof window.electronAPI !== 'undefined')
console.log('[renderer] navigator.userAgent:', navigator.userAgent)
console.log('[renderer] protocol:', window.location.protocol)
console.log('[renderer] pathname:', window.location.pathname)

const rootEl = document.getElementById('root')
console.log('[renderer] #root found:', rootEl !== null)

// ── Mount ─────────────────────────────────────────────────────────────────────

if (!rootEl) {
  showCriticalError(
    'Mount Failure',
    '#root element not found in index.html',
    'The HTML template does not contain <div id="root">. The Vite build may be broken.',
  )
} else {
  try {
    console.log('[renderer] calling ReactDOM.createRoot().render()')
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
    console.log('[renderer] render() dispatched')
  } catch (err: unknown) {
    const e     = err instanceof Error ? err : new Error(String(err))
    const stack = e.stack ?? e.message
    console.error('[renderer] ReactDOM.createRoot().render() threw:', e)
    showCriticalError('React Failed to Mount', e.message, stack)
  }
}
