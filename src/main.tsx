import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/** Reports of the app "freezing" with no visible error are otherwise undiagnosable —
 *  a thrown error outside React's render (a timer/interval callback, an unhandled
 *  promise rejection) doesn't trigger the router's error boundary and leaves no trace.
 *  Catch both here and keep the last few in localStorage so they can be inspected
 *  after the fact (e.g. via a browser's remote inspector) instead of only living in
 *  a console that's already gone by the time anyone looks. */
function recordDiagnosticError(entry: Record<string, unknown>) {
  try {
    const key = 'debug:lastErrors'
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]')
    const next = [...(Array.isArray(existing) ? existing : []), { ...entry, at: new Date().toISOString() }].slice(-10)
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // localStorage full/unavailable — nothing more we can do here
  }
}

window.addEventListener('error', (event) => {
  console.error('[global error]', event.error ?? event.message)
  recordDiagnosticError({ kind: 'error', message: event.message, stack: event.error?.stack })
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  console.error('[unhandled rejection]', reason)
  recordDiagnosticError({
    kind: 'unhandledrejection',
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
