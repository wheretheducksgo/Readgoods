import { useState, useEffect, useRef } from 'react'
import { ALL_MOODS, getBookMoods, setBookMoods } from '../lib/moods'
import { Plus, X } from 'lucide-react'
import { c } from '../lib/theme'

const PRESET_IDS = new Set(ALL_MOODS.map(m => m.id))

export default function MoodTagger({ bookId }) {
  const [selected, setSelected] = useState([])
  const [customInput, setCustomInput] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    getBookMoods(bookId).then(setSelected)
  }, [bookId])

  async function save(next) {
    setSelected(next)
    await setBookMoods(bookId, next)
  }

  async function togglePreset(id) {
    const next = selected.includes(id)
      ? selected.filter(x => x !== id)
      : [...selected, id]
    await save(next)
  }

  async function addCustom() {
    const tag = customInput.trim()
    if (!tag || selected.includes(tag)) { setCustomInput(''); return }
    await save([...selected, tag])
    setCustomInput('')
  }

  async function removeTag(tag) {
    await save(selected.filter(x => x !== tag))
  }

  const customTags = selected.filter(id => !PRESET_IDS.has(id))

  return (
    <div>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.textMuted, marginBottom: 10 }}>
        Mood Tags
      </p>

      {/* Preset suggestions */}
      <div className="flex flex-wrap gap-2 mb-3">
        {ALL_MOODS.map(({ id, label, emoji }) => {
          const on = selected.includes(id)
          return (
            <button
              key={id}
              onClick={() => togglePreset(id)}
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

      {/* Custom tags */}
      {customTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {customTags.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: c.warmBg, color: c.warmText, border: `1px solid ${c.border}` }}
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: c.textMuted }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Custom tag input */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
          placeholder="Add your own tag…"
          maxLength={30}
          style={{
            flex: 1,
            backgroundColor: c.surface2,
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            color: c.textPrimary,
            fontSize: '0.8rem',
            padding: '5px 10px',
            outline: 'none',
          }}
        />
        <button
          onClick={addCustom}
          disabled={!customInput.trim()}
          style={{
            backgroundColor: customInput.trim() ? c.accentBg : c.surface2,
            color: customInput.trim() ? c.accentText : c.textMuted,
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            padding: '5px 10px',
            cursor: customInput.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.8rem',
          }}
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}
