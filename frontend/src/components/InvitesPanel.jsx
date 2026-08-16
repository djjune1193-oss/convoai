import React, { useEffect, useState } from 'react'
import { fetchInvites, respondInvite } from '../api.js'

export default function InvitesPanel({ currentUser, onClose, onAccepted }) {
  const [invites, setInvites] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchInvites(currentUser.id).then(setInvites)
  }, [currentUser.id])

  const incoming = invites?.filter((i) => i.direction === 'incoming' && i.status === 'pending') || []
  const outgoing = invites?.filter((i) => i.direction === 'outgoing' && i.status === 'pending') || []

  async function respond(invite, action) {
    setBusyId(invite.id)
    setError(null)
    try {
      const result = await respondInvite(invite.id, currentUser.id, action)
      setInvites((prev) => prev.map((i) => (i.id === invite.id ? { ...i, status: action === 'accept' ? 'accepted' : 'declined' } : i)))
      if (action === 'accept' && result.conversation_id) {
        onAccepted(result.conversation_id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal invites-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Invites</h3>

        {invites === null && <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Loading…</p>}

        {invites && (
          <>
            <div className="invites-section-label">For you</div>
            {incoming.length === 0 && <p className="invites-empty">No invites right now.</p>}
            {incoming.map((inv) => (
              <div className="invite-row" key={inv.id}>
                <span>{inv.from_user.display_name} <span className="invite-id">({inv.from_user.username})</span></span>
                <div className="invite-actions">
                  <button
                    className="invite-accept"
                    disabled={busyId === inv.id}
                    onClick={() => respond(inv, 'accept')}
                  >
                    Accept
                  </button>
                  <button
                    className="invite-decline"
                    disabled={busyId === inv.id}
                    onClick={() => respond(inv, 'decline')}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}

            <div className="invites-section-label">Sent</div>
            {outgoing.length === 0 && <p className="invites-empty">No pending invites sent.</p>}
            {outgoing.map((inv) => (
              <div className="invite-row" key={inv.id}>
                <span>{inv.to_user.display_name} <span className="invite-id">({inv.to_user.username})</span></span>
                <span className="invite-waiting">Waiting…</span>
              </div>
            ))}
          </>
        )}

        {error && <div className="modal-error">{error}</div>}
        <button className="modal-cancel" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
