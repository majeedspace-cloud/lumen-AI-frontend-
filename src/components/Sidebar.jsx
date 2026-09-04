import { useEffect, useRef, useState } from 'react'
import { uploadDocument, listDocuments, deleteDocument, listSessions, createSession, renameSession, deleteSession, setSessionId, getSessionId, getSessionDetail } from '../api.js'

export default function Sidebar() {
  const [documents, setDocuments] = useState([])
  const [sessions, setSessions] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [currentSessionId, setCurrentSessionId] = useState(getSessionId())
  const fileInputRef = useRef(null)

  async function refreshDocuments() {
    try {
      const docs = await listDocuments()
      setDocuments(docs)
    } catch (err) {
      setError(err.message)
    }
  }

  async function refreshSessions() {
    try {
      const sessionList = await listSessions()
      setSessions(sessionList)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refreshDocuments()
    refreshSessions()
  }, [])

  async function handleNewChat() {
    try {
      const newSession = await createSession('New Chat')
      setSessionId(newSession.session_id)
      setCurrentSessionId(newSession.session_id)
      setDocuments([]) // Clear documents for new session
      setError(null)
      await refreshSessions()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSwitchSession(sessionId) {
    try {
      setSessionId(sessionId)
      setCurrentSessionId(sessionId)
      setDocuments([]) // Clear documents, will refresh for new session
      await refreshDocuments()
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
        // If we deleted the current session, switch to another one or create new
        if (sessionId === currentSessionId) {
          const remainingSessions = sessions.filter(s => s.session_id !== sessionId)
          if (remainingSessions.length > 0) {
            handleSwitchSession(remainingSessions[0].session_id)
          } else {
            handleNewChat()
          }
        } else {
          await refreshSessions()
        }
        setError(null)
      } catch (err) {
        setError(err.message)
      }
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // File size validation (15MB limit from backend)
    const maxSizeMB = 15
    const fileSizeMB = file.size / (1024 * 1024)
    
    if (fileSizeMB > maxSizeMB) {
      setError(`File too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${maxSizeMB}MB.`)
      return
    }

    // Warning for large files that might have processing issues
    if (fileSizeMB > 0.5) {
      const proceed = confirm(
        `This PDF is ${fileSizeMB.toFixed(1)}MB. Large documents may take longer to process and could encounter API limits. Continue?`
      )
      if (!proceed) {
        e.target.value = ''
        return
      }
    }

    setUploading(true)
    setError(null)
    try {
      await uploadDocument(file)
      await refreshDocuments()
    } catch (err) {
      // Provide more user-friendly error messages
      if (err.message.includes('too large') || err.message.includes('quota')) {
        setError('This document is too complex for processing. Try a smaller PDF or contact support.')
      } else if (err.message.includes('Invalid content')) {
        setError('This PDF could not be processed. It may be corrupted or password-protected.')
      } else {
        setError(err.message)
      }
    } finally {
      setUploading(false)
      e.target.value = '' // allows re-selecting the same file later
    }
  }

  async function handleDelete(filename) {
    try {
      await deleteDocument(filename)
      await refreshDocuments()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(filename) {
    try {
      await deleteDocument(filename)
      await refreshDocuments()
    } catch (err) {
      setError(err.message)
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

      <div className="sidebar-section">
        <h3 className="sidebar-section-title">Documents</h3>
        <button
          className="upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : '+ Upload PDF'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileSelected}
          style={{ display: 'none' }}
        />

        {error && <p className="sidebar-error">{error}</p>}

        <ul className="document-list">
          {documents.length === 0 && !uploading && (
            <li className="document-empty">No documents yet — upload a PDF to get started.</li>
          )}
          {documents.map((doc) => (
            <li key={doc.filename} className="document-item">
              <span className="document-name" title={doc.filename}>
                {doc.filename}
              </span>
              <span className="document-chunks">{doc.chunks} chunks</span>
              <button
                className="document-delete"
                onClick={() => handleDelete(doc.filename)}
                aria-label={`Delete ${doc.filename}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
