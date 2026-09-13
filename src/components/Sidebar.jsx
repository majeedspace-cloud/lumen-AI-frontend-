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
    <aside className="w-[280px] h-full flex flex-col justify-between p-4 bg-surface-container-low/70 backdrop-blur-2xl border-r border-outline-variant/20 shadow-xl shrink-0 overflow-hidden font-body-md">
      <div className="flex flex-col gap-4 overflow-hidden flex-1">
        {/* Header + New Chat */}
        <div className="flex flex-col gap-3">
          <h2 className="font-headline-sm text-headline-sm font-semibold tracking-wide text-on-surface px-1">
            Lumen AI
          </h2>
          <button
            onClick={handleNewChat}
            title="Start a new conversation"
            className="relative group w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-surface-container-high/90 to-surface-container/90 hover:from-surface-bright/80 hover:to-surface-container-high/90 border border-white/10 hover:border-primary/50 text-on-surface font-headline-sm text-label-lg font-medium flex items-center justify-center gap-2 shadow-lg shadow-black/40 hover:shadow-[0_0_20px_-3px_rgba(76,215,246,0.3)] transition-all duration-200"
          >
            <span className="text-primary text-lg leading-none">+</span>
            New Chat
          </button>
        </div>

        {/* Conversations */}
        <div className="flex flex-col gap-2 overflow-hidden flex-1">
          <p className="text-label-sm font-label-sm uppercase tracking-wider text-outline px-2 font-semibold">
            Conversations
          </p>
          <ul className="flex-1 overflow-y-auto space-y-1 pr-1">
            {sessions.length === 0 && (
              <li className="text-body-sm font-body-sm text-on-surface-variant px-3 py-2">
                No conversations yet — start a new chat!
              </li>
            )}
            {sessions.map((session) => {
              const isActive = session.session_id === currentSessionId
              return (
                <li
                  key={session.session_id}
                  onClick={() => handleSwitchSession(session.session_id)}
                  className={
                    'group relative flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ' +
                    (isActive
                      ? 'bg-surface-container-highest/60 text-primary border border-primary/25 shadow-[0_0_12px_-2px_rgba(76,215,246,0.2)]'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/40 border border-transparent')
                  }
                >
                  <span
                    className="text-body-sm font-body-sm truncate flex-1"
                    title={session.name}
                  >
                    {session.name}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRenameSession(session.session_id, session.name)
                      }}
                      title="Rename conversation"
                      className="p-1 text-on-surface-variant hover:text-on-surface rounded text-xs"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSession(session.session_id)
                      }}
                      title="Delete conversation"
                      className="p-1 text-on-surface-variant hover:text-error rounded text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* Cross-Session Memory */}
      <div className="pt-3 border-t border-outline-variant/20 bg-surface-container-low/40 rounded-xl p-2.5 -mx-1 mt-3">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="font-headline-sm text-label-md font-label-md font-semibold tracking-wide text-on-surface">
            Cross-Session Memory
          </span>
          {memory && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleMemoryToggle}
                title={memory.enabled ? 'Memory active — click to turn off' : 'Memory off — click to turn on'}
                className={
                  'flex items-center w-7 h-4 rounded-full p-0.5 cursor-pointer transition-all border ' +
                  (memory.enabled
                    ? 'bg-primary/20 border-primary/50 shadow-[0_0_8px_rgba(76,215,246,0.3)] justify-end'
                    : 'bg-surface-container-high border-outline-variant/40 justify-start')
                }
              >
                <div
                  className={
                    'w-3 h-3 rounded-full ' +
                    (memory.enabled ? 'bg-primary shadow-[0_0_5px_#4cd7f6]' : 'bg-outline')
                  }
                />
              </button>
            </div>
          )}
        </div>

        {memoryError && <p className="text-error text-body-sm px-1 mb-1">{memoryError}</p>}

        {memory?.enabled && Object.keys(memory.facts).length > 0 ? (
          <>
            <div className="space-y-1.5">
              {Object.entries(memory.facts).map(([key, value], idx) => {
                // Alternate amber/cyan/tertiary embers so the list doesn't
                // read as one flat color, matching the "refracted facets"
                // visual idea — purely decorative, no meaning tied to which
                // fact gets which color.
                const dotColors = ['bg-secondary', 'bg-primary', 'bg-tertiary']
                const dotColor = dotColors[idx % dotColors.length]
                return (
                  <div
                    key={key}
                    className="group flex items-center justify-between text-body-sm font-body-sm px-2 py-1.5 rounded-lg bg-surface-container/50 border border-outline-variant/20 hover:border-secondary/30 transition-all"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className={`w-1.5 h-1.5 rounded-full subtle-pulse shrink-0 ${dotColor}`} />
                      <span className="text-on-surface-variant truncate group-hover:text-on-surface text-[11px] leading-tight">
                        <span className="opacity-70">{key.replaceAll('_', ' ')}:</span>{' '}
                        <strong className="text-on-surface font-medium">{value}</strong>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              onClick={handleClearMemory}
              className="mt-2.5 text-[10px] font-label-sm uppercase tracking-wider text-outline hover:text-error transition-colors px-1"
            >
              Clear memory
            </button>
            <div className="mt-2.5 pt-2 border-t border-outline-variant/15 flex items-center justify-between text-[11px] text-outline px-1">
              <span>{Object.keys(memory.facts).length} Active {Object.keys(memory.facts).length === 1 ? 'Memory' : 'Memories'}</span>
              <span className="text-primary font-mono text-[10px]">Enabled</span>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-on-surface-variant px-1">
            {memory?.enabled === false ? 'Memory is off.' : 'Nothing remembered yet.'}
          </p>
        )}
      </div>

      {error && <p className="text-error text-body-sm mt-2 px-1">{error}</p>}
    </aside>
  )
}
