import React, { useState } from 'react'
import { sendInvite } from '../api.js'

export default function SendInviteModal({ currentUser, onClose }) {
  const [convoaiId, setConvoaiId] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!convoaiId.trim()) {
      setError('Enter a ConvoAI ID.')
      return
    }
    setSending(true)
    setError(null)
    try {
      await sendInvite(currentUser.id, convoaiId.trim())
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Invite someone to chat</h3>

        {success ? (
          <>
            <p>Invite sent! You'll be able to chat once they accept.</p>
            <button className="modal-primary" onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
              Ask them for their ConvoAI ID — it's on their profile.
            </p>
            <input
              className="modal-input"
              placeholder="e.g. alice123"
              value={convoaiId}
              onChange={(e) => setConvoaiId(e.target.value.toLowerCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            {error && <div className="modal-error">{error}</div>}
            <button className="modal-primary" onClick={handleSend} disabled={sending}>
              {sending ? 'Sending…' : 'Send invite'}
            </button>
            <button className="modal-cancel" onClick={onClose}>Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}
