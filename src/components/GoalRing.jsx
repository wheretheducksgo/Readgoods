import { useState } from 'react'
import { Target } from 'lucide-react'
import { getGoal, setGoal } from '../lib/goals'
import { c } from '../lib/theme'

const SIZE = 80
const STROKE = 7
const R = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * R

export default function GoalRing({ year, booksRead }) {
  const [goal, setGoalState] = useState(() => getGoal(year))
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  function save(e) {
    e.preventDefault()
    const n = parseInt(input, 10)
    if (n > 0) { setGoal(year, n); setGoalState(n) }
    setEditing(false)
  }

  function clear() {
    setGoal(year, null)
    setGoalState(null)
    setEditing(false)
  }

  const pct = goal ? Math.min(booksRead / goal, 1) : 0
  const dash = pct * CIRC

  if (editing) {
    return (
      <form onSubmit={save} className="flex items-center gap-2">
        <input
          type="number" min="1" max="365"
          placeholder="Books goal"
          value={input}
          onChange={e => setInput(e.target.value)}
          autoFocus
          className="w-28 rounded-lg px-3 py-1.5 text-sm outline-none"
          style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}` }}
        />
        <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, cursor: 'pointer' }}>
          Set
        </button>
        {goal && <button type="button" onClick={clear} className="text-xs" style={{ color: c.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>}
        <button type="button" onClick={() => setEditing(false)} className="text-xs" style={{ color: c.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
      </form>
    )
  }

  if (!goal) {
    return (
      <button
        onClick={() => { setInput(''); setEditing(true) }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
        style={{ backgroundColor: c.surface, color: c.textSecondary, border: `1px solid ${c.border}`, cursor: 'pointer' }}
      >
        <Target size={12} /> Set reading goal
      </button>
    )
  }

  return (
    <button
      onClick={() => { setInput(String(goal)); setEditing(true) }}
      className="flex items-center gap-3 rounded-xl px-4 py-2"
      style={{ backgroundColor: c.surface, border: `1px solid ${c.border}`, cursor: 'pointer' }}
      title="Click to edit goal"
    >
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={c.surface2} strokeWidth={STROKE} />
        <circle
          cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
          stroke={pct >= 1 ? '#5cb87a' : c.accent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRC}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="text-left">
        <div style={{ fontFamily: '"Lora", serif', fontSize: '1.1rem', fontWeight: 700, color: c.textPrimary, lineHeight: 1 }}>
          {booksRead} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: c.textSecondary }}>/ {goal}</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: c.textMuted, marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {year} reading goal
        </div>
        {pct >= 1 && (
          <div style={{ fontSize: '0.72rem', color: '#5cb87a', marginTop: 3 }}>🎉 Goal reached!</div>
        )}
      </div>
    </button>
  )
}
