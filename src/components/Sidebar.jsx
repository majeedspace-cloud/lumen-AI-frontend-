import { useEffect, useRef, useState } from 'react'
import { uploadDocument, listDocuments, deleteDocument } from '../api.js'

export default function Sidebar() {
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  async function refreshDocuments() {
    try {
      const docs = await listDocuments()
      setDocuments(docs)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refreshDocuments()
  }, [])

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

  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">My Documents</h2>

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
    </aside>
  )
}
