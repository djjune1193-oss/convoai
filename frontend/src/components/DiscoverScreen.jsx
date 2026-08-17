import React, { useEffect, useState } from 'react'
import { fetchDiscover, sendInvite } from '../api.js'

const PAGE_SIZE = 20

function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase()
}

export default function DiscoverScreen({ currentUser, onBack }) {
  const [keyword, setKeyword] = useState('')
  const [activeKeyword, setActiveKeyword] = useState('')
  const [people, setPeople] = useState([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [connectedIds, setConnectedIds] = useState([])
  const [error, setError] = useState(null)

  async function loadPage(reset) {
    setLoading(true)
    setError(null)
    try {
      const startAt = reset ? 0 : offset
      const data = await fetchDiscover(currentUser.id, activeKeyword, startAt, PAGE_SIZE)
      setPeople((prev) => (reset ? data : [...prev, ...data]))
      setOffset(startAt + data.length)
      setHasMore(data.length === PAGE_SIZE)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeyword])

  function runSearch() {
    setActiveKeyword(keyword.trim())
  }

  function clearSearch() {
    setKeyword('')
    setActiveKeyword('')
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
    <div className="discover-screen">
      <div className="chat-header">
        <button className="chat-back" onClick={onBack}>←</button>
        <div className="chat-header-title">Connect with people</div>
      </div>

      <div className="discover-search-bar">
        <input
          className="modal-input"
          placeholder="Search by hobby or sport…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />
        <button className="modal-primary discover-search-go" onClick={runSearch}>Search</button>
        {activeKeyword && (
          <button className="modal-cancel discover-clear" onClick={clearSearch}>Clear</button>
        )}
      </div>

      {!activeKeyword && (
        <p className="discover-hint">People with interests closest to yours show up first.</p>
      )}

      {error && <div className="modal-error discover-error">{error}</div>}

      <div className="discover-grid">
        {people.map((p) => {
          const connected = connectedIds.includes(p.id)
          return (
            <div className="discover-tile" key={p.id}>
              <div className="discover-tile-photo">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" />
                ) : (
                  <span>{initials(p.display_name)}</span>
                )}
              </div>
              <div className="discover-tile-body">
                <div className="discover-tile-name">{p.display_name}</div>
                {p.status && <div className="discover-tile-status">"{p.status}"</div>}
                {p.work && (
                  <div className="discover-tile-line"><span>Work</span> {p.work}</div>
                )}
                {p.sports && (
                  <div className="discover-tile-line"><span>Sports</span> {p.sports}</div>
                )}
                {p.hobbies && (
                  <div className="discover-tile-line"><span>Hobbies</span> {p.hobbies}</div>
                )}
                <button
                  className="invite-accept discover-connect"
                  disabled={connected}
                  onClick={() => connect(p)}
                >
                  {connected ? 'Invited' : 'Connect'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {people.length === 0 && !loading && (
        <p className="chat-list-empty">
          {activeKeyword ? 'No one matched that search.' : 'No one else has joined yet.'}
        </p>
      )}

      {hasMore && people.length > 0 && (
        <button className="discover-load-more" onClick={() => loadPage(false)} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
