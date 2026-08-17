import React, { useState } from 'react'
import { updateLocation } from '../api.js'

export default function LocationPromptScreen({ user, onDone }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'locating' | 'error'
  const [error, setError] = useState(null)

  function enableLocation() {
    if (!navigator.geolocation) {
      setStatus('error')
      setError('Your browser doesn\u2019t support location. You can still use ConvoAI without it.')
      return
    }
    setStatus('locating')
    setError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const updated = await updateLocation(user.id, pos.coords.latitude, pos.coords.longitude)
          onDone(updated)
        } catch (err) {
          setStatus('error')
          setError(err.message)
        }
      },
      (err) => {
        setStatus('error')
        setError(err.message || 'Could not get your location. You can still use ConvoAI without it.')
      },
      { timeout: 10000 },
    )
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-orb" />
      <div>
        <h1 className="welcome-wordmark" style={{ fontSize: 28 }}>📍</h1>
        <p className="welcome-tagline">
          Enable location to connect with people with similar interests near you.
        </p>
      </div>

      <div className="welcome-form">
        <button className="welcome-cta" onClick={enableLocation} disabled={status === 'locating'}>
          {status === 'locating' ? 'Getting your location…' : 'Enable location'}
        </button>
        <button className="modal-cancel" onClick={() => onDone(null)}>
          Not now
        </button>
        {error && <div className="modal-error">{error}</div>}
      </div>
    </div>
  )
}
