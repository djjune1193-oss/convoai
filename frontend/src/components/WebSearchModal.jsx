import React, { useState } from 'react'

export default function WebSearchModal({ onClose, onSearch }) {
  const [query, setQuery] = useState('')

  function submit() {
    if (!query.trim()) return
    onSearch(query.trim())
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Ask what's happening</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
          Gets a current, today-dated answer — good for local news, events,
          or "what's going on right now" questions.
        </p>
        <input
          className="modal-input"
          placeholder="e.g. What's going on in San Antonio today?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        <button className="modal-primary" onClick={submit}>Search</button>
        <button className="modal-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
