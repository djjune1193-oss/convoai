import React, { useEffect, useState } from 'react'
import { fetchUser } from '../api.js'

function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase()
}

export default function ProfileViewModal({ userId, onClose }) {
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [showFullscreen, setShowFullscreen] = useState(false)

  useEffect(() => {
    setUser(null)
    setError(null)
    fetchUser(userId)
      .then(setUser)
      .catch((err) => setError(err.message))
  }, [userId])

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal profile-view-modal" onClick={(e) => e.stopPropagation()}>
          {!user && !error && <p className="invites-empty">Loading…</p>}
          {error && <div className="modal-error">{error}</div>}

          {user && (
            <>
              <div
                className="avatar-circle-large profile-view-avatar"
                onClick={() => user.avatar_url && setShowFullscreen(true)}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" />
                ) : (
                  <span>{initials(user.display_name)}</span>
                )}
              </div>

              <h3 className="profile-view-name">{user.display_name}</h3>
              <div className="convoai-id-badge">
                ConvoAI ID: <strong>{user.username}</strong>
              </div>

              {user.status && <p className="profile-view-status">"{user.status}"</p>}

              {(user.work || user.sports || user.hobbies) && (
                <div className="profile-view-details">
                  {user.work && (
                    <div><span className="profile-view-label">Work</span> {user.work}</div>
                  )}
                  {user.sports && (
                    <div><span className="profile-view-label">Sports</span> {user.sports}</div>
                  )}
                  {user.hobbies && (
                    <div><span className="profile-view-label">Hobbies</span> {user.hobbies}</div>
                  )}
                </div>
              )}
            </>
          )}

          <button className="modal-cancel" onClick={onClose}>Close</button>
        </div>
      </div>

      {showFullscreen && user?.avatar_url && (
        <div className="fullscreen-avatar" onClick={() => setShowFullscreen(false)}>
          <img src={user.avatar_url} alt="Profile full screen" />
          {user.status && (
            <div className="fullscreen-status-overlay">
              <div className="fullscreen-status-name">{user.display_name}</div>
              <div className="fullscreen-status-text">{user.status}</div>
            </div>
          )}
          <button className="fullscreen-close" onClick={() => setShowFullscreen(false)}>✕</button>
        </div>
      )}
    </>
  )
}
