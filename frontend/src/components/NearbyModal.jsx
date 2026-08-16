import React, { useState } from 'react'

export default function NearbyModal({ onClose, onSearch }) {
  const [mode, setMode] = useState('gps') // 'gps' | 'address'
  const [address, setAddress] = useState('')
  const [query, setQuery] = useState('restaurants')
  const [error, setError] = useState(null)
  const [locating, setLocating] = useState(false)

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onSearch({ query, lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        setLocating(false)
        setError(err.message || 'Could not get your location. Try entering an address instead.')
      },
      { timeout: 10000 },
    )
  }

  function submitAddress() {
    if (!address.trim()) {
      setError('Enter an address first.')
      return
    }
    onSearch({ query, address: address.trim() })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Find nearby places</h3>

        <input
          className="modal-input"
          placeholder="What are you looking for? (e.g. restaurants)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="modal-tabs">
          <button
            className={mode === 'gps' ? 'active' : ''}
            onClick={() => { setMode('gps'); setError(null) }}
          >
            Use my location
          </button>
          <button
            className={mode === 'address' ? 'active' : ''}
            onClick={() => { setMode('address'); setError(null) }}
          >
            Type an address
          </button>
        </div>

        {mode === 'gps' ? (
          <button className="modal-primary" onClick={useMyLocation} disabled={locating}>
            {locating ? 'Locating…' : '📍 Use my current location'}
          </button>
        ) : (
          <>
            <input
              className="modal-input"
              placeholder="123 Main St, City"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitAddress()}
            />
            <button className="modal-primary" onClick={submitAddress}>
              Search
            </button>
          </>
        )}

        {error && <div className="modal-error">{error}</div>}
        <button className="modal-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
