type EventName = 'page_open' | 'come_in' | 'scene01_complete' | 'envelope_open' | 'invitation_yes' | 'meeting_confirm' | 'meeting_adjust' | 'food_choice' | 'secret_letter_open' | 'replay'
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
    const body = JSON.stringify({ visitor_id: visitor, session_id: session, event_id: crypto.randomUUID(), event, timestamp: Date.now(), active_seconds: Math.min(86400, seconds()), page_path: location.pathname, ...(food ? { food } : {}) })
    if (beacon && navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'text/plain' }))) return
    pending = pending.then(async () => {
      const attempts = ['invitation_yes', 'meeting_confirm', 'meeting_adjust', 'food_choice'].includes(event) ? 3 : 1
      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true, credentials: 'omit', signal: AbortSignal.timeout(5000) })
          if (response.ok) return
          if (response.status < 500 && response.status !== 429) return
        } catch { /* Retry the same event ID without interrupting the invitation. */ }
        if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    })
  } catch { /* Storage, UUID, and transport restrictions must never affect the invitation. */ }
}
export function trackEvent(event: EventName, food?: string) {
  if (once.has(event)) return
  once.add(event)
  send(event, food)
}
try {
  const invitationOrigin = location.origin === 'https://october-with-you.vercel.app' || location.origin === 'https://claire-13-huang.github.io'
  const adminPath = /(^|\/)admin(\/|$)/.test(location.pathname)
  if (invitationOrigin && !adminPath) {
  const stored = localStorage.getItem('quiet-folk-visitor')
  if (stored) visitor = stored
  else {
    visitor = crypto.randomUUID()
    localStorage.setItem('quiet-folk-visitor', visitor)
  }
  session = crypto.randomUUID()
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
  }
} catch { session = ''; /* If identity cannot persist, skip tracking rather than inventing new visitors. */ }
