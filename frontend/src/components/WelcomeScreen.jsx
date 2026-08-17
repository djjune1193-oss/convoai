import React, { useState } from 'react'

export default function WelcomeScreen({ onSignup, onLogin, error, loading }) {
  const [mode, setMode] = useState('signup') // 'signup' | 'login'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  const canSubmit =
    username.trim().length > 0 &&
    password.trim().length > 0 &&
    (mode === 'login' || displayName.trim().length > 0)

  function submit() {
    if (!canSubmit || loading) return
    if (mode === 'signup') {
      onSignup(username.trim(), password, displayName.trim())
    } else {
      onLogin(username.trim(), password)
    }
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-orb" />
      <div>
        <h1 className="welcome-wordmark">ConvoAI</h1>
        <p className="welcome-tagline">
          Chat with people. Swipe a message to bring AI into the
          conversation, right where you're talking.
        </p>
      </div>

      <div className="welcome-form">
        <div className="modal-tabs">
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            Sign up
          </button>
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Log in
          </button>
        </div>

        <input
          className="welcome-input"
          placeholder="User ID"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoCapitalize="none"
        />
        <input
          className="welcome-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {mode === 'signup' && (
          <input
            className="welcome-input"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        )}

        <button className="welcome-cta" disabled={!canSubmit || loading} onClick={submit}>
          {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
        {error && <div className="modal-error">{error}</div>}
      </div>
    </div>
  )
}
