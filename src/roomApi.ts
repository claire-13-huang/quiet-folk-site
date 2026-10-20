import { getSubmissionIdentity } from './analytics'
const origin = import.meta.env.VITE_ROOM_API_URL || 'https://quiet-folk-analytics.claire-quiet-folk.workers.dev'
export async function saveRoomNote(kind: 'private-letter' | 'feedback', data: { id: string; content?: string; rating?: number | null; message?: string; sealed?: boolean }, identity: ReturnType<typeof getSubmissionIdentity>) {
  const response = await fetch(`${origin}/room/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity, ...data }), credentials: 'omit', signal: AbortSignal.timeout(15000) })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.ok || result.id !== data.id) throw new Error(result?.error || 'It could not be kept just yet. Your words are still here; please try again.')
  return result as { ok: true; id: string; sealed?: boolean }
}
