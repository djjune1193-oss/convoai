import React, { useState } from 'react'
import { createGroupChat } from '../api.js'

export default function GroupChatModal({ currentUser, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [ids, setIds] = useState(['', ''])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  function updateId(i, value) {
    setIds((prev) => prev.map((v, idx) => (idx === i ? value.toLowerCase() : v)))
  }

  function addId() {
    if (ids.length >= 10) return
    setIds((prev) => [...prev, ''])
  }

  function removeId(i) {
    if (ids.length <= 1) return
    setIds((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function submit() {
    const cleaned = ids.map((v) => v.trim()).filter(Boolean)
    if (cleaned.length === 0) {
      setError('Add at least one person\u2019s ConvoAI ID.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await createGroupChat(currentUser.id, name.trim(), cleaned)
      const failures = result.results.filter((r) => r.status !== 'invited')
      if (failures.length > 0) {
        const lines = failures.map((f) => `${f.convoai_id}: ${f.detail || f.status}`).join('\n')
        alert(`Group created. Some invites didn't go through:\n${lines}`)
      }
      onCreated(result.conversation_id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Start a group chat</h3>

        <input
          className="modal-input"
          placeholder="Group name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '4px 0 0' }}>
          Enter each person's ConvoAI ID — they'll each get an invite to join.
        </p>

        {ids.map((id, i) => (
          <div className="poll-option-row" key={i}>
            <input
              className="modal-input"
              placeholder={`ConvoAI ID ${i + 1}`}
              value={id}
              onChange={(e) => updateId(i, e.target.value)}
            />
            {ids.length > 1 && (
              <button className="poll-option-remove" onClick={() => removeId(i)}>×</button>
            )}
          </div>
        ))}

        {ids.length < 10 && (
          <button className="poll-add-option" onClick={addId}>+ Add another person</button>
        )}

        {error && <div className="modal-error">{error}</div>}

        <button className="modal-primary" onClick={submit} disabled={busy}>
          {busy ? 'Creating…' : 'Create group'}
        </button>
        <button className="modal-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
