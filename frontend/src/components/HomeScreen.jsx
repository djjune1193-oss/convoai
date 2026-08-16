import React, { useEffect, useState } from 'react'
import { fetchInvites, fetchUserConversations } from '../api.js'

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

export default function HomeScreen({ user, onOpenConversation, onNewChat, onOpenProfile, onOpenInvites }) {
  const [conversations, setConversations] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)

  function refreshInvites() {
    fetchInvites(user.id).then((invites) => {
      setPendingCount(invites.filter((i) => i.direction === 'incoming' && i.status === 'pending').length)
    })
  }

  useEffect(() => {
    fetchUserConversations(user.id).then(setConversations)
    refreshInvites()
  }, [user.id])

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
          <button className="home-invites-button" onClick={() => { onOpenInvites(); }}>
            🔔{pendingCount > 0 && <span className="invite-badge">{pendingCount}</span>}
          </button>
        </div>
      </div>

      <div className="chat-list">
        {conversations === null && <div className="chat-list-empty">Loading your chats…</div>}

        {conversations && conversations.length === 0 && (
          <div className="chat-list-empty">
            No chats yet. Invite someone using their ConvoAI ID to get started.
          </div>
        )}

        {conversations && conversations.map((c, i) => (
          <div key={c.id} className="chat-item" onClick={() => onOpenConversation(c.id, c.title)}>
            <div className={`chat-avatar ${i % 2 === 0 ? 'tint-a' : 'tint-b'}`}>
              {initials(c.title)}
            </div>
            <div className="chat-item-body">
              <div className="chat-item-title">{c.title}</div>
              <div className="chat-item-preview">{c.last_message_preview}</div>
            </div>
            <div className="chat-item-time">{formatTime(c.last_message_at)}</div>
          </div>
        ))}
      </div>

      <button className="new-chat-fab" onClick={onNewChat} title="Invite someone to chat">+</button>
    </div>
  )
}
