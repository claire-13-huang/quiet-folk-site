type EventName = 'page_open' | 'come_in' | 'scene01_complete' | 'envelope_open' | 'invitation_yes' | 'meeting_confirm' | 'food_choice' | 'secret_letter_open' | 'replay'
const endpoint = 'https://quiet-folk-analytics.claire-quiet-folk.workers.dev/collect'
let visitor = '', session = '', active = 0, visibleSince: number | null = null
let pending = Promise.resolve()
const once = new Set<EventName>()
function seconds() {
  return Math.floor((active + (visibleSince === null ? 0 : performance.now() - visibleSince)) / 1000)
}
function send(event: EventName | 'heartbeat' | 'session_end', food?: string, beacon = false) {
  try {
    if (!session) return
    const body = JSON.stringify({ visitor_id: visitor, session_id: session, event_id: crypto.randomUUID(), event, timestamp: Date.now(), active_seconds: Math.min(86400, seconds()), ...(food ? { food } : {}) })
    if (beacon && navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'text/plain' }))) return
    pending = pending.then(async () => {
      try { await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true, credentials: 'omit', signal: AbortSignal.timeout(5000) }) } catch { /* Analytics is optional and never interrupts the invitation. */ }
    })
  } catch { /* Storage, UUID, and transport restrictions must never affect the invitation. */ }
}
export function trackEvent(event: EventName, food?: string) {
  if (once.has(event)) return
  once.add(event)
  send(event, food)
}
try {
  session = crypto.randomUUID()
  try {
    const stored = localStorage.getItem('quiet-folk-visitor')
    visitor = stored && /^[0-9a-f-]{36}$/i.test(stored) ? stored : crypto.randomUUID()
    localStorage.setItem('quiet-folk-visitor', visitor)
  } catch { visitor = crypto.randomUUID() }
  visibleSince = document.hidden ? null : performance.now()
  send('page_open')
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (navigation?.type === 'reload') send('replay')
  setInterval(() => { if (!document.hidden) send('heartbeat') }, 30000)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (visibleSince !== null) active += performance.now() - visibleSince
      visibleSince = null
      send('heartbeat', undefined, true)
    } else { visibleSince = performance.now(); send('heartbeat') }
  })
  window.addEventListener('pagehide', () => {
    if (visibleSince !== null) active += performance.now() - visibleSince
    visibleSince = null
    send('session_end', undefined, true)
  })
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      session = crypto.randomUUID(); active = 0; visibleSince = document.hidden ? null : performance.now(); once.clear(); send('page_open')
    }
  })
} catch { /* Unsupported browsers continue with the invitation normally. */ }
