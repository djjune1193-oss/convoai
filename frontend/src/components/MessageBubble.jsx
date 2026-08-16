import React, { useRef, useState } from 'react'

const SWIPE_THRESHOLD = 80
const MAX_DRAG = 140

export default function MessageBubble({
  message,
  currentUser,
  parentPreview,
  onSwipeAI,
  onToggleLike,
  onReply,
  onMakePoll,
  onDelete,
  onVotePoll,
}) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const startX = useRef(0)
  const triggered = useRef(false)

  const isAI = message.sender_type === 'ai'
  const isOwn = message.sender_id === currentUser.id
  const side = isOwn ? 'own' : 'other'
  const liked = (message.liked_user_ids || []).includes(currentUser.id)

  function onPointerDown(e) {
    if (isAI || message.deleted) return
    startX.current = e.clientX
    setDragging(true)
    triggered.current = false
  }

  function onPointerMove(e) {
    if (!dragging) return
    const delta = e.clientX - startX.current
    const clamped = Math.min(0, Math.max(delta, -MAX_DRAG)) // left-swipe only
    setDragX(clamped)
    if (clamped <= -SWIPE_THRESHOLD && !triggered.current) {
      triggered.current = true
      if (navigator.vibrate) navigator.vibrate(15)
    }
  }

  function onPointerUp() {
    if (!dragging) return
    setDragging(false)
    if (dragX <= -SWIPE_THRESHOLD) onSwipeAI(message.id)
    setDragX(0)
  }

  function closeMenu() { setMenuOpen(false) }

  // ---- deleted ----
  if (message.deleted) {
    return (
      <div className={`bubble-row ${side}`}>
        <div className="bubble bubble-deleted">This message was deleted</div>
      </div>
    )
  }

  // ---- poll ----
  if (message.kind === 'poll') {
    let poll
    try {
      poll = JSON.parse(message.content)
    } catch {
      poll = { question: 'Poll', options: [], votes: {} }
    }
    const totalVotes = Object.values(poll.votes || {}).reduce((sum, v) => sum + v.length, 0)
    const myVoteOptionId = Object.entries(poll.votes || {}).find(([, voters]) =>
      voters.includes(currentUser.id)
    )?.[0]

    return (
      <div className={`bubble-row ${side}`}>
        <div className="bubble bubble-poll">
          <div className="bubble-sender">{message.sender_name}</div>
          <div className="poll-question">📊 {poll.question}</div>
          <div className="poll-options">
            {poll.options.map((opt) => {
              const votes = (poll.votes?.[String(opt.id)] || []).length
              const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
              const votedHere = String(opt.id) === myVoteOptionId
              return (
                <div
                  key={opt.id}
                  className={`poll-option ${votedHere ? 'voted' : ''}`}
                  onClick={() => onVotePoll(message.id, opt.id)}
                >
                  <div className="poll-option-fill" style={{ width: `${pct}%` }} />
                  <span className="poll-option-text">{opt.text}</span>
                  <span className="poll-option-count">{votes}</span>
                </div>
              )
            })}
          </div>
          <div className="poll-total-votes">{totalVotes} vote{totalVotes === 1 ? '' : 's'}</div>
        </div>
      </div>
    )
  }

  // ---- web search ----
  if (message.kind === 'websearch') {
    let data
    try {
      data = JSON.parse(message.content)
    } catch {
      data = { query: '', answer: message.content, sources: [] }
    }
    return (
      <div className={`bubble-row ${side}`}>
        <div className="bubble bubble-websearch">
          <div className="bubble-sender">{message.sender_name}</div>
          {data.query && <div className="websearch-query">🌐 {data.query}</div>}
          <div className="websearch-answer">{data.answer}</div>
          {data.sources?.length > 0 && (
            <div className="places-sources">
              Sources:{' '}
              {data.sources.map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && ', '}
                  <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- places ----
  if (message.kind === 'places') {
    let data
    try {
      data = JSON.parse(message.content)
    } catch {
      data = { label: 'Nearby places', results: [], sources: [] }
    }
    return (
      <div className={`bubble-row ${side}`}>
        <div className="bubble bubble-places">
          <div className="bubble-sender">{message.sender_name}</div>
          <div className="places-label">{data.label}</div>
          <ol className="places-list">
            {data.results.map((r, i) => (
              <li key={i}>
                <span className="place-name">{r.name}</span>
                <span className="place-meta">
                  {typeof r.distance_km === 'number' ? `${r.distance_km.toFixed(1)} km` : ''}
                  {r.rating ? ` · ⭐ ${r.rating}` : ''}
                </span>
                {r.address && <div className="place-address">{r.address}</div>}
              </li>
            ))}
          </ol>
          {data.sources?.length > 0 && (
            <div className="places-sources">
              Sources (<span translate="no">Google Maps</span>):{' '}
              {data.sources.map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && ', '}
                  <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- plain text (own / other / AI) ----
  const bubbleClass = isAI ? 'bubble-ai' : isOwn ? 'bubble-user' : 'bubble-other'

  return (
    <div className={`bubble-row ${side}`}>
      {parentPreview && (
        <div className="reply-preview">
          ↩ {parentPreview.sender_name}: {parentPreview.content.slice(0, 60)}
        </div>
      )}
      <div
        className={`bubble ${bubbleClass}`}
        style={{ transform: `translateX(${dragX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="bubble-sender">{message.sender_name}</div>
        <div className="bubble-content">{message.content}</div>

        <div className="bubble-footer">
          <button
            className={`like-button ${liked ? 'liked' : ''}`}
            onClick={() => onToggleLike(message.id)}
          >
            ❤ {(message.liked_user_ids || []).length || ''}
          </button>
          <button className="msg-menu-button" onClick={() => setMenuOpen((v) => !v)}>⋯</button>
        </div>

        {menuOpen && (
          <div className="msg-menu">
            <button onClick={() => { onReply(message); closeMenu() }}>↩ Reply</button>
            {!isAI && (
              <button onClick={() => { onMakePoll(message); closeMenu() }}>📊 Make a poll</button>
            )}
            {isOwn && (
              <button className="danger" onClick={() => { onDelete(message.id); closeMenu() }}>
                🗑 Delete
              </button>
            )}
          </div>
        )}
      </div>

      {dragX <= -20 && !isAI && (
        <div
          className="swipe-hint"
          style={{ opacity: Math.min(1, -dragX / SWIPE_THRESHOLD) }}
        >
          🤖 Ask AI
        </div>
      )}
    </div>
  )
}
