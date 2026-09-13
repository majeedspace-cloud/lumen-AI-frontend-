import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamChat, getSessionId, getSessionDetail } from '../api.js'
import LumenLogo from './LumenLogo.jsx'

export default function ChatWindow({ sidebarOpen, onOpenSidebar }) {
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
    <main
      className="flex-1 flex flex-col relative overflow-hidden rounded-3xl frosted-glass-panel rgb-border"
      data-purpose="chat-stream-workspace"
    >
      {!sidebarOpen && (
        <button
          onClick={onOpenSidebar}
          title="Show conversations"
          className="absolute top-4 left-4 z-10 p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 shadow-sm text-sm backdrop-blur transition-colors"
        >
          <span className="material-symbols-outlined text-lg leading-none">menu</span>
        </button>
      )}

      {/* Chat message history */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-6 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 pt-24 text-center">
              <LumenLogo size={56} />
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Ask a question about your document, or just say hi.
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1
            const isActiveAnswer = isLast && msg.role === 'assistant' && isStreaming
            return msg.role === 'user' ? (
              <div key={i} className="flex justify-end" data-purpose="user-message">
                <div className="max-w-[72%] px-5 py-3.5 rounded-2xl rounded-tr-sm bg-white/95 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 text-sm leading-relaxed shadow-sm border border-white/90 dark:border-slate-700 whitespace-pre-wrap">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start" data-purpose="assistant-message">
                <div
                  className={
                    'max-w-[86%] rounded-2xl rounded-tl-sm bg-white/80 dark:bg-slate-800/80 p-5 border border-white/80 dark:border-slate-700/80 shadow-sm space-y-3 prismatic-subtle min-w-0' +
                    (isActiveAnswer ? ' rgb-border rgb-border-loading' : '')
                  }
                >
                  {statusText && isActiveAnswer && !msg.text ? (
                    <div className="flex items-center space-x-2 text-xs font-medium text-sky-800 dark:text-sky-200 bg-sky-50/70 dark:bg-sky-900/30 px-3 py-1.5 rounded-xl border border-sky-200/60 dark:border-sky-700/50 w-fit">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                      </span>
                      <span>{statusText}</span>
                    </div>
                  ) : (
                    <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      <ReactMarkdown
                        className="markdown-body"
                        remarkPlugins={[remarkGfm]}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}

                  {msg.sources && (msg.sources.pdf.length > 0 || msg.sources.web.length > 0) && (
                    <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Sources
                      </span>
                      {msg.sources.pdf.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200/70 dark:border-amber-700/50 text-[11px] font-medium text-amber-800 dark:text-amber-200 amber-fragment-glow"
                        >
                          <span className="material-symbols-outlined text-xs text-amber-600 dark:text-amber-300 leading-none">
                            picture_as_pdf
                          </span>
                          <span className="truncate max-w-[160px]">{s}</span>
                        </span>
                      ))}
                      {msg.sources.web.map((s, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-900/30 border border-sky-200/70 dark:border-sky-700/50 text-[11px] font-medium text-sky-800 dark:text-sky-200 cyan-fragment-glow"
                        >
                          <span className="material-symbols-outlined text-xs text-sky-600 dark:text-sky-300 leading-none">
                            language
                          </span>
                          <span className="truncate max-w-[160px]">{s.title}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom input section */}
      <div className="p-4 pt-2 flex-shrink-0" data-purpose="chat-input-controls">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-white/80 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-black/20 rgb-border space-x-3 transition-shadow">
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach a PDF document"
              disabled={!!uploadingFileName}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors flex-shrink-0 disabled:opacity-50"
              type="button"
            >
              <span className="material-symbols-outlined text-xl leading-none">attach_file</span>
            </button>

            {uploadingFileName && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 text-xs text-amber-900 dark:text-amber-200 flex-shrink-0 font-medium" data-purpose="upload-progress">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="material-symbols-outlined text-sm text-amber-600 dark:text-amber-300">description</span>
                <span className="truncate max-w-[140px]">Uploading {uploadingFileName}...</span>
              </div>
            )}

            <input
              type="text"
              placeholder="Ask across documents and live web intelligence..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-1 py-1 disabled:opacity-50"
            />

            <button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 dark:bg-sky-500 hover:bg-slate-800 dark:hover:bg-sky-400 text-white shadow-sm transition-all duration-150 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              title="Send message"
              type="button"
            >
              <span className="material-symbols-outlined text-lg leading-none">arrow_upward</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>

          {/* Semantic color-coding caption */}
          <div
            className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500 tracking-normal flex items-center justify-center space-x-3"
            data-purpose="status-caption"
          >
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Amber: Verified Internal Doc</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span>Cyan: Live Web Stream</span>
            </span>
            <span>|</span>
            <span className="font-medium text-slate-500 dark:text-slate-400">Lumen RAG Assistant</span>
          </div>
        </div>
      </div>
    </main>
  )
}