import React, { useRef, useState } from 'react'
import { updateProfile, uploadAvatar } from '../api.js'

function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase()
}

export default function ProfileScreen({ user, mode, onSaved, onBack, onLogout }) {
  const [displayName, setDisplayName] = useState(user.display_name || '')
  const [status, setStatus] = useState(user.status || '')
  const [work, setWork] = useState(user.work || '')
  const [sports, setSports] = useState(user.sports || '')
  const [hobbies, setHobbies] = useState(user.hobbies || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(user.avatar_url || null)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function copyId() {
    navigator.clipboard.writeText(user.username)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleSave() {
    if (!displayName.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let updated = user
      if (avatarFile) {
        updated = await uploadAvatar(user.id, avatarFile)
      }
      updated = await updateProfile(user.id, {
        display_name: displayName.trim(),
        status: status.trim(),
        work: work.trim(),
        sports: sports.trim(),
        hobbies: hobbies.trim(),
      })
      onSaved(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-screen">
      <div className="profile-header">
        {mode === 'edit' && <button className="chat-back" onClick={onBack}>←</button>}
        <div className="profile-header-title">
          {mode === 'setup' ? 'Set up your profile' : 'Your profile'}
        </div>
      </div>

      <div className="profile-body">
        <div className="avatar-section">
          <div
            className="avatar-circle-large"
            onClick={() => (avatarPreview ? setShowFullscreen(true) : fileInputRef.current?.click())}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Profile" />
            ) : (
              <span>{initials(displayName)}</span>
            )}
          </div>
          <button className="avatar-edit-button" onClick={() => fileInputRef.current?.click()}>
            📷 {avatarPreview ? 'Change photo' : 'Add photo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <div className="convoai-id-badge">
          Your ConvoAI ID: <strong>{user.username}</strong>
          <button onClick={copyId}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
        <p className="convoai-id-hint">Share this with people so they can invite you to chat.</p>

        <label className="profile-label">Status</label>
        <input
          className="profile-input"
          placeholder="What's on your mind?"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          maxLength={80}
        />

        <label className="profile-label">Name *</label>
        <input
          className="profile-input"
          placeholder="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <div className="profile-optional-heading">Optional — helps us connect you with people nearby later</div>

        <label className="profile-label">What I do for work</label>
        <input className="profile-input" placeholder="e.g. Product designer" value={work} onChange={(e) => setWork(e.target.value)} />

        <label className="profile-label">Sports</label>
        <input className="profile-input" placeholder="e.g. Climbing, tennis" value={sports} onChange={(e) => setSports(e.target.value)} />

        <label className="profile-label">Hobbies</label>
        <input className="profile-input" placeholder="e.g. Cooking, photography" value={hobbies} onChange={(e) => setHobbies(e.target.value)} />

        {error && <div className="modal-error">{error}</div>}

        <button className="welcome-cta" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : mode === 'setup' ? 'Continue to ConvoAI' : 'Save changes'}
        </button>

        {onLogout && (
          <button className="logout-button" onClick={onLogout}>Log out</button>
        )}
      </div>

      {showFullscreen && (
        <div className="fullscreen-avatar" onClick={() => setShowFullscreen(false)}>
          <img src={avatarPreview} alt="Profile full screen" />
          {status && (
            <div className="fullscreen-status-overlay">
              <div className="fullscreen-status-name">{displayName}</div>
              <div className="fullscreen-status-text">{status}</div>
            </div>
          )}
          <button className="fullscreen-close" onClick={() => setShowFullscreen(false)}>✕</button>
        </div>
      )}
    </div>
  )
}
