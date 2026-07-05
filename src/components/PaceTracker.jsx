import { useState, useEffect } from 'react'
import { Zap, Plus } from 'lucide-react'
import { getBookLog, startReading, logSession, getPaceStats } from '../lib/readingLog'

import { c } from '../lib/theme'

export default function PaceTracker({ bookId, totalPages }) {
  const [stats, setStats] = useState(null)
  const [input, setInput] = useState('')
  const [showInput, setShowInput] = useState(false)

  const [log, setLog] = useState(null)

  useEffect(() => {
    startReading(bookId, totalPages).then(() =>
      getPaceStats(bookId).then(s => {
        setStats(s)
        getBookLog(bookId).then(setLog)
      })
    )
  }, [bookId, totalPages])

  async function handleLog(e) {
    e.preventDefault()
    const n = parseInt(input, 10)
    if (!n || n < 1) return
    await logSession(bookId, n)
    const s = await getPaceStats(bookId)
    setStats(s)
    setInput('')
    setShowInput(false)
  }
  const pct = stats?.pctDone ?? 0

  return (
    <div
      className="rounded-xl p-4 mt-4"
      style={{ backgroundColor: c.surface2, border: `1px solid ${c.border}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={13} style={{ color: c.accentText }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: c.textPrimary, fontFamily: '"Lora", serif' }}>
            Reading Pace
          </span>
        </div>
        <button
          onClick={() => setShowInput(v => !v)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
          style={{ backgroundColor: c.surface, color: c.accentText, border: `1px solid ${c.border}`, cursor: 'pointer' }}
        >
          <Plus size={11} /> Log pages
        </button>
      </div>

      {showInput && (
        <form onSubmit={handleLog} className="flex gap-2 mb-3">
          <input
            type="number"
            min="1"
            placeholder="Pages read today"
            value={input}
            onChange={e => setInput(e.target.value)}
            autoFocus
            className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
            style={{ backgroundColor: c.surface, color: c.textPrimary, border: `1px solid ${c.border}` }}
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, cursor: 'pointer' }}
          >
            Save
          </button>
        </form>
      )}

      {/* Progress bar */}
      {totalPages && (
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1" style={{ color: c.textMuted }}>
            <span>{stats?.pagesRead ?? 0} pages read</span>
            <span>{totalPages} total</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 5, backgroundColor: c.surface }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct * 100}%`, backgroundColor: c.accent }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2.5 text-center" style={{ backgroundColor: c.surface }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: c.textPrimary, fontFamily: '"Lora", serif' }}>
            {stats?.pagesPerDay ? stats.pagesPerDay.toFixed(0) : '—'}
          </div>
          <div style={{ fontSize: '0.65rem', color: c.textMuted, marginTop: 2 }}>pages / day</div>
        </div>
        <div className="rounded-lg p-2.5 text-center" style={{ backgroundColor: c.surface }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: c.textPrimary, fontFamily: '"Lora", serif' }}>
            {stats?.daysRemaining != null ? Math.ceil(stats.daysRemaining) : '—'}
          </div>
          <div style={{ fontSize: '0.65rem', color: c.textMuted, marginTop: 2 }}>days to finish</div>
        </div>
      </div>

      {log?.startDate && (
        <p className="mt-2 text-xs text-center" style={{ color: c.textMuted }}>
          Started {Math.round((Date.now() - log.startDate) / 86400000)} day{Math.round((Date.now() - log.startDate) / 86400000) !== 1 ? 's' : ''} ago
        </p>
      )}
    </div>
  )
}
