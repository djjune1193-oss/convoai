import React, { useState } from 'react'

export default function WelcomeScreen({ onSubmit, error }) {
  const [username, setUsername] = useState('')

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
        <input
          className="welcome-input"
          placeholder="What's your name?"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && username && onSubmit(username)}
        />
        <button
          className="welcome-cta"
          disabled={!username.trim()}
          onClick={() => onSubmit(username.trim())}
        >
          Get started
        </button>
        {error && <div className="modal-error">{error}</div>}
      </div>
    </div>
  )
}
