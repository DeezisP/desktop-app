import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// ── Global renderer error surface ─────────────────────────────────────────────
// These fire for any uncaught JS exception or rejected promise.
// In production the devtools aren't open — pipe errors to console so
// Electron's main-process stderr / remote debugger can catch them.

window.addEventListener('error', (ev) => {
  console.error('[renderer] uncaught error:', ev.message, ev.filename, ev.lineno, ev.error)
})

window.addEventListener('unhandledrejection', (ev) => {
  console.error('[renderer] unhandled rejection:', ev.reason)
})

// ── Mount ─────────────────────────────────────────────────────────────────────

console.log('[renderer] main.tsx executing')
console.log('[renderer] window.electronAPI defined:', typeof window.electronAPI !== 'undefined')
console.log('[renderer] protocol:', window.location.protocol)
console.log('[renderer] pathname:', window.location.pathname)

const rootEl = document.getElementById('root')
console.log('[renderer] #root element found:', rootEl !== null)

if (!rootEl) {
  document.body.style.cssText = 'background:#dc2626;color:#fff;font-size:24px;padding:40px'
  document.body.textContent = '#root element not found — index.html is broken'
} else {
  console.log('[renderer] calling ReactDOM.createRoot().render()')
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  console.log('[renderer] render() called')
}
