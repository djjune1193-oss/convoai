import React, { useEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble.jsx'
import NearbyModal from './NearbyModal.jsx'
import WebSearchModal from './WebSearchModal.jsx'
import PollCreateModal from './PollCreateModal.jsx'
import ProfileViewModal from './ProfileViewModal.jsx'
import { fetchMessages } from '../api.js'
import { connectSocket } from '../ws.js'

export default function ChatWindow({ conversationId, conversationTitle, currentUser, onBack }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(null) // null | 'reply' | 'places'
  const [showNearby, setShowNearby] = useState(false)
  const [showWebSearch, setShowWebSearch] = useState(false)
  const [replyTarget, setReplyTarget] = useState(null)
  const [pollTarget, setPollTarget] = useState(null) // the message being turned into a poll
  const [viewingProfileUserId, setViewingProfileUserId] = useState(null)
  const socketRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    fetchMessages(conversationId).then(setMessages)

    const socket = connectSocket(conversationId, {
      onMessage: (msg) => {
        setPending(null)
        setMessages((prev) => [...prev, msg])
      },
      onTyping: (data) => setPending(data.kind === 'places' ? 'places' : data.kind === 'web' ? 'web' : 'reply'),
      onError: (data) => {
        setPending(null)
        console.error('AI request failed:', data.error)
        alert(`Request failed: ${data.error}`)
      },
      onLikeUpdate: (data) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.message_id ? { ...m, liked_user_ids: data.liked_user_ids } : m))
        )
      },
      onDelete: (data) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.message_id ? { ...m, deleted: true } : m))
        )
      },
      onUpdate: (data) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.message_id ? { ...m, kind: data.kind, content: data.content } : m))
        )
      },
    })
    socketRef.current = socket
    return () => socket.close()
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

  function sendMessage() {
    if (!draft.trim()) return
    socketRef.current.sendMessage(currentUser.id, draft.trim(), replyTarget?.id ?? null)
    setDraft('')
    setReplyTarget(null)
  }

  function requestAI(messageId) {
    socketRef.current.requestAI(messageId)
  }

  function handleNearbySearch(payload) {
    setShowNearby(false)
    socketRef.current.findNearby(currentUser.id, payload)
  }

  function handleWebSearch(query) {
    setShowWebSearch(false)
    socketRef.current.askWeb(currentUser.id, query)
  }

  function toggleLike(messageId) {
    socketRef.current.toggleLike(messageId, currentUser.id)
  }

  function deleteMessage(messageId) {
    if (!window.confirm('Delete this message?')) return
    socketRef.current.deleteMessage(messageId, currentUser.id)
  }

  function createPoll(question, options) {
    socketRef.current.createPoll(pollTarget.id, currentUser.id, question, options)
    setPollTarget(null)
  }

  function votePoll(messageId, optionId) {
    socketRef.current.votePoll(messageId, currentUser.id, optionId)
  }

  const messageById = Object.fromEntries(messages.map((m) => [m.id, m]))

  return (
    <div className="chat-window">
      <div className="chat-header">
        <button className="chat-back" onClick={onBack}>←</button>
        <div className="chat-header-title">{conversationTitle}</div>
      </div>



      <div className="message-list">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            currentUser={currentUser}
            parentPreview={m.parent_message_id ? messageById[m.parent_message_id] : null}
            onSwipeAI={requestAI}
            onToggleLike={toggleLike}
            onReply={setReplyTarget}
            onMakePoll={setPollTarget}
            onDelete={deleteMessage}
            onVotePoll={votePoll}
            onViewProfile={setViewingProfileUserId}
          />
        ))}
        {pending === 'reply' && <div className="typing-indicator">Gemini is thinking…</div>}
        {pending === 'places' && <div className="typing-indicator">Searching nearby places…</div>}
        {pending === 'web' && <div className="typing-indicator">Checking the web…</div>}
        <div ref={bottomRef} />
      </div>

      {replyTarget && (
        <div className="reply-banner">
          <span>↩ Replying to {replyTarget.sender_name}: {replyTarget.content.slice(0, 40)}</span>
          <button onClick={() => setReplyTarget(null)}>×</button>
        </div>
      )}

      <div className="composer">
        <button className="nearby-button" onClick={() => setShowNearby(true)} title="Find nearby places">
          📍
        </button>
        <button className="nearby-button" onClick={() => setShowWebSearch(true)} title="What's happening today">
          🌐
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Message…"
        />
        <button className="send-button" onClick={sendMessage}>Send</button>
      </div>

      {showNearby && (
        <NearbyModal onClose={() => setShowNearby(false)} onSearch={handleNearbySearch} />
      )}
      {showWebSearch && (
        <WebSearchModal onClose={() => setShowWebSearch(false)} onSearch={handleWebSearch} />
      )}
      {pollTarget && (
        <PollCreateModal
          initialQuestion={pollTarget.content}
          onClose={() => setPollTarget(null)}
          onCreate={createPoll}
        />
      )}
      {viewingProfileUserId && (
        <ProfileViewModal
          userId={viewingProfileUserId}
          onClose={() => setViewingProfileUserId(null)}
        />
      )}
    </div>
  )
}
