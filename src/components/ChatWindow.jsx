import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamChat, getSessionId } from '../api.js'
import LumenLogo from './LumenLogo.jsx'

export default function ChatWindow() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [statusText, setStatusText] = useState(null) // the "Searching your document..." line
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState(getSessionId())
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, statusText])

  // Check for session changes
  useEffect(() => {
    const interval = setInterval(() => {
      const newSessionId = getSessionId()
      if (newSessionId !== currentSessionId) {
        setCurrentSessionId(newSessionId)
        setMessages([]) // Clear messages when session changes
      }
    }, 500)
    return () => clearInterval(interval)
  }, [currentSessionId])

  async function handleSend() {
    const query = input.trim()
    if (!query || isStreaming) return

    setInput('')
    setIsStreaming(true)
    setStatusText(null)

    // Add the user's message, and an empty placeholder assistant message
    // that we'll fill in token-by-token as the stream arrives.
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: query },
      { role: 'assistant', text: '', sources: null },
    ])

    await streamChat(query, {
      onStatus: (text) => setStatusText(text),

      onSources: (sources) => {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], sources }
          return updated
        })
      },

      onToken: (chunk) => {
        setStatusText(null) // real text has started, hide the "thinking" line
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, text: last.text + chunk }
          return updated
        })
      },

      onDone: () => {
        setIsStreaming(false)
        setStatusText(null)
      },

      onError: (message) => {
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
      </div>
    </main>
  )
}
