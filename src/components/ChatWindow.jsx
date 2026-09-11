import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamChat, getSessionId, getSessionDetail } from '../api.js'
import LumenLogo from './LumenLogo.jsx'

export default function ChatWindow() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [statusText, setStatusText] = useState(null) // the "Searching your document..." line
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState(getSessionId())
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const historyRequestRef = useRef(0)
  const chatRequestRef = useRef(0)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, statusText])

  // Load chat history when session changes
  const loadSessionHistory = async (sessionId) => {
    const requestId = ++historyRequestRef.current
    try {
      const sessionDetail = await getSessionDetail(sessionId)
      if (requestId !== historyRequestRef.current) return
      setMessages(sessionDetail.chat_history.map(msg => ({
        role: msg.role,
        text: msg.content,
        sources: msg.sources || null
      })))
    } catch (err) {
      if (requestId !== historyRequestRef.current) return
      console.error('Failed to load session history:', err)
      setMessages([]) // Clear messages if load fails
    }
  }

  // Listen for session changes via event (proper way)
  useEffect(() => {
    const handleSessionChange = (event) => {
      const { sessionId } = event.detail
      chatRequestRef.current += 1
      setCurrentSessionId(sessionId)
      setMessages([])
      setStatusText(null)
      setIsStreaming(false)
      loadSessionHistory(sessionId)
    }

    window.addEventListener('session-changed', handleSessionChange)
    return () => window.removeEventListener('session-changed', handleSessionChange)
  }, [])

  useEffect(() => {
    loadSessionHistory(currentSessionId)
  }, [])

  async function handleSend() {
    const query = input.trim()
    if (!query || isStreaming) return

    setInput('')
    setIsStreaming(true)
    setStatusText(null)
    const requestId = ++chatRequestRef.current

    // Add the user's message, and an empty placeholder assistant message
    // that we'll fill in token-by-token as the stream arrives.
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: query },
      { role: 'assistant', text: '', sources: null },
    ])

    await streamChat(query, {
      onStatus: (text) => {
        if (requestId === chatRequestRef.current) setStatusText(text)
      },

      onSources: (sources) => {
        if (requestId !== chatRequestRef.current) return
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], sources }
          return updated
        })
      },

      onToken: (chunk) => {
        if (requestId !== chatRequestRef.current) return
        setStatusText(null) // real text has started, hide the "thinking" line
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, text: last.text + chunk }
          return updated
        })
      },

      onDone: () => {
        if (requestId !== chatRequestRef.current) return
        setIsStreaming(false)
        setStatusText(null)
        // Refresh session list after chat to show updated name from auto-naming
        window.dispatchEvent(new CustomEvent('chat-completed', { detail: { sessionId: getSessionId() } }))
      },

      onError: (message) => {
        if (requestId !== chatRequestRef.current) return
        setIsStreaming(false)
        setStatusText(null)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            text: `⚠️ ${message}`,
          }
          return updated
        })
      },
    })
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // File size validation
    const maxSizeMB = 15
    const fileSizeMB = file.size / (1024 * 1024)
    
    if (fileSizeMB > maxSizeMB) {
      alert(`File too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${maxSizeMB}MB.`)
      return
    }

    // Warning for large files
    if (fileSizeMB > 0.5) {
      const proceed = confirm(
        `This PDF is ${fileSizeMB.toFixed(1)}MB. Large documents may take longer to process. Continue?`
      )
      if (!proceed) {
        e.target.value = ''
        return
      }
    }

    try {
      const formData = new FormData()
      formData.append('session_id', getSessionId())
      formData.append('file', file)

      const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api/v1'
      const API_KEY = import.meta.env.VITE_API_KEY

      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Upload failed (${res.status})`)
      }

      const result = await res.json()
      alert(`File uploaded successfully: ${result.message}`)
    } catch (err) {
      alert(`Upload failed: ${err.message}`)
    } finally {
      e.target.value = ''
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <main className="chat-window">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">Ask a question about your document, or just say hi.</div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <div className="message-bubble">
              {msg.role === 'assistant' ? (
                <ReactMarkdown className="markdown-body" remarkPlugins={[remarkGfm]}>
                  {msg.text}
                </ReactMarkdown>
              ) : (
                msg.text
              )}
              {msg.sources && (msg.sources.pdf.length > 0 || msg.sources.web.length > 0) && (
                <div className="message-sources">
                  {msg.sources.pdf.map((s) => (
                    <span key={s} className="source-tag source-pdf">📄 {s}</span>
                  ))}
                  {msg.sources.web.map((s, idx) => (
                    <span key={idx} className="source-tag source-web">🌐 {s.title}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {statusText && (
          <div className="message message-assistant">
            <div className="message-bubble status-bubble">
              <LumenLogo size={20} active />
              {statusText}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-row">
        <div className="chat-input-actions">
          <button 
            className="chat-action-btn" 
            onClick={() => fileInputRef.current?.click()}
            title="Upload PDF"
          >
            📎
          </button>
        </div>
        <input
          className="chat-input"
          type="text"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={isStreaming || !input.trim()}>
          Send
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>
    </main>
  )
}
