export async function sendMessage({ message, sessionId, confirm = false, pendingActionId = null, idempotencyKey = null }) {
  const res = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, confirm, pendingActionId, idempotencyKey }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Assistant error')
  return data
}
