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
  const [uploadingFileName, setUploadingFileName] = useState(null)
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
      setUploadingFileName(file.name)
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
      setUploadingFileName(null)
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
    <main className="flex-1 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-[#0e0e14] via-[#0a0a0f] to-[#07070b]">
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-7 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-7 pb-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 pt-24 text-center">
              <LumenLogo size={56} />
              <p className="text-on-surface-variant text-body-md font-body-md">
                Ask a question about your document, or just say hi.
              </p>
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-5 py-3.5 bg-surface-container-high/50 backdrop-blur-xl border border-white/10 text-on-surface shadow-md">
                  <p className="text-body-md font-body-md leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-4">
                <div className="w-8 h-8 shrink-0 mt-0.5">
                  <LumenLogo size={32} />
                </div>
                <div className="flex-1 rounded-2xl bg-surface-container/60 backdrop-blur-2xl border border-white/5 p-5 shadow-lg space-y-3 min-w-0">
                  <div className="text-body-md font-body-md text-on-surface/90 leading-relaxed">
                    <ReactMarkdown
                      className="markdown-body [&_strong]:text-secondary [&_strong]:font-semibold [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:pl-4 [&_ul]:space-y-1 [&_code]:bg-black/30 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded"
                      remarkPlugins={[remarkGfm]}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>

                  {msg.sources && (msg.sources.pdf.length > 0 || msg.sources.web.length > 0) && (
                    <div className="pt-3 border-t border-outline-variant/20 flex flex-wrap items-center gap-2">
                      <span className="text-label-sm font-label-sm uppercase tracking-wider text-outline">
                        Sources:
                      </span>
                      {msg.sources.pdf.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/10 border border-secondary/35 amber-fragment-glow text-[11px] font-semibold uppercase text-secondary tracking-wide"
                        >
                          📄 {s}
                        </span>
                      ))}
                      {msg.sources.web.map((s, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-container/15 border border-primary/35 cyan-fragment-glow text-[11px] font-semibold uppercase text-primary tracking-wide"
                        >
                          🌐 {s.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {statusText && (
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 shrink-0 mt-0.5">
                <LumenLogo size={32} active />
              </div>
              <div className="rounded-2xl bg-surface-container/60 backdrop-blur-2xl border border-white/5 px-5 py-3.5 shadow-lg">
                <span className="text-on-surface-variant text-body-sm font-body-sm italic">{statusText}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating input bar */}
      <div className="w-full px-6 pb-6 pt-2 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center bg-[#10101a]/90 backdrop-blur-3xl rounded-2xl border border-white/10 p-2 shadow-2xl shadow-black/80 focus-within:border-primary/50 focus-within:shadow-[0_0_25px_-5px_rgba(76,215,246,0.25)] transition-all">
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload PDF"
              disabled={!!uploadingFileName}
              className="p-2.5 rounded-xl hover:bg-surface-container-highest/60 text-secondary hover:text-white transition-colors shrink-0 disabled:opacity-50"
            >
              📎
            </button>
            {uploadingFileName && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/15 border border-secondary/30 text-secondary text-xs font-mono mx-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                <span className="max-w-[140px] truncate">Uploading {uploadingFileName}...</span>
              </div>
            )}
            <input
              type="text"
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              className="flex-1 bg-transparent border-none text-on-surface placeholder-outline font-body-md text-body-md focus:ring-0 focus:outline-none px-2 py-2 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              className="w-10 h-10 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-white/10 hover:border-white/20 flex items-center justify-center text-on-surface shadow-md active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Send message"
            >
              ↑
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
          <div className="flex items-center justify-center gap-3 px-3 pt-2 text-[10px] font-label-sm tracking-wider text-outline">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> Document
            </span>
            <span className="text-outline/40">|</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Live web
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}
