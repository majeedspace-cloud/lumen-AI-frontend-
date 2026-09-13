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

const dayMs = 24 * 60 * 60 * 1000

function groupSessions(sessions) {
  const now = Date.now()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const today = []
  const thisWeek = []
  const older = []

  for (const session of sessions) {
    const ts = typeof session.last_active === 'number' ? session.last_active * 1000 : now
    if (ts >= startOfToday.getTime()) today.push(session)
    else if (now - ts < 7 * dayMs) thisWeek.push(session)
    else older.push(session)
  }
  return [
    { label: 'Today', items: today },
    { label: 'Previous 7 Days', items: thisWeek },
    { label: 'Older', items: older },
  ]
    .filter((g) => g.items.length > 0)
}

export default function Sidebar({ onClose }) {
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

  const groups = groupSessions(sessions)

  return (
    <aside
      className="w-[290px] flex-shrink-0 flex flex-col rounded-3xl frosted-glass-panel prismatic-border p-4 overflow-hidden"
      data-purpose="sidebar-navigation"
    >
      {/* Header row + collapse */}
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Lumen AI
        </span>
        <button
          onClick={onClose}
          title="Collapse sidebar"
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-lg leading-none">menu_open</span>
        </button>
      </div>

      {/* New Chat trigger */}
      <button
        onClick={handleNewChat}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white/85 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium text-sm border border-white dark:border-slate-700 shadow-sm transition-all duration-150 group"
        type="button"
      >
        <div className="flex items-center space-x-2">
          <span className="material-symbols-outlined text-sky-600 dark:text-sky-300 text-lg group-hover:rotate-90 transition-transform duration-200">
            add
          </span>
          <span>New Chat</span>
        </div>
        <kbd className="px-1.5 py-0.5 text-[11px] font-mono tracking-wide text-slate-400 bg-slate-100/90 dark:bg-slate-700/70 rounded border border-slate-200 dark:border-slate-600">
          Ctrl K
        </kbd>
      </button>

      {/* Past conversations stream */}
      <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4" data-purpose="conversation-history">
        {sessions.length === 0 && (
          <p className="text-body-sm text-slate-400 dark:text-slate-500 px-3 py-2 text-xs">
            No conversations yet — start a new chat!
          </p>
        )}

        {groups.map((group) => (
          <div key={group.label}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2.5 mb-1.5 block">
              {group.label}
            </span>
            {group.items.map((session) => {
              const isActive = session.session_id === currentSessionId
              return (
                <div
                  key={session.session_id}
                  onClick={() => handleSwitchSession(session.session_id)}
                  className={
                    'group relative flex items-center justify-between px-3 py-2.5 rounded-xl mb-1 text-xs cursor-pointer transition-colors ' +
                    (isActive
                      ? 'bg-white/90 dark:bg-slate-700/70 shadow-sm border border-sky-200/70 dark:border-sky-700/40 text-slate-900 dark:text-slate-100 font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent')
                  }
                >
                  <div className="flex items-center space-x-2 truncate min-w-0">
                    <span
                      className={`material-symbols-outlined text-base flex-shrink-0 ${isActive ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400 group-hover:text-slate-600'}`}
                    >
                      {isActive ? 'chat_bubble' : 'chat_bubble_outline'}
                    </span>
                    <span className="truncate" title={session.name}>
                      {session.name}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 pl-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRenameSession(session.session_id, session.name)
                      }}
                      title="Rename"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSession(session.session_id)
                      }}
                      title="Delete"
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Cross-Session Memory */}
      <div className="mt-auto pt-3 border-t border-slate-200/60 dark:border-slate-700/60" data-purpose="cross-session-memory">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center space-x-1.5">
            <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-sm">psychology</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Cross-Session Memory
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearMemory}
              className="text-[11px] text-slate-400 hover:text-rose-600 font-medium transition-colors"
              type="button"
            >
              Clear
            </button>
            {/* Toggle switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={memory?.enabled ?? false}
                onChange={handleMemoryToggle}
              />
              <div className="w-7 h-4 bg-slate-300 dark:bg-slate-600 rounded-full peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 dark:after:border-slate-500 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>
        </div>

        {memoryError && <p className="text-rose-600 dark:text-rose-400 text-[11px] px-1 mb-1">{memoryError}</p>}

        {memory?.enabled && Object.keys(memory.facts).length > 0 ? (
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {Object.entries(memory.facts).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/75 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 text-[11px] text-slate-700 dark:text-slate-300"
              >
                <span className="truncate">
                  {key.replaceAll('_', ' ')}: <strong className="text-slate-900 dark:text-slate-100">{value}</strong>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
            {memory?.enabled === false ? 'Memory is off.' : 'Nothing remembered yet.'}
          </p>
        )}
      </div>

      {error && <p className="text-rose-600 dark:text-rose-400 text-xs mt-2 px-1">{error}</p>}
    </aside>
  )
}