import React, { useState } from 'react'

export default function PollCreateModal({ initialQuestion, onClose, onCreate }) {
  const [question, setQuestion] = useState(initialQuestion || '')
  const [options, setOptions] = useState(['', ''])
  const [error, setError] = useState(null)

  function updateOption(i, value) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)))
  }

  function addOption() {
    if (options.length >= 6) return
    setOptions((prev) => [...prev, ''])
  }

  function removeOption(i) {
    if (options.length <= 2) return
    setOptions((prev) => prev.filter((_, idx) => idx !== i))
  }

  function submit() {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim()) {
      setError('Give the poll a question.')
      return
    }
    if (cleanOptions.length < 2) {
      setError('Add at least 2 options.')
      return
    }
    onCreate(question.trim(), cleanOptions)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Make a poll</h3>

        <input
          className="modal-input"
          placeholder="Poll question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        {options.map((opt, i) => (
          <div className="poll-option-row" key={i}>
            <input
              className="modal-input"
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
            />
            {options.length > 2 && (
              <button className="poll-option-remove" onClick={() => removeOption(i)}>×</button>
            )}
          </div>
        ))}

        {options.length < 6 && (
          <button className="poll-add-option" onClick={addOption}>+ Add option</button>
        )}

        {error && <div className="modal-error">{error}</div>}

        <button className="modal-primary" onClick={submit}>Create poll</button>
        <button className="modal-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
