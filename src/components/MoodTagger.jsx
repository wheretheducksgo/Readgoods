import { useState, useEffect } from 'react'
import { ALL_MOODS, getBookMoods, setBookMoods } from '../lib/moods'
import { c } from '../lib/theme'

export default function MoodTagger({ bookId }) {
  const [selected, setSelected] = useState([])

  useEffect(() => {
    setSelected(getBookMoods(bookId))
  }, [bookId])

  function toggle(id) {
    const next = selected.includes(id)
      ? selected.filter(x => x !== id)
      : [...selected, id]
    setSelected(next)
    setBookMoods(bookId, next)
  }

  return (
    <div>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.textMuted, marginBottom: 10 }}>
        Mood Tags
      </p>
      <div className="flex flex-wrap gap-2">
        {ALL_MOODS.map(({ id, label, emoji }) => {
          const on = selected.includes(id)
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                backgroundColor: on ? c.accentBg : c.surface2,
                color: on ? c.accentText : c.textSecondary,
                border: `1px solid ${on ? c.accent : c.border}`,
                cursor: 'pointer',
              }}
            >
              <span>{emoji}</span>
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
