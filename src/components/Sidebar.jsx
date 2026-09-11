import { useEffect, useState } from 'react'
import {
  listSessions,
  renameSession,
  deleteSession,
  setSessionId,
  getSessionId,
  getMemory,
  setMemoryEnabled,
  clearMemory,
} from '../api.js'

export default function Sidebar() {
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState(null)
  const [currentSessionId, setCurrentSessionId] = useState(getSessionId())
  const [memory, setMemory] = useState(null)
  const [memoryError, setMemoryError] = useState(null)

  async function refreshSessions() {
    try {
      const sessionList = await listSessions()
      setSessions(sessionList)
      return sessionList
    } catch (err) {
      setError(err.message)
      return []
    }
  }

  useEffect(() => {
    refreshSessions()
    refreshMemory()

    // Listen for chat completion to refresh session list (for auto-naming)
    const handleChatCompleted = () => {
      refreshSessions()
      refreshMemory()
    }

    window.addEventListener('chat-completed', handleChatCompleted)
    return () => window.removeEventListener('chat-completed', handleChatCompleted)
  }, [])

  async function refreshMemory() {
    try {
      setMemory(await getMemory())
      setMemoryError(null)
    } catch (err) {
      setMemoryError(err.message)
    }
  }

  async function handleMemoryToggle() {
    try {
      const updated = await setMemoryEnabled(!memory?.enabled)
      setMemory(updated)
      setMemoryError(null)
    } catch (err) {
      setMemoryError(err.message)
    }
  }

  async function handleClearMemory() {
    if (!confirm('Clear everything Lumen remembers about you?')) return
    try {
      await clearMemory()
      await refreshMemory()
    } catch (err) {
      setMemoryError(err.message)
    }
  }

function handleNewChat() {
    // Generate a local session ID without pinging the backend API yet
    const localSessionId = crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`
    
    // Store in localStorage & component state
    setSessionId(localSessionId)
    setCurrentSessionId(localSessionId)
    setError(null)
    
    // Notify ChatWindow to clear old messages
    window.dispatchEvent(new CustomEvent('session-changed', { detail: { sessionId: localSessionId } }))
  }

  async function handleSwitchSession(sessionId) {
    try {
      setSessionId(sessionId)
      setCurrentSessionId(sessionId)
      setError(null)
      // Signal to ChatWindow to load chat history
      window.dispatchEvent(new CustomEvent('session-changed', { detail: { sessionId } }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRenameSession(sessionId, currentName) {
    const newName = prompt('Enter new name for this session:', currentName)
    if (newName && newName.trim()) {
      try {
        await renameSession(sessionId, newName.trim())
        await refreshSessions()
        setError(null)
      } catch (err) {
        setError(err.message)
      }
    }
  }

  async function handleDeleteSession(sessionId) {
    if (confirm('Are you sure you want to delete this session? This cannot be undone.')) {
      try {
        await deleteSession(sessionId)
        const updatedSessions = await refreshSessions()

        // If the active session was deleted, replace it with another session or a blank chat.
        if (sessionId === currentSessionId) {
          if (updatedSessions.length > 0) {
            await handleSwitchSession(updatedSessions[0].session_id)
          } else {
            handleNewChat()
          }
        }
        setError(null)
      } catch (err) {
        setError(err.message)
      }
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Lumen AI</h2>
        <button className="new-chat-btn" onClick={handleNewChat} title="Start a new conversation">
          + New Chat
        </button>
      </div>

      <div className="sidebar-section">
        <h3 className="sidebar-section-title">Conversations</h3>
        <ul className="session-list">
          {sessions.length === 0 && (
            <li className="session-empty">No conversations yet — start a new chat!</li>
          )}
          {sessions.map((session) => (
            <li
              key={session.session_id}
              className={`session-item ${session.session_id === currentSessionId ? 'session-active' : ''}`}
              onClick={() => handleSwitchSession(session.session_id)}
            >
              <span className="session-name" title={session.name}>
                {session.name}
              </span>
              <div className="session-actions">
                <button
                  className="session-rename"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRenameSession(session.session_id, session.name)
                  }}
                  title="Rename conversation"
                >
                  ✏️
                </button>
                <button
                  className="session-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteSession(session.session_id)
                  }}
                  title="Delete conversation"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-section memory-section">
        <div className="memory-heading-row">
          <h3 className="sidebar-section-title">Memory</h3>
          {memory && (
            <button className="memory-toggle" onClick={handleMemoryToggle}>
              {memory.enabled ? 'On' : 'Off'}
            </button>
          )}
        </div>
        {memoryError && <p className="sidebar-error">{memoryError}</p>}
        {memory?.enabled && Object.keys(memory.facts).length > 0 ? (
          <>
            <ul className="memory-list">
              {Object.entries(memory.facts).map(([key, value]) => (
                <li key={key} className="memory-item">
                  <span>{key.replaceAll('_', ' ')}</span>
                  <strong>{value}</strong>
                </li>
              ))}
            </ul>
            <button className="memory-clear" onClick={handleClearMemory}>Clear memory</button>
          </>
        ) : (
          <p className="memory-empty">{memory?.enabled === false ? 'Memory is off.' : 'Nothing remembered yet.'}</p>
        )}
      </div>

      {error && <p className="sidebar-error">{error}</p>}
    </aside>
  )
}
