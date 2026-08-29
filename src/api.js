// All communication with the FastAPI backend lives here, in one place —
// so components never touch fetch() directly, they just call these functions.

// Points at the deployed backend in production, falls back to localhost
// for local development. Set VITE_API_BASE_URL in frontend/.env once the
// backend is deployed and you have its real URL.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api/v1'

// Sent on every request via the X-API-Key header (see app/core/auth.py on
// the backend). Must match the backend's API_KEY setting exactly.
const API_KEY = import.meta.env.VITE_API_KEY

function authHeaders(extra = {}) {
  return { 'X-API-Key': API_KEY, ...extra }
}

// Every user gets a random session ID the first time they open the app,
// saved in localStorage so refreshing the page doesn't lose their chat/docs.
export function getSessionId() {
  let id = localStorage.getItem('rag_session_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('rag_session_id', id)
  }
  return id
}

export async function uploadDocument(file) {
  const formData = new FormData()
  formData.append('session_id', getSessionId())
  formData.append('file', file)

  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', headers: authHeaders(), body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Upload failed (${res.status})`)
  }
  return res.json()
}

export async function listDocuments() {
  const res = await fetch(`${API_BASE}/documents?session_id=${getSessionId()}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Failed to load documents (${res.status})`)
  const data = await res.json()
  return data.documents
}

export async function deleteDocument(filename) {
  const res = await fetch(
    `${API_BASE}/documents/${encodeURIComponent(filename)}?session_id=${getSessionId()}`,
    { method: 'DELETE', headers: authHeaders() }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Delete failed (${res.status})`)
  }
  return res.json()
}

/**
 * Streams a chat response. Instead of returning a value, this calls your
 * callback functions as events arrive — because with streaming, there's
 * no single "the answer" to return, just a sequence of things happening
 * over time.
 *
 * How the parsing works: the server sends chunks of raw text like
 *   "event: token\ndata: {\"type\":\"token\",\"text\":\"Hello\"}\n\n"
 * We read raw bytes as they arrive, turn them into a string, and split on
 * the blank line ("\n\n") that marks the end of one event — that's the
 * SSE spec's own delimiter, we're not inventing anything here.
 *
 * @param {string} query
 * @param {{onStatus, onSources, onToken, onDone, onError}} callbacks
 */
export async function streamChat(query, { onStatus, onSources, onToken, onDone, onError }) {
  try {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ session_id: getSessionId(), query }),
    })
    if (!res.ok || !res.body) {
      throw new Error(`Chat request failed (${res.status})`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process every complete event currently in the buffer; leave any
      // partial (still-arriving) event for the next chunk to complete.
      let boundary
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '))
        if (!dataLine) continue

        const payload = JSON.parse(dataLine.slice('data: '.length))

        switch (payload.type) {
          case 'status':
            onStatus?.(payload.text)
            break
          case 'sources':
            onSources?.({ pdf: payload.pdf, web: payload.web })
            break
          case 'token':
            onToken?.(payload.text)
            break
          case 'done':
            onDone?.()
            break
        }
      }
    }
  } catch (err) {
    onError?.(err.message || 'Something went wrong')
  }
}
