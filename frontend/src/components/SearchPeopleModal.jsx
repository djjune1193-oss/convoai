import React, { useState } from 'react'
import { searchPeople, sendInvite } from '../api.js'

function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase()
}

export default function SearchPeopleModal({ currentUser, onClose }) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState(null) // null = no search yet
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [connectedIds, setConnectedIds] = useState([])

  async function runSearch() {
    if (!keyword.trim()) return
    setBusy(true)
    setError(null)
    try {
      const data = await searchPeople(keyword.trim(), currentUser.id)
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function connect(person) {
    try {
      await sendInvite(currentUser.id, person.username)
      setConnectedIds((prev) => [...prev, person.id])
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal search-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Find people</h3>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: 0 }}>
          Search by a hobby or sport, e.g. "football", "art", "hiking".
        </p>

        <div className="poll-option-row">
          <input
            className="modal-input"
            placeholder="Keyword…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            autoFocus
          />
          <button className="modal-primary search-go" onClick={runSearch} disabled={busy}>
            {busy ? '…' : 'Go'}
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="search-results">
          {results !== null && results.length === 0 && (
            <p className="invites-empty">No one matched that keyword yet.</p>
          )}
          {results?.map((p) => {
            const matched = [p.hobbies, p.sports].filter(Boolean).join(' · ')
            const connected = connectedIds.includes(p.id)
            return (
              <div className="search-result-row" key={p.id}>
                <div className="chat-avatar tint-a search-result-avatar">
                  {p.avatar_url ? <img src={p.avatar_url} alt="" /> : initials(p.display_name)}
                </div>
                <div className="search-result-body">
                  <div className="chat-item-title">{p.display_name}</div>
                  {matched && <div className="chat-item-preview">{matched}</div>}
                </div>
                <button
                  className="invite-accept"
                  disabled={connected}
                  onClick={() => connect(p)}
                >
                  {connected ? 'Invited' : 'Connect'}
                </button>
              </div>
            )
          })}
        </div>

        <button className="modal-cancel" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
