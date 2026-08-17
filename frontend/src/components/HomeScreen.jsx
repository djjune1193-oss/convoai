import React, { useEffect, useState } from 'react'
import { fetchDiscover, fetchInvites, fetchUserConversations, sendInvite } from '../api.js'

const SUGGESTED_COUNT = 6

function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase()
}

function formatTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function HomeScreen({
  user,
  onOpenConversation,
  onOpenProfile,
  onOpenInvites,
  onOpenSendInvite,
  onOpenGroupChat,
  onOpenSearch,
}) {
  const [conversations, setConversations] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [suggested, setSuggested] = useState(null)
  const [connectedIds, setConnectedIds] = useState([])

  function refreshInvites() {
    fetchInvites(user.id).then((invites) => {
      setPendingCount(invites.filter((i) => i.direction === 'incoming' && i.status === 'pending').length)
    })
  }

  useEffect(() => {
    fetchUserConversations(user.id).then(setConversations)
    refreshInvites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  // Once we know the chat list is empty, pull in a few suggested people so
  // there's something to act on instead of a dead end.
  useEffect(() => {
    if (conversations !== null && conversations.length === 0) {
      fetchDiscover(user.id, '', 0, SUGGESTED_COUNT).then(setSuggested)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations])

  async function connect(person) {
    try {
      await sendInvite(user.id, person.username)
      setConnectedIds((prev) => [...prev, person.id])
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="home-screen">
      <div className="home-header">
        <div className="home-header-top">
          <div className="home-header-user" onClick={onOpenProfile}>
            <div className="chat-avatar tint-a home-avatar">
              {user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user.display_name)}
            </div>
            <div>
              <h1 className="home-title">ConvoAI</h1>
              <div className="home-subtitle">{user.display_name} · {user.username}</div>
            </div>
          </div>
          <button className="home-invites-button" onClick={onOpenInvites}>
            🔔{pendingCount > 0 && <span className="invite-badge">{pendingCount}</span>}
          </button>
        </div>

        <div className="home-actions">
          <button className="home-action" onClick={onOpenSendInvite}>
            <span className="home-action-icon">👤➕</span>
            <span className="home-action-label">Invite</span>
          </button>
          <button className="home-action" onClick={onOpenGroupChat}>
            <span className="home-action-icon">👥</span>
            <span className="home-action-label">Group</span>
          </button>
          <button className="home-action" onClick={onOpenSearch}>
            <span className="home-action-icon">🔍</span>
            <span className="home-action-label">Connect with people</span>
          </button>
        </div>
      </div>

      <div className="chat-list">
        {conversations === null && <div className="chat-list-empty">Loading your chats…</div>}

        {conversations && conversations.length === 0 && (
          <>
            <div className="chat-list-empty">
              No chats yet — connect with someone below, or invite/search
              for people who share your interests.
            </div>

            {suggested === null && (
              <p className="discover-hint home-suggested-loading">Finding people you might like…</p>
            )}

            {suggested && suggested.length > 0 && (
              <div className="home-suggested-section">
                <div className="home-suggested-heading">People to connect with</div>
                <div className="discover-grid home-suggested-grid">
                  {suggested.map((p) => {
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
                          {p.distance_km != null && (
                            <div className="discover-tile-distance">📍 {p.distance_km} km away</div>
                          )}
                          {p.status && <div className="discover-tile-status">"{p.status}"</div>}
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
                <button className="home-suggested-more" onClick={onOpenSearch}>
                  See more people →
                </button>
              </div>
            )}
          </>
        )}

        {conversations && conversations.map((c, i) => (
          <div key={c.id} className="chat-item" onClick={() => onOpenConversation(c.id, c.title)}>
            <div className={`chat-avatar ${i % 2 === 0 ? 'tint-a' : 'tint-b'}`}>
              {initials(c.title)}
            </div>
            <div className="chat-item-body">
              <div className="chat-item-title">{c.title}{c.is_group ? ' 👥' : ''}</div>
              <div className="chat-item-preview">{c.last_message_preview}</div>
            </div>
            <div className="chat-item-time">{formatTime(c.last_message_at)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
